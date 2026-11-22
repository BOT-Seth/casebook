# Casebook: Decision Log

A record of what we changed our minds on while scoping and building Casebook, and what each choice cost.
Newest decisions are added at the bottom. Started Nov 21, 2026.

**Casebook** is "LeetCode for case interviews." It's a practice platform for business majors preparing for consulting,
finance and PM case interviews, built on DeepSpace.

---

## 1. Product direction: coding interviews → business case interviews
- **Before:** my coding agent's first prototype was a spaced-repetition notebook for *coding* interview problems.
  It built that from a pitch I hadn't confirmed.
- **After:** Casebook is for *business* case interviews (profitability, market entry, M&A, pricing, market sizing).
- **Why:**
  - That was the actual idea behind the name.
  - The coding version overlapped two of DeepSpace's own example apps: Fluently (spaced repetition) and Dialogue
    (AI mock interviews).
- **Tradeoff:** we threw away a few hours of agent-written code. We kept the parts that carry over: auth, the app
  shell, the server-side AI pattern, and the repo.
- **Lesson:** I now scope with the agent first, agree on slices, and verify each slice before it builds the next.
- **One-liner:** "My agent built the wrong product fast. I stopped it, re-scoped, and switched to building in
  slices I approved one at a time."

## 2. Hosting: Vercel → DeepSpace (`<name>.app.space`)
- **Before:** I planned to host on Vercel.
- **After:** deploy with `npx deepspace deploy`.
- **Why:**
  - The brief requires deploying on DeepSpace.
  - The app runs on Cloudflare Workers and Durable Objects (the real-time database rooms), which Vercel can't run.
- **Tradeoff:** none in practice. One command ships the frontend, server and database together, with release
  history and rollback.

## 3. Interview format: free-form AI chat → structured, LeetCode-style parts
- **Before:** a continuous chat with an AI interviewer, up to 20 turns per case.
- **After:** each case is 4 parts you submit one at a time, graded against hidden checkpoints, like LeetCode's hidden
  test cases:
  1. Clarify: ask up to 3 questions.
  2. Structure: submit your framework.
  3. Analyze: submit the number from the exhibit.
  4. Recommend: submit your final recommendation.
- **Why:**
  - **Cost:** about 4–6 AI calls per case instead of about 20, so under 1¢ per case instead of about 2¢.
  - **Consistency:** each part is graded against a fixed rubric, so two people giving the same answer get the same
    result.
  - **Clarity:** users always know what to do next and where they lost points.
  - **Buildability:** a state machine with 4 states is easier to test and explain than an open-ended chat.
- **Tradeoff:**
  - Less realism. A real interviewer improvises follow-up questions; ours only does that in part 1.
  - Candidates can't take the conversation somewhere unexpected and get credit for a novel approach.
- **One-liner:** "I traded conversational realism for consistent grading and roughly a 75% cut in AI cost."

## 4. Math is graded by code, not by AI
- **Choice:** the numeric answer in part 3 (e.g. break-even volume, contribution margin) is checked by code against
  the right value, within a small tolerance (±2%). AI only grades the written interpretation.
- **Why:**
  - LLMs are unreliable at checking arithmetic.
  - A number is either right or wrong, so it should be graded exactly, for free.
- **Tradeoff:** every case needs a predefined answer. A candidate who computes a *different but valid* metric gets
  marked wrong on the number. The written interpretation is where that can still earn credit.

## 5. Hidden answers never reach the browser
- **Choice:**
  - Fact sheets, exhibit data, checkpoints and model answers live in server-only files.
  - The database rules (RBAC) let a user **read** their own attempts but **not write** them. Only server code
    advances a part, unlocks an exhibit, or records a score.
- **Why:**
  - If answers were in the page code, anyone could open dev tools and read them.
  - If users could write their own attempt records, they could skip parts or set their own score.
- **Tradeoff:** every state change goes through a server action. That's a network round trip, where a client-side
  write would update the screen faster.
- **One-liner:** "Security lives in the database layer, not the UI. I tested it by trying to cheat from the
  browser console."

## 6. No API keys: DeepSpace's AI proxy instead of my own Anthropic key
- **Choice:** call the model through DeepSpace's integration proxy (`createDeepSpaceAI`), rather than storing an
  API key in app secrets.
- **Why:** no key to manage, leak or rotate. Usage is metered per app.
- **Tradeoff:**
  - Tied to DeepSpace credits, at the provider's cost plus a platform markup.
  - Fewer model options: e.g. GPT-4o-mini isn't in the catalog.

## 7. Model: Claude Haiku 5.5
- **Choice:** `claude-haiku-5-5` for interviewer answers and grading.
- **Why:** it's the cheapest and fastest current model ($0.10 input / $0.50 output per million tokens). Grading
  against a fixed rubric doesn't need a frontier model.
- **Tradeoff:** a bigger model would give more nuanced feedback on writing quality. We'd revisit if grading quality
  turns out to be the weak point.

