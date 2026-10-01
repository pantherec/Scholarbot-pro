// Server-side plan + usage enforcement. The browser can read its own counters but
// can no longer write them (column privileges revoked 2026-09-30), so every limit
// is checked and every use is counted here, with the service key.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://zudczsepvkjbjgomgilz.supabase.co";

export const LIMITS = {
  free: { matchesPerMonth: 5, lettersPerMonth: 2 },
  paid: { matchesPerMonth: Infinity, lettersPerMonth: 50 },
};

let _admin = null;
export function adminClient() {
  if (!_admin) {
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!key) throw new Error("SUPABASE_SERVICE_KEY not configured");
    _admin = createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
  }
  return _admin;
}

function monthsBetween(a, b) {
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

function nextResetDate(now) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

// Reads the user's row, applies Season Pass expiry and the monthly reset (writing
// both back), and returns the effective plan and remaining allowance.
export async function getUsage(userId) {
  const db = adminClient();
  const { data: prof, error } = await db
    .from("user_profiles")
    .select("subscription_status, seasonal_expires_at, letters_used_this_month, matches_used_this_month, usage_reset_at")
    .eq("id", userId)
    .single();
  if (error || !prof) throw new Error("Profile not found");

  const now = new Date();
  const updates = {};
  let status = prof.subscription_status || "free";
  if (status === "seasonal" && prof.seasonal_expires_at && new Date(prof.seasonal_expires_at) < now) {
    status = "free";
    updates.subscription_status = "free";
  }

  let lettersUsed = prof.letters_used_this_month || 0;
  let matchesUsed = prof.matches_used_this_month || 0;
  const resetAt = prof.usage_reset_at ? new Date(prof.usage_reset_at) : new Date(0);
  if (monthsBetween(resetAt, now) >= 1) {
    lettersUsed = 0;
    matchesUsed = 0;
    updates.letters_used_this_month = 0;
    updates.matches_used_this_month = 0;
    updates.usage_reset_at = now.toISOString();
  }

  if (Object.keys(updates).length > 0) {
    updates.updated_at = now.toISOString();
    await db.from("user_profiles").update(updates).eq("id", userId);
  }

  const paid = status === "premium" || status === "seasonal";
  const limits = paid ? LIMITS.paid : LIMITS.free;
  return {
    plan: status,
    paid,
    lettersUsed,
    matchesUsed,
    lettersLimit: limits.lettersPerMonth,
    matchesLimit: Number.isFinite(limits.matchesPerMonth) ? limits.matchesPerMonth : null,
    lettersRemaining: Math.max(0, limits.lettersPerMonth - lettersUsed),
    matchesRemaining: Number.isFinite(limits.matchesPerMonth) ? Math.max(0, limits.matchesPerMonth - matchesUsed) : null,
    seasonalExpiresAt: status === "seasonal" ? prof.seasonal_expires_at : null,
    resetsOn: nextResetDate(now),
  };
}

export function canUse(usage, kind) {
  if (kind === "letter") return usage.lettersUsed < usage.lettersLimit;
  if (kind === "match") return usage.matchesLimit === null || usage.matchesUsed < usage.matchesLimit;
  return false;
}

// Count one use. Read-then-write is acceptable here: the per-user rate limit
// bounds concurrency, and the worst case of a race is one uncounted use.
export async function recordUse(userId, kind) {
  const db = adminClient();
  const col = kind === "letter" ? "letters_used_this_month" : "matches_used_this_month";
  const { data } = await db.from("user_profiles").select(col).eq("id", userId).single();
  const next = ((data && data[col]) || 0) + 1;
  await db.from("user_profiles").update({ [col]: next, updated_at: new Date().toISOString() }).eq("id", userId);
  return next;
}

export function limitResponse(usage, kind) {
  return {
    error: kind === "letter"
      ? `You've used all ${usage.lettersLimit} letters for this month.`
      : `You've used all ${usage.matchesLimit} match runs for this month.`,
    code: "limit_reached",
    kind,
    plan: usage.plan,
    resetsOn: usage.resetsOn,
  };
}
