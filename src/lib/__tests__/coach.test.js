import { describe, it, expect } from "vitest";
import { gpaLadder, ladderSummary, gradeFromGradYear, guidanceFor, GUIDANCE, COACH_DISCLAIMER } from "../coach.js";
import { scoreParts, scoreMatch } from "../matching.js";

const NOW = new Date(2026, 10, 14); // 14 Nov 2026
const CAT = [
  { name: "A", criteria: "Minimum 2.5 GPA required.", deadline: "2027-03-01" },
  { name: "B", criteria: "Minimum 3.0 GPA. Leadership valued.", deadline: "2027-03-01" },
  { name: "C", criteria: "Minimum 3.0 GPA.", deadline: "Varies" },
  { name: "D", criteria: "Minimum 3.5 GPA.", deadline: "2027-04-01" },
  { name: "E", criteria: "Minimum 3.0 GPA.", deadline: "2026-01-15" }, // closed: not counted
  { name: "F", criteria: "For nursing majors.", deadline: "2027-04-01" }, // no minimum
];

describe("GPA ladder", () => {
  const ladder = gpaLadder(CAT, NOW);
  it("counts only open listings that state a minimum", () => {
    expect(ladder.withMinimum).toBe(4);
    expect(ladder.openAt(2.5)).toBe(1);
    expect(ladder.openAt(3.0)).toBe(3);
    expect(ladder.openAt(3.5)).toBe(4);
  });
  it("tells a student where they stand and what the next step opens", () => {
    expect(ladderSummary(ladder, "2.8")).toMatchObject({ now: 1, next: { gpa: 3.0, more: 2 } });
    expect(ladderSummary(ladder, "3.2")).toMatchObject({ now: 3, next: { gpa: 3.5, more: 1 } });
    expect(ladderSummary(ladder, "3.9").next).toBe(null);
    expect(ladderSummary(ladder, "").now).toBe(null);
  });
});

describe("grade from graduation year", () => {
  it("turns over in August", () => {
    expect(gradeFromGradYear("2027", NOW)).toBe(12);
    expect(gradeFromGradYear("2028", NOW)).toBe(11);
    expect(gradeFromGradYear("2029", NOW)).toBe(10);
    expect(gradeFromGradYear("2027", new Date(2027, 4, 1))).toBe(12);
    expect(gradeFromGradYear("Already in college", NOW)).toBe("college");
    expect(gradeFromGradYear("", NOW)).toBe(null);
  });
});

describe("guidance cards", () => {
  it("every card names a source and links to it", () => {
    for (const c of GUIDANCE) {
      expect(c.source.length).toBeGreaterThan(10);
      expect(c.url).toMatch(/^https:\/\//);
      expect(c.url).not.toMatch(/fastweb|scholarships\.com|bold\.org|niche\.com|unigo/);
    }
  });
  it("never promises an outcome", () => {
    const all = JSON.stringify(GUIDANCE).toLowerCase();
    expect(all).not.toMatch(/we guarantee|you will win|increase your chances|boost your chances|sure to/);
    expect(COACH_DISCLAIMER).toMatch(/not predictions or advice/);
  });
  it("gives each grade its own list", () => {
    expect(guidanceFor(9).some(c => c.id === "g9-list")).toBe(true);
    expect(guidanceFor(12).some(c => c.id === "g12-grades")).toBe(true);
    expect(guidanceFor(12).some(c => c.id === "g9-list")).toBe(false);
  });
});

describe("score breakdown", () => {
  const p = { location: "Boise, ID", gpa: "3.2", financialNeed: "", intendedMajor: "", activities: "", awards: "", communityService: "" };
  const s = { name: "Idaho Nursing Leaders Award", criteria: "Need-based. For nursing majors with a minimum 3.0 GPA who show leadership.", needBased: "Y", state: "ID" };
  it("adds up to the fit score", () => {
    const { earned } = scoreParts(p, s);
    expect(earned.reduce((n, e) => n + e.pts, 0)).toBe(scoreMatch(p, s).score);
    expect(earned.map(e => e.why)).toEqual(["For ID students", "Your 3.2 GPA meets the 3.0 minimum"]);
  });
  it("names the points not earned and why", () => {
    const why = scoreParts(p, s).missed.map(m => `${m.pts}: ${m.why}`);
    expect(why).toContain("15: It is need-based, and you have not answered the financial need question");
    expect(why.some(w => w.startsWith("20: It mentions nursing"))).toBe(true);
    expect(why.some(w => w.startsWith("5: It values leadership"))).toBe(true);
  });
});
