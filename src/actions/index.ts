/**
 * Server actions: POST /api/actions/<name>, caller's JWT verified first.
 *
 * These are the ONLY code paths that write `attempts` and `leaderboard`
 * (members have no write permission on either). Action tools run with RBAC
 * off, so every action loads the attempt and checks `userId === caller`
 * itself; that check is the authorization. Each action also checks the case
 * is on the right part, so parts can only be played in order, once.
 *
 *   startAttempt     → new attempt (or resume the one in progress)
 *   askQuestion      → Part 1: one question to the AI interviewer (max 3)
 *   finishClarify    → Part 1 scored by code (key facts uncovered)
 *   submitStructure  → Part 2 graded by the AI judge
 *   submitAnalyze    → Part 3: number graded by code, "so what" by the judge
 *   submitRecommend  → Part 4 graded by the judge; completes the attempt,
 *                      writes the review, updates the leaderboard
 *
 * Concurrency. Each tools.* call is its own request to the RecordRoom, so a
 * read-then-write is not atomic, and an AI call can take seconds in between.
 * Without care, two parallel submissions could both pass the "right part"
 * check, or a slow one could land after a later part and overwrite it (e.g.
 * reopen Part 3 after its answer was shown). So every grading action:
 *   1. claims the attempt: writes a `pending` marker with a random token
 *      (refused if a fresh claim is already there) and counts its AI calls;
 *   2. grades;
 *   3. re-reads the attempt and saves ONLY if it is still on the same part
 *      and still carries this request's token, merging into the fresh copy.
 * Two requests racing for the same claim: the later token wins, and the
 * earlier request is discarded at step 3. A true lock would need the writes
 * to run inside one Durable Object (see DECISIONS.md #24).
 */

