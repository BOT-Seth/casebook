/**
 * One case: edit the write-up, share it to the Library, see its review history.
 *
 * Fields save on blur with a merge `put` of just that field, so two tabs (or
 * the AI coach editing the same case) don't clobber each other's other fields.
 * Someone else's public case opens read-only, with "Save to my casebook".
 */

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutations, useQuery } from 'deepspace'
import { ArrowLeft, Brain, Copy, Trash2 } from 'lucide-react'
import { Button, ConfirmModal, Switch, Textarea, useToast } from '@/components/ui'
import { GradePill } from '../../../../components/casebook/GradePill'
import { contentOf, newCaseRow, useCases, type CaseRecord } from '../../../../lib/cases'
import { DIFFICULTIES, type AttemptRow, type CaseRow } from '../../../../schemas/cases-schema'

export default function CaseDetailPage() {
  const { id = '' } = useParams()
  const { all, status, userId } = useCases()
  const record = all.find((r) => r.recordId === id)

  if (status === 'loading') return <p className="p-12 text-sm text-muted-foreground">Loading…</p>
  if (!record) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-muted-foreground">This case doesn&apos;t exist or isn&apos;t shared with you.</p>
        <Link to="/cases" className="mt-4 inline-block text-sm underline">Back to my cases</Link>
      </div>
    )
  }
  return record.createdBy === userId ? <CaseEditor key={record.recordId} record={record} /> : <ReadOnlyCase record={record} />
}

function CaseEditor({ record }: { record: CaseRecord }) {
  const navigate = useNavigate()
  const { put, remove } = useMutations<CaseRow>('cases')
  const { records: attempts } = useQuery<AttemptRow>('attempts', {
    where: { caseId: record.recordId },
    orderBy: 'createdAt',
    orderDir: 'desc',
  })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const c = record.data
  const save = (field: keyof CaseRow) => (value: string) => {
    if ((c[field] ?? '') !== value) void put(record.recordId, { [field]: value } as Partial<CaseRow>)
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center justify-between gap-2">
        <Link to="/cases" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> My cases
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} aria-label="Delete case">
            <Trash2 />
          </Button>
          <Button size="sm" onClick={() => navigate(`/drill?case=${record.recordId}`)}>
            <Brain /> Drill this
          </Button>
        </div>
      </div>

      <Field
        value={c.title}
        onSave={save('title')}
        className="mt-6 w-full bg-transparent text-3xl font-semibold tracking-tight outline-none"
        placeholder="Problem title"
        single
      />

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <Field
          value={c.pattern}
          onSave={save('pattern')}
          className="w-56 rounded-md border border-input bg-transparent px-2 py-1 outline-none focus:ring-1 focus:ring-ring"
          placeholder="Pattern, e.g. Sliding window"
          single
        />
        <select
          value={c.difficulty}
          onChange={(e) => save('difficulty')(e.target.value)}
          className="rounded-md border border-input bg-transparent px-2 py-1"
          aria-label="Difficulty"
        >
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d} className="bg-background">{d}</option>
          ))}
        </select>
        <label className="ml-auto flex items-center gap-2 text-muted-foreground">
          <Switch
            checked={c.visibility === 'public'}
            onCheckedChange={(on: boolean) => save('visibility')(on ? 'public' : 'private')}
          />
          Share in Library
        </label>
      </div>

      <Section label="Prompt" hint="What the drill shows you.">
        <Field value={c.prompt} onSave={save('prompt')} rows={4} placeholder="State the problem in your own words." />
      </Section>
      <Section label="Approach" hint="Your model answer. Hidden during drills; the coach grades against it.">
        <Field value={c.approach} onSave={save('approach')} rows={6} placeholder={'1. …\n2. …'} />
      </Section>
      <Section label="Complexity">
        <Field value={c.complexity} onSave={save('complexity')} rows={2} placeholder="Time and space, with the reason." />
      </Section>
      <Section label="Pitfalls" hint="Edge cases and the bugs you made last time.">
        <Field value={c.pitfalls} onSave={save('pitfalls')} rows={3} />
      </Section>
      <Section label="Code">
        <Field value={c.code} onSave={save('code')} rows={8} className="font-mono text-xs" placeholder="Optional reference solution" />
      </Section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Review history{c.reps > 0 && ` · next in ~${c.intervalDays}d · ease ${c.ease}`}
        </h2>
        {attempts.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Not drilled yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {attempts.map((a) => (
              <li key={a.recordId} className="rounded-lg border border-border bg-card p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</span>
                  <GradePill grade={a.data.grade} />
                </div>
                {a.data.feedback && <p className="mt-2">{a.data.feedback}</p>}
                {(a.data.missed?.length ?? 0) > 0 && (
                  <p className="mt-1 text-muted-foreground">Missed: {a.data.missed.join('; ')}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          void remove(record.recordId)
          navigate('/cases')
        }}
        title="Delete this case?"
        description="The write-up and its schedule are removed. Review history stays in your log."
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  )
}

function ReadOnlyCase({ record }: { record: CaseRecord }) {
  const navigate = useNavigate()
  const { mine } = useCases()
  const { createConfirmed, ready } = useMutations<CaseRow>('cases')
  const { error } = useToast()
  const [saving, setSaving] = useState(false)
  const existing = mine.find((m) => m.data.forkedFrom === record.recordId)
  const c = record.data

  async function saveCopy() {
    setSaving(true)
    try {
      const id = await createConfirmed(newCaseRow(contentOf(c), record.recordId))
      navigate(`/cases/${id}`)
    } catch (e) {
      error('Could not save a copy', e instanceof Error ? e.message : String(e))
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link to="/library" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Library
      </Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">{c.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{c.pattern} · {c.difficulty}</p>
      <div className="mt-4">
        {existing ? (
          <Button variant="outline" onClick={() => navigate(`/cases/${existing.recordId}`)}>Open my copy</Button>
        ) : (
          <Button onClick={saveCopy} loading={saving} disabled={!ready}><Copy /> Save to my casebook</Button>
        )}
      </div>
      {(['prompt', 'approach', 'complexity', 'pitfalls', 'code'] as const).map((f) =>
        c[f] ? (
          <Section key={f} label={f[0].toUpperCase() + f.slice(1)}>
            <pre className={`whitespace-pre-wrap rounded-md border border-border bg-card p-3 text-sm ${f === 'code' ? 'font-mono text-xs' : 'font-sans'}`}>{c[f]}</pre>
          </Section>
        ) : null,
      )}
    </div>
  )
}

function Section({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-1.5 flex items-baseline gap-2">
        <h2 className="text-sm font-semibold">{label}</h2>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </section>
  )
}

/**
 * A text field that edits locally and saves on blur. While unfocused it
 * follows the live record, so edits from another tab or the coach show up.
 */
function Field({
  value,
  onSave,
  single,
  className,
  ...rest
}: {
  value: string
  onSave: (v: string) => void
  single?: boolean
  className?: string
  placeholder?: string
  rows?: number
}) {
  const [draft, setDraft] = useState(value ?? '')
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setDraft(value ?? '')
  }, [value])
  const common = {
    value: draft,
    onFocus: () => (focused.current = true),
    onBlur: () => {
      focused.current = false
      onSave(draft)
    },
    ...rest,
  }
  return single ? (
    <input {...common} className={className} onChange={(e) => setDraft(e.target.value)} />
  ) : (
    <Textarea {...common} className={className} onChange={(e) => setDraft(e.target.value)} />
  )
}
