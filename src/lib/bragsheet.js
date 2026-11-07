// Sorts a brag sheet or résumé into the profile's fields, without a model call.
//
// A student uploaded a résumé and the profile stayed empty: the text was kept
// as one blob the letter prompt could read, but nothing reached Activities,
// Awards or Community Service, so matching and the "thin draft" warning never
// saw it. This splits the document into items (bullets, lines, sentences),
// routes each one by keywords, and lifts simple facts (school, city/state,
// GPA, test scores, graduation year) when the profile has none.
//
// Everything here is a SUGGESTION the student reviews before it is written to
// the profile; a keyword router gets some items wrong and the student can
// untick those. Nothing is written without a click.

const BULLET_RE = /[•▪●◦‣⁃■►·]|\s[-–—]\s|^\s*[-*•]\s+/gm;
const CONTACT_RE = /@|\(\d{3}\)|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b|linkedin|github\.com|https?:\/\//i;
const HEADER_RE = /^(education|experience|work experience|skills|relevant skills.*|awards?|honou?rs?( and awards)?|activities|extracurriculars?|leadership|summary|objective|references?|availability|certifications?|volunteer(ing)?|community service|projects?|interests|profile|technical(?: &| and)? research skills|communication(?: &| and)? leadership skills|teamwork(?: &| and)? professional skills)\s*:?$/i;

