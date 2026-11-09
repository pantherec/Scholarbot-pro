// Streaming letter drafts (SSE). The plan limit is checked here before any
// tokens are spent, and a letter is counted only after a whole draft arrived.
// The prompt is built on the server; client-supplied model/system/max_tokens are ignored.
//
// Anthropic can fail INSIDE a 200 stream (an `error` event after a few tokens,
// a `refusal` stop) or the upstream socket can drop. Each of those used to look
// like a finished one-sentence letter that still cost the student a letter.
// Now the stream is watched event by event; the browser gets a
// `meritlaunch_error` event with a plain-language reason, and usage is recorded
// only when the draft really ended (see _shared/stream.js).
import { verifyAuth, checkRateLimit } from "./_shared/auth.js";
import { buildLetterRequest } from "./_shared/prompts.js";
import { getUsage, canUse, recordUse, limitResponse } from "./_shared/usage.js";
import { createStreamTracker, describeStreamOutcome, streamCountsAsLetter } from "./_shared/stream.js";
import { anthropicHeaders } from "./_shared/anthropic.js";

export const config = { maxDuration: 60 };

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One quiet retry on overload / server errors before giving up. These are
// transient and a student should not see "try again" for a 529 that clears
// in two seconds.
async function startStream(apiKey, request) {
  let response;
  for (let attempt = 0; attempt < 2; attempt++) {
    response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: anthropicHeaders(apiKey, request),
      body: JSON.stringify(request),
    });
    if (response.ok) return response;
    const retryable = response.status === 529 || response.status === 429 || response.status >= 500;
    if (!retryable || attempt === 1) return response;
    await sleep(1500);
  }
  return response;
}

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
    const response = await startStream(apiKey, request);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Anthropic error:", response.status, errorData?.error?.type, errorData?.error?.message);
      const busy = response.status === 529 || response.status === 429;
      return res.status(502).json({ error: busy ? "The AI service is busy right now. You weren't charged. Try again in a minute." : "The AI service returned an error. You weren't charged. Please try again." });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const tracker = createStreamTracker();
    let upstreamDropped = false;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        tracker.push(chunk);
        res.write(chunk);
      }
      tracker.flush();
    } catch (e) {
      // The socket to Anthropic dropped mid-stream. The browser is still
      // connected, so tell it instead of ending the stream silently.
      upstreamDropped = true;
      console.error("Anthropic stream dropped:", e.message);
    }

    const st = tracker.state;
    const outcome = upstreamDropped ? { reason: "cut_off", message: "The connection to the AI service dropped before the draft finished. You weren't charged. Try again." } : describeStreamOutcome(st);
    if (outcome) {
      console.error("Draft did not finish:", outcome.reason, st.error?.type || st.stopReason || "", `tokens=${st.outputTokens}`);
      res.write(`data: ${JSON.stringify({ type: "meritlaunch_error", ...outcome })}\n\n`);
    } else if (!isOutline && streamCountsAsLetter(st)) {
      try {
        const used = await recordUse(user.id, "letter");
        res.write(`data: ${JSON.stringify({ type: "meritlaunch_usage", lettersUsed: used, lettersLimit: usage.lettersLimit })}\n\n`);
      } catch (e) {
        console.error("Usage record failed:", e.message);
      }
    }
    res.write(`data: ${JSON.stringify({ type: "meritlaunch_done", stopReason: st.stopReason, outputTokens: st.outputTokens })}\n\n`);
    res.end();
  } catch (error) {
    console.error("generate-stream failed:", error.message);
    if (!res.headersSent) return res.status(500).json({ error: "Failed to reach AI service" });
    res.end();
  }
}
