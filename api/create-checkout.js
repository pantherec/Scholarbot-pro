import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { priceId, userId, userEmail, mode } = req.body;

    if (!priceId) {
      return res.status(400).json({ error: "Missing priceId" });
    }

    // mode: "subscription" for Premium, "payment" for Seasonal
    const checkoutMode = mode || "subscription";

    const sessionParams = {
      mode: checkoutMode,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${req.headers.origin || "https://scholarbot-pro.vercel.app"}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin || "https://scholarbot-pro.vercel.app"}?checkout=cancelled`,
      metadata: {
        supabase_user_id: userId || "",
      },
      allow_promotion_codes: true,
    };

    // Pre-fill email if available
    if (userEmail) {
      sessionParams.customer_email = userEmail;
    }

    // For subscriptions, allow customer portal management later
    if (checkoutMode === "subscription") {
      sessionParams.subscription_data = {
        metadata: { supabase_user_id: userId || "" },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return res.status(500).json({ error: error.message });
  }
}
