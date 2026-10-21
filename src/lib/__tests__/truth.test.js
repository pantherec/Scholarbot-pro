import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { findUnsupportedDetails } from "../factcheck.js";
import { checkEligibility, scoreMatch, rankMatches, studentCountry } from "../matching.js";
import { parseDeadlineDate, deadlineInfo } from "../deadline.js";
import { computeCatalogStats, isProgramTotal } from "../catalogStats.js";
import { buildLetterRequest, buildProfileRequest } from "../../../api/_shared/prompts.js";
import { parseDeadlineDate as serverParse } from "../../../api/_shared/deadline.js";

// Two test-account profiles (contact fields removed) and the drafts the 10-21
// critic run produced for them. Every flagged detail below was invented.
const MARIA = { gpa: "3.9", name: "Maria Gonzalez", awards: "HOSA Regional Silver Medal, Perfect Attendance", satact: "1350 SAT", school: "Wilson Magnet High School", gradYear: "2026", location: "Rochester, NY", ethnicity: ["Hispanic/Latino"], activities: "HOSA Vice President, Hospital Candy Striper Volunteer, Spanish Honor Society", careerGoal: "Become a bilingual pediatric nurse serving underinsured families.", citizenship: "U.S. Citizen", writingStyle: "Warm and narrative — I tell stories", financialNeed: "Yes — Pell-eligible", intendedMajor: "Nursing", personalStory: "Translating for my grandmother at doctor visits showed me how much good care depends on being understood.", communityService: "200+ hours as a hospital volunteer translating for Spanish-speaking patients.", ageOk: true };
const AMARA = { gpa: "4.0", name: "Amara Okafor", awards: "Valedictorian candidate, National Merit Commended", satact: "1480 SAT", school: "School of the Arts", gradYear: "2025", location: "Rochester, NY", ethnicity: ["African American/Black", "Multiracial"], activities: "NSBE Chapter Founder, Debate Team Captain, Math Olympiad", careerGoal: "Machine learning engineer working on accessible technology.", citizenship: "DACA/TPS", writingStyle: "Reflective and thoughtful — I go deep", financialNeed: "Yes — moderate need", intendedMajor: "Computer Science", personalStory: "Moving between two countries before age 10 taught me to adapt fast — now I build software that adapts to people.", communityService: "Founded a free coding workshop for middle schoolers at the community center.", ageOk: true };
const AWARD = { name: "Community Leadership Merit Award", description: "A $2,500 award for a graduating senior with sustained leadership and service in their community. Minimum 3.0 GPA. Explain how your intended field of study connects to community impact, and describe a challenge you overcame." };
const fixture = (f) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");

describe("fact check: details the student never gave", () => {
  it("flags the invented age, duration and count in Maria's draft, and nothing she did say", () => {
    const flags = findUnsupportedDetails(fixture("maria_draft.txt"), { profile: MARIA, scholarship: AWARD });
    const texts = flags.map((f) => f.text.toLowerCase());
    expect(texts).toContain("i was eleven");
    expect(texts).toContain("three");
    expect(texts).not.toContain("200");
    expect(texts.join(" ")).not.toMatch(/rochester|hosa|wilson|spanish|candy|silver/);
    expect(flags.find((f) => f.text.toLowerCase() === "i was eleven").kind).toBe("age");
  });
  it("flags the counts, weekdays and 'last spring' in Amara's draft", () => {
    const flags = findUnsupportedDetails(fixture("amara_draft.txt"), { profile: AMARA, scholarship: AWARD });
    const texts = flags.map((f) => f.text.toLowerCase());
    for (const t of ["four", "twenty", "thursday", "tuesday", "last spring", "sixth"]) expect(texts).toContain(t);
    expect(texts).not.toContain("two");   // "two countries" is in her profile
    expect(texts).not.toContain("ten");   // "before age 10" is in her profile
    expect(texts.join(" ")).not.toMatch(/nsbe|debate|olympiad|rochester|daca/);
  });
  it("accepts numbers and names the student gave, in digits or words", () => {
    const letter = "In two years I logged 200 hours at Wilson Magnet. My 3.9 GPA held.";
    expect(findUnsupportedDetails(letter, { profile: { ...MARIA, personalStory: "two years of this" } })).toEqual([]);
  });
  it("returns each detail once, in letter order, and nothing for an empty draft", () => {
    const flags = findUnsupportedDetails("Six kids came on Monday. Then six more came on Monday.", { profile: MARIA });
    expect(flags.map((f) => f.text)).toEqual(["Six", "Monday"]);
    expect(findUnsupportedDetails("", { profile: MARIA })).toEqual([]);
  });
});

