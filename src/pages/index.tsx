/**
 * Landing page: STATIC (no DeepSpace providers, prerendered at build).
 * Keep it renderable without a browser: no window/document during render.
 * Placeholder copy for slice 1; the real landing page is slice 6.
 */

import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { seo } from '../seo'

const PARTS = [
  { n: '01', title: 'Clarify', body: 'Ask the interviewer the questions that uncover what matters.' },
  { n: '02', title: 'Structure', body: 'Lay out your framework. It is graded against hidden checkpoints.' },
  { n: '03', title: 'Analyze', body: 'The exhibit unlocks. Do the math: your number is checked exactly.' },
  { n: '04', title: 'Recommend', body: 'Give a top-down answer with reasons, risks and next steps.' },
]

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div data-testid="static-landing" className="min-h-screen bg-background text-foreground">
        <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <span className="text-lg font-semibold tracking-tight">Casebook</span>
          <Link to="/cases" className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            Browse cases
          </Link>
        </header>
        <main className="mx-auto max-w-5xl px-6">
          <section className="py-16 sm:py-24">
            <p className="text-sm font-medium uppercase tracking-widest text-primary">Consulting · Finance · PM</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
              LeetCode for case interviews.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
              Practice real interview-format business cases. Submit each part and get graded against hidden
              checkpoints, the way a McKinsey, BCG or Bain interviewer would score you.
            </p>
            <Link to="/cases" className="mt-8 inline-block rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground hover:opacity-90">
              Start a case
            </Link>
          </section>
          <section className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
            {PARTS.map((p) => (
              <div key={p.n} className="bg-card p-6">
                <p className="font-mono text-sm text-primary">{p.n}</p>
                <h2 className="mt-2 text-lg font-semibold">{p.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{p.body}</p>
              </div>
            ))}
          </section>
        </main>
        <footer className="mx-auto mt-16 max-w-5xl border-t border-border px-6 py-8 text-sm text-muted-foreground">
          Casebook · built on DeepSpace
        </footer>
      </div>
    </>
  )
}
