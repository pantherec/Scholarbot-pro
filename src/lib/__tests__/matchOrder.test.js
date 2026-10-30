import { describe, it, expect } from "vitest";
import { rankByFit, pickNextMatch, isUrgent } from "../../views/matchOrder.js";

const mk = (id, matchScore, d) => ({ id, matchScore, dl: { days: d } });

describe("rankByFit", () => {
  const list = [mk("a", 20, 1), mk("b", 55, 10), mk("c", 80, 2), mk("d", 70, 20), mk("e", 60, 5), mk("f", 30, 0), mk("g", 40, 28)];
  it("puts the best fits first and nothing due in 3 days or less in the top 3", () => {
    const top3 = rankByFit(list).slice(0, 3);
    expect(top3.map(m => m.id)).toEqual(["d", "e", "b"]);
    expect(top3.some(isUrgent)).toBe(false);
  });
  it("keeps urgent items, at the end, best fit first", () => {
    const r = rankByFit(list);
    expect(r).toHaveLength(list.length);
    expect(r.slice(-3).map(m => m.id)).toEqual(["c", "f", "a"]);
  });
  it("leaves rolling listings (days null) in fit order", () => {
    expect(rankByFit([mk("x", 10, null), mk("y", 90, null)]).map(m => m.id)).toEqual(["y", "x"]);
  });
});

describe("pickNextMatch", () => {
  it("skips an urgent listing when a fit >= 40 listing with more time exists", () => {
    const pick = pickNextMatch([mk("u", 90, 2), mk("later", 45, 60)]);
    expect(pick.id).toBe("later");
  });
  it("prefers the best fit due this month", () => {
    expect(pickNextMatch([mk("a", 30, 10), mk("b", 70, 25), mk("c", 99, 90)]).id).toBe("b");
  });
  it("falls back to an urgent listing when nothing else exists", () => {
    expect(pickNextMatch([mk("u", 50, 1)]).id).toBe("u");
  });
});
