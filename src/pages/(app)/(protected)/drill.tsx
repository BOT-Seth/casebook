/**
 * Drill — the core loop.
 *
 *   1. Show the prompt only.
 *   2. You explain the approach from memory.
 *   3. "Check with coach" sends it to the coachRecall server action, which
 *      grades it against your saved approach (the AI never sees other users'
 *      cases; the action checks ownership).
 *   4. Your saved answer is revealed next to the verdict; you pick the grade
 *      (the coach only suggests). Each button previews the next interval.
 *   5. The grade reschedules the case (src/lib/srs.ts) and logs an attempt.
 *
 * You can also skip the coach and grade yourself — the AI is a help, not a gate.
 */

import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutations } from 'deepspace'
import { Check, Eye, PartyPopper, Sparkles, X } from 'lucide-react'
import { Button, Textarea, useToast } from '@/components/ui'
import { callAction, DIFFICULTY_STYLE, useCases, type CaseRecord } from '../../../lib/cases'
import { describeInterval, normalizeState, schedule } from '../../../lib/srs'
import { GRADES, type AttemptRow, type CaseRow, type Grade } from '../../../schemas/cases-schema'

interface Verdict {
  grade: Grade
  covered: string[]
  missed: string[]
  feedback: string
}

export default function DrillPage() {
  const [params] = useSearchParams()
  const pinned = params.get('case')
  const { mine, due, status } = useCases()
  // Freeze the queue when the session starts so grading a case (which moves
  // its dueAt) doesn't reshuffle what comes next mid-session.
  const [queue, setQueue] = useState<string[] | null>(null)
  const [done, setDone] = useState<Array<{ title: string; grade: Grade }>>([])

  const sessionQueue = useMemo(() => {
    if (queue) return queue
    if (status !== 'ready') return null
    if (pinned) return mine.some((c) => c.recordId === pinned) ? [pinned] : []
    return due.map((c) => c.recordId)
  }, [queue, status, pinned, mine, due])

  if (!sessionQueue) return <p className="p-12 text-sm text-muted-foreground">Loading…</p>
  if (!queue && sessionQueue.length) setQueue(sessionQueue)

  const currentId = sessionQueue[done.length]
  const current = mine.find((c) => c.recordId === currentId)

  if (!current) return <SessionEnd done={done} hadQueue={sessionQueue.length > 0} />

  return (
    <DrillCard
      key={current.recordId}
      record={current}
      position={done.length + 1}
      total={sessionQueue.length}
      onGraded={(grade) => setDone((d) => [...d, { title: current.data.title, grade }])}
    />
  )
}

