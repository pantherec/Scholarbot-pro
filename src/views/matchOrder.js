// Ordering rules shared by My Matches and the Dashboard "Your next step".
// Items carry `matchScore` and `dl.days` (days until the deadline; null = rolling).
// Best fit first. Anything due in URGENT_DAYS or fewer goes to the end of its
// group (still listed, still with its real date): a weak fit due tomorrow with a
// long essay should not be the first card a student sees.
export const URGENT_DAYS = 3;
const days = (m) => (m && m.dl ? m.dl.days : null);
export const isUrgent = (m) => { const d = days(m); return d !== null && d >= 0 && d <= URGENT_DAYS; };

export function rankByFit(list) {
  const byFit = list.slice().sort((a, b) => (b.matchScore - a.matchScore) || ((days(a) ?? 1e9) - (days(b) ?? 1e9)));
  return [...byFit.filter(m => !isUrgent(m)), ...byFit.filter(isUrgent)];
}

// The one match the Dashboard suggests. Prefers a listing due within 30 days,
// never an urgent one while a fit >= 40 listing with more time exists.
export function pickNextMatch(liveMatches) {
  const soon = rankByFit(liveMatches.filter(m => days(m) <= 30));
  const all = rankByFit(liveMatches);
  const calm = soon.find(m => !isUrgent(m));
  if (calm) return calm;
  const roomy = all.find(m => !isUrgent(m) && m.matchScore >= 40);
  return roomy || soon[0] || all[0];
}
