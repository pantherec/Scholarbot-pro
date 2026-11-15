---
name: meritlaunch-critic
description: >
  Critical product review of MeritLaunch (meritlaunch.com) by a team of critics who take the
  contrary view. The critics load the real pages in headless Chrome, run a local build, read the
  code (including the letter-generation prompts), and judge seven lenses against the best
  scholarship and student-facing products: visual design and brand, information architecture and
  layout, core task flow (profile to matches to letter), trust, integrity and copy (the "your own
  voice, not an essay mill" promise, minors' privacy, true numbers), accessibility and mobile,
  performance and technical quality, and conversion and commercial readiness. They report to the
  designing agent with a scorecard, evidence-backed findings, buildable proposals and Key
  Experience Moment briefs. Use when Corey asks for a critical review of MeritLaunch, "is
  MeritLaunch professional yet", "what would a parent or student say", "score the scholarship
  app", "make it feel premium", "run the critic team on MeritLaunch", or "/meritlaunch-critic".
  Also after a major build wave and before a launch or marketing push. Load meritlaunch-master first.
---

# MeritLaunch critic

A team of critics who take the contrary view. Each **assumes MeritLaunch is not yet a full
professional, category-leading product and sets out to prove why**, with evidence. Then the team
hands the designing agent (the lead running `meritlaunch-master`) a ranked, buildable plan. The
goal: a student (and the parent beside them) arrives overwhelmed, leaves with scholarships that
truly fit and a letter that sounds like them, and trusts MeritLaunch enough to pay and to tell a friend.

Method borrowed from the game critics (`bb-aaa-critic`): **play, measure, then judge.** The first
harness run (2026-09-30) showed on the live landing page "Browse 30 Scholarships" and "Last
Database Refresh Feb 11", a trust problem no code review had surfaced.

## 1. Setup (non-negotiable isolation)
- **Repo:** `C:\Users\corey\Desktop\Claude\Scholarbot_Pro` (branch `main`; React 18 + Vite). State lives in
  `src/App.jsx` and reaches pages through `useApp()`; pages are `src/views/*`, logic is `src/lib/*`,
  routes are `/app/...` in `src/routes.js`; serverless `api/*` with shared code in `api/_shared/`.
- **Read-only.** Critics never edit, commit or push. Only the lead writes the report.
- **Local build per critic:** in the repo run `npx vite --port 58xx --host 127.0.0.1 --strictPort`
  in the background. Use ports **5890–5909**, one per critic. Never 5000. Use `http://127.0.0.1`.
  Stop your server when done.
  - Vite serves the UI only. The `api/` functions (letter generation, checkout) do not run under
    Vite. **Do not start `vercel dev` or call the live API**: generation spends real money and
    needs an account. Judge generation from `api/generate.js`, `api/generate-stream.js` and the
    prompt and style rules in `api/_shared/prompts.js`.
- **Live site, read-only:** `https://www.meritlaunch.com`. Page loads and measurements only.
- **Accounts.** Never create an account, sign in as a real user, pay, or submit a form on the live
  site. The flow-and-trust critic may sign in to the four test accounts (`coreyskinner+...test@gmail.com`)
  with `ML_TEST_PASSWORD` from the repo's git-ignored `.env`; never print or record the password.
  Set `localStorage["meritlaunch-tour"]` to `{visits:4,never:true}` before entering the app. The lead
  resets the test accounts' usage counters and deletes harness drafts after the run.
- **Never use the shared browser pane.**
- **Evidence harness:** `C:\Users\corey\.claude\skills\shared-bases\scripts\web_audit.mjs`
  (headless Chrome; screenshots at 390×844 and 1440×900 plus vitals, errors, contrast, labels, tap
  targets, sideways scroll, metadata, into `audit.json`).
  - Example: `node web_audit.mjs --url https://www.meritlaunch.com --out <tmp> --journey <journey.json>`
  - Starter journey: `scripts/journey_ml.json` (landing, bottom of landing, browse, sign-up form).
  - **Load timings vary a lot run to run** (one desktop landing LCP measured 33 s, the next 2.5 s).
    Run a page at least twice and report the median; a single outlier is not a finding.
  - Full-page screenshots are capped at 8,000 px tall (a long list can crash the renderer); the
    record says so when it cropped.
  - Optional: `npm i axe-core` in your temp dir and set `AXE_PATH` for a full WCAG scan.

## 2. The team
Dispatch one `web-critic` agent per lens, in parallel, with this SKILL.md path and its lens. The
lenses and anchors are in `references/rubric.md`:

| Critic | Lens | Main evidence |
|---|---|---|
| 1 | Visual design and brand | screenshots both sizes, the `COLORS` and `TYPE` tokens in `src/ui/theme.js` and components in `src/ui/components.jsx`, and `meritlaunch-master/references/premium-website-playbook.md` (the house standard) |
| 2 | Information architecture and layout | landing, nav, dashboard cards, routes; clicks to first match |
| 3 | Core task flow | profile builder → matching → letter, from code + the signed-out states; the brag-sheet upload path |
| 4 | Trust, integrity and copy | every number and claim, the "your own voice" promise vs the prompts, minors' privacy, legal pages |
| 5 | Accessibility and mobile | harness at 390px, keyboard pass, labels, focus, contrast |
| 6 | Performance and technical quality | harness vitals (median of 2+), bundle from `npm run build`, SEO/OG, headers |
| 7 | Conversion and commercial readiness | free vs paid limits, the two plans, checkout path in code, retention (deadline alerts, tracker) |

For a quick run, merge into 3 critics: 1+2+5, 3+4, 6+7.

## 3. MeritLaunch's product rules (a proposal that breaks one is not a proposal)
- **The student is the author.** Letters are drafted from the student's real experiences in their
  own voice. Never propose inventing achievements, ghost-writing that hides the student, or
  anything that helps break a scholarship's own rules on outside help or AI.
- **Minors.** Users can be 13–17. The COPPA age gate (under-13 refused, DOB never stored) stays.
  Collect only what matching needs; no selling or sharing student data.
- **True numbers.** Scholarship counts, award totals, deadlines and "last refreshed" dates must be
  current and true. Verify any number against the data (`scholarship_db.json`,
  the live Supabase `scholarships` table, the refresh crons) before praising or criticising it.
- **Prices:** read them from the code (`src/lib/plans.js`, `api/_shared/billing.js`) rather
  than from memory; they were Premium $9.99/month and a $29.99 Seasonal Pass as of 2026-06-25.
- **Public copy:** "built by a parent" is fine; no employer or job title for Corey.
- **Benchmarks** (report only, never in the product): Going Merry, Scholarships360, Bold.org,
  Fastweb, Niche, ScholarshipOwl; for craft, Duolingo's onboarding, Headspace, Notion.

## 4. Evidence rules
- **Specifics:** every finding carries file:line, a measured number, a screenshot name, or a quote
  under 15 words.
- **Severity:** **blocker** (a student cannot finish, or the site says something false or puts a
  minor at risk), **major**, or **minor**.
- **Verification:** reproduce twice; trust the code and data over any doc (the repo holds many old
  Word plans and playbooks).
- **Balance:** name one thing per lens that works and must be protected.

## 5. Report to the designing agent
Each critic returns (under 900 words): a verdict and lens score (1–10) against the rubric anchors;
ranked findings with evidence, severity and a one-task fix; what to protect; and, for flow, trust
and conversion, at least 3 Key Experience Moment briefs in the `references/experience_brief.md` format.

The lead then synthesizes: a 7-lens scorecard with the gap to 9; blockers first, then majors by
impact on finishing and on trust; an experience-moments plan of 5–8 briefs; worktree-sized build
lanes that don't share files; a protect list.

**Write it to** `docs/critic/PRODUCT_REVIEW_<YYYY-MM-DD>.md` in the Scholarbot_Pro repo, and
publish it as an artifact page for Corey.

## 6. How the designing agent acts on it
- **Blockers:** fixed first, each with a check that would catch it again.
- **Build lanes:** each lane in its own git worktree; lanes don't share files (`src/App.jsx` is one
  3,500-line file, so plan lanes by region of it, or extract components first).
