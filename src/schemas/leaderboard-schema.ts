/**
 * `leaderboard`: one public row per user, written only by the server when an
 * attempt completes.
 *
 * A second, deliberately different permission level from `attempts`:
 * attempts are private (read: 'own'), but this summary (a display name and
 * first-attempt scores, nothing else) is readable by everyone, signed out included.
 * Nobody can write it from the browser, so nobody can edit their own rank.
 */

import type { CollectionSchema } from 'deepspace/schema'

export interface LeaderboardRow {
  userId: string
  /** First name + last initial, e.g. "Mohammed A." */
  name: string
  /** Sum of the user's first-attempt score on each case (max 100 per case). */
  total: number
  /** Cases whose first attempt scored SOLVED_SCORE (70) or more. */
  solved: number
  /** First-attempt score per caseId (field kept as `best` for compatibility). */
  best: Record<string, number>
}

export const leaderboardSchema: CollectionSchema = {
  name: 'leaderboard',
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'name', storage: 'text', interpretation: 'plain' },
    { name: 'total', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'solved', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'best', storage: 'text', interpretation: { kind: 'json' } },
  ],
  permissions: {
    '*': { read: true, create: false, update: false, delete: false },
    viewer: { read: true, create: false, update: false, delete: false },
    member: { read: true, create: false, update: false, delete: false },
    admin: { read: true, create: false, update: false, delete: true },
  },
}
