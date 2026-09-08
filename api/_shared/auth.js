// Shared authentication + safety helpers for API endpoints.
// Verifies Supabase JWTs so requests come from authenticated users,
// provides basic per-user rate limiting, SSRF URL checks, and input sanitization.

import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://zudczsepvkjbjgomgilz.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

const ALLOWED_ORIGINS = new Set([
  "https://meritlaunch.com",
  "https://www.meritlaunch.com",
  "https://scholarbot-pro.vercel.app", // legacy domain, remove after full cutover
  "http://localhost:5173",             // local Vite dev
]);
const PREVIEW_ORIGIN_RE = /^https:\/\/scholarbot-pro-[a-z0-9-]+\.vercel\.app$/;

// Reflects the request's Origin back only when it's an allowed domain or a
// Vercel preview deployment for this project, instead of a wildcard "*".
// Falls back to the production origin for anything else (the browser will
// then reject the response, which is the point).
export function applyCors(req, res) {
  const origin = req.headers.origin;
  const isAllowed = !!origin && (ALLOWED_ORIGINS.has(origin) || PREVIEW_ORIGIN_RE.test(origin));
  res.setHeader("Access-Control-Allow-Origin", isAllowed ? origin : "https://meritlaunch.com");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// Verify a Supabase JWT from the Authorization header. Returns { user, error }.
export async function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { user: null, error: "Missing or invalid Authorization header" };
  }
  const token = authHeader.replace("Bearer ", "");
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return { user: null, error: error?.message || "Invalid or expired token" };
    }
    return { user, error: null };
  } catch (err) {
    return { user: null, error: "Authentication failed" };
  }
}

// Rate limiting: backed by Upstash Redis (shared across serverless instances)
// when UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are set. Falls back
// to an in-memory counter otherwise — fine for local dev, but it resets on
// every cold start and isn't real protection in production.
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;

const rateLimitStore = new Map();
function checkRateLimitInMemory(key, maxRequests, windowMs) {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  if (!record || now - record.windowStart > windowMs) {
    rateLimitStore.set(key, { windowStart: now, count: 1 });
    return { allowed: true, remaining: maxRequests - 1 };
  }
  record.count++;
  if (record.count > maxRequests) return { allowed: false, remaining: 0 };
  return { allowed: true, remaining: maxRequests - record.count };
}

export async function checkRateLimit(key, maxRequests = 10, windowMs = 3600000) {
  if (!redis) return checkRateLimitInMemory(key, maxRequests, windowMs);

  try {
    const redisKey = `ratelimit:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, Math.ceil(windowMs / 1000));
    }
    if (count > maxRequests) return { allowed: false, remaining: 0 };
    return { allowed: true, remaining: maxRequests - count };
  } catch (err) {
    // Redis unreachable — fail open to in-memory rather than blocking all traffic.
    console.error("Rate limit Redis error, falling back to in-memory:", err.message);
    return checkRateLimitInMemory(key, maxRequests, windowMs);
  }
}

// SSRF protection: only allow http/https to public hosts.
export function isUrlSafe(urlString) {
  try {
    const url = new URL(urlString);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    const hostname = url.hostname.toLowerCase();
    if (["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(hostname)) return false;
    const parts = hostname.split(".").map(Number);
    if (parts.length === 4 && parts.every((p) => !isNaN(p))) {
      if (parts[0] === 10) return false;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
      if (parts[0] === 192 && parts[1] === 168) return false;
      if (parts[0] === 169 && parts[1] === 254) return false;
      if (parts[0] === 0) return false;
    }
    if (hostname === "metadata.google.internal") return false;
    return true;
  } catch {
    return false;
  }
}

// Strip control chars and cap length for text going into AI prompts.
export function sanitizeForPrompt(text, maxLength = 12000) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .slice(0, maxLength)
    .trim();
}
