// GET /api/catalog — the public scholarship catalog, read server-side and cached at
// the CDN edge so a visit does not pull the whole table from Supabase REST.
// Public data: anon key only, never the service key.
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://zudczsepvkjbjgomgilz.supabase.co";
// The anon key is public by design (it ships in the client bundle too).
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_ANON_KEY
  || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1ZGN6c2VwdmtqYmpnb21naWx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMjcyMjUsImV4cCI6MjA4NjYwMzIyNX0.cyslrHtWjzvvmZfdQHWdP5xIMfP2xkYltdwMKCpNG2w";

// Exactly the columns mapScholarshipRow() in src/lib/api.js reads.
export const CATALOG_COLUMNS = "id,name,criteria,link,deadline,amount,need_based,country,state,link_status,link_verified_at";
const PAGE = 1000;

let _client;
function db() {
  if (!_client) _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  return _client;
}

export async function readCatalog() {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db().from("scholarships").select(CATALOG_COLUMNS).order("id").range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    res.setHeader("Cache-Control", "no-store");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const rows = await readCatalog();
    if (rows.length === 0) throw new Error("empty catalog");
    // generatedAt is deliberately outside the hash so an unchanged table keeps its ETag.
    const hash = createHash("sha1").update(JSON.stringify(rows)).digest("hex");
    const etag = `"${hash}"`;
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.setHeader("ETag", etag);
    const inm = req.headers?.["if-none-match"];
    if (inm && inm.split(",").some((t) => t.trim().replace(/^W\//, "") === etag)) {
      return res.status(304).end();
    }
    const body = JSON.stringify({ rows, count: rows.length, generatedAt: new Date().toISOString() });
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    if (req.method === "HEAD") return res.status(200).end();
    return res.status(200).send(body);
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({ error: "Catalog unavailable" });
  }
}
