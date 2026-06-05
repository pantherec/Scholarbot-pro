# MeritLaunch — Step-by-Step Launch Guide
*Written for a click-by-click walkthrough. Your specifics are filled in. Do the sections in order. Budget ~60–90 minutes.*

**Your specifics (keep handy):**
- Supabase project ref: `zudczsepvkjbjgomgilz` — dashboard: https://supabase.com/dashboard/project/zudczsepvkjbjgomgilz
- Supabase URL: `https://zudczsepvkjbjgomgilz.supabase.co`
- Stripe price IDs in code: Premium `price_1TCNywCKmFEw0ke8GFSBvuVc` · Seasonal `price_1TCNzyCKmFEw0ke8Ej82CRAM`
- Webhook path the app expects: `/api/stripe-webhook`
- Deploy: Vercel (auto-deploys from your GitHub main branch)

---

## STEP 1 — Set the environment variables in Vercel (the #1 launch blocker)

If these aren't set, the app silently falls back to localStorage-only mode (no accounts, no billing).

1. Go to https://vercel.com and sign in. Click your **MeritLaunch / ScholarBot** project.
2. Top nav: **Settings** → left sidebar: **Environment Variables**.
3. For each variable below: type the **Key**, paste the **Value**, leave Environment set to **Production, Preview, and Development** (all three checked), click **Save**.

| Key | Value / where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys. Powers letter generation. |
| `VITE_SUPABASE_KEY` | Supabase → Project Settings → **API** → "anon / public" key. **Must start with `VITE_`** or the frontend won't see it. |
| `SUPABASE_SERVICE_KEY` | Supabase → Project Settings → **API** → "service_role" key (secret — server only). |
| `SUPABASE_URL` | `https://zudczsepvkjbjgomgilz.supabase.co` (optional; code has this as a fallback). |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys → **Secret key** (use the **live** one, starts `sk_live_`). |
| `STRIPE_WEBHOOK_SECRET` | You'll get this in Step 2 (starts `whsec_`). |
| `CRON_SECRET` | Make up a long random string (e.g. from a password manager). Protects the daily deadline cron. |
| `RESEND_API_KEY` *(optional)* | resend.com → API Keys. Enables deadline reminder emails (Step 8). |
| `RESEND_FROM` *(optional)* | A verified Resend sender, e.g. `MeritLaunch <alerts@meritlaunch.com>`. |

4. **Important:** Vercel only applies env-var changes on a **new deployment**. After Step 2 you'll redeploy once (Step 5), which picks them all up.

> How to find the Supabase keys: Supabase dashboard → bottom-left **Project Settings** (gear) → **API**. "Project URL", "anon public", and "service_role" are all on that page. Treat `service_role` like a password.

---

## STEP 2 — Point Stripe at your webhook and confirm LIVE mode

The app's billing only works if Stripe can notify it of completed payments.

**2a. Switch Stripe to Live mode.** Top-right of the Stripe dashboard, toggle from **Test mode** to **Live mode**. (Test and live have *separate* keys, products, and prices.)

**2b. Confirm your two price IDs exist in LIVE mode.** Stripe → **Product catalog** → check that Premium and Seasonal products exist with prices matching the IDs above (`price_1TCNyw…` and `price_1TCNzy…`).
- If those IDs only exist in **Test** mode, create the products in Live mode, copy the new live `price_…` IDs, and update them in `src/App.jsx` lines 55–56 (`STRIPE_PRICES`). Tell me and I'll swap them for you.

**2c. Create the webhook endpoint.** Stripe → **Developers** → **Webhooks** → **Add endpoint**.
- **Endpoint URL:** `https://YOUR-DOMAIN/api/stripe-webhook` (use `https://meritlaunch.com/api/stripe-webhook` after Step 7, or your current `…vercel.app/api/stripe-webhook` for now).
- **Events to send:** click "Select events" and add: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
- Click **Add endpoint**, then on the endpoint page click **Reveal** under "Signing secret" and copy the `whsec_…` value → paste it into Vercel as `STRIPE_WEBHOOK_SECRET` (Step 1).

---

## STEP 3 — Redeploy so Vercel picks up the variables

1. Vercel → your project → **Deployments** tab.
2. Click the **⋯** menu on the most recent deployment → **Redeploy** → confirm **Redeploy**.
3. Wait for "Ready." (Or just `git push` any small change — it auto-deploys.)

---

## STEP 4 — End-to-end billing test (the one that proves the bug is fixed)

