// ============================================================
// MeritLaunch Analytics — PostHog wrapper
// ============================================================
// Set VITE_POSTHOG_KEY in Vercel environment variables.
// Get your key from: https://app.posthog.com/settings/project → Project API key
//
// This module lazy-loads PostHog so it never blocks the app.
// All calls are no-ops until posthog-js loads and VITE_POSTHOG_KEY is present.
// ============================================================

const POSTHOG_KEY = typeof import.meta !== "undefined"
  ? import.meta.env?.VITE_POSTHOG_KEY
  : undefined;

const POSTHOG_HOST = "https://us.i.posthog.com";

let ph = null;

function getPosthog() {
  return ph;
}

// Initialize PostHog. Call once on app mount.
export function initAnalytics() {
  if (!POSTHOG_KEY) return; // no-op if key not set
  if (ph) return; // already initialized

  // Dynamically import posthog-js so it doesn't affect bundle if key is absent
  import("posthog-js").then(({ default: posthog }) => {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      person_profiles: "identified_only", // COPPA-safe: no anonymous profiles
      capture_pageview: true,             // automatic page view on init
      autocapture: false,                 // manual events only — keeps data clean
      persistence: "localStorage+cookie",
    });
    ph = posthog;
  }).catch(() => {
    // posthog-js not installed — graceful no-op
    // To install: npm install posthog-js
  });
}

// Identify a signed-in user (call after successful signup/signin).
// We send only the user ID — no PII like email — to stay COPPA-safe.
export function identifyUser(userId) {
  const posthog = getPosthog();
  if (!posthog) return;
  posthog.identify(userId);
}

// Reset identity on sign-out.
export function resetUser() {
  const posthog = getPosthog();
  if (!posthog) return;
  posthog.reset();
}

// ============================================================
// Named events — use these everywhere, never raw strings
// ============================================================

export function trackSignupStarted() {
  const posthog = getPosthog();
  if (!posthog) return;
  posthog.capture("signup_started");
}

export function trackSignupCompleted(userId) {
  const posthog = getPosthog();
  if (!posthog) return;
  posthog.capture("signup_completed", { user_id: userId });
}

export function trackLetterGenerated({ scholarshipName, template }) {
  const posthog = getPosthog();
  if (!posthog) return;
  posthog.capture("letter_generated", {
    scholarship_name: scholarshipName,
    template,
  });
}

// Generic track for any future event
export function track(event, properties = {}) {
  const posthog = getPosthog();
  if (!posthog) return;
  posthog.capture(event, properties);
}

// Report a client-side render/runtime error so a production crash tells us
// exactly which component and line threw. Never let reporting itself throw.
export function trackError(error, context = {}) {
  try {
    const posthog = getPosthog();
    if (!posthog) return;
    posthog.capture("client_error", {
      message: error?.message || String(error),
      stack: (error?.stack || "").slice(0, 3000),
      ...context,
    });
  } catch (e) { /* reporting must never break the app */ }
}
