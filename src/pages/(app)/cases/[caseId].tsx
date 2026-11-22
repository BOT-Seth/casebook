/**
 * The case workspace: problem on the left, the 4-part answer flow on the right.
 *
 * The page never decides progress itself. It calls a server action, the
 * server updates the attempt, and this page re-renders from the live
 * `attempts` subscription: stepper, score, exhibit and results all follow the
 * record.
 */

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AuthOverlay, useAuth } from 'deepspace'
import { ArrowLeft, Calculator, Lock } from 'lucide-react'
import { Button, Textarea, useToast } from '@/components/ui'
import { getCase, PARTS, type CaseSummary } from '../../../cases/catalog'
import { callAction, useMyAttempts, type AttemptRecord } from '../../../lib/attempts'
import {
  CalculatorDrawer,
  CaseHeader,
  ExhibitCard,
  KeyFacts,
  PartHeading,
  ResultRow,
  ScoreChip,
  Stepper,
  Timer,
} from '../../../components/case/Workspace'

export default function CasePage() {
  const { caseId = '' } = useParams()
  const c = getCase(caseId)
  const { isSignedIn } = useAuth()

  if (!c) {
    return (
      <div className="p-10">
        <p className="text-muted-foreground">No case called “{caseId}”.</p>
        <Link to="/cases" className="mt-3 inline-block text-sm underline">Back to cases</Link>
      </div>
    )
  }
  if (!isSignedIn) return <SignInToStart c={c} />
  return <Workspace c={c} />
}

/**
 * One in-flight start per case, so React's dev double-mount (or a fast
 * re-render) can't race two `startAttempt` calls into two attempts.
 */
const starting = new Map<string, Promise<string>>()
function startOnce(caseId: string): Promise<string> {
  let p = starting.get(caseId)
  if (!p) {
    p = callAction<{ attemptId: string }>('startAttempt', { caseId })
      .then((d) => d.attemptId)
      .finally(() => setTimeout(() => starting.delete(caseId), 2000))
    starting.set(caseId, p)
  }
  return p
}

function Workspace({ c }: { c: CaseSummary }) {
  const { attempts, status } = useMyAttempts()
  const { error } = useToast()
  const [attemptId, setAttemptId] = useState<string | null>(null)

  // Start (or resume) on the server; the record then arrives over the live subscription.
  useEffect(() => {
    let cancelled = false
    startOnce(c.id)
      .then((id) => !cancelled && setAttemptId(id))
      .catch((e: Error) => !cancelled && error('Could not start the case', e.message))
    return () => {
      cancelled = true
    }
  }, [c.id])

  const attempt = attempts.find((a) => a.recordId === attemptId)
  if (!attempt) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{status === 'error' ? 'Could not load.' : 'Opening case…'}</div>
  }
  const a = attempt.data

  return (
    <div className="grid min-h-full gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,45fr)_minmax(0,55fr)]">
      {/* Left: the problem */}
      <section className="space-y-4">
        <Link to="/cases" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> All cases
        </Link>
        <CaseHeader c={c} />
        <div className="flex gap-4 border-b border-border text-sm">
          <span className="border-b-2 border-primary pb-2 font-medium">Case</span>
          <span className="pb-2 text-muted-foreground/60" title="Arrives in slice 5">Discuss</span>
          <span className="inline-flex items-center gap-1 pb-2 text-muted-foreground/60" title="Unlocks after you finish">
            Model answer <Lock className="size-3" />
          </span>
        </div>
        <p className="leading-relaxed">{c.prompt}</p>
        <ExhibitCard exhibit={a.exhibit} />
        <KeyFacts facts={a.facts ?? []} />
      </section>

      {/* Right: the four parts */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Stepper current={a.currentPart} />
          </div>
          <Timer startedAt={a.startedAt} stoppedAt={a.completedAt || undefined} />
          <ScoreChip attempt={a} />
        </div>

        {PARTS.filter((p) => a.results?.[String(p.n)]).map((p) => (
          <ResultRow key={p.n} part={p.n} result={a.results[String(p.n)]} />
        ))}

        <CurrentPart attempt={attempt} c={c} />
      </section>
    </div>
  )
}

