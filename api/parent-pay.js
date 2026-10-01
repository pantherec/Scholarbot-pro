// "Ask a parent to pay": a signed-in student creates a private, expiring link;
// the parent opens it with no account, reads what the plan does, and pays on
// Stripe. The link page shows NOTHING about the student (no name, email or
// profile), and the plan is granted to the student's account by the webhook.
//
//   POST { action: "create" }                (student, signed in)   -> { url, expiresAt }
//   GET  ?token=...                          (anyone with the link) -> { valid, alreadyActive, expiresAt }
//   POST { action: "checkout", token, plan } (anyone with the link) -> { url }
import crypto from "crypto";
import { verifyAuth, checkRateLimit } from "./_shared/auth.js";
import { adminClient, getUsage } from "./_shared/usage.js";
import { createPlanCheckout, resolveOrigin, PLAN_PRICES } from "./_shared/billing.js";

const LINK_DAYS = 7;
const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;

async function findLink(token) {
  if (!TOKEN_RE.test(token || "")) return null;
  const { data } = await adminClient()
    .from("parent_pay_links").select("token, user_id, expires_at, used_at").eq("token", token).maybeSingle();
  if (!data || data.used_at || new Date(data.expires_at) < new Date()) return null;
  return data;
}

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    // ---- parent opens the link
    if (req.method === "GET") {
      const rl = await checkRateLimit(`parentpay-view:${clientIp(req)}`, 60, 3600000);
      if (!rl.allowed) return res.status(429).json({ error: "Too many requests. Please try again later." });
      const link = await findLink(req.query?.token);
      if (!link) return res.status(404).json({ valid: false, error: "This link has expired or isn't valid. Ask for a new one." });
      const usage = await getUsage(link.user_id).catch(() => null);
      return res.status(200).json({ valid: true, alreadyActive: !!usage?.paid, expiresAt: link.expires_at });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const action = req.body?.action;

    // ---- student creates a link
    if (action === "create") {
      const { user, error: authError } = await verifyAuth(req);
      if (!user) return res.status(401).json({ error: authError || "Sign in first." });
      const rl = await checkRateLimit(`parentpay-create:${user.id}`, 10, 3600000);
      if (!rl.allowed) return res.status(429).json({ error: "Too many links. Please try again later." });

      const token = crypto.randomBytes(24).toString("base64url"); // 32 chars
      const expiresAt = new Date(Date.now() + LINK_DAYS * 86400000).toISOString();
      const { error } = await adminClient().from("parent_pay_links").insert({ token, user_id: user.id, expires_at: expiresAt });
      if (error) throw error;
      return res.status(200).json({ url: `${resolveOrigin(req)}/pay/${token}`, expiresAt });
    }

    // ---- parent starts checkout from the link
    if (action === "checkout") {
      const rl = await checkRateLimit(`parentpay-checkout:${clientIp(req)}`, 10, 3600000);
      if (!rl.allowed) return res.status(429).json({ error: "Too many checkout attempts. Please wait a bit." });
      const plan = req.body?.plan;
      if (!PLAN_PRICES[plan]) return res.status(400).json({ error: "Pick a plan." });
      const link = await findLink(req.body?.token);
      if (!link) return res.status(404).json({ error: "This link has expired or isn't valid. Ask for a new one." });

      const origin = resolveOrigin(req);
      const session = await createPlanCheckout({
        userId: link.user_id,
        plan,
        email: null, // the parent enters their own email on Stripe's page
        successUrl: `${origin}/pay/${link.token}?status=paid`,
        cancelUrl: `${origin}/pay/${link.token}`,
        extraMetadata: { source: "parent_link", parent_link_token: link.token },
      });
      return res.status(200).json({ url: session.url });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    console.error("parent-pay error:", e.message);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
