# MeritLaunch product review, 2026-10-11

Second run of the critic team, the first with the in-repo `meritlaunch-critic` skill. Three critics
(look and reach: lenses 1, 2, 5; flow and truth: 3, 4; engine and money: 6, 7) worked against a local
build of `ab5230e` with `/api/*` proxied to production, plus the live site. Signed-in runs used the
test accounts only: Ethan, Maria, Amara and Lexi. In total, 3 drafts were spent across the critics, and usage has been reset since.

**Verdict:** a big step up from 09-30 (composite 4.2 → 5.6). Every 09-30 blocker is still closed, the
design system is real, and phones load in under 2 s. Not AAA yet. Seven new blockers stand in the
way, and four of them are in sign-in and session handling: a returning student can lose their work.

## Scorecard

| Lens | 09-30 | 10-11 | Change | Gap to 9 |
|---|---|---|---|---|
| 1 Visual design and brand | 5 | 6.5 | +1.5 | the match card on phones; one icon system |
| 2 Information architecture | 4.5 | 6 | +1.5 | the returning-student landing; a 97-card list |
| 3 Core task flow | 4 | 5.5 | +1.5 | invented facts in drafts; wrong-fit matches; fake dates |
| 4 Trust, integrity and copy | 4 | 5 | +1 | "Nothing is invented" is false; stored data vs policy |
| 5 Accessibility and mobile | 4 | 5 | +1 | age-gate keyboard lockout; route announcements |
| 6 Performance and technical | 4 | 6 | +2 | reload sign-out; catalog weight; profile-step CLS |
| 7 Conversion and commercial | 4 | 5.5 | +1.5 | email promise; lost checkout events; parent cancel |
| **Composite** | **4.2** | **5.6** | **+1.4** | |

**Closed since 09-30 (measured):**
- Phone LCP went from 5.8 s to 1.8 s.
- Literal font sizes in views went from 30 to 0. Literal hex colours went from 7+ hues to 6, all of them on the letter paper.
- The live site now loads with 0 console errors across 22 pages.
- Plan cards match `usage.js`.
- The parent page leaks no student data (checked on 3 accounts).
- Drafts have no em dashes and no banned words (5 drafts).
- Both checkouts return live Stripe URLs.

## Blockers

1. **A reload signs the student out and deletes the session.**
   - Reproduced 2/2: the auth lock was taken at 62 ms and never released.
   - `onAuthStateChange` awaits `loadAccountData` (`src/App.jsx:582`), which calls `supabase.from()`, which calls `getSession()`. That call waits on `initialize()`, and `initialize()` is itself waiting for the callback to return, so the two wait on each other forever. After 8 s, `App.jsx:518` calls `clearStaleSupabaseSession()`.
   - This is Supabase's documented "don't await inside onAuthStateChange" deadlock, not a sandbox quirk.
   - **Fix:** make the callback synchronous and defer the load (`setTimeout(…, 0)`). Bootstrap from `INITIAL_SESSION`. Never clear an unexpired token. Have `getAccessTokenSafe` read storage first.
2. **Signing in doesn't load the saved profile, and the student's next edit overwrites it.**
   - `cloudProfileOnSignIn:false` on 4 of 4 accounts.
   - The student sees an empty age question. Answering it calls `saveProfile({...profile, ageOk:true})` (`ProfileBuilder.jsx:57`), and `api.js:124` replaces the whole `profile_data` with that near-empty profile.
   - Saved Letters is also empty after sign-in.
   - **Fix:** load the profile and letters in the sign-in path, and block profile saves until the cloud copy has loaded.
3. **On a shared device, one student's data ends up in the next student's account.**
   - Sign-out clears no local data (`App.jsx:412-420`).
   - Together with blocker 2, the next student on the same Chromebook sees the first student's profile, and their first edit writes it into their own account.
   - **Fix:** clear every `scholarbot-*` key on sign-out and whenever the signed-in user changes.
4. **One keypress on the age question locks a teen out.**
   - The `<select>` commits on `onChange` (`ProfileBuilder.jsx:53`), and its first option is 2016.
   - One ArrowDown saves `{under13:true}`, and the block survives a reload. Reproduced twice.
   - **Fix:** commit only when the student presses a Continue button.
5. **Drafts invent facts, and the parent page says they don't.**
   - Maria's draft: "I was twelve", "blood pressure medication". Amara's: "Some weeks only four students showed up", "my AP Computer Science class".
   - This happened in 2 of 2 drafts that were checked line by line.
   - `ParentPay.jsx:110` promises "Nothing is invented".
   - **Fix:** a server-side fact check that flags numbers, ages and names that aren't in the profile, highlighted in the editor. Until it ships, change the parent copy to "built only from what they told us; they check every line".
