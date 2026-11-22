/**
 * Spaced repetition — a small SM-2 variant (the algorithm behind Anki).
 *
 * Pure and dependency-free so the same function runs in three places and can
 * never disagree: the drill page in the browser, the AI coach's `review_case`
 * tool in the Worker, and the unit tests in srs.test.ts.
 *
 *   again → you blanked: relearn tomorrow-ish (10 minutes), ease drops
 *   hard  → recalled with real gaps: interval grows slowly, ease drops a bit
 *   good  → recalled the approach: interval × ease
 *   easy  → instant and complete: interval × ease × 1.3, ease rises
 */

import type { Grade } from '../schemas/cases-schema'

export interface SrsState {
  intervalDays: number
  ease: number
  reps: number
  lapses: number
}

export interface SrsResult extends SrsState {
  dueAt: string
  lastGrade: Grade
}

export const MIN_EASE = 1.3
export const MAX_EASE = 3.0
export const DEFAULT_EASE = 2.5
const DAY_MS = 24 * 60 * 60 * 1000
const RELEARN_MS = 10 * 60 * 1000

const EASE_DELTA: Record<Grade, number> = { again: -0.2, hard: -0.15, good: 0, easy: 0.15 }

function clampEase(ease: number): number {
  return Math.min(MAX_EASE, Math.max(MIN_EASE, Math.round(ease * 100) / 100))
}

/** Read whatever is stored on a case row into a valid state (new cases have none). */
export function normalizeState(raw: Partial<Record<keyof SrsState, unknown>>): SrsState {
  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback
  return {
    intervalDays: num(raw.intervalDays, 0),
    ease: clampEase(num(raw.ease, DEFAULT_EASE) || DEFAULT_EASE),
    reps: Math.floor(num(raw.reps, 0)),
    lapses: Math.floor(num(raw.lapses, 0)),
  }
}

export function schedule(state: SrsState, grade: Grade, now: Date = new Date()): SrsResult {
  const ease = clampEase(state.ease + EASE_DELTA[grade])

  if (grade === 'again') {
    return {
      intervalDays: 0,
      ease,
      reps: 0,
      lapses: state.lapses + 1,
      dueAt: new Date(now.getTime() + RELEARN_MS).toISOString(),
      lastGrade: grade,
    }
  }

  let interval: number
  if (state.reps === 0) {
    interval = grade === 'hard' ? 1 : grade === 'good' ? 1 : 4
  } else if (state.reps === 1) {
    interval = grade === 'hard' ? 2 : grade === 'good' ? 3 : 6
  } else {
    const base = Math.max(1, state.intervalDays)
    const factor = grade === 'hard' ? 1.2 : grade === 'good' ? ease : ease * 1.3
    interval = base * factor
  }
  // Whole days, always moving forward, capped at a year.
  const intervalDays = Math.min(365, Math.max(1, Math.round(interval)))

  return {
    intervalDays,
    ease,
    reps: state.reps + 1,
    lapses: state.lapses,
    dueAt: new Date(now.getTime() + intervalDays * DAY_MS).toISOString(),
    lastGrade: grade,
  }
}

/** A case with no `dueAt` has never been drilled, so it is due now. */
export function isDue(dueAt: string | undefined | null, now: Date = new Date()): boolean {
  if (!dueAt) return true
  const t = Date.parse(dueAt)
  return Number.isNaN(t) || t <= now.getTime()
}

/** "in 3 days", "in 10 min", "now" — for schedule previews on the grade buttons. */
export function describeInterval(result: Pick<SrsResult, 'dueAt'>, now: Date = new Date()): string {
  const ms = Date.parse(result.dueAt) - now.getTime()
  if (ms <= 0) return 'now'
  if (ms < 60 * 60 * 1000) return `${Math.max(1, Math.round(ms / 60000))} min`
  const days = Math.round(ms / DAY_MS)
  if (days < 1) return `${Math.round(ms / 3600000)} h`
  if (days < 30) return `${days} d`
  if (days < 365) return `${Math.round(days / 30)} mo`
  return `${Math.round(days / 365)} y`
}
