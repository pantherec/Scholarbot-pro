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

// Document titles per view, so a route change is announced and tabs are
// tellable apart. The landing keeps the index.html title.
export const VIEW_TITLES = {
  search: "Find Scholarships", home: "Home", profile: "My Profile", profileResult: "Your Voice Profile",
  matches: "My Matches", apply: "Practice Answers", generate: "Write a Letter", templates: "Writing Styles",
  saved: "Saved Letters", tracker: "My Deadlines", parentPay: "For a parent or guardian",
};
export function titleFor(view) {
  return VIEW_TITLES[view] ? `${VIEW_TITLES[view]} · MeritLaunch` : "MeritLaunch - Your Story Is the Application";
}
