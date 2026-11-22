/**
 * The case workspace: problem on the left, the 4-part answer flow on the right.
 *
 * The page never decides progress itself. It calls a server action, the
 * server updates the attempt, and this page re-renders from the live
 * `attempts` subscription: stepper, score, exhibit and results all follow the
 * record.
 *
 * Which attempt is shown lives in the URL (?attempt=<id>), so a finished
 * attempt stays on screen after completion and past attempts are linkable.
 * Nothing starts automatically: a case only begins (and only counts toward
 * the daily limit) when you press Start.
 */

import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AuthOverlay, useAuth } from 'deepspace'
import { ArrowLeft, Lock, MessageSquare } from 'lucide-react'
import { Button, useToast } from '@/components/ui'
import { getCase, MAX_SCORE, PARTS, type CaseSummary } from '../../../cases/catalog'
import { callAction, useMyAttempts, type AttemptRecord } from '../../../lib/attempts'
import { CaseHeader, ExhibitCard, KeyFacts, ResultRow, ScoreChip, Stepper, Timer } from '../../../components/case/Workspace'
import { AnalyzePart, ClarifyPart, RecommendPart, StructurePart } from '../../../components/case/Parts'
import { band, ModelAnswer, Scorecard } from '../../../components/case/Results'
import { CaseDiscussion } from '../../../components/case/Discussion'
import { cn } from '../../../lib/utils'

export default function CasePage() {
  const { caseId = '' } = useParams()
  const c = getCase(caseId)
  const { isSignedIn } = useAuth()

  if (!c) {
    return (
      <div className="p-10">
        <p className="text-muted-foreground">No case called “{caseId}”.</p>
        <Link to="/cases" className="mt-3 inline-block text-sm underline">
          Back to cases
        </Link>
      </div>
    )
  }
  return isSignedIn ? <CaseView c={c} /> : <SignedOutIntro c={c} />
}

function CaseView({ c }: { c: CaseSummary }) {
  const { attempts, status } = useMyAttempts()
  const [params, setParams] = useSearchParams()
  const { error } = useToast()
  const [starting, setStarting] = useState(false)

  const mine = attempts.filter((a) => a.data.caseId === c.id)
  const inProgress = mine.find((a) => a.data.status === 'in_progress')
  const requested = params.get('attempt')
  const selected = requested ? mine.find((a) => a.recordId === requested) : inProgress

  // Pin the in-progress attempt into the URL, so it stays selected after it completes.
  useEffect(() => {
    if (!requested && inProgress) setParams({ attempt: inProgress.recordId }, { replace: true })
  }, [requested, inProgress, setParams])

  async function start() {
    setStarting(true)
    try {
      const { attemptId } = await callAction<{ attemptId: string }>('startAttempt', { caseId: c.id })
      setParams({ attempt: attemptId })
    } catch (e) {
      error('Could not start the case', e instanceof Error ? e.message : String(e))
    } finally {
      setStarting(false)
    }
  }

  if (status === 'loading' || (requested && !selected && status !== 'error')) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading case…</div>
  }
  if (!selected) return <CaseIntro c={c} past={mine} onStart={start} starting={starting} />
  const finishedOnce = mine.some((a) => a.data.status === 'completed')
  return <Workspace c={c} attempt={selected} onRetry={start} retrying={starting} canDiscuss={finishedOnce} />
}

function Workspace({
  c,
  attempt,
  onRetry,
  retrying,
  canDiscuss,
}: {
  c: CaseSummary
  attempt: AttemptRecord
  onRetry: () => void
  retrying: boolean
  canDiscuss: boolean
}) {
  const a = attempt.data
  const done = a.status === 'completed'
  const [tab, setTab] = useState<'case' | 'model' | 'discuss'>('case')
  useEffect(() => setTab(done ? 'model' : 'case'), [done, attempt.recordId])

  return (
    <div className="grid min-h-full gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,45fr)_minmax(0,55fr)]">
      {/* Left: the problem */}
      <section className="min-w-0 space-y-4">
        <Link to="/cases" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> All cases
        </Link>
        <CaseHeader c={c} />
        <div role="tablist" className="flex gap-5 border-b border-border text-sm">
          <Tab active={tab === 'case'} onClick={() => setTab('case')}>
            Case
          </Tab>
          <Tab active={tab === 'model'} onClick={() => setTab('model')} disabled={!done}>
            Model answer {!done && <Lock className="size-3" />}
          </Tab>
          <Tab
            active={tab === 'discuss'}
            onClick={() => setTab('discuss')}
            disabled={!canDiscuss}
            title="Discussion opens after you finish this case, so nobody spoils it for you"
          >
            <MessageSquare className="size-3.5" /> Discuss {!canDiscuss && <Lock className="size-3" />}
          </Tab>
        </div>
        {tab === 'discuss' && canDiscuss ? (
          <CaseDiscussion caseId={c.id} caseTitle={c.title} />
        ) : tab === 'model' && done ? (
          <ModelAnswer attempt={a} />
        ) : (
          <>
            <p className="leading-relaxed">{c.prompt}</p>
            <ExhibitCard exhibit={a.exhibit} />
            <KeyFacts facts={a.facts ?? []} />
          </>
        )}
      </section>

      {/* Right: the four parts, or the scorecard */}
      <section className="min-w-0 space-y-4 self-start rounded-xl border border-border bg-card p-4 sm:p-5">
        {!done && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[16rem] flex-1">
                <Stepper current={a.currentPart} />
              </div>
              <Timer startedAt={a.startedAt} />
              <ScoreChip attempt={a} />
            </div>
            {PARTS.filter((p) => a.results?.[String(p.n)]).map((p) => (
              <ResultRow key={p.n} part={p.n} result={a.results[String(p.n)]} />
            ))}
          </>
        )}
        {a.currentPart === 1 && <ClarifyPart key="p1" attempt={attempt} />}
        {a.currentPart === 2 && <StructurePart key="p2" attemptId={attempt.recordId} />}
        {a.currentPart === 3 && <AnalyzePart key="p3" attemptId={attempt.recordId} c={c} />}
        {a.currentPart === 4 && <RecommendPart key="p4" attemptId={attempt.recordId} />}
        {done && <Scorecard attempt={a} onRetry={onRetry} retrying={retrying} />}
      </section>
    </div>
  )
}