describe("drafts don't volunteer immigration status or finances", () => {
  it("leaves DACA and need out of the prompt for an award that never asked", () => {
    const req = buildLetterRequest({ profile: AMARA, scholarship: { source: "custom", ...AWARD } });
    expect(req.system).not.toMatch(/DACA|CITIZENSHIP|FINANCIAL NEED/);
    expect(req.system).toContain("Never mention immigration or citizenship status");
    expect(JSON.stringify(buildProfileRequest({ profile: AMARA }))).not.toMatch(/DACA|moderate need/);
  });
  it("includes them when the scholarship asks, or the student opts in", () => {
    const asks = { source: "database", name: "Golden Door Scholars", criteria: "DACA or undocumented high school seniors with financial need." };
    expect(buildLetterRequest({ profile: AMARA, scholarship: asks }).system).toMatch(/CITIZENSHIP: DACA\/TPS/);
    expect(buildLetterRequest({ profile: AMARA, scholarship: asks }).system).toMatch(/FINANCIAL NEED/);
    const optIn = buildLetterRequest({ profile: AMARA, scholarship: { source: "custom", ...AWARD }, includeSensitive: true });
    expect(optIn.system).toMatch(/CITIZENSHIP: DACA\/TPS/);
    expect(buildLetterRequest({ profile: AMARA, scholarship: { source: "custom", ...AWARD }, includeSensitive: "yes" }).system).not.toMatch(/DACA/);
  });
});

