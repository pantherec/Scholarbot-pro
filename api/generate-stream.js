// Streaming letter drafts (SSE). The plan limit is checked here before any
// tokens are spent, and a letter is counted only after a draft actually arrived.
// The prompt is built on the server; client-supplied model/system/max_tokens are ignored.
import { verifyAuth, checkRateLimit } from "./_shared/auth.js";
import { buildLetterRequest } from "./_shared/prompts.js";
import { getUsage, canUse, recordUse, limitResponse } from "./_shared/usage.js";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { user, error: authError } = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: authError || "Authentication required" });

  const rl = await checkRateLimit(`genstream:${user.id}`, 15, 3600000);
  if (!rl.allowed) return res.status(429).json({ error: "Rate limit exceeded. Please try again later." });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured on server" });

  let usage;
  try {
    usage = await getUsage(user.id);
  } catch (e) {
    console.error("Usage lookup failed:", e.message);
    return res.status(500).json({ error: "Couldn't check your plan. Please try again." });
  }
  // Outlines are planning help, not a drafted letter, so they don't spend a letter.
  const isOutline = req.body?.mode === "outline";
  if (!isOutline && !canUse(usage, "letter")) return res.status(402).json(limitResponse(usage, "letter"));

  const request = { ...buildLetterRequest(req.body || {}), stream: true };

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Anthropic error:", response.status, errorData?.error?.message);
      return res.status(502).json({ error: "The AI service returned an error. Please try again." });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    let gotText = false;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
      if (!gotText) {
        // SSE events can split across reads; keep the unfinished line for the next chunk.
        pending += chunk;
        const lines = pending.split("\n");
        pending = lines.pop();
        for (const line of lines) {
          if (line.startsWith("data: ") && line.includes('"text_delta"')) { gotText = true; break; }
        }
      }
    }

    if (gotText && !isOutline) {
      try {
        const used = await recordUse(user.id, "letter");
        res.write(`data: ${JSON.stringify({ type: "meritlaunch_usage", lettersUsed: used, lettersLimit: usage.lettersLimit })}\n\n`);
      } catch (e) {
        console.error("Usage record failed:", e.message);
      }
    }
    res.end();
  } catch (error) {
    if (!res.headersSent) return res.status(500).json({ error: "Failed to reach AI service" });
    res.end();
  }
}
