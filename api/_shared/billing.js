// One place that turns a plan name into a Stripe Checkout session. Prices are
// pinned here on the server: the browser names a plan, never a price ID, so a
// cheaper price elsewhere on the Stripe account can't be used to buy Premium.
import Stripe from "stripe";

export const PLAN_PRICES = {
  premium: process.env.STRIPE_PRICE_PREMIUM || "price_1Tm50TC3noYRmoDviVtHCicV", // $9.99/mo
  seasonal: process.env.STRIPE_PRICE_SEASONAL || "price_1Tm51gC3noYRmoDvTQZJndll", // $29.99 one time
};
export const PLAN_MODES = { premium: "subscription", seasonal: "payment" };

let _stripe = null;
export function stripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return _stripe;
}

const ALLOWED_ORIGINS = new Set([
  "https://meritlaunch.com",
  "https://www.meritlaunch.com",
  "http://localhost:5173",
]);
const PREVIEW_ORIGIN_RE = /^https:\/\/scholarbot-pro-[a-z0-9-]+\.vercel\.app$/;

// Redirect URLs are pinned to known origins; anything else falls back to production.
export function resolveOrigin(req) {
  const o = req.headers.origin;
  return ALLOWED_ORIGINS.has(o) || PREVIEW_ORIGIN_RE.test(o || "") ? o : "https://meritlaunch.com";
}

// The webhook fulfils by metadata.supabase_user_id + session.mode, so the plan
// a session can grant is fixed by PLAN_MODES above.
export async function createPlanCheckout({ userId, plan, email, successUrl, cancelUrl, extraMetadata = {} }) {
  const price = PLAN_PRICES[plan];
  const mode = PLAN_MODES[plan];
  if (!price || !mode) throw Object.assign(new Error("Unknown plan"), { status: 400 });
  const metadata = { supabase_user_id: userId, plan, ...extraMetadata };
  const params = {
    mode,
    payment_method_types: ["card"],
    line_items: [{ price, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
    allow_promotion_codes: true,
  };
  if (email) params.customer_email = email;
  if (mode === "subscription") params.subscription_data = { metadata };
  return stripe().checkout.sessions.create(params);
}
