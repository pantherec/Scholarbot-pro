# MeritLaunch product review, 2026-10-21 (pre-launch)

Third run of the critic team, on branch `f316a60` (the 10-11 fixes, PR #7, not yet merged). Three
critics (look and reach: lenses 1, 2, 5; flow and truth: 3, 4; engine and money: 6, 7) worked against
a local build of this branch with `/api/*` sent to production, which is still `main` at `1a87e97`.
So every server call (sign-in, usage, drafts, parent links, checkout) exercised the live deploy, and
this branch's server changes (`api/customer-portal.js`, the parent-pay 409) were reviewed by reading
only. Signed-in work used the test accounts only: Ethan, Maria, Amara and Lexi. Three drafts were
spent, and usage has been reset since.

**Verdict:** the 10-11 fixes hold under measurement, and the composite moved from 5.6 to 6.2. The
product is now safe to sign in to and stay in. It is not ready to market, for three reasons: drafts
still add details the student never gave (4 of 4 drafts across two reviews), the app still promises
emails it cannot send, and the live site still runs the old billing code because PR #7 isn't merged.

## Scorecard

| Lens | 09-30 | 10-11 | 10-21 | Change | Gap to 9 |
|---|---|---|---|---|---|
| 1 Visual design and brand | 5 | 6.5 | 6.5 | 0 | the match card on phones; the letter paper |
| 2 Information architecture | 4.5 | 6 | 6.5 | +0.5 | matches don't follow the student; a 137-card list |
| 3 Core task flow | 4 | 5.5 | 6.5 | +1 | invented facts; wrong-fit matches; fake dates |
| 4 Trust, integrity and copy | 4 | 5 | 5.5 | +0.5 | email promises; "AI-Powered"; stored data vs policy |
| 5 Accessibility and mobile | 4 | 5 | 6 | +1 | silent route changes; axe on Matches |
| 6 Performance and technical | 4 | 6 | 6.5 | +0.5 | uncached catalog; the live deploy is stale |
| 7 Conversion and commercial | 4 | 5.5 | 6 | +0.5 | parent page blank 5 s; parent button below the fold |
| **Composite** | **4.2** | **5.6** | **6.2** | **+0.6** | |

**Closed since 10-11 (measured):**
- Reload sign-out: still signed in 15 s after a reload, 3 of 3 runs, with no auth lock held (`navigator.locks.query()` empty).
- Profile on sign-in: `cloudProfileOnSignIn` true on Ethan, Maria and Amara (was false 4 of 4).
- Shared device: after Sign Out, 0 `scholarbot-*` keys and no token; Amara then sees only Amara; Maria's cloud name unchanged.
- Age gate: ArrowDown alone stores nothing; Continue on 2016 stores only `{under13:true}`.
- AI-policy step: both radios start unchecked and Draft is disabled until answered.
- Profile-step CLS: 0.122 → 0.
- Upgrade dialog: 3 features per plan and the student's next 3 deadlines; focus trap and return verified.
- Parent page: no "Nothing is invented", a cancel path named, no student data (3 accounts).
- Plan card and parent page no longer promise emails.
- Charging: one draft plus one free outline moved the counter by exactly one.
- 0 console errors on 22 local and 20 live pages; `npm test` 25/25.

## Blockers

1. **Drafts invent facts.** Maria's draft: "I was eleven", "blood pressure medication", "Over three years", a notebook. Amara's: "only four middle schoolers", "twenty minutes", "Thursday afternoons", "on Tuesday", a waitlist. None are in the profiles. 2 of 2 drafts this run, 4 of 4 across reviews. The prompt forbids it (`api/_shared/prompts.js:139`) and nothing checks the output.
   - **Fix:** `api/_shared/factcheck.js` returns every number, age, weekday and proper noun absent from the profile and brag sheet. `LetterWriter.jsx` shows them as chips the student keeps or cuts before Save or Copy. Fixtures from these two drafts in `core.test.js`.
2. **The app still promises emails it cannot send.** `resend._domainkey.meritlaunch.com` is NXDOMAIN and `send.meritlaunch.com` has no records (two resolvers). The 10-11 pass removed the promise from the plan card and parent page, but it remains at `Deadlines.jsx:10` ("We email reminders a week before each one"), the dashboard toggle (`Dashboard.jsx:130`), and `legalContent.js:45, 65, 74-75, 135`.
   - **Fix:** one copy pass to "reminders on your dashboard" (code), plus the Resend DNS records (Corey). Restore the email wording only after the first delivered send.
3. **The live site still runs the old billing portal.** `main` at `1a87e97` opens a Stripe portal for any `customerId` in the request body. The fix is on this branch and undeployed.
   - **Fix:** merge PR #7 and deploy (Corey).
4. **Drafts volunteer immigration status.** `prompts.js:34` sends CITIZENSHIP with every letter. Amara's draft, line 7: "My status under DACA and TPS has meant…" for an award that never asked. A minor's immigration status in a document they'll submit is an unsafe default even though they revise it.
   - **Fix:** citizenship and financial need reach the prompt only when the scholarship text mentions them or the student opts in with a "Sensitive details" toggle; one prompt rule; one test.

## Majors, ranked by effect on finishing a draft, then on a parent's trust

1. **Matches don't follow the student.** Sign in on a new device with a complete profile and the dashboard says "Run your first match" (Ethan, Maria). Results live only in localStorage (`App.jsx:90`), which sign-out now clears (`api.js:67`), and a re-run spends 1 of 5 free runs. Fix: in `restoreAccount`, when `profile.ageOk` and no local matches, run `rankMatches` locally (no `/api/usage` call) and store it.
2. **Wrong-fit matches, unchanged** (`matching.js:101, 109, 116, 121`): Amara gets Hispanic Scholarship Fund (#4) and Jackie Robinson ("Be a United States citizen", #11); Maria, a citizen, gets "Scholarships for Undocu Students" (#7); 13 Canada-only awards in Amara's list and 6 in Maria's; women-only awards are labelled "Heritage-specific". Fix: the five tests from 10-11 plus "country must equal the student's".
3. **Fake deadlines.** 140 catalog rows with no month resolve to Jan 1 (`deadline.js:17-24`); 10 of Maria's and 12 of Amara's matches; Browse shows "NYS STEM Incentive Program … Jan 1" for "Annual". Fix: require a month name, else show "Date not posted".
4. **The match card is unreadable on a phone.** `GlowCard` drops `className` (`components.jsx:8`), so the text column is 112px on all 20 measured cards and names wrap to 6 lines. The guest list is 137 cards and 48,656 px tall with 60 closed cards expanded. Fix: forward `className`, stack the card below 768px, 5 per group with "Show all", closed group collapsed.
5. **The dashboard's next step is the nearest date, not the best fit.** "Track your nearest match: Horatio Alger", fit 30, ranked 18 of 137 (`Dashboard.jsx:17-19` sorts by days only). Fix: within the 30-day bucket, sort by fit.
6. **The parent page is blank for about 5 seconds.** `GET /api/parent-pay?token=…` took 4.5–4.9 s in 3 of 3 calls (robots.txt 0.4 s), and the page shows only "Checking your link..." meanwhile. Fix: render the header, plan cards and "What your student gets" at once; gate only the checkout button on the token. Skip `getUsage` in the GET unless needed.
7. **"Ask a parent to pay" is below the fold on a phone.** The dialog's scroll height is 855 px against 741 visible, with no scroll cue. Fix: stack the plan cards at ≤480px and pin the parent button under the heading.
8. **"AI-Powered Scholarship Matching"** (`Landing.jsx:69`) overclaims: `matching.js` is rules, with no model call. Fix: "Eligibility-checked matching".
9. **"$11.5M+ in listed award amounts" is inflated.** It counts 428 closed listings ($3.45M) and program-wide totals; open individual awards are about $4.1M. Fix: count open individual awards and label it "in open awards".
10. **Stored data contradicts the privacy policy.** 5 of 6 `user_profiles` rows hold `phone`, 4 of 6 `birthYear`, 5 of 6 `email` (`legalContent.js:21, 29`). The brag sheet reaches Anthropic unscrubbed (`prompts.js:111`) against "We never send your email address". Fix: a one-time cleanup migration (needs Corey's approval), server-side stripping on save, and an email/phone scrub on the brag sheet.
11. **Route changes are silent.** `document.title` is identical on 6 app routes, focus stays on the sidebar button, no `<main>` landmark, no skip link. Axe: 137 `aria-prohibited-attr` (`Matches.jsx:51`), 60 contrast failures on closed badges, 5 unlabelled textareas (`PracticeAnswers.jsx:23-28`). Fix: `setView` sets the title and focuses `<main tabIndex={-1}>`; `role="img"` on the ring; `htmlFor` on the textareas.
12. **The letter paper isn't a document.** 34 characters per line at 390 (textarea 212 px wide) and 157 at 1440 (`LetterWriter.jsx:291`). Fix: `maxWidth: 680`, 20px padding on phones.
13. **The catalog is uncached.** 1,297 rows × `select=*`, 152 KB gzip, two requests per visit, `cf-cache-status: DYNAMIC` (`api.js:122`). Fix: a `/api/catalog` route with `s-maxage` and an ETag, returning only the 11 mapped columns.
14. **The funnel can't be read.** No events for Start Free, sign-in success, track, submitted, letter saved or copied; `checkout_completed` carries no plan. Fix: six `track()` calls and a plan property.
15. **The price is 6 screens down on a phone (y=5272) and there is no social proof.** Fix: one hero line "Free to start · Premium $9.99/mo · cancel anytime"; social proof needs Corey.

**Minor:**
- Guest edits are discarded silently when signing in to an existing account (`App.jsx:541-545`); add "We loaded your saved profile".
- `Dashboard.jsx:25` and `ParentPay.jsx:110` claim eligibility is checked for "citizenship, heritage" while major 2 stands.
- Closed listings are 54 of 121 (Maria) and 73 of 162 (Amara) in the match lists.
- Browse tab shows "30" for about 600 ms before the catalog arrives; `/scholarships` canonical points at `/`; www is a 307; the OG image is 373 KB; Sentry DSN unset.
- Browse at 1440 shifts (CLS 0.27) on the local build only, consistent with the font swap; self-host or preload the fonts.
- Combobox doesn't scroll to the active option; phone menu ignores Escape and the X covers the brand mark; auth dialog drops focus on mode switch; two different "Home"s; "Welcome back" on a first visit; Unicode glyphs in Matches, Browse, ProfileBuilder and LetterWriter; Saved Letters can't reopen a letter and Delete doesn't ask; an empty Browse search shows nothing; a `$1000 - %5000` badge in the catalog data.
- Refunds are still "case-by-case" (`legalContent.js:138`).

## What needs Corey, not code

- **Merge PR #7 and deploy.** This closes the live billing hole (blocker 3) and ships the sign-in and session fixes. Try "Manage billing" on a paid test account in the preview first.
- **Resend DNS:** add the DKIM and `send.` records. Until then the copy pass in blocker 2 keeps the site honest.
- **Sentry DSN:** set `VITE_SENTRY_DSN` in Vercel. The CSP line is already on this branch.
- **www redirect:** change it to 308 in Vercel → Domains.
- **One refund sentence** for the parent page, the upgrade dialog and the terms.
- **Social proof:** consented quotes from real students or parents.
- **Data cleanup:** approve a one-time migration that removes `phone`, `email` and `birthYear` from existing `profile_data` rows, including real users'.
- **One phone check:** sign in, pull to refresh, wait 15 s, still signed in? (Confirmed 3 of 3 in the sandbox; worth one real-device check before launch.)

## Experience-moments plan

Earlier moments set up later ones.

1. **KEM-12: Your matches are waiting** (major 1). Sign in on any device and the dashboard opens on "121 matches, 3 due this month". Measure: a non-zero match tile after sign-in on all 5 test accounts, with no free run spent.
2. **KEM-C: A deadline you can trust** (majors 2 and 3). A real date or "Date not posted", and no award a US student can't apply for. Measure: 0 non-US awards in US students' top 50; 0 dates not present in the listing text.
3. **KEM-11: "Is this true?" before Save** (blocker 1). Amber chips on every detail not in the profile; Save unlocks when none remain. Measure: 0 unreviewed invented numbers across 5 drafts.
4. **KEM-14: Nothing about you that you didn't choose to say** (blocker 4). Sensitive details off by default. Measure: 0 drafts mention status when the scholarship doesn't.
5. **KEM-A2: A match list that fits in a thumb** (major 4). Measure: Matches under 6,000 px at 390 with a text column of at least 300 px; 0 axe violations.
6. **KEM-10: The parent's first 5 seconds** (majors 6 and 7). Readable at 0 ms, the button lights when the token clears, "Ask a parent to pay" visible on a phone. Measure: time-to-readable under 500 ms; the parent-link share from phone sessions.
7. **KEM-13: The page tells me where I am** (major 11). Measure: 6 distinct titles; focus inside `<main>` after every route.
8. **KEM-12b: Reminders you can see arrive** (blocker 2), then KEM-7 and KEM-8 once Resend delivers.

## Build waves

Each lane is its own worktree, and no two lanes share files.

| Lane | Scope | Files |
|---|---|---|
| A: Session and dashboard | Restore matches on sign-in; guest-edit notice; next step by fit; route title and focus; the six funnel events | `src/App.jsx`, `src/views/Dashboard.jsx`, `src/analytics.js`, `scripts/signed_in_flow.mjs` |
| B: Truth engine | Fact check and chips; sensitive-details toggle; matching fixes; deadline month rule; open-awards total; brag-sheet scrub; letter paper width; combobox scroll | `api/_shared/prompts.js`, new `api/_shared/factcheck.js`, `src/lib/matching.js`, `src/lib/deadline.js`, `src/lib/catalogStats.js`, `src/views/LetterWriter.jsx`, `src/lib/__tests__/` |
| C: Copy and money | Email-promise copy pass; "Eligibility-checked matching"; hero price line; parent page readable at once; stacked phone paywall; parent-pay GET fast path; refund sentence (when Corey has it) | `src/views/Deadlines.jsx`, `src/legalContent.js`, `src/views/Landing.jsx`, `src/views/ParentPay.jsx`, `src/views/modals/UpgradeModal.jsx`, `api/parent-pay.js` |
| D: Phone and a11y | GlowCard className; stacked match card; grouping and "Show all"; axe fixes; phone menu Escape and X; empty Browse search; glyphs to AppIcon | `src/ui/components.jsx`, `src/views/Matches.jsx`, `src/ui/GlobalStyles.jsx`, `src/views/PracticeAnswers.jsx`, `src/views/Sidebar.jsx`, `src/views/Browse.jsx` |
| E: Catalog route | `/api/catalog` with caching and column selection | new `api/catalog.js`, `src/lib/api.js`, `vercel.json` |

**Wave 1 (before marketing):** merge PR #7; lane C's copy pass; lane B's fact check and sensitive-details toggle; lane A's match restore. **Wave 2:** the rest of lanes A, B and D. **Wave 3:** lane E. Then re-run this critic.

## Protect

- The synchronous auth listener with the deferred restore, pinned by `session.test.js`.
- The Continue pattern on the age question, and "We didn't save anything you enter" for under-13.
- Plan / Write / Track nav, real URLs, the "Your next step" card, and 3 clicks from landing to a match list.
- The type scale and tokens, the gold-only primary, the cream paper colour.
- Server-built prompts with the honesty block and first-name-only facts.
- The free outline path, and charging only for a delivered draft.
- A parent page with no student data and links that expire after 7 days.
- Eligibility checked before scoring, with closed listings last; dead links flagged "Source page gone".
- The shared `Modal` (trap and return), the `inert` sidebar, 44px targets, reduced motion.
- 0 console errors, immutable asset caching, CSP and HSTS.
