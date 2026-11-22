import { describe, expect, it } from 'vitest'
import { describeInterval, isDue, normalizeState, schedule, MIN_EASE } from './srs'

const now = new Date('2026-11-22T12:00:00.000Z')
const fresh = normalizeState({})

describe('schedule', () => {
  it('starts new cards on short intervals', () => {
    expect(schedule(fresh, 'good', now).intervalDays).toBe(1)
    expect(schedule(fresh, 'easy', now).intervalDays).toBe(4)
  })

  it('grows the interval by ease once a card is established', () => {
    const r = schedule({ intervalDays: 10, ease: 2.5, reps: 3, lapses: 0 }, 'good', now)
    expect(r.intervalDays).toBe(25)
    expect(r.reps).toBe(4)
    expect(r.dueAt).toBe('2026-12-17T12:00:00.000Z')
  })

  it('treats "again" as a lapse: resets reps, short relearn, lowers ease', () => {
    const r = schedule({ intervalDays: 30, ease: 2.5, reps: 5, lapses: 1 }, 'again', now)
    expect(r.reps).toBe(0)
    expect(r.lapses).toBe(2)
    expect(r.intervalDays).toBe(0)
    expect(r.ease).toBe(2.3)
    expect(Date.parse(r.dueAt) - now.getTime()).toBe(10 * 60 * 1000)
  })

  it('never lets ease fall below the floor', () => {
    let s = { intervalDays: 5, ease: MIN_EASE, reps: 4, lapses: 0 }
    for (let i = 0; i < 5; i++) s = schedule(s, 'hard', now)
    expect(s.ease).toBe(MIN_EASE)
  })

  it('caps intervals at a year', () => {
    expect(schedule({ intervalDays: 300, ease: 3, reps: 9, lapses: 0 }, 'easy', now).intervalDays).toBe(365)
  })
})

describe('normalizeState', () => {
  it('repairs missing or garbage values', () => {
    expect(normalizeState({ ease: 'x', reps: -2, intervalDays: NaN })).toEqual({
      intervalDays: 0,
      ease: 2.5,
      reps: 0,
      lapses: 0,
    })
  })
})

describe('isDue / describeInterval', () => {
  it('treats never-drilled cases as due', () => {
    expect(isDue('', now)).toBe(true)
    expect(isDue('2026-11-23T00:00:00.000Z', now)).toBe(false)
    expect(isDue('2026-11-21T00:00:00.000Z', now)).toBe(true)
  })

  it('formats previews', () => {
    expect(describeInterval(schedule(fresh, 'again', now), now)).toBe('10 min')
    expect(describeInterval(schedule(fresh, 'easy', now), now)).toBe('4 d')
  })
})