import type { ActionHandler, ActionResult, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { CASES, getCase, PARTS, type CaseSummary } from '../cases/catalog'
import { getHiddenCase, RECOMMENDATION_CHECKPOINTS, type HiddenCase } from '../server/cases'
import { formatAnswer, judgeNumber, parseAnswer, scoreCheckpoints, scoreClarify } from '../server/grading'
import { AiError, askInterviewer, judgeAgainstCheckpoints, type JudgeResult } from '../server/ai'
import type { AttemptReview, AttemptRow, PartResult } from '../schemas/attempts-schema'
import type { LeaderboardRow } from '../schemas/leaderboard-schema'
import { publicName } from '../lib/names'

export { publicName }

type Attempt = { recordId: string; data: AttemptRow }

const MAX_TEXT = 4_000
const MAX_QUESTION = 500
/** Part 1 allows this many questions to the AI interviewer. */
const MAX_QUESTIONS = 3
/** New attempts a user may start per day (UTC). */
const DAILY_ATTEMPT_LIMIT = 8
/**
 * AI calls one attempt may make, failed ones included. A clean run uses 6
 * (3 questions + structure + so-what + recommendation); the rest is headroom
 * for retries after an AI error. With the daily limit this caps owner-billed
 * spend at 8 × 10 calls per user per day (a couple of cents).
 */
const MAX_AI_CALLS_PER_ATTEMPT = 10
/** A claim older than this is treated as abandoned (an AI call takes seconds). */
const PENDING_TTL_MS = 90_000
/** Points for the Part 3 number; the rest of Part 3 is the "so what". */
const ANALYZE_NUMBER_POINTS = 20

// ----------------------------------------------------------------- helpers

function fail(error: string): ActionResult<never> {
  return { success: false, error }
}

function aiFailure(err: unknown, where: string): ActionResult<never> {
  console.error(`[${where}] ${err instanceof Error ? err.message : String(err)}`)
  return fail(err instanceof AiError ? err.message : 'The AI grader is unavailable right now. Try again in a moment.')
}

async function loadOwnAttempt(tools: ActionTools, userId: string, attemptId: unknown): Promise<Attempt | null> {
  if (typeof attemptId !== 'string' || !attemptId) return null
  const got = await tools.get('attempts', attemptId)
  if (!got.success) return null
  const { record } = got.data as unknown as { record: Attempt }
  return record.data.userId === userId ? record : null
}

type Loaded = { attempt: Attempt; a: AttemptRow; summary: CaseSummary; hidden: HiddenCase }

/** Loads the caller's attempt and checks it is in progress on `part`. */
async function loadForPart(
  tools: ActionTools,
  userId: string,
  attemptId: unknown,
  part: number,
): Promise<Loaded | { error: ActionResult<never> }> {
  const attempt = await loadOwnAttempt(tools, userId, attemptId)
  if (!attempt) return { error: fail('Attempt not found') }
  const a = attempt.data
  if (a.status !== 'in_progress') return { error: fail('This case is already finished') }
  if (a.currentPart !== part) return { error: fail(`You're on Part ${a.currentPart}, not Part ${part}`) }
  const summary = getCase(a.caseId)
  const hidden = getHiddenCase(a.caseId)
  if (!summary || !hidden) return { error: fail('Unknown case') }
  return { attempt, a, summary, hidden }
}

function claimIsLive(a: AttemptRow): boolean {
  return !!a.pending && Date.now() - Date.parse(a.pending.at) < PENDING_TTL_MS
}

/** Step 1: mark the attempt as being graded, and count the AI calls this will make. */
type Claim = { token: string } | { error: ActionResult<never> }

async function claim(tools: ActionTools, loaded: Loaded, part: number, aiCalls: number): Promise<Claim> {
  const { attempt, a } = loaded
  if (claimIsLive(a)) return { error: fail('Still grading your last submission. Give it a moment.') }
  const used = a.aiCalls ?? 0
  if (aiCalls > 0 && used + aiCalls > MAX_AI_CALLS_PER_ATTEMPT) {
    return { error: fail('This attempt has used its AI budget. Start a new attempt to keep practicing.') }
  }
  const token = crypto.randomUUID()
  const updated = await tools.update('attempts', attempt.recordId, {
    pending: { part, token, at: new Date().toISOString() },
    aiCalls: used + aiCalls,
  } as Record<string, unknown>)
  if (!updated.success) return { error: fail('Could not save') }
  // Read back before spending an AI call: if a parallel request claimed
  // after us, its token is the one on the record and we back off. This
  // shrinks the race to the gap between two writes; it is not a lock.
  const check = await tools.get('attempts', attempt.recordId)
  const now = check.success ? (check.data as unknown as { record: Attempt }).record.data : null
  if (now?.pending?.token !== token) return { error: fail('Still grading your last submission. Give it a moment.') }
  return { token }
}

/** Step 3: the attempt as it is now, if this request still owns the claim for `part`. */
async function confirm(tools: ActionTools, userId: string, attemptId: string, part: number, token: string) {
  const fresh = await loadOwnAttempt(tools, userId, attemptId)
  if (!fresh) return null
  const a = fresh.data
  if (a.pending?.token !== token) return null
  if (a.status !== 'in_progress' || a.currentPart !== part) {
    // Our claim landed after the part was already saved: don't leave it
    // behind as a lock on the next part.
    await tools.update('attempts', attemptId, { pending: null } as Record<string, unknown>)
    return null
  }
  return fresh
}

/** Drop our claim after a failed AI call, unless another request has taken over. */
async function release(tools: ActionTools, userId: string, attemptId: string, token: string) {
  const fresh = await loadOwnAttempt(tools, userId, attemptId)
  if (fresh?.data.pending?.token === token) await tools.update('attempts', attemptId, { pending: null } as Record<string, unknown>)
}

const ALREADY_SUBMITTED = fail('This part was already submitted (another submission got there first).')

function points(part: number) {
  return PARTS[part - 1].points
}

function sumScore(results: Record<string, PartResult>): number {
  return Object.values(results).reduce((s, r) => s + r.points, 0)
}

function text(value: unknown, max = MAX_TEXT): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/** Moving into Part 3 is the one moment the exhibit is copied onto the attempt. */
function nextPartPatch(attempt: AttemptRow, nextPart: number): Partial<AttemptRow> {
  const patch: Partial<AttemptRow> = { currentPart: nextPart }
  if (nextPart === 3 && !attempt.exhibit) {
    patch.exhibit = getHiddenCase(attempt.caseId)?.exhibit ?? null
  }
  return patch
}

/** A judged part → a PartResult, with points computed in code. */
function judgedResult(part: number, submitted: string, checkpoints: string[], judged: JudgeResult, maxPoints = points(part)): PartResult {
  const hitCount = judged.hits.filter(Boolean).length
  return {
    points: scoreCheckpoints(judged.hits, maxPoints),
    maxPoints,
    submitted,
    verdict: `${hitCount} of ${checkpoints.length} checkpoints`,
    hits: checkpoints.filter((_, i) => judged.hits[i]),
    misses: checkpoints.filter((_, i) => !judged.hits[i]),
    feedback: judged.feedback,
  }
}

/** Save a part's result into the FRESH attempt, advance it, and drop the claim. */
async function saveResult(tools: ActionTools, fresh: Attempt, part: number, result: PartResult, extra: Partial<AttemptRow> = {}) {
  const results = { ...(fresh.data.results ?? {}), [String(part)]: result }
  const updated = await tools.update('attempts', fresh.recordId, {
    results,
    totalScore: sumScore(results),
    ...nextPartPatch(fresh.data, part + 1),
    pending: null,
    ...extra,
  } as Record<string, unknown>)
  return updated.success ? results : null
}

/**
 * The caller's display name from their JWT. The action route has already
 * verified the signature, so reading the payload here is safe.
 */
function jwtName(jwt: string): unknown {
  try {
    const part = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return (JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), '='))) as { name?: unknown }).name
  } catch {
    return undefined
  }
}

