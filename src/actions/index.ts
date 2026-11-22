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
import { formatAnswer, judgeNumber, parseNumber } from '../server/grading'
import type { AttemptRow, PartResult } from '../schemas/attempts-schema'

type Attempt = { recordId: string; data: AttemptRow }

const MAX_TEXT = 4_000

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

    const row: AttemptRow = {
      userId,
      caseId,
      status: 'in_progress',
      currentPart: 1,
      results: {},
      totalScore: 0,
      exhibit: null,
      facts: [],
      startedAt: new Date().toISOString(),
      completedAt: '',
    }
    const created = await tools.create('attempts', row as unknown as Record<string, unknown>)
    if (!created.success) return fail('Could not start the case')
    return { success: true, data: { attemptId: created.data.recordId, resumed: false } }
  },

  /**
   * Submit Part 1 (Clarify) or Part 2 (Structure).
   * SLICE 1 STUB: records the text and advances without grading. Slice 2
   * replaces this with the AI interviewer (Part 1) and AI judge (Part 2).
   * params: { attemptId, part, text }
   */
  submitPart: async ({ userId, params, tools }) => {
    const attempt = await loadOwnAttempt(tools, userId, params.attemptId)
    if (!attempt) return fail('Attempt not found')
    const a = attempt.data
    const part = Number(params.part)
    if (a.status !== 'in_progress') return fail('This case is already finished')
    if (part !== a.currentPart) return fail(`You're on Part ${a.currentPart}, not Part ${part}`)
    if (part !== 1 && part !== 2) return fail('Use the Part 3 / Part 4 submit for this part')
    const text = typeof params.text === 'string' ? params.text.trim().slice(0, MAX_TEXT) : ''

    const result: PartResult = {
      points: 0,
      maxPoints: points(part),
      submitted: text,
      verdict: 'Not graded yet (AI grading arrives in slice 2)',
      hits: [],
      misses: [],
      feedback: '',
    }
    const results = { ...(a.results ?? {}), [String(part)]: result }
    const updated = await tools.update('attempts', attempt.recordId, {
      results,
      totalScore: sumScore(results),
      ...nextPartPatch(a, part + 1),
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