## 8. Who pays for AI: owner-pays, with a per-user daily cap
- **Choice:**
  - AI calls bill **my** DeepSpace credits.
  - The free plan includes 500 credits, which is $5 (100 credits = $1).
  - Each user is capped at a few cases per day.
- **Why:** reviewers and new users can try it with no setup. If calls were billed to them, anyone without credits
  would see the AI fail on their first try.
- **Tradeoff:** I carry the cost. $5 covers several hundred cases, and the cap stops one person from draining it.

## 9. Source control: GitHub as the app's permanent source
- **Choice:** the repo lives on GitHub (`BOT-Seth/casebook`), and DeepSpace deploys from that checkout.
- **Why:** the submission needs a public repository.
- **Tradeoff:** this choice is permanent. DeepSpace locks an app to one source at its first deploy. We lose
  DeepSpace's own workspace features, such as its built-in branches and activity feed.

## 10. Removed the generic AI chat panel
- **Choice:** removed the template's always-on chat dock.
- **Why:** the case workspace is the product. Two chat boxes on one screen would confuse users about which one is
  the interviewer.
- **Tradeoff:** we lose a general "ask the app anything" assistant. It isn't core to practising cases.

## 11. Scope cuts (deliberate)
| Cut | Why |
| --- | --- |
| Voice and video interviewer | Biggest cost and complexity. Text covers the skill being practised. |
| PDF upload of school casebooks | Copyright, and parsing reliability. |
| AI case generator | Generated cases have unverified numbers. Curated cases can be graded exactly. |
| Spaced repetition | Case interviews test skill, not memorizing answers. |
| Payments, mobile app | Not needed to prove the core loop. |

## 12. Three polished cases, plus a "coming soon" fade-out
- **Considered:** 3 full cases vs 6 (3 full + 3 shorter) so the list feels more like LeetCode.
- **Chose:** 3 fully built cases. Below them, a few faded "coming soon" rows show where the library is heading.
- **Why:** each case needs hand-checked numbers and hidden checkpoints. Three that grade correctly beat six that
  don't, and three is also fewer for me to know cold in an interview.
- **Tradeoff:** the library looks small. The faded rows say honestly that it's an early version, without faking
  content.

## 13. Discuss tab: per-case live discussion
- **Chose:** add a Discuss tab to each case, using DeepSpace's built-in messaging (`npx deepspace add messaging`):
  one channel per case, real-time, with reactions.
- **Why:** it's the clearest real multi-user, real-time feature in the app, and it mirrors LeetCode's Discuss.
- **Tradeoff:** DeepSpace's bundled messaging only supports public channels. Hiding Discuss until you've submitted
  (to avoid spoilers) is therefore a UI choice, not a server-enforced rule. Spoilers aren't a security issue, so
  that's acceptable.

## 14. Leaderboard
- **Chose:** a leaderboard of total best scores across cases.
- **How:** a separate `leaderboard` table that **only the server writes**, holding just display name and score.
  Everyone can read it.
- **Why a separate table:** individual attempts stay private (read-own). Only the summary is public. That's two
  different permission levels on purpose.
- **Tradeoff:** one more table to keep in sync. The server updates it whenever an attempt finishes.

## 15. Cases modeled on real interview cases, but written by us
- **Considered:** copying real cases from McKinsey/Bain/BCG practice pages and MBA casebooks (Wharton, Darden, Kellogg).
- **Chose:** each case follows the *format* of a real published case (question flow, exhibit type, math type), with
  our own company, facts and numbers. The app credits and links the original it's modeled on.
- **Why:**
  - The repo and app are public, so copying is redistribution of copyrighted material.
  - Some casebooks explicitly forbid it: Darden's says not to reproduce it or feed it into AI tools, and Kellogg's
    is internal-use only.
  - The DeepSpace brief bans using confidential material from a school.
- **Tradeoff:** the cases aren't word-for-word "real". We get a legally clean repo, numbers we fully control (so code
  can grade them exactly), and the realism of the real format.

## 16. Part 3 is one submission, with partial credit
- **Considered:** LeetCode's unlimited retries vs a real interview's one shot.
- **Chose:** one submission per attempt. Within ±2% earns full points (20), within ±10% half points (10), anything
  else zero. The correct answer and the worked math are shown right after.
- **Why:** an interview doesn't let you guess until you're right. Half credit rewards a rounding or one-step slip
  without rewarding a guess.
- **Tradeoff:** a typo costs you the part. You can always start a new attempt.

## 17. Kept the sidebar instead of the mockup's top bar
- **Chose:** kept the DeepSpace template's collapsible sidebar for navigation.
- **Why:** it already handles sign-in, the account menu, mobile and the theme toggle, and it collapses to give the
  split workspace full width. Rebuilding it as a top bar adds risk for no product gain.
- **Tradeoff:** slightly less "LeetCode-like" than the mockup.

## 18. Part 1 is scored by code, not by the AI
- **Chose:** the interviewer AI only reports *which facts it revealed*. Part 1's score is computed in code: the share
  of the case's 3 key facts your questions uncovered.