/**
 * Leaderboard score per case = your FIRST completed attempt at it. A finished
 * attempt shows the model answer, so a best-of rule would let anyone replay
 * a case from the answer key and max the board.
 */
export function firstAttemptScores(rows: Array<Partial<AttemptRow>>): Record<string, number> {
  const first: Record<string, { at: string; score: number }> = {}
  for (const d of rows) {
    if (d.status !== 'completed' || !d.caseId || !CASES.some((c) => c.id === d.caseId)) continue
    const at = d.completedAt || d.startedAt || ''
    if (!first[d.caseId] || at < first[d.caseId].at) first[d.caseId] = { at, score: Number(d.totalScore) || 0 }
  }
  return Object.fromEntries(Object.entries(first).map(([k, v]) => [k, v.score]))
}

/** Recompute the caller's public summary from their completed attempts. */
async function refreshLeaderboard(tools: ActionTools, userId: string, callerJwt: string) {
  const mine = await tools.query('attempts', { where: { userId, status: 'completed' }, limit: 500 })
  if (!mine.success) return
  const best = firstAttemptScores(mine.data.records.map((r) => r.data as Partial<AttemptRow>))
  const row: LeaderboardRow = {
    userId,
    name: publicName(jwtName(callerJwt)),
    best,
    solved: Object.keys(best).length,
    total: Object.values(best).reduce((s, n) => s + n, 0),
  }
  // recordId = userId: one row per user, upserted.
  const saved = await tools.create('leaderboard', row as unknown as Record<string, unknown>, userId)
  if (!saved.success) console.error(`[leaderboard] could not save row for ${userId}`)
}

function buildReview(a: AttemptRow, hidden: HiddenCase): AttemptReview {
  const revealed = a.factIdx ?? []
  return {
    keyInsight: hidden.keyInsight,
    modelRecommendation: hidden.modelRecommendation,
    working: hidden.answer.working,
    keyFacts: hidden.facts.flatMap((f, i) => (f.key ? [{ label: f.label, found: revealed.includes(i) }] : [])),
  }
}

// ----------------------------------------------------------------- actions

