// Flags details in a draft that the student never gave us. Four reviews in a
// row found drafts with an age ("I was eleven"), a count ("only four middle
// schoolers"), a weekday ("Thursday afternoons") or a season ("last spring")
// that appears nowhere in the profile. The prompt forbids inventing them and
// the model still does, so the letter page lists each one and the student
// decides: it's true, or they rewrite it. Nothing is removed automatically.
//
// The check is deliberately narrow (numbers, ages, weekdays, time phrases and
// proper nouns). It can't judge "blood pressure medication"; it can make sure
// no number, name or date reaches a committee unreviewed.

const NUMBER_WORDS = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000,
  second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  dozen: 12, dozens: 12,
};
// "one" and "first" are everywhere ("one day", "the first time") and almost
// never a fact a committee would check.
const NUMBER_WORD_RE = new RegExp(`\\b(${Object.keys(NUMBER_WORDS).join("|")})\\b`, "gi");
const DIGITS_RE = /\$?\b\d[\d,]*(?:\.\d+)?\b\+?%?/g;
const AGE_RE = /\b(?:i was|when i was|at age|at the age of|i turned|turned|turning|since i was)\s+(\d{1,2}|[a-z]+)\b/gi;
const WEEKDAY_RE = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b/gi;
const TIME_RE = /\b(?:last|this|next|every|each)\s+(?:spring|summer|fall|autumn|winter|semester|year|month|week|weekend|morning|afternoon|evening)\b/gi;
const MONTH_RE = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi;

// Capitalised words that are ordinary English or headers, not names.
const STOP = new Set(("i i'm i've i'd i'll ap ib gpa sat act stem psat us usa u.s. america american english " +
  "mr mrs ms dr the a an and of in at on to for with my our we it its he she they them his her their this that " +
  "these those there what when where how why who which but or so if as by from not no yes one first january " +
  "february march april may june july august september october november december monday tuesday wednesday " +
  "thursday friday saturday sunday dear sincerely thank thanks hello").split(/\s+/));

function words(text) {
  return String(text || "").toLowerCase().match(/[a-z0-9][a-z0-9'’.-]*/g) || [];
}

// Numbers are compared as written: a 4.0 GPA does not vouch for "four middle
// schoolers", but "200+" does vouch for "200" and "two" for "2".
const numKey = (digits) => digits.replace(/[$,+%]/g, "");
function numbersIn(text) {
  const out = new Set();
  for (const m of String(text || "").match(DIGITS_RE) || []) out.add(numKey(m));
  for (const m of String(text || "").toLowerCase().match(NUMBER_WORD_RE) || []) out.add(String(NUMBER_WORDS[m]));
  return out;
}

// Everything the student actually told us, plus the scholarship's own text:
// a number or name that appears here is supported.
export function sourceText({ profile = {}, bragSheet = "", appAnswers = {}, scholarship = {}, essayPrompt = "", voiceProfile = "" } = {}) {
  const parts = [];
  for (const v of Object.values(profile)) {
    if (typeof v === "string") parts.push(v);
    else if (Array.isArray(v)) parts.push(v.join(" "));
  }
  parts.push(bragSheet || "", essayPrompt || "", voiceProfile || "");
  for (const v of Object.values(appAnswers || {})) if (typeof v === "string") parts.push(v);
  for (const k of ["name", "criteria", "description", "amount"]) if (scholarship?.[k]) parts.push(String(scholarship[k]));
  return parts.join("\n");
}

// Returns [{ text, kind, index }] in letter order, one entry per distinct
// detail. kind: "age" | "number" | "weekday" | "time" | "name".
export function findUnsupportedDetails(letter, sources = {}) {
  const text = String(letter || "");
  if (!text.trim()) return [];
  const src = sourceText(sources);
  const srcWords = new Set(words(src));
  const srcNumbers = numbersIn(src);
  const found = [];
  const seen = new Set();
  const add = (match, kind, index) => {
    const key = match.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ text: match, kind, index });
  };

  // Ages: "I was eleven", "turned ten".
  for (const m of text.matchAll(AGE_RE)) {
    const tok = m[1].toLowerCase();
    const key = /^\d+$/.test(tok) ? tok : (NUMBER_WORDS[tok] !== undefined ? String(NUMBER_WORDS[tok]) : null);
    if (key === null) continue;
    if (!srcNumbers.has(key)) { add(m[0], "age", m.index); seen.add(tok); seen.add(key); }
  }
  // Counts, years, dollar figures, percentages.
  for (const m of text.matchAll(DIGITS_RE)) {
    if (!srcNumbers.has(numKey(m[0]))) add(m[0], "number", m.index);
  }
  for (const m of text.matchAll(NUMBER_WORD_RE)) {
    if (!srcNumbers.has(String(NUMBER_WORDS[m[0].toLowerCase()]))) add(m[0], "number", m.index);
  }
  // Weekdays, months and relative time ("last spring") the student never mentioned.
  for (const m of text.matchAll(WEEKDAY_RE)) if (!srcWords.has(m[1].toLowerCase()) && !srcWords.has(m[0].toLowerCase())) add(m[0], "weekday", m.index);
  for (const m of text.matchAll(MONTH_RE)) if (!srcWords.has(m[0].toLowerCase())) add(m[0], "time", m.index);
  for (const m of text.matchAll(TIME_RE)) {
    const last = m[0].toLowerCase().split(/\s+/).pop();
    if (!srcWords.has(last)) add(m[0], "time", m.index);
  }
  // Proper nouns: a capitalised word that isn't sentence-initial and appears
  // nowhere in what the student wrote (people, places, organisations).
  const sentenceStarts = new Set([0]);
  for (const m of text.matchAll(/[.!?]["”']?\s+|\n+/g)) sentenceStarts.add(m.index + m[0].length);
  for (const m of text.matchAll(/\b[A-Z][a-zA-Z'’-]{2,}\b/g)) {
    if (sentenceStarts.has(m.index)) continue;
    const w = m[0].toLowerCase();
    if (STOP.has(w) || srcWords.has(w) || srcWords.has(w.replace(/'s$/, ""))) continue;
    if (/^[A-Z]+$/.test(m[0]) && m[0].length <= 2) continue;
    add(m[0], "name", m.index);
  }
  return found.sort((a, b) => a.index - b.index);
}

export function describeDetail(d) {
  switch (d.kind) {
    case "age": return "an age you didn't give us";
    case "number": return "a number that isn't in your profile";
    case "weekday": return "a day you didn't mention";
    case "time": return "a time you didn't mention";
    default: return "a name that isn't in your profile";
  }
}
