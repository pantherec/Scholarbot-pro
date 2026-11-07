import { describe, it, expect } from "vitest";
import { splitItems, classifyItem, extractFacts, suggestFromBragSheet, applySuggestions } from "../bragsheet.js";

// The résumé that stayed out of the profile on 2026-11-07, as pdf.js hands it
// over: one line, private-use bullet glyphs, contact details up top.
const ALEXIA = "Alexia Savage (585)353-6945 alexiasavage@cmail.carleton.ca LinkedIn Education Carleton University Aerospace Engineering Stream D Co-Op Student  Second Year Standing, 8.80 CGPA, On 4.0 Scale: 3.29(B)  Expected Graduation, May 2029 Advanced Regents Diploma, June 2024: Rush Henrietta Senior High School, Rochester, NY Availability Available for 4 months beginning May 2026 Relevant Skills Experiences and Accomplishments Technical & Research Skills  Conducted materials research on Solid Oxide Fuel Cells under RIT supervision, researched oxide combinations for improved efficiency; project placed first at regional and international science competitions.  Designed an Electrolysis System to extract hydrogen from ocean sources, recognized by the RIT Genuis Olympiad International Science Fair.  Built a Self-Sufficient Fire Detection System using Raspberry Pi, sensors, and solar power. Further developed 3D design abilities and individual project development; featured in Rochester Engineer Magazine.  Proficient in AutoCAD, data analysis, presentation formatting and Microsoft Excel from research applications. Communication & Leadership Skills  Tutor students in mathematics, strengthening instructional and interpersonal communication skills.  Presented scientific research to regional and international audiences, aiding in public speaking proficiency  Served as Treasurer and Secretary in Student Government, overseeing budget records and event coordination; developed large scale planning and task management skills.  Collaborated in team-based research projects under faculty mentorship. Teamwork & Professional Skills  Developed strong situational awareness, attentiveness and crisis response while Lifeguarding, certified in CPR/AED, First Aid, and Emergency Oxygen.  Supported a fast-paced restaurant through Hosting and Bussing, further improving multitasking and customer service skills.";

describe("brag sheet sorting (profile stayed empty after upload)", () => {
  it("splits pdf.js output on bullet glyphs and drops contact and heading lines", () => {
    const items = splitItems(ALEXIA);
    expect(items.some((i) => i.includes("353-6945"))).toBe(false);
    expect(items.some((i) => /^Technical & Research Skills$/.test(i))).toBe(false);
    expect(items.some((i) => i.startsWith("Served as Treasurer and Secretary"))).toBe(true);
    expect(items.some((i) => i.startsWith("Built a Self-Sufficient Fire Detection System"))).toBe(true);
  });
  it("routes items by what they say", () => {
    expect(classifyItem("Served as Treasurer and Secretary in Student Government, overseeing budget records")).toBe("activities");
    expect(classifyItem("Tutor students in mathematics, strengthening instructional skills")).toBe("communityService");
    expect(classifyItem("project placed first at regional and international science competitions")).toBe("awards");
    expect(classifyItem("Supported a fast-paced restaurant through Hosting and Bussing")).toBe("otherDetails");
    expect(classifyItem("Available for 4 months beginning May 2026")).toBe(null);
  });
  it("lifts the high school, city/state, GPA on a 4.0 scale and the HS graduation year", () => {
    const f = extractFacts(ALEXIA);
    expect(f.school).toBe("Rush Henrietta Senior High School");
    expect(f.location).toBe("Rochester, NY");
    expect(f.gpa).toBe("3.29");
    expect(f.gradYear).toBe("2024");
  });
  it("reads SAT/ACT in either order and a stated major", () => {
    const f = extractFacts("Scored 1350 on the SAT and ACT: 30. Majoring in Nursing. Lives in Fremont, CA.");
    expect(f.satact).toBe("1350 SAT, 30 ACT");
    expect(f.intendedMajor).toBe("Nursing");
    expect(f.location).toBe("Fremont, CA");
  });
  it("offers facts only for empty fields and maps a past year to 'Already in college'", () => {
    const sug = suggestFromBragSheet(ALEXIA, { school: "Already set", gradYear: "" }, { gradYears: ["2026", "2027", "Already in college"], currentYear: 2026 });
    expect(sug.fields.school).toBeUndefined();
    expect(sug.fields.gradYear).toBe("Already in college");
    expect(sug.items.activities.length).toBeGreaterThan(0);
    expect(sug.items.awards.some((i) => i.includes("placed first"))).toBe(true);
    expect(sug.items.communityService.some((i) => i.startsWith("Tutor students"))).toBe(true);
    expect(sug.items.otherDetails.some((i) => i.includes("Lifeguarding"))).toBe(true);
    expect(sug.count).toBeGreaterThan(5);
  });
  it("appends ticked items without duplicating what is already there", () => {
    const base = { activities: "Debate Team Captain" };
    const next = applySuggestions(base, { fields: { gpa: "3.8" }, items: { activities: ["Debate Team Captain", "Robotics Club"] } });
    expect(next.gpa).toBe("3.8");
    expect(next.activities).toBe("Debate Team Captain\nRobotics Club");
    expect(applySuggestions(next, { items: { activities: ["Robotics Club"] } }).activities).toBe(next.activities);
  });
});
