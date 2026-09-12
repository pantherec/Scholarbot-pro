---
name: Shared Ecommerce (Stripe + Supabase + Vercel)
description: Use this skill when adding or auditing billing/checkout/subscriptions on any site under the same parent company — same Vercel team, same Supabase org, same Stripe account, same bank account. Covers Stripe Checkout (redirect-based) + webhook + customer portal, Supabase auth/user_profiles/RLS, Vercel env var + security header setup, coupon/promo scripts, and the specific bugs this pattern has already hit in production (reload losing Premium status, restricted-key permission errors, test/live key-price mismatches, wildcard CORS, webhook signature bypass). Triggers on "add billing", "add Stripe", "add checkout", "add subscriptions", "new site for the parent company", "set up payments", "coupon code", "promo code", "webhook not updating", "premium status not sticking", "customer portal", or when copying the billing pattern from one site (e.g. MeritLaunch) to another (e.g. a new site under the same company).
---

# Shared Ecommerce Pattern

This is the reference implementation, extracted from MeritLaunch (`pantherec/Scholarbot-pro`), for any new site that bills customers under the same parent company. All sites share **one Vercel team**, **one Supabase org**, **one Stripe account**, and **one bank account** — but each site is its own Vercel project, its own Supabase project, and (recommended) its own scoped Stripe key. Read the "Shared-account gotchas" section before assuming anything is automatically isolated between sites.

## Architecture

