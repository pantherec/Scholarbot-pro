import { describe, it, expect, beforeEach } from "vitest";

// Minimal localStorage for node; api.js reads it lazily inside each helper.
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
const { clearStudentLocalData, readStoredSession, getAccessTokenSafe, STUDENT_STORAGE_KEYS } = await import("../api.js");
const AUTH_KEY = "sb-zudczsepvkjbjgomgilz-auth-token";

describe("shared-device sign-out", () => {
  beforeEach(() => mem.clear());
  it("removes every student key and nothing else", () => {
    for (const k of STUDENT_STORAGE_KEYS) localStorage.setItem(k, "x");
    localStorage.setItem("scholarbot-local-matches", "guest-count");
    clearStudentLocalData();
    for (const k of STUDENT_STORAGE_KEYS) expect(localStorage.getItem(k)).toBeNull();
    expect(localStorage.getItem("scholarbot-local-matches")).toBe("guest-count");
  });
  it("covers the profile, letters, tracker and draft", () => {
    for (const k of ["scholarbot-profile", "scholarbot-letters", "scholarbot-tracked-apps", "scholarbot-draft", "scholarbot-brag-sheet", "scholarbot-owner"]) {
      expect(STUDENT_STORAGE_KEYS).toContain(k);
    }
  });
});

describe("access token without the auth lock", () => {
  beforeEach(() => mem.clear());
  it("uses a stored token that is still valid, without calling getSession", async () => {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ access_token: "tok", expires_at: Math.floor(Date.now() / 1000) + 3600 }));
    expect(readStoredSession().access_token).toBe("tok");
    const t0 = Date.now();
    expect(await getAccessTokenSafe()).toBe("tok");
    expect(Date.now() - t0).toBeLessThan(100);
  });
  it("returns null with no stored session", () => {
    expect(readStoredSession()).toBeNull();
  });
});
