/**
 * What you see when a case is over: the scorecard (right panel) and the model
 * answer (left panel's "Model answer" tab). Everything here comes from the
 * attempt record; the review half is written by the server only on
 * completion, so it can't be read early.
 */

import { Check, RotateCcw, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'
import { MAX_SCORE, PARTS, SOLVED_SCORE } from '../../cases/catalog'
import type { AttemptRow } from '../../schemas/attempts-schema'
import { cn } from '../../lib/utils'
import { ResultRow } from './Workspace'

/** Score bands, roughly how an MBB interviewer would read the performance. */
export function band(score: number): { label: string; tone: string } {
  if (score >= 85) return { label: 'Offer-ready', tone: 'text-success' }
  if (score >= SOLVED_SCORE) return { label: 'Strong', tone: 'text-success' }
  if (score >= 50) return { label: 'Developing', tone: 'text-warning' }
  return { label: 'Keep practicing', tone: 'text-destructive' }
}

export function duration(startedAt: string, completedAt: string): string {
  const secs = Math.max(0, Math.round((Date.parse(completedAt) - Date.parse(startedAt)) / 1000))
  const m = Math.floor(secs / 60)
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m ${secs % 60}s`
}

export function Scorecard({
  attempt,
  onRetry,
  retrying,
}: {
  attempt: AttemptRow
  onRetry: () => void
  retrying: boolean
}) {
  const score = attempt.totalScore ?? 0
  const b = band(score)
  const keyFacts = attempt.review?.keyFacts ?? []
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Final score</p>
          <p className="mt-1 font-mono text-5xl font-semibold tabular-nums tracking-tight">
            {score}
            <span className="text-2xl text-muted-foreground">/{MAX_SCORE}</span>
          </p>
          <p className={cn('mt-1 text-sm font-semibold', b.tone)}>{b.label}</p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          {attempt.completedAt && (
            <p>
              Time <span className="font-mono text-foreground">{duration(attempt.startedAt, attempt.completedAt)}</span>
            </p>
          )}
          <p className="mt-0.5">{new Date(attempt.completedAt || attempt.startedAt).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="space-y-2">
        {PARTS.map((p) => {
          const r = attempt.results?.[String(p.n)]
          const pct = r ? Math.round((r.points / r.maxPoints) * 100) : 0
          return (
            <div key={p.n} className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-3 text-sm">
              <span className="text-muted-foreground">{p.label}</span>
              <span className="h-2 overflow-hidden rounded-full bg-muted">
                <span
                  className={cn('block h-full rounded-full', pct >= 70 ? 'bg-success' : pct >= 40 ? 'bg-warning' : 'bg-destructive')}
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="text-right font-mono tabular-nums">
                {r?.points ?? 0}/{p.points}
              </span>
            </div>
          )
        })}
      </div>

      {keyFacts.length > 0 && (
        <div className="rounded-lg border border-border p-3">
          <p className="text-sm font-semibold">Key facts this case turned on</p>
          <ul className="mt-2 space-y-1 text-sm">
            {keyFacts.map((f) => (
              <li key={f.label} className="flex items-center gap-2">
                {f.found ? (
                  <Check className="size-4 shrink-0 text-success" aria-label="Uncovered" />
                ) : (
                  <X className="size-4 shrink-0 text-destructive" aria-label="Missed" />
                )}
                <span className={f.found ? '' : 'text-muted-foreground'}>{f.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={onRetry} loading={retrying}>
          <RotateCcw /> Try again
        </Button>
        <Link to="/cases" className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium hover:bg-accent">
          All cases
        </Link>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Part by part</p>
        {PARTS.filter((p) => attempt.results?.[String(p.n)]).map((p) => (
          <ResultRow key={p.n} part={p.n} result={attempt.results[String(p.n)]} />
        ))}
      </div>
    </div>
  )
}

export function ModelAnswer({ attempt }: { attempt: AttemptRow }) {
  const r = attempt.review
  if (!r) return null
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">The insight</h3>
        <p className="mt-1">{r.keyInsight}</p>
      </section>
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">The math</h3>
        <p className="mt-1 rounded-md bg-muted/50 p-3 font-mono text-[13px]">{r.working}</p>
      </section>
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">A strong recommendation</h3>
        <p className="mt-1 border-l-2 border-primary pl-3">{r.modelRecommendation}</p>
      </section>
    </div>
  )
}
