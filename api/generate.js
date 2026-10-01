// Non-streaming Claude tasks: the voice profile and scholarship-from-URL lookup.
// The request is built on the server (api/_shared/prompts.js); anything else the
// browser sends (model, system, max_tokens, tools) is ignored.
import { verifyAuth, checkRateLimit, isUrlSafe } from "./_shared/auth.js";
import { buildProfileRequest, buildUrlRequest } from "./_shared/prompts.js";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { user, error: authError } = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: authError || "Authentication required" });

  const rl = await checkRateLimit(`gen:${user.id}`, 30, 3600000);
  if (!rl.allowed) return res.status(429).json({ error: "Rate limit exceeded. Please try again later." });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured on server" });

  const body = req.body || {};
  let request;
  if (body.task === "profile") {
    request = buildProfileRequest(body);
  } else if (body.task === "scholarship_from_url") {
    if (!body.url || !isUrlSafe(body.url)) return res.status(400).json({ error: "That URL is not allowed." });
    request = buildUrlRequest(body.url);
  } else {
    return res.status(400).json({ error: "Unknown task" });
  }

  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(request),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("Anthropic error:", response.status, data?.error?.message);
      return res.status(502).json({ error: "The AI service returned an error. Please try again." });
    }
    const text = (data.content || []).map((b) => b.text || "").filter(Boolean).join("\n").trim();
    return res.status(200).json({ text });
  } catch (error) {
    return res.status(500).json({ error: "Failed to reach AI service" });
  }
}