- **Verification:** re-run the harness and the lens once the fix merges; close a finding only when
  the measurement moves.

## Learnings
- 2026-09-30: skill created, modelled on `bb-aaa-critic`. First harness run on the live site:
  18 low-contrast text elements (stat labels at 2.74:1, needs 4.5:1), "Last Database Refresh Feb 11"
  on the landing page, 1.0–1.2 MB on a phone landing, no console errors. The embedded scholarship
  list carries deadlines already past (QuestBridge 2026-09-26).
- 2026-09-30 (first full 7-lens run, composite 4.2): the critics' "open question" items are worth the
  lead verifying directly. Critic 7 asked whether users can write their own billing columns; a
  read-only `pg_policies` + `information_schema.column_privileges` query confirmed they can (B1). Do
  that check every run. Also: check numbers against the LIVE Supabase table, not the stale
  `scholarship_db.json` (552 rows); Critic 4 misjudged the $11.5M total from the local file. The
  harness's "no sideways scroll" can be a false pass when the root has `overflow:hidden`; look at the
  phone screenshots for clipped content.
- 2026-11-14 (sixth review, composite 6.9, unchanged): all five 11-11 blockers closed, but features shipped the same day opened three new ones (free-text "Opens/Reopens" dates read as deadlines in `src/lib/deadline.js`; work sync never starting when the load returns nothing; privacy wording ahead of what `scrubContact` covers). Lesson: run the flow-and-trust critic on any same-day feature wave before calling it done, and have it check every new legal sentence against the code path it describes. Probe `deadlineInfo` with free-text catalog dates each run. Open money items: double charge via two checkout sessions, `account.js:26` ignoring a failed profile read. Report: `docs/critic/PRODUCT_REVIEW_2026-11-14.md`.
