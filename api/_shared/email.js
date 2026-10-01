import crypto from "crypto";

// Shared email helpers (Resend HTTP API + unsubscribe tokens).
// If RESEND_API_KEY is unset, sending is skipped gracefully.
// RESEND_FROM must be a verified sender.
const SITE = "https://meritlaunch.com";

export async function sendEmail(to, subject, html) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { skipped: true };
  const from = process.env.RESEND_FROM || "MeritLaunch <alerts@meritlaunch.com>";
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!resp.ok) throw new Error(`Resend ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

function secret() {
  return process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || null;
}

export function unsubscribeToken(userId) {
  const key = secret();
  if (!key || !userId) return null;
  return crypto.createHmac("sha256", key).update(String(userId)).digest("hex");
}

export function verifyUnsubscribeToken(userId, token) {
  try {
    const expected = unsubscribeToken(userId);
    if (!expected || typeof token !== "string") return false;
    const a = Buffer.from(expected);
    const b = Buffer.from(token);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function unsubscribeUrl(userId) {
  const token = unsubscribeToken(userId);
  if (!token) return null;
  return `${SITE}/api/unsubscribe?u=${encodeURIComponent(userId)}&t=${token}`;
}

export function emailFooter(userId) {
  const url = unsubscribeUrl(userId);
  const link = url
    ? ` <a href="${url}" style="color:#777;">Unsubscribe from these emails</a>.`
    : "";
  return `<p style="color:#777;font-size:12px;margin-top:24px;">You're receiving this because you use MeritLaunch.${link} Manage email settings anytime from your dashboard.</p>`;
}
