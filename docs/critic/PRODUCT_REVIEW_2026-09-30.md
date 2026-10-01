# MeritLaunch — Critical Product Review, 2026-09-30

Seven critics, each assuming MeritLaunch is **not yet** a professional, category-leading product and
setting out to prove it with evidence. Live site (read-only) plus isolated local builds on ports
5890–5902, headless-Chrome harness at 390px and 1440px, axe, keyboard walks, throttled-phone runs, and
code reads. No accounts were created, nothing was submitted, and no paid API was called. Raw evidence
is in the session scratchpad (`critic1/` … `critic7/`).

**Bottom line:** the landing page sells a premium, honest, student-first product. Behind it, the
product is not yet safe to market. Three security holes let anyone take Premium or the AI bill for
free. Matching recommends scholarships students can't apply for. Pricing and landing numbers say things
that aren't true. And the app falls apart on a phone and on a keyboard. Every one of these is
fixable, most in a day or less, and the critics agree on what to protect.

---

## 1. Scorecard (rubric anchors 1–10)

| # | Lens | Score | Gap to 9: what closes it |
|---|---|---|---|
| 1 | Visual design and brand | **5** | Bring the landing's craft into the app: phone grids, designed loading and empty states, one icon set, 2 colours plus a danger colour, a type scale, a brand mark |
| 2 | Information architecture and layout | **4.5** | URL routing, nav grouped by the student's goals (5–6 items), a "your next step" dashboard, every "free start" button going to the same place |
| 3 | Core task flow | **4** | Eligibility filtering before scoring, deadlines on match cards, work that survives a reload, letters that answer the real essay prompt |
| 4 | Trust, integrity and copy | **4** | Every number derived from data and checkable, a privacy policy that matches behaviour, an honest AI-policy step, link-checked chips |
| 5 | Accessibility and mobile | **4** | Keyboard-usable picker and dialogs, labelled fields, `textDim` contrast above 4.5:1, an inert hidden menu, stacking grids |
| 6 | Performance and technical quality | **4** | Server-built AI requests, immutable caching, no phone video download, a single scholarship fetch, split views, robots and sitemap |
| 7 | Conversion and commercial readiness | **4** | Truthful plan cards from one `PLANS` constant, server-enforced limits, a funnel you can measure, a paywall that shows the student's own work, a parent-pay path |

**Composite ≈ 4.2 / 10.** Every lens scored 4 to 5. That's a consistent signal: the foundation is
real, but launch-grade polish and safety aren't there yet.

---

## 2. Blockers (fix before any marketing push)

Each blocker has a check that would catch it again.

**B1. Anyone signed in can make themselves Premium for free.** *(verified by the lead in Supabase)*
RLS policy "Users can update own profile" (`auth.uid() = id`) has no column limit, and the
`authenticated` role holds column-level UPDATE on `subscription_status`, `seasonal_expires_at` and
`letters_used_this_month`. There's no guard trigger. The public anon key plus the user's own JWT is
enough to set `premium`.
*Fix:* `REVOKE UPDATE (subscription_status, seasonal_expires_at, stripe_customer_id,
letters_used_this_month, matches_used_this_month, usage_reset_at) ON user_profiles FROM
authenticated, anon;`. Only the service role (webhook and API) writes them.
*Check:* a SQL test that an authenticated `UPDATE … SET subscription_status='premium'` fails.

**B2. The AI endpoints are an open Claude proxy, and the limits exist only in the browser.** (C3, C4, C6, C7)
`api/generate-stream.js:19` sends `{...req.body, stream:true}` and `api/generate.js:24` forwards
`req.body`. The browser chooses the model, `max_tokens` and the **system prompt**, including the
"don't invent experiences" guardrails. The endpoints never read plan or usage, and the counters are
written client-side (`App.jsx:741-751`).
*Fix:* the server accepts `{scholarship, profile fields, templateId, essayPrompt, wordLimit}`, builds
the prompt, locks the model and token cap, checks the plan and usage with the service key, returns
402 when over the limit, and increments only after a successful generation.
*Check:* an API test that `req.body.system` and `req.body.model` are ignored and that a free user's
3rd letter returns 402.

