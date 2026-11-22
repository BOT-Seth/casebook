import { describe, expect, it } from 'vitest'
import { formatAnswer, judgeNumber, parseAnswer } from './grading'
import { evaluate } from '../lib/calc'
import { CASES } from '../cases/catalog'
import { HIDDEN_CASES } from './cases'

describe('parseAnswer', () => {
  it('reads $M answers in any form', () => {
    for (const x of ['18', '$18M', '18m', '18 million', '$18,000,000', '18000000', '0.018b', '$18.0M']) {
      expect(parseAnswer(x, '$M'), x).toBe(18)
    }
  })
  it('reads $ answers in any form', () => {
    for (const x of ['48000', '$48,000', '48k', '$0.048M', '48 thousand']) expect(parseAnswer(x, '$'), x).toBeCloseTo(48000)
  })
  it('reads counts', () => {
    expect(parseAnswer('233 vans', 'vans')).toBe(233)
    expect(parseAnswer('233.3', 'vans')).toBe(233.3)
  })
  it('rejects prose', () => {
    expect(parseAnswer('about 18', '$M')).toBeNull()
    expect(parseAnswer('', '$')).toBeNull()
  })
})

describe('judgeNumber', () => {
  it('gives full points within tolerance, half within 10%, else zero', () => {
    expect(judgeNumber(18, 18, 2, 20).points).toBe(20)
    expect(judgeNumber(233, 233.33, 2, 20).correct).toBe(true)
    expect(judgeNumber(19, 18, 2, 20)).toMatchObject({ points: 10, close: true })
    expect(judgeNumber(9.6, 18, 2, 20).points).toBe(0)
    expect(judgeNumber(null, 18, 2, 20).points).toBe(0)
  })
})

describe('formatAnswer', () => {
  it('formats by unit', () => {
    expect(formatAnswer(18, '$M')).toBe('$18M')
    expect(formatAnswer(233.33, 'vans')).toBe('233.3 vans')
    expect(formatAnswer(48000, '$')).toBe('$48,000')
  })
})

describe('calculator', () => {
  it('does case math safely', () => {
    expect(evaluate('(0.7% + 0.8%) * 1.2b')).toBeCloseTo(18e6)
    expect(evaluate('420k / 0.20 / (30*300)')).toBeCloseTo(233.33, 1)
    expect(evaluate('12,000 x 0.8 / 0.2')).toBe(48000)
    expect(() => evaluate('alert(1)')).toThrow()
  })
})

describe('case data', () => {
  it('every public case has hidden data, and the answers match their worked math', () => {
    for (const c of CASES) expect(HIDDEN_CASES[c.id], c.id).toBeDefined()
    expect(evaluate('(0.7% + 0.8%) * 1.2b') / 1e6).toBeCloseTo(HIDDEN_CASES['harvest-lane'].answer.value)
    expect(evaluate('(180k + 2.4m/10) / (0.32 - 0.12) / (30*300)')).toBeCloseTo(HIDDEN_CASES.voltpath.answer.value, 1)
    expect(evaluate('12000 * 0.8 / 0.2')).toBe(HIDDEN_CASES.clarion.answer.value)
  })
})

describe('part scoring', () => {
  it('scores Part 1 by key facts uncovered', async () => {
    const { scoreClarify } = await import('./grading')
    expect(scoreClarify([0, 2, 3], [0, 2, 3], 10)).toBe(10)
    expect(scoreClarify([1, 2], [0, 2, 3], 10)).toBe(3)
    expect(scoreClarify([], [0, 2, 3], 10)).toBe(0)
  })
  it('scores checkpoint parts with equal weight', async () => {
    const { scoreCheckpoints } = await import('./grading')
    expect(scoreCheckpoints([true, true, true, false], 30)).toBe(23)
    expect(scoreCheckpoints([true, true, true, true], 30)).toBe(30)
  })
  it('every case has 3 key facts', () => {
    for (const [id, c] of Object.entries(HIDDEN_CASES)) expect(c.facts.filter((f) => f.key).length, id).toBe(3)
  })
})

describe('leaderboard names', () => {
  it('shows first name and last initial only', async () => {
    const { publicName } = await import('../actions/index')
    expect(publicName('Mohammed Altaie')).toBe('Mohammed A.')
    expect(publicName('Cher')).toBe('Cher')
    expect(publicName('  ')).toBe('Anonymous')
    expect(publicName(undefined)).toBe('Anonymous')
  })
})

describe('leaderboard uses the first completed attempt per case', () => {
  it('ignores later, higher retries and unfinished attempts', async () => {
    const { firstAttemptScores } = await import('../actions/index')
    const scores = firstAttemptScores([
      { caseId: 'harvest-lane', status: 'completed', completedAt: '2026-11-20T10:00:00Z', totalScore: 55 },
      { caseId: 'harvest-lane', status: 'completed', completedAt: '2026-11-21T10:00:00Z', totalScore: 100 },
      { caseId: 'voltpath', status: 'in_progress', completedAt: '', totalScore: 40 },
      { caseId: 'voltpath', status: 'completed', completedAt: '2026-11-21T09:00:00Z', totalScore: 70 },
      { caseId: 'not-a-case', status: 'completed', completedAt: '2026-11-19T10:00:00Z', totalScore: 100 },
    ])
    expect(scores).toEqual({ 'harvest-lane': 55, voltpath: 70 })
  })
})
