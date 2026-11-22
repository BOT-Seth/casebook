/**
 * Pieces of the case workspace (the split-screen page).
 */

import { useEffect, useState } from 'react'
import { Calculator, Check, ChevronDown, ExternalLink, Lock } from 'lucide-react'
import { PARTS, type CaseSummary } from '../../cases/catalog'
import type { AttemptRow, ExhibitData, PartResult } from '../../schemas/attempts-schema'
import { evaluate } from '../../lib/calc'
import { DIFFICULTY_STYLE } from '../../lib/attempts'
import { cn } from '../../lib/utils'

// ---------------------------------------------------------------- left panel

export function CaseHeader({ c }: { c: CaseSummary }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{c.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">{c.type}</span>
        <span className={cn('rounded-full px-2 py-0.5 font-medium', DIFFICULTY_STYLE[c.difficulty])}>{c.difficulty}</span>
        <span className="font-mono text-muted-foreground">~{c.estMinutes} min</span>
      </div>
      <a
        href={c.modeledOn.url}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        Format modeled on {c.modeledOn.label} <ExternalLink className="size-3" />
      </a>
    </div>
  )
}

export function ExhibitCard({ exhibit }: { exhibit: ExhibitData | null }) {
  if (!exhibit) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
        <Lock className="size-4 shrink-0" />
        The exhibit unlocks when you reach Part 3.
      </div>
    )
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <p className="border-b border-border px-4 py-2.5 text-sm font-semibold">{exhibit.title}</p>
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
          <tr>
            {exhibit.columns.map((col, i) => (
              <th key={col} className={cn('px-4 py-2 font-medium', i > 0 && 'text-right')}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {exhibit.rows.map((row, r) => (
            <tr key={r} className={cn('border-t border-border', r === exhibit.boldRow && 'bg-muted/40 font-semibold')}>
              {row.map((cell, i) => (
                <td key={i} className={cn('px-4 py-1.5', i > 0 && 'text-right font-mono tabular-nums')}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {exhibit.note && <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">{exhibit.note}</p>}
    </div>
  )
}

export function KeyFacts({ facts }: { facts: string[] }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-sm font-semibold">Key facts discovered</p>
      {facts.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">Facts the interviewer reveals in Part 1 collect here.</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {facts.map((f) => (
            <li key={f} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
              <Check className="size-3 text-success" /> {f}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// --------------------------------------------------------------- right panel

export function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2">
      {PARTS.map((p, i) => {
        const done = current > p.n
        const active = current === p.n
        return (
          <li key={p.n} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                done && 'border-success bg-success text-white',
                active && 'border-primary bg-primary text-primary-foreground',
                !done && !active && 'border-border text-muted-foreground',
              )}
            >
              {done ? <Check className="size-3.5" /> : current < p.n ? <Lock className="size-3" /> : p.n}
            </span>
            <span className={cn('hidden text-xs sm:inline', active ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
              {p.label}
            </span>
            {i < PARTS.length - 1 && <span className={cn('h-px flex-1', done ? 'bg-success' : 'bg-border')} />}
          </li>
        )
      })}
    </ol>
  )
}

export function Timer({ startedAt, stoppedAt }: { startedAt: string; stoppedAt?: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (stoppedAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [stoppedAt])
  const end = stoppedAt ? Date.parse(stoppedAt) : now
  const secs = Math.max(0, Math.floor((end - Date.parse(startedAt)) / 1000))
  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')
  return <span className="font-mono text-xs tabular-nums text-muted-foreground">{mm}:{ss}</span>
}

export function ScoreChip({ attempt }: { attempt: AttemptRow }) {
  const possible = PARTS.filter((p) => attempt.results?.[String(p.n)]).reduce((s, p) => s + p.points, 0)
  return (
    <span className="whitespace-nowrap rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
      Score <span className="font-mono font-semibold text-foreground">{attempt.totalScore ?? 0}</span>
      <span className="font-mono"> / {possible}</span>
    </span>
  )
}

export function ResultRow({ part, result }: { part: number; result: PartResult }) {
  const [open, setOpen] = useState(false)
  const label = PARTS[part - 1].label
  const good = result.points >= result.maxPoints * 0.6
  return (
    <div className={cn('rounded-lg border', good ? 'border-success/40 bg-success/5' : 'border-border bg-muted/30')}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm"
        aria-expanded={open}
      >
        <span>
          <span className="font-semibold">
            Part {part}: {label}
          </span>{' '}
          <span className="font-mono">
            {result.points}/{result.maxPoints}
          </span>
          <span className="text-muted-foreground"> · {result.verdict}</span>
        </span>
        <ChevronDown className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-border px-4 py-3 text-sm">
          {result.submitted && (
            <p className="whitespace-pre-wrap text-muted-foreground">
              <span className="font-medium text-foreground">You submitted: </span>
              {result.submitted}
            </p>
          )}
          {result.hits.map((h) => (
            <p key={h} className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-success" /> {h}
            </p>
          ))}
          {result.misses.map((m) => (
            <p key={m} className="flex gap-2 text-muted-foreground">
              <span className="mt-0.5 shrink-0 text-destructive">✗</span> {m}
            </p>
          ))}
          {result.feedback && <p>{result.feedback}</p>}
        </div>
      )}
    </div>
  )
}

export function PartHeading({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="border-l-2 border-primary pl-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Part {n}</p>
      <h2 className="text-lg font-semibold">{title}</h2>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Inline calculator drawer for case math. */
export function CalculatorDrawer() {
  const [expr, setExpr] = useState('')
  let result = ''
  try {
    if (expr.trim()) result = evaluate(expr).toLocaleString('en-US', { maximumFractionDigits: 4 })
  } catch {
    result = '…'
  }
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground" htmlFor="calc">
        <Calculator className="size-3.5" /> Calculator: + − × ÷, %, k/m/b
      </label>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          id="calc"
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          placeholder="(0.7% + 0.8%) * 1.2b"
          className="h-9 flex-1 rounded-md border border-input bg-background px-2 font-mono text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        <span className="min-w-24 text-right font-mono text-sm font-semibold tabular-nums">= {result || '0'}</span>
      </div>
    </div>
  )
}
