# Security Policy

MeritLaunch handles student personal data (academic, financial-need, and
demographic information used for scholarship matching) and payment data via
Stripe. We take reports of security issues seriously.

## Reporting a Vulnerability

If you find a security vulnerability, please report it privately rather than
opening a public GitHub issue:

- Email: security@meritlaunch.com *(or corey@meritlaunch.com until that
  address is set up — update this once it exists)*

Please include:
- A description of the issue and its potential impact
- Steps to reproduce
- Any relevant request/response examples (with real user data redacted)

We'll acknowledge reports within a few business days. Please give us a
reasonable window to fix an issue before disclosing it publicly.

## What's in place today

- Every sensitive API route (`/api/create-checkout`, `/api/customer-portal`,
  `/api/generate*`, `/api/import-scholarship`) requires a valid Supabase JWT,
  verified server-side — the server never trusts a client-supplied user ID.
- Stripe webhook payloads are signature-verified
  (`STRIPE_WEBHOOK_SECRET`); unsigned payloads are rejected once deployed.
- CORS is restricted to an explicit origin allowlist
  (`api/_shared/auth.js`), not a wildcard.
- Per-user rate limiting on checkout, portal, letter generation, and URL
  import, backed by Upstash Redis in production
  (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`) with an in-memory
  fallback for local dev.
- SSRF protections on outbound URL fetches (`isUrlSafe` in
  `api/_shared/auth.js`) block localhost/private IP ranges.
- Secrets (Stripe, Supabase service role, Anthropic) are only ever read from
  environment variables, never committed to the repo.
- Baseline security headers (HSTS, CSP, X-Content-Type-Options,
  X-Frame-Options, Referrer-Policy, Permissions-Policy) are set in
  `vercel.json`.
- Row Level Security is enabled on Supabase tables that hold user data.

## Known gaps / in progress

- Enable Supabase's leaked-password protection (Authentication → Providers →
  Password, in the Supabase dashboard) — not yet turned on.
- No third-party security audit has been performed.
