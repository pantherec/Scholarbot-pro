// Shared deadline parser for serverless functions.
// Deadlines arrive as ISO dates ("2026-09-15"), recurring year-less dates
// ("Mar 1"), or free text ("Varies", "Rolling"). Year-less dates resolve to
// their next occurrence, so only listings with an explicit past date parse
// as expired. NOTE: src/App.jsx and api/deadline-alerts.js carry copies of
// this logic — keep them in sync.
export function parseDeadlineDate(deadline) {
  if (!deadline || typeof deadline !== "string") return null;
  const raw = deadline.trim();
  if (!raw || /^(varies|rolling|ongoing|nomination only|n\/?a|tbd|none|open)$/i.test(raw)) return null;

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);

  if (!/\d{4}/.test(raw)) {
    const probe = new Date(`${raw.replace(/(\d+)(st|nd|rd|th)\b/i, "$1")} 2000`);
    if (!isNaN(probe)) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let next = new Date(now.getFullYear(), probe.getMonth(), probe.getDate());
      if (next < today) next = new Date(now.getFullYear() + 1, probe.getMonth(), probe.getDate());
      return next;
    }
  }

  const d = new Date(raw);
  return isNaN(d) ? null : d;
}

// Days from today to the given deadline string; null when undated.
export function daysUntilDeadline(deadline) {
  const d = parseDeadlineDate(deadline);
  if (!d) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((d - today) / 86400000);
}
