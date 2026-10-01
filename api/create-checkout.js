import { verifyAuth, checkRateLimit, applyCors } from "./_shared/auth.js";
import { createPlanCheckout, resolveOrigin, PLAN_PRICES } from "./_shared/billing.js";

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { user, error: authError } = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: authError || "Authentication required" });

  const rl = await checkRateLimit(`checkout:${user.id}`, 5, 3600000);
  if (!rl.allowed) return res.status(429).json({ error: "Too many checkout attempts. Please wait a bit." });

  try {
    // Accept a plan name. Older clients sent a priceId; map it back to a plan only
    // if it is one of ours, so an arbitrary price can never be checked out.
    let plan = req.body?.plan;
    if (!plan && req.body?.priceId) {
      plan = Object.keys(PLAN_PRICES).find((k) => PLAN_PRICES[k] === req.body.priceId);
    }
    if (!PLAN_PRICES[plan]) return res.status(400).json({ error: "Unknown plan" });

    const origin = resolveOrigin(req);
    const session = await createPlanCheckout({
      userId: user.id, // the AUTHENTICATED user — never a client-supplied id
      plan,
      email: user.email,
      successUrl: `${origin}/app?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/app?checkout=cancelled`,
    });
    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return res.status(error.status || 500).json({ error: error.status ? error.message : "Couldn't start checkout. Please try again." });
  }
}