export const actions: Record<string, ActionHandler<Env>> = {
  /**
   * Start a case, or resume the caller's unfinished attempt at it.
   * params: { caseId } → { attemptId, resumed }
   */
  startAttempt: async ({ userId, params, tools }) => {
    const caseId = typeof params.caseId === 'string' ? params.caseId : ''
    if (!getCase(caseId) || !getHiddenCase(caseId)) return fail('Unknown case')

    const existing = await tools.query('attempts', { where: { userId, caseId, status: 'in_progress' }, limit: 1 })
    if (existing.success && existing.data.records.length > 0) {
      return { success: true, data: { attemptId: existing.data.records[0].recordId, resumed: true } }
    }

    const today = new Date().toISOString().slice(0, 10)
    const mine = await tools.query('attempts', { where: { userId }, limit: 500 })
    const startedToday = mine.success
      ? mine.data.records.filter((r) => String((r.data as Partial<AttemptRow>).startedAt ?? '').startsWith(today)).length
      : 0
    if (startedToday >= DAILY_ATTEMPT_LIMIT) {
      return fail(`Daily limit reached: ${DAILY_ATTEMPT_LIMIT} new cases per day. Come back tomorrow.`)
    }

    const row: AttemptRow = {
      userId,
      caseId,
      status: 'in_progress',
      currentPart: 1,
      results: {},
      totalScore: 0,
      exhibit: null,
      facts: [],
      factIdx: [],
      qa: [],
      review: null,
      pending: null,
      aiCalls: 0,
      startedAt: new Date().toISOString(),
      completedAt: '',
    }
    // Deterministic id per (user, case, day, slot): a burst of parallel starts
    // all compute the same slot and land on ONE record instead of slipping
    // past the daily limit with many.
    const recordId = `att-${userId}-${caseId}-${today}-${startedToday}`
    const created = await tools.create('attempts', row as unknown as Record<string, unknown>, recordId)
    if (!created.success) return fail('Could not start the case')
    return { success: true, data: { attemptId: created.data.recordId, resumed: false } }
  },

  /**
   * Part 1: ask the AI interviewer one clarifying question.
   * params: { attemptId, question } → { answer, questionsLeft }
   * The interviewer answers only from the hidden fact sheet; facts it reveals
   * are added to the attempt by index, so the board can't show invented facts.
   */
  askQuestion: async ({ userId, params, tools, env }) => {
    const loaded = await loadForPart(tools, userId, params.attemptId, 1)
    if ('error' in loaded) return loaded.error
    const { attempt, a, summary, hidden } = loaded
    if ((a.qa ?? []).length >= MAX_QUESTIONS) return fail(`You've used all ${MAX_QUESTIONS} questions. Move on to Structure.`)
    const question = text(params.question, MAX_QUESTION + 1)
    if (!question) return fail('Type a question first.')
    if (question.length > MAX_QUESTION) return fail(`Keep questions under ${MAX_QUESTION} characters.`)

    const claimed = await claim(tools, loaded, 1, 1)
    if ('error' in claimed) return claimed.error

    let reply
    try {
      reply = await askInterviewer(env, summary, hidden, a.qa ?? [], question)
    } catch (err) {
      await release(tools, userId, attempt.recordId, claimed.token)
      return aiFailure(err, 'askQuestion') // the question isn't used up (the AI call is counted)
    }

    const fresh = await confirm(tools, userId, attempt.recordId, 1, claimed.token)
    if (!fresh) return ALREADY_SUBMITTED
    const qa = fresh.data.qa ?? []
    if (qa.length >= MAX_QUESTIONS) return fail(`You've used all ${MAX_QUESTIONS} questions. Move on to Structure.`)
    const factIdx = [...new Set([...(fresh.data.factIdx ?? []), ...reply.revealedFacts])].sort((x, y) => x - y)
    const updated = await tools.update('attempts', attempt.recordId, {
      qa: [...qa, { q: question, a: reply.answer }],
      factIdx,
      facts: factIdx.map((i) => hidden.facts[i].label),
      pending: null,
    } as Record<string, unknown>)
    if (!updated.success) return fail('Could not save')
    return { success: true, data: { answer: reply.answer, questionsLeft: MAX_QUESTIONS - qa.length - 1 } }
  },

  /**
   * Part 1 → Part 2. Scored by code: the share of the case's KEY facts your
   * questions uncovered. Which key facts you missed stays hidden until the
   * case is over, so the score can't leak the answer.
   */
  finishClarify: async ({ userId, params, tools }) => {
    const loaded = await loadForPart(tools, userId, params.attemptId, 1)
    if ('error' in loaded) return loaded.error
    const claimed = await claim(tools, loaded, 1, 0)
    if ('error' in claimed) return claimed.error
    const fresh = await confirm(tools, userId, loaded.attempt.recordId, 1, claimed.token)
    if (!fresh) return ALREADY_SUBMITTED
    const a = fresh.data
    const { hidden } = loaded

    const keyIdx = hidden.facts.flatMap((f, i) => (f.key ? [i] : []))
    const revealed = a.factIdx ?? []
    const found = keyIdx.filter((i) => revealed.includes(i))
    const missed = keyIdx.length - found.length
    const asked = (a.qa ?? []).length
    const result: PartResult = {
      points: scoreClarify(revealed, keyIdx, points(1)),
      maxPoints: points(1),
      submitted: (a.qa ?? []).map((x) => x.q).join('\n'),
      verdict: `${found.length} of ${keyIdx.length} key facts uncovered`,
      hits: found.map((i) => hidden.facts[i].label),
      misses: missed > 0 ? [`${missed} key fact${missed === 1 ? '' : 's'} not uncovered (they're listed on your scorecard when you finish)`] : [],
      feedback:
        asked === 0
          ? 'You skipped clarifying questions. In a real interview, two or three sharp questions before structuring often change the answer.'
          : missed > 0 && asked < MAX_QUESTIONS
            ? `You had ${MAX_QUESTIONS - asked} question${MAX_QUESTIONS - asked === 1 ? '' : 's'} left. Use them: the facts you skip are often the ones the case turns on.`
            : '',
    }
    if (!(await saveResult(tools, fresh, 1, result))) return fail('Could not save')
    return { success: true, data: { result } }
  },

  /**
   * Part 2: submit a framework. The AI judges each hidden checkpoint as hit or
   * missed; code converts that to points (equal weight per checkpoint).
   */
  submitStructure: async ({ userId, params, tools, env }) => {
    const loaded = await loadForPart(tools, userId, params.attemptId, 2)
    if ('error' in loaded) return loaded.error
    const { attempt, summary, hidden } = loaded
    const submitted = text(params.text)
    if (submitted.length < 20) return fail('Write out your framework first (a few lines at least).')

    const claimed = await claim(tools, loaded, 2, 1)
    if ('error' in claimed) return claimed.error
    let judged
    try {
      judged = await judgeAgainstCheckpoints(
        env,
        summary,
        'The candidate was asked to lay out a framework / issue tree for solving this case.',
        hidden.structureCheckpoints,
        submitted,
      )
    } catch (err) {
      await release(tools, userId, attempt.recordId, claimed.token)
      return aiFailure(err, 'submitStructure')
    }
    const fresh = await confirm(tools, userId, attempt.recordId, 2, claimed.token)
    if (!fresh) return ALREADY_SUBMITTED
    const result = judgedResult(2, submitted, hidden.structureCheckpoints, judged)
    if (!(await saveResult(tools, fresh, 2, result))) return fail('Could not save')
    return { success: true, data: { result } }
  },

  /**
   * Part 3 (Analyze): the number is graded exactly, here, by code (20 pts).
   * The one-line "so what" is graded by the judge against the case's
   * interpretation checkpoint (10 pts). One submission.
   * params: { attemptId, answer, soWhat } → { result }
   */
  submitAnalyze: async ({ userId, params, tools, env }) => {
    const loaded = await loadForPart(tools, userId, params.attemptId, 3)
    if ('error' in loaded) return loaded.error
    const { attempt, summary, hidden } = loaded

    const raw = typeof params.answer === 'string' ? params.answer.trim().slice(0, 40) : ''
    const soWhat = text(params.soWhat, 1_000)
    const value = parseAnswer(raw, summary.analyzeUnit)
    if (value === null) return fail('Enter a single number, like 12.5')

    // The "so what" is only worth an AI call if they wrote one.
    const claimed = await claim(tools, loaded, 3, soWhat ? 1 : 0)
    if ('error' in claimed) return claimed.error

    const numberVerdict = judgeNumber(value, hidden.answer.value, hidden.answer.tolerancePct, ANALYZE_NUMBER_POINTS)
    const expected = formatAnswer(hidden.answer.value, summary.analyzeUnit)
    let soWhatHit = false
    let soWhatNote = ''
    if (soWhat) {
      try {
        const judged = await judgeAgainstCheckpoints(
          env,
          summary,
          `The candidate computed: "${summary.analyzeQuestion}" and was asked for a one-sentence interpretation of what the number means for the client. Judge only the interpretation sentence. The correct value is ${expected}.`,
          [hidden.soWhatCheckpoint],
          soWhat,
        )
        soWhatHit = judged.hits[0]
        soWhatNote = judged.feedback
      } catch (err) {
        await release(tools, userId, attempt.recordId, claimed.token)
        return aiFailure(err, 'submitAnalyze')
      }
    }
    const fresh = await confirm(tools, userId, attempt.recordId, 3, claimed.token)
    if (!fresh) return ALREADY_SUBMITTED

    const soWhatMax = points(3) - ANALYZE_NUMBER_POINTS
    const hits: string[] = []
    const misses: string[] = []
    if (numberVerdict.correct) hits.push(`Number: ${expected} (within ${hidden.answer.tolerancePct}%)`)
    else misses.push(`Number: you said ${raw}, the answer is ${expected}${numberVerdict.close ? ' (close, half credit)' : ''}`)
    ;(soWhatHit ? hits : misses).push(`So what: ${hidden.soWhatCheckpoint}`)

    const result: PartResult = {
      points: numberVerdict.points + (soWhatHit ? soWhatMax : 0),
      maxPoints: points(3),
      submitted: soWhat ? `${raw} | ${soWhat}` : raw,
      verdict: numberVerdict.correct
        ? `Correct: ${expected}`
        : numberVerdict.close
          ? `Close: the answer is ${expected}`
          : `Incorrect: the answer is ${expected}`,
      hits,
      misses,
      feedback: [hidden.answer.working, soWhat ? soWhatNote : 'Always say what the number means for the client. That was worth 10 points.']
        .filter(Boolean)
        .join(' '),
    }
    if (!(await saveResult(tools, fresh, 3, result))) return fail('Could not save')
    return { success: true, data: { result } }
  },

  /**
   * Part 4 (Recommend): judged against the case-specific "right call" plus the
   * four standard checkpoints. Completes the attempt: writes the review
   * (model answer, which key facts you found) and refreshes the leaderboard.
   * params: { attemptId, text } → { result, totalScore }
   */
  submitRecommend: async ({ userId, params, tools, env, callerJwt }) => {
    const loaded = await loadForPart(tools, userId, params.attemptId, 4)
    if ('error' in loaded) return loaded.error
    const { attempt, summary, hidden } = loaded
    const submitted = text(params.text)
    if (submitted.length < 40) return fail('Write out your recommendation first: answer, reasons, risks, next steps.')

    const claimed = await claim(tools, loaded, 4, 1)
    if ('error' in claimed) return claimed.error
    const checkpoints = [hidden.recommendationCall, ...RECOMMENDATION_CHECKPOINTS]
    let judged
    try {
      judged = await judgeAgainstCheckpoints(
        env,
        summary,
        'The candidate is giving the final top-down recommendation to the client, after the analysis. A strong answer leads with the call, backs it with case numbers, and covers risks and next steps.',
        checkpoints,
        submitted,
      )
    } catch (err) {
      await release(tools, userId, attempt.recordId, claimed.token)
      return aiFailure(err, 'submitRecommend')
    }
    const fresh = await confirm(tools, userId, attempt.recordId, 4, claimed.token)
    if (!fresh) return ALREADY_SUBMITTED
    const result = judgedResult(4, submitted, checkpoints, judged)
    const results = await saveResult(tools, fresh, 4, result, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      currentPart: PARTS.length + 1,
      review: buildReview(fresh.data, hidden),
    })
    if (!results) return fail('Could not save')
    await refreshLeaderboard(tools, userId, callerJwt)
    return { success: true, data: { result, totalScore: sumScore(results) } }
  },
}
