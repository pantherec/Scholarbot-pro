import { describe, it, expect } from "vitest";

// With no Upstash env vars the module uses the in-memory counter.
describe("checkRateLimit (in-memory path)", () => {
  it("allows up to the limit then blocks", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const { checkRateLimit } = await import("../../../api/_shared/auth.js");
    const key = `test-${Date.now()}`;
    expect((await checkRateLimit(key, 2, 60000)).allowed).toBe(true);
    expect((await checkRateLimit(key, 2, 60000)).allowed).toBe(true);
    expect((await checkRateLimit(key, 2, 60000)).allowed).toBe(false);
  });
});
