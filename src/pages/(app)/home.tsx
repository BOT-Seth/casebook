/**
 * Today — the review queue and a quick read of how practice is going.
 * Signed-out visitors see what the app does and a way into the Library.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthOverlay, useAuth, useMutations, useQuery } from 'deepspace'
import { ArrowRight, BookOpen, Brain, Library, Sparkles } from 'lucide-react'
import { Button, useToast } from '@/components/ui'
import { DIFFICULTY_STYLE, newCaseRow, useCases } from '../../lib/cases'
import { GradePill } from '../../components/casebook/GradePill'
import { STARTER_CASES } from '../../lib/starters'
import type { AttemptRow, CaseRow } from '../../schemas/cases-schema'

const DAY = 24 * 60 * 60 * 1000

export default function TodayPage() {
  const { isSignedIn } = useAuth()
  return isSignedIn ? <Today /> : <SignedOutToday />
}

function Today() {
  const navigate = useNavigate()
  const { mine, due, status } = useCases()
  const { records: attempts } = useQuery<AttemptRow>('attempts', {
    orderBy: 'createdAt',
    orderDir: 'desc',
    limit: 200,
  })
  const { ready, create } = useMutations<CaseRow>('cases')
  const { success, error } = useToast()
  const [seeding, setSeeding] = useState(false)

  const stats = useMemo(() => {
    const now = Date.now()
    const week = attempts.filter((a) => now - Date.parse(a.createdAt) < 7 * DAY)
    const recalled = week.filter((a) => a.data.grade !== 'again').length
    const days = new Set(attempts.map((a) => a.createdAt.slice(0, 10)))
    // Consecutive days with a review, ending today (or yesterday, if today is still open).
    const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10)
    let cursor = days.has(dayKey(now)) ? now : now - DAY
    let streak = 0
    while (days.has(dayKey(cursor))) {
      streak++
      cursor -= DAY
    }
    const weakest = Object.entries(
      mine.reduce<Record<string, number>>((acc, c) => {
        const key = c.data.pattern || 'Unsorted'
        acc[key] = (acc[key] ?? 0) + (c.data.lapses ?? 0)
        return acc
      }, {}),
    )
      .filter(([, lapses]) => lapses > 0)
      .sort((a, b) => b[1] - a[1])[0]
    return {
      reviewsThisWeek: week.length,
      recallRate: week.length ? Math.round((recalled / week.length) * 100) : null,
      streak,
      weakest: weakest?.[0] ?? null,
    }
  }, [attempts, mine])

  async function loadStarters() {
    setSeeding(true)
    try {
      for (const starter of STARTER_CASES) await create(newCaseRow(starter))
      success('Added 6 starter cases', 'They are due now — start a drill.')
    } catch (e) {
      error('Could not add starter cases', e instanceof Error ? e.message : String(e))
    } finally {
      setSeeding(false)
    }
  }

  if (status === 'loading') {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading your casebook…</div>
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm font-medium text-muted-foreground">
        {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">
        {mine.length === 0
          ? 'Start your casebook'
          : due.length === 0
            ? 'Nothing due. Nice.'
            : `${due.length} ${due.length === 1 ? 'case' : 'cases'} due for review`}
      </h1>

      {mine.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            A case is one interview problem written up in your own words: the prompt, your approach,
            complexity and the traps. Casebook hides your answer, has you explain it from memory, and an
            AI coach grades you against what you wrote. The better you recall it, the longer until you see it again.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={loadStarters} loading={seeding} disabled={!ready}>
              <Sparkles /> Add 6 starter cases
            </Button>
            <Button variant="outline" onClick={() => navigate('/cases?new=1')}>
              <BookOpen /> Write my own
            </Button>
            <Button variant="ghost" onClick={() => navigate('/library')}>
              <Library /> Browse the Library
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Cases" value={String(mine.length)} />
            <Stat label="Reviews, 7 days" value={String(stats.reviewsThisWeek)} />
            <Stat label="Recall rate" value={stats.recallRate === null ? '—' : `${stats.recallRate}%`} />
            <Stat label="Day streak" value={String(stats.streak)} />
          </div>

          {due.length > 0 && (
            <Button size="lg" className="mt-6" onClick={() => navigate('/drill')}>
              <Brain /> Start drill <ArrowRight />
            </Button>
          )}

          {stats.weakest && (
            <p className="mt-4 text-sm text-muted-foreground">
              Most-forgotten pattern so far: <span className="font-medium text-foreground">{stats.weakest}</span>
            </p>
          )}

          <section className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Up next</h2>
            <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
              {(due.length ? due : [...mine].sort((a, b) => (a.data.dueAt || '').localeCompare(b.data.dueAt || '')))
                .slice(0, 8)
                .map((c) => (
                  <li key={c.recordId}>
                    <Link to={`/cases/${c.recordId}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.data.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.data.pattern || 'No pattern'} ·{' '}
                          <span className={DIFFICULTY_STYLE[c.data.difficulty] ?? ''}>{c.data.difficulty}</span>
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{dueLabel(c.data.dueAt)}</span>
                    </Link>
                  </li>
                ))}
            </ul>
          </section>

          {attempts.length > 0 && (
            <section className="mt-10">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent reviews</h2>
              <ul className="mt-3 space-y-2">
                {attempts.slice(0, 5).map((a) => (
                  <li key={a.recordId} className="flex items-center justify-between gap-4 text-sm">
                    <span className="truncate">{a.data.caseTitle}</span>
                    <GradePill grade={a.data.grade} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function SignedOutToday() {
  const [showAuth, setShowAuth] = useState(false)
  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Remember how you solved it.</h1>
      <p className="mt-3 text-muted-foreground">
        Casebook is a spaced-repetition notebook for coding-interview problems. Write each problem up once,
        then explain it from memory while an AI coach checks you against your own notes.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={() => setShowAuth(true)}>Sign in to start</Button>
        <Link to="/library" className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium hover:bg-accent">
          Browse the Library first
        </Link>
      </div>
      {showAuth && <AuthOverlay onClose={() => setShowAuth(false)} />}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function dueLabel(dueAt: string) {
  if (!dueAt) return 'new'
  const ms = Date.parse(dueAt) - Date.now()
  if (ms <= 0) return 'due'
  const days = Math.round(ms / DAY)
  return days < 1 ? 'later today' : `in ${days}d`
}
