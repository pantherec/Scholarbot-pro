import React from "react";
import ReactDOM from "react-dom/client";
import App, { ErrorBoundary } from "./App.jsx";

// Sentry error monitoring — fully inert until VITE_SENTRY_DSN is set in Vercel
// (Settings → Environment Variables) and the site is redeployed. The dynamic
// import keeps Sentry in its own async chunk, so users never download it while
// the DSN is absent.
const SENTRY_DSN = import.meta.env?.VITE_SENTRY_DSN;
if (SENTRY_DSN) {
  import("@sentry/react")
    .then((Sentry) => {
      Sentry.init({
        dsn: SENTRY_DSN,
        sendDefaultPii: false, // student-facing app: never attach IPs/PII
        tracesSampleRate: 0.1,
      });
    })
    .catch(() => { /* monitoring must never break the app */ });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