describe("matching: the five 10-11 gaps", () => {
  const HSF = { id: "hsf", name: "Hispanic Scholarship Fund", criteria: "Of Hispanic heritage. U.S. citizen, permanent resident, or DACA eligible. Minimum 3.0 GPA.", deadline: "2099-02-15" };
  const RON_BROWN = { id: "rb", name: "Ron Brown Scholar Program", criteria: "African American high school seniors. U.S. citizen, permanent resident or DACA.", deadline: "2099-12-01" };
  const MINORITY = { id: "min", name: "Future Leaders", criteria: "High school seniors from minority backgrounds. 3.0 GPA.", deadline: "2099-05-01" };
  const JACKIE = { id: "jr", name: "Jackie Robinson Foundation", criteria: "Be a United States citizen. Graduating high school senior with leadership.", deadline: "2099-01-31" };
  const ALBERTA_WOMEN = { id: "aw", name: "Alberta Women in STEM", criteria: "Women entering STEM programs at an Alberta institution. Underrepresented groups encouraged.", country: "CA", deadline: "2099-03-15" };
  const UNDOCU = { id: "un", name: "Scholarships for Undocu Students", criteria: "For undocu students pursuing higher education. Any major.", deadline: "2099-04-01" };
  const TORONTO = { ...MARIA, location: "Toronto, ON", citizenship: "Other" };

  it("a Black multiracial student gets Black and minority awards, not Hispanic-only ones", () => {
    expect(checkEligibility(AMARA, HSF).eligible).toBe(false);
    expect(checkEligibility(AMARA, RON_BROWN).eligible).toBe(true);
    expect(checkEligibility(AMARA, MINORITY).eligible).toBe(true);
    expect(checkEligibility({ ...AMARA, ethnicity: ["Multiracial"] }, HSF).eligible).toBe(true); // no group named: stays lenient
  });
  it("catches 'United States citizen' spelled out", () => {
    expect(checkEligibility(AMARA, JACKIE).eligible).toBe(false);
    expect(checkEligibility(MARIA, JACKIE).eligible).toBe(true);
  });
  it("keeps another country's awards away from US students", () => {
    expect(studentCountry(MARIA)).toBe("US");
    expect(studentCountry(TORONTO)).toBe("CA");
    expect(studentCountry({ citizenship: "International Student" })).toBe(null);
    expect(checkEligibility(MARIA, ALBERTA_WOMEN).why).toBe("country");
    expect(checkEligibility(TORONTO, ALBERTA_WOMEN).eligible).toBe(true);
    expect(checkEligibility(TORONTO, MINORITY).why).toBe("country");
  });
  it("never calls a women-only award 'heritage-specific'", () => {
    expect(scoreMatch(TORONTO, ALBERTA_WOMEN).reasons.join(" ")).not.toMatch(/Heritage/);
    expect(scoreMatch(AMARA, MINORITY).reasons.join(" ")).toMatch(/Heritage/);
  });
  it("keeps undocumented-only awards away from citizens", () => {
    expect(checkEligibility(MARIA, UNDOCU).eligible).toBe(false);
    expect(checkEligibility(AMARA, UNDOCU).eligible).toBe(true);
  });
  it("ranks only what passes", () => {
    const ids = rankMatches(AMARA, [HSF, RON_BROWN, MINORITY, JACKIE, ALBERTA_WOMEN, UNDOCU]).map((s) => s.id);
    expect(ids).not.toContain("hsf");
    expect(ids).not.toContain("jr");
    expect(ids).not.toContain("aw");
    expect(ids).toContain("rb");
  });
});

describe("deadlines need a real date", () => {
  const now = new Date(2026, 9, 21);
  it("treats text with no month as undated instead of January 1", () => {
    for (const raw of ["Annual", "Year-Round", "Via FAFSA/TASFA", "Fall 2026", "Spring", "2026 cycle", "Varies by chapter"]) {
      expect(parseDeadlineDate(raw, now)).toBe(null);
      expect(serverParse(raw)).toBe(null);
      expect(deadlineInfo(raw, now).tone).toBe("undated");
    }
  });
  it("still parses real dates in every shape", () => {
    expect(parseDeadlineDate("March 1st", now).getMonth()).toBe(2);
    expect(parseDeadlineDate("Dec 15", now).getFullYear()).toBe(2026);
    expect(parseDeadlineDate("12/31/2026", now).getDate()).toBe(31);
    expect(parseDeadlineDate("2026-11-30", now).getDate()).toBe(30);
    expect(parseDeadlineDate("May 1, 2027", now).getFullYear()).toBe(2027);
  });
});

describe("the headline award total counts open individual awards", () => {
  it("leaves out closed listings and program-wide totals", () => {
    const now = new Date(2026, 9, 21);
    const rows = [
      { amount: "$2,500", deadline: "2099-01-01" },
      { amount: "$5,000", deadline: "2020-01-01" },                 // closed
      { amount: "$1,000,000 in scholarships", deadline: "2099-01-01" }, // program total
      { amount: "$475,000+ awarded since 2014", deadline: "Varies" },  // program total
      { amount: "Up to $10,000", deadline: "Varies" },
    ];
    const s = computeCatalogStats(rows, now);
    expect(s.totalAwards).toBe(1492500);
    expect(s.openAwards).toBe(12500);
    expect(s.openWithAmount).toBe(2);
    expect(isProgramTotal("$150,000")).toBe(true);
    expect(isProgramTotal("$2,000 renewable")).toBe(false);
  });
});