6. **Deadline emails are sold but not delivered.**
   - The claim appears in `plans.js:21` and on the parent page.
   - `resend._domainkey` and `send.meritlaunch.com` return NXDOMAIN.
   - **Fix:** Corey verifies the Resend domain. Until then, remove the claim.
7. **The customer portal trusts any customer ID.**
   - `api/customer-portal.js:18` opens a Stripe portal for any `customerId` in the request body, so a signed-in user can open another family's billing page.
   - It also returns `error.message` to the client.
   - **Fix:** look up `stripe_customer_id` on the server by `user.id`, and return a generic error.

## Majors, ranked by effect on finishing a draft, then on a parent's trust

1. **The AI-policy step defaults to "Allowed"** (`App.jsx:94`), so a student never has to answer it. Start with nothing selected and disable the draft button until they choose.
2. **Wrong-fit matches** (`matching.js:101, 116`):
   - A multiracial student skips the heritage filter, so Amara gets Hispanic Scholarship Fund (#4) and LULAC (#17).
   - The DACA check misses "United States citizen" written out (Jackie Robinson, #11).
   - Canada-only awards reach US students: 5 in Maria's top 50 and 7 in Amara's.
   - Women-only awards are labelled as "Heritage-specific" matches.
   - "Undocu" isn't treated as "undocumented", so an undocumented-only award goes to a citizen (Maria #7).
   - Turn all five into tests.
3. **Fake deadlines.** Text with no month resolves to Jan 1 (`deadline.js:22`), which affects 182 catalog rows ("Annual", "Year-Round", "Via FAFSA"). Require a month name; otherwise show the listing as undated.
4. **The match card is unreadable on a phone.**
   - `GlowCard` drops `className` (`components.jsx:8`), so no phone CSS reaches the card, and the text column is 112px wide.
   - The guest list is 97 cards and 33,000 px tall, with 42 closed listings mixed in.
   - Show 5 per group and collapse the closed group.
5. **Stored data contradicts the privacy policy.**
   - 6 of 6 `user_profiles` rows still hold `phone`, and 4 of 6 hold `birthYear`. The policy says neither is stored.
   - The brag sheet goes to Anthropic without its email address or phone number removed, although the policy says "We never send your email address" (`prompts.js:111`).
   - Run a one-time cleanup migration, filter on the server, and strip contact details from the brag sheet.
6. **"$11.5M+ in listed award amounts" is inflated.**
   - 38% of it comes from program-wide totals, and $2.24M comes from closed listings.
   - Count only individual awards on open listings (about $4.87M), and label it that way.
7. **Completed and cancelled checkouts are never recorded.** The events fire before PostHog has loaded (`App.jsx:218` vs `:425`). Queue events until PostHog loads, or record them from the Stripe webhook.
8. **A parent who pays has no way to cancel, and refunds are "case-by-case"** (`ParentPay.jsx:69`, `legalContent.js:138`). The upgrade dialog lists no features and says nothing about refunds.
9. **Screen readers don't hear page changes.**
   - Focus falls to `<body>`, and every route keeps the same `document.title`.
   - Axe flags 112 prohibited `aria-label`s on Matches, closed cards at 3.98:1 contrast, and 5 unlabelled textareas on Practice Answers.
10. **The dashboard's next step points at the weakest match** (fit 15, due in 3 days), and it says "Welcome back" on a first visit.
11. **The catalog costs 190 KB gzip on every visit.** It uses `select=*` and isn't cached (`api.js:99`).
12. **Profile-step CLS is 0.122 on a phone.** The fields appear above the Next button.
13. **Sentry will be blocked by CSP** as soon as the DSN is added. Ship the ingest host in `connect-src` together with the DSN.
14. **No social proof, and the price first appears six screens down on a phone** (y=5272).

**Minor:**
- Emoji and Unicode icons in Deadlines, Browse and ErrorFallback.
- The X button overlaps the brand mark on the phone menu.
- Letter paper runs about 160 characters per line at 1440.
- An empty Browse search shows no message.
- The letter picker ignores the student's matches.
- Saved letters can't be reopened, and Delete doesn't ask first.
- The auth dialog drops focus when it switches between sign-in and sign-up.
- The combobox doesn't scroll to the active option.
- The `/scholarships` canonical points at the landing page.
- `www` redirects with a 307 instead of a 308.
- The profile is saved on every keystroke.
- Server-side parent-pay doesn't refuse a student who already has a plan.
- Lexi's saved profile lacks `ageOk`, so her "See my matches" stays disabled.

## What needs Corey, not code

- **Resend:** add the DNS records for `meritlaunch.com` in Resend and Vercel DNS. This unblocks blocker 6 and KEM-7.
- **Sentry:** create the DSN and set `VITE_SENTRY_DSN` in Vercel. I'll ship the CSP line in the same change.
- **www redirect:** in Vercel → Domains, change the `www` redirect to 308 (permanent).
- **Refund policy:** decide on one sentence (for example, "full refund within 7 days, no questions"). It goes on the parent page, the upgrade dialog and the terms.
- **Social proof:** consented quotes from real students or parents. Don't invent any.
- **One phone check:** sign in, wait 5 s, pull to refresh, wait 15 s, and see whether you're still signed in. This confirms blocker 1 on a real device before and after the fix.
- **Data cleanup:** approve a one-time migration that removes `phone`, `email` and `birthYear` from existing `profile_data` rows, including real users' rows.
- **Still open from `LAUNCH_NEXT_STEPS.md`:** Supabase leaked-password protection, and the trademark filing.

## Experience-moments plan

Earlier moments set up later ones.

1. **KEM-9: Still here when I come back** (blocker 1). Measure: still signed in 15 s after a reload, 10 of 10 runs.
2. **KEM-A1: Welcome back, exactly where you left off** (blockers 2 and 3). Measure: `cloudProfileOnSignIn:true` on all 5 test accounts.
3. **KEM-A3: An age question that can't trip a keyboard** (blocker 4). Measure: the keyboard walk reaches the name field.
4. **KEM-B: Every line is yours** (blocker 5). A fact check underlines any detail that isn't in the profile: "We added this. Is it true?" Measure: 0 unflagged invented numbers across 5 drafts.
5. **KEM-C: A deadline you can trust** (majors 2 and 3). Show a real date or "Date not posted", plus a "Why not?" link that explains any exclusion. Measure: 0 non-US awards in US students' top 50.
6. **KEM-A2: A match list that fits in a thumb** (major 4). Measure: Matches under 6,000 px tall at 390px, with a text column at least 300px wide.
7. **KEM-10: The parent's first 10 seconds, and a way out** (major 8). Measure: the parent checkout start-to-completed rate, once major 7 is fixed.
8. **KEM-7: The deadline email that arrives the week it matters**, after Resend is verified. Then KEM-8, the season recap built from real counts.

## Build waves

Each lane is its own worktree, and no two lanes share files.

| Lane | Scope | Files |
|---|---|---|
| A: Session | Blockers 1–4; the AI-policy default; the analytics queue; route titles and focus | `src/App.jsx`, `src/lib/api.js`, `src/lib/analytics.js`, `src/views/ProfileBuilder.jsx`, `signed_in_flow.mjs` |
| B: Truth engine | The fact check; matching fixes; deadline parsing; the award total; brag-sheet scrubbing | `src/lib/matching.js`, `src/lib/deadline.js`, `src/lib/catalogStats.js`, `api/_shared/prompts.js`, new `api/_shared/factcheck.js`, `src/views/LetterWriter.jsx`, tests |
| C: Money | Portal ownership; parent cancel and refund copy; removing the email claim; the upgrade dialog; CSP | `api/customer-portal.js`, `api/parent-pay.js`, `src/views/ParentPay.jsx`, `src/components/UpgradeModal.jsx`, `src/lib/plans.js`, `src/legalContent.js`, `vercel.json` |
| D: Phone and a11y | The match card; grouping; icons; axe fixes; the dashboard next step; empty Browse | `src/ui/components.jsx`, `src/views/Matches.jsx`, `Dashboard.jsx`, `Browse.jsx`, `Deadlines.jsx`, `PracticeAnswers.jsx`, `GlobalStyles.jsx` |

**Wave 1:** lanes A and C, the blockers that need no product decisions. **Wave 2:** lanes B and D. **Then:** re-run this critic.

## Protect

- The Plan / Write / Track nav, real URLs, and the "Your next step" card.
- Value before sign-up: matching works as a guest.
- The type scale and tokens, the gold-only primary button, and the cream letter paper.
- Prompts built on the server, with contact fields removed and "The student is the author".
- The free outline path.
- A parent page with no student data, and links that expire after 7 days.
- Eligibility checked before scoring, with closed listings last.
- The shared `Modal`, the gold focus ring, the ARIA combobox, 44px targets, and reduced motion.
- Lazy views, immutable caching, CSP and HSTS, and zero console errors.
- `PLANS` as the single source of plan facts, and charging only for a delivered draft.
