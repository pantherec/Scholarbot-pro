# MeritLaunch

Your story is the application. We just help you tell it.

Scholarship matching and letter drafting for high school students and their families.
Live at [meritlaunch.com](https://meritlaunch.com).

> The repo folder and the Vercel project are still named `Scholarbot_Pro` / `scholarbot-pro`
> for historical reasons. The product is MeritLaunch. Renaming the Vercel project would
> break the preview-origin allowlist in `api/_shared/auth.js` and require re-pointing the
> Stripe webhook endpoint, so it stays as-is for now.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite, single-file app in `src/App.jsx` (inline styles, no Tailwind) |
| API | Vercel serverless functions in `api/` (8 endpoints + `_shared/auth.js`) |
| Letters | Claude Sonnet 5 via `api/generate-stream.js` (server-side key, SSE streaming) |
| Data / auth | Supabase (Postgres + Auth + RLS) |
| Payments | Stripe Checkout — Premium $9.99/mo, Seasonal Pass $29.99 one-time |
| Analytics | PostHog (US Cloud) |

## Local development

```bash
npm install
npm run dev
```

`api/*` functions do not run under the Vite dev server. Environment variables live in
`.env` locally and in Vercel for Production/Preview; note that Vercel bakes them at
**build** time, so changing one requires a redeploy.

## Layout

```
src/App.jsx                 Main app (~2,900 lines)
src/legalContent.js         Privacy Policy + Terms of Service copy
src/analytics.js            PostHog wrapper (no-ops without VITE_POSTHOG_KEY)
api/                        Serverless functions
docs/                       Audits and planning docs
scholarship_hunter.py       Crawler
scholarship_link_verifier.py  Quarterly dead-link check
scholarship_master_clean.csv  Master dataset
```

`scholarbot-pro.jsx`, `Version 3/`, `Version 4/`, `Version 5/`, and
`Scholarship Verifier and Scholarbot Pro ver 2/` are dead pre-Vite copies. They are not
part of the build.

## Security

See [SECURITY.md](SECURITY.md).
