// GET  → the signed-in user's plan and remaining allowance (applies Season Pass
//        expiry and the monthly reset on read).
// POST { action: "match" } → checks and counts one match run.
import { verifyAuth, checkRateLimit } from "./_shared/auth.js";
import { getUsage, canUse, recordUse, limitResponse } from "./_shared/usage.js";
import { deleteStudentWork, deleteAccount } from "./_shared/account.js";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { user, error: authError } = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: authError || "Authentication required" });

  const rl = await checkRateLimit(`usage:${user.id}`, 120, 3600000);
  if (!rl.allowed) return res.status(429).json({ error: "Rate limit exceeded. Please try again later." });

  // Self-serve deletion lives here because the hosting plan caps the number of
  // routes. Both act only on the signed-in user's own id.
  if (req.method === "POST" && (req.body?.action === "delete_work" || req.body?.action === "delete_account")) {
    const del = await checkRateLimit(`delete:${user.id}`, 5, 3600000);
    if (!del.allowed) return res.status(429).json({ error: "Too many requests. Please wait a bit." });
    try {
      if (req.body.action === "delete_work") { await deleteStudentWork(user.id); return res.status(200).json({ deleted: "work" }); }
      const out = await deleteAccount(user.id);
      return res.status(200).json({ deleted: "account", ...out });
    } catch (e) {
      console.error("Deletion error:", e.message);
      return res.status(500).json({ error: "We couldn't finish the deletion. Nothing more was removed. Please try again, or write to privacy@meritlaunch.com." });
    }
  }

  try {
    const usage = await getUsage(user.id);
    if (req.method === "GET") return res.status(200).json(usage);

    if (req.body?.action !== "match") return res.status(400).json({ error: "Unknown action" });
    if (!canUse(usage, "match")) return res.status(402).json(limitResponse(usage, "match"));
    const matchesUsed = await recordUse(user.id, "match");
    return res.status(200).json({ ...usage, matchesUsed,
      matchesRemaining: usage.matchesLimit === null ? null : Math.max(0, usage.matchesLimit - matchesUsed) });
  } catch (e) {
    console.error("Usage error:", e.message);
    return res.status(500).json({ error: "Couldn't load your plan. Please try again." });
  }
}
