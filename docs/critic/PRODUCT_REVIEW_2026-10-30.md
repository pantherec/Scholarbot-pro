# MeritLaunch product review, 2026-10-30 (launch re-score)

Fourth run of the critic team, on `main` at `04ebeae`, which is also the live deploy. PR #7 (the
Oct 21 fixes) is merged and live, so for the first time the local build and the live site are the
same code. Three critics ran one after another (look and reach: lenses 1, 2, 5; engine and money:
6, 7; flow and truth: 3, 4), each against a fresh local build on 127.0.0.1 and against
meritlaunch.com, two harness runs each, medians reported. The lead verified the billing grants, the
stored-data cleanup, Resend DNS, the Sentry bundle and the Vercel runtime logs directly.

**This run had no test-account password**, so no real draft was generated, no sign-in was made and
no checkout session was requested. Everything that depends on a real draft or a real session is
listed under "Unverified this run" and was judged from the code, the tests (40/40) and the fact
checker run in node against the Oct 21 draft fixtures. The launch date is Thu Nov 19.

**Verdict:** the Oct 21 fixes held under measurement and every lens moved up. The composite is
6.2 → **6.6**. Two of the four Oct 21 blockers are closed (billing portal, matches follow the
student), two are partly closed (invented facts, sensitive details), and two new blockers appeared:
the production rate limiter is broken and makes every guarded API call wait about 4.5 s, and a
minor's immigration status still reaches the AI for awards that never asked, through the word
"resident". Neither is large to fix. It is not ready to market until the three blockers below are
closed and one real draft per test account has been read.

## Scorecard

| Lens | 09-30 | 10-11 | 10-21 | 10-30 | Change | Gap to 9 |
|---|---|---|---|---|---|---|
| 1 Visual design and brand | 5 | 6.5 | 6.5 | **7** | +0.5 | Unicode glyphs; tall phone card; faded stats strip |
| 2 Information architecture | 4.5 | 6 | 6.5 | **7** | +0.5 | Matches opens on fit-15 cards; Browse search buried; price buried |
| 3 Core task flow | 4 | 5.5 | 6.5 | **7** | +0.5 | fact-check noise; no gender rule; weak first card |
| 4 Trust, integrity and copy | 4 | 5 | 5.5 | **6** | +0.5 | DACA via "resident"; policy vs PostHog and brag sheet; "$4.1M+" |
| 5 Accessibility and mobile | 4 | 5 | 6 | **6.5** | +0.5 | titles on direct load; sign-up focus; combobox |
| 6 Performance and technical | 4 | 6 | 6.5 | **6.5** | 0 | the 4.5 s rate limiter; uncached catalog; Sentry |
| 7 Conversion and commercial | 4 | 5.5 | 6 | **6.5** | +0.5 | parent page reverses; price 6 screens down; no checkout feedback |
| **Composite** | **4.2** | **5.6** | **6.2** | **6.6** | **+0.4** | |

**Closed since 10-21 (each measured twice, local and live):**
- Billing portal (blocker 3): `customer-portal.js:22-24` takes the customer from the signed-in user; live returned 401 to an unauthenticated POST with a fake `customerId`.
- Matches follow the student (major 1): `App.jsx:737` rebuilds the list locally on sign-in, no `/api/usage` call. (Code read; no real sign-in this run.)
- Wrong-fit matches (major 2), mostly: in the top 50, 0 Canada-only awards for Maria and Amara, 0 citizen-only for Amara, 0 undocumented-only for Maria; Hispanic Scholarship Fund no longer reaches Amara.
- Fake deadlines (major 3): no row resolves to Jan 1; undated rows show their raw text.
- Match card on phones (major 4): `GlowCard` forwards `className`; text column 112 → 324 px; names on one line; grouped five at a time with "Show all", closed listings folded; guest list 48,656 → 5,356 px.
- Next step by fit (major 5): `Dashboard.jsx:21`; Maria's next step is now fit 40, not fit 30.
- Parent button in the dialog (major 7): y=214 of 741 on a phone.
- "AI-Powered" (major 8): the landing says "Eligibility-Checked".
- Stored data (major 10), server side: 0 of 6 `user_profiles` rows hold `phone`, `birthYear` or `email`; trigger `strip_profile_contact_fields` runs on insert and update. The brag-sheet scrub half is still open (major 2 below).
- Route titles and focus (major 11), in-app: 9 distinct titles in 9 of 9 clicks, focus lands in `<main>`, a skip link, 0 axe violations on Matches (was 137 + 60), labelled textareas.
- Letter paper (major 12): 42 chars per line at 390 (was 34), 85 at 1440 (was 157), `maxWidth: 680`.
- Funnel events (major 14): all six `track()` calls present and `checkout_completed` carries `{plan}` (`App.jsx:250`).
- www is a 308; Browse at 1440 CLS 0.27 → 0.03; live headers match `vercel.json` (CSP, HSTS preload, X-Frame DENY, Referrer, Permissions); `npm test` 25 → 40.
- Billing columns: `anon` and `authenticated` hold no UPDATE or INSERT grant on `user_profiles` at all (the 09-30 B1 stays closed).
- Browse data: 0 literal `null`, 0 "Invalid Date", the stray "ON" option is gone.

