import Stripe from "stripe";
import { verifyAuth, checkRateLimit, applyCors } from "./_shared/auth.js";
import { adminClient } from "./_shared/usage.js";
import { resolveOrigin } from "./_shared/billing.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { user, error: authError } = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: authError || "Authentication required" });

  const rl = await checkRateLimit(`portal:${user.id}`, 10, 3600000);
  if (!rl.allowed) return res.status(429).json({ error: "Too many requests. Please wait a bit." });

  try {
    // The customer comes from the signed-in user's own row, never from the
    // request: a client-supplied ID would open another family's billing page.
    const { data: prof } = await adminClient()
      .from("user_profiles").select("stripe_customer_id").eq("id", user.id).maybeSingle();
    const customerId = prof?.stripe_customer_id;
    if (!customerId) return res.status(404).json({ error: "No billing account found." });

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${resolveOrigin(req)}/app`,
    });
    return res.status(200).json({ url: portalSession.url });
  } catch (error) {
    console.error("Portal error:", error.message);
    return res.status(500).json({ error: "Could not open billing. Please try again." });
  }
}
