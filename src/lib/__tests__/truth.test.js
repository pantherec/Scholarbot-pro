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

// ---- Critic 10-30 lane B ----
const SEED = JSON.parse(readFileSync(new URL("../../../test-profiles/test_profiles_seed.json", import.meta.url), "utf8"));
const seedProfile = (id) => SEED.profiles.find((p) => p.id === id).profile;
const JENNA_AWARD = { name: "Heartland Rural Futures Scholarship", criteria: "Rural high school seniors planning to study engineering or agriculture." };

describe("fact check: an honest letter raises no chips", () => {
  it("a letter written strictly from Jenna's seed profile, to a named award, has 0 flags", () => {
    const flags = findUnsupportedDetails(fixture("honest_jenna_draft.txt"), { profile: seedProfile("test-jenna-firstgen-rural-stem"), scholarship: JENNA_AWARD });
    expect(flags.map((f) => f.text)).toEqual([]);
  });
  it("salutation and organisation words alone are never flagged, but numbers and weekdays still are", () => {
    const letter = "I wrote this.\nDear Scholarship Selection Committee,\nI thank the Foundation Board and Fund members. Respectfully, Regards.\nI met four people on Thursday.";
    const texts = findUnsupportedDetails(letter, { profile: {} }).map((f) => f.text.toLowerCase());
    expect(texts).toEqual(["four", "thursday"]);
  });
  it("the award's own name and provider count as sources", () => {
    const letter = "I am grateful for the support of the Kowalczyk Family Trust and the Ostrander Fellowship.";
    const flagged = (sch) => findUnsupportedDetails(letter, { profile: {}, scholarship: sch }).map((f) => f.text);
    expect(flagged({})).toEqual(expect.arrayContaining(["Kowalczyk", "Ostrander"]));
    expect(flagged({ name: "Ostrander Fellowship", provider: "Kowalczyk Family Trust" })).toEqual([]);
  });
});

describe("prompt privacy and sensitivity (10-30)", () => {
  const CIT = (criteria) => buildLetterRequest({ profile: AMARA, scholarship: { source: "database", name: "X Award", criteria } }).system;
  it("'US Legal Resident' or 'resident of Ohio' does not trigger the citizenship field", () => {
    expect(CIT("Open to any US Legal Resident attending high school")).not.toMatch(/CITIZENSHIP|DACA/);
    expect(CIT("Must be a resident of Ohio with a 3.0 GPA, residency verified")).not.toMatch(/CITIZENSHIP|DACA/);
  });
  it("immigration terms do trigger it", () => {
    expect(CIT("DACA recipients welcome")).toMatch(/CITIZENSHIP: DACA\/TPS/);
    expect(CIT("Open to U.S. citizens only")).toMatch(/CITIZENSHIP/);
    expect(CIT("Permanent resident status required")).toMatch(/CITIZENSHIP/);
    expect(CIT("International students may apply")).toMatch(/CITIZENSHIP/);
  });
  it("scrubs emails, phones and street addresses from the brag sheet and essay boxes", () => {
    const brag = "Contact: maria.g@example.com\n(555) 010-0100 or 555-0100 or +1 555 010 0100\n123 Maple Street, Apt 4, Rochester, NY 14620\n- 4 years at Lincoln Street Elementary\n200 hours volunteering, 3.9 GPA";
    const req = buildLetterRequest({ profile: { ...MARIA, personalStory: "Call me at 555.010.0199." }, scholarship: { source: "custom", ...AWARD }, bragSheet: brag, appAnswers: { why: "Write maria.g@example.com" }, essayPrompt: "Mail to 55 Oak Ave" });
    const all = req.system + JSON.stringify(req.messages);
    expect(all).not.toMatch(/maria\.g@example|010-0100|555-0100|555 010 0100|Maple|14620|010\.0199|Oak Ave/);
    expect(all).toContain("[removed]");
    expect(all).toContain("4 years at Lincoln Street Elementary");
    expect(all).toContain("200 hours volunteering, 3.9 GPA");
    expect(JSON.stringify(buildProfileRequest({ profile: MARIA, bragSheet: brag }))).not.toMatch(/maria\.g@example|Maple/);
  });
});

