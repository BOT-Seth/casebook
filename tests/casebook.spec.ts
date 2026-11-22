/**
 * Casebook security and flow specs, with two real signed-in users.
 *
 * These pin down the claims in the README's security model:
 *   - you can read only your own attempts, and can't write them at all
 *   - parts can only be played in order, through server actions
 *   - another user can't read or act on your attempt
 *   - nobody can write the public leaderboard from the browser
 *   - parallel requests can't start extra attempts or submit a part twice
 *
 * None of these call the AI (no Part 2-4 submissions), so the suite costs
 * nothing to run. Needs two usable test accounts (see collab.spec.ts).
 */

import type { Page } from '@playwright/test'
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'

const usable = loadAllTestAccounts().length

/** Runs inside the page, as that page's signed-in user. */
async function asUser<T>(page: Page, fn: string, arg: unknown = null): Promise<T> {
  return page.evaluate(
    async ({ fn, arg }) => {
      const { token } = await (await fetch('/api/auth/token', { method: 'POST' })).json()
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      const action = (name: string, body: unknown) =>
        fetch(`/api/actions/${name}`, { method: 'POST', headers, body: JSON.stringify(body) }).then((r) => r.json())
      const tool = (name: string, input: unknown) =>
        fetch(`/_deepspace/agent/browser/tools/${name}`, { method: 'POST', headers, body: JSON.stringify({ input }) }).then(
          async (r) => ({ status: r.status, body: await r.json().catch(() => null) }),
        )
      return new Function('action', 'tool', 'arg', `return (${fn})(action, tool, arg)`)(action, tool, arg)
    },
    { fn, arg },
  ) as Promise<T>
}

test.describe('public pages', () => {
  test('case list shows the three cases and the coming-soon rows', async ({ page }) => {
    await page.goto('/cases')
    for (const title of ['Harvest Lane Markets', 'VoltPath Fleet Charging', 'Clarion Analytics Acquisition']) {
      await expect(page.getByRole('link', { name: title })).toBeVisible({ timeout: 15_000 })
    }
    await expect(page.getByText('Coming soon').first()).toBeVisible()
  })

  test('leaderboard is readable signed out', async ({ page }) => {
    await page.goto('/leaderboard')
    await expect(page.getByRole('heading', { name: 'Leaderboard' })).toBeVisible({ timeout: 15_000 })
  })

  test('hidden case data is not in the page', async ({ page }) => {
    await page.goto('/cases/harvest-lane')
    await expect(page.getByRole('heading', { name: 'Harvest Lane Markets' })).toBeVisible({ timeout: 15_000 })
    const html = await page.content()
    expect(html).not.toContain('MidStates Logistics')
    expect(html).not.toContain('Exhibit 1: Cost structure')
  })
})

