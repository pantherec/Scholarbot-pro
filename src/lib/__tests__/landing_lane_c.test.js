import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { PLANS } from "../plans.js";
import { heroPriceLine } from "../heroPrice.js";
import { __pendingCount, track, trackSignupStarted, trackError } from "../../analytics.js";
import { viewFromPath } from "../../routes.js";

describe("hero price line", () => {
  it("is built from PLANS", () => {
    const premium = PLANS.find((p) => p.id === "premium");
    expect(heroPriceLine(PLANS)).toBe(`Free to start. ${premium.name} ${premium.price}/mo, cancel anytime.`);
    expect(heroPriceLine([{ id: "free" }, { id: "premium", name: "Premium", price: "$12.50" }])).toContain("$12.50");
  });
  it("Landing does not hard-code the price", () => {
    const src = readFileSync(new URL("../../views/Landing.jsx", import.meta.url), "utf8");
    expect(src).not.toMatch(/\$9\.99/);
  });
});

describe("analytics for guests", () => {
  it("queues nothing before sign-in", () => {
    track("x"); trackSignupStarted(); trackError(new Error("e"));
    expect(__pendingCount()).toBe(0);
  });
});

describe("routes", () => {
  it("identifies parent pay pages", () => {
    expect(viewFromPath("/pay/abc")).toBe("parentPay");
  });
});
