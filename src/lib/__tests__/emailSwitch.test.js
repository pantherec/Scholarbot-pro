import { describe, it, expect } from "vitest";
import { emailRemindersLive } from "../../../api/_shared/emailSwitch.js";
import { EMAIL_REMINDERS_LIVE } from "../features.js";

describe("reminder email switch", () => {
  it("stays off with a Resend key alone", () => {
    expect(emailRemindersLive({ RESEND_API_KEY: "re_x" })).toBe(false);
  });
  it("needs both the key and the explicit switch", () => {
    expect(emailRemindersLive({ RESEND_API_KEY: "re_x", EMAIL_REMINDERS_LIVE: "true" })).toBe(true);
    expect(emailRemindersLive({ EMAIL_REMINDERS_LIVE: "true" })).toBe(false);
  });
  it("client copy still says reminders are not emailed", () => {
    expect(EMAIL_REMINDERS_LIVE).toBe(false);
  });
});
