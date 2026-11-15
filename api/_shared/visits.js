// Anonymous visit counts. The browser says only "this page was opened" or
// "this button was pressed", plus the ad or post tag from the link that brought
// the visit. Nothing identifies the visitor: no user id, no cookie, and the IP
// address is used only for the rate limit and never stored with the count.
export const VISIT_EVENTS = ["landing_view", "start_free", "signup", "parent_view", "parent_checkout", "parent_paid"];

const TAG = /^[a-z0-9_-]{1,40}$/;
const tag = (v) => { const t = String(v || "").toLowerCase(); return TAG.test(t) ? t : ""; };

// Returns { event, source, content } or null when the request is not countable.
export function cleanVisit(body) {
  const event = String(body?.event || "");
  if (!VISIT_EVENTS.includes(event)) return null;
  return { event, source: tag(body.source), content: tag(body.content) };
}
