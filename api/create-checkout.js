import Stripe from "stripe";
import { verifyAuth, checkRateLimit, applyCors } from "./_shared/auth.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Pin Stripe redirect URLs to known origins; anything else falls back to production.
const ALLOWED_ORIGINS = new Set([
  "https://meritlaunch.com",
  "https://www.meritlaunch.com",
  "http://localhost:5173",
]);
const PREVIEW_ORIGIN_RE = /^https:\/\/scholarbot-pro-[a-z0-9-]+\.vercel\.app$/;

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

    const checkoutMode = mode || "subscription";
    const reqOrigin = req.headers.origin;
    const origin = ALLOWED_ORIGINS.has(reqOrigin) || PREVIEW_ORIGIN_RE.test(reqOrigin || "")
      ? reqOrigin
      : "https://meritlaunch.com";

    // Use the AUTHENTICATED user's id/email — never trust a client-supplied id.
    const sessionParams = {
      mode: checkoutMode,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/app?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/app?checkout=cancelled`,
      metadata: {
        supabase_user_id: user.id,
        plan: checkoutMode === "subscription" ? "premium" : "seasonal",
      },
      allow_promotion_codes: true,
    };
    if (user.email) sessionParams.customer_email = user.email;
    if (checkoutMode === "subscription") {
      sessionParams.subscription_data = { metadata: { supabase_user_id: user.id } };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return res.status(500).json({ error: error.message });
  }
}
