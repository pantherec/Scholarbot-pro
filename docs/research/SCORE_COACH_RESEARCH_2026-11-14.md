# Score coach: research and feasibility, 2026-11-14

Two inputs for the proposed paid "score coach": what reputable sources say scholarship providers
weigh, and what MeritLaunch's own matcher and catalog can truthfully report today.

**Rule for anything shown to a student:** a general claim needs a source in the "usable" table
below. A count ("opens 63 more awards") must come from the catalog at the moment it is shown.

## 1. What providers say they weigh (usable: page opened and read)

| # | Finding | Source | Kind |
|---|---|---|---|
| 1 | Coca-Cola Scholars needs a verifiable 3.0 GPA; judged on leadership, academics and service; no weights published | coca-colascholarsfoundation.org/apply | provider's stated criteria, 2026-27 |
| 2 | Hispanic Scholarship Fund: 3.0 for high school applicants, 2.5 for college; FAFSA required | hsf.net/scholarship | provider's stated criteria, 2026 |
| 3 | Gates Scholarship: 3.3 weighted GPA, Pell-eligible; looks for leadership through service and activities, and "personal success skills" | thegatesscholarship.org/scholarship | provider's stated criteria, 2026-27 |
| 4 | Jack Kent Cooke: 3.75 unweighted GPA, family income up to $95,000, one test result with no minimum; leadership means initiative and contribution | jkcf.org (college scholarship program, how to apply) | provider's stated criteria, 2026-27 |
| 5 | Dell Scholars: 2.4 GPA, Pell-eligible, an approved college-readiness program in grades 11 and 12 | dellscholars.org/scholarship | provider's stated criteria, 2027 cycle |
| 6 | Florida Bright Futures: 3.50 weighted (Academic Scholars) or 3.00 (Medallion) over 16 college-prep courses; 100 or 75 service hours, paid work accepted; test scores required | floridastudentfinancialaidsg.org/pdf/fas-fms.pdf | state program rule, 2026-27 |
| 7 | Elks Most Valuable Student rubric: 1,000 points. Leadership 550 (service 150, extracurriculars 150, essay 150, honors 50, employment 50), Academics 350, Financial need 100 | Elks National Foundation, "2023 MVS Scoring Rubric and Guidelines" (PDF) | provider's own published rubric, 2023 |
| 8 | Elks tells judges to weigh service "quality over quantity", looks for positions of increasing responsibility over four years, and counts unpaid family work (caring for siblings, a family farm or business) as employment | same rubric | provider's own published rubric, 2023 |
| 9 | Elks academics: GPA, rank against class size, honors/AP/IB/dual-enrollment load, senior schedule | same rubric | provider's own published rubric, 2023 |
| 10 | Ron Brown: academics, leadership, writing, service and need; three essays, two recommendations; no test required | ronbrown.org/ron-brown-scholarship | provider's stated criteria, 2026 |
| 11 | QuestBridge College Prep Scholars is for juniors; expects "primarily A's in the most challenging courses offered"; 2026 scholars averaged a 3.93 unweighted GPA | questbridge.org (college prep scholars) | provider's stated criteria and data |
| 12 | Common App's activities guide invites family responsibilities and jobs, and says to focus "not on the number" | commonapp.org activities resource, 2025 | application platform guidance |
| 13 | Juniors can already apply for scholarships | blog.collegeboard.org/scholarships-high-school-juniors (2023) | College Board guidance |
| 14 | Scam signs: a guarantee, a request for card or bank details, an upfront fee | consumer.ftc.gov (how to avoid scholarship and financial aid scams) | federal consumer guidance |
| 15 | College admission (not scholarships): grades in college-prep courses matter most (76.8% of colleges "considerable importance"), curriculum strength 63.8%, test scores 4.9%, rank 5.5%, extracurriculars 6.5%, work 2.2% | NACAC, Factors in the Admission Decision, Fall 2023 | association survey |

Elks' current page gives no weights, so finding 7 is dated 2023 wherever it is shown.

## 2. Not usable yet (page would not load, or a search summary only)

National Merit's grade-11 PSAT rule; President's Volunteer Service Award hour tiers (possibly
paused); Horatio Alger's own criteria; UNCF criteria; studentaid.gov FAFSA pages; BigFuture on
outside awards reducing aid. Re-check each on its own site before use.

## 3. What reputable sources do not support

- No published data on how common each GPA minimum is across scholarships. Ranges online come
  from aggregator sites. MeritLaunch's own catalog count (section 4) is the honest substitute.
- Rubric weights exist only for Elks. No other provider publishes them.
- Nothing supports "do X and win more". Sources support eligibility rules and stated criteria only.
- NACAC measures college admission, not private scholarships. Label it that way.

## 4. What our own catalog shows (live, 2026-11-14)

824 listings are open. Read with the matcher's GPA rule:

| | Count |
|---|---|
| Listings that state a GPA minimum | 136 |
| Open to a 2.5 GPA | 34 |
| Open to a 2.75 | 42 |
| Open to a 3.0 | 105 |
| Open to a 3.5 | 127 |
| Open to a 3.75 | 136 |

The 3.0 line is the large step: 63 more listings open between 2.75 and 3.0. The most common
stated minimums are 3.0 (56 listings), 2.5 (20), 3.5 (11) and 2.0 (10).

Text mentions are thin: leadership 22 listings, community service 18, an essay 47, "seniors"
67, juniors or sophomores 33. Need-based: 258.

## 5. What the matcher reports for one change at a time (three test profiles)

| Profile | Matches now | GPA change tested | New matches | Adding service or a leadership role | Adding one activity |
|---|---|---|---|---|---|
| Maria, 3.9 | 58 | to 4.0 | 0 | 0 | 0 to 2 |
| Wei, 3.6 | 41 | to 3.75 | 2 | 0 | 0 to 2 |
| Lexi, 3.5 | 54 | to 3.75 | 4 | 0 | 0 to 2 |

Dropping any of them to a 2.5 removes 27 to 35 matches. So the GPA effect is real and large for
students near or below 3.0, and small for students already above 3.5. Service and leadership show
no effect because the catalog's text rarely states them, not because providers ignore them
(findings 7 and 8 say they matter a great deal). Average match score is 16 to 19 out of 100: the
score measures how specific the fit is, and is not a percentage chance.

## 6. What this means for the feature

1. **Buildable now and accurate:** the per-match breakdown, and a GPA ladder ("at a 3.0 you
   qualify for N more awards on our list"), both counted from the catalog.
2. **Buildable now with sources:** guidance cards drawn from section 1, each naming its source.
3. **Not accurate yet:** "add this activity and your score rises by N". The catalog does not
   record what each provider weighs. It needs the structured fields in the sourcing skill
   (`meritlaunch-scholarship-sourcing`) filled for existing listings first.
4. **Wording:** "awards you qualify for", never "chance of winning". The score should be called a
   fit score, not a match percentage.
