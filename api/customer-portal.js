import Stripe from "stripe";
import { verifyAuth, checkRateLimit, applyCors } from "./_shared/auth.js";

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
    const { customerId } = req.body;
    if (!customerId) return res.status(400).json({ error: "Missing customerId" });

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: req.headers.origin || "https://meritlaunch.com",
    });
    return res.status(200).json({ url: portalSession.url });
  } catch (error) {
    console.error("Portal error:", error);
    return res.status(500).json({ error: error.message });
  }
}
