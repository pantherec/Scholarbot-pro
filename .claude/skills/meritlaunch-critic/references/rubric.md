# MeritLaunch critic rubric: seven lenses

Each lens gets a score from 1 to 10, the evidence behind it, and the gap to the top anchor.
**7 is "a paying family would not complain". 9 is "a student tells their friends and a parent tells
another parent".** Anything below 7 is a finding, and every finding needs evidence (SKILL.md §4).
Benchmarks are named in the report only, never in the product.

Two audiences, every lens asks about both:
- **The student:** 13 to 18, usually on a phone, short on time, unsure what they qualify for, wary
  of anything that sounds like cheating or a scam.
- **The parent who pays:** wants proof it's legitimate, worth the money, and safe for their child's
  data. Often arrives from a link the student sent.

**Baseline (2026-09-30 review):** visual 5, IA 4.5, flow 4, trust 4, accessibility 4, performance 4,
conversion 4 (composite 4.2). Report every score as a change from the last review on file in
`docs/critic/`.

---

## 1. Visual design and brand
**Question:** does every screen look like the same warm, premium, trustworthy product the landing page promises?

| Score | Anchor |
|---|---|
| 3 | The app looks nothing like the landing page; mixed icons, emoji, default controls |
| 5 | Consistent palette, but the app is dense, the empty and loading states are bare, grids break on phones |
| 7 | One design system across landing and app (tokens, type scale, one icon set, gold/teal/coral only); every state designed; the letter paper feels like a real document |
| 9 | Stripe/Linear craft with a kitchen-table warmth: a student screenshots it to show friends; a parent reads it as careful and official |

**Measure:** literal colours and font sizes outside `src/ui/theme.js` (`grep -rn "#[0-9a-fA-F]\{6\}\|fontSize: [0-9]" src/views`);
icon systems in use (`AppIcon` vs emoji/Unicode); every view at 390 and 1440 (harness); empty,
loading, error and done states of Matches, Letters, Saved, Deadlines; the cream letter panel.

## 2. Information architecture and layout
**Question:** does a student know in 5 seconds what this does, and always know their next step?

| Score | Anchor |
|---|---|
| 3 | Tool-shaped nav, jargon ("persona", "scoring engine"), no deep links, Back leaves the site |
| 5 | Everything reachable by hunting; dashboard lists features instead of a next step |
| 7 | Goal-shaped nav (Plan / Write / Track), real URLs, a dashboard that says the one next step, matches grouped by deadline |
| 9 | Going Merry-grade findability with more honesty: every screen answers "what do I do now and why", and a returning student lands exactly where they left off |

**Measure:** clicks from landing to first match and to first draft; what the top 390px and 900px
show; nav labels vs the words students use; deep links and Back (`src/routes.js`); the dashboard's
first instruction; what a returning signed-in student sees first.

## 3. Core task flow
**Question:** can a student go from nothing to a matched list and a letter worth revising, without getting stuck, losing work or being surprised?

| Score | Anchor |
|---|---|
| 3 | Dead ends, ineligible matches, work lost on refresh or sign-in, letters that ignore the essay prompt |
| 5 | Completable, but matches need checking, the draft is generic, and "what now?" after the draft |
| 7 | Eligible matches with deadlines and "why you fit"; drafts built from the student's real details and the real prompt; work survives reload and sign-in; a clear "submit by" plan |
| 9 | Common App completeness with Duolingo warmth: every match explains itself, every draft reads like the student on a good day, and the tracker turns the season into this week's plan |

**Measure:** run `scripts/signed_in_flow.mjs` on 2+ test accounts (one with a thin profile, one
international or DACA); eligible-match count vs the catalog; a wrong-fit check (heritage, state,
citizenship, GPA); letter words, em dashes, banned words, invented facts (compare each sentence to
the profile); does the profile come back after a normal sign-in (`cloudProfileOnSignIn`); reload
mid-draft; time-to-first-match and time-to-first-draft.

## 4. Trust, integrity and copy
**Question:** would a careful parent trust it with their child, and is every sentence true?

