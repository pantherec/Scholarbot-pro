import { describe, it, expect } from "vitest";
import { scrubContact, countContact } from "../scrub.js";
import { scrubContact as serverScrub } from "../../../api/_shared/prompts.js";
import { DRAFT_RETENTION_DAYS } from "../plans.js";
import { DRAFT_RETENTION_DAYS as SERVER_DAYS } from "../../../api/_shared/account.js";
import { PRIVACY_SECTIONS } from "../../legalContent.js";

const RESUME = "Maria Gonzalez\n412 Maple Street, Albany, NY 12203\n(518) 555-0142 | maria.g@example.com\nCashier, Price Chopper, 2025 to 2026\nGPA 3.9, graduating 2027";

describe("contact details are stripped before text is kept", () => {
  it("removes the phone, email and street address and keeps the rest", () => {
    const out = scrubContact(RESUME);
    expect(out).not.toMatch(/555-0142|example\.com|Maple Street/);
    expect(out).toMatch(/Cashier, Price Chopper/);
    expect(out).toMatch(/GPA 3\.9, graduating 2027/);
    expect(countContact(RESUME)).toBe(3);
  });
  it("matches the server's rule exactly", () => {
    expect(scrubContact(RESUME)).toBe(serverScrub(RESUME));
  });
});

describe("retention and the privacy policy", () => {
  it("uses one draft retention period on the client and the server", () => {
    expect(DRAFT_RETENTION_DAYS).toBe(SERVER_DAYS);
  });
  it("tells students what is stored, for how long, and how to delete it", () => {
    const text = JSON.stringify(PRIVACY_SECTIONS);
    expect(text).toMatch(/practice answers/);
    expect(text).toMatch(/kept in your account automatically/);
    expect(text).toContain(`${DRAFT_RETENTION_DAYS} days`);
    expect(text).toMatch(/Your data/);
    expect(text).toMatch(/remove phone numbers, email addresses and street addresses/);
  });
});
