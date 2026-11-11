# MeritLaunch product review, 2026-11-11

Fifth critic review. Code under test: `main` at `aaec4cd`, the same code as the live site.
Three merged critics (1+2+5, 3+4, 6+7). No test password was available, so there was no sign-in,
sign-up submit, draft or checkout; signed-in behaviour is judged from code. The run followed a
first tester's failed sign-up the same morning.

**Composite: 6.6 → 6.9.** Not yet ready for the Nov 19 push: the sign-up door still has four ways
to strand a new student, and three money and email defects would reach a paying family.

## Scorecard

| Lens | 10-30 | Now | Change | Gap to 9 |
|---|---|---|---|---|
| 1 Visual design and brand | 7 | 7 | 0 | 2 |
| 2 Information architecture | 7 | 7.5 | +0.5 | 1.5 |
| 3 Core task flow | 7 | 6.5 | −0.5 | 2.5 |
| 4 Trust, integrity and copy | 6 | 6.5 | +0.5 | 2.5 |
| 5 Accessibility and mobile | 6.5 | 7 | +0.5 | 2 |
| 6 Performance and technical quality | 6.5 | 7 | +0.5 | 2 |
| 7 Conversion and commercial readiness | 6.5 | 6.5 | 0 | 2.5 |

## Fixed today, before the review

- Sign-up and reset email: `meritlaunch.com` verified in Resend; one reset email confirmed delivered.
- Plain-language auth errors and password rules under the field (`src/lib/authErrors.js`).
- Reset notice no longer claims an email was sent to an address with no account.

## Blockers

Lead-verified means the lead confirmed the claim in code, DNS or the database after the critics reported.

**B1. A sign-up error wipes the date of birth, so the retry fails.** `src/App.jsx:393` clears the
field before the password check at `:395`. Reproduced 4 of 4 by one critic and 2 of 2 by another,
on live and local. Lead-verified in code. Today's client-side password check made this easier to hit.
Fix: check the password first; clear the date only after `signUp` succeeds or the student is under 13.

**B2. An expired or already-used email link lands on a silent landing page.** Loading
`/#error=access_denied&error_code=otp_expired` shows no dialog and no message, on live and local.
Nothing in `src` reads `error_code` (lead-verified: 0 matches). Mail scanners often use up one-time
links. Fix: read the hash on load and open the dialog with "That link has expired or was already
used", plus Resend and Sign in.

**B3. Signing up with an address that already has an account says "We sent a confirmation link".**
Supabase answers a repeat sign-up with no error and an empty `identities` list; `App.jsx:404-410`
only checks `error`. Lead-verified: no `identities` check exists. Not run against a live account.
Fix: if `data.user.identities.length === 0`, show "This email already has an account."

**B4. A Premium subscriber can buy a Season Pass and be charged for both.** `api/create-checkout.js`
never checks the current plan (lead-verified: no usage or plan lookup in the file). The webhook then
writes `seasonal`, and the next subscription event writes `premium` back. Fix: return 409 for a paid
user, as `api/parent-pay.js:83` already does; hide plan buttons for paid users; add a test.

**B5. Reminder emails are not controlled by the in-app switch.** `api/deadline-alerts.js:146, 210`
send whenever `RESEND_API_KEY` is set; `EMAIL_REMINDERS_LIVE` only changes copy. The privacy policy
says no reminder emails are sent (`src/legalContent.js:56, 108`) and that nothing goes through
Resend today (`:78`), which stopped being true when sign-up email moved to Resend. Whether the key
is set in Vercel is unknown (no access to list it). Lead check: all 7 current alert recipients are
Corey's own accounts, so nothing has reached a student. Fix: a server-side flag in the cron, and
rewrite line 78.

## Majors

1. **Rate-limit database is gone.** The Upstash host in `.env` does not resolve (lead-verified on
   8.8.8.8). The fallback is fast (0.2 s) but each server instance counts alone, so the hourly caps
   on paid AI routes do not hold. Needs Corey: new Upstash database, URL and token in Vercel.
2. **The launch funnel cannot be measured.** Analytics start only after sign-in (`App.jsx:688`), so
   guest and parent events are dropped and there is no UTM capture. Fix: a cookieless `/api/event`
   counter with no personal data, written into the policy.
3. **A failed plan grant goes unnoticed.** `api/stripe-webhook.js:68-86` never checks the Supabase
   `error` and always returns 200, so Stripe does not retry.
4. **Confirming on a second device can lose the guest profile.** A cloud profile holding only
   `ageOk` replaces the full local one (`App.jsx:650-657`). From code, not run.
