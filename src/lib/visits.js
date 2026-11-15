// Sends one anonymous count per event per browser session. See
// api/_shared/visits.js for what is and is not recorded.
import { VISIT_EVENTS } from "../../api/_shared/visits.js";

const TAG_KEY = "meritlaunch-visit-tag";   // the ad or post tag this visit arrived with
const SENT_KEY = "meritlaunch-visit-sent"; // events already counted this session

// Read utm_source and utm_content once, when the visit starts, and keep them
// for the session so a later sign-up is credited to the same ad.
export function visitTag(search, storage) {
  try {
    const kept = JSON.parse(storage.getItem(TAG_KEY) || "null");
    if (kept) return kept;
    const q = new URLSearchParams(search || "");
    const out = { source: q.get("utm_source") || "", content: q.get("utm_content") || "" };
    storage.setItem(TAG_KEY, JSON.stringify(out));
    return out;
  } catch (e) { return { source: "", content: "" }; }
}

// True the first time an event is seen in this session.
export function firstThisSession(event, storage) {
  try {
    const sent = JSON.parse(storage.getItem(SENT_KEY) || "[]");
    if (sent.includes(event)) return false;
    storage.setItem(SENT_KEY, JSON.stringify([...sent, event]));
    return true;
  } catch (e) { return false; }
}

export function countVisit(event) {
  try {
    if (!VISIT_EVENTS.includes(event) || typeof window === "undefined") return;
    const tag = visitTag(window.location.search, sessionStorage);
    if (!firstThisSession(event, sessionStorage)) return;
    fetch("/api/usage", {
      method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "count", event, source: tag.source, content: tag.content }),
    }).catch(() => {});
  } catch (e) { /* counting must never break the page */ }
}
