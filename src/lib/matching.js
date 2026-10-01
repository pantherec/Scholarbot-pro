// Scholarship matching: an ELIGIBILITY pass first (never recommend something the
// student can't apply for), then scoring on specific, explainable signals.
// Heritage is matched on whole words: "Caucasian" contains the letters "asian",
// which once ranked minority-only awards first for white students.
import { daysUntil } from "./deadline.js";

const US_STATES = {
  AL:"alabama",AK:"alaska",AZ:"arizona",AR:"arkansas",CA:"california",CO:"colorado",CT:"connecticut",
  DE:"delaware",DC:"district of columbia",FL:"florida",GA:"georgia",HI:"hawaii",ID:"idaho",IL:"illinois",
  IN:"indiana",IA:"iowa",KS:"kansas",KY:"kentucky",LA:"louisiana",ME:"maine",MD:"maryland",MA:"massachusetts",
  MI:"michigan",MN:"minnesota",MS:"mississippi",MO:"missouri",MT:"montana",NE:"nebraska",NV:"nevada",
  NH:"new hampshire",NJ:"new jersey",NM:"new mexico",NY:"new york",NC:"north carolina",ND:"north dakota",
  OH:"ohio",OK:"oklahoma",OR:"oregon",PA:"pennsylvania",RI:"rhode island",SC:"south carolina",SD:"south dakota",
  TN:"tennessee",TX:"texas",UT:"utah",VT:"vermont",VA:"virginia",WA:"washington",WV:"west virginia",
  WI:"wisconsin",WY:"wyoming",PR:"puerto rico",
};

// Student's state from "City, ST" or "City, State Name". Null when unknown.
export function stateFromLocation(location) {
  if (!location) return null;
  const loc = String(location).toLowerCase();
  const code = loc.match(/,\s*([a-z]{2})\b/);
  if (code && US_STATES[code[1].toUpperCase()]) return code[1].toUpperCase();
  for (const [abbr, name] of Object.entries(US_STATES)) {
    if (new RegExp(`\\b${name}\\b`).test(loc)) return abbr;
  }
  return null;
}

const HERITAGE_PATTERNS = {
  black: /\b(african[- ]american|black)\b/,
  hispanic: /\b(hispanic|latin[oax]|latine|chican[oa]|mexican[- ]american)\b/,
  asian: /\b(asian|pacific islander|aapi|apia)\b/,
  native: /\b(native american|american indian|alaska native|indigenous|tribal|tribe|first nations|native hawaiian)\b/,
};
const MINORITY = /\b(minority|minorities|underrepresented|students of color)\b/;

export function studentHeritage(profile) {
  const raw = Array.isArray(profile.ethnicity) ? profile.ethnicity : (profile.ethnicity ? [profile.ethnicity] : []);
  const text = raw.join(" | ").toLowerCase();
  const groups = new Set();
  if (/african american|black/.test(text)) groups.add("black");
  if (/hispanic|latino/.test(text)) groups.add("hispanic");
  if (/\basian\b|pacific islander/.test(text)) groups.add("asian");
  if (/native american|indigenous/.test(text)) groups.add("native");
  if (/\bwhite\b/.test(text)) groups.add("white");
  if (/multiracial/.test(text)) groups.add("multiracial");
  return groups;
}

// Which heritage groups a scholarship is restricted to, if any.
export function scholarshipHeritage(s) {
  const text = `${s.name || ""} ${s.criteria || ""}`.toLowerCase();
  const groups = new Set();
  for (const [g, re] of Object.entries(HERITAGE_PATTERNS)) if (re.test(text)) groups.add(g);
  const minority = MINORITY.test(text);
  return { groups, minority, restricted: groups.size > 0 || minority };
}

