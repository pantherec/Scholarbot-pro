import { describe, it, expect } from "vitest";
import { alreadyPaidMessage, assertWritten } from "../../../api/_shared/planGuard.js";
import { REFUND_POLICY, REFUND_LETTER_CAP } from "../plans.js";

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
