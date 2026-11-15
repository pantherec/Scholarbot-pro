import { describe, it, expect, vi } from "vitest";
import { deadlineInfo, parseDeadlineDate } from "../deadline.js";
import { parseDeadlineDate as serverParse } from "../../../api/_shared/deadline.js";
import { signOutWarning, loadWithRetry } from "../workSync.js";
import { scrubDeep } from "../scrub.js";
import { checkoutDecision } from "../../../api/_shared/planGuard.js";
import { deleteAccount } from "../../../api/_shared/account.js";
import { scoreParts } from "../matching.js";

const NOW = new Date(2026, 10, 14);

describe("an opening or announcement date is not a deadline", () => {
  const notDue = ["Reopens Dec 2026", "Opens October 1, 2026", "Re-opens Jan 2027", "Applications open Aug 1", "Recipients announced May 2027", "Winners notified April 15", "Awards made in June"];
  it.each(notDue)("%s is undated and keeps its own wording", (text) => {
    expect(parseDeadlineDate(text, NOW)).toBeNull();
    expect(serverParse(text)).toBeNull();
    expect(deadlineInfo(text, NOW)).toMatchObject({ tone: "undated", label: text });
  });
  it("still reads real deadlines", () => {
    expect(deadlineInfo("2026-12-01", NOW)).toMatchObject({ tone: "soon", days: 17 });
    expect(deadlineInfo("Mar 1", NOW).tone).toBe("open");
    expect(deadlineInfo("October 1, 2026", NOW).tone).toBe("closed");
    expect(deadlineInfo("FAFSA priority Mar 1", NOW).tone).toBe("open");
    expect(deadlineInfo("Opens Nov 1, 2026; final Mar 1, 2027", NOW)).toMatchObject({ tone: "open", days: 107 });
    expect(serverParse("Opens Nov 1, 2026; final Mar 1, 2027").getMonth()).toBe(2);
  });
});

describe("signing out warns unless the account has the work", () => {
  it("is silent only when saved", () => {
    expect(signOutWarning("saved")).toBe("");
    for (const s of ["unknown", "pending", "failed"]) expect(signOutWarning(s)).toMatch(/Sign out anyway\?/);
    expect(signOutWarning("unknown")).toMatch(/could not confirm/);
  });
  it("retries a failed load, then gives up", async () => {
    const flaky = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ ok: 1 });
    expect(await loadWithRetry(flaky, 3, 1)).toEqual({ ok: 1 });
    expect(flaky).toHaveBeenCalledTimes(2);
    const dead = vi.fn().mockResolvedValue(null);
    expect(await loadWithRetry(dead, 3, 1)).toBeNull();
    expect(dead).toHaveBeenCalledTimes(3);
  });
});

describe("contact details are stripped from all stored work", () => {
  it("scrubs strings inside answers and styles, and leaves the rest", () => {
    const out = scrubDeep({ q1: "Call me at 518-555-0142 or jo@example.com", n: 3, on: true, list: [{ id: "custom-1731512345678", text: "I live at 12 Oak Street, Albany, NY 12203" }] });
    expect(JSON.stringify(out)).not.toMatch(/555-0142|jo@example|Oak Street/);
    expect(out.n).toBe(3); expect(out.on).toBe(true);
    expect(out.list[0].id).toBe("custom-1731512345678");
    expect(scrubDeep(null)).toBeNull();
  });
});

describe("one plan, one charge", () => {
  const future = new Date(2027, 3, 1).toISOString(), past = new Date(2026, 0, 1).toISOString();
  it("grants to a free student or one whose pass ran out", () => {
    expect(checkoutDecision({ subscription_status: "free" }, "cs_1", NOW)).toBe("grant");
    expect(checkoutDecision({ subscription_status: "seasonal", seasonal_expires_at: past }, "cs_1", NOW)).toBe("grant");
    expect(checkoutDecision(null, "cs_1", NOW)).toBe("grant");
  });
  it("treats a second payment as a duplicate to refund", () => {
    expect(checkoutDecision({ subscription_status: "premium", last_checkout_session_id: "cs_1" }, "cs_2", NOW)).toBe("duplicate");
    expect(checkoutDecision({ subscription_status: "seasonal", seasonal_expires_at: future, last_checkout_session_id: "cs_1" }, "cs_2", NOW)).toBe("duplicate");
    expect(checkoutDecision({ subscription_status: "premium" }, "cs_2", NOW)).toBe("duplicate");
  });
  it("never refunds the payment that granted the plan when Stripe re-sends it", () => {
    expect(checkoutDecision({ subscription_status: "seasonal", seasonal_expires_at: future, last_checkout_session_id: "cs_1" }, "cs_1", NOW)).toBe("done");
  });
});

