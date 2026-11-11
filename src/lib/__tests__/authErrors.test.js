import { describe, it, expect } from "vitest";
import { friendlyAuthError, passwordProblem, PASSWORD_MIN } from "../authErrors.js";

describe("friendlyAuthError", () => {
  it("explains the password rules when Supabase rejects a weak password", () => {
    const out = friendlyAuthError({ message: "Password is known to be weak and easy to guess, please choose a different one." }, "signup");
    expect(out).toMatch(new RegExp(`at least ${PASSWORD_MIN} characters`));
    expect(out).toMatch(/data leaks/);
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
    expect(passwordProblem("abc123")).toMatch(/too short/);
    expect(passwordProblem("river-lamp-orbit-42")).toBe("");
  });
});
