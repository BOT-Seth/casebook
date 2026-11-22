/**
 * Server actions: POST /api/actions/<name>, caller's JWT verified first.
 *
 * These are the ONLY code paths that write `attempts` (members have no write
 * permission on that collection). Action tools run with RBAC off, so every
 * action loads the attempt and checks `userId === caller` itself; that check
 * is the authorization.
 */

import type { ActionHandler, ActionResult, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { getCase, PARTS } from '../cases/catalog'
import { getHiddenCase } from '../server/cases'
import { formatAnswer, judgeNumber, parseNumber, scoreCheckpoints, scoreClarify } from '../server/grading'
import { AiError, askInterviewer, judgeAgainstCheckpoints } from '../server/ai'
import type { AttemptRow, PartResult } from '../schemas/attempts-schema'

type Attempt = { recordId: string; data: AttemptRow }

const MAX_TEXT = 4_000
const MAX_QUESTION = 500
/** Part 1 allows this many questions to the AI interviewer. */
const MAX_QUESTIONS = 3
/** New attempts a user may start per day (UTC). Bounds AI spend on owner credits. */
const DAILY_ATTEMPT_LIMIT = 8

function aiFailure(err: unknown, where: string): ActionResult<never> {
  console.error(`[${where}] ${err instanceof Error ? err.message : String(err)}`)
  return fail(err instanceof AiError ? err.message : 'The AI interviewer is unavailable right now. Try again in a moment.')
}

function fail(error: string): ActionResult<never> {
  return { success: false, error }
}

async function loadOwnAttempt(tools: ActionTools, userId: string, attemptId: unknown): Promise<Attempt | null> {
  if (typeof attemptId !== 'string' || !attemptId) return null
  const got = await tools.get('attempts', attemptId)
  if (!got.success) return null
  const { record } = got.data as unknown as { record: Attempt }
  return record.data.userId === userId ? record : null
}

function points(part: number) {
  return PARTS[part - 1].points
}

function sumScore(results: Record<string, PartResult>): number {
  return Object.values(results).reduce((s, r) => s + r.points, 0)
}

/** Moving into Part 3 is the one moment the exhibit is copied onto the attempt. */
function nextPartPatch(attempt: AttemptRow, nextPart: number): Partial<AttemptRow> {
  const patch: Partial<AttemptRow> = { currentPart: nextPart }
  if (nextPart === 3 && !attempt.exhibit) {
    patch.exhibit = getHiddenCase(attempt.caseId)?.exhibit ?? null
  }
  if (nextPart > PARTS.length) {
    patch.status = 'completed'
    patch.completedAt = new Date().toISOString()
  }
  return patch
}

export const actions: Record<string, ActionHandler<Env>> = {
  /**
   * Start a case, or resume the caller's unfinished attempt at it.
   * params: { caseId } → { attemptId, resumed }
   */
  startAttempt: async ({ userId, params, tools }) => {
    const caseId = typeof params.caseId === 'string' ? params.caseId : ''
    if (!getCase(caseId) || !getHiddenCase(caseId)) return fail('Unknown case')

    const existing = await tools.query('attempts', {
      where: { userId, caseId, status: 'in_progress' },
      limit: 1,
    })
    if (existing.success && existing.data.records.length > 0) {
      return { success: true, data: { attemptId: existing.data.records[0].recordId, resumed: true } }
    }

    // Daily cap: each attempt makes at most 4 AI calls, so capping attempts caps owner spend.
    const today = new Date().toISOString().slice(0, 10)
    const mine = await tools.query('attempts', { where: { userId }, limit: 200 })
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
      startedAt: new Date().toISOString(),
      completedAt: '',
    }
    const created = await tools.create('attempts', row as unknown as Record<string, unknown>)
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
    const attempt = await loadOwnAttempt(tools, userId, params.attemptId)
    if (!attempt) return fail('Attempt not found')
    const a = attempt.data
    if (a.status !== 'in_progress' || a.currentPart !== 1) return fail('Clarifying questions are only for Part 1')
    const qa = a.qa ?? []
    if (qa.length >= MAX_QUESTIONS) return fail(`You've used all ${MAX_QUESTIONS} questions. Move on to Structure.`)
    const question = typeof params.question === 'string' ? params.question.trim() : ''
    if (!question) return fail('Type a question first.')
    if (question.length > MAX_QUESTION) return fail(`Keep questions under ${MAX_QUESTION} characters.`)

    const summary = getCase(a.caseId)
    const hidden = getHiddenCase(a.caseId)
    if (!summary || !hidden) return fail('Unknown case')

    let reply
    try {
      reply = await askInterviewer(env, summary, hidden, qa, question)
    } catch (err) {
      return aiFailure(err, 'askQuestion') // a failed call doesn't use up the question
    }

    const factIdx = [...new Set([...(a.factIdx ?? []), ...reply.revealedFacts])].sort((x, y) => x - y)
    const updated = await tools.update('attempts', attempt.recordId, {
      qa: [...qa, { q: question, a: reply.answer }],
      factIdx,
      facts: factIdx.map((i) => hidden.facts[i].label),
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
    const attempt = await loadOwnAttempt(tools, userId, params.attemptId)
    if (!attempt) return fail('Attempt not found')
    const a = attempt.data
    if (a.status !== 'in_progress' || a.currentPart !== 1) return fail(`You're on Part ${a.currentPart}, not Part 1`)
    const hidden = getHiddenCase(a.caseId)
    if (!hidden) return fail('Unknown case')

    const keyIdx = hidden.facts.flatMap((f, i) => (f.key ? [i] : []))
    const revealed = a.factIdx ?? []
    const found = keyIdx.filter((i) => revealed.includes(i))
    const missed = keyIdx.length - found.length
    const result: PartResult = {
      points: scoreClarify(revealed, keyIdx, points(1)),
      maxPoints: points(1),
      submitted: (a.qa ?? []).map((x) => x.q).join('\n'),
      verdict: `${found.length} of ${keyIdx.length} key facts uncovered`,
      hits: found.map((i) => hidden.facts[i].label),
      misses: missed > 0 ? [`${missed} key fact${missed === 1 ? '' : 's'} not uncovered (shown when the case is over)`] : [],
      feedback:
        (a.qa ?? []).length === 0
          ? 'You skipped clarifying questions. In a real interview, two or three sharp questions before structuring often change the answer.'
          : '',
    }
    const results = { ...(a.results ?? {}), '1': result }
    const updated = await tools.update('attempts', attempt.recordId, {
      results,
      totalScore: sumScore(results),
      ...nextPartPatch(a, 2),
    } as Record<string, unknown>)
    if (!updated.success) return fail('Could not save')
    return { success: true, data: { result } }
  },

  /**
   * Part 2: submit a framework. The AI judges each hidden checkpoint as hit or
   * missed; code converts that to points (equal weight per checkpoint).
   * params: { attemptId, text } → { result }
   */
  submitStructure: async ({ userId, params, tools, env }) => {
    const attempt = await loadOwnAttempt(tools, userId, params.attemptId)
    if (!attempt) return fail('Attempt not found')
    const a = attempt.data
    if (a.status !== 'in_progress' || a.currentPart !== 2) return fail(`You're on Part ${a.currentPart}, not Part 2`)
    const text = typeof params.text === 'string' ? params.text.trim().slice(0, MAX_TEXT) : ''
    if (text.length < 20) return fail('Write out your framework first (a few lines at least).')

    const summary = getCase(a.caseId)
    const hidden = getHiddenCase(a.caseId)
    if (!summary || !hidden) return fail('Unknown case')

    let judged
    try {
      judged = await judgeAgainstCheckpoints(
        env,
        summary,
        'The candidate was asked to lay out a framework / issue tree for solving this case.',
        hidden.structureCheckpoints,
        text,
      )
    } catch (err) {
      return aiFailure(err, 'submitStructure')
    }

    const cps = hidden.structureCheckpoints
    const hitCount = judged.hits.filter(Boolean).length
    const result: PartResult = {
      points: scoreCheckpoints(judged.hits, points(2)),
      maxPoints: points(2),
      submitted: text,
      verdict: `${hitCount} of ${cps.length} checkpoints`,
      hits: cps.filter((_, i) => judged.hits[i]),
      misses: cps.filter((_, i) => !judged.hits[i]),
      feedback: judged.feedback,
    }
    const results = { ...(a.results ?? {}), '2': result }
    const updated = await tools.update('attempts', attempt.recordId, {
      results,
      totalScore: sumScore(results),
      ...nextPartPatch(a, 3),
    } as Record<string, unknown>)
    if (!updated.success) return fail('Could not save')
    return { success: true, data: { result } }
  },

  /**
   * Submit Part 3 (Analyze): the number is graded exactly, here, by code.
   * params: { attemptId, answer, soWhat } → { result }
   */
  submitAnalyze: async ({ userId, params, tools }) => {
    const attempt = await loadOwnAttempt(tools, userId, params.attemptId)
    if (!attempt) return fail('Attempt not found')
    const a = attempt.data
    if (a.status !== 'in_progress') return fail('This case is already finished')
    if (a.currentPart !== 3) return fail(`You're on Part ${a.currentPart}, not Part 3`)

    const summary = getCase(a.caseId)
    const hidden = getHiddenCase(a.caseId)
    if (!summary || !hidden) return fail('Unknown case')

    const raw = typeof params.answer === 'string' ? params.answer : String(params.answer ?? '')
    const soWhat = typeof params.soWhat === 'string' ? params.soWhat.trim().slice(0, MAX_TEXT) : ''
    const value = parseNumber(raw)
    if (value === null) return fail('Enter a single number, like 12.5')

    // 20 of Part 3's 30 points are the number; the other 10 are the "so what",
    // graded by AI in slice 3.
    const verdict = judgeNumber(value, hidden.answer.value, hidden.answer.tolerancePct, 20)
    const expected = formatAnswer(hidden.answer.value, summary.analyzeUnit)
    const result: PartResult = {
      points: verdict.points,
      maxPoints: points(3),
      submitted: `${raw.trim()}${soWhat ? ` | ${soWhat}` : ''}`,
      verdict: verdict.correct
        ? `Correct: ${expected}`
        : verdict.close
          ? `Close: the answer is ${expected} (half credit)`
          : `Incorrect: the answer is ${expected}`,
      hits: verdict.correct ? ['Number within 2%'] : [],
      misses: verdict.correct ? [] : [hidden.answer.working],
      feedback: verdict.correct ? hidden.answer.working : '',
    }
    const results = { ...(a.results ?? {}), '3': result }
    const updated = await tools.update('attempts', attempt.recordId, {
      results,
      totalScore: sumScore(results),
      ...nextPartPatch(a, 4),
    } as Record<string, unknown>)
    if (!updated.success) return fail('Could not save')
    return { success: true, data: { result } }
  },
}
