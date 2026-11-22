# Casebook

A spaced-repetition notebook for coding-interview problems, built on [DeepSpace](https://docs.deep.space).

You write up a problem you have solved once (prompt, approach, complexity, pitfalls). Later, a **drill** shows
only the prompt and you explain the solution from memory. An **AI coach** compares your answer with your own
write-up and tells you what you covered and what you missed, then suggests a grade. **You** pick the grade, and
an SM-2 scheduler decides when you see the case again: ten minutes if you blanked, days or weeks if it was solid.

Cases are private by default. Turn on **Share in Library** and anyone (even signed out) can read the case
and save a copy into their own casebook.

**Live:** https://casebook.app.space

## The main path

1. Sign in, then on **Today** click **Add 6 starter cases**. Or write your own, or save one from the **Library**.
2. Click **Start drill**. Read the prompt and type your approach from memory.
3. Click **Check with coach**. You'll see the verdict, what you covered and missed, and your saved answer.
4. Pick a grade. Each button shows the next interval it would schedule. The case moves to its new due date,
   and the attempt is logged on the case page and on Today.
5. Or use the chat panel instead: *"quiz me on something due"* → the assistant calls `cases_due`, asks you,
   grades you, and calls `review_case`.

## How it uses DeepSpace

| Piece | Where | Why |
| --- | --- | --- |
| **Collections + server-side RBAC** | `src/schemas/cases-schema.ts` | `cases` uses `read: 'published'` with `visibilityField: visibility = 'public'`. Members see their own cases plus public ones, signed-out visitors see only public ones, and only the author can edit. `attempts` are `read: 'own'` and can't be updated, so the review log is append-only. The Library page is a plain `useQuery` because the RecordRoom Durable Object filters rows before they leave the worker. |
| **Real-time records** | `useQuery` / `useMutations` throughout | Grading in one tab, or the chat assistant editing a case, updates every open view with no refetch code. The case editor saves one field at a time with merge `put`s, so concurrent edits to different fields don't overwrite each other. |
| **Server action** | `src/actions/index.ts` → `coachRecall` | Grades your answer on the server against your saved approach. Action tools run with RBAC off, so the action checks `createdBy === userId` itself before reading a case. |
| **AI through the integration proxy** | `src/server/coach.ts` | `createDeepSpaceAI` + `generateText` with a Zod `Output.object` schema, so the verdict is typed JSON, not parsed prose. The caller's JWT is forwarded, so **the person practising pays for their own coaching**, not the app owner. No provider API key lives in the app. |
| **AI chat dock with custom tools** | `src/ai/casebook-tools.ts`, `src/ai/tools.ts` | `cases_due` (withholds the saved approach so the model can quiz without spoiling it) and `review_case` (runs the same SM-2 function, so the model can't invent intervals). Both run through the user-scoped executor, so RBAC still applies to the assistant. The same tools are exposed to local coding agents through `npx deepspace agent invoke`. |
| **One scheduler, three callers** | `src/lib/srs.ts` + `srs.test.ts` | A pure function used by the drill page, the chat tool and the unit tests. |

### Integrations deliberately left out

- **Email or calendar reminders (Google / Composio):** the obvious next feature is a daily digest of due cases,
  using the cron room. I left it out because it needs per-user OAuth consent, and the review queue on Today
  already covers the loop. Adding it would add a sign-up hurdle without improving the core learning loop.
- **Yjs collaborative editing:** a case is short, structured fields written by one author. Field-level merge
  `put`s give live updates without CRDT text, which only pays off for long co-authored documents.
- **Payments, file uploads, managed knowledge base:** nothing in the product needs them. Cases are short text, and
  the coach only ever needs one case at a time, so retrieval adds nothing.

## Main tradeoff

**The AI suggests a grade, the human decides.** Letting the coach set the grade would make drills one click
faster. But an LLM grade on free text is noisy, and the whole value of spaced repetition is an honest schedule.
So the coach returns a structured verdict, the saved answer is revealed next to it, and the person chooses.
You can also skip the coach entirely ("Just show my answer"), so the app still works if the AI call fails or
costs too much.

A smaller one: the scheduler runs **client-side** in the drill page (with the same function on the server for
the chat tool) rather than in a server action. A user could fake their own schedule, but it's only their own
data, and that saves a round-trip on every grade.

## Running it

```sh
npm install
npx deepspace auth login
npx deepspace dev start        # http://localhost:5173
npm run test:unit              # SRS scheduler tests
npx deepspace deploy
```

## What's not done / next

- A daily due-cases email through the cron room and the `email/send` integration (see above).
- Pattern-level analytics: Today shows the most-forgotten pattern, but a per-pattern recall chart would be better.
- A Library moderation and report flow before sharing is opened to strangers at scale.
