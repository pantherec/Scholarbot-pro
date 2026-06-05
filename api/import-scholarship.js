import { verifyAuth, checkRateLimit, isUrlSafe } from "./_shared/auth.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { user, error: authError } = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: authError || "Authentication required" });

  const rl = checkRateLimit(`import:${user.id}`, 20, 3600000);
  if (!rl.allowed) return res.status(429).json({ error: "Rate limit exceeded. Please try again later." });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "Missing URL" });
    if (!isUrlSafe(url)) return res.status(400).json({ error: "That URL is not allowed." });

    // Fetch with a timeout to avoid hanging on slow hosts
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let pageResp;
    try {
      pageResp = await fetch(url, {
        headers: { "User-Agent": "MeritLaunch/1.0 (scholarship research tool)" },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!pageResp.ok) {
      return res.status(400).json({ error: `Could not fetch URL (status ${pageResp.status})` });
    }

    const html = (await pageResp.text()).slice(0, 1000000); // cap 1MB
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: `Extract scholarship information from this webpage text. Return ONLY a JSON object with these fields:
{
  "name": "scholarship name",
  "criteria": "eligibility criteria and requirements",
  "amount": "award amount",
  "deadline": "deadline date in YYYY-MM-DD format if possible, or 'Varies'",
  "needBased": "Y if need-based, empty string if not"
}

Webpage text:
${textContent}`
        }],
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: "AI extraction failed" });

    const aiText = data.content?.[0]?.text || "";
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: "Could not parse scholarship data from page" });

    const scholarship = JSON.parse(jsonMatch[0]);
    scholarship.link = url;
    scholarship.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    scholarship.source = "user-imported";
    return res.status(200).json(scholarship);
  } catch (error) {
    if (error.name === "AbortError") return res.status(400).json({ error: "The page took too long to load." });
    console.error("Import error:", error);
    return res.status(500).json({ error: error.message || "Failed to import scholarship" });
  }
}
