/**
 * Client-side helpers shared by the Casebook pages.
 */

import { useMemo } from 'react'
import { getAuthToken, useAuth, useQuery } from 'deepspace'
import type { CaseRow } from '../schemas/cases-schema'
import { isDue } from './srs'

export type CaseRecord = {
  recordId: string
  createdBy: string
  createdAt: string
  updatedAt: string
  data: CaseRow
}

/**
 * Every case the room lets this user read is their own plus every public one
 * (RBAC `read: 'published'`). Split them here; one subscription serves both.
 */
export function useCases() {
  const { userId } = useAuth()
  const { records, status, error } = useQuery<CaseRow>('cases', {
    orderBy: 'updatedAt',
    orderDir: 'desc',
  })
  return useMemo(() => {
    const all = records as CaseRecord[]
    const mine = userId ? all.filter((r) => r.createdBy === userId) : []
    const now = new Date()
    const due = mine
      .filter((r) => isDue(r.data.dueAt, now))
      .sort((a, b) => (a.data.dueAt || '').localeCompare(b.data.dueAt || ''))
    return { all, mine, due, status, error, userId }
  }, [records, status, error, userId])
}

/** Fields that describe the problem; everything else on a case is schedule state. */
export function contentOf(c: Partial<CaseRow>) {
  return {
    title: c.title ?? 'Untitled case',
    pattern: c.pattern ?? '',
    difficulty: c.difficulty ?? 'medium',
    prompt: c.prompt ?? '',
    approach: c.approach ?? '',
    complexity: c.complexity ?? '',
    pitfalls: c.pitfalls ?? '',
    code: c.code ?? '',
  } satisfies Partial<CaseRow>
}

/** A brand-new case row: private, never drilled, due immediately. */
export function newCaseRow(content: Partial<CaseRow>, forkedFrom = ''): CaseRow {
  return {
    ...contentOf(content),
    visibility: 'private',
    forkedFrom,
    dueAt: '',
    intervalDays: 0,
    ease: 2.5,
    reps: 0,
    lapses: 0,
    lastGrade: '',
  }
}

export interface ActionResponse<T> {
  success: boolean
  data?: T
  error?: string
}

/** POST /api/actions/<name> with the caller's JWT (see src/actions/index.ts). */
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
  easy: 'text-success',
  medium: 'text-warning',
  hard: 'text-destructive',
}