function Tab({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick?: () => void
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      title={disabled ? (title ?? 'Unlocks after you finish the case') : undefined}
      className={cn(
        '-mb-px inline-flex items-center gap-1.5 border-b-2 pb-2 transition-colors',
        active ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
        disabled && 'cursor-not-allowed text-muted-foreground/50 hover:text-muted-foreground/50',
      )}
    >
      {children}
    </button>
  )
}

/** Before a case starts: what you're about to do, and your past attempts. */
function CaseIntro({
  c,
  past,
  onStart,
  starting,
}: {
  c: CaseSummary
  past: AttemptRecord[]
  onStart?: () => void
  starting?: boolean
}) {
  const completed = past.filter((p) => p.data.status === 'completed')
  const best = completed.reduce((m, p) => Math.max(m, p.data.totalScore ?? 0), 0)
  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link to="/cases" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> All cases
      </Link>
      <div className="mt-4">
        <CaseHeader c={c} />
      </div>
      <p className="mt-5 text-[15px] leading-relaxed">{c.prompt}</p>

      <ol className="mt-6 divide-y divide-border rounded-lg border border-border">
        {PARTS.map((p) => (
          <li key={p.n} className="flex items-baseline gap-3 px-4 py-2.5 text-sm">
            <span className="font-mono text-xs text-muted-foreground">0{p.n}</span>
            <span className="font-medium">{p.label}</span>
            <span className="flex-1 text-muted-foreground">{PART_BLURB[p.key]}</span>
            <span className="font-mono text-xs text-muted-foreground">{p.points} pts</span>
          </li>
        ))}
      </ol>

      {onStart && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={onStart} loading={starting}>
            {completed.length > 0 ? 'Start a new attempt' : 'Start case'}
          </Button>
          <span className="text-xs text-muted-foreground">The timer starts when you do. About {c.estMinutes} minutes.</span>
        </div>
      )}

      {completed.length > 0 && (
        <div className="mt-10">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Your attempts</h2>
            <span className="text-xs text-muted-foreground">
              Best <span className="font-mono text-foreground">{best}</span>/{MAX_SCORE}
            </span>
          </div>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
            {completed.map((p) => {
              const b = band(p.data.totalScore ?? 0)
              return (
                <li key={p.recordId}>
                  <Link
                    to={`?attempt=${p.recordId}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-muted/50"
                  >
                    <span className="text-muted-foreground">{new Date(p.data.completedAt || p.data.startedAt).toLocaleString()}</span>
                    <span className="flex items-center gap-3">
                      <span className={cn('text-xs font-medium', b.tone)}>{b.label}</span>
                      <span className="font-mono tabular-nums">{p.data.totalScore}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

const PART_BLURB: Record<string, string> = {
  clarify: 'Ask up to 3 questions; uncover the facts that matter',
  structure: 'Lay out your framework',
  analyze: 'Read the exhibit, do the math, say what it means',
  recommend: 'Give the CEO a top-down answer',
}

function SignedOutIntro({ c }: { c: CaseSummary }) {
  const [show, setShow] = useState(false)
  return (
    <>
      <CaseIntro c={c} past={[]} />
      <div className="mx-auto -mt-4 max-w-2xl px-6 pb-12">
        <Button size="lg" onClick={() => setShow(true)}>
          Sign in to start this case
        </Button>
      </div>
      {show && <AuthOverlay onClose={() => setShow(false)} />}
    </>
  )
}
