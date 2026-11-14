# MeritLaunch product review, 2026-11-14 (sixth review)

Reviewed: `main` at `b18b58b`, which is what is live. Three merged critics (1+2+5, 3+4, 6+7).
The lead reproduced the three new blockers and the account-deletion finding against the code.

## Scorecard

| Lens | 11-11 | 11-14 | Gap to 9 |
|---|---|---|---|
| 1 Visual design and brand | 7 | 7 | 2 |
| 2 Information architecture | 7.5 | 7 | 2 |
| 3 Core task flow | 6.5 | 7 | 2 |
| 4 Trust, integrity and copy | 6.5 | 6 | 3 |
| 5 Accessibility and mobile | 7 | 7 | 2 |
| 6 Performance and technical quality | 7 | 7.5 | 1.5 |
| 7 Conversion and commercial readiness | 6.5 | 7 | 2 |
| **Composite** | **6.9** | **6.9** | |

The composite did not move. The sign-up, billing and infrastructure fixes raised three lenses;
the features shipped on 11-14 (stored work, score breakdown, tour, past-cycle section) brought
new defects that lowered trust and layout.

## 11-11 blockers: all five closed

B1 date of birth kept after a password error; B2 expired link now explains itself; B3 sign-up
email sends; B4 second plan refused at checkout; B5 reminder emails need `EMAIL_REMINDERS_LIVE`.
Also closed: rate limiter (new Upstash host answers), Sentry live, webhook retries on a failed
write. Tests: 137 of 137. First clean letter draft in three reviews (no invented details).

## Blockers (3, all new, all reproduced by the lead)

1. **Opening dates are shown as deadlines.** `src/lib/deadline.js` reads any text with a month
   in it as a due date. "Reopens Dec 2026" shows "17d left"; "Opens October 1, 2026" shows
   "Closed this cycle" and files an open award under "Not open right now". 42 closed listings
   carry free-text dates. Fix: treat strings starting with Opens, Reopens, Recipients, Awards,
   Announced or FAFSA priority as undated, in the client and `api/_shared/deadline.js`, with tests.
2. **Sign-out can wipe work that never reached the account.** If `loadStudentWork` returns
   nothing (`src/App.jsx:712-724`), syncing never starts and the status stays "saved", so
   sign-out clears the browser with no warning. Fix: start the status at "unknown", retry the
   load, and warn before sign-out unless the status is "saved" after a real sync.
3. **The privacy policy overstates what is stripped.** `legalContent.js:27` says contact details
   are removed from practice answers, voice notes and styles. Only resume and brag sheet text is
   scrubbed (`App.jsx:1273`). Fix: scrub the other three before saving, or correct the sentence.

## Majors

**Trust and flow**
4. "Why this score" says false things: "+5 For graduating seniors" with no grade check; field
   matching fires on "law" inside "legally blind"; the wrong field is blamed for service points.
5. The fact check treats "may" and "march" as months (`factcheck.js:27`), and "That's true, use
   the example" is one click (`LetterWriter.jsx:420`).
6. The account's copy overwrites newer work in the browser, and a stale tab can overwrite the
   account.
7. The resume upload card is not behind the age question (`ProfileBuilder.jsx:148`).

**Money**
8. One student can still be charged twice: the paid check runs only when checkout starts, a
   parent link stays usable until the webhook marks it, and `parent-pay.js:82` continues when
   the plan lookup fails. A second Season Pass restarts the 6 months.
9. Deleting an account can leave a subscription billing: `api/_shared/account.js:26` ignores a
   failed profile read, so the cancel step is skipped. The cancel branch is still untested.
10. The parent funnel is not measured: guest events are dropped (`analytics.js:38`).
11. Sentry adds a 159 KB chunk to every page (`src/main.jsx:11`).

**Look and reach**
12. The tour opens over the age question on a first visit to `/app/profile`.
13. `LinkButton` drops `aria-expanded` and is 17 px tall (`src/ui/components.jsx:134`); this
    affects "Why this score", "Skip the tour" and the dialog links.
14. Saved Letters breaks at 390 px (title squeezed to 90 px wide; `SavedLetters.jsx:36`).
15. Danger red `#e04040` is 4.32:1 on cards; `urgentText` is 7.48:1.
16. The delete buttons sit above "See my matches" on every profile visit.
17. Sign-in dialog: no `aria-invalid`, no close button, rules printed twice (carried from 11-11).

## Minors

Plan card says "Half the cost of 6 months of Premium" ($29.99 against $59.94); fake "Thank you"
with `?status=paid`; no refund handler; payment-failed email goes to the student and ignores the
email switch; sitemap dated 2026-09-30; "Checkout didn't start:" shown before the already-paid
message; Browse search layout shift on phones (0.36-0.40 live); Matches pulls in the Write a
Letter chunk; Tour loaded eagerly; red "Last offered" line reads as an alarm; tour and expired-link
dialog can open together; outlines saved as drafts without a label; typo at `LetterWriter.jsx:403`;
stale Upstash line 6 in `.env`.

## Experience moments

- **One plan, one charge:** webhook refunds a payment for a student who already has a plan.
- **Your number, free:** free Score Coach shows "you meet N of M awards with a GPA minimum".
- **The receipt reaches the payer:** failed-payment and refund mail goes to the Stripe customer.
- **The parent's ten seconds, counted:** cookieless event count through `api/usage.js`.
- **Dates you can trust:** an "Opens" date is shown as "Opens Dec 2026", never as a deadline.
- **Tour when it helps:** a one-line offer on Home after the first matches, not a modal first.

## Build lanes (no shared files)

- **A, dates:** `src/lib/deadline.js`, `api/_shared/deadline.js`, tests.
- **B, stored work and privacy:** `src/App.jsx` sync region, `src/lib/scrub.js`, `legalContent.js`.
- **C, score breakdown and fact check:** `src/lib/matching.js`, `src/lib/factcheck.js`, `LetterWriter.jsx`.
- **D, money:** `api/stripe-webhook.js`, `api/parent-pay.js`, `api/_shared/account.js`, `plans.js`.
- **E, look and reach:** `src/ui/components.jsx`, `SavedLetters.jsx`, `Tour.jsx`, `ProfileBuilder.jsx`, `AuthModal.jsx`, `src/main.jsx`.

## Protect

Colour and type tokens (0 literal font sizes in views); matches grouped by deadline with the free
score breakdown; the shared `Modal`; `plans.js` as the one source of plan facts with tests tying
it to the server; the parent page that shows no student data; 0 axe violations on public pages.

## Not tested

Stripe-cancel branch of account deletion; guest work pushed on first sign-up; 180-day purge;
screen-reader announcement of dialog errors.