const MAJOR_FIELDS = [
  ["engineering", /\bengineer/], ["agriculture", /\b(agricultur|agronom|farm|ffa|animal science)/],
  ["computer science", /\b(computer|computing|software|coding|cyber|information technology)/],
  ["nursing", /\bnurs/], ["health", /\b(pre-?med|medicine|medical|health|biolog|pharm|dental)/],
  ["education", /\b(teach|education)/], ["business", /\b(business|accounting|finance|marketing|entrepreneur)/],
  ["journalism", /\b(journalism|media|communications|broadcast)/], ["law", /\b(pre-?law|law|legal|justice)/],
  ["social work", /\b(social work|public policy|public service|political science)/],
  ["arts", /\b(art|music|theater|theatre|film|design|creative writing|poetry)/],
  ["humanities", /\b(classics|philosophy|history|english|literature|humanities)/],
  ["construction", /\b(construction|trades|welding|electrician|plumb|hvac)/],
  ["science", /\b(science|chemistry|physics|math|stem)/],
];

const ACTIVITY_KEYWORDS = [
  ["FFA", /\bffa\b/], ["4-H", /\b4-?h\b/], ["robotics", /\brobotics?\b/], ["Eagle Scout", /\beagle scout\b/],
  ["Girl Scouts", /\bgirl scout/], ["debate", /\bdebate\b/], ["mock trial", /\bmock trial\b/],
  ["journalism", /\b(journalism|newspaper|yearbook)\b/], ["music", /\b(band|orchestra|choir|music)\b/],
  ["theater", /\b(theater|theatre|drama)\b/], ["athletics", /\b(athlete|varsity|sports?)\b/],
  ["JROTC", /\bjrotc\b/], ["NHS", /\b(national honor society|nhs)\b/], ["church", /\b(church|faith|ministry)\b/],
];

function parseGpaRequirement(text) {
  const m = text.match(/(\d\.\d{1,2})\s*\+?\s*(?:or (?:higher|above)\s*)?(?:minimum\s*)?(?:unweighted\s*|cumulative\s*)?gpa/)
    || text.match(/gpa\s*(?:of\s*|minimum\s*|min\.?\s*)?(?:at least\s*)?(\d\.\d{1,2})/)
    || text.match(/minimum (?:gpa )?(?:of )?(\d\.\d{1,2})/);
  if (!m) return null;
  const v = parseFloat(m[1]);
  return v > 0 && v <= 5 ? v : null;
}

