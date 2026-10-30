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
let initializing = false;

// Events fired before posthog-js finishes loading (e.g. checkout_completed on
// the Stripe return URL) are held here and flushed once it's ready, instead of
// being silently dropped.
const pending = [];
const MAX_PENDING = 50;

function getPosthog() {
  return ph;
}

// Analytics only run for signed-in users (see the privacy policy). `active` is
// false for guests and after sign-out, so a guest's events are dropped, never
// queued to fire later.
let active = false;

export function __pendingCount() { return pending.length; }

function capture(event, properties) {
  if (!active) return;
  if (ph) { ph.capture(event, properties); return; }
  if (!POSTHOG_KEY) return;
  if (pending.length < MAX_PENDING) pending.push([event, properties]);
}

// Initialize PostHog. Call only once a user is signed in; safe to call again
// on every sign-in (it re-enables capture after a sign-out).
export function initAnalytics() {
  if (!POSTHOG_KEY) return; // no-op if key not set
  active = true;
  if (ph) { try { ph.opt_in_capturing(); } catch (e) { /* ignore */ } return; } // already initialized
  if (initializing) return;
  initializing = true;

  // Dynamically import posthog-js so it doesn't affect bundle if key is absent
  import("posthog-js").then(({ default: posthog }) => {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      person_profiles: "identified_only", // COPPA-safe: no anonymous profiles
      capture_pageview: true,             // automatic page view on init
      autocapture: false,                 // manual events only — keeps data clean
      persistence: "localStorage+cookie",
      capture_dead_clicks: false,         // policy: no automatic click capture
      disable_surveys: true,              // no survey widget or survey script
      disable_session_recording: true,    // no session replay
      capture_heatmaps: false,
    });
    ph = posthog;
    if (active && pendingId) { posthog.identify(pendingId); pendingId = null; }
    if (!active) { try { posthog.opt_out_capturing(); } catch (e) { /* ignore */ } pending.length = 0; return; }
    while (pending.length) {
      const [event, properties] = pending.shift();
      posthog.capture(event, properties);
    }
  }).catch(() => {
    initializing = false;
    // posthog-js not installed — graceful no-op
    // To install: npm install posthog-js
  });
}

// Identify a signed-in user (call after successful signup/signin).
// We send only the user ID — no PII like email — to stay COPPA-safe.
let pendingId = null;
export function identifyUser(userId) {
  if (!active) return;
  const posthog = getPosthog();
  if (!posthog) { pendingId = userId; return; }
  posthog.identify(userId);
}

// Reset identity on sign-out.
export function resetUser() {
  active = false;
  pendingId = null;
  pending.length = 0;
  const posthog = getPosthog();
  if (!posthog) return;
  posthog.reset();
  try { posthog.opt_out_capturing(); } catch (e) { /* ignore */ }
}

// ============================================================
// Named events — use these everywhere, never raw strings
// ============================================================

export function trackSignupStarted() {
  capture("signup_started");
}

export function trackSignupCompleted(userId) {
  capture("signup_completed", { user_id: userId });
}

export function trackLetterGenerated({ scholarshipName, template }) {
  capture("letter_generated", {
    scholarship_name: scholarshipName,
    template,
  });
}

// Generic track for any future event
export function track(event, properties = {}) {
  capture(event, properties);
}

// Report a client-side render/runtime error so a production crash tells us
// exactly which component and line threw. Never let reporting itself throw.
export function trackError(error, context = {}) {
  try {
    if (!active) return;
    const posthog = getPosthog();
    if (!posthog) return;
    posthog.capture("client_error", {
      message: error?.message || String(error),
      stack: (error?.stack || "").slice(0, 3000),
      ...context,
    });
  } catch (e) { /* reporting must never break the app */ }
}
