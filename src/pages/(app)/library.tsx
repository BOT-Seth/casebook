/**
 * Library — every case someone chose to share. Readable signed out: the
 * RecordRoom's `'*': { read: 'published' }` rule is what lets the socket send
 * these rows (and nothing else) to an anonymous visitor.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthOverlay, useAuth, useMutations, useQuery, useUserLookup } from 'deepspace'
import { ChevronDown, Copy, Library as LibraryIcon } from 'lucide-react'
import { Button, EmptyState, SearchInput, useToast } from '@/components/ui'
import { contentOf, DIFFICULTY_STYLE, newCaseRow, type CaseRecord } from '../../lib/cases'
import type { CaseRow } from '../../schemas/cases-schema'

export default function LibraryPage() {
  const navigate = useNavigate()
  const { isSignedIn, userId } = useAuth()
  const { records, status } = useQuery<CaseRow>('cases', {
    where: { visibility: 'public' },
    orderBy: 'updatedAt',
    orderDir: 'desc',
  })
  const { ready, createConfirmed } = useMutations<CaseRow>('cases')
  const { getName } = useUserLookup()
  const { error } = useToast()
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [showAuth, setShowAuth] = useState(false)

  const cases = records as CaseRecord[]
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? cases.filter((c) => `${c.data.title} ${c.data.pattern}`.toLowerCase().includes(q)) : cases
  }, [cases, query])

  async function saveCopy(c: CaseRecord) {
    if (!isSignedIn) return setShowAuth(true)
    setSavingId(c.recordId)
    try {
      const id = await createConfirmed(newCaseRow(contentOf(c.data), c.recordId))
      navigate(`/cases/${id}`)
    } catch (e) {
      error('Could not save a copy', e instanceof Error ? e.message : String(e))
      setSavingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Library</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Cases people have shared. Save one to your casebook to drill it on your own schedule.
      </p>

      {cases.length > 0 && (
        <SearchInput className="mt-8" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the Library" />
      )}

      {status === 'loading' ? (
        <p className="mt-10 text-sm text-muted-foreground">Loading…</p>
      ) : cases.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={<LibraryIcon />}
          title="Nothing shared yet"
          description='Open one of your cases and turn on "Share in Library".'
        />
      ) : (
        <ul className="mt-6 space-y-3">
          {visible.map((c) => {
            const open = openId === c.recordId
            const own = c.createdBy === userId
            return (
              <li key={c.recordId} className="rounded-xl border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : c.recordId)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
                  aria-expanded={open}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.data.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.data.pattern || 'No pattern'} ·{' '}
                      <span className={DIFFICULTY_STYLE[c.data.difficulty] ?? ''}>{c.data.difficulty}</span>
                      {own ? ' · yours' : getName(c.createdBy) ? ` · by ${getName(c.createdBy)}` : ''}
                    </p>
                  </div>
                  <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && (
                  <div className="space-y-3 border-t border-border px-4 py-4 text-sm">
                    {(['prompt', 'approach', 'complexity', 'pitfalls'] as const).map((f) =>
                      c.data[f] ? (
                        <div key={f}>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{f}</p>
                          <p className="mt-1 whitespace-pre-wrap">{c.data[f]}</p>
                        </div>
                      ) : null,
                    )}
                    {own ? (
                      <Button size="sm" variant="outline" onClick={() => navigate(`/cases/${c.recordId}`)}>Edit</Button>
                    ) : (
                      <Button size="sm" onClick={() => saveCopy(c)} loading={savingId === c.recordId} disabled={isSignedIn && !ready}>
                        <Copy /> Save to my casebook
                      </Button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {showAuth && <AuthOverlay onClose={() => setShowAuth(false)} />}
    </div>
  )
}
