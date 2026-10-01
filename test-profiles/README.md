# MeritLaunch E2E Test Profiles — Status

**Built:** 2026-08-28 · **Testing scheduled:** week of 2026-08-31 (Corey)

## What's here

| File | Purpose |
|---|---|
| `test_profiles_seed.json` | Machine-readable seed — 5 profiles keyed exactly to `PROFILE_QUESTIONS` in `src/App.jsx` (19 fields) + a `bragSheet` per profile |
| `test_profiles.md` | Human-readable version — bio snapshot, field table, full essays (generated from the seed) |
| `test_profiles_load.sql` | Supabase loader — upserts `user_profiles` (denormalized columns + full `profile_data` jsonb) |

## The five profiles

1. **Jenna Ostercamp** — first-gen rural Iowa, single-parent, rank 2/91, robotics + FFA, ag engineering, Pell-eligible, 1290 SAT
2. **Amara Boyd** — Black poet-organizer at Whitney Young (Chicago), chapbook + walkout, Howard/Medill, moderate need
3. **Daniel Yoon** — Korean-American Fremont pre-med, 4.42W / 1520 SAT, hospital + Science Olympiad + violin, full-pay
4. **Mateo Ávila** — gay Latino, El Paso, citizen in a mixed-status family, carnicería 20 hrs/wk, social work, Pell-eligible
5. **Nora Whitfield** — autistic Classics scholar, wealthy CT, Iliad in Greek at 15, merit-only targets

All essay prose passed a scripted sweep against the `scholarbot-letter-humanizer` banned-language list. Em dashes appear only inside the app's own select-option values, which must match the form verbatim.

## Test workflow

1. Sign up each account in the app UI — emails are `coreyskinner+ml-*@gmail.com` aliases (all confirmations land in Corey's inbox).
2. Run `test_profiles_load.sql` in the Supabase SQL editor (project `zudczsepvkjbjgomgilz`). It matches on `auth.users.email`, so the auth users must exist first.
3. Alternatively, paste field values from `test_profiles.md` into Build Profile manually, and paste each brag sheet into the Brag Sheet box (it is separate app state, not part of the profile object).
4. Exercise per profile: match scoring → letter generation in all 4 style templates → tracker → usage gating.

## Known schema gaps (flagged, not fixed)

The form collects no DOB, weighted GPA, class rank, work experience, volunteer-hour count, guardian info, or first-gen/LGBTQ+/disability/religion fields — that context reaches letter gen only through the three essay textareas and the brag sheet. `saveProfileToSupabase` also writes `grade_level`/`leadership` columns from fields the form never collects (always null — minor dead code).

## Regenerating

Edit `test_profiles_seed.json`, then run `node gen_profiles.mjs` (in this folder) to rebuild the MD + SQL so the three files never drift. The script also re-runs the banned-language sweep and word-count checks.
