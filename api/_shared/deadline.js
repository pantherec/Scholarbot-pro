// Shared deadline parser for serverless functions.
// Deadlines arrive as ISO dates ("2026-09-15"), recurring year-less dates
// ("Mar 1"), or free text ("Varies", "Rolling"). Year-less dates resolve to
// their next occurrence, so only listings with an explicit past date parse
// as expired. NOTE: src/App.jsx and api/deadline-alerts.js carry copies of
// this logic — keep them in sync.
// A year-less deadline needs a month name. "Annual", "Year-Round" or "Via
// FAFSA" carry no date, and V8's lenient parser once read them as January 1.
const MONTH = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\b/i;
const NUMERIC_DATE = /^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/;
export const NOT_A_DEADLINE = /^(re-?opens?|opens?|opening|applications? (re-?)?opens?|recipients?|winners?|awards?|awarded|announced|notification|notified)\b/i;
export function parseDeadlineDate(deadline) {
  if (!deadline || typeof deadline !== "string") return null;
  const raw = deadline.trim();
  if (!raw || /^(varies|rolling|ongoing|nomination only|n\/?a|tbd|none|open)$/i.test(raw)) return null;
  // "Opens Oct 1", "Reopens Dec 2026", "Recipients announced May 2027": a date
  // is in the text, but it is not the date the application is due.
  // Unless it goes on to name the due date: "Opens Nov 1, 2026; final Mar 1, 2027".
  if (NOT_A_DEADLINE.test(raw)) {
    const m = raw.match(/\b(?:final|due|deadline|closes?)\b:?\s+(.+)$/i);
    return m ? parseDeadlineDate(m[1]) : null;
  }

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);

  if (!MONTH.test(raw) && !NUMERIC_DATE.test(raw)) return null;
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