- **Why:** "were your questions good?" becomes a measurable, consistent question, and it costs no extra AI call. The
  AI also can't put invented facts on the board, because code maps its fact numbers to the hidden list.
- **Tradeoff:** a clever question that uncovers nothing *on the fact sheet* earns nothing. The fact sheet defines
  what's knowable.

## 19. Don't reveal which key facts you missed until the case is over
- **Chose:** after Part 1 you see "2 of 3 key facts uncovered", but not which one you missed.
- **Why:** naming the missed fact would hand you the answer before you've structured the problem.
- **Tradeoff:** less immediate feedback. You find out on the results page.

## 20. Generous AI output budget, plus one retry
- **Found:** Haiku 5.5 reasons before answering, and those tokens count toward the output limit. A 600-token limit
  truncated the JSON in testing.
- **Chose:** a 3,000-token limit and one automatic retry.
- **Tradeoff:** none on cost (you pay for tokens used, not the limit). A rare retry adds a few seconds.

## 21. Nothing auto-starts; a case begins when you press Start
- **Before:** opening a case page immediately created an attempt.
- **Chose:** an intro screen with a Start button. The attempt in progress is pinned in the URL.
- **Why:** auto-start created attempts just by browsing, which used up the daily cap and made the finished
  scorecard disappear on reload.
- **Tradeoff:** one extra click.

## 22. Writing the model answer at completion, instead of fetching it
- **Chose:** when Part 4 is submitted, the server copies the model answer and the key facts (found or missed) onto
  your attempt.
- **Why:** the page renders it like everything else, from the live record, and it physically isn't in the record
  before you finish. There's no separate "may I see the answer?" endpoint to secure.
- **Tradeoff:** if a model answer is edited later, old attempts keep the version they were graded against. That's
  arguably correct.

## 23. Deployed with GitHub as the app's source
- **Done:** the first `npx deepspace deploy` ran with `origin` set to `github.com/BOT-Seth/casebook`, so DeepSpace
  permanently treats that repo as the source (see decision #9).
- **Tradeoff:** DeepSpace's own workspace and branch features are off for this app. Deploys ship the local checkout,
  so commit first.

## 24. A claim token on each attempt, instead of trusting one read
- **Found (code review):** each action read the attempt, waited seconds for the AI, then wrote back the copy it had
  read. Two parallel requests could both pass the "right part" check. A slow Part 3 could even land *after* Part 4
  and reopen Part 3, so you could resubmit it with the answer showing.
- **Chose:** every action that grades first writes a `pending` marker with a random token and reads it back. It
  backs off if another request's token is there. After the AI call it re-reads the attempt and saves only if the
  attempt is still on the same part and still carries its token. It merges into that fresh copy, never the old one.
- **Verified:** 5 parallel "finish Part 1" calls → 1 scored, 4 refused ("Still grading…"), the attempt on Part 2,
  no leftover marker. This is a Playwright spec now.
- **Tradeoff:** it's not a true lock. Two requests whose writes interleave in the few milliseconds between write and
  read-back could both call the AI, though only one can save. A real lock means running the read-check-write
  inside one Durable Object call, which the SDK's action tools don't expose. A crashed request leaves the marker
  for up to 90 seconds, so that attempt shows "Still grading" until it expires.

## 25. An AI budget per attempt (10 calls), failures included
- **Found:** a failed AI call didn't use up your question or submission, so you could retry it for free, forever,
  on the owner's credits.
- **Chose:** each attempt counts its AI calls and stops at 10. A clean run uses 6. The other 4 are for retries
  after a real error.
- **Tradeoff:** someone very unlucky with errors has to start a new attempt. With the 8-per-day limit, one user
  costs the owner at most 80 Haiku calls a day (a couple of cents).

## 26. Leaderboard ranks your first attempt at each case, not your best
- **Found:** a finished case shows the model answer. With "best score" ranking, anyone could replay a case from
  the answer and get 100.
- **Chose:** the leaderboard uses your first completed attempt per case. Retries still count on your Progress page.
- **Tradeoff:** one bad first run stays on the board. That's also how a real interview works.

## 27. Each interviewer answer reveals at most 2 facts
- **Found:** "Tell me everything about the business" could reveal the whole fact sheet and max Part 1.
- **Chose:** code keeps at most 2 revealed facts per answer. The interviewer is told to ask for something more
  specific when a question is too broad.
- **Tradeoff:** a genuinely good two-part question can be cut short. With 3 key facts and 3 questions, the score is
  still reachable.

## 28. Numbers are read in the question's unit
- **Found:** "$18,000,000" on a "$M" question was read as 18,000,000 million and marked wrong. "$0.048M" on a
  dollar question failed to parse at all.
- **Chose:** `parseAnswer(input, unit)` understands k/m/b and "million". It reads a bare number on a $M question as
  millions when it's small ("18") and as dollars when it's a full figure ("18000000").
- **Tradeoff:** a bare answer between 100,000 and 1 million on a $M question would be read as dollars. No case's
  answer is anywhere near that range.
