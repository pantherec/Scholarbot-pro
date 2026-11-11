import { describe, it, expect } from "vitest";
import { friendlyAuthError, passwordProblem, PASSWORD_MIN, isRepeatSignUp, authLinkProblem } from "../authErrors.js";

describe("friendlyAuthError", () => {
  it("explains the password rules when Supabase rejects a weak password", () => {
    const out = friendlyAuthError({ message: "Password is known to be weak and easy to guess, please choose a different one." }, "signup");
    expect(out).toMatch(/data leak/);
    expect(out).toMatch(/different one/);
  });
  it("owns a failed confirmation email instead of blaming the student", () => {
    const out = friendlyAuthError({ message: "Error sending confirmation email", code: "unexpected_failure" }, "signup");
    expect(out).toMatch(/problem on our side/);
    expect(out).toMatch(/support@meritlaunch\.com/);
  });
  it("covers a failed recovery email too", () => {
    expect(friendlyAuthError({ message: "Error sending recovery email" }, "forgot")).toMatch(/problem on our side/);
  });
  it("points a wrong sign-in toward sign-up", () => {
    expect(friendlyAuthError({ message: "Invalid login credentials", code: "invalid_credentials" }, "signin")).toMatch(/Sign up/);
  });
  it("passes unknown messages through", () => {
    expect(friendlyAuthError({ message: "Something odd" }, "signin")).toBe("Something odd");
  });
});

describe("passwordProblem", () => {
  it("rejects short passwords and accepts long ones", () => {
    expect(passwordProblem("abc123")).toMatch(new RegExp(`too short. Use at least ${PASSWORD_MIN} characters`));
    expect(passwordProblem("river-lamp-orbit-42")).toBe("");
  });
});

describe("isRepeatSignUp", () => {
  it("spots Supabase's silent answer for an existing address", () => {
    expect(isRepeatSignUp({ user: { id: "x", identities: [] } })).toBe(true);
    expect(isRepeatSignUp({ user: { id: "x", identities: [{ id: "i" }] } })).toBe(false);
    expect(isRepeatSignUp({ user: null })).toBe(false);
    expect(isRepeatSignUp(null)).toBe(false);
  });
});

describe("authLinkProblem", () => {
  it("explains an expired link from the URL hash", () => {
    const out = authLinkProblem("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired", "");
    expect(out).toMatch(/expired or was already used/);
  });
  it("reads the error from the query string too", () => {
    expect(authLinkProblem("", "?error=access_denied&error_code=otp_expired")).toMatch(/expired/);
  });
  it("gives a general message for other link errors", () => {
    expect(authLinkProblem("#error=server_error&error_code=unexpected_failure", "")).toMatch(/did not work/);
  });
  it("stays quiet on a normal URL and on a recovery link", () => {
    expect(authLinkProblem("", "")).toBe("");
    expect(authLinkProblem("#access_token=abc&type=recovery", "")).toBe("");
  });
});
