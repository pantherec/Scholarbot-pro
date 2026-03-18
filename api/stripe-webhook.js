import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL || "https://zudczsepvkjbjgomgilz.supabase.co",
  process.env.SUPABASE_SERVICE_KEY // Service role key for admin writes
);

// Vercel requires raw body for webhook signature verification
export const config = {
  api: { bodyParser: false },
};

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    const rawBody = await buffer(req);
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } else {
      // Fallback for testing without webhook secret
      event = JSON.parse(rawBody.toString());
    }
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.supabase_user_id;
        const customerId = session.customer;

        if (!userId) {
          console.log("No supabase_user_id in metadata, skipping DB update");
          break;
        }

        // Determine subscription type from the session
        if (session.mode === "subscription") {
          // Premium monthly subscription
          await supabase.from("user_profiles").update({
            subscription_status: "premium",
            stripe_customer_id: customerId,
            stripe_subscription_id: session.subscription,
            updated_at: new Date().toISOString(),
          }).eq("user_id", userId);
        } else if (session.mode === "payment") {
          // Seasonal one-time payment — set expiry 6 months out
          const expiresAt = new Date();
          expiresAt.setMonth(expiresAt.getMonth() + 6);

          await supabase.from("user_profiles").update({
            subscription_status: "seasonal",
            stripe_customer_id: customerId,
            seasonal_expires_at: expiresAt.toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("user_id", userId);
        }

        console.log(`Checkout completed for user ${userId}, mode: ${session.mode}`);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const userId = subscription.metadata?.supabase_user_id;

        if (!userId) break;

        const status = subscription.status;
        // Map Stripe status to our app status
        const appStatus = status === "active" ? "premium" :
                          status === "trialing" ? "premium" : "free";

        await supabase.from("user_profiles").update({
          subscription_status: appStatus,
          updated_at: new Date().toISOString(),
        }).eq("user_id", userId);

        console.log(`Subscription updated for user ${userId}: ${appStatus}`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const userId = subscription.metadata?.supabase_user_id;

        if (!userId) break;

        // Downgrade to free
        await supabase.from("user_profiles").update({
          subscription_status: "free",
          stripe_subscription_id: null,
          updated_at: new Date().toISOString(),
        }).eq("user_id", userId);

        console.log(`Subscription cancelled for user ${userId}`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        console.log(`Payment failed for customer ${invoice.customer}`);
        // Could send an email notification here in the future
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return res.status(500).json({ error: "Webhook handler failed" });
  }
}