// Returns { eligible, why } — `why` explains an exclusion (shown nowhere today,
// kept for tests and future "why not?" UI).
export function checkEligibility(profile, s) {
  const text = `${s.name || ""} ${s.criteria || ""}`.toLowerCase();
  const cit = (profile.citizenship || "").toLowerCase();

  // Heritage-restricted awards.
  const heritage = scholarshipHeritage(s);
  if (heritage.restricted) {
    const mine = studentHeritage(profile);
    const declined = mine.size === 0;
    if (!declined && !mine.has("multiracial")) {
      const overlap = [...heritage.groups].some((g) => mine.has(g));
      const minorityOk = heritage.minority && [...mine].some((g) => g !== "white");
      if (!overlap && !minorityOk) return { eligible: false, why: "heritage" };
    }
  }

  // Citizenship and residency.
  const citizenOnly = /\bu\.?\s?s\.? citizens?\b/.test(text) &&
    !/(permanent resident|eligible non-?citizen|green card|resident alien|legal resident|daca|dreamer|undocumented)/.test(text);
  if (cit.startsWith("international")) {
    if (/\bu\.?\s?s\.? citizen|permanent resident|federal (financial )?aid|fafsa|pell/.test(text)) return { eligible: false, why: "citizenship" };
    if ((s.country || "US") === "CA" && /canadian citizen|permanent resident/.test(text)) return { eligible: false, why: "citizenship" };
  }
  if (cit.startsWith("permanent resident") && citizenOnly) return { eligible: false, why: "citizenship" };
  if (cit.startsWith("daca") && /\bu\.?\s?s\.? citizen|permanent resident/.test(text) && !/(daca|dreamer|undocumented)/.test(text)) {
    return { eligible: false, why: "citizenship" };
  }
  // Awards only for DACA/undocumented or international students (TheDream.US,
  // Golden Door, CA Dream Act) are not for citizens or permanent residents.
  const nonCitizenOnly = /(daca|undocumented|dreamer|ab ?540|\binternational\b)/.test(text) &&
    !/(\bcitizens?\b|permanent resident|\blpr\b|incl\.? undocumented|including daca|any (high school )?senior|all students)/.test(text);
  if (nonCitizenOnly && (cit.startsWith("u.s.") || cit.startsWith("dual") || cit.startsWith("permanent"))) {
    return { eligible: false, why: "citizenship" };
  }
  if ((cit.startsWith("u.s.") || cit.startsWith("permanent") || cit.startsWith("daca")) &&
      (s.country || "US") === "CA" && /canadian citizen|permanent resident of canada|canadian permanent/.test(text)) {
    return { eligible: false, why: "citizenship" };
  }

  // State-specific awards (the catalog tags these with a state code).
  const myState = stateFromLocation(profile.location);
  if (s.state && myState && s.state !== myState) return { eligible: false, why: "state" };
  // A student outside the US can't hold a US state residency award.
  if (s.state && !myState && cit.startsWith("international")) return { eligible: false, why: "state" };

  // GPA floor.
  const req = parseGpaRequirement(text);
  const gpa = parseFloat(profile.gpa);
  if (req && Number.isFinite(gpa) && gpa < req - 0.001) return { eligible: false, why: "gpa" };

  // Graduate-only awards.
  if (/\b(doctoral|ph\.?\s?d|graduate students?|master'?s (degree )?students?|postdoc)/.test(text) &&
      !/(high school|senior|undergraduate|incoming|freshm|first-year)/.test(text)) {
    return { eligible: false, why: "level" };
  }

  return { eligible: true, why: null };
}

export function scoreMatch(profile, s) {
  const text = `${s.name || ""} ${s.criteria || ""}`.toLowerCase();
  let score = 0;
  const reasons = [];
  const add = (pts, why) => { score += pts; reasons.push(why); };

  const heritage = scholarshipHeritage(s);
  if (heritage.restricted) {
    const mine = studentHeritage(profile);
    if ([...heritage.groups].some((g) => mine.has(g)) || (heritage.minority && [...mine].some((g) => g !== "white"))) {
      add(30, "Heritage-specific award you qualify for");
    }
  }

  const cit = (profile.citizenship || "").toLowerCase();
  if (cit.startsWith("daca") && /(daca|dreamer|undocumented)/.test(text)) add(30, "Open to DACA/TPS students");

  const myState = stateFromLocation(profile.location);
  if (s.state && myState && s.state === myState) add(25, `For ${myState} students`);

  const need = (profile.financialNeed || "").toLowerCase();
  if (s.needBased === "Y" && need.startsWith("yes")) add(15, "Need-based, and you have need");

  const major = (profile.intendedMajor || "").toLowerCase();
  if (major) {
    for (const [field, re] of MAJOR_FIELDS) {
      if (re.test(major) && re.test(text)) { add(20, `Fits your major (${field})`); break; }
    }
  }

  const acts = `${profile.activities || ""} ${profile.awards || ""}`.toLowerCase();
  if (acts) {
    for (const [label, re] of ACTIVITY_KEYWORDS) {
      if (re.test(acts) && re.test(text)) { add(15, `Rewards ${label}`); break; }
    }
    if (/\bleadership\b/.test(text) && acts.length > 30) add(5, "Values leadership");
    if (/\b(community service|volunteer)/.test(text) && (profile.communityService || "").length > 20) add(5, "Values service");
  }

  const req = parseGpaRequirement(text);
  const gpa = parseFloat(profile.gpa);
  if (req && Number.isFinite(gpa) && gpa >= req) add(10, `Your ${gpa} GPA meets the ${req} minimum`);

  if (/(high school senior|graduating senior|graduating high school)/.test(text)) add(5, "For graduating seniors");

  return { score: Math.min(score, 100), reasons };
}

// The match list: eligible, at least one specific signal, then ordered with live
// deadlines ahead of closed ones (closed listings are kept — most come back
// next cycle — but never shown first).
export function rankMatches(profile, scholarships, now = new Date()) {
  const out = [];
  for (const s of scholarships) {
    if (!checkEligibility(profile, s).eligible) continue;
    const { score, reasons } = scoreMatch(profile, s);
    if (score < 10) continue;
    out.push({ ...s, matchScore: score, matchReasons: reasons });
  }
  const closed = (s) => { const d = daysUntil(s.deadline, now); return d !== null && d < 0; };
  return out.sort((a, b) => (closed(a) - closed(b)) || (b.matchScore - a.matchScore));
}
