// Non-streaming Claude tasks: the voice profile, the pre-draft questions, and
// the scholarship-from-URL lookup. The request is built on the server
// (api/_shared/prompts.js); anything else the browser sends (model, system,
// max_tokens, tools) is ignored.
import { verifyAuth, checkRateLimit, isUrlSafe } from "./_shared/auth.js";
import { buildProfileRequest, buildUrlRequest, buildQuestionsRequest, parseQuestions } from "./_shared/prompts.js";
import { anthropicHeaders, responseText } from "./_shared/anthropic.js";

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
  } else if (body.task === "draft_questions") {
    request = buildQuestionsRequest(body);
  } else if (body.task === "scholarship_from_url") {
    if (!body.url || !isUrlSafe(body.url)) return res.status(400).json({ error: "That URL is not allowed." });
    request = buildUrlRequest(body.url);
  } else {
    return res.status(400).json({ error: "Unknown task" });
  }

  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: anthropicHeaders(apiKey, request),
      body: JSON.stringify(request),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("Anthropic error:", response.status, data?.error?.type, data?.error?.message);
      // Questions are a convenience step; the browser drafts without them when
      // this fails, so it gets an empty list rather than an error.
      if (body.task === "draft_questions") return res.status(200).json({ questions: [], degraded: true });
      return res.status(502).json({ error: "The AI service returned an error. Please try again." });
    }
    const text = responseText(data);
    if (body.task === "draft_questions") return res.status(200).json({ questions: parseQuestions(text) });
    return res.status(200).json({ text });
  } catch (error) {
    if (body.task === "draft_questions") return res.status(200).json({ questions: [], degraded: true });
    return res.status(500).json({ error: "Failed to reach AI service" });
  }
}