| Score | Anchor |
|---|---|
| 3 | Numbers that can't be reproduced, a privacy policy that doesn't match behaviour, AI framed as passing as human |
| 5 | True but cold; scholarship data quality visible to users (Expired at the top, `Invalid Date`, `null` criteria) |
| 7 | Every number derived from data; the AI-policy step before every draft; "you stay the author" everywhere; minors' data minimal and described truthfully; dead links flagged |
| 9 | Trust earned visibly: "listings checked {date}" on every card, an honest "how matching works", real consented outcomes, and copy a school counselor would recommend |

**Measure:** grep copy for the banned words in the master skill and for unprovable claims ("best",
"guarantee", "win"); every number on landing/pricing against `src/lib/catalogStats.js` and live
Supabase; `src/legalContent.js` against what the code collects and who it sends data to
(Supabase, Anthropic, Stripe, Resend, PostHog, Sentry, Vercel); the under-13 path (`src/data/profile.js`);
data shown on the parent page; scholarship-data defects on Browse (expired ordering, `Invalid Date`,
`null`, dead links).

## 5. Accessibility and mobile
**Question:** can every student finish on a phone and with a keyboard or screen reader?

| Score | Anchor |
|---|---|
| 3 | Unlabelled fields, mouse-only pickers, sideways scroll, unreadable contrast |
| 5 | Mostly labelled, but dialogs trap or lose focus, grids don't stack, small tap targets |
| 7 | WCAG 2.2 AA on profile → match → draft → track: labels, focus order and visible focus, 24px targets, 4.5:1 text, no sideways scroll at 390px, reduced motion respected |
| 9 | Gov.uk-grade: screen-reader journeys tested, error summaries, 200% zoom without loss, works one-handed on a phone |

**Measure:** harness at 390×844 on every journey page; keyboard-only walk (Tab/Enter/Escape)
through age gate → profile → combobox pick → draft → upgrade dialog; axe-core (`AXE_PATH`);
`prefers-reduced-motion` on the hero video and letter demo.

## 6. Performance and technical quality
**Question:** is it fast on a school-issued Chromebook or a mid-range phone, error-free, and well described to search and link previews?

| Score | Anchor |
|---|---|
| 3 | Console errors, 404s, phone LCP over 4 s, the full catalog downloaded twice |
| 5 | Works, but heavy entry bundle, slow catalog load, missing robots/sitemap/OG |
| 7 | Phone LCP under 2.5 s, CLS under 0.1, no console errors, split views, immutable asset caching, correct title/description/OG/canonical, robots and sitemap |
| 9 | Near-instant: catalog cached and incremental, scholarship pages indexable, Sentry live with zero unhandled errors in a week, sessions that never silently expire |

**Measure:** harness vitals on the local build and the live site; `npm run build` chunk sizes;
`npm test`; `curl -sI https://meritlaunch.com` (headers, cache, CSP); `/robots.txt`,
`/sitemap.xml`; auth resilience (sign in, reload, still signed in after 15 s?).

## 7. Conversion and commercial readiness
**Question:** when a student or parent is ready to pay, is it obvious, fair and frictionless, and is there a reason to come back?

| Score | Anchor |
|---|---|
| 3 | Surprise paywall, plan cards that don't match the code, value hidden behind sign-up |
| 5 | Honest price, but the paywall is generic and the parent can't easily pay |
| 7 | Value before sign-up; the paywall shows the student's own matches and deadlines; a no-data parent link; one-step checkout; funnel events; deadline emails that actually deliver |
| 9 | Paying feels like finishing: a guarantee of what they get, a season recap that earns renewal, social proof from real consented outcomes, and reminders that bring students back weekly |

**Measure:** where the price first appears; `src/lib/plans.js` vs `api/_shared/usage.js`; the
upgrade dialog contents for a student with matches; the parent page (no student data, valid and
expired links); `--checkout` returns a Stripe URL; PostHog events named in code; Resend domain
verified (`LAUNCH_NEXT_STEPS.md`); testimonials present.
