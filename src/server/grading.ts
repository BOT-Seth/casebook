/**
 * Deterministic grading: no AI. (Decision #4: math is graded by code.)
 */

/** Pull a number out of what the candidate typed: "18", "$18.0M", "18,000", "233 vans". */
export function parseNumber(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/[$,\s]/g, '')
  const match = s.match(/^(-?\d+(?:\.\d+)?)(k|m|million|vans?)?$/)
  if (!match) return null
  const n = Number(match[1])
  if (!Number.isFinite(n)) return null
  // "48k" means thousands. "m" is ignored: the $M questions already ask in millions.
  return match[2] === 'k' ? n * 1000 : n
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

export function formatAnswer(value: number, unit: string): string {
  const rounded = Math.abs(value) >= 1000 ? Math.round(value).toLocaleString('en-US') : String(Math.round(value * 10) / 10)
  if (unit === '$M') return `$${rounded}M`
  if (unit === '$') return `$${rounded}`
  return `${rounded} ${unit}`
}
