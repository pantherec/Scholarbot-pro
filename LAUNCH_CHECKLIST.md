# MeritLaunch — Launch Checklist
*Generated June 2, 2026 during the pre-launch hardening session. Items below need YOU (env/billing/secrets actions I can't take from here).*

## ✅ Done this session (in code + database)
- **Billing bug fixed:** `user_profiles` was queried by a non-existent `user_id` column in the Stripe webhook + app — paying customers were never upgraded in the DB. Now standardized on `id`.
- **applications.status** constraint aligned to the app's vocabulary (interested/in_progress/submitted/accepted/rejected).
- **scholarships** table locked down (removed public insert/update RLS — was anon-writable).
- **Build-breaking NUL bytes** stripped from App.jsx, package.json, stripe-webhook.js, deadline-alerts.js.
- **Rebrand to MeritLaunch** complete in code (UI, title, legal text, package name, logo wordmark).
- **Fonts now load** (Instrument Serif / DM Sans / DM Mono); Tailwind CDN removed; palette restrained to gold/teal/coral; scroll-reveal + tablet breakpoint added.
- **Letters reframed** to authentic-voice / "you stay the author"; ToS authorship clause + letter fidelity guardrail added.
- `.env` now exposes `VITE_SUPABASE_KEY` (local dev was silently running without Supabase).

## 🔧 BLOCKERS — do before taking real money
1. **Vercel env vars:** confirm `VITE_SUPABASE_KEY`, `SUPABASE_SERVICE_KEY`, `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET` are all set. Confirm the two Stripe price IDs are **live-mode**.
2. **End-to-end Stripe test:** run a real checkout and verify `user_profiles.id` flips to `premium` from the webhook (not just the optimistic client state). Replay the webhook in the Stripe dashboard.
3. **Rotate the live Gemini key** in `.env` (it's unused by the app but is a live secret sitting in a synced folder). Rotate in Google AI Studio / Cloud Console.

## ⚠️ HIGH — before/at launch
4. Wire an email provider (Resend/SendGrid) into `api/deadline-alerts.js` — it currently only `console.log`s.
5. Move rate-limiting to Upstash Redis — the in-memory map resets on every serverless cold start.
6. Add error monitoring (Sentry) + analytics (Plausible/PostHog) — you're currently blind to silent failures.
7. Harden the `handle_new_user` Supabase function search_path and enable leaked-password protection. (Do carefully — it's the signup trigger; test signups after.)
8. Domain cutover to meritlaunch.com (update Vercel domain + the CORS allow-list in `api/_shared/auth.js`).

## 🧹 Housekeeping
9. Archive the dead JSX copies: root `scholarbot-pro.jsx`, `Version 3/`, `Version 4/`, `Version 5/`, `Scholarship Verifier and Scholarbot Pro ver 2/`. Only `src/App.jsx` is live.
10. Optional: replace the regex PDF brag-sheet parser (garbles real PDFs) or set expectations to text/Word.

## 💅 Premium lift (post-blocker)
11. Stronger social proof (a real testimonial/outcome; swap weakest "stat" for a usage metric).
12. Custom imagery + one layout point-of-view moment (the "kitchen table" motif) — see `meritlaunch-master-skill/references/premium-website-playbook.md`.