5. **The 8-second sign-up timeout reports failure for a probable success** (`App.jsx:400`).
6. **Resend-confirmation link appears only after a failed sign-in** (`AuthModal.jsx:39`).
7. **On a phone, an error pushes "Create account" off screen and prints the rules twice.** At
   390×844 the dialog content is 831 px in a 741 px panel. Fix: a one-line hint; the error names
   only what failed.
8. **Errors are not tied to fields and a repeated error is silent** (no `aria-invalid`; the live
   region is re-created each time).
9. **Dialog text links are 17–18 px tall** against a 44 px bar, and the dialog has no close button.
10. **"Listings last checked Nov 11" overstates.** Only 6 of 1,297 rows were checked that day; 465
    in the last 30 days. Fix: show the 30-day count.

## Minors

Password rules shown twice; age asked twice (sign-up, then profile); a new user is greeted
"Welcome back!"; after a reset the student stays on the landing page; dead-link rows still enter
matching; parent "Thank you" shows for anyone adding `?status=paid`; a refunded Season Pass keeps
access; a second Pass restarts the four months; the payment-failed email goes to the student;
Sentry still inert; sitemap dated 09-30; Browse search shifts layout (CLS 0.28–0.34 on a phone);
two skipped heading levels; inline `outline: none` hides the focus ring on dialog fields.

## Closed since 10-30 (measured)

- Rate-limited routes answer in 0.17–0.28 s (were 4.5 s).
- Bare "resident" no longer sends immigration status to the prompt (`prompts.js:91-93`).
- Fact check: an honest fixture must produce 0 chips (`truth.test.js:149-163`).
- Award total reproduced to the dollar from the live catalog ($3,674,580, shown as "$3.6M+").
- Price line in the hero; per-route titles and canonicals on 11 of 11 pages.
- `/api/catalog` cached at the CDN (145 KB, cache HIT).
- axe: 0 violations on 22 local loads; no sideways scroll; 0 literal font sizes in `src/views`.
- Phone menu, combobox scrolling and dialog focus all pass.

One critic claim was wrong: sign-up email does not use Supabase's built-in sender. The auth log
shows it going through Resend SMTP.

## What needs Corey, not code

- New Upstash database; URL and token in Vercel.
- Say whether `RESEND_API_KEY` is set in Vercel (decides whether B5 is live).
- Sentry DSN.
- A refund sentence for the Terms and the parent page.
- The test-account password, so the next review can run sign-in, drafts and checkout.
- On your phone: request a reset, tap the link twice, and note what the second tap shows.

## Experience moments

1. **Sign-up never lies** (B1, B3, majors 5–7): every outcome names the real next step and nothing
   typed is lost. Measure: 0 false "sent" messages across 4 scripted Supabase answers.
2. **The link that always lands** (B2): a confirmed student goes to `/app` with "You're in"; a dead
   link says why and offers a new one. Measure: 0 silent landings across 3 hash fixtures.
3. **My profile follows me** (major 4): guest profile kept on sign-in from any device, 3 of 3.
4. **One plan, one charge** (B4, major 3): a paid user gets "You already have Premium" and a Manage
   billing button; a failed webhook write returns 500.
5. **Emails the policy can vouch for** (B5): server flag, policy text and opt-out change together;
   `emailsSent: 0` while the flag is off.
6. **The parent's ten seconds, counted** (major 2): parent page views and checkout starts counted
   with no identifiers.

## Build waves (lanes share no files)

- **Wave 1, sign-up door:** `src/App.jsx` auth handlers, `AuthModal.jsx`, `authErrors.js`, tests
  (B1, B2, B3, majors 5–9).
- **Wave 1, money:** `api/create-checkout.js`, `api/stripe-webhook.js`, tests (B4, major 3).
- **Wave 1, email truth:** `api/deadline-alerts.js`, `src/legalContent.js` (B5).
- **Wave 2:** `/api/event` counter and policy line; `restoreAccount` merge rule; the "last checked"
  label in `catalogStats.js`.

## Protect

Type scale and tokens; the price line in the hero; plain-language errors; the shared `Modal`'s
focus handling; the AI-policy step and fact-check gate; every landing number computed from live
data; CDN caching on the catalog; the security headers; `plans.js` as the one source of plan facts;
the parent page showing no student data.

## Run notes

- Removing the old worktree folders emptied the repo's `node_modules` mid-run, so the critics served
  the prebuilt `dist/` with a static server instead of `vite preview`. Packages were reinstalled
  afterwards; 89 tests pass.
- The live CSP blocks axe; run axe on local only.