**B3. Matching recommends scholarships the student is barred from.** (C3)
"White/Caucasian" contains "asian", so the heritage substring check (`App.jsx:~352`) matches white
students. The test profile Jenna (white, Iowa) gets **Gates #1 (90)** and **Ron Brown #2 (70)**. A
Toronto international student gets the same. 1,297 of 1,297 scholarships "match", and 542 of them
score only on "Strong GPA". Citizenship, state, GPA floor and graduation year are never used to exclude.
*Fix:* an `eligible()` pass before `scoreMatch`: citizenship, state (the field is already loaded at
`:118`), GPA minimum, heritage matched on whole tokens, and graduation level.
*Check:* a fixture test over the 5 `test-profiles/` with 0 ineligible scholarships in any top 20.

**B4. The pricing cards state things that aren't true.** (C7, C4, C3)
Free shows "3 AI matches / 1 AI letter" (`App.jsx:2140-2141`), but the code allows 5 and 2 (`:728`)
and the modal says 5 and 2. Seasonal sells "Batch letter generation" (no code), "Application tracker"
(free to everyone, `:2835`) and "Priority support" (nothing behind it). Free crosses out "Advanced
templates" and "Deadline alerts", which every user gets (`:3157`, `deadline-alerts.js:82-86`).
*Fix:* one `PLANS` constant renders the landing cards, the modal and the sidebar, listing only real,
gated differences: unlimited matches, 50 letters a month, URL import, and the 4-month window.
*Check:* a unit test that the card numbers equal `FREE_LIMITS` and `PRO_LIMITS`.

**B5. The landing numbers are fabricated or unstable.** (C1, C2, C4, C5, C6)
"Last Database Refresh" is `new Date()` on page load (`App.jsx:1059`). It isn't a refresh date, and
because it uses UTC it showed **"Oct 1" on Sep 30**. Before the data loads, the page shows "Browse 30
Scholarships", "30 scholarships loaded" and "Feb 11", which come from the built-in fallback. The
"$11.5M+" figure (verified by the lead on Aug 31 from the live table, about $11.56M across 912
listings) has no script in the repo that reproduces it.
*Fix:* `scripts/stats.mjs` computes the count, the award total and the newest `link_verified_at` from
Supabase and writes `public/stats.json`. The landing reads that file and shows a skeleton until it
loads, never the 30 built-ins as a count. Label the date "Listings last checked."
*Check:* the harness shows the same count and date across 3 loads, and the date is never later than today.

**B6. Keyboard users can't pick a scholarship or use the sign-up box.** (C5)
The Letter Gen combobox (built Aug 31) has mouse-only `div` options, no arrow keys and no ARIA. In
the keyboard test, typing "gates", then ArrowDown, then Enter selected nothing. The auth modal
(`App.jsx:1690`) has no dialog role, no focus trap and no Escape. Sign in, Forgot password, Terms and
Privacy are `span`s with tabIndex -1, so a student can't read the Terms before agreeing.
*Fix:* an ARIA 1.2 combobox (listbox and option roles, `aria-activedescendant`, arrow keys, Enter,
Escape), one shared `Modal` (focus trap, Escape, focus return, labelled title), and every clickable
`span` turned into a `button`.
*Check:* the keyboard walk script (`critic5/kb.mjs`) selects a scholarship and reaches Terms.

**B7. The privacy policy says false things, and minors give more data than matching needs.** (C3, C4)
The policy says birth date is "checked once and discarded" (`legalContent.js:25`), but `birthYear`
is saved to localStorage and to `profile_data`. It promises an opt-out "from your account settings"
(no such setting exists), and alert emails have no unsubscribe link. Name, phone, location and school
are collected but not listed. Resend and Vercel aren't named as data processors. Phone and email are
asked on step 1, matching never uses them, and they're sent to Anthropic in the profile prompt
(`:1503-1509`). The birth-year gate can be bypassed by leaving it blank (`isUnder13("")` is false),
and a birth-year-only check lets some 12-year-olds through.
*Fix:* drop phone, strip contact fields from every prompt, ask birth year alone first and treat a
blank or borderline year as under 13, save only the derived 13+ flag, rewrite "What we collect",
"Who we share with" and "Your choices" to match, and add an email opt-out toggle plus an unsubscribe
link.
*Check:* a prompt-audit test showing 0 contact fields; the policy diffed against the field list.

