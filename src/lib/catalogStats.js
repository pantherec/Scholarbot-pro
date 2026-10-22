// Landing-page numbers, computed from the live catalog so they can never drift
// from the data. The headline total counts open listings only, each once at its
// largest single dollar figure, and leaves out program-wide totals.
import { daysUntil } from "./deadline.js";

export function maxDollarAmount(amount) {
  if (!amount) return null;
  let max = null;
  const re = /\$\s?([0-9][0-9,]*(?:\.[0-9]+)?)/g;
  let m;
  while ((m = re.exec(String(amount)))) {
    const v = parseFloat(m[1].replace(/,/g, ""));
    if (Number.isFinite(v) && (max === null || v > max)) max = v;
  }
  return max;
}

// "$1,000,000 in scholarships" or "$475,000+ awarded since 2014" is a program's
// budget, not what one student can win. Those never reach the headline number.
const PROGRAM_TOTAL = /\b(total|in scholarships|in awards|awarded|since \d{4}|million|available|pool|annually to)\b/i;
export function isProgramTotal(amount, max = maxDollarAmount(amount)) {
  if (max !== null && max >= 100000) return true;
  return PROGRAM_TOTAL.test(String(amount || ""));
}

export function computeCatalogStats(rows, now = new Date()) {
  let total = 0, withAmount = 0, openAwards = 0, openWithAmount = 0, lastChecked = null;
  for (const r of rows) {
    const v = maxDollarAmount(r.amount);
    if (v !== null) {
      total += v; withAmount++;
      const d = daysUntil(r.deadline, now);
      if ((d === null || d >= 0) && !isProgramTotal(r.amount, v)) { openAwards += v; openWithAmount++; }
    }
    if (r.linkVerifiedAt) {
      const t = new Date(r.linkVerifiedAt);
      if (!isNaN(t) && (!lastChecked || t > lastChecked)) lastChecked = t;
    }
  }
  return { count: rows.length, totalAwards: total, withAmount, openAwards, openWithAmount, lastChecked };
}

// "$11.5M+" (rounded DOWN so the "+" stays true).
export function formatAwardTotal(total) {
  if (!total) return null;
  if (total >= 1e6) return `$${(Math.floor(total / 1e5) / 10).toFixed(1)}M+`;
  if (total >= 1e3) return `$${Math.floor(total / 1e3)}K+`;
  return `$${Math.floor(total)}+`;
}
