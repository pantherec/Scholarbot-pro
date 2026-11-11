// Checkout guard: a student holds one paid plan at a time. Returns the message
// to show when checkout must be refused, or "" when it may go ahead.
export function alreadyPaidMessage(usage) {
  if (!usage || !usage.paid) return "";
  return "You already have a paid plan, so there is nothing more to pay. To change or cancel it, use Manage billing in your account.";
}

// The webhook must not tell Stripe "received" when the plan was not written:
// Stripe only retries on a non-2xx answer. Throws when a Supabase write failed.
export function assertWritten(result, what) {
  if (result && result.error) {
    throw new Error(`${what} failed: ${result.error.message || result.error}`);
  }
}
