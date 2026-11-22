/**
 * Landing page: STATIC (no DeepSpace providers, prerendered at build).
 * Keep it renderable without a browser: no window/document during render.
 *
 * Design direction
 * - Audience: business majors two weeks out from a consulting, banking or PM
 *   superday. They've read the casebook PDFs; what they lack is reps with
 *   feedback.
 * - Feel: a consulting deck, not a startup. Off-white paper, one deep navy,
 *   tables with right-aligned monospace numbers, thin rules. No gradients,
 *   no illustrations, no emoji.
 * - Signature element: the product itself. The hero shows a real case
 *   mid-flight (exhibit, stepper, a graded answer) rendered in code, so the
 *   first thing a visitor sees is exactly what they'll use.
 * - Voice: plain, specific, numbers over adjectives. Say how grading works.
 */

import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { seo } from '../seo'
import { CASES, PARTS } from '../cases/catalog'

const GRADING: Record<string, { you: string; graded: string }> = {
  clarify: {
    you: 'Ask the interviewer up to three questions.',
    graded: 'Code counts how many of the case’s key facts your questions uncovered.',
  },
  structure: {
    you: 'Lay out your framework or issue tree.',
    graded: 'An AI interviewer checks it against hidden checkpoints, one by one.',
  },
  analyze: {
    you: 'Read the exhibit, compute one number, say what it means.',
    graded: 'The number is checked exactly by code (±2%). The “so what” by the AI.',
  },
  recommend: {
    you: 'Give the CEO a top-down answer.',
    graded: 'The right call, supported by numbers, with risks and next steps.',
  },
}

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div data-testid="static-landing" className="min-h-screen bg-background text-foreground">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2 text-[17px] font-semibold tracking-tight">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary font-mono text-sm text-primary-foreground">
              C
            </span>
            Casebook
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link to="/leaderboard" className="hidden rounded-md px-3 py-2 text-muted-foreground hover:text-foreground sm:block">
              Leaderboard
            </Link>
            <Link to="/cases" className="rounded-md bg-primary px-3.5 py-2 font-medium text-primary-foreground hover:opacity-90">
              Open the casebook
            </Link>
          </nav>
        </header>

        <main>
          {/* Hero */}
          <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1fr_1.1fr] lg:pt-16">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Consulting · Finance · Product
              </p>
              <h1 className="mt-4 text-[2.6rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl">
                LeetCode for case interviews.
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Work real interview-format business cases, one part at a time. Every part is graded against hidden
                checkpoints, the way an MBB interviewer would score you, and your math is checked exactly.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to="/cases"
                  className="rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground shadow-sm hover:opacity-90"
                >
                  Start a case
                </Link>
                <span className="text-sm text-muted-foreground">Free. About 25 minutes a case.</span>
              </div>
            </div>
            <ProductPreview />
          </section>

          {/* How you're graded */}
          <section className="border-y border-border bg-card">
            <div className="mx-auto max-w-6xl px-6 py-16">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Graded like the real thing.</h2>
                <p className="mt-3 text-muted-foreground">
                  A case is four parts, worth 100 points. Nothing is graded on vibes: each part has a fixed rubric you
                  see once you&apos;ve answered.
                </p>
              </div>
              <div className="mt-10 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="py-3 pr-6 font-medium">Part</th>
                      <th className="py-3 pr-6 font-medium">You</th>
                      <th className="py-3 pr-6 font-medium">How it&apos;s graded</th>
                      <th className="py-3 text-right font-medium">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PARTS.map((p) => (
                      <tr key={p.n} className="border-b border-border last:border-0 align-top">
                        <td className="py-4 pr-6">
                          <span className="font-mono text-xs text-muted-foreground">0{p.n}</span>{' '}
                          <span className="font-semibold">{p.label}</span>
                        </td>
                        <td className="py-4 pr-6">{GRADING[p.key].you}</td>
                        <td className="py-4 pr-6 text-muted-foreground">{GRADING[p.key].graded}</td>
                        <td className="py-4 text-right font-mono tabular-nums">{p.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* The cases */}
          <section className="mx-auto max-w-6xl px-6 py-16">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Three cases, built to be graded.</h2>
                <p className="mt-3 text-muted-foreground">
                  Original cases in the formats McKinsey, Bain and MBA casebooks use. Every number is hand-checked, so the
                  math can be marked right or wrong.
                </p>
              </div>
              <Link to="/cases" className="text-sm font-medium underline-offset-4 hover:underline">
                See all cases →
              </Link>
            </div>
            <ol className="mt-8 divide-y divide-border border-y border-border">
              {CASES.map((c, i) => (
                <li key={c.id}>
                  <Link to={`/cases/${c.id}`} className="grid gap-2 py-5 sm:grid-cols-[3rem_1fr_auto] sm:items-baseline hover:bg-muted/40">
                    <span className="font-mono text-sm text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                    <span>
                      <span className="text-lg font-semibold">{c.title}</span>
                      <span className="mt-1 block max-w-3xl text-sm leading-relaxed text-muted-foreground">{c.prompt}</span>
                    </span>
                    <span className="font-mono text-xs text-muted-foreground sm:text-right">
                      {c.type} · {c.difficulty}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        </main>

        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-sm text-muted-foreground">
            <span>Casebook. Built on DeepSpace.</span>
            <span>Cases are original, modeled on published practice-case formats.</span>
          </div>
        </footer>
      </div>
    </>
  )
}

/**
 * The hero visual: a static, code-rendered slice of the real workspace,
 * mid-case. Same tokens as the app, so it can't drift into a fake mockup.
 */
function ProductPreview() {
  const rows: Array<[string, string, string, boolean?]> = [
    ['Product cost', '72.0%', '72.2%'],
    ['Shrink (spoilage + theft)', '2.6%', '3.3%'],
    ['Distribution & logistics', '3.2%', '4.0%'],
    ['Store labor', '11.5%', '11.6%'],
    ['Net margin', '2.4%', '0.9%', true],
  ]
  const steps = ['Clarify', 'Structure', 'Analyze', 'Recommend']
  return (
    <div aria-hidden className="relative">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-2xl shadow-primary/15">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[15px] font-semibold">Harvest Lane Markets</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Profitability · Easy</p>
          </div>
          <span className="rounded-full border border-border px-2.5 py-0.5 font-mono text-xs">
            Score <span className="font-semibold">57</span>/70
          </span>
        </div>

        <ol className="mt-4 flex items-center gap-2">
          {steps.map((s, i) => (
            <li key={s} className="flex flex-1 items-center gap-2">
              <span
                className={
                  i < 3
                    ? 'flex size-6 items-center justify-center rounded-full bg-success text-[11px] font-semibold text-success-foreground'
                    : i === 3
                      ? 'flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground'
                      : 'flex size-6 items-center justify-center rounded-full border border-border text-[11px] text-muted-foreground'
                }
              >
                {i < 3 ? '✓' : i + 1}
              </span>
              <span className={i === 3 ? 'text-xs font-semibold' : 'hidden text-xs text-muted-foreground sm:inline'}>{s}</span>
              {i < steps.length - 1 && <span className={i < 3 ? 'h-px flex-1 bg-success' : 'h-px flex-1 bg-border'} />}
            </li>
          ))}
        </ol>

        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <p className="border-b border-border px-3 py-2 text-xs font-semibold">Exhibit 1: Cost structure, % of revenue</p>
          <table className="w-full text-xs">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">Cost line</th>
                <th className="px-3 py-1.5 text-right font-medium">FY23</th>
                <th className="px-3 py-1.5 text-right font-medium">FY25</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, a, b, bold]) => (
                <tr key={label} className={bold ? 'border-t border-border bg-muted/40 font-semibold' : 'border-t border-border'}>
                  <td className="px-3 py-1.5">{label}</td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums">{a}</td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 rounded-lg border border-success/40 bg-success/5 px-3 py-2.5 text-xs">
          <p>
            <span className="font-semibold">Part 3: Analyze</span>{' '}
            <span className="font-mono">30/30</span>
            <span className="text-muted-foreground"> · Correct: $18M</span>
          </p>
          <p className="mt-1 text-muted-foreground">
            (0.7% shrink + 0.8% distribution) × $1.2B = $18.0M, the entire margin decline.
          </p>
        </div>
      </div>
      <div className="absolute -bottom-4 -left-4 hidden rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-sm sm:block">
        <span className="text-muted-foreground">Interviewer:</span> “Fresh deliveries went from daily to 3× a week.”
      </div>
    </div>
  )
}
