---
name: meritlaunch-critic
description: Critical product review of MeritLaunch (meritlaunch.com) by a team of critics who take the contrary view. The critics load the real pages in headless Chrome, sign in to dedicated test accounts and run the real match-and-draft flow on a local build, read the code and prompts, and judge seven lenses against the best scholarship and consumer products. The lenses are visual design, information architecture, core task flow, trust and integrity (including minors' privacy and true numbers), accessibility and mobile, performance, and conversion. They report to the designing agent with a scorecard measured against the last review, evidence-backed findings, buildable proposals and Key Experience Moment briefs. Use when Corey asks "is MeritLaunch AAA / ready", "what's left before marketing", "run the critic team on MeritLaunch", "score the scholarship app", "what would a parent or reviewer say", or "/meritlaunch-critic". Also after a major build wave and before any marketing push. Load meritlaunch-master first.
---

# MeritLaunch critic

A team of critics who take the contrary view. Each **assumes MeritLaunch is not yet a
category-leading product and sets out to prove why**, with evidence. Then the team hands the
designing agent (the lead running `meritlaunch-master`) a ranked, buildable plan. The goal: a
student who is short on time finds scholarships they actually qualify for, gets a draft that sounds
like them on a good day, and comes back every week of the season. Their parent trusts it enough to
pay, and nothing about the student is ever invented, sold or exposed.

Method borrowed from `juripath-critic` and the game critics: **play, measure, then judge.** Two
things only show up by playing. The 2026-09-30 review found a white Iowa student matched to the
Gates Scholarship. The 2026-10-10 simulation found a returning student who signs in sees an empty
profile. No code read had caught either.

## 1. Setup (non-negotiable isolation)
- **Repo:** `pantherec/Scholarbot-pro` (React 18 + Vite; views in `src/views/`, logic in `src/lib/`,
  serverless API in `api/`). On Corey's PC it's `Scholarbot_Pro/`; in a cloud session it's the
  checkout root.
- **Read-only.** Critics never edit, commit or push. Only the lead writes the report.
- **Local build per critic:** `npm install && npm run build`, then
  `npx vite preview --port 58xx --host 127.0.0.1 --strictPort` in the background.
  - Ports **5890–5909**, one per critic. Never 5000. Use `http://127.0.0.1`. Stop your server when done.
  - `vite preview` doesn't run `api/`. Signed-in journeys therefore send `/api/*` to production
    with `--proxy https://meritlaunch.com`. The server code under test is then the live deploy, not
    the local branch. Say so in the report, and review `api/` changes by reading the code.
- **Live site, read-only:** `https://meritlaunch.com`. Page loads and measurements only.
- **Harness** (this skill's `scripts/`):
  - `web_audit.mjs`: public pages at 390×844 and 1440×900, with screenshots, LCP, CLS, transfer
    size, console errors, failed requests, contrast, labels, tap targets, sideways scroll and
    metadata. The journey is `scripts/journeys/public.json`.
    `node web_audit.mjs --url http://127.0.0.1:5891 --out <tmp> --journey journeys/public.json`
  - `signed_in_flow.mjs`: signs in to the test accounts through the real form, checks that the
    saved profile comes back, then runs dashboard → match → draft. Add `--full` for outline, voice
    profile, upgrade dialog, parent link and parent page; add `--checkout` to confirm a Stripe URL.
    `ML_TEST_PASSWORD=… node signed_in_flow.mjs --url http://127.0.0.1:5891 --out <tmp> --accounts lexi,wei --full`
  - **Corey's PC:** both scripts default to the installed Chrome. Pass
    `--pw <dir with playwright-core>` if it isn't resolvable.
    **Cloud sandbox:** the browser has no internet. Pass
    `--chrome /opt/pw-browsers/chromium-*/chrome-linux/chrome --pw /opt/node22/lib/node_modules/playwright --proxy https://meritlaunch.com`.
    Google Fonts will fail there; ignore that console error.
  - Full-page screenshots show fixed bars mid-page. That's the capture method, not an overlap bug.
  - Optional: `npm i axe-core` in your temp dir and set `AXE_PATH` to its `axe.min.js`.
- **Test accounts only.** Five confirmed accounts exist for signed-in work:
  `coreyskinner+{lexi,ethan,maria,amara,wei}test@gmail.com`. Lexi and Ethan are biracial (Black and
  White), Maria is Hispanic and Pell-eligible, Amara is DACA/TPS and multiracial, and Wei is an
  international student with no major. The password is held by the lead and passed only as
  `ML_TEST_PASSWORD`. Never write it to a file.
  - Each draft spends one free letter and a real Anthropic call. Between runs, the lead resets
    usage for these accounts only:
    `update user_profiles set letters_used_this_month=0, matches_used_this_month=0 where id in (select id from auth.users where email like 'coreyskinner+%test@gmail.com');`
  - Never sign in as a real user. Never enter card details. `--checkout` only checks that a
    checkout.stripe.com URL comes back, and the redirect is aborted.
  - `test-profiles/` (the `+ml-*` aliases) is Corey's manual E2E set. Don't use it unless he has
    signed those accounts up.
- **Tests:** `npm test` (Vitest, `src/lib/__tests__`). Read them to learn what is pinned.

## 2. The team
Dispatch one critic agent per lens, in parallel. Give each one this SKILL.md path, its lens, its
port, and the rubric anchors in `references/rubric.md`:

| Critic | Lens | Main evidence |
|---|---|---|
| 1 | Visual design and brand | screenshots at both sizes, `src/ui/theme.js` and `components.jsx`, literal colours and sizes in `src/views/` |
| 2 | Information architecture and layout | nav, landing, dashboard, routes (`src/routes.js`); clicks to first match and first draft; the returning-student landing |
| 3 | Core task flow | `signed_in_flow.mjs` on 2+ accounts; matching (`src/lib/matching.js`) against each profile; each draft against the profile, sentence by sentence |
| 4 | Trust, integrity and copy | every number, claim and disclaimer; `src/legalContent.js` against real data flows; the prompts in `api/_shared/prompts.js`; scholarship data defects on Browse |
| 5 | Accessibility and mobile | harness at 390px, keyboard-only walk, axe, reduced motion |
| 6 | Performance and technical quality | harness vitals on local and live, build chunks, `npm test`, headers, robots and sitemap, staying signed in across a reload |
| 7 | Conversion and commercial readiness | `src/lib/plans.js`, `UpgradeModal.jsx`, `ParentPay.jsx`, `api/create-checkout.js`, `api/parent-pay.js`, funnel events, the deadline-email path, social proof |

For a quick run, merge into 3 critics: **1+2+5** (look and reach), **3+4** (flow and truth),
**6+7** (engine and money).

## 3. MeritLaunch's product rules (a proposal that breaks one is not a proposal)
- **The student stays the author.** Drafts are built only from what the student told us and are
  marked as drafts to revise. Never invent an experience, number, name or award. Never frame AI
  output as something to pass off as human writing.
- **The AI-policy step stays.** Before a draft, the student says whether the scholarship allows AI
  help; "not sure" gets an outline and questions, not a letter.
- **Minors' data:** under-13 is blocked and the data dropped. Only a 13+ flag is kept, never the
  birth year. No contact fields in any AI prompt. No student data in URLs or on the parent page.
  Nothing is sold or shared for advertising.
- **True numbers only:** every count, dollar figure and date on the site is computed from the live
  catalog (`src/lib/catalogStats.js`). No fabricated outcomes, testimonials or "students helped"
  counts. Plan cards come from `src/lib/plans.js` and match `api/_shared/usage.js`.
- **Charge fairly:** a letter counts only after a draft arrives, outlines are free, and a free
  regenerate asks first.
- **Voice:** warm, specific and never condescending, with the banned words in `meritlaunch-master`.
- **Benchmarks** (report only, never in the product): Going Merry, Bold.org, Scholarships360,
  Fastweb, ScholarshipOwl and the Common App for the category; Grammarly and Duolingo for writing
  help and retention; Stripe and Linear for craft.

## 4. Evidence rules
- **Specifics:** every finding carries at least one of: file:line, a measured number, a screenshot
  name, or a quote under 15 words.
- **Severity:** **blocker** (a student can't finish, loses work, or the site says something false,
  unsafe or unlawful), **major**, or **minor**.
- **Verification:** reproduce a bug twice, and on the live site too where it applies. Trust the
  code over any doc. If a result might be a sandbox artifact (no internet, headless browser
  quirks), say so and give the one check Corey can do on his own phone to settle it.
- **Balance:** no praise padding, but name one thing per lens that works and must be protected.
- **Delta:** compare each lens to the last review in `docs/critic/`. Say which earlier findings
  are closed (with the measurement that moved) and which have come back.

## 5. Report to the designing agent
Each critic returns (under 900 words): a verdict and lens score (1–10, plus the change since the
last review) against the rubric anchors; ranked findings with evidence, severity and a one-task
fix; what to protect; and, for flow, trust and conversion, at least 3 Key Experience Moment briefs
in the `references/experience_brief.md` format.

The lead then synthesizes:
- **Scorecard:** 7 lenses, the score now, the change since the last review, and the gap to 9.
- **Blockers first,** then majors ranked by their effect on finishing a draft and on a parent's trust.
- **What needs Corey, not code:** logins, DNS, money, outreach (e.g. Resend, Sentry DSN, social proof).
- **The experience-moments plan:** 5–8 briefs, ordered so earlier ones set up later ones.
- **Build waves:** worktree-sized lanes that don't share files.
- **Protect list.**

**Write it to** `docs/critic/PRODUCT_REVIEW_<YYYY-MM-DD>.md` in the repo, and publish it as an
artifact page for Corey.

## 6. How the designing agent acts on it
- **Blockers:** fixed first, each with a regression check (a Vitest test in `src/lib/__tests__`
  or an assertion in `signed_in_flow.mjs`).
- **Build lanes:** each lane in its own git worktree; lanes don't share files.
- **Verification:** re-run the harness and the lens that raised a finding once the fix merges.
  Close it only when the measurement moves.
- **Learnings:** add a dated line below for anything the next run should know.

## Learnings
- 2026-09-30: First review (run from Corey's PC, harness `shared-bases/scripts/web_audit.mjs`).
  Composite 4.2; 7 blockers (RLS self-upgrade to Premium, open Claude proxy, ineligible matches,
  false plan cards, fabricated numbers, keyboard picker and dialog, privacy policy). All 7 closed
  the same day (`979c439`, `506333a`). Report: `docs/critic/PRODUCT_REVIEW_2026-09-30.md`.
- 2026-10-10: Skill written into the repo from `juripath-critic`; harness copied here with
  `--chrome` and `--proxy` so it runs in a cloud session. The 10-10 simulation on all 5 test
  accounts passed matching, drafts, outline, voice profile, parent link and both Stripe checkout
  URLs. Two auth findings came out of it:
  (1) `onAuthStateChange` never calls `loadProfileFromSupabase` (`src/App.jsx` ~568). A normal
  sign-in shows the age question and an empty form until reload. `signed_in_flow.mjs` reports this
  as `cloudProfileOnSignIn`.
  (2) In the sandbox browser, `supabase.auth.getSession()` hangs on reload, and the 8 s
  `withTimeout` fallback then wipes the session (signed out at ~9 s). This may be a headless Web
  Locks quirk; it matches the July auth-lock learning but isn't confirmed on a real phone.
- 2026-10-10: The auth dialog and the landing nav both have a "Sign In" button. Submit the form by
  pressing Enter in the password field (it's a real `<form onSubmit>`).
- 2026-10-11: After signing in, move only with the sidebar, never `page.goto`. A full load re-runs
  `getSession()` and, in the sandbox, signs the student out. In the sandbox every signed-in API call
  also waits out `getAccessTokenSafe`'s 3 s `getSession()` cap first. So wait for the outcome (a URL
  or a new draft), not a fixed time: a late `runMatching` once yanked the app to Matches mid-draft.
  Validated run (Wei, `--full --checkout`): 80 eligible matches, matching 7 s, draft 22 s at 392 words
  with no em dashes; outline, voice profile, parent link, a parent page with no student data, and a
  Stripe URL all OK.
- 2026-10-11: Second review (in-repo skill, 3 merged critics). Composite 4.2 → 5.6; 7 new blockers.
  Report: `docs/critic/PRODUCT_REVIEW_2026-10-11.md`. The reload sign-out is NOT a sandbox quirk:
  `onAuthStateChange` awaits a Supabase query while `initialize()` holds the auth lock (deadlock).
  Critic subagents can't write report files in a cloud session; have them return the report as
  their final message. Lexi's cloud profile lacks `ageOk`, so her "See my matches" stays disabled.
- 2026-10-11 (fixes): Blockers 1–4 and 7 fixed on this branch. Sign-in now lands on `/app`, where
  the sidebar calls the dashboard "Home". The age question needs a Continue click. The AI-policy
  radio starts unanswered, so the harness checks "allowed" before drafting. `signed_in_flow.mjs` now
  reports `signedInAfterReload`, and a reload no longer signs out in the sandbox. Lexi has since
  answered the age question, so her profile has `ageOk`. Don't `pkill -f "vite preview"` in the
  same shell command as other work: the pattern matches that shell and kills it.
