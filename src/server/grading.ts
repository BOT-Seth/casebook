/**
 * Deterministic grading: no AI. (Decision #4: math is graded by code.)
 */

const SCALE: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, mm: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9 }

/**
 * Pull a number out of what the candidate typed, in the question's unit.
 *   unit '$M':  "18", "$18M", "18 million", "$18,000,000", "0.018b"  → 18
 *   unit '$':   "48000", "$48,000", "48k", "$0.048M"                 → 48000
 *   unit other: "233", "233 vans"                                    → 233
 * A bare number on a $M question is read as millions when it's small
 * ("18") and as dollars when it's clearly a full figure ("18000000").
 */
export function parseAnswer(input: string, unit: string): number | null {
  const s = input.trim().toLowerCase().replace(/[$,\s]/g, '')
  const match = s.match(/^(-?\d+(?:\.\d+)?)(k|thousand|mm|m|million|bn|b|billion|vans?)?$/)
  if (!match) return null
  const n = Number(match[1])
  if (!Number.isFinite(n)) return null
  const suffix = match[2] && SCALE[match[2]] ? SCALE[match[2]] : null
  if (unit === '$M') {
    if (suffix !== null) return (n * suffix) / 1e6
    return Math.abs(n) >= 100_000 ? n / 1e6 : n
  }
  return suffix !== null ? n * suffix : n
}

export interface NumberVerdict {
  points: number
  correct: boolean
  close: boolean
  offByPct: number | null
}

/**
 * Within tolerance: full points. Within 10%: half points (usually a rounding
 * or one-step slip). Otherwise: zero. One submission per attempt, like a real
 * interview, not LeetCode's unlimited retries.
 */
export function judgeNumber(
  submitted: number | null,
  expected: number,
  tolerancePct: number,
  maxPoints: number,
): NumberVerdict {
  if (submitted === null) return { points: 0, correct: false, close: false, offByPct: null }
  const offByPct = (Math.abs(submitted - expected) / Math.abs(expected)) * 100
  if (offByPct <= tolerancePct) return { points: maxPoints, correct: true, close: false, offByPct }
  if (offByPct <= 10) return { points: Math.round(maxPoints / 2), correct: false, close: true, offByPct }
  return { points: 0, correct: false, close: false, offByPct }
}

/** Part 1: share of the case's key facts your questions uncovered. */
export function scoreClarify(revealed: number[], keyFactIdx: number[], maxPoints: number): number {
  if (keyFactIdx.length === 0) return 0
  const found = keyFactIdx.filter((i) => revealed.includes(i)).length
  return Math.round((maxPoints * found) / keyFactIdx.length)
}

/** Checkpoint-graded parts: equal weight per checkpoint. */
export function scoreCheckpoints(hits: boolean[], maxPoints: number): number {
  if (hits.length === 0) return 0
  return Math.round((maxPoints * hits.filter(Boolean).length) / hits.length)
}

export function formatAnswer(value: number, unit: string): string {
  const rounded = Math.abs(value) >= 1000 ? Math.round(value).toLocaleString('en-US') : String(Math.round(value * 10) / 10)
  if (unit === '$M') return `$${rounded}M`
  if (unit === '$') return `$${rounded}`
  return `${rounded} ${unit}`
}