---

## 3. Majors, ranked by impact on finishing and on trust

**Finishing the core flow**
1. **Match cards have no deadline, and expired scholarships rank first.** Gates (past due) sits at #1
   with "Generate Letter" (C2, C3). Show the `parseDeadline` chip, sort expired below live, offer
   "Track for next year", and group into Due soon / Later / Rolling.
2. **Progress is lost on reload.** `matchResults`, `bragSheet` and drafts live only in memory, and
   re-running costs one of the free monthly matches (C3). Persist them like `scholarbot-answers`.
3. **The wizard's main button leads to an account wall.** On step 4 the primary button is "Generate
   AI Profile", which asks for sign-up, while matching is a secondary button (C2, C3). Make "See my
   matches" the primary button.
4. **Letters ignore the real essay question.** They're fixed at 350–450 words and use criteria text
   only (`:1366, :1428`) (C3). Add essay-prompt and word-limit fields plus a "thin profile" check.
5. **Streaming can drop words** when an SSE event is split across chunks (`:1461-1475`), and the
   student is still charged (C3). Buffer the partial line.
6. **Two "free" buttons lead to different places.** The hero goes to the profile; the nav and closing
   buttons go to sign-up (C2). Route them all to the profile.

**Trust and integrity**
7. **The letter prompt is partly framed around passing as human.** It says "writing AS the student"
   and gives "reads as machine-generated" as a reason (`:1383, :1404`). No step asks whether the
   scholarship allows AI help (C4). Rewrite it as a draft for the student to revise, keep the cliché
   bans as quality rules, and add an AI-policy step (KEM-3).
8. **Dead links look live.** `link_status` and `link_verified_at` are never shown, the built-in list
   marked "verified" contains 16 expired rows, and National Merit shows "1d left" with no application
   (C4). Add a "Link checked {date}" chip, flag dead links, and fix the National Merit row.
9. **The founder byline uses a job title.** "Parent, Educator & Creator" breaks the copy rule, and
   "Most Popular" and "Everything you need to win" can't be supported (C4, C7). Change the byline to
   "Parent and creator of MeritLaunch".

**Commercial**
10. **The funnel can't be seen.** Only 3 events are tracked, with none for profile completed, matches
    run, upgrade shown, checkout started or done, or portal opened (C7). Add 7 named events.
11. **The paywall is a dead end.** "You've hit your free limit" shows nothing of the student's own
    matches, deadlines or draft, and there's no parent hand-off (C7). See KEM-5 and KEM-6.
12. **Retention is silent.** A failed payment is only logged, Seasonal expires on read without
    warning, and the Resend domain is still unverified (C7).
13. **There is no social proof** beyond the founder's story (C7). Collect consented outcomes from the
    E2E and first cohort.

**Layout, accessibility and technical**
14. **Phone grids never stack.** `repeat(4,1fr)` at `:2371, :2434`, `1fr 1fr` at `:2493, :2958,
    :3257, :3276`, and `repeat(5,1fr)` at `:3352` are inline styles the 768px rules can't override.
    "SCHOLARSHIPS" is cut to "SCHOLAR", and Quick Actions is clipped by the root's `overflow:hidden`
    (C1, C2, C5).
15. **There is no URL routing.** Every return lands on the marketing page, Back leaves the site, and
    nothing can be deep-linked (C2, C6).
16. **Navigation follows tools, not the student's goals.** There are 9 items; "Saved" means letters
    while "Tracker" holds saved scholarships, and "Templates" duplicates part of Letter Gen. The
    dashboard has 8 cards and no next step, plus jargon such as "scoring engine" and "persona" (C2).
