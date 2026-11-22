/**
 * Client helpers for attempts. Reads are live subscriptions (useQuery); every
 * write goes through a server action, because members can't write `attempts`.
 */

import { useMemo } from 'react'
import { getAuthToken, useAuth, useQuery } from 'deepspace'
import type { AttemptRow } from '../schemas/attempts-schema'

export type AttemptRecord = {
  recordId: string
  createdAt: string
  updatedAt: string
  data: AttemptRow
}

/** The signed-in user's attempts. The room only sends their own rows (read: 'own'). */
export function useMyAttempts() {
  const { isSignedIn } = useAuth()
  const { records, status } = useQuery<AttemptRow>('attempts', { orderBy: 'createdAt', orderDir: 'desc' })
  return useMemo(() => {
    const attempts = (isSignedIn ? records : []) as AttemptRecord[]
    const byCase = new Map<string, { best: number; solved: boolean; inProgress: AttemptRecord | null }>()
    for (const a of attempts) {
      const entry = byCase.get(a.data.caseId) ?? { best: 0, solved: false, inProgress: null }
      if (a.data.status === 'completed') {
        entry.solved = true
        entry.best = Math.max(entry.best, a.data.totalScore ?? 0)
      } else if (!entry.inProgress) {
        entry.inProgress = a
      }
      byCase.set(a.data.caseId, entry)
    }
    return { attempts, byCase, status }
  }, [records, status, isSignedIn])
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