- **Checkout:** server-side, redirect-based Stripe Checkout Sessions — no Stripe.js/Elements on the client, no `pk_...` publishable key needed in the app at all.
- **Auth + data:** Supabase (its own project per site), JWT-based auth, a `user_profiles` table holding `subscription_status`, `stripe_customer_id`, `stripe_subscription_id`, usage counters.
- **Billing sync:** a Stripe webhook (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`) is the *only* thing allowed to flip `subscription_status` — the client never trusts its own optimistic state as the source of truth after reload.
- **Hosting:** Vercel serverless functions under `api/`, one project per site.

## New-site setup checklist

1. **Stripe** (same account, new Products): create the site's Products/Prices in **live mode**. Note down each `price_...` ID.
2. **Stripe API key — do not reuse a Standard key across sites.** Create a **Restricted key** scoped to just what checkout needs: Checkout Sessions (write), Customer Portal (write), Customers (read/write), Subscriptions (read/write). One compromised site's key should not expose every other site's Stripe data. Give it explicit permissions — a Restricted key with "Access policy: None" will fail every API call it needs to make.
3. **Stripe webhook:** register a new endpoint per site at `https://<site-domain>/api/stripe-webhook`, live mode, events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. Copy its signing secret into that site's `STRIPE_WEBHOOK_SECRET`.
4. **Supabase:** new project under the same org. Run the `user_profiles` schema + RLS below. Set `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (server-only), `VITE_SUPABASE_KEY` (anon, client-safe).
5. **Vercel:** new project under the same team. Set all env vars below, scoped to Production + Preview (not Development — the local dev server doesn't execute `api/*` functions anyway). Mark `STRIPE_SECRET_KEY` and `SUPABASE_SERVICE_KEY` as **Sensitive**.
6. **Upstash Redis:** can be shared across sites (just prefix rate-limit keys per site, e.g. `sitename:ratelimit:...`) or per-site — either works with the code below.
7. Run the end-to-end test in "Verifying it actually works" before calling it done.

### Required env vars per site

| Var | Where it's used | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | server | Restricted key, live mode, Sensitive |
| `STRIPE_WEBHOOK_SECRET` | server | from that site's own webhook endpoint |
| `SUPABASE_URL` | server + client | that site's own Supabase project |
| `SUPABASE_SERVICE_KEY` | server only | Sensitive — full DB access |
| `VITE_SUPABASE_KEY` | client (Vite-exposed) | anon/public key, safe to expose |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | server | optional; falls back to in-memory without it |
| `ANTHROPIC_API_KEY` | server only | only if the site does AI generation server-side |

## Supabase schema

```sql
create table user_profiles (
  id uuid primary key references auth.users(id),
  subscription_status text default 'free', -- free | premium | seasonal
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_end timestamptz,
  seasonal_expires_at timestamptz,
  letters_used_this_month int4 default 0, -- rename per site's usage unit
  matches_used_this_month int4 default 0,
  usage_reset_date date,
  usage_reset_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table user_profiles enable row level security;
create policy "Users can view own profile" on user_profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on user_profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on user_profiles for insert with check (auth.uid() = id);
```

The `handle_new_user` trigger that creates a row on signup must have `search_path` locked down (`SET search_path = public, pg_temp`) and be `SECURITY DEFINER` — check this on every new project, it's a real Supabase security-advisor finding, not hypothetical.

## `api/_shared/auth.js` — copy this whole file per site

```js
import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

// Replace with this site's real domains. Never use "*" — every /api/*
// endpoint that sets CORS headers should go through this.
const ALLOWED_ORIGINS = new Set([
  "https://YOUR-DOMAIN.com",
  "https://www.YOUR-DOMAIN.com",
  "http://localhost:5173",
]);
const PREVIEW_ORIGIN_RE = /^https:\/\/YOUR-VERCEL-PROJECT-[a-z0-9-]+\.vercel\.app$/;

export function applyCors(req, res) {
  const origin = req.headers.origin;
  const isAllowed = !!origin && (ALLOWED_ORIGINS.has(origin) || PREVIEW_ORIGIN_RE.test(origin));
  res.setHeader("Access-Control-Allow-Origin", isAllowed ? origin : "https://YOUR-DOMAIN.com");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export async function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { user: null, error: "Missing or invalid Authorization header" };
  }
  const token = authHeader.replace("Bearer ", "");
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return { user: null, error: error?.message || "Invalid or expired token" };
    return { user, error: null };
  } catch {
    return { user: null, error: "Authentication failed" };
  }
}

// Rate limiting: Upstash Redis when configured (shared across serverless
// instances), in-memory fallback otherwise (resets on cold start — fine for
// local dev, not real protection in production).
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;

const rateLimitStore = new Map();
function checkRateLimitInMemory(key, maxRequests, windowMs) {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  if (!record || now - record.windowStart > windowMs) {
    rateLimitStore.set(key, { windowStart: now, count: 1 });
    return { allowed: true, remaining: maxRequests - 1 };
  }
  record.count++;
  if (record.count > maxRequests) return { allowed: false, remaining: 0 };
  return { allowed: true, remaining: maxRequests - record.count };
}

export async function checkRateLimit(key, maxRequests = 10, windowMs = 3600000) {
  if (!redis) return checkRateLimitInMemory(key, maxRequests, windowMs);
  try {
    const redisKey = `ratelimit:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) await redis.expire(redisKey, Math.ceil(windowMs / 1000));
    if (count > maxRequests) return { allowed: false, remaining: 0 };
    return { allowed: true, remaining: maxRequests - count };
  } catch (err) {
    console.error("Rate limit Redis error, falling back to in-memory:", err.message);
    return checkRateLimitInMemory(key, maxRequests, windowMs);
  }
}
```

## `api/create-checkout.js`

```js
import Stripe from "stripe";
import { verifyAuth, checkRateLimit, applyCors } from "./_shared/auth.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { user, error: authError } = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: authError || "Authentication required" });

  const rl = await checkRateLimit(`checkout:${user.id}`, 5, 3600000);
  if (!rl.allowed) return res.status(429).json({ error: "Too many checkout attempts. Please wait a bit." });

  try {
    const { priceId, mode } = req.body;
    if (!priceId) return res.status(400).json({ error: "Missing priceId" });
    const origin = req.headers.origin || "https://YOUR-DOMAIN.com";

    const sessionParams = {
      mode: mode || "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}?checkout=cancelled`,
      // NEVER trust a client-supplied user id — use the authenticated user.
      metadata: { supabase_user_id: user.id },
      allow_promotion_codes: true,
    };
    if (user.email) sessionParams.customer_email = user.email;
    if (sessionParams.mode === "subscription") {
      sessionParams.subscription_data = { metadata: { supabase_user_id: user.id } };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return res.status(500).json({ error: error.message });
  }
}
```

`api/customer-portal.js` follows the identical shape, calling `stripe.billingPortal.sessions.create({ customer: customerId, return_url })`.

## `api/stripe-webhook.js` — fail closed, always

```js
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export const config = { api: { bodyParser: false } };

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const isDeployed = !!process.env.VERCEL;

  let event;
  try {
    const rawBody = await buffer(req);
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } else if (isDeployed) {
      // Never trust an unsigned payload once deployed — anyone could POST a
      // fake "payment completed" event. Only skip verification locally.
      console.error("STRIPE_WEBHOOK_SECRET is not set — refusing unverified webhook payload.");
      return res.status(500).json({ error: "Webhook not configured" });
    } else {
      event = JSON.parse(rawBody.toString());
    }
  } catch (err) {
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.supabase_user_id;
        if (!userId) break;
        if (session.mode === "subscription") {
          await supabase.from("user_profiles").update({
            subscription_status: "premium",
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            updated_at: new Date().toISOString(),
          }).eq("id", userId);
        }
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const userId = sub.metadata?.supabase_user_id;
        if (!userId) break;
        const appStatus = ["active", "trialing"].includes(sub.status) ? "premium" : "free";
        await supabase.from("user_profiles").update({ subscription_status: appStatus, updated_at: new Date().toISOString() }).eq("id", userId);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const userId = sub.metadata?.supabase_user_id;
        if (!userId) break;
        await supabase.from("user_profiles").update({ subscription_status: "free", stripe_subscription_id: null, updated_at: new Date().toISOString() }).eq("id", userId);
        break;
      }
    }
    return res.status(200).json({ received: true });
  } catch (error) {
    return res.status(500).json({ error: "Webhook handler failed" });
  }
}
```

## Client-side: the one bug this pattern already caused in production

**Load subscription status from BOTH the initial session check and `onAuthStateChange` — never only one.**

The failure mode: a Premium user reloads the page. Supabase silently restores their session from localStorage. If your code only fetches `subscription_status` inside the `onAuthStateChange` callback (a very natural place to put it — it's where you load the profile after sign-in), that callback does not reliably re-fire the full data load for a silently-restored session on every Supabase JS version/config. Result: `userSubscription` stays at its `useState("free")` default, a real Premium customer sees "Free"/"Upgrade" after every refresh, even though the database is correct.

Fix: extract the loader into its own function and call it from both places.

```js
const loadAccountData = async (user) => {
  const { data: prof } = await supabase
    .from("user_profiles")
    .select("subscription_status, letters_used_this_month, matches_used_this_month, usage_reset_at")
    .eq("id", user.id)
    .single();
  if (prof) setUserSubscription(prof.subscription_status || "free");
  // ...usage-reset logic, notifications, etc.
};

useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    setAuthUser(session?.user ?? null);
    if (session?.user) loadAccountData(session.user); // <-- initial load
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
    setAuthUser(session?.user ?? null);
    if (session?.user) await loadAccountData(session.user); // <-- state-change load
  });

  return () => subscription?.unsubscribe();
}, []);
```

Verify this specific thing works before shipping any new site: sign in, upgrade, **reload the page**, confirm Premium status survives the reload (not just the post-checkout redirect).

## Coupon / promo code script (beta, friends & family access)

Reusable pattern — see `scripts/create-friendly-tester-coupon.js` in the MeritLaunch repo for the full version. Core idea:

```js
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const coupon = await stripe.coupons.create({
  name: "Friendly Tester Access",
  percent_off: 100,
  duration: "repeating",
  duration_in_months: 3,       // free period per redeemer, then normal billing resumes
  max_redemptions: 25,          // caps blast radius if the code leaks
  redeem_by: /* unix ts, e.g. now + 60 days */,
});

