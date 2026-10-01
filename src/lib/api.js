import { createClient } from "@supabase/supabase-js";

// ============================================================
// SUPABASE CONFIG & AUTH
// ============================================================
export const SUPABASE_URL = "https://zudczsepvkjbjgomgilz.supabase.co";
export const SUPABASE_KEY = (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_KEY)
  ? import.meta.env.VITE_SUPABASE_KEY
  : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1ZGN6c2VwdmtqYmpnb21naWx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMjcyMjUsImV4cCI6MjA4NjYwMzIyNX0.cyslrHtWjzvvmZfdQHWdP5xIMfP2xkYltdwMKCpNG2w";

export const supabase = SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Race a promise against a timeout. Resolves null on timeout instead of hanging —
// a stale/deadlocked Supabase auth lock must never silently block the UI.
export function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(null), ms)),
  ]);
}

// Nuke the persisted Supabase session out of localStorage. Used whenever an auth
// call times out — a stuck/corrupted token can deadlock the client's internal
// lock for EVERY subsequent auth call in this tab (sign in, sign up, getSession,
// sign out all share it), so clearing it is what lets the next attempt succeed.
export function clearStaleSupabaseSession() {
  try {
    const ref = SUPABASE_URL.replace("https://", "").split(".")[0];
    localStorage.removeItem("sb-" + ref + "-auth-token");
  } catch (e) { /* best effort */ }
}

// Get the current access token without ever hanging: try getSession() (3s cap),
// then fall back to the session Supabase persists in localStorage.
export async function getAccessTokenSafe() {
  if (!supabase) return null;
  try {
    const result = await withTimeout(supabase.auth.getSession(), 3000);
    const token = result?.data?.session?.access_token;
    if (token) return token;
  } catch (e) { /* fall through to localStorage */ }
  try {
    const ref = SUPABASE_URL.replace("https://", "").split(".")[0];
    const raw = localStorage.getItem("sb-" + ref + "-auth-token");
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed?.access_token || parsed?.currentSession?.access_token || null;
    }
  } catch (e) { /* proceed unauthenticated */ }
  return null;
}

// Attach the Supabase access token to API requests so server endpoints can verify the user.
export async function authFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = await getAccessTokenSafe();
  if (token) headers["Authorization"] = "Bearer " + token;
  return fetch(url, { ...options, headers });
}

// ============================================================
// STRIPE CONFIG
// ============================================================
export const STRIPE_PRICES = {
  premium: "price_1Tm50TC3noYRmoDviVtHCicV",   // LIVE — MeritLaunch Premium $9.99/mo (2026-06-25)
  seasonal: "price_1Tm51gC3noYRmoDvTQZJndll",  // LIVE — MeritLaunch Seasonal Pass $29.99 one-time
};

export function mapScholarshipRow(r) {
  return {
    id: r.id, name: r.name, criteria: r.criteria || "",
    link: r.link || "", deadline: r.deadline || "Varies",
    amount: r.amount || "Varies", needBased: r.need_based || "",
    country: r.country || "US", state: r.state || "",
    linkStatus: r.link_status || "", linkVerifiedAt: r.link_verified_at || null,
  };
}

// Fetch scholarships with a raw REST call to PostgREST — deliberately bypasses the
// supabase-js client so this read can NEVER be blocked by a stuck/corrupted auth
// session in this browser tab. supabase-js coordinates auth refresh via a single
// shared client-side lock; a stale session can deadlock that lock, which then
// hangs every call routed through the client (including plain .from().select()
// reads) — this is what stranded users on the 30 built-in scholarships even
// though the 8s-timeout+retry logic on the client-wrapped call kept firing.
// Scholarships are public data (no RLS/auth needed), so a bare fetch() with just
// the anon key is both simpler and immune to that failure mode. Paginated past
// PostgREST's default 1000-row-per-request cap so the full table always loads.
export async function fetchScholarshipsFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const pageSize = 1000;
  let all = [];
  try {
    for (let offset = 0; ; offset += pageSize) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      let res;
      try {
        res = await fetch(`${SUPABASE_URL}/rest/v1/scholarships?select=*&order=id`, {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            Range: `${offset}-${offset + pageSize - 1}`,
          },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok && res.status !== 206) break;
      const page = await res.json();
      if (!Array.isArray(page) || page.length === 0) break;
      all = all.concat(page);
      if (page.length < pageSize) break; // last page
    }
  } catch (e) { /* return whatever pages succeeded before the network error */ }
  return all.length > 0 ? all.map(mapScholarshipRow) : null;
}

// Save user profile to Supabase
export async function saveProfileToSupabase(userId, profileData) {
  if (!supabase || !userId) return false;
  try {
    const { error } = await supabase.from("user_profiles").upsert({
      id: userId,
      name: profileData.name || null,
      gpa: profileData.gpa || null,
      grade_level: profileData.gradeLevel || null,
      intended_major: profileData.intendedMajor || null,
      heritage: Array.isArray(profileData.heritage) ? profileData.heritage.join(", ") : profileData.heritage || null,
      citizenship: profileData.citizenship || null,
      financial_need: profileData.financialNeed || null,
      activities: profileData.activities || null,
      leadership: profileData.leadership || null,
      profile_data: profileData,
      updated_at: new Date().toISOString(),
    });
    return !error;
  } catch(e) { return false; }
}

// Load user profile from Supabase
export async function loadProfileFromSupabase(userId) {
  if (!supabase || !userId) return null;
  try {
    const { data, error } = await supabase.from("user_profiles").select("profile_data").eq("id", userId).single();
    if (error || !data?.profile_data) return null;
    return data.profile_data;
  } catch(e) { return null; }
}

// Save letter to Supabase
export async function saveLetterToSupabase(userId, letter) {
  if (!supabase || !userId) return false;
  try {
    const { error } = await supabase.from("saved_letters").insert({
      user_id: userId,
      scholarship_id: letter.scholarshipId || null,
      scholarship_name: letter.scholarshipName || "Unknown",
      template_name: letter.template || null,
      letter_content: letter.content,
    });
    return !error;
  } catch(e) { return false; }
}

// Load saved letters from Supabase
export async function loadLettersFromSupabase(userId) {
  if (!supabase || !userId) return null;
  try {
    const { data, error } = await supabase.from("saved_letters").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error || !data) return null;
    return data.map(l => ({
      id: l.id,
      scholarshipName: l.scholarship_name,
      template: l.template_name,
      content: l.letter_content,
      date: new Date(l.created_at).toLocaleDateString(),
    }));
  } catch(e) { return null; }
}

export const store = {
  get: (key) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch(e) { return null; } },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {} },
};
