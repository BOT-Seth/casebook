/**
 * `attempts`: one row per time a user plays a case (LeetCode's "submission").
 *
 * Security model (decision #5 in DECISIONS.md):
 *   - A member can READ only their own attempts (ownerField: userId).
 *   - Nobody can create or update an attempt from the browser. Only the
 *     server actions in src/actions/ write here, after checking the rules
 *     (parts in order, one submission per part, exhibit only from Part 3).
 * So a user can't skip ahead, unlock the exhibit early, or set their own
 * score by writing to their own record.
 */

import type { CollectionSchema } from 'deepspace/schema'

export type AttemptStatus = 'in_progress' | 'completed'

export interface PartResult {
  points: number
  maxPoints: number
  /** What the candidate submitted for this part. */
  submitted: string
  /** Short verdict line, e.g. "Correct: $18.0M" or "3 of 4 checkpoints". */
  verdict: string
  /** Checkpoints hit and missed (AI-graded parts), or the worked answer. */
  hits: string[]
  misses: string[]
  feedback: string
}

export interface ExhibitData {
  title: string
  columns: string[]
  rows: string[][]
  boldRow?: number
  note?: string
}

/** Written by the server only when the attempt completes: the "editorial". */
export interface AttemptReview {
  keyInsight: string
  modelRecommendation: string
  working: string
  keyFacts: Array<{ label: string; found: boolean }>
}

export interface AttemptRow {
  userId: string
  caseId: string
  status: AttemptStatus
  /** 1-4 while in progress; 5 once the case is complete. */
  currentPart: number
  /** Keyed by part number as a string: { "1": {...}, "3": {...} }. */
  results: Record<string, PartResult>
  totalScore: number
  /** Copied in by the server only when Part 3 opens. */
  exhibit: ExhibitData | null
  /** Labels of facts the interviewer has revealed so far (Part 1), for the board. */
  facts: string[]
  /** Indexes into the hidden fact list that have been revealed (for scoring). */
  factIdx: number[]
  /** Part 1 conversation with the AI interviewer. */
  qa: Array<{ q: string; a: string }>
  /** Null until the case is complete; then the model answer and missed facts. */
  review: AttemptReview | null
  /**
   * Set while the server is grading a part (see claimPart in src/actions):
   * a second submission for the same attempt is refused until it clears.
   */
  pending: { part: number; token: string; at: string } | null
  /** AI calls made for this attempt, failed ones included. Capped. */
  aiCalls: number
  startedAt: string
  completedAt: string
}

export const attemptsSchema: CollectionSchema = {
  name: 'attempts',
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'caseId', storage: 'text', interpretation: 'plain', required: true },
    {
      name: 'status',
      storage: 'text',
      interpretation: { kind: 'select', options: ['in_progress', 'completed'] },
      default: 'in_progress',
    },
    { name: 'currentPart', storage: 'number', interpretation: 'plain', default: 1 },
    { name: 'results', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'totalScore', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'exhibit', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'facts', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'factIdx', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'qa', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'review', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'pending', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'aiCalls', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'startedAt', storage: 'text', interpretation: { kind: 'datetime' } },
    { name: 'completedAt', storage: 'text', interpretation: { kind: 'datetime' } },
  ],
  ownerField: 'userId',
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: 'own', create: false, update: false, delete: false },
    admin: { read: true, create: false, update: false, delete: true },
  },
}
