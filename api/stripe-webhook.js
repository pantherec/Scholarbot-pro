import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, emailFooter } from "./_shared/email.js";

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
  const isDeployed = !!process.env.VERCEL;

  let event;

  try {
    const rawBody = await buffer(req);
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } else if (isDeployed) {
      // Never trust an unsigned payload once this is actually deployed —
      // anyone could POST a fake "payment completed" event.
      console.error("STRIPE_WEBHOOK_SECRET is not set — refusing unverified webhook payload.");
      return res.status(500).json({ error: "Webhook not configured" });
    } else {
      // Local dev only: no signature secret configured yet, skip verification.
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
          }).eq("id", userId);
        } else if (session.mode === "payment") {
          // Seasonal one-time payment — expiry matches the marketed product:
          // the pricing page sells "$29.99 / 4 months" ("4 months of full
          // access"), so write exactly that. (Was +6, an unadvertised bonus.)
          const expiresAt = new Date();
          expiresAt.setMonth(expiresAt.getMonth() + 4);

          await supabase.from("user_profiles").update({
            subscription_status: "seasonal",
            stripe_customer_id: customerId,
            seasonal_expires_at: expiresAt.toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", userId);
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
        // past_due keeps access while Stripe retries the card (the payment-failed
        // email promises "nothing is lost"); only a terminal status downgrades.
        const appStatus = ["active", "trialing", "past_due"].includes(status) ? "premium" : "free";

        await supabase.from("user_profiles").update({
          subscription_status: appStatus,
          updated_at: new Date().toISOString(),
        }).eq("id", userId);

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
        }).eq("id", userId);

        console.log(`Subscription cancelled for user ${userId}`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        console.log(`Payment failed for customer ${invoice.customer}`);
        // Best-effort kind heads-up email; never lets the webhook fail.
        try {
          if (invoice.customer) {
            const { data: prof } = await supabase
              .from("user_profiles")
              .select("id, email, name, email_alerts_opt_out")
              .eq("stripe_customer_id", invoice.customer)
              .maybeSingle();
            if (prof && prof.email && !prof.email_alerts_opt_out) {
              const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
    <h2 style="color:#c9a227;margin-bottom:4px;">A quick note about your payment</h2>
    <p>Hi${prof.name ? " " + prof.name : ""}, your latest MeritLaunch payment didn't go through. This happens sometimes, and nothing is lost: your letters and tracker are all still there.</p>
    <p>When you have a moment, you can update your card from "Manage billing" in your dashboard.</p>
    <p><a href="https://meritlaunch.com/app" style="color:#c9a227;">Open MeritLaunch</a></p>
    ${emailFooter(prof.id)}
  </div>`;
              await sendEmail(prof.email, "A quick note about your MeritLaunch payment", html);
            }
          }
        } catch (mailErr) {
          console.error("Payment-failed email error:", mailErr.message);
        }
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