**Still open from 10-21:** price six screens down (major 15); the catalog uncached and larger (major 13); the brag-sheet scrub (major 10); `legalContent.js:99` (blocker 2's last line); refunds "case-by-case"; the phone menu Escape and X; the empty Browse search; Unicode glyphs; combobox scroll; "Welcome back" for a guest; two "Home"s; `$1000 - %5000` in the data; Sentry DSN; Resend DNS.

## Blockers

1. **The production rate limiter is down, and every guarded route waits for it.** `GET /api/parent-pay?token=x` took 4.48, 4.53 and 5.10 s (lead's curl, 3 of 3; the critic measured 4.7–6.1 s, 5 of 5), and the Vercel runtime log shows "Rate limit Redis error, falling back to in-memory: fetch failed" on every one of those requests. The Upstash credentials are set (otherwise `redis` would be null, `api/_shared/auth.js:57-60`) but the database does not answer, so the client retries and then falls back to a per-instance counter. Nine routes use `checkRateLimit`, including generate, generate-stream, create-checkout, customer-portal, usage and parent-pay. Two effects: the parent page, every draft and every checkout carry ~4.5 s of dead time, and the paid Anthropic routes have no shared rate limit in production.
   - **Fix (Corey):** open the Upstash console; the database is deleted, paused or the REST URL changed. Recreate or resume it and update `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` in Vercel, then redeploy (env vars bake at build).
   - **Fix (code):** `Redis.fromEnv({ retry: { retries: 0 } })` and a 500 ms timeout around `incr`, so a Redis outage costs half a second, not five; log once per cold start, not per request. Regression check: a timing assertion in `signed_in_flow.mjs` that `GET /api/parent-pay` answers under 1.2 s.
2. **Immigration status still reaches the prompt for awards that never ask.** `prompts.js:57` triggers citizenship on `residen\w*`, which matches 404 of 1,297 catalog rows ("US Legal Resident", "resident of Ohio"). In Amara's top 50, DACA status is sent for 12 awards and 9 of them never mention immigration (e.g. "Unigo: Zombie Apocalypse"). This is the Oct 21 blocker 4 half closed: the toggle defaults off and is tested, but the automatic trigger is too wide.
   - **Fix:** trigger only on immigration terms (`citizen|citizenship|immigra\w*|daca|dreamer|undocu\w*|permanent resident|visa|refugee|asylum`), never bare "resident"; a test using the Zombie Apocalypse row that asserts status is absent from the prompt. Measure: 0 of Amara's top 50 send status unless the award names immigration.
3. **The fact check flags honest letters, which teaches students to click through.** Six honest drafts written from the Maria and Amara profiles each got 2–4 chips, all false: "Selection", "Committee", "Foundation", "Board", and the first critic saw "Scholarship" and "Committee" from "Dear Scholarship Committee". With a one-click "All of these are true" button (`LetterWriter.jsx:390`), false chips train the habit that defeats the gate. The checker does catch 6 of the 7 Oct 21 invented details ("eleven", "three", "four", "twenty", "Thursday", "Tuesday") and misses the three it cannot catch by design ("blood pressure medication", "notebook", "waitlist").
   - **Fix:** add salutation and organisation words to the ignore list and the selected scholarship's provider name to the sources; add an honest fixture to `truth.test.js` that must produce 0 chips while the Maria and Amara fixtures stay flagged. Then read one real draft per test account before launch (needs the password).

## Majors, ranked by effect on finishing a draft, then on a parent's trust

1. **The parent page reads, then reverses.** Live on a phone: blank at 1 s, heading at 2.3 s, API answer at 7.5 s (one run 13.2 s), then the plans are replaced by "This link has expired". Causes: blocker 1, plus the 1,297-row catalog loading on `/pay/*` (`App.jsx:492`) in competition with the token check. Fix: blocker 1; skip the catalog fetch on `/pay/*`; a neutral "Checking your link" heading above the plans until the token resolves.
2. **The brag sheet reaches the AI unscrubbed.** A test brag sheet with an email, phone and street address passed through `buildLetterRequest` with all three intact, while the policy says "We never send your email address" (`legalContent.js:66`). Fix: strip emails, phone numbers and street lines in `prompts.js` before the brag sheet goes in; a test.
3. **PostHog runs for signed-out visitors, against the policy.** As a live guest the `ph_…_posthog` cookie is set and `dead-clicks-autocapture.js` and `surveys.js` load; `initAnalytics()` runs for every visitor (`App.jsx:464`). The policy says "only for signed-in users" and "Automatic click capture is turned off" (`legalContent.js:72`). Fix: initialise after sign-in only, with dead clicks and surveys off. Measure: 0 PostHog requests for a guest.
4. **The price is still 6.2 screens down on a phone.** First "$9.99" at y=5,295 live (5,272 local) on a 6,653 px landing; the hero has no price line (`Landing.jsx:82-95`). Fix: one line under the buttons, "Free to start. Premium $9.99/mo, cancel anytime", read from `PLANS`.
5. **The catalog is uncached and grew.** No `api/catalog.js`; live it is two sequential requests, 146.8 + 43.8 KB gzip (190.5 KB, was 152), 455 KB unpacked, `cf-cache-status: DYNAMIC`, no Cache-Control (`src/lib/api.js:122`). Browse on a phone showed the sample "30" until the full list arrived at 7.1 / 8.2 / 10.8 s. Fix: lane E as written on 10-21: `/api/catalog` returning the 11 mapped columns with `s-maxage=3600, stale-while-revalidate` and an ETag.
6. **Matches opens on the weakest fits.** The "next 30 days" group is sorted by date only (`Matches.jsx:42`): Maria's first card is "2023 Steve Duckett…", fit 20, due tomorrow, a 750–1000-word essay; Amara's dashboard next step is Steel Root, fit 20, 1 day left. Fix: within each group sort by fit and push anything due in 3 days or less below the fold; measure: median fit of the top 3 cards at least 40 on all 7 seed profiles.
7. **Boys get women-only awards, and other wrong fits remain.** No gender question: Mateo gets Soroptimist and P.E.O. STAR, Daniel gets P.E.O. STAR. Daniel, a citizen, gets Dream Act Service Incentive Grant (#10) because `matching.js:144` lacks "dream act" and "cadaa". The Hawaii Community Foundation award appears in 6 of 7 lists because 26 state-named rows have no state tag. Fix: an optional gender question and rule; the two regex terms; a state-tag backfill.
8. **"$4.1M+ in open awards" is still inflated.** It includes two Canadian doctoral awards (Vanier, Trudeau, $50K each), a "$77,000 pooled" program total and 28 listings whose cycle has already passed. Open, dated, individual awards come to about **$2.6M+**. Fix: `catalogStats.js` drops graduate, "pooled" and undated past-cycle rows.
9. **The landing promises what the product guards against.** "Nothing invented, no stock phrases" (`Landing.jsx:148`) while the app ships a fact checker because drafts do invent. Fix: "Every detail the draft adds is flagged for you to check."
10. **Titles and canonical are wrong on direct loads.** All 6 deep links tested (`/app`, `/app/matches`, `/app/letters`, `/scholarships`, `/app/deadlines`, `/pay/x`) show the landing title, and `/scholarships` carries `canonical https://meritlaunch.com/`; `titleFor` runs only inside `setView` and on Back (`App.jsx:52, 60`). A parent's pay tab doesn't say what it is (WCAG 2.4.2). Fix: a `useEffect` on `[view]` that sets the title, and per-route canonical and description.
11. **No feedback after Go Premium, and a guest's chosen plan is lost.** The dialog closes first (`UpgradeModal.jsx:92`), then create-checkout takes ~4 s (blocker 1) plus Stripe's own time with nothing on screen; a guest who picks a plan on the landing is sent to sign-up and the plan is dropped (`Landing.jsx:215`). Fix: keep the dialog open with "Opening secure checkout…"; store the pending plan and continue after sign-up.
12. **Sign-up loses keyboard focus.** After switching the dialog from sign-in to sign-up, focus is on BODY (local 2 of 2, live). Fix: focus the email field when `authMode` changes.
13. **The Browse search sits at y≈530 on a phone** under a nine-line disclaimer, and a search with no results shows only "0 of 1,297 scholarships". Fix: one-line disclaimer with a "Before you apply" link; an empty state with "Clear search".
14. **Nothing brings students back.** `resend._domainkey.meritlaunch.com` is still NXDOMAIN and `EMAIL_REMINDERS_LIVE=false`; the gate holds everywhere except `legalContent.js:99`, which still says "turn alerts off from the toggle on your dashboard" while the toggle is hidden. Fix: the DNS records (Corey) and that one line (code).

**Minor:**
- Refunds are still "case-by-case" (`legalContent.js:147`); no refund line on the parent page or in the dialog. The dialog's list is labelled "deadlines that still need a letter" but never checks saved letters (`UpgradeModal.jsx:21, 69`). A Premium student can also buy a Season Pass through their own checkout (`create-checkout.js` has no 409 guard; `parent-pay.js:70` does). The webhook does not handle refunds.
- The combobox loses the highlighted option after 14 ArrowDowns (active option at y=1097, list ends at 618). The phone menu ignores Escape and its X covers the brand mark. The landing stats strip measures 2.55:1 at first paint because the scroll-in fade starts partly transparent; the landing has no `<main>`. Two accessible names don't start with their visible text (sidebar brand, brag-sheet drop zone). 19 Unicode glyphs remain across 9 views; the brand mark colour is hard-coded (`components.jsx:75`). The phone match card spends a whole row on the fit ring.
- "Welcome back, Test" after a guest's first run; "Continue my profile" at 0%; "Your first draft is one click away" shown to a guest who can't draft; "Home" and "← Back to Home" go to different places; the toast says "you're eligible for" while the page says "appear eligible".
- 28 past-cycle rows ("Spring 2026") sit under "Rolling or varies"; 142 rows were never link-checked; `LAST_UPDATED` is still "September 2026"; the sitemap `lastmod` is 2026-09-30; the OG image is 373 KB; fonts come from Google and are not preloaded; `$1000 - %5000` is still in the data; the "2023 Steve Duckett" row has a stale name on a 10/31/2026 deadline.
- `anon` and `authenticated` hold Supabase's default TRUNCATE grant on `user_profiles`. PostgREST exposes no TRUNCATE, so it is not reachable from the web, but revoke it anyway.

## What needs Corey, not code

- **Upstash:** check the Redis database behind `UPSTASH_REDIS_REST_URL`; resume or recreate it, update the two env vars in Vercel, redeploy. This is blocker 1 and the single biggest speed-up available.
- **The test-account password** (`ML_TEST_PASSWORD`), so one real draft per account can be read before launch. That is the only way to close blocker 3 and the "unverified" list.
- **Resend DNS:** the DKIM and `send.` records. Email reminders stay off until the first delivered send.
- **Sentry DSN:** `VITE_SENTRY_DSN` in Vercel; the code and CSP are ready.
- **One refund sentence** for the parent page, the dialog and the terms.
- **Social proof:** consented quotes from real students or parents. None exists and none has been invented; the landing is correct to stay silent.
- **One phone check** on launch week: sign in, pull to refresh, still signed in after 15 s.

## Unverified this run (needs a real session or a real draft)

How often a real draft invents details now that the prompt and checker are live; whether chips appear after streaming ends and Save/Copy stay locked; whether the model mentions DACA when the field is included; outline quality; PDF and .docx brag-sheet extraction on real files; the regenerate confirm; the match rebuild after a real sign-in; the Stripe checkout URL; parent-link creation; "Manage billing"; the upgrade dialog with real matches. All were judged from code and tests only.

## Experience-moments plan

1. **KEM-15: The parent's first second.** `/pay/<token>` readable within 500 ms, button live within 1.5 s. Build: blocker 1, no catalog on `/pay`, neutral heading. Measure: GET under 1.2 s, 3 of 3.
2. **KEM-14b: Your status stays yours.** Status reaches the prompt only when the award names immigration or the student opts in. Build: `SENSITIVE_FIELDS` and one test. Measure: 0 of Amara's top 50 otherwise.
3. **KEM-11b: A check that only speaks when it matters.** 0 chips on an honest letter; every number, day or age the student never gave still flagged. Build: ignore list, provider name in sources, honest fixture. Measure: the two fixtures in `truth.test.js`.
4. **KEM-P: A policy a parent can check.** Every sentence in `/privacy` matches the network tab. Build: PostHog after sign-in only, brag-sheet scrub, line 99, date bump. Measure: 0 PostHog requests for a guest; scrub test passes.
5. **KEM-C2: The first card is worth tonight.** The top card is a strong fit with time to write. Build: sorting in `Matches.jsx` and `Dashboard.jsx`. Measure: median fit of top 3 at least 40 on all 7 profiles.
6. **KEM-16: Price in the first screen.** Build: a hero line from `PLANS`. Measure: first price at y < 844.
7. **KEM-17: Paying feels like finishing.** "Opening secure checkout…" stays on screen; a guest's plan survives sign-up; a refund sentence under the button. Measure: checkout start to Stripe URL under 2 s.
8. **KEM-13b: The tab says where I am.** Build: title on first load. Measure: 6 distinct titles on 6 deep links.

## Build waves

Each lane is its own worktree; no two lanes share files.

| Lane | Scope | Files |
|---|---|---|
| A: Server speed | Redis no-retry and timeout; log once; parent-pay skips `getUsage` unless needed | `api/_shared/auth.js`, `api/parent-pay.js`, `.claude/skills/meritlaunch-critic/scripts/signed_in_flow.mjs` |
| B: Truth engine | Sensitive-field regex; brag-sheet scrub; fact-check ignore list and provider sources; open-awards total; gender rule and regex terms; state-tag backfill | `api/_shared/prompts.js`, `src/lib/factcheck.js`, `src/lib/catalogStats.js`, `src/lib/matching.js`, `src/lib/__tests__/truth.test.js` and fixtures |
| C: Copy, policy, analytics | "Nothing invented" line; hero price line; `legalContent.js:99`, PostHog wording and date; PostHog init after sign-in with dead clicks and surveys off; refund sentence when Corey has it | `src/views/Landing.jsx`, `src/legalContent.js`, `src/analytics.js`, `src/App.jsx` (init call and pending plan only) |
| D: Flow and phone | Matches and dashboard sort; no catalog on `/pay`; neutral parent heading; dialog stays open on checkout; sign-up focus; Browse disclaimer and empty state; combobox scroll; phone menu Escape and X; glyphs to `AppIcon`; stats-strip reveal; title on first load | `src/views/Matches.jsx`, `src/views/Dashboard.jsx`, `src/views/ParentPay.jsx`, `src/views/modals/UpgradeModal.jsx`, `src/views/modals/AuthModal.jsx`, `src/views/Browse.jsx`, `src/views/Sidebar.jsx`, `src/ui/components.jsx`, `src/routes.js` |
| E: Catalog route | `/api/catalog` with caching, ETag and column selection | new `api/catalog.js`, `src/lib/api.js`, `vercel.json` |

**Wave 1 (before Nov 19):** Corey's Upstash fix plus lane A; lane B's regex, scrub and ignore list; lane C's policy and PostHog lines; then one real draft per test account with the password. **Wave 2:** the rest of lanes B, C and D. **Wave 3:** lane E. Re-run this critic signed in before the launch post goes out.

## Protect

- The type scale and tokens (0 literal font sizes), the designed empty states, the cream letter paper.
- Plan / Write / Track, the grouped Matches with "Show all", and 4 interactions from landing to a guest match list.
- The shared `Modal` (focus returns after close), focus into `<main>` on every in-app route, 0 tap targets under 24 px, no sideways scroll on all 22 harness pages, reduced motion.
- Eligibility before scoring, with closed listings last; the local match rebuild on sign-in.
- The `EMAIL_REMINDERS_LIVE` switch and the fact-check gate: tune them, never remove them.
- The age gate with Continue, `{under13:true}` only, and the AI-policy step with the free outline.
- Server-built prompts with the honesty block; the sensitive-details toggle defaulting off.
- Plan cards rendered from `plans.js` with the test that keeps them equal to `usage.js`; the "Your next step" card ranked by fit.
- Route-level code splitting with PostHog and Sentry out of the main bundle; immutable `/assets` caching; 0 console errors on 44 page loads; the CSP, HSTS and the 308 on www.
- The billing portal keyed to the signed-in user; no UPDATE or INSERT grant on `user_profiles` for web roles; the contact-field trigger.
