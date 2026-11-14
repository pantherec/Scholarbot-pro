import { describe, it, expect } from "vitest";
import { alreadyPaidMessage, assertWritten } from "../../../api/_shared/planGuard.js";
import { REFUND_POLICY, REFUND_LETTER_CAP, SEASON_PASS_MONTHS, PLANS } from "../plans.js";
import { SEASON_PASS_MONTHS as SERVER_MONTHS } from "../../../api/_shared/usage.js";
import { TERMS_SECTIONS } from "../../legalContent.js";

describe("one plan at a time", () => {
  it("refuses checkout for a student who already has a paid plan", () => {
    expect(alreadyPaidMessage({ paid: true })).toMatch(/already have a paid plan/);
  });
  it("lets a free student check out", () => {
    expect(alreadyPaidMessage({ paid: false })).toBe("");
    expect(alreadyPaidMessage(null)).toBe("");
  });
});

describe("webhook plan grant", () => {
  it("throws when the Supabase write failed, so Stripe retries", () => {
    expect(() => assertWritten({ error: { message: "boom" } }, "Premium grant")).toThrow(/Premium grant failed: boom/);
  });
  it("passes a clean write", () => {
    expect(() => assertWritten({ error: null }, "x")).not.toThrow();
  });
});

describe("refund policy", () => {
  it("states 7 days and the letter cap", () => {
    expect(REFUND_POLICY).toMatch(/within 7 days/);
    expect(REFUND_POLICY).toContain(`${REFUND_LETTER_CAP} or fewer letters`);
    expect(REFUND_LETTER_CAP).toBe(5);
  });
});

describe("Season Pass", () => {
  it("lasts 6 months on the client and the server", () => {
    expect(SEASON_PASS_MONTHS).toBe(6);
    expect(SERVER_MONTHS).toBe(SEASON_PASS_MONTHS);
  });
  it("says how long it lasts and that it never renews, wherever it is sold", () => {
    const card = PLANS.find(p => p.id === "seasonal").features.join(" | ");
    expect(card).toContain("for 6 months");
    expect(card).toMatch(/never renews/);
    const terms = JSON.stringify(TERMS_SECTIONS);
    expect(terms).toMatch(/for 6 months from the day you buy it/);
    expect(terms).toMatch(/does not renew/);
    expect(card + terms).not.toMatch(/forever|lifetime|4 months/i);
  });
});
