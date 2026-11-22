/**
 * The four answer parts of a case. Each one only collects input and calls a
 * server action; what happens next (score, next part, exhibit) arrives through
 * the live `attempts` subscription, never from local state.
 */

import { useState, type ReactNode } from 'react'
import { Calculator } from 'lucide-react'
import { Button, Textarea, useToast } from '@/components/ui'
import type { CaseSummary } from '../../cases/catalog'
import { callAction, type AttemptRecord } from '../../lib/attempts'
import { CalculatorDrawer, PartHeading } from './Workspace'

const MAX_QUESTIONS = 3

function useSubmit() {
  const { error } = useToast()
  const [busy, setBusy] = useState(false)
  async function run(action: string, params: Record<string, unknown>, failTitle = 'Could not submit') {
    setBusy(true)
    try {
      await callAction(action, params)
      return true
    } catch (e) {
      error(failTitle, e instanceof Error ? e.message : String(e))
      setBusy(false)
      return false
    }
  }
  return { busy, setBusy, run }
}

// ------------------------------------------------------------------ Part 1

export function ClarifyPart({ attempt }: { attempt: AttemptRecord }) {
  const { error } = useToast()
  const finish = useSubmit()
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const qa = attempt.data.qa ?? []
  const left = MAX_QUESTIONS - qa.length

  async function ask() {
    const q = question.trim()
    if (!q) return
    setAsking(true)
    setPending(q)
    setQuestion('')
    try {
      await callAction('askQuestion', { attemptId: attempt.recordId, question: q })
    } catch (e) {
      error('The interviewer could not answer', e instanceof Error ? e.message : String(e))
      setQuestion(q)
    } finally {
      setPending(null)
      setAsking(false)
    }
  }

  return (
    <div className="space-y-3">
      <PartHeading
        n={1}
        title="Clarify"
        hint={`Ask the interviewer up to ${MAX_QUESTIONS} questions before you structure. You're scored on whether they uncover the facts the case turns on.`}
      />
      <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3" aria-live="polite">
        <Bubble who="interviewer">
          Thanks for coming in. You&apos;ve read the situation. What would you like to know before you structure your
          approach?
        </Bubble>
        {qa.map((x, i) => (
          <div key={i} className="space-y-3">
            <Bubble who="you">{x.q}</Bubble>
            <Bubble who="interviewer">{x.a}</Bubble>
          </div>
        ))}
        {pending && (
          <>
            <Bubble who="you">{pending}</Bubble>
            <Bubble who="interviewer">
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <span className="size-1.5 animate-pulse rounded-full bg-current" />
                <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
                <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
              </span>
            </Bubble>
          </>
        )}
      </div>
      {left > 0 ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void ask()
          }}
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={500}
            placeholder="Ask a clarifying question…"
            aria-label="Your question"
            disabled={asking}
            className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
          />
          <Button type="submit" variant="outline" loading={asking} disabled={!question.trim()}>
            Ask
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">You&apos;ve used all {MAX_QUESTIONS} questions.</p>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground">
          {left} of {MAX_QUESTIONS} questions left
        </span>
        <Button
          onClick={() => finish.run('finishClarify', { attemptId: attempt.recordId }, 'Could not continue')}
          loading={finish.busy}
          disabled={asking}
        >
          Continue to Structure
        </Button>
      </div>
    </div>
  )
}

function Bubble({ who, children }: { who: 'you' | 'interviewer'; children: ReactNode }) {
  const mine = who === 'you'
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
          mine ? 'bg-primary text-primary-foreground' : 'border border-border bg-card'
        }`}
      >
        {!mine && (
          <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Interviewer</p>
        )}
        {children}
      </div>
    </div>
  )
}

// --------------------------------------------------------- Parts 2 and 4

function WrittenPart(props: {
  attemptId: string
  action: 'submitStructure' | 'submitRecommend'
  n: number
  title: string
  hint: string
  placeholder: string
  cta: string
  minChars: number
  rows: number
  aside?: ReactNode
}) {
  const [value, setValue] = useState('')
  const submit = useSubmit()
  const short = value.trim().length < props.minChars
  return (
    <div className="space-y-3">
      <PartHeading n={props.n} title={props.title} hint={props.hint} />
      {props.aside}
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={props.rows}
        placeholder={props.placeholder}
        aria-label={props.title}
        className="font-mono text-[13px] leading-relaxed"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">One submission. Graded against hidden checkpoints.</span>
        <Button
          onClick={() => submit.run(props.action, { attemptId: props.attemptId, text: value })}
          loading={submit.busy}
          disabled={short}
        >
          {submit.busy ? 'Grading…' : props.cta}
        </Button>
      </div>
    </div>
  )
}

export function StructurePart({ attemptId }: { attemptId: string }) {
  return (
    <WrittenPart
      attemptId={attemptId}
      action="submitStructure"
      n={2}
      title="Structure"
      hint="Lay out your framework or issue tree: the 3-4 branches you'd investigate, and what's under each."
      placeholder={'1. Revenue: …\n   - price, volume, mix\n2. Costs: …\n3. …'}
      cta="Submit structure"
      minChars={20}
      rows={9}
    />
  )
}

export function RecommendPart({ attemptId }: { attemptId: string }) {
  return (
    <WrittenPart
      attemptId={attemptId}
      action="submitRecommend"
      n={4}
      title="Recommend"
      hint="The CEO walks in. Give a top-down answer: lead with the call, back it with the numbers, then risks and next steps."
      placeholder={'Recommendation: …\n\nBecause:\n1. …\n2. …\n3. …\n\nRisks: …\nNext steps: …'}
      cta="Submit recommendation"
      minChars={40}
      rows={11}
    />
  )
}

// ------------------------------------------------------------------ Part 3

export function AnalyzePart({ attemptId, c }: { attemptId: string; c: CaseSummary }) {
  const [answer, setAnswer] = useState('')
  const [soWhat, setSoWhat] = useState('')
  const [calcOpen, setCalcOpen] = useState(false)
  const submit = useSubmit()
  return (
    <div className="space-y-3">
      <PartHeading n={3} title="Analyze" hint="The exhibit is open on the left. One submission, like the real interview." />
      <p className="font-medium">{c.analyzeQuestion}</p>
      <div>
        <div className="flex overflow-hidden rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            inputMode="decimal"
            placeholder="e.g. 12.5"
            aria-label="Your answer"
            className="h-10 min-w-0 flex-1 bg-transparent px-3 font-mono text-sm outline-none"
          />
          <span className="flex items-center border-l border-input bg-muted px-3 font-mono text-sm text-muted-foreground">
            {c.analyzeUnit}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Answers within 2% count as correct; within 10% earns half credit.</p>
      </div>
      <div>
        <label htmlFor="sowhat" className="text-sm font-medium">
          So what? <span className="font-normal text-muted-foreground">One sentence on what this means for the client.</span>
        </label>
        <Textarea
          id="sowhat"
          value={soWhat}
          onChange={(e) => setSoWhat(e.target.value)}
          rows={2}
          className="mt-1"
          placeholder="This means…"
        />
      </div>
      {calcOpen && <CalculatorDrawer />}
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => setCalcOpen((o) => !o)} aria-expanded={calcOpen}>
          <Calculator /> Calculator
        </Button>
        <Button
          onClick={() => submit.run('submitAnalyze', { attemptId, answer, soWhat })}
          loading={submit.busy}
          disabled={!answer.trim()}
        >
          {submit.busy ? 'Grading…' : 'Submit'}
        </Button>
      </div>
    </div>
  )
}
