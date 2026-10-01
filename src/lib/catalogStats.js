// Landing-page numbers, computed from the live catalog so they can never drift
// from the data. Award total = each listing counted once at its largest single
// dollar figure (the same rule as the SQL check in the 2026-09-30 review).
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

export function computeCatalogStats(rows) {
  let total = 0, withAmount = 0, lastChecked = null;
  for (const r of rows) {
    const v = maxDollarAmount(r.amount);
    if (v !== null) { total += v; withAmount++; }
    if (r.linkVerifiedAt) {
      const t = new Date(r.linkVerifiedAt);
      if (!isNaN(t) && (!lastChecked || t > lastChecked)) lastChecked = t;
    }
  }
  return { count: rows.length, totalAwards: total, withAmount, lastChecked };
}

// "$11.5M+" (rounded DOWN so the "+" stays true).
export function formatAwardTotal(total) {
  if (!total) return null;
  if (total >= 1e6) return `$${(Math.floor(total / 1e5) / 10).toFixed(1)}M+`;
  if (total >= 1e3) return `$${Math.floor(total / 1e3)}K+`;
  return `$${Math.floor(total)}+`;
}