function CurrentPart({ attempt, c }: { attempt: AttemptRecord; c: CaseSummary }) {
  const a = attempt.data
  switch (a.currentPart) {
    case 1:
      return (
        <TextPart
          key="part-1"
          attemptId={attempt.recordId}
          part={1}
          title="Clarify"
          hint="What would you ask the interviewer before structuring? (Slice 2: the AI interviewer answers live.)"
          placeholder="e.g. Has the store count or pricing changed? What is the client's margin target?"
          cta="Continue to Structure"
        />
      )
    case 2:
      return (
        <TextPart
          key="part-2"
          attemptId={attempt.recordId}
          part={2}
          title="Structure"
          hint="Lay out your framework or issue tree. (Slice 2: graded against hidden checkpoints.)"
          placeholder={'Profit = Revenue − Costs\n  Revenue: price × volume …\n  Costs: …'}
          cta="Submit structure"
          rows={8}
        />
      )
    case 3:
      return <AnalyzePart attemptId={attempt.recordId} c={c} />
    case 4:
      return (
        <div className="space-y-2">
          <PartHeading n={4} title="Recommend" />
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
            <Lock className="size-4 shrink-0" /> Recommendation grading arrives in slice 3.
          </div>
        </div>
      )
    default:
      return <p className="text-sm text-muted-foreground">Case complete.</p>
  }
}

function TextPart(props: {
  attemptId: string
  part: 1 | 2
  title: string
  hint: string
  placeholder: string
  cta: string
  rows?: number
}) {
  const { error } = useToast()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit() {
    setBusy(true)
    try {
      await callAction('submitPart', { attemptId: props.attemptId, part: props.part, text })
    } catch (e) {
      error('Could not submit', e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }
  return (
    <div className="space-y-3">
      <PartHeading n={props.part} title={props.title} hint={props.hint} />
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={props.rows ?? 4} placeholder={props.placeholder} />
      <div className="flex justify-end">
        <Button onClick={submit} loading={busy} disabled={!text.trim()}>
          {props.cta}
        </Button>
      </div>
    </div>
  )
}

function AnalyzePart({ attemptId, c }: { attemptId: string; c: CaseSummary }) {
  const { error } = useToast()
  const [answer, setAnswer] = useState('')
  const [soWhat, setSoWhat] = useState('')
  const [calcOpen, setCalcOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  async function submit() {
    setBusy(true)
    try {
      await callAction('submitAnalyze', { attemptId, answer, soWhat })
    } catch (e) {
      error('Could not submit', e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }
  return (
    <div className="space-y-3">
      <PartHeading n={3} title="Analyze" hint="Use the exhibit on the left. One submission, like the real interview." />
      <p className="font-medium">{c.analyzeQuestion}</p>
      <div>
        <div className="flex overflow-hidden rounded-md border border-input focus-within:ring-1 focus-within:ring-ring">
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            inputMode="decimal"
            placeholder="e.g. 12.5"
            aria-label="Your answer"
            className="h-10 flex-1 bg-transparent px-3 font-mono text-sm outline-none"
          />
          <span className="flex items-center border-l border-input bg-muted px-3 font-mono text-sm text-muted-foreground">
            {c.analyzeUnit}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Answers within 2% count as correct.</p>
      </div>
      <div>
        <label htmlFor="sowhat" className="text-sm font-medium">
          So what? (one sentence)
        </label>
        <Textarea
          id="sowhat"
          value={soWhat}
          onChange={(e) => setSoWhat(e.target.value)}
          rows={2}
          className="mt-1"
          placeholder="What does this number mean for the client?"
        />
      </div>
      {calcOpen && <CalculatorDrawer />}
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => setCalcOpen((o) => !o)}>
          <Calculator /> Calculator
        </Button>
        <Button onClick={submit} loading={busy} disabled={!answer.trim()}>
          Submit
        </Button>
      </div>
    </div>
  )
}

function SignInToStart({ c }: { c: CaseSummary }) {
  const [show, setShow] = useState(false)
  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <CaseHeader c={c} />
      <p className="mt-4 leading-relaxed">{c.prompt}</p>
      <Button className="mt-6" onClick={() => setShow(true)}>
        Sign in to start this case
      </Button>
      {show && <AuthOverlay onClose={() => setShow(false)} />}
    </div>
  )
}