describe("open-awards total: individual, open, undergraduate-bound (10-30)", () => {
  const now = new Date(2026, 9, 30);
  const rows = [
    { name: "Real Award", amount: "$2,500", deadline: "2099-03-01", criteria: "High school seniors." },
    { name: "Rolling Award", amount: "$1,000", deadline: "Rolling", criteria: "Any student." },
    { name: "Vanier Canada Graduate Scholarships", amount: "$50,000", deadline: "2099-11-01", criteria: "Doctoral students at Canadian universities." },
    { name: "Trudeau Foundation Scholarship", amount: "$50,000", deadline: "2099-12-01", criteria: "PhD candidates in the humanities." },
    { name: "Research Fellowship", amount: "$30,000", deadline: "2099-12-01", criteria: "Open to all." },
    { name: "Community Pool", amount: "$77,000 pooled", deadline: "2099-12-01", criteria: "Seniors." },
    { name: "Program Total", amount: "$9,000", deadline: "2099-12-01", criteria: "Up to 12 awards totaling $9,000 each cycle." },
    { name: "Old Cycle", amount: "$4,000", deadline: "Spring 2026", criteria: "Seniors." },
    { name: "Old Year", amount: "$4,000", deadline: "2025 cycle", criteria: "Seniors." },
    { name: "Fall Cycle", amount: "$500", deadline: "Fall 2026", criteria: "Seniors." },
    { name: "Past Date", amount: "$6,000", deadline: "2026-03-01", criteria: "Seniors." },
    { name: "Graduating", amount: "$700", deadline: "2099-01-01", criteria: "Students who graduate from high school with a 3.0 and total household income under $90,000." },
  ];
  it("counts only open, individual, non-graduate awards", () => {
    const s = computeCatalogStats(rows, now);
    expect(s.openAwards).toBe(2500 + 1000 + 500 + 700);
    expect(s.openWithAmount).toBe(4);
    expect(s.withAmount).toBe(12);
  });
});

describe("matching: Dream Act awards and the optional gender rule (10-30)", () => {
  const DASIG = { id: "d1", name: "Dream Act Service Incentive Grant", criteria: "CA Cal Grant B recipients who filed CADAA + community service", state: "CA", deadline: "2099-03-02" };
  const CADAA = { id: "d2", name: "State Aid", criteria: "Complete the CADAA application.", deadline: "2099-03-02" };
  const MN_GRANT = { id: "d3", name: "Minnesota State Grant", criteria: "MN resident undergrads enrolled 3+ credits; FAFSA/Dream Act need", state: "MN", deadline: "2099-03-02" };
  const CAL = { ...MARIA, location: "Fresno, CA" };
  it("keeps Dream Act awards away from citizens, and still offers them to DACA students", () => {
    expect(checkEligibility(CAL, DASIG)).toEqual({ eligible: false, why: "citizenship" });
    expect(checkEligibility(CAL, CADAA).eligible).toBe(false);
    expect(checkEligibility({ ...CAL, citizenship: "DACA/TPS" }, DASIG).eligible).toBe(true);
    expect(checkEligibility({ ...MARIA, location: "Duluth, MN" }, MN_GRANT).eligible).toBe(true); // "FAFSA/Dream Act" is not undocumented-only
  });

  const WOMEN = [
    { id: "w1", name: "Women in STEM Award", criteria: "Open to female high school seniors." },
    { id: "w2", name: "Soroptimist Live Your Dream", criteria: "Awards for those who provide primary support." },
    { id: "w3", name: "P.E.O. STAR Scholarship", criteria: "Senior girls with leadership." },
    { id: "w4", name: "Hartley Fund", criteria: "Scholarship for her education: young women entering nursing." },
  ];
  const MEN = [
    { id: "m1", name: "Brotherhood Award", criteria: "Male students only, graduating seniors." },
    { id: "m2", name: "Young Men's Fund", criteria: "Open to young men in the trades." },
  ];
  const OPEN_TO_ALL = [
    { id: "o1", name: "STEM Award", criteria: "Open to men and women. Women are encouraged to apply." },
    { id: "o2", name: "Plain Award", criteria: "High school seniors with a 3.0 GPA." },
    { id: "o4", name: "Girls & Boys State Opens", criteria: "Check websites for details" },
    { id: "o3", name: "Mentor Fund", criteria: "Seniors, regardless of gender, with a mentor." },
  ];
  it("a male student skips women-only awards; a female student skips men-only awards", () => {
    const boy = { ...MARIA, gender: "male" }, girl = { ...MARIA, gender: "female" };
    for (const s of WOMEN) { expect(checkEligibility(boy, s)).toEqual({ eligible: false, why: "gender" }); expect(checkEligibility(girl, s).eligible).toBe(true); }
    for (const s of MEN) { expect(checkEligibility(girl, s)).toEqual({ eligible: false, why: "gender" }); expect(checkEligibility(boy, s).eligible).toBe(true); }
    for (const s of OPEN_TO_ALL) { expect(checkEligibility(boy, s).eligible).toBe(true); expect(checkEligibility(girl, s).eligible).toBe(true); }
  });
  it("unanswered, prefer_not and nonbinary exclude nothing", () => {
    for (const gender of [undefined, "", "prefer_not", "nonbinary"]) {
      for (const s of [...WOMEN, ...MEN]) expect(checkEligibility({ ...MARIA, gender }, s).eligible).toBe(true);
    }
  });
  it("gender never reaches the model", () => {
    const req = buildLetterRequest({ profile: { ...MARIA, gender: "female" }, scholarship: { source: "custom", ...AWARD } });
    expect(JSON.stringify(req)).not.toMatch(/gender|female/i);
  });
});
