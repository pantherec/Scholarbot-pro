// Checkout guard: a student holds one paid plan at a time. Returns the message
// to show when checkout must be refused, or "" when it may go ahead.
export function alreadyPaidMessage(usage) {
  if (!usage || !usage.paid) return "";
  return "You already have a paid plan, so there is nothing more to pay. To change or cancel it, use Manage billing in your account.";
}

// What the webhook should do with a completed checkout.
//   "done"      this same session already granted the plan (Stripe re-sent it)
//   "duplicate" the student already holds a paid plan from another payment:
//               refund this one, change nothing
//   "grant"     write the plan
export function checkoutDecision(profile, sessionId, now = new Date()) {
  if (!profile) return "grant";
  if (profile.last_checkout_session_id && profile.last_checkout_session_id === sessionId) return "done";
  const status = profile.subscription_status;
  const passLive = status === "seasonal" && !(profile.seasonal_expires_at && new Date(profile.seasonal_expires_at) < now);
  return status === "premium" || passLive ? "duplicate" : "grant";
}

// The webhook must not tell Stripe "received" when the plan was not written:
// Stripe only retries on a non-2xx answer. Throws when a Supabase write failed.
export function assertWritten(result, what) {
  if (result && result.error) {
    throw new Error(`${what} failed: ${result.error.message || result.error}`);
  }
}