test.describe('two users', () => {
  test.skip(usable < 2, `Needs 2 usable test accounts, found ${usable}.`)

  test('attempts are private, read-only, and played in order', async ({ users }) => {
    const [a, b] = await users(2)
    await Promise.all([a.page.goto('/cases'), b.page.goto('/cases')])
    await expect(a.page.getByTestId('app-navigation')).toBeVisible({ timeout: 15_000 })
    await expect(b.page.getByTestId('app-navigation')).toBeVisible({ timeout: 15_000 })

    // A starts (or resumes) a case through the server action.
    const start = await asUser<{ success: boolean; data: { attemptId: string } }>(
      a.page,
      `(action) => action('startAttempt', { caseId: 'clarion' })`,
    )
    expect(start.success).toBe(true)
    const attemptId = start.data.attemptId

    // A can read it...
    const own = await asUser<{ status: number }>(
      a.page,
      `(action, tool, id) => tool('records_get', { collection: 'attempts', recordId: id })`,
      attemptId,
    )
    expect(own.status).toBe(200)

    // ...but can't write it, even their own: no skipping parts, no setting a score.
    const write = await asUser<{ status: number; body: { error?: string } }>(
      a.page,
      `(action, tool, id) => tool('records_update', { collection: 'attempts', recordId: id, data: { currentPart: 5, totalScore: 100 } })`,
      attemptId,
    )
    expect(write.status).toBe(422)
    expect(write.body.error).toContain('UPDATE DENIED')

    const forge = await asUser<{ status: number; body: { error?: string } }>(
      a.page,
      `(action, tool) => tool('records_create', { collection: 'attempts', data: { userId: 'x', caseId: 'clarion', totalScore: 100 } })`,
    )
    expect(forge.body.error).toContain('CREATE DENIED')

    // Parts are enforced in order by the server.
    const skip = await asUser<{ success: boolean; error: string }>(
      a.page,
      `(action, tool, id) => action('submitAnalyze', { attemptId: id, answer: '48000' })`,
      attemptId,
    )
    expect(skip.success).toBe(false)
    expect(skip.error).toMatch(/You're on Part \d, not Part 3/)

    // B can't see A's attempt in a list, read it directly, or act on it.
    const list = await asUser<{ body: { result: { data: { records: Array<{ recordId: string }> } } } }>(
      b.page,
      `(action, tool) => tool('records_query', { collection: 'attempts' })`,
    )
    expect(list.body.result.data.records.map((r) => r.recordId)).not.toContain(attemptId)

    const peek = await asUser<{ body: { error?: string } }>(
      b.page,
      `(action, tool, id) => tool('records_get', { collection: 'attempts', recordId: id })`,
      attemptId,
    )
    expect(peek.body.error).toContain('READ DENIED')

    const hijack = await asUser<{ success: boolean; error: string }>(
      b.page,
      `(action, tool, id) => action('finishClarify', { attemptId: id })`,
      attemptId,
    )
    expect(hijack).toEqual({ success: false, error: 'Attempt not found' })

    // Nobody writes the leaderboard from the browser.
    const rank = await asUser<{ body: { error?: string } }>(
      b.page,
      `(action, tool) => tool('records_create', { collection: 'leaderboard', data: { userId: 'me', name: 'Me', total: 9999, solved: 3 } })`,
    )
    expect(rank.body.error).toContain('CREATE DENIED')
  })

  test('parallel requests collapse to one attempt and one submission', async ({ users }) => {
    const [a] = await users(1)
    await a.page.goto('/cases')
    await expect(a.page.getByTestId('app-navigation')).toBeVisible({ timeout: 15_000 })

    // A burst of starts lands on one attempt, not five.
    const starts = await asUser<Array<{ success: boolean; data?: { attemptId: string } }>>(
      a.page,
      `(action) => Promise.all([1, 2, 3, 4, 5].map(() => action('startAttempt', { caseId: 'clarion' })))`,
    )
    const ids = new Set(starts.filter((r) => r.success).map((r) => r.data!.attemptId))
    expect(ids.size).toBe(1)
    const [attemptId] = [...ids]

    const read = (id: string) =>
      asUser<{ body: { result: { data: { record: { data: { currentPart: number; pending: unknown; results: object } } } } } }>(
        a.page,
        `(action, tool, id) => tool('records_get', { collection: 'attempts', recordId: id })`,
        id,
      ).then((r) => r.body.result.data.record.data)

    const before = await read(attemptId)
    // Five parallel "finish Part 1" calls (no AI): at most one may score it.
    const burst = await asUser<Array<{ success: boolean }>>(
      a.page,
      `(action, tool, id) => Promise.all([1, 2, 3, 4, 5].map(() => action('finishClarify', { attemptId: id })))`,
      attemptId,
    )
    const wins = burst.filter((r) => r.success).length
    const after = await read(attemptId)
    if (before.currentPart === 1) {
      expect(wins).toBe(1)
      expect(after.currentPart).toBe(2)
    } else {
      // A rerun resumes the attempt from last time, already past Part 1.
      expect(wins).toBe(0)
      expect(after.currentPart).toBe(before.currentPart)
    }
    expect(after.pending ?? null).toBeNull()
    expect(Object.keys(after.results)).toHaveLength(after.currentPart - 1)
  })
})