function DrillCard({
  record,
  position,
  total,
  onGraded,
}: {
  record: CaseRecord
  position: number
  total: number
  onGraded: (g: Grade) => void
}) {
  const c = record.data
  const { put } = useMutations<CaseRow>('cases')
  const { create } = useMutations<AttemptRow>('attempts')
  const { error } = useToast()
  const [recall, setRecall] = useState('')
  const [checking, setChecking] = useState(false)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [revealed, setRevealed] = useState(false)
  const startedAt = useRef(Date.now())

  const previews = useMemo(() => {
    const state = normalizeState(c)
    return Object.fromEntries(GRADES.map((g) => [g, describeInterval(schedule(state, g))])) as Record<Grade, string>
  }, [c])

  async function check() {
    setChecking(true)
    try {
      const v = await callAction<Verdict>('coachRecall', { caseId: record.recordId, recall })
      setVerdict(v)
      setRevealed(true)
    } catch (e) {
      error('Coach unavailable', e instanceof Error ? e.message : String(e))
    } finally {
      setChecking(false)
    }
  }

  async function grade(g: Grade) {
    const next = schedule(normalizeState(c), g)
    try {
      await put(record.recordId, next)
      await create({
        caseId: record.recordId,
        caseTitle: c.title,
        grade: g,
        recall,
        coachGrade: verdict?.grade ?? '',
        covered: verdict?.covered ?? [],
        missed: verdict?.missed ?? [],
        feedback: verdict?.feedback ?? '',
        intervalDays: next.intervalDays,
      })
      onGraded(g)
    } catch (e) {
      error('Could not save the review', e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Case {position} of {total}
        </span>
        <span>
          {c.pattern || 'No pattern'} · <span className={DIFFICULTY_STYLE[c.difficulty] ?? ''}>{c.difficulty}</span>
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${((position - 1) / total) * 100}%` }} />
      </div>

      <h1 className="mt-8 text-2xl font-semibold tracking-tight">{c.title}</h1>
      <p className="mt-3 whitespace-pre-wrap text-foreground/90">
        {c.prompt || <span className="text-muted-foreground">No prompt written yet — explain the solution to the title.</span>}
      </p>

      <label className="mt-8 block text-sm font-semibold" htmlFor="recall">
        Explain your approach, complexity and edge cases from memory
      </label>
      <Textarea
        id="recall"
        value={recall}
        onChange={(e) => setRecall(e.target.value)}
        rows={7}
        disabled={!!verdict}
        placeholder="Talk it through like you would in the interview…"
        className="mt-2"
      />

      {!revealed && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={check} loading={checking} disabled={!recall.trim()}>
            <Sparkles /> Check with coach
          </Button>
          <Button variant="ghost" onClick={() => setRevealed(true)}>
            <Eye /> Just show my answer
          </Button>
        </div>
      )}

      {verdict && (
        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold">
            Coach suggests: <span className="capitalize">{verdict.grade}</span>
          </p>
          <p className="mt-2 text-sm">{verdict.feedback}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <PointList icon={<Check className="size-4 text-success" />} title="You covered" items={verdict.covered} />
            <PointList icon={<X className="size-4 text-destructive" />} title="You missed" items={verdict.missed} />
          </div>
        </div>
      )}

      {revealed && (
        <>
          <details className="mt-6 rounded-xl border border-border p-5" open={!verdict}>
            <summary className="cursor-pointer text-sm font-semibold">Your saved answer</summary>
            <div className="mt-3 space-y-3 text-sm">
              <Reveal label="Approach" text={c.approach} />
              <Reveal label="Complexity" text={c.complexity} />
              <Reveal label="Pitfalls" text={c.pitfalls} />
            </div>
          </details>

          <p className="mt-8 text-sm font-semibold">How well did you recall it?</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {GRADES.map((g) => (
              <Button
                key={g}
                variant={verdict?.grade === g ? 'default' : 'outline'}
                className="h-auto flex-col py-2"
                onClick={() => grade(g)}
              >
                <span className="capitalize">{g}</span>
                <span className="text-xs opacity-70">{previews[g]}</span>
              </Button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {Math.round((Date.now() - startedAt.current) / 1000)}s on this case · the coach suggests, you decide
          </p>
        </>
      )}
    </div>
  )
}

function PointList({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">—</p>
      ) : (
        <ul className="space-y-1">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span className="mt-0.5 shrink-0">{icon}</span>
              {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Reveal({ label, text }: { label: string; text: string }) {
  if (!text) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap">{text}</p>
    </div>
  )
}

function SessionEnd({ done, hadQueue }: { done: Array<{ title: string; grade: Grade }>; hadQueue: boolean }) {
  const navigate = useNavigate()
  if (!hadQueue) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold">Nothing due right now</h1>
        <p className="mt-2 text-muted-foreground">Come back when cases come due, or add more to your casebook.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={() => navigate('/cases')}>My cases</Button>
          <Button variant="ghost" onClick={() => navigate('/library')}>Library</Button>
        </div>
      </div>
    )
  }
  const recalled = done.filter((d) => d.grade !== 'again').length
  return (
    <div className="mx-auto max-w-xl px-6 py-20 text-center">
      <PartyPopper className="mx-auto size-8 text-primary" />
      <h1 className="mt-4 text-2xl font-semibold">Session done</h1>
      <p className="mt-2 text-muted-foreground">
        Recalled {recalled} of {done.length}. Anything you marked “again” comes back in 10 minutes.
      </p>
      <Link to="/home" className="mt-6 inline-block text-sm underline">Back to Today</Link>
    </div>
  )
}
