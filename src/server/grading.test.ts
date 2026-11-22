import { describe, expect, it } from 'vitest'
import { formatAnswer, judgeNumber, parseNumber } from './grading'
import { evaluate } from '../lib/calc'
import { CASES } from '../cases/catalog'
import { HIDDEN_CASES } from './cases'

describe('parseNumber', () => {
  it('reads the formats people type', () => {
    expect(parseNumber('18')).toBe(18)
    expect(parseNumber('$18.0M')).toBe(18)
    expect(parseNumber('48,000')).toBe(48000)
    expect(parseNumber('$48k')).toBe(48000)
    expect(parseNumber('233 vans')).toBe(233)
    expect(parseNumber('about 18')).toBeNull()
    expect(parseNumber('')).toBeNull()
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