const promotionCode = await stripe.promotionCodes.create({
  coupon: coupon.id,
  code: "YOURCODE",
  max_redemptions: 25,
  expires_at: /* same as above */,
});
```

Works because `create-checkout.js` already sets `allow_promotion_codes: true`. Testers still enter a card (Stripe charges $0.00), so the real webhook path fires — this is a true end-to-end test, not a bypass.

## Security headers (`vercel.json`, per site)

```json
{
  "headers": [{
    "source": "/(.*)",
    "headers": [
      { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "X-Frame-Options", "value": "DENY" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
      { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://YOUR-SUPABASE-PROJECT.supabase.co; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests" }
    ]
  }]
}
```

Adjust `connect-src`/`font-src`/`img-src` for whatever fonts, analytics, or CDNs that specific site actually loads — check the site's own `index.html` and any third-party script tags before locking down the CSP, or it'll silently break things.

## Shared-account gotchas (same Stripe/Vercel/Supabase/bank across sites)

- **One Stripe account, separate Products per site** — reporting/revenue naturally separates by Product name, but the underlying balance and bank payouts are pooled across every site. If the parent company ever needs true per-site revenue accounting, that's a Stripe Connect / separate-accounts conversation, not something the Product-naming convention gives you for free.
- **Don't reuse one Stripe Secret key across every site.** Create a Restricted key per site (see setup checklist). A leaked key on Site A shouldn't hand over Stripe access to Sites B–Z.
- **A Restricted key's "Access policy: None" is a real, easy-to-hit failure mode** — it authenticates fine but every API call 4xxs until you explicitly grant it permissions. This already happened once; check the policy immediately after creating a new restricted key.
- **Test-mode vs live-mode keys and prices are two separate stores, even on the same account.** A live-mode price ID called with a test-mode key fails with `No such price`, not a permissions error. If checkout breaks right after a key rotation, check this first.
- **Separate Supabase project per site**, not shared tables — keeps RLS policies and `auth.users` scoped per site, avoids one site's user base leaking into another's queries.
- **Separate Vercel project per site**, env vars don't cross projects automatically — the setup checklist above has to be repeated in full for every new site, nothing is inherited.

## Verifying it actually works (do this for every new site, every time)

1. Sign up, click upgrade, complete checkout with a coupon at $0 (or a real card in test mode if the price is test-mode).
2. Confirm the Network tab shows `create-checkout` returning 200 and redirecting to an actual `checkout.stripe.com` page.
3. Complete the checkout.
4. Query the site's Supabase `user_profiles` row directly and confirm `subscription_status`, `stripe_customer_id`, `stripe_subscription_id` are all populated with real values, not null.
5. **Reload the page** and confirm Premium status survives the reload — this is the step that's silently broken before, don't skip it.
6. Click "Manage Subscription" / customer portal and confirm it opens without a "no billing account" error.
