/**
 * Progress: how you're doing across cases, and where to focus next.
 * Everything is computed in the browser from your own attempts (the room
 * only ever sends you your own rows).
 */

import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BarChart3 } from 'lucide-react'
import { EmptyState } from '@/components/ui'
import { CASES, MAX_SCORE, PARTS, SOLVED_SCORE, getCase } from '../../../cases/catalog'
import { useMyAttempts } from '../../../lib/attempts'
import { band, duration } from '../../../components/case/Results'
import { cn } from '../../../lib/utils'

const ADVICE: Record<string, string> = {
  clarify: 'Ask about what changed, the client’s goal, and the competitive picture before you structure.',
  structure: 'Make your branches MECE and case-specific: market, company fit, economics, risks and how to enter.',
  analyze: 'Write the formula before the numbers, and always finish with what the number means.',
  recommend: 'Lead with the call, back it with 2–3 numbers from the case, then risks and next steps.',
}

export default function ProgressPage() {
  const navigate = useNavigate()
  const { attempts, status } = useMyAttempts()
  const done = useMemo(() => attempts.filter((a) => a.data.status === 'completed'), [attempts])

  const stats = useMemo(() => {
    const skills = PARTS.map((p) => {
      const scored = done.map((a) => a.data.results?.[String(p.n)]).filter(Boolean)
      const pct = scored.length ? scored.reduce((s, r) => s + r!.points / r!.maxPoints, 0) / scored.length : 0
      return { ...p, pct: Math.round(pct * 100) }
    })
    const weakest = [...skills].sort((a, b) => a.pct - b.pct)[0]
    const bestByCase = new Map<string, number>()
    for (const a of done) bestByCase.set(a.data.caseId, Math.max(bestByCase.get(a.data.caseId) ?? 0, a.data.totalScore ?? 0))
    const avg = done.length ? Math.round(done.reduce((s, a) => s + (a.data.totalScore ?? 0), 0) / done.length) : 0
    const best = done.reduce((m, a) => Math.max(m, a.data.totalScore ?? 0), 0)
    const solved = [...bestByCase.values()].filter((s) => s >= SOLVED_SCORE).length
    return { skills, weakest, bestByCase, avg, best, solved }
  }, [done])

  if (status === 'loading') return <p className="p-10 text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <title>Progress · Casebook</title>
      <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
      <p className="mt-1 text-sm text-muted-foreground">Across every case you&apos;ve finished.</p>

      {done.length === 0 ? (
        <EmptyState
          className="mt-6 rounded-xl border border-dashed border-border"
          icon={<BarChart3 />}
          title="No finished cases yet"
          description="Finish a case and your scores, strongest and weakest parts, and history show up here."
          action={{ label: 'Pick a case', onClick: () => navigate('/cases') }}
        />
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={`Cases solved (${SOLVED_SCORE}+)`} value={`${stats.solved}/${CASES.length}`} />
            <Stat label="Attempts" value={String(done.length)} />
            <Stat label="Average score" value={String(stats.avg)} />
            <Stat label="Best score" value={String(stats.best)} />
          </div>

          <section className="mt-8 grid gap-6 md:grid-cols-[3fr_2fr]">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold">By part</h2>
              <p className="text-xs text-muted-foreground">Average share of points earned</p>
              <div className="mt-4 space-y-3">
                {stats.skills.map((s) => (
                  <div key={s.n} className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-3 text-sm">
                    <span className={cn(s.key === stats.weakest.key && 'font-semibold')}>{s.label}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-muted">
                      <span
                        className={cn('block h-full rounded-full', s.pct >= 70 ? 'bg-success' : s.pct >= 40 ? 'bg-warning' : 'bg-destructive')}
                        style={{ width: `${s.pct}%` }}
                      />
                    </span>
                    <span className="text-right font-mono tabular-nums">{s.pct}%</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-lg bg-muted/50 p-3 text-sm">
                <span className="font-semibold">Focus next: {stats.weakest.label}.</span>{' '}
                <span className="text-muted-foreground">{ADVICE[stats.weakest.key]}</span>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold">Best by case</h2>
              <ul className="mt-3 space-y-2.5 text-sm">
                {CASES.map((c) => {
                  const best = stats.bestByCase.get(c.id)
                  return (
                    <li key={c.id} className="flex items-center justify-between gap-3">
                      <Link to={`/cases/${c.id}`} className="min-w-0 truncate hover:underline">
                        {c.title}
                        <span className="block text-xs text-muted-foreground">{c.type}</span>
                      </Link>
                      <span className={cn('font-mono tabular-nums', best === undefined && 'text-muted-foreground')}>
                        {best === undefined ? '—' : best}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold">History</h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Case</th>
                    <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Time</th>
                    <th className="px-4 py-2.5 text-right font-medium">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {done.map((a) => {
                    const c = getCase(a.data.caseId)
                    const b = band(a.data.totalScore ?? 0)
                    return (
                      <tr key={a.recordId} className="border-b border-border last:border-0 hover:bg-muted/40">
                        <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                          {new Date(a.data.completedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2.5">
                          <Link to={`/cases/${a.data.caseId}?attempt=${a.recordId}`} className="hover:underline">
                            {c?.title ?? a.data.caseId}
                          </Link>
                        </td>
                        <td className="hidden px-4 py-2.5 font-mono text-xs text-muted-foreground sm:table-cell">
                          {duration(a.data.startedAt, a.data.completedAt)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right">
                          <span className={cn('mr-2 text-xs font-medium', b.tone)}>{b.label}</span>
                          <span className="font-mono tabular-nums">
                            {a.data.totalScore}
                            <span className="text-muted-foreground">/{MAX_SCORE}</span>
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="font-mono text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
