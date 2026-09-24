# MeritLaunch — Launch Tasks (updated 2026-09-23)

The product is live and billing is proven (real charge → webhook → premium, validated 2026-07-10).
Everything that can be done in code is done — including these, finished since the last version of
this doc: COPPA age gate, PostHog analytics fix, share layer (OG image/favicon), deadline-aware
search, expired-listing monthly auto-recheck, and Sentry client wiring (inert until you add a DSN).

What remains needs **your logins**, in priority order:

---

## 1. Resend — verify meritlaunch.com so deadline-alert emails actually deliver ⚠️ TOP PRIORITY

Premium sells "deadline alert emails." The cron runs daily, but the domain has **zero Resend DNS
records**, so sends are unauthenticated (spam-filed or dropped). This is a paid-tier promise not
being kept.

1. https://resend.com → **Domains → Add Domain** → `meritlaunch.com`.
2. Add the DNS records Resend shows (DKIM + return-path `send.` subdomain) in **Vercel DNS**
   (that's where meritlaunch.com lives). The existing Google Workspace SPF at the apex needs
   **no change** — Resend uses its own subdomain for the return path.
3. Wait for **Verified**, then create an API key (`re_...`).
4. Vercel → scholarbot-pro → Settings → Environment Variables (Production + Preview):
   - `RESEND_API_KEY` = `re_...`
   - `RESEND_FROM` = `MeritLaunch <alerts@meritlaunch.com>`
5. **Redeploy** (env vars bake at build time).
6. Confirm one send appears in Resend → Emails after the next 9:00 UTC cron.

**Order matters:** verify the domain BEFORE setting the key — with the key set and the domain
unverified, every send throws instead of skipping gracefully.

---

## 2. Run the E2E test pass (the gate before marketing spend)

Everything is staged in `test-profiles/` — 5 diverse fake seniors, full essays, load script.

1. Sign up the 5 accounts in the app UI (emails are `coreyskinner+ml-*@gmail.com` aliases —
   confirmations land in your inbox).
2. Run `test-profiles/test_profiles_load.sql` in the Supabase SQL editor (matches on email).
3. Per profile: matching → all 4 letter templates → tracker → free-tier usage gates.
4. Full workflow + field reference: `test-profiles/README.md`.

This is also where the first **testimonial/outcome material** comes from — the site still has
zero social proof, the last big conversion gap.

---

## 3. Supabase — enable leaked-password protection (2 minutes)

Supabase → project `zudczsepvkjbjgomgilz` → **Authentication → Attack Protection** → turn ON
"Leaked password protection" → Save. Clears the last standing security-advisor WARN. Only affects
new sign-ups/password changes.

---

## 4. Sentry — create the account; the code is already wired

The client init ships in `src/main.jsx`, inert until a DSN exists.

1. https://sentry.io → Create Project → **React** → copy the DSN.
2. Vercel env var: `VITE_SENTRY_DSN` = the DSN (Production + Preview) → redeploy.
That's it — no code step needed anymore.

---

## 5. Marketing — the season is NOW

Peak scholarship season (Oct–Nov urgency window) has started. Free channels first, per the
commercialization playbook:
- TikTok/Reels ("how much I got in scholarships" format), r/scholarships, r/ApplyingToCollege,
  Product Hunt.
- **Audit the social handles** — @MeritLaunch on IG/TikTok/X/LinkedIn was never confirmed claimed.
- Existing assets: `launch-assets/`, `MeritLaunch_LinkedIn_Content.md`, `portfolio-email-kit/`.

---

## 6. Trademark clock (passive — just watch the inbox)

MERITLAUNCH (USPTO serial 99899282, ITU, filed 2026-06-22): first examiner review typically lands
**Nov–Dec 2026**. Watch synpraxlabs@gmail.com (cc coreyskinner@gmail.com) for USPTO mail. After the
Notice of Allowance: file the **Statement of Use (~$150)** with a meritlaunch.com screenshot
(logo + service visible) as the specimen. Don't let the NoA deadline lapse.
