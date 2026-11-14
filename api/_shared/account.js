// Self-serve deletion. A student (or a parent sitting with them) can remove
// their saved work, or the whole account, without emailing us.
import Stripe from "stripe";
import { adminClient } from "./usage.js";

// Saved letters and drafts, practice answers, resume and brag sheet text, voice
// notes, custom styles and tracked applications. The profile and the account stay.
export async function deleteStudentWork(userId) {
  const db = adminClient();
  const results = await Promise.all([
    db.from("saved_letters").delete().eq("user_id", userId),
    db.from("student_work").delete().eq("user_id", userId),
    db.from("applications").delete().eq("user_id", userId),
  ]);
  const failed = results.find((r) => r.error);
  if (failed) throw new Error(failed.error.message);
  return true;
}

// Everything. Any Premium subscription is cancelled first so billing stops;
// deleting the auth user then removes the profile, letters, drafts, tracked
// applications, notifications and payment links through the database's own
// cascade rules.
export async function deleteAccount(userId) {
  const db = adminClient();
  const { data: prof } = await db.from("user_profiles").select("stripe_subscription_id").eq("id", userId).maybeSingle();
  let subscriptionCancelled = false;
  if (prof?.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    try {
      await stripe.subscriptions.cancel(prof.stripe_subscription_id);
      subscriptionCancelled = true;
    } catch (e) {
      // Already cancelled or missing is fine. Anything else must stop the
      // deletion: an account that vanished while still being billed is the
      // worst outcome here.
      if (e?.code !== "resource_missing") throw new Error("Could not cancel the subscription: " + e.message);
    }
  }
  await db.from("student_work").delete().eq("user_id", userId);
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
  return { subscriptionCancelled };
}

// Auto-saved drafts are kept for a limited time, then removed. Saved letters
// stay until the student deletes them.
export const DRAFT_RETENTION_DAYS = 180;
export async function purgeOldDrafts(now = new Date()) {
  const cutoff = new Date(now.getTime() - DRAFT_RETENTION_DAYS * 86400000).toISOString();
  const { data, error } = await adminClient().from("saved_letters").delete().eq("is_draft", true).lt("created_at", cutoff).select("id");
  if (error) throw new Error(error.message);
  return (data || []).length;
}
