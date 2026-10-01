// Deadline parsing shared by every view. Deadlines in the catalog come in three
// shapes: ISO dates ("2026-09-15"), recurring year-less dates ("Mar 1"), and free
// text ("Varies", "Rolling"). A bare `new Date("Mar 1")` resolves to the year 2001,
// so parse deliberately. api/_shared/deadline.js carries the server copy.

export function parseDeadlineDate(deadline, now = new Date()) {
  if (!deadline || typeof deadline !== "string") return null;
  const raw = deadline.trim();
  if (!raw || /^(varies|rolling|ongoing|nomination only|n\/?a|tbd|none|open)$/i.test(raw)) return null;

  // ISO YYYY-MM-DD: build from parts so it lands on local midnight.
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);

  // Year-less "Mar 1" / "March 1st": a recurring annual deadline, resolved to
  // its next occurrence.
  if (!/\d{4}/.test(raw)) {
    const probe = new Date(`${raw.replace(/(\d+)(st|nd|rd|th)\b/i, "$1")} 2000`);
    if (!isNaN(probe)) {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let next = new Date(now.getFullYear(), probe.getMonth(), probe.getDate());
      if (next < today) next = new Date(now.getFullYear() + 1, probe.getMonth(), probe.getDate());
      return next;
    }
  }

  const d = new Date(raw);
  return isNaN(d) ? null : d;
}

export function daysUntil(deadline, now = new Date()) {
  const d = parseDeadlineDate(deadline, now);
  if (!d) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((d - today) / 86400000);
}

// { date, days, label, tone } where tone is "closed" | "urgent" | "soon" | "open" | "undated".
export function deadlineInfo(deadline, now = new Date()) {
  const d = parseDeadlineDate(deadline, now);
  if (!d) return { date: null, days: null, label: (deadline || "").trim() || "Varies", tone: "undated" };
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((d - today) / 86400000);
  if (days < 0) return { date: d, days, label: "Closed this cycle", tone: "closed" };
  if (days === 0) return { date: d, days, label: "Due today", tone: "urgent" };
  if (days <= 14) return { date: d, days, label: `${days}d left`, tone: "urgent" };
  if (days <= 60) return { date: d, days, label: `${days}d left`, tone: "soon" };
  return { date: d, days, label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), tone: "open" };
}

// Live (soonest first), then undated, then closed (most recently closed first).
export function compareByDeadline(a, b, now = new Date()) {
  const da = daysUntil(a.deadline, now), db = daysUntil(b.deadline, now);
  const rank = (d) => (d === null ? 1 : d < 0 ? 2 : 0);
  const ra = rank(da), rb = rank(db);
  if (ra !== rb) return ra - rb;
  if (ra === 1) return 0;
  if (ra === 2) return db - da;
  return da - db;
}
