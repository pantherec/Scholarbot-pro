import { describe, it, expect } from "vitest";
import { rankByFit, pickNextMatch, isUrgent } from "../../views/matchOrder.js";

const mk = (id, matchScore, d) => ({ id, matchScore, dl: { days: d } });

describe("rankByFit", () => {
  const list = [mk("a", 20, 1), mk("b", 55, 10), mk("c", 80, 2), mk("d", 70, 20), mk("e", 60, 5), mk("f", 30, 0), mk("g", 40, 28)];
  it("orders strictly by fit, even when a strong fit is due today", () => {
    expect(rankByFit(list).map(m => m.id)).toEqual(["c", "d", "e", "b", "g", "f", "a"]);
  });
  it("never hides a higher score below a lower one unless it is weak and urgent", () => {
    // The tester's case: two 40s due today sat below three 10s due later.
    const r = rankByFit([mk("t1", 10, 18), mk("t2", 10, 18), mk("t3", 10, 18), mk("h1", 40, 0), mk("h2", 45, 0)]);
    expect(r.map(m => m.id)).toEqual(["h2", "h1", "t1", "t2", "t3"]);
  });
  it("still sinks a weak fit that is due within 3 days", () => {
    const r = rankByFit([mk("weakUrgent", 10, 1), mk("weakLater", 10, 30), mk("ok", 25, 2)]);
    expect(r.map(m => m.id)).toEqual(["ok", "weakLater", "weakUrgent"]);
    expect(isUrgent(r[2])).toBe(true);
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

import { lastOfferedText } from "../../views/matchOrder.js";
import { TERMS_SECTIONS } from "../../legalContent.js";

describe("past-cycle matches", () => {
  it("says when the award was last offered", () => {
    expect(lastOfferedText(new Date(2026, 2, 15))).toBe("Last offered: applications closed March 15, 2026. Not open right now.");
  });
  it("still says something true when the date is unknown", () => {
    expect(lastOfferedText(null)).toMatch(/date unknown/);
  });
});

describe("terms: no promised outcomes", () => {
  const text = JSON.stringify(TERMS_SECTIONS);
  it("calls score suggestions estimates and not predictions or advice", () => {
    expect(text).toMatch(/are estimates/);
    expect(text).toMatch(/not predictions/);
    expect(text).toMatch(/not a probability of winning/);
    expect(text).toMatch(/does not guarantee/);
  });
});
