import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, emailFooter } from "./_shared/email.js";
import { assertWritten, checkoutDecision } from "./_shared/planGuard.js";
import { SEASON_PASS_MONTHS } from "./_shared/usage.js";

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

// True when this is the subscription written on the student's profile. A
// subscription the account does not hold (a refunded duplicate) changes nothing.
async function holdsSubscription(userId, subscriptionId) {
  const read = await supabase.from("user_profiles").select("stripe_subscription_id").eq("id", userId).maybeSingle();
  assertWritten(read, `Subscription lookup for ${userId}`);
  return !!read.data && read.data.stripe_subscription_id === subscriptionId;
}

// A second payment for a student who already has a plan: give the money back.
// Throws when the refund could not be made, so Stripe sends the event again.
async function refundDuplicate(session) {
  const key = { idempotencyKey: `dup-refund-${session.id}` };
  if (session.mode === "subscription" && session.subscription) {
    const sub = await stripe.subscriptions.retrieve(session.subscription, { expand: ["latest_invoice"] });
    const pi = sub.latest_invoice?.payment_intent;
    if (pi) await stripe.refunds.create({ payment_intent: typeof pi === "string" ? pi : pi.id }, key);
    if (sub.status !== "canceled") await stripe.subscriptions.cancel(session.subscription);
    if (!pi) throw new Error(`No payment found to refund for subscription ${session.subscription}`);
  } else if (session.payment_intent) {
    await stripe.refunds.create({ payment_intent: session.payment_intent }, key);
  } else {
    throw new Error(`No payment found to refund for session ${session.id}`);
  }
  // Tell the payer. Best effort: the refund is what matters.
  try {
    const to = session.customer_details?.email;
    if (to) {
      await sendEmail(to, "Your MeritLaunch payment was refunded", `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
    <h2 style="color:#c9a227;margin-bottom:4px;">We refunded your payment</h2>
    <p>This MeritLaunch account already had a paid plan, so the payment you just made was not needed. We have refunded it in full. Refunds usually reach the card in 5 to 10 business days.</p>
    <p>The plan that was already on the account is unchanged. Questions: support@meritlaunch.com.</p>
  </div>`);
    }
  } catch (mailErr) {
    console.error("Duplicate-refund email error:", mailErr.message);
  }
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

        // One plan, one charge. The checkout page refuses a second plan, but
        // two pages opened side by side can both be paid, so decide again here.
        const profRead = await supabase.from("user_profiles")
          .select("subscription_status, seasonal_expires_at, stripe_subscription_id, last_checkout_session_id")
          .eq("id", userId).maybeSingle();
        assertWritten(profRead, `Plan lookup for ${userId} (session ${session.id})`);
        const decision = checkoutDecision(profRead.data, session.id);
        const markLinkUsed = async () => {
          if (!session.metadata?.parent_link_token) return;
          await supabase.from("parent_pay_links")
            .update({ used_at: new Date().toISOString() })
            .eq("token", session.metadata.parent_link_token);
        };
        if (decision === "done") { console.log(`Session ${session.id} already granted, skipping`); break; }
        if (decision === "duplicate") {
          await refundDuplicate(session);
          await markLinkUsed();
          console.error(`Duplicate payment refunded for user ${userId} (session ${session.id})`);
          break;
        }

        // Determine subscription type from the session
        if (session.mode === "subscription") {
          // Premium monthly subscription
          assertWritten(await supabase.from("user_profiles").update({
            subscription_status: "premium",
            stripe_customer_id: customerId,
            stripe_subscription_id: session.subscription,
            last_checkout_session_id: session.id,
            updated_at: new Date().toISOString(),
          }).eq("id", userId), `Premium grant for ${userId} (session ${session.id})`);
        } else if (session.mode === "payment") {
          // Seasonal one-time payment — expiry matches the marketed product:
          // the plan card sells the pass for SEASON_PASS_MONTHS months ("months of full
          // access"), so write exactly that. (Was +6, an unadvertised bonus.)
          const expiresAt = new Date();
          expiresAt.setMonth(expiresAt.getMonth() + SEASON_PASS_MONTHS);

          assertWritten(await supabase.from("user_profiles").update({
            subscription_status: "seasonal",
            stripe_customer_id: customerId,
            seasonal_expires_at: expiresAt.toISOString(),
            last_checkout_session_id: session.id,
            updated_at: new Date().toISOString(),
          }).eq("id", userId), `Season Pass grant for ${userId} (session ${session.id})`);
        }

        // Paid through a parent link: mark it used so it can't start another checkout.
        await markLinkUsed();

        console.log(`Checkout completed for user ${userId}, mode: ${session.mode}`);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const userId = subscription.metadata?.supabase_user_id;

        if (!userId) break;

        if (!(await holdsSubscription(userId, subscription.id))) break;
        const status = subscription.status;
        // Map Stripe status to our app status
        // past_due keeps access while Stripe retries the card (the payment-failed
        // email promises "nothing is lost"); only a terminal status downgrades.
        const appStatus = ["active", "trialing", "past_due"].includes(status) ? "premium" : "free";

        assertWritten(await supabase.from("user_profiles").update({
          subscription_status: appStatus,
          updated_at: new Date().toISOString(),
        }).eq("id", userId), `Subscription update for ${userId}`);

        console.log(`Subscription updated for user ${userId}: ${appStatus}`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const userId = subscription.metadata?.supabase_user_id;

        if (!userId) break;

        if (!(await holdsSubscription(userId, subscription.id))) break;
        // Downgrade to free
        assertWritten(await supabase.from("user_profiles").update({
          subscription_status: "free",
          stripe_subscription_id: null,
          updated_at: new Date().toISOString(),
        }).eq("id", userId), `Subscription cancel for ${userId}`);

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
