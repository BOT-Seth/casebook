/**
 * Casebook-specific assistant tools, layered on top of the SDK's record tools.
 *
 * Both run through the same `executor` as the built-in tools — i.e. as the
 * signed-in user, with the RecordRoom enforcing RBAC — so the assistant can
 * never touch a case its user couldn't. The website chat dock and a local
 * agent (`npx deepspace agent invoke casebook review_case …`) get the same tools.
 *
 * Why custom tools instead of letting the model call records.update itself:
 * the next review date must come from the SRS algorithm, not from a model
 * guessing at "intervalDays". `review_case` makes that a server-side fact.
 */

import { tool, type ToolSet } from 'ai'
import { z } from 'zod/v4'
import { GRADES, type AttemptRow, type CaseRow } from '../schemas/cases-schema'
import { isDue, normalizeState, schedule } from '../lib/srs'

type ToolExecutor = (toolName: string, params: Record<string, unknown>) => Promise<unknown>

interface Envelope<T> {
  recordId: string
  createdBy: string
  data: T
}

/** The executor returns the RecordRoom's `{ success, data | error }` result. */
function unwrap<T>(result: unknown, what: string): T {
  const r = result as { success?: boolean; data?: unknown; error?: string } | null
  if (!r || r.success === false) throw new Error(`${what} failed: ${r?.error ?? 'unknown error'}`)
  return r.data as T
}

export function buildCasebookTools(executor: ToolExecutor, userId: string): ToolSet {
  return {
    cases_due: tool({
      description:
        "List the user's own cases that are due for review now (oldest due first). Returns title, pattern, difficulty and prompt only — the saved approach is withheld so you can quiz without spoiling it; fetch it with records_get when grading.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(20).optional().describe('Max cases to return (default 5)'),
      }),
      execute: async ({ limit }) => {
        const data = unwrap<{ records: Envelope<CaseRow>[] }>(
          await executor('records.query', {
            collection: 'cases',
            where: { createdBy: userId },
            limit: 500,
          }),
          'Listing cases',
        )
        const now = new Date()
        const due = data.records
          .filter((r) => isDue(r.data.dueAt, now))
          .sort((a, b) => (a.data.dueAt || '').localeCompare(b.data.dueAt || ''))
        return {
          dueCount: due.length,
          totalCases: data.records.length,
          cases: due.slice(0, limit ?? 5).map((r) => ({
            recordId: r.recordId,
            title: r.data.title,
            pattern: r.data.pattern,
            difficulty: r.data.difficulty,
            prompt: r.data.prompt,
            lastGrade: r.data.lastGrade || null,
          })),
        }
      },
    }),

    review_case: tool({
      description:
        "Record a completed review of one of the user's cases. Computes the next due date with the app's spaced-repetition algorithm, updates the case, and appends to the review log. Only call after the user has answered and agreed to the grade.",
      inputSchema: z.object({
        caseId: z.string().describe('recordId of the case'),
        grade: z.enum(GRADES).describe('again | hard | good | easy'),
        recall: z.string().max(8000).optional().describe("The user's answer, verbatim or summarized"),
        feedback: z.string().max(2000).optional().describe('Your coaching notes for the log'),
      }),
      execute: async ({ caseId, grade, recall, feedback }) => {
        const { record } = unwrap<{ record: Envelope<CaseRow> }>(
          await executor('records.get', { collection: 'cases', recordId: caseId }),
          'Loading the case',
        )
        if (record.createdBy !== userId) {
          return { error: 'That case is in the Library, not your casebook. Save a copy first.' }
        }
        const next = schedule(normalizeState(record.data), grade)
        unwrap(
          await executor('records.update', { collection: 'cases', recordId: caseId, data: next }),
          'Updating the schedule',
        )
        const attempt: AttemptRow = {
          caseId,
          caseTitle: record.data.title,
          grade,
          recall: recall ?? '',
          coachGrade: grade,
          covered: [],
          missed: [],
          feedback: feedback ?? '',
          intervalDays: next.intervalDays,
        }
        unwrap(await executor('records.create', { collection: 'attempts', data: attempt }), 'Logging the review')
        return { ok: true, title: record.data.title, grade, nextDueAt: next.dueAt, intervalDays: next.intervalDays }
      },
    }),
  }
}