This verifies the fix that was the whole point of the audit: that a payment actually upgrades the user in the database.

1. Open the live site, **sign up** with a real test email, and confirm the account (check email).
2. Click **Upgrade / Premium** and complete checkout. In **Live** mode use a real card; or temporarily test the flow in **Test** mode using card `4242 4242 4242 4242`, any future expiry, any CVC (test mode needs the test keys + a test-mode webhook).
3. Verify in the database: Supabase dashboard → **Table Editor** → `user_profiles` → find your row → confirm **`subscription_status` = `premium`**.
4. **Then reload the app** and confirm you're still Premium. (Before the fix, the app faked the upgrade until reload, then dropped you to free. If it sticks after reload, the webhook wrote to the DB correctly.)
5. Cross-check Stripe → your webhook endpoint → **Events** tab shows `checkout.session.completed` delivered with a **200** response. If it shows an error, click it to see why.

If `subscription_status` did **not** change to premium: the webhook isn't reaching the DB — usually `STRIPE_WEBHOOK_SECRET` mismatch or the endpoint URL is wrong. Fix and use "Resend" on the event to retry.

---

## STEP 5 — Turn on Supabase leaked-password protection (2 minutes)

The only security advisor left (the others were fixed in code/SQL this session).

1. Supabase dashboard → **Authentication** → **Policies**… actually: **Authentication** → **Providers** → scroll to **Password** settings, OR **Authentication** → **Settings**.
2. Find **"Leaked password protection"** (checks new passwords against HaveIBeenPwned) → toggle **ON** → Save.

---

## STEP 6 — Rotate the unused Gemini key

Your `.env` has a live Google Gemini key the app no longer uses (it was for the old crawler). Live secrets shouldn't sit around.

1. Go to https://aistudio.google.com/app/apikey (or Google Cloud Console → APIs & Services → Credentials).
2. **Delete/revoke** the existing key. If your data-pipeline Python scripts still need Gemini, create a new key and put it only where those scripts run — not in the deployed app.
3. Remove `GEMINI_API_KEY` from the app's `.env` if nothing local uses it.

---

## STEP 7 — Domain cutover to meritlaunch.com (when ready)

The code's CORS list and legal text already point to `meritlaunch.com`.

1. Vercel → project → **Settings** → **Domains** → **Add** → type `meritlaunch.com` (and `www.meritlaunch.com`).
2. Vercel shows DNS records to add. Go to your domain registrar (where you bought meritlaunch.com) → DNS settings → add the records Vercel lists (usually an `A` record to `76.76.21.21` and a `CNAME` for `www`). Save.
3. Back in Vercel, wait for the domain to show **Valid Configuration**.
4. Update your **Stripe webhook URL** (Step 2c) to the new `https://meritlaunch.com/api/stripe-webhook`.
5. Optional cleanup: once everything works on the new domain, I can remove the legacy `scholarbot-pro.vercel.app` line from the CORS list.

---

## STEP 8 — Email for deadline reminders (code is DONE — just add the keys)

`api/deadline-alerts.js` now sends a per-student digest email via Resend. It sends only when `RESEND_API_KEY` is set; otherwise it silently skips email and still writes in-app notifications. To turn it on:
1. Create a free account at https://resend.com.
2. **Verify your sending domain** (Resend → Domains → add `meritlaunch.com`, then add the DNS records they give you at your registrar). For a quick test before the domain verifies, you can use Resend's sandbox sender `onboarding@resend.dev`.
3. Create an API key (Resend → API Keys).
4. Add to Vercel (Step 1): `RESEND_API_KEY` = your key, and `RESEND_FROM` = `MeritLaunch <alerts@meritlaunch.com>` (or `MeritLaunch <onboarding@resend.dev>` for the sandbox test).
5. Redeploy. To test immediately, hit the endpoint with your cron secret: `curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR-DOMAIN/api/deadline-alerts` — the JSON response shows `emailsSent` and `emailEnabled`.

---

## Quick reference: what's already done vs. what's on you
- **Done in code/DB this session:** the billing PK bug, status constraint, RLS lockdown, NUL-byte build fix, rebrand, fonts, palette, letter reframing, two security-advisor fixes, CORS update.
- **On you (this guide):** Vercel env vars (Step 1), Stripe webhook + live mode (Step 2), redeploy (Step 3), billing test (Step 4), leaked-password toggle (Step 5), rotate Gemini key (Step 6), domain (Step 7), email (Step 8).
