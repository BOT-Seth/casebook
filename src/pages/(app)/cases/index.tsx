/**
 * Case list: the LeetCode-style problem table. Readable signed out; starting
 * a case needs an account. Status and best score come from the user's own
 * attempts (live subscription).
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthOverlay, useAuth } from 'deepspace'
import { CheckCircle2, CircleDashed, CircleDot, Clock } from 'lucide-react'
import { CASES, COMING_SOON, SOLVED_SCORE } from '../../../cases/catalog'
import { DIFFICULTY_STYLE, useMyAttempts } from '../../../lib/attempts'

export default function CaseListPage() {
  const { isSignedIn } = useAuth()
  const navigate = useNavigate()
  const { byCase } = useMyAttempts()
  const [showAuth, setShowAuth] = useState(false)
  const solved = CASES.filter((c) => byCase.get(c.id)?.solved).length

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <title>Cases · Casebook</title>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cases</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real interview formats. Four parts each, graded against hidden checkpoints.
          </p>
        </div>
        {isSignedIn && (
          <p className="text-sm text-muted-foreground">
            <span className="font-mono font-medium text-foreground">{solved}</span> / {CASES.length} solved
          </p>
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-12 px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Case</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Difficulty</th>
              <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Time</th>
              <th className="px-4 py-2.5 text-right font-medium">Best</th>
            </tr>
          </thead>
          <tbody>
            {CASES.map((c) => {
              const mine = byCase.get(c.id)
              return (
                <tr
                  key={c.id}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
                  onClick={() => (isSignedIn ? navigate(`/cases/${c.id}`) : setShowAuth(true))}
                >
                  <td className="px-4 py-3">
                    {mine?.solved ? (
                      <CheckCircle2 className="size-4 text-success" aria-label="Solved" />
                    ) : mine?.attempted ? (
                      <span title={`Attempted: solved at ${SOLVED_SCORE}+`}>
                        <CircleDot className="size-4 text-muted-foreground" aria-label="Attempted, not solved" />
                      </span>
                    ) : mine?.inProgress ? (
                      <CircleDashed className="size-4 text-warning" aria-label="In progress" />
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/cases/${c.id}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!isSignedIn) {
                          e.preventDefault()
                          setShowAuth(true)
                        }
                      }}
                      className="font-medium hover:underline"
                    >
                      {c.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{c.industry}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.type}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${DIFFICULTY_STYLE[c.difficulty]}`}>
                      {c.difficulty}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    <span className="inline-flex items-center gap-1 font-mono text-xs">
                      <Clock className="size-3.5" /> {c.estMinutes}m
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{mine?.attempted ? `${mine.best}` : '—'}</td>
                </tr>
              )
            })}
            {COMING_SOON.map((c, i) => (
              <tr
                key={c.title}
                className="border-b border-border last:border-0"
                style={{ opacity: Math.max(0.15, 0.55 - i * 0.12) }}
                aria-disabled
              >
                <td className="px-4 py-3" />
                <td className="px-4 py-3">
                  <span className="font-medium">{c.title}</span>
                  <p className="text-xs text-muted-foreground">Coming soon</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{c.type}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${DIFFICULTY_STYLE[c.difficulty]}`}>
                    {c.difficulty}
                  </span>
                </td>
                <td className="hidden px-4 py-3 sm:table-cell" />
                <td className="px-4 py-3" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showAuth && <AuthOverlay onClose={() => setShowAuth(false)} />}
    </div>
  )
}
