/**
 * Client helpers for attempts. Reads are live subscriptions (useQuery); every
 * write goes through a server action, because members can't write `attempts`.
 */

import { useMemo } from 'react'
import { getAuthToken, useAuth, useQuery } from 'deepspace'
import type { AttemptRow } from '../schemas/attempts-schema'
import { SOLVED_SCORE } from '../cases/catalog'

export type AttemptRecord = {
  recordId: string
  createdAt: string
  updatedAt: string
  data: AttemptRow
}

/**
 * The signed-in user's attempts. Members only receive their own rows (read:
 * 'own'), but the app owner is an admin and receives everyone's, so filter by
 * userId here too.
 */
export function useMyAttempts() {
  const { isSignedIn, userId } = useAuth()
  const { records, status } = useQuery<AttemptRow>('attempts', { orderBy: 'createdAt', orderDir: 'desc' })
  return useMemo(() => {
    const attempts = (isSignedIn ? records.filter((r) => r.data.userId === userId) : []) as AttemptRecord[]
    const byCase = new Map<string, { best: number; attempted: boolean; solved: boolean; inProgress: AttemptRecord | null }>()
    for (const a of attempts) {
      const entry = byCase.get(a.data.caseId) ?? { best: 0, attempted: false, solved: false, inProgress: null }
      if (a.data.status === 'completed') {
        entry.attempted = true
        entry.best = Math.max(entry.best, a.data.totalScore ?? 0)
        entry.solved = entry.best >= SOLVED_SCORE
      } else if (!entry.inProgress) {
        entry.inProgress = a
      }
      byCase.set(a.data.caseId, entry)
    }
    return { attempts, byCase, status }
  }, [records, status, isSignedIn, userId])
}

interface ActionResponse<T> {
  success: boolean
  data?: T
  error?: string
}

/** POST /api/actions/<name> with the caller's JWT. Throws with the server's message. */
export async function callAction<T>(name: string, params: Record<string, unknown>): Promise<T> {
  const token = await getAuthToken()
  if (!token) throw new Error('Sign in first.')
  const res = await fetch(`/api/actions/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  })
  const body = (await res.json().catch(() => null)) as ActionResponse<T> | null
  if (!res.ok || !body?.success) throw new Error(body?.error || `Request failed (${res.status})`)
  return body.data as T
}

export const DIFFICULTY_STYLE: Record<string, string> = {
  Easy: 'bg-success/12 text-success',
  Medium: 'bg-warning/15 text-warning',
  Hard: 'bg-destructive/12 text-destructive',
}
