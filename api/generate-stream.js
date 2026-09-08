// Streaming proxy for Claude (SSE). Auth + rate limited.
import { verifyAuth, checkRateLimit } from "./_shared/auth.js";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { user, error: authError } = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: authError || "Authentication required" });

  const rl = await checkRateLimit(`genstream:${user.id}`, 15, 3600000);
  if (!rl.allowed) return res.status(429).json({ error: "Rate limit exceeded. Please try again later." });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured on server" });

  try {
    const body = { ...req.body, stream: true };
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json(errorData);
    }
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
    res.end();
  } catch (error) {
    if (!res.headersSent) return res.status(500).json({ error: "Failed to reach AI service" });
    res.end();
  }
}
