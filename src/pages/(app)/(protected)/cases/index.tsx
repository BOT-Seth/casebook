/**
 * My cases — everything in your casebook, searchable, with a way to add more.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutations } from 'deepspace'
import { BookOpen, Globe, Plus } from 'lucide-react'
import { Button, EmptyState, Input, Modal, SearchInput, useToast } from '@/components/ui'
import { DIFFICULTY_STYLE, newCaseRow, useCases } from '../../../../lib/cases'
import type { CaseRow } from '../../../../schemas/cases-schema'

export default function CasesPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { mine, status } = useCases()
  const { ready, createConfirmed } = useMutations<CaseRow>('cases')
  const { error } = useToast()
  const [query, setQuery] = useState('')
  const [pattern, setPattern] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const showNew = params.get('new') === '1'

  const patterns = useMemo(
    () => [...new Set(mine.map((c) => c.data.pattern).filter(Boolean))].sort(),
    [mine],
  )
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return mine.filter(
      (c) =>
        (!pattern || c.data.pattern === pattern) &&
        (!q || `${c.data.title} ${c.data.pattern} ${c.data.prompt}`.toLowerCase().includes(q)),
    )
  }, [mine, query, pattern])

  function closeNew() {
    setTitle('')
    params.delete('new')
    setParams(params, { replace: true })
  }

  async function createCase() {
    if (!title.trim()) return
    setCreating(true)
    try {
      // Confirmed: we navigate to the new id, so it must exist first.
      const id = await createConfirmed(newCaseRow({ title: title.trim() }))
      navigate(`/cases/${id}`)
    } catch (e) {
      error('Could not create the case', e instanceof Error ? e.message : String(e))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">My cases</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mine.length} {mine.length === 1 ? 'case' : 'cases'} · ask the coach in the chat to draft one for you
          </p>
        </div>
        <Button onClick={() => setParams({ new: '1' })} disabled={!ready}>
          <Plus /> New case
        </Button>
      </div>

      {mine.length > 0 && (
        <div className="mt-8 space-y-3">
          <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, pattern, prompt" />
          {patterns.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <Chip active={!pattern} onClick={() => setPattern(null)}>All</Chip>
              {patterns.map((p) => (
                <Chip key={p} active={pattern === p} onClick={() => setPattern(pattern === p ? null : p)}>
                  {p}
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}

      {status === 'loading' ? (
        <p className="mt-10 text-sm text-muted-foreground">Loading…</p>
      ) : mine.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={<BookOpen />}
          title="No cases yet"
          description="Write up a problem you have solved, add the starter set from Today, or save one from the Library."
          action={{ label: 'New case', onClick: () => setParams({ new: '1' }) }}
          secondaryAction={{ label: 'Open Library', onClick: () => navigate('/library') }}
        />
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
          {visible.map((c) => (
            <li key={c.recordId}>
              <Link to={`/cases/${c.recordId}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate font-medium">
                    {c.data.title}
                    {c.data.visibility === 'public' && <Globe className="size-3.5 text-muted-foreground" aria-label="In the Library" />}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.data.pattern || 'No pattern'} ·{' '}
                    <span className={DIFFICULTY_STYLE[c.data.difficulty] ?? ''}>{c.data.difficulty}</span>
                    {c.data.reps > 0 && ` · reviewed ${c.data.reps}×`}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {c.data.intervalDays ? `every ~${c.data.intervalDays}d` : 'new'}
                </span>
              </Link>
            </li>
          ))}
          {visible.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">No matches.</li>}
        </ul>
      )}

      <Modal open={showNew} onClose={closeNew} size="sm">
        <Modal.Header>
          <Modal.Title>New case</Modal.Title>
        </Modal.Header>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void createCase()
          }}
          className="space-y-4 pt-4"
        >
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Kth Largest Element in an Array" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={closeNew}>Cancel</Button>
            <Button type="submit" loading={creating} disabled={!title.trim() || !ready}>Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        active ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}
