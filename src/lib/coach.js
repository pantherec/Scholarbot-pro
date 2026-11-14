// Score coach: what the catalog and published sources can truthfully tell a
// student. Two rules hold for everything here:
//   1. A number is counted from the live catalog at the moment it is shown.
//   2. A piece of general advice names the source it came from.
// Nothing here predicts a win. See the Terms, "No guarantee of results".
import { parseGpaRequirement } from "./matching.js";
import { daysUntil } from "./deadline.js";

export const COACH_DISCLAIMER =
  "These are estimates from the scholarship listings in our catalog and from the sources named on each card. They are not predictions or advice, and a fit score is not a chance of winning.";

export const GPA_RUNGS = [2.5, 2.75, 3.0, 3.25, 3.5, 3.75];

// How many open listings state a GPA minimum, and how many of those a student
// meets at each rung.
export function gpaLadder(scholarships, now = new Date()) {
  const mins = [];
  for (const s of scholarships || []) {
    const d = daysUntil(s.deadline, now);
    if (d !== null && d < 0) continue; // closed this cycle
    const req = parseGpaRequirement(`${s.name || ""} ${s.criteria || ""}`.toLowerCase());
    if (req && req >= 1.5 && req <= 4.0) mins.push(req);
  }
  return {
    withMinimum: mins.length,
    rungs: GPA_RUNGS.map((gpa) => ({ gpa, open: mins.filter((m) => m <= gpa).length })),
    openAt: (gpa) => mins.filter((m) => m <= gpa).length,
  };
}

// The sentence under the ladder for this student's GPA.
export function ladderSummary(ladder, gpaText) {
  const gpa = parseFloat(gpaText);
  if (!Number.isFinite(gpa)) return { now: null, next: null };
  const now = ladder.openAt(gpa);
  const nextRung = GPA_RUNGS.find((r) => r > gpa && ladder.openAt(r) > now);
  return { gpa, now, next: nextRung ? { gpa: nextRung, more: ladder.openAt(nextRung) - now } : null };
}

// Which grade a student is in, from the graduation year in their profile.
// The school year turns over in August. Returns 9-12, "college", or null.
export function gradeFromGradYear(gradYear, now = new Date()) {
  if (/college/i.test(String(gradYear || ""))) return "college";
  const y = parseInt(gradYear, 10);
  if (!Number.isFinite(y)) return null;
  const seniorClass = now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear();
  const grade = 12 - (y - seniorClass);
  if (grade > 12) return "college";
  return grade >= 9 ? grade : grade >= 6 ? 9 : null; // middle schoolers get the grade 9 list
}

// Sourced guidance. Each card says where it comes from; `grades` is who sees it.
// Every source here was opened and read on 2026-11-14 (docs/research/). Do not
// add a card without a source that was read, and never cite an aggregator.
const FSA = "U.S. Department of Education, Federal Student Aid";
export const GUIDANCE = [
  { id: "g9-list", grades: [9], title: "Start a running list",
    body: "Keep one list of your awards, honors, paid and volunteer work, and activities, and add to it as you go. The federal checklist says quality counts, not quantity.",
    source: `${FSA}, 9th grade checklist`, url: "https://studentaid.gov/resources/prepare-for-college/checklists/9th-grade" },
  { id: "g10-aid", grades: [10], title: "Learn how aid works, and take a practice PSAT",
    body: "Learn the difference between grants, loans, work-study and scholarships, meet your counselor, and take a practice PSAT/NMSQT.",
    source: `${FSA}, 10th grade checklist`, url: "https://studentaid.gov/resources/prepare-for-college/checklists/10th-grade" },
  { id: "g11-psat", grades: [10, 11], title: "The PSAT/NMSQT in 11th grade is the National Merit entry",
    body: "National Merit is entered by taking the PSAT/NMSQT in 11th grade. The PSAT 10 and PSAT 8/9 do not count.",
    source: "National Merit Scholarship Corporation, entry requirements", url: "https://www.nationalmerit.org/s/1758/interior.aspx?sid=1758&gid=2&pgid=1876" },
  { id: "g11-search", grades: [11], title: "Start applying the summer before senior year",
    body: "Some scholarship deadlines fall as early as the summer between 11th and 12th grade, so search and apply then. If you missed it, the guidance says to keep going anyway.",
    source: `${FSA}, 11th grade checklist`, url: "https://studentaid.gov/resources/prepare-for-college/checklists/11th-grade" },
  { id: "g12-grades", grades: [12], title: "Keep your grades up through spring",
    body: "File the FAFSA by your schools' earliest deadline and finish your applications. The federal checklist warns that second-semester grades can affect scholarship eligibility.",
    source: `${FSA}, 12th grade checklist`, url: "https://studentaid.gov/resources/prepare-for-college/checklists/12th-grade" },
  { id: "letters-early", grades: [11, 12], title: "Ask for transcripts and letters early",
    body: "Ask counselors and teachers well before a deadline to send transcripts and recommendation letters. One major provider says incomplete applications are not considered.",
    source: `${FSA}, 12th grade checklist; UNCF scholarship guidance`, url: "https://studentaid.gov/resources/prepare-for-college/checklists/12th-grade" },
  { id: "depth", grades: [9, 10, 11, 12], title: "Stay with a few activities and grow in them",
    body: "One national program's judges look for positions of increasing responsibility over four years, and are told to weigh community service on quality over quantity.",
    source: "Elks National Foundation, Most Valuable Student scoring rubric (2023)", url: "https://www.elks.org/scholars/scholarships/mvs.cfm" },
  { id: "work-counts", grades: [9, 10, 11, 12], title: "A job or family duties count",
    body: "The same rubric counts caring for siblings or working on a family farm or in a family business as employment, paid or not. The Common App's activities guide also asks about family responsibilities and jobs.",
    source: "Elks National Foundation rubric (2023); Common App activities guide (2025)", url: "https://www.elks.org/scholars/scholarships/mvs.cfm" },
  { id: "gpa-floor", grades: [9, 10, 11, 12], title: "A 3.0 is a common floor",
    body: "Coca-Cola Scholars and the Hispanic Scholarship Fund both set a 3.0 minimum for high school applicants. Other programs set theirs higher or lower, so check each one.",
    source: "Coca-Cola Scholars Foundation and Hispanic Scholarship Fund application pages (2026-27)", url: "https://www.coca-colascholarsfoundation.org/apply/" },
  { id: "no-fee", grades: [9, 10, 11, 12, "college"], title: "Never pay to apply",
    body: "The Federal Trade Commission says never to pay to apply for a scholarship, and that no legitimate company can guarantee you one.",
    source: "Federal Trade Commission, How to Avoid Scholarship and Financial Aid Scams", url: "https://consumer.ftc.gov/articles/how-avoid-scholarship-and-financial-aid-scams" },
  { id: "displacement", grades: [11, 12, "college"], title: "Tell your college about every award",
    body: "An outside scholarship can lower the aid a college offers, because total aid cannot exceed the cost of attendance. Report each award and ask whether grants or loans are reduced first.",
    source: "College Board BigFuture; Federal Student Aid", url: "https://bigfuture.collegeboard.org/pay-for-college/grants-and-scholarships/how-outside-scholarships-affect-your-financial-aid-package" },
];

export function guidanceFor(grade) {
  const g = grade === null || grade === undefined ? 12 : grade;
  return GUIDANCE.filter((c) => c.grades.includes(g));
}

export function gradeLabel(grade) {
  if (grade === "college") return "college students";
  if (!grade) return "your year";
  return `grade ${grade}`;
}
