/**
 * Leaderboard: public, live. Each row is written only by the server when
 * someone finishes a case (see refreshLeaderboard in src/actions), so a
 * plain useQuery is the whole data layer and new scores appear for everyone
 * without a refresh.
 */

import { useAuth, useQuery } from 'deepspace'
import { Trophy } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '@/components/ui'
import { CASES, MAX_SCORE } from '../../cases/catalog'
import type { LeaderboardRow } from '../../schemas/leaderboard-schema'
import { cn } from '../../lib/utils'

export default function LeaderboardPage() {
  const navigate = useNavigate()
  const { userId } = useAuth()
  const { records, status } = useQuery<LeaderboardRow>('leaderboard', { orderBy: 'total', orderDir: 'desc', limit: 100 })
  const rows = [...records]
    .filter((r) => (r.data.total ?? 0) > 0)
    .sort((a, b) => b.data.total - a.data.total || b.data.solved - a.data.solved)

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <title>Leaderboard · Casebook</title>
      <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your best score on each case, added up. Max <span className="font-mono">{CASES.length * MAX_SCORE}</span>.
        Updates live.
      </p>

      {status === 'loading' ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          className="mt-6 rounded-xl border border-dashed border-border"
          icon={<Trophy />}
          title="No scores yet"
          description="Finish a case to put the first name on the board."
          action={{ label: 'Pick a case', onClick: () => navigate('/cases') }}
        />
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-14 px-4 py-2.5 font-medium">#</th>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Solved</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const me = r.data.userId === userId
                return (
                  <tr key={r.recordId} className={cn('border-b border-border last:border-0', me && 'bg-primary/5')}>
                    <td className="px-4 py-2.5 font-mono tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      {r.data.name}
                      {me && <span className="ml-2 text-xs font-medium text-primary">you</span>}
                    </td>
                    <td className="px-4 py-2.5 font-mono tabular-nums">
                      {r.data.solved}
                      <span className="text-muted-foreground">/{CASES.length}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">{r.data.total}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Only a first name and last initial are shown. Your individual answers are never public.
      </p>
    </div>
  )
}
