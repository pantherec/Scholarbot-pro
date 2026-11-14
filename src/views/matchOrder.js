// Ordering rules shared by My Matches and the Dashboard "Your next step".
// Items carry `matchScore` and `dl.days` (days until the deadline; null = rolling).
// Best fit first, always. A strong fit due today still belongs at the top (its
// "Due" badge carries the urgency). Only a WEAK fit (under WEAK_FIT) due in
// URGENT_DAYS or fewer drops to the end of its group: a 10-point match due
// tomorrow with a long essay should not be the first card a student sees.
export const URGENT_DAYS = 3;
export const WEAK_FIT = 20;
const days = (m) => (m && m.dl ? m.dl.days : null);
export const isUrgent = (m) => { const d = days(m); return d !== null && d >= 0 && d <= URGENT_DAYS; };

export function rankByFit(list) {
  const byFit = list.slice().sort((a, b) => (b.matchScore - a.matchScore) || ((days(a) ?? 1e9) - (days(b) ?? 1e9)));
  const sinks = (m) => isUrgent(m) && m.matchScore < WEAK_FIT;
  return [...byFit.filter(m => !sinks(m)), ...byFit.filter(sinks)];
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