describe("deleting an account", () => {
  const fakeDb = (profile, readError = null) => {
    const deleteUser = vi.fn().mockResolvedValue({ error: null });
    const chain = { select: () => chain, delete: () => chain, eq: () => chain, maybeSingle: async () => ({ data: profile, error: readError }), then: (r) => r({ error: null }) };
    return { db: { from: () => chain, auth: { admin: { deleteUser } } }, deleteUser };
  };
  it("stops when billing cannot be checked", async () => {
    const { db, deleteUser } = fakeDb(null, { message: "timeout" });
    await expect(deleteAccount("u1", { db })).rejects.toThrow(/check billing/);
    expect(deleteUser).not.toHaveBeenCalled();
  });
  it("cancels the subscription first, then deletes", async () => {
    const { db, deleteUser } = fakeDb({ stripe_subscription_id: "sub_1" });
    const cancel = vi.fn().mockResolvedValue({});
    expect(await deleteAccount("u1", { db, stripe: { subscriptions: { cancel } } })).toEqual({ subscriptionCancelled: true });
    expect(cancel).toHaveBeenCalledWith("sub_1");
    expect(deleteUser).toHaveBeenCalledWith("u1");
  });
  it("keeps the account when the cancel fails", async () => {
    const { db, deleteUser } = fakeDb({ stripe_subscription_id: "sub_1" });
    const cancel = vi.fn().mockRejectedValue(Object.assign(new Error("card network down"), { code: "api_error" }));
    await expect(deleteAccount("u1", { db, stripe: { subscriptions: { cancel } } })).rejects.toThrow(/cancel the subscription/);
    expect(deleteUser).not.toHaveBeenCalled();
  });
  it("deletes a free account with no Stripe call", async () => {
    const { db, deleteUser } = fakeDb({ stripe_subscription_id: null });
    expect(await deleteAccount("u1", { db })).toEqual({ subscriptionCancelled: false });
    expect(deleteUser).toHaveBeenCalled();
  });
});

describe("Why this score gives true reasons", () => {
  const why = (profile, s) => { const p = scoreParts(profile, s, NOW); return { earned: p.earned.map(e => e.why).join(" | "), missed: p.missed.map(e => e.why).join(" | ") }; };
  const seniorAward = { name: "Local Award", criteria: "Open to any graduating senior." };
  it("credits graduating seniors only to seniors", () => {
    expect(why({ gradYear: "2027" }, seniorAward).earned).toMatch(/graduating seniors/);
    expect(why({}, seniorAward).earned).toMatch(/graduating seniors/);
    expect(why({ gradYear: "2024" }, seniorAward).earned).not.toMatch(/graduating seniors/);
    expect(why({ gradYear: "2029" }, seniorAward).earned).not.toMatch(/graduating seniors/);
  });
  it("does not read law into legally blind, or education into higher education", () => {
    const blind = { name: "Vision Award", criteria: "For students who are legally blind and pursuing higher education." };
    const r = why({ intendedMajor: "Biology" }, blind);
    expect(r.missed).not.toMatch(/mentions (law|education)/);
    expect(why({ intendedMajor: "Pre-law" }, blind).earned).not.toMatch(/Fits your major/);
  });
  it("still matches real law and teaching awards", () => {
    expect(why({ intendedMajor: "Pre-law" }, { name: "Bar Award", criteria: "For students who plan to study law." }).earned).toMatch(/Fits your major \(law\)/);
    expect(why({ intendedMajor: "Elementary Education" }, { name: "Future Teachers", criteria: "For students who plan a career in teaching." }).earned).toMatch(/Fits your major \(education\)/);
    expect(why({ intendedMajor: "Criminal Justice" }, { name: "Justice Award", criteria: "For criminal justice majors." }).earned).toMatch(/Fits your major \(law\)/);
  });
});
