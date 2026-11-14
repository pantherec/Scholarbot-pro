---
name: meritlaunch-scholarship-sourcing
description: Find, verify and admit scholarships into the MeritLaunch catalog under written admission rules. Two independent passes (a finder, then a checker that reopens the provider's own page), structured eligibility fields, and a holding table that Corey approves before anything reaches students. Use when Corey asks to "find more scholarships", "run a scholarship search", "add scholarships", "grow the catalog", "check a scholarship is legit", "re-verify the catalog", or before a launch push. Replaces the old scholarship_hunter.py pipeline and the scholarbot-pro-manager checklist. Load meritlaunch-master first.
---

# MeritLaunch scholarship sourcing

The promise on the site is "only legitimate, proofed scholarships". This skill is what makes that
true. A listing is admitted because a named provider's own page says it exists this cycle, and a
second reader confirmed it, never because a model thought the page looked trustworthy.

## 1. Admission rules (all seven must hold)

1. **Primary source.** The record's `source_url` is on the provider's own site, or on the
   application platform the provider links to. An aggregator page (Fastweb, Bold, Scholarships.com,
   Niche, Going Merry, Unigo, a blog, a "top 50" list) is a lead, never a source.
2. **Named provider.** A real organization or person is named and can be placed: a foundation,
   nonprofit, school, college, government body, employer, union, professional association, community
   foundation or company. Record what it is in `provider_type`. No provider, no listing.
3. **No fee.** Applying costs nothing. Any application, processing or "membership to apply" fee is a
   rejection.
4. **Not a drawing.** Random drawings, sweepstakes, "no essay" giveaways and awards whose main
   purpose is collecting sign-ups or marketing consent are excluded (Corey, 2026-11-14). A real
   selection process on stated criteria is required.
5. **Open this cycle.** The provider's page shows a deadline or an opening date for the current or
   next cycle. A page that only shows a past year is recorded as `check_status: rejected`,
   `check_notes: "no current cycle"`. Never guess a deadline from last year's date.
6. **Eligibility as fields.** Who may apply is recorded in the structured fields in section 3, with
   `eligibility_quote` holding the provider's own words (one or two sentences, copied exactly).
   Leave a field null when the page does not say. Never infer heritage, gender or citizenship rules
   from a provider's name.
7. **Open to the students we serve.** High school students (grades 9 to 12) or students entering or
   in undergraduate study, in the US or Canada. Graduate-only awards are out.

Also reject: a provider that asks for a Social Security number, bank details or payment before an
award is made; a page that guarantees winning; a form with no named contact and no organization
behind it. These follow the FTC and studentaid.gov guidance on scholarship scams.

## 2. The two passes

**Pass 1, finder** (a cheaper model is fine). For one segment of the search plan: search the web,
follow leads to the provider's own page, read it, and return one JSON record per scholarship that
looks admissible. The finder also returns every lead it dropped and why, in one line each.

**Pass 2, checker** (a separate agent that has not seen the finder's reasoning). For each record:
open `source_url` again, and confirm the name, provider, deadline, amount and every eligibility
field against the page. It sets `check_status` to `verified` only when all seven rules hold and the
fields match. Any disagreement with the finder is a rejection with a note, not a negotiation.

Both passes fetch pages themselves. Neither trusts a search snippet. A page that will not load is
`rejected: unreachable`, to be retried in a later run.

**Then the lead** dedupes against the live catalog (same provider and same award name, or same
`source_url` host and path), writes verified rows to `public.scholarship_candidates`, and gives
Corey the batch to approve. Only approved rows are copied into `public.scholarships`.

## 3. Record

Holding table: `public.scholarship_candidates` (service role only, RLS on, no web access).

| Field | Notes |
|---|---|
| `batch` | e.g. `2026-11-prelaunch` |
| `name`, `provider`, `provider_type` | provider_type: foundation, nonprofit, college, government, employer, association, union, community_foundation, company |
| `source_url`, `apply_url` | provider's page; where the student applies |
| `amount_text`, `amount_max`, `awards_count` | amount_text as written; amount_max is the largest single award in dollars |
| `deadline`, `deadline_text`, `cycle` | ISO date when stated; text as written; e.g. `2026-27` |
| `country`, `states[]` | two-letter state codes; null = national |
| `grade_levels[]` | from: 9, 10, 11, 12, college_freshman, undergraduate |
| `gpa_min` | on a 4.0 scale, only when the page states one |
| `citizenship[]` | from: us_citizen, permanent_resident, daca, undocumented, international, canadian |
| `heritage[]`, `gender`, `majors[]`, `need_based`, `first_gen` | only when stated as a requirement |
| `other_requirements` | membership, employer, county, disability, military family, activity |
| `criteria` | one plain paragraph for the listing, in MeritLaunch voice |
| `eligibility_quote` | the provider's words, exact |
| `application_fee`, `is_drawing`, `essay_required` | booleans; the first two must be false |
| `found_by`, `check_status`, `check_notes`, `checked_at`, `duplicate_of`, `decision` | pipeline state |

The live `scholarships` table still stores most eligibility as free text. When a batch is approved,
write `criteria` so the matcher's text rules (`src/lib/matching.js`) can read it: state the GPA as
"minimum 3.0 GPA", the grade as "high school seniors", and so on. Adding real columns to the live
table is a separate, approved change.

## 4. Search plan

Aim each finder at one segment, so runs do not overlap and gaps are visible:

- **States.** Measure first: `select state, count(*) from scholarships group by 1`. Work the
  thinnest states. Sources per state: the state higher-education agency, community foundations,
  state bar, medical, engineering and teachers' associations, credit unions, utilities and electric
  cooperatives.
- **Younger students.** Awards open to grades 9 to 11 (the catalog is mostly seniors).
- **Student groups.** Students with disabilities, rural students, military and veteran families,
  foster youth, first-generation students, LGBTQ+ students, faith communities, trades and career
  and technical education, community college transfer.
- **Fields.** Nursing and allied health, teaching, skilled trades, agriculture, computing, the arts.
- **Canada.** Provincial programs and national foundations, tagged `country: CA`.

Record the segment in `found_by`. A segment that returns fewer than five verified awards is a
finding in itself: report it.

## 5. Running it

1. Measure the catalog (state counts, grade coverage, dead links) and pick segments.
2. Dispatch finders in parallel, one segment each, with this file's path and the segment. Each
   returns JSON records plus its dropped leads.
3. Dispatch checkers on the finders' records, in batches of about 15.
4. Dedupe, insert verified rows into `scholarship_candidates`, and publish the batch for Corey:
   name, provider, amount, deadline, who it is for, and the source link.
5. On approval, copy rows into `scholarships` with `link_status: 'active'` and
   `link_verified_at: now()`. Re-run the matcher tests.

Cost: finders and checkers are web-search heavy. Say the expected number of agents before starting
and stay inside what Corey approved.

## 6. What this replaces

- `scholarship_hunter.py` (needs the retired Gemini key; legitimacy was a number the model made up).
- `scholarship_link_verifier.py` (imports names that do not exist, so it cannot start).
- The `scholarbot-pro-manager` database checklist.
Leave those files in place; do not run them. `api/refresh-expired.js` (the daily cron that
re-checks expired listings) stays and is unaffected.

## Learnings

- 2026-11-14: Skill written after the review of the old pipeline. Baseline: 1,297 listings, 41 with
  dead links, 533 with no state tag, no written inclusion rule anywhere.
