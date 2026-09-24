import { createClient } from "@supabase/supabase-js";
import { isUrlSafe } from "./_shared/auth.js";
import { daysUntilDeadline } from "./_shared/deadline.js";

// Daily cron (vercel.json): expired listings stay in the catalog, and this job
// re-checks them for renewal so every expired listing is verified at least once
// a month. Most scholarships are annual — a passed deadline usually means the
// next cycle hasn't been posted yet, not that the award is gone.
//
// Cadence: each run takes up to MAX_ROWS listings whose deadline is past and
// whose link_verified_at is missing or older than RECHECK_DAYS, oldest first.
// With ~460 expired listings, 40/day cycles the whole set well inside a month;
// once the backlog is stamped, runs no-op cheaply until rows go stale again.
//
// Per listing: fetch its source page (SSRF-guarded), ask a small model for the
// current application deadline, and:
//   - future ISO date found  -> update `deadline`, link_status 'renewed'
//   - page live, no date yet -> leave deadline alone, link_status 'active'
//   - page gone              -> link_status 'dead' (listing kept; never deleted)
// Every checked row gets link_verified_at stamped, and each run works through the
// least-recently-verified rows first, so the backlog cycles across months.

const supabase = createClient(
  process.env.SUPABASE_URL || "https://zudczsepvkjbjgomgilz.supabase.co",
  process.env.SUPABASE_SERVICE_KEY
);

const TIME_BUDGET_MS = 40000; // stay inside the 60s function cap
const MAX_ROWS = 40;
const CONCURRENCY = 4;
const RECHECK_DAYS = 25; // a row verified more recently than this is skipped

// Supabase caps a select at 1000 rows — page through the whole table or the
// filter below silently misses everything past the first thousand.
async function fetchAllScholarships() {
  const all = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("scholarships")
      .select("id, name, link, deadline, link_verified_at")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < PAGE) return all;
  }
}

async function fetchPageText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "MeritLaunch/1.0 (scholarship research tool)" },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!resp.ok) return { ok: false, status: resp.status };
    const html = (await resp.text()).slice(0, 500000);
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 6000);
    return { ok: true, text };
  } catch (e) {
    return { ok: false, status: e.name === "AbortError" ? "timeout" : "network" };
  } finally {
    clearTimeout(timeout);
  }
}

async function extractDeadline(apiKey, scholarshipName, pageText) {
  const today = new Date().toISOString().slice(0, 10);
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: `Today is ${today}. The webpage text below is the source page for the scholarship "${scholarshipName}".

Find the CURRENT or NEXT application deadline for this scholarship. Return ONLY a JSON object:
{"deadline": "YYYY-MM-DD"}  — if a specific upcoming deadline is stated
{"deadline": "Varies"}      — if applications are rolling/ongoing with no fixed date
{"deadline": null}          — if no current deadline is stated (e.g. only a past cycle's date, or the page doesn't say)

Never guess a date that is not on the page. A date in the past is not a current deadline.

Webpage text:
${pageText}`,
      }],
    }),
  });
  if (!resp.ok) return { error: `anthropic ${resp.status}` };
  const data = await resp.json();
  const text = data.content?.[0]?.text || "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { error: "no-json" };
  try {
    return { deadline: JSON.parse(m[0]).deadline ?? null };
  } catch {
    return { error: "bad-json" };
  }
}

async function checkOne(apiKey, row) {
  const stamp = { link_verified_at: new Date().toISOString() };
  if (!row.link || !isUrlSafe(row.link)) {
    return { id: row.id, outcome: "invalid", update: { ...stamp, link_status: "invalid" } };
  }
  const page = await fetchPageText(row.link);
  if (!page.ok) {
    const gone = page.status === 404 || page.status === 410;
    return { id: row.id, outcome: gone ? "dead" : "unreachable", update: { ...stamp, link_status: gone ? "dead" : `unreachable:${page.status}` } };
  }
  const extracted = await extractDeadline(apiKey, row.name, page.text);
  if (extracted.error) {
    return { id: row.id, outcome: "active", update: { ...stamp, link_status: "active" } };
  }
  if (extracted.deadline && /^\d{4}-\d{2}-\d{2}$/.test(extracted.deadline)) {
    const days = daysUntilDeadline(extracted.deadline);
    if (days !== null && days >= 0) {
      return { id: row.id, outcome: "renewed", update: { ...stamp, deadline: extracted.deadline, link_status: "renewed" } };
    }
  }
  if (extracted.deadline === "Varies") {
    // Page is live and explicitly rolling — replacing the stale past date stops
    // the listing rendering as Expired while the provider is still accepting.
    return { id: row.id, outcome: "renewed", update: { ...stamp, deadline: "Varies", link_status: "renewed" } };
  }
  return { id: row.id, outcome: "active", update: { ...stamp, link_status: "active" } };
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  const started = Date.now();
  try {
    let rows;
    try {
      rows = await fetchAllScholarships();
    } catch (e) {
      console.error("Fetch scholarships failed:", e);
      return res.status(500).json({ error: "Failed to fetch scholarships" });
    }

    const staleBefore = Date.now() - RECHECK_DAYS * 86400000;
    const allExpired = rows.filter((r) => {
      const days = daysUntilDeadline(r.deadline);
      return days !== null && days < 0;
    });
    const due = allExpired
      .filter((r) => !r.link_verified_at || Date.parse(r.link_verified_at) < staleBefore)
      .sort((a, b) => {
        const ta = a.link_verified_at ? Date.parse(a.link_verified_at) : 0;
        const tb = b.link_verified_at ? Date.parse(b.link_verified_at) : 0;
        return ta - tb; // least recently verified first
      });
    const expired = due.slice(0, MAX_ROWS);

    const results = [];
    for (let i = 0; i < expired.length; i += CONCURRENCY) {
      if (Date.now() - started > TIME_BUDGET_MS) break;
      const batch = expired.slice(i, i + CONCURRENCY);
      const settled = await Promise.allSettled(batch.map((row) => checkOne(apiKey, row)));
      for (const s of settled) {
        if (s.status === "fulfilled") results.push(s.value);
        else console.error("Check failed:", s.reason);
      }
    }

    let updated = 0;
    for (const r of results) {
      const { error: upErr } = await supabase.from("scholarships").update(r.update).eq("id", r.id);
      if (upErr) console.error(`Update failed for ${r.id}:`, upErr);
      else updated++;
    }

    const counts = results.reduce((acc, r) => { acc[r.outcome] = (acc[r.outcome] || 0) + 1; return acc; }, {});
    console.log(`refresh-expired: ${results.length} checked, ${updated} updated`, counts);
    return res.status(200).json({
      success: true,
      expiredInCatalog: allExpired.length,
      stillDueAfterRun: Math.max(0, due.length - results.length),
      checked: results.length,
      updated,
      outcomes: counts,
      elapsedMs: Date.now() - started,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error("refresh-expired error:", e);
    return res.status(500).json({ error: "Failed to refresh expired scholarships" });
  }
}
