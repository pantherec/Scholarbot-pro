// ============================================================
// MAIN APP COMPONENT
// ============================================================
// Each view has a real URL so returns from Stripe/email land in the right place,
// Back works, and pages can be linked.
export const VIEW_PATHS = {
  landing: "/", search: "/scholarships", home: "/app", profile: "/app/profile",
  profileResult: "/app/profile/voice", matches: "/app/matches", apply: "/app/prep",
  generate: "/app/letters", templates: "/app/styles", saved: "/app/saved", tracker: "/app/deadlines",
};
export const PATH_VIEWS = Object.fromEntries(Object.entries(VIEW_PATHS).map(([v, p]) => [p, v]));
export function viewFromPath(pathname) {
  const clean = (pathname || "/").replace(/\/+$/, "") || "/";
  if (clean.startsWith("/pay/")) return "parentPay";
  return PATH_VIEWS[clean] || (clean.startsWith("/app") ? "home" : "landing");
}
