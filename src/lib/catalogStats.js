// Landing-page numbers, computed from the live catalog so they can never drift
// from the data. The headline total counts open listings only (a future date or
// rolling, never a past cycle), each once at its largest single dollar figure,
// and leaves out program-wide totals, pooled amounts and graduate or fellowship awards.
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

// Rows that are not "one student can win this": pooled or program-wide dollar
// figures, "up to N awards" totals, and graduate, doctoral or fellowship awards
// (the site is for high schoolers).
const POOLED_AMOUNT = /\b(pool(?:ed)?|total(?:s|ing|ling)?|combined|aggregate|in (?:total )?(?:scholarships|awards|grants)|up to \d+ (?:awards|scholarships|grants|students|recipients))\b/i;
const POOLED_CRITERIA = /\b(pooled|total of \$|(?:awards?|scholarships?|grants?) totall?ing|up to \d+ (?:awards|scholarships|grants|recipients)|\d+ (?:awards|scholarships) (?:totall?ing|worth a total))\b/i;
const GRAD_NAME = /\b(fellowship|fellows?|doctoral|ph\.?\s?d|postdoc\w*)\b/i;
const GRAD_CRITERIA = /\b(doctoral|ph\.?\s?d|postdoc\w*|graduate (?:students?|school|degree|programs?|studies)|master'?s (?:degree )?students?|post-?graduate)\b/i;
const UNDERGRAD_OK = /(high school|senior|undergraduate|incoming|freshm|first-year)/i;
export function isIndividualAward(r) {
  const amount = String(r.amount || ""), criteria = String(r.criteria || ""), name = String(r.name || "");
  if (POOLED_AMOUNT.test(amount) || POOLED_CRITERIA.test(criteria)) return false;
  if (GRAD_NAME.test(name) || GRAD_NAME.test(amount)) return false;
  if (GRAD_CRITERIA.test(`${name} ${criteria}`) && !UNDERGRAD_OK.test(criteria)) return false;
  return true;
}

// A deadline that names a cycle ("Spring 2026", "Fall 2025", "2024 cycle") is
// closed once that cycle's end has passed, even though no day of the month is given.
const SEASON_END = { winter: [1, 28], spring: [4, 31], summer: [7, 31], fall: [11, 31], autumn: [11, 31] };
export function namesPastCycle(deadline, now = new Date()) {
  const text = String(deadline || "");
  const y = text.match(/\b(20\d\d)\b/);
  if (!y || /\d{1,2}[\/.-]\d{1,2}|-\d{2}-/.test(text)) return false; // real dates are handled by daysUntil
  const season = (text.toLowerCase().match(/\b(winter|spring|summer|fall|autumn)\b/) || [])[1];
  const [m, d] = season ? SEASON_END[season] : [11, 31];
  const end = new Date(+y[1], m, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return end < today;
}

export function computeCatalogStats(rows, now = new Date()) {
  let total = 0, withAmount = 0, openAwards = 0, openWithAmount = 0, lastChecked = null;
  for (const r of rows) {
    const v = maxDollarAmount(r.amount);
    if (v !== null) {
      total += v; withAmount++;
      const d = daysUntil(r.deadline, now);
      if ((d === null || d >= 0) && !namesPastCycle(r.deadline, now) && !isProgramTotal(r.amount, v) && isIndividualAward(r)) { openAwards += v; openWithAmount++; }
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