const AWARD_RE = /\b(award(?:s|ed)?|honou?r(?:s|ed)?\b|honor roll|dean'?s list|scholar(?:ship)?s? (?:recipient|winner|award)|national merit|ap scholar|valedictorian|salutatorian|commended|placed (?:first|second|third|1st|2nd|3rd)|(?:first|second|third|1st|2nd|3rd) place|winner|won\b|finalist|medal(?:ist)?|champion(?:ship)?s?|recogni[sz]ed|featured in|published|distinction|nominated|selected (?:as|for)|top \d+|all[- ]state|all[- ]county|all[- ]conference|mvp)\b/i;
const SERVICE_RE = /\b(volunteer\w*|community service|service hours|tutor\w*|mentor(?:ed|ing|s)?\b|food bank|food pantry|soup kitchen|shelter|nonprofit|non-profit|church|synagogue|mosque|temple|fundrais\w*|donat\w*|habitat for humanity|red cross|clean-?up|outreach|charity|charitable|hospital volunteer|peer tutor|nursing home|\d+\+?\s*(?:service )?hours)\b/i;
// Roles, clubs and sports are a sure sign of an activity; the verbs below
// (built, developed, researched) are only a hint, so work and skills outrank them.
const ACTIVITY_RE = /\b(captain|co-captain|president|vice president|treasurer|secretary|founder|co-founder|chair(?:person)?|editor|officer|leader(?:ship)?|led\b|club|team|varsity|junior varsity|jv\b|band|orchestra|choir|chorus|theat(?:er|re)|drama|debate|robotics|student government|student council|fbla|deca|hosa|nhs\b|national honor society|ffa\b|4-h|key club|yearbook|newspaper|athlet\w*|soccer|basketball|football|track|cross country|swim\w*|tennis|baseball|softball|lacrosse|wrestling|volleyball|hockey|golf|cheer\w*|dance|science olympiad|math olympiad|model un|mock trial|competition|olympiad|science fair)\b/i;
const PROJECT_RE = /\b(built|designed|developed|engineered|programmed|conducted|research(?:ed)?|presented|competed|performed|project)\b/i;
// Section headings that pdf.js leaves inline ("... Rochester, NY Availability
// Available for ..."): cut before them so they don't glue two items together.
const INLINE_HEADER_RE = /(?<![a-z,]\s)\b(?=(?:Availability|Education|Relevant Skills|Experiences? and Accomplishments|Technical & Research Skills|Communication & Leadership Skills|Teamwork & Professional Skills|Work Experience|Skills|Awards|Honors|Activities|Extracurricular Activities|Leadership|Summary|Objective|References|Certifications|Volunteer Experience|Community Service|Projects|Interests)\b\s+[A-Z])/;
const WORK_RE = /\b(lifeguard\w*|cashier|barista|server|hosting|host(?:ess)?\b|busser|bussing|intern(?:ship)?s?|employ\w*|part[- ]time|job\b|worked|work experience|shifts?|crew|babysit\w*|caregiver|caretaker|family business|restaurant|retail|camp counselor|referee|umpire|coach(?:ed|ing)?)\b/i;
const SKILL_RE = /\b(proficient|certified|certification|cpr|aed|first aid|fluent|bilingual|autocad|solidworks|python|javascript|java\b|c\+\+|excel|microsoft|adobe|photoshop|figma|3d (?:design|print\w*)|skills?)\b/i;

const US_STATES = new Set("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC PR".split(" "));
const CA_PROVINCES = new Set("AB BC MB NB NL NS NT NU ON PE QC SK YT".split(" "));

function clean(t) {
  return String(t || "").replace(/\s+/g, " ").replace(/^[\s:;,.\-–—]+|[\s:;,]+$/g, "").trim();
}

// Splits the document into candidate items. PDF text arrives as one long line
// with bullet glyphs; pasted text has newlines; a long unbroken run is split at
// sentence ends so a paragraph résumé still yields items.
export function splitItems(text) {
  const parts = String(text || "").split(/\n|(?:\.\s+)(?=[A-Z])/).flatMap((p) => p.split(BULLET_RE)).flatMap((p) => p.split(INLINE_HEADER_RE));
  const items = [];
  for (const raw of parts) {
    const t = clean(raw);
    if (t.length < 15 || t.length > 400) continue;
    if (CONTACT_RE.test(t)) continue;
    if (HEADER_RE.test(t)) continue;
    const words = t.split(" ");
    // A short run of capitalised words with no verb is a heading or a name line.
    if (words.length <= 5 && words.every((w) => /^[A-Z&(]/.test(w))) continue;
    if (!/[a-z]/.test(t)) continue;
    items.push(t);
  }
  return [...new Set(items)];
}

// One category per item; the first match in priority order wins.
export function classifyItem(item) {
  if (AWARD_RE.test(item)) return "awards";
  if (SERVICE_RE.test(item)) return "communityService";
  if (ACTIVITY_RE.test(item)) return "activities";
  if (WORK_RE.test(item) || SKILL_RE.test(item)) return "otherDetails";
  if (PROJECT_RE.test(item)) return "activities";
  return null;
}

export function extractFacts(text) {
  const t = String(text || "").replace(/\s+/g, " ");
  const out = {};
  const school = t.match(/\b([A-Z][A-Za-z.&'’-]*(?:\s+[A-Z][A-Za-z.&'’-]*){0,5}\s+(?:Senior High School|High School|Secondary School|Collegiate Institute|Academy|Preparatory School|Prep School|Charter School))\b/);
  if (school) out.school = school[1];
  for (const m of t.matchAll(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2}),\s*([A-Z]{2})\b(?![A-Za-z])/g)) {
    if (US_STATES.has(m[2]) || CA_PROVINCES.has(m[2])) { out.location = `${m[1]}, ${m[2]}`; break; }
  }
  const gpa = t.match(/\b(?:gpa|grade point average)\b[^0-9]{0,20}([0-4]\.\d{1,2})\b/i)
    || t.match(/\b([0-4]\.\d{1,2})\s*(?:\/|out of|on a)\s*4\.?0?\b/i)
    || t.match(/4\.0\s*scale\b[^0-9]{0,8}([0-4]\.\d{1,2})/i);
  if (gpa) out.gpa = gpa[1];
  const sat = t.match(/\bSAT\b[^0-9]{0,15}\b(1[0-6]\d{2}|[4-9]\d{2})\b/) || t.match(/\b(1[0-6]\d{2}|[4-9]\d{2})\s*(?:on the\s*)?SAT\b/);
  const act = t.match(/\bACT\b[^0-9]{0,15}\b([1-3]\d)\b/) || t.match(/\b([1-3]\d)\s*(?:on the\s*)?ACT\b/);
  if (sat || act) out.satact = [sat && `${sat[1]} SAT`, act && `${act[1]} ACT`].filter(Boolean).join(", ");
  // Only a year that sits next to "High School" is a high-school graduation
  // year; a résumé's "Expected graduation 2029" is usually college.
  const hs = t.search(/\bHigh School\b/i);
  if (hs >= 0) {
    // The year nearest "High School": the last one in the 80 characters before
    // it ("Diploma, June 2024: Rush Henrietta Senior High School"), else the
    // first one after.
    const before = t.slice(Math.max(0, hs - 80), hs).match(/\b20\d{2}\b/g);
    const after = t.slice(hs, hs + 90).match(/\b20\d{2}\b/);
    if (before) out.gradYear = before[before.length - 1];
    else if (after) out.gradYear = after[0];
  } else {
    const cls = t.match(/\bclass of (20\d{2})\b/i);
    if (cls) out.gradYear = cls[1];
  }
  const majorKey = t.match(/\b(?:intended major|major(?:ing)? in|plan(?:s|ning)? to (?:study|major in)|pursuing (?:a |an )?(?:degree|b\.?s\.?|b\.?a\.?) in|bachelor(?:'s|’s)? (?:of (?:science|arts) )?in|studying)\s*:?\s*/i);
  if (majorKey) {
    const major = t.slice(majorKey.index + majorKey[0].length).match(/^([A-Z][A-Za-z&\s]{2,40}?)(?=[.,;)]|$)/);
    if (major) out.intendedMajor = clean(major[1]);
  }
  return out;
}

const has = (v) => (Array.isArray(v) ? v.length > 0 : !!String(v ?? "").trim());
const alreadyIn = (fieldText, item) => {
  const f = String(fieldText || "").toLowerCase();
  const key = item.toLowerCase().slice(0, 60);
  return f.includes(key);
};

// What the brag sheet could add to this profile. Facts are offered only for
// empty fields; items already present (by their first 60 characters) are
// dropped. `unsorted` holds items no rule recognised.
export function suggestFromBragSheet(text, profile = {}, { gradYears = [], currentYear = new Date().getFullYear() } = {}) {
  const facts = extractFacts(text);
  const fields = {};
  for (const [k, v] of Object.entries(facts)) {
    if (has(profile[k])) continue;
    if (k === "gradYear") {
      const y = parseInt(v, 10);
      const mapped = y < currentYear ? "Already in college" : String(y);
      if (gradYears.length && !gradYears.includes(mapped)) continue;
      fields[k] = mapped;
    } else fields[k] = v;
  }
  const items = { activities: [], awards: [], communityService: [], otherDetails: [] };
  const unsorted = [];
  for (const item of splitItems(text)) {
    const cat = classifyItem(item);
    if (!cat) { if (!alreadyIn(profile.otherDetails, item)) unsorted.push(item); continue; }
    if (alreadyIn(profile[cat], item)) continue;
    items[cat].push(item);
  }
  const count = Object.keys(fields).length + Object.values(items).reduce((n, a) => n + a.length, 0);
  return { fields, items, unsorted, count };
}

// Writes the ticked suggestions into a copy of the profile. Facts fill empty
// fields; items are appended one per line.
export function applySuggestions(profile, { fields = {}, items = {} }) {
  const next = { ...profile };
  for (const [k, v] of Object.entries(fields)) if (!has(next[k]) && v) next[k] = v;
  for (const [k, list] of Object.entries(items)) {
    const fresh = (list || []).filter((it) => it && !alreadyIn(next[k], it));
    if (!fresh.length) continue;
    const cur = String(next[k] || "").trim();
    next[k] = (cur ? cur + "\n" : "") + fresh.join("\n");
  }
  return next;
}

export const SUGGESTION_LABELS = {
  fields: { school: "High school", location: "Where you live", gpa: "GPA", satact: "SAT / ACT", gradYear: "Graduation year", intendedMajor: "Intended major" },
  items: { activities: "Activities and leadership", awards: "Awards and honors", communityService: "Community service", otherDetails: "Other details (work, skills, certifications)" },
};
