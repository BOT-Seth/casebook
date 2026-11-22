/**
 * Casebook collections.
 *
 * `cases`    — one interview problem written up in your own words, plus its
 *              spaced-repetition schedule. Private by default; flipping
 *              `visibility` to 'public' lists it in the shared Library.
 * `attempts` — the review log: what you recalled, what the coach said, and the
 *              grade you gave yourself. Always private to the person drilling.
 *
 * RBAC is enforced in the RecordRoom Durable Object, not in the UI. The
 * Library page is just a `useQuery('cases', { where: { visibility: 'public' } })`
 * — the room only sends a signed-out visitor the rows the `'*'` rule allows.
 */

import type { CollectionSchema } from 'deepspace/schema'

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const
export const VISIBILITIES = ['private', 'public'] as const
export const GRADES = ['again', 'hard', 'good', 'easy'] as const

export type Difficulty = (typeof DIFFICULTIES)[number]
export type Visibility = (typeof VISIBILITIES)[number]
export type Grade = (typeof GRADES)[number]

export interface CaseRow {
  title: string
  pattern: string
  difficulty: Difficulty
  /** The problem statement — what the drill shows you. */
  prompt: string
  /** Your model answer — hidden during a drill, used by the coach to grade. */
  approach: string
  complexity: string
  pitfalls: string
  code: string
  visibility: Visibility
  /** recordId of the Library case this was saved from, if any. */
  forkedFrom: string
  // Spaced-repetition state (see src/lib/srs.ts).
  dueAt: string
  intervalDays: number
  ease: number
  reps: number
  lapses: number
  lastGrade: string
}

export interface AttemptRow {
  caseId: string
  caseTitle: string
  grade: Grade
  recall: string
  /** Coach verdict, if the drill was checked by the AI. */
  coachGrade: string
  covered: string[]
  missed: string[]
  feedback: string
  intervalDays: number
}

export const casesSchema: CollectionSchema = {
  name: 'cases',
  columns: [
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    { name: 'pattern', storage: 'text', interpretation: 'plain' },
    {
      name: 'difficulty',
      storage: 'text',
      interpretation: { kind: 'select', options: [...DIFFICULTIES] },
      default: 'medium',
    },
    { name: 'prompt', storage: 'text', interpretation: 'plain' },
    { name: 'approach', storage: 'text', interpretation: 'plain' },
    { name: 'complexity', storage: 'text', interpretation: 'plain' },
    { name: 'pitfalls', storage: 'text', interpretation: 'plain' },
    { name: 'code', storage: 'text', interpretation: 'plain' },
    {
      name: 'visibility',
      storage: 'text',
      interpretation: { kind: 'select', options: [...VISIBILITIES] },
      default: 'private',
    },
    { name: 'forkedFrom', storage: 'text', interpretation: 'plain' },
    { name: 'dueAt', storage: 'text', interpretation: { kind: 'datetime' } },
    { name: 'intervalDays', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'ease', storage: 'number', interpretation: 'plain', default: 2.5 },
    { name: 'reps', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'lapses', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'lastGrade', storage: 'text', interpretation: 'plain' },
  ],
  visibilityField: { field: 'visibility', value: 'public' },
  permissions: {
    // Signed-out visitors can browse the Library, nothing else.
    '*': { read: 'published', create: false, update: false, delete: false },
    viewer: { read: 'published', create: false, update: false, delete: false },
    // Members read their own cases plus every public one; only the author edits.
    member: { read: 'published', create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}

export const attemptsSchema: CollectionSchema = {
  name: 'attempts',
  columns: [
    { name: 'caseId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'caseTitle', storage: 'text', interpretation: 'plain' },
    {
      name: 'grade',
      storage: 'text',
      interpretation: { kind: 'select', options: [...GRADES] },
      required: true,
    },
    { name: 'recall', storage: 'text', interpretation: 'plain' },
    { name: 'coachGrade', storage: 'text', interpretation: 'plain' },
    { name: 'covered', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'missed', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'feedback', storage: 'text', interpretation: 'plain' },
    { name: 'intervalDays', storage: 'number', interpretation: 'plain' },
  ],
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    // A review log is history: you can add to it and clear it, not rewrite it.
    member: { read: 'own', create: true, update: false, delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
