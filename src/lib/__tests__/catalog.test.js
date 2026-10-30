import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchScholarshipsFromSupabase, fetchCatalogFromRoute, mapScholarshipRow } from "../api.js";

const ROW = { id: 1, name: "A", criteria: null, link: null, deadline: null, amount: null, need_based: "Y", country: null, state: null, link_status: null, link_verified_at: null };
const ok = (json, status = 200) => ({ ok: status < 300, status, json: async () => json });

afterEach(() => vi.unstubAllGlobals());

describe("catalog fetch", () => {
  it("uses /api/catalog and maps rows identically to the direct path", async () => {
    const f = vi.fn(async () => ok({ rows: [ROW], count: 1, generatedAt: "x" }));
    vi.stubGlobal("fetch", f);
    const out = await fetchScholarshipsFromSupabase();
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][0]).toBe("/api/catalog");
    expect(out).toEqual([mapScholarshipRow(ROW)]);
    expect(out[0]).toMatchObject({ deadline: "Varies", amount: "Varies", country: "US", needBased: "Y" });
  });
  it("falls back to Supabase REST on a non-2xx route", async () => {
    const f = vi.fn(async (url) => (String(url).startsWith("/api/catalog") ? ok({}, 502) : ok([ROW])));
    vi.stubGlobal("fetch", f);
    const out = await fetchScholarshipsFromSupabase();
    expect(out).toEqual([mapScholarshipRow(ROW)]);
    expect(String(f.mock.calls[1][0])).toContain("/rest/v1/scholarships");
  });
  it("falls back on a network error and on an empty route body", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url) => { if (String(url) === "/api/catalog") throw new Error("down"); return ok([ROW]); }));
    expect(await fetchScholarshipsFromSupabase()).toHaveLength(1);
    vi.stubGlobal("fetch", vi.fn(async () => ok({ rows: [] })));
    expect(await fetchCatalogFromRoute()).toBeNull();
  });
});