17. **`textDim` #555566 measures 2.74:1** (64 uses; axe finds 1,985 failing nodes on search), and the
    field border measures 1.17:1 (C1, C5). Raise them to about #8a8a9a and #4a4a66.
18. **Fields aren't tied to their labels.** The wizard has no `htmlFor`/`id`, the sign-up form relies
    on placeholders, and the chips have no `aria-pressed` (C3, C5).
19. **The hidden phone menu stays in the tab order** at x=-240, and the ☰ button has no name or
    expanded state (C5).
20. **The open proxy aside, the technical layer leaks performance.** Phones download the 751 KB video
    that CSS hides. The scholarship table downloads twice (1.15 MB) on slow connections. Hashed
    assets are sent with `max-age=0`. robots.txt and sitemap.xml return 404. The entry bundle is
    132 KB gzip from one 3,503-line file with 405 inline styles and no tests (C6). Throttled phone
    LCP median is **5.8 s**.
21. **The visual system drifts.** There are three icon systems (SVG, emoji ✍🔬🎯💪, Unicode ◇▫▦) and
    seven or more hues (with `purple` aliased to teal, `orange` to gold and `pink` to red, plus
    literal violet and green). There are 30 font sizes. The empty-state `margin:"0 auto 24"` bug (no
    unit) breaks every empty state (C1, C2).

**Minor:** graduation-year options are 2025–2028 (C2, C3); Browse renders 1,297 cards at once (C2);
fonts load twice (C1); `www` redirects with a 307 (C6); the checkout `success_url` comes from the
`Origin` header (C6); Seasonal shows as "premium" right after checkout (C7); "5 matches" reads as
five scholarships when it means five match runs (C7); the hero video ignores reduced motion; toasts
have no `role=status` (C5).

---

## 4. Experience-moments plan (8 briefs, deduplicated from the critics)

| KEM | Moment | Today | The moment | Lane |
|---|---|---|---|---|
| 1 | **First match that's truly mine** | White Iowa student sees Gates #1; every scholarship "matches" | 10–25 eligible matches, each with "Why you fit" and "Due Nov 18 · 49 days" | L1 |
| 2 | **Value before the wall** | The wizard ends at sign-up | "See my matches" shows a list immediately, then "Save these and get reminders" | L3 |
| 3 | **Honest about AI before the first letter** | No AI-policy step; prompt framed around passing | A card: "Some scholarships limit AI help. Check theirs." with "Draft for me" or "Outline and questions" | L0, L3 |
| 4 | **The letter answers *their* question** | Fixed 350–450 words, criteria only | Paste the essay prompt and word limit; "You haven't told us about service yet. Add one detail?" | L3 |
| 5 | **Numbers a parent can check** | 30 or 1297, a made-up "Oct 1" date, fake plan features | One steady count, a real "Listings last checked" date, "How we count", true plan cards | L2 |
| 6 | **The paywall that shows your own work** | Generic "You've hit your free limit" | "4 strong matches due before Dec 1; 2 still need a letter," both plans, and "Send to a parent" | L2, L5 |
| 7 | **Deadlines become this week's plan** | Tracking adds a row, with no dates on matches | "3 due before Nov 30: start Horatio Alger this week" on the dashboard | L5 |
| 8 | **The season recap that earns renewal** | Silent expiry; failed payments logged | 7 days before the end: letters drafted, applications submitted, deadlines ahead; a kind email if a payment fails | L0 |

All 8 pass the product rules. The student stays the author, nothing is invented, no student data
goes into URLs or is shared, the numbers come from data, and the under-13 gate stays in place.

---

## 5. Build lanes (worktree-sized, no shared files)

`src/App.jsx` is one 3,503-line file, so **Lane 0.5 (extraction) must run first** to make parallel
lanes possible. After that, each lane owns its own files.

