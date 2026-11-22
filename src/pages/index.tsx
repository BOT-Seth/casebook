/**
 * Landing page — STATIC (no DeepSpace providers, prerendered at build).
 * Keep it renderable without a browser: no window/document during render.
 */

import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { seo } from '../seo'

const STEPS = [
  {
    n: '01',
    title: 'Write it up once',
    body: 'After you solve a problem, record the prompt, your approach, the complexity and the traps, in your own words. Or have the coach in the side panel draft it for you to edit.',
  },
  {
    n: '02',
    title: 'Explain it from memory',
    body: 'A drill shows only the prompt. You talk through the solution the way you would in the interview, before you see your notes.',
  },
  {
    n: '03',
    title: 'Get graded against your own notes',
    body: 'An AI coach compares your answer with what you wrote: what you covered, what you missed, and a suggested grade. You decide the grade.',
  },
  {
    n: '04',
    title: 'See it again at the right time',
    body: 'Forgotten cases come back in ten minutes. Solid ones wait days, then weeks. Your review queue is always the problems you are about to forget.',
  },
]

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div data-testid="static-landing" className="min-h-screen bg-background text-foreground">
        <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <span className="text-lg font-semibold tracking-tight">Casebook</span>
          <nav className="flex items-center gap-1 text-sm">
            <Link to="/library" className="rounded-md px-3 py-2 text-muted-foreground hover:text-foreground">
              Library
            </Link>
            <Link to="/home" className="rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground hover:opacity-90">
              Open app
            </Link>
          </nav>
        </header>

        <main className="mx-auto max-w-5xl px-6">
          <section className="py-16 sm:py-24">
            <p className="text-sm font-medium uppercase tracking-widest text-primary">For coding interviews</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
              You solved it last month. Can you still explain it?
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
              Casebook is a spaced-repetition notebook for the problems you have already solved. It makes you
              recall the approach out loud, has an AI coach check you against your own write-up, and brings
              each problem back right before you would forget it.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/home" className="rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground hover:opacity-90">
                Start your casebook
              </Link>
              <Link to="/library" className="rounded-lg border border-border px-5 py-3 font-medium hover:bg-accent">
                Browse shared cases
              </Link>
            </div>
          </section>

          <section className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
            {STEPS.map((s) => (
              <div key={s.n} className="bg-card p-6 sm:p-8">
                <p className="font-mono text-sm text-primary">{s.n}</p>
                <h2 className="mt-2 text-xl font-semibold">{s.title}</h2>
                <p className="mt-2 text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </section>

          <section className="py-16">
            <h2 className="text-2xl font-semibold tracking-tight">Why not just re-read your notes?</h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Re-reading feels productive and doesn’t stick. Retrieving the answer before you look does. Casebook is
              built around that one habit, and the chat panel can quiz you from your casebook as well.
            </p>
          </section>
        </main>

        <footer className="mx-auto max-w-5xl border-t border-border px-6 py-8 text-sm text-muted-foreground">
          Casebook · built on DeepSpace
        </footer>
      </div>
    </>
  )
}