| Lane | Owns | Contents | Blockers closed |
|---|---|---|---|
| **L0 Security and server** | `api/generate*.js`, `api/_shared/*`, a Supabase migration, `api/stripe-webhook.js`, `api/deadline-alerts.js` | Column REVOKE, server-built prompts (with the honest-AI rewrite), fixed model and token cap, server-side usage and 402, a `payment_failed` email, plan filtering on alerts, unsubscribe | B1, B2, half of B7 |
| **L0.5 Extraction (first)** | new `src/views/*`, `src/lib/*` | Move `Landing`, `scoreMatch`, `parseDeadline`, `PLANS`, `Modal` and `AppIcon` out of App.jsx with no behaviour change; add Vitest | enables L1–L5 |
| **L1 Matching** | `src/lib/matching.js` and its tests | `eligible()`, whole-token heritage matching, state, GPA floor and citizenship; fixture tests from `test-profiles/` | B3 |
| **L2 Truth layer** | `scripts/stats.mjs`, `public/stats.json`, `src/views/Landing*`, `src/lib/plans.js` | Stats pipeline, skeleton loading, the `PLANS` constant across cards, modal and sidebar, byline, link-checked chips, National Merit fix, privacy-policy rewrite | B4, B5, half of B7 |
| **L3 Flow** | `src/views/Profile*`, `src/views/Generate*` | Birth year first, drop phone, primary "See my matches", localStorage persistence, essay prompt and word limit, AI-policy card, ARIA combobox, SSE buffer, graduation years | B6 (picker), half of B7 |
| **L4 Design system and accessibility** | `src/lib/tokens.js`, `src/components/*`, global CSS | `textDim` and border contrast, a type scale, palette roles, one icon set, the empty-state fix, the shared `Modal` (B6 auth), labels and `aria-pressed`, inert menu, stacking grid classes | B6 (modal) |
| **L5 IA and routing** | `src/router.js`, `src/views/Dashboard*`, `src/views/Matches*`, nav | URL routing, a 5–6 item goal-based nav, the "next step" dashboard, match deadlines and grouping, Browse paging, the funnel events, the in-app paywall | — |
| **L6 Performance and SEO** | `vercel.json`, `public/robots.txt`, `public/sitemap.xml`, `index.html`, `src/main.jsx` | Immutable cache headers, robots and sitemap, video only at 768px and up, an in-flight fetch guard, 308 redirect, font dedupe, a `success_url` allowlist | — |

**Order:** start **L0** immediately; it doesn't touch App.jsx and closes the money holes. Run
**L0.5** next. Then **L1–L6** in parallel worktrees. Re-run the harness and each critic's lens after
every merge, and close a finding only when its measurement moves.

---

## 6. Protect list (all 7 critics agree)

- **The landing art direction and story order:** Instrument Serif with the gold italic, the single
  gold CTA, the photo hero, then three steps, the letter demo, the founder story, the plans and the
  final CTA.
- **The editorial story spread** (5fr/7fr with the real photo and pull quote).
- **The live letter demo and the cream letter-paper panel**, including the reduced-motion fallback.
- **The letter system prompt's guardrails:** "Do not invent experiences", write around missing
  criteria, the cliché bans as quality rules, and the editable draft with "you stay the author".
- **Value before sign-up:** "Start Free" leads to the profile with no account, and matching runs in
  the browser.
- **Fair charging:** a letter is charged only on success, and a free regenerate asks first.
- **The under-13 block screen** that drops the data.
- **The browse disclaimer:** "Never pay an application fee…"
- **Stripe fulfilment:** a verified signature, and the Seasonal expiry matches the 4 months sold.
- **The security headers** (CSP, HSTS preload, frame-ancestors) and lazy loading of pdf.js, mammoth,
  Sentry and PostHog.
- **The resilient scholarship fetch** (raw REST, pages past the 1,000-row cap). Fix the duplicate
  fetch, not the design.
- **The visible focus rings.** Never add `outline:none` to buttons.
- **PostHog with `autocapture:false`** and identified users only.

---

*Lens reports: Critic 1 visual (5), 2 IA (4.5), 3 flow (4), 4 trust (4), 5 accessibility and mobile
(4), 6 performance (4), 7 conversion (4). B1 (the RLS self-upgrade) was found by Critic 7 as an open
question and verified by the lead directly against `pg_policies` and
`information_schema.column_privileges`.*
