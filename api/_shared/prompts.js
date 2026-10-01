// Every Claude request MeritLaunch makes is built here, on the server. The browser
// sends only the student's own facts and choices; it cannot choose the model, the
// token budget, or the guardrails below.
import { sanitizeForPrompt } from "./auth.js";

export const LETTER_MODEL = "claude-sonnet-5";
export const LETTER_MAX_TOKENS = 1600;
export const PROFILE_MAX_TOKENS = 1000;
export const URL_MAX_TOKENS = 1000;

export const TEMPLATES = {
  narrative: {
    name: "The Storyteller",
    rules: "1. Open with a specific moment or memory. 2. Use I-statements. 3. Connect personal story to scholarship mission. 4. Close with forward-looking vision. 5. Ground every claim in a scene the reader can picture.",
  },
  evidence: {
    name: "The Scientist",
    rules: "1. Open with a concrete achievement or metric. 2. Use specific numbers and outcomes. 3. Frame experiences as evidence of capability. 4. Connect technical skills to broader impact. 5. NO fluff: replace 'I am passionate about' with 'My work in X demonstrated...'",
  },
  mission: {
    name: "The Mission Matcher",
    rules: "1. Reference the scholarship's mission statement directly. 2. Mirror their language naturally. 3. Show how your goals advance the same work they fund. 4. Provide specific examples of aligned work. 5. Keep tone collaborative, not sycophantic.",
  },
  underdog: {
    name: "The Overcomer",
    rules: "1. Be honest about challenges without being pitiful. 2. Show agency: what YOU did about it. 3. Frame hardship as fuel, not excuse. 4. Demonstrate growth trajectory. 5. End with strength and vision, not gratitude alone.",
  },
};

// Profile fields that may reach the model. Contact details (email, phone, birth
// year, full name) are deliberately absent: a draft never needs them.
const PROFILE_FIELDS = [
  ["location", "LOCATION"],
  ["citizenship", "CITIZENSHIP"],
  ["ethnicity", "HERITAGE"],
  ["gpa", "GPA"],
  ["satact", "TEST SCORES"],
  ["school", "HIGH SCHOOL"],
  ["gradYear", "GRADUATION"],
  ["intendedMajor", "INTENDED MAJOR"],
  ["financialNeed", "FINANCIAL NEED"],
  ["activities", "ACTIVITIES"],
  ["awards", "AWARDS"],
  ["communityService", "COMMUNITY SERVICE"],
  ["personalStory", "PERSONAL STORY"],
  ["careerGoal", "CAREER GOAL"],
  ["writingStyle", "WRITING VOICE"],
];

const s = (v, n) => sanitizeForPrompt(Array.isArray(v) ? v.join(", ") : (v == null ? "" : String(v)), n);

export function firstName(name) {
  return s(name, 60).split(/\s+/)[0] || "the student";
}

export function profileSummary(profile = {}) {
  const lines = [`FIRST NAME: ${firstName(profile.name)}`];
  for (const [key, label] of PROFILE_FIELDS) {
    const v = s(profile[key], 2500);
    if (v) lines.push(`${label}: ${v}`);
  }
  return lines.join("\n");
}

export function clampWordLimit(n) {
  const v = parseInt(n, 10);
  if (!Number.isFinite(v)) return null;
  return Math.min(1000, Math.max(100, v));
}

const BANNED = `BANNED WORDS (quality rule: these read as filler in any writing):
VERBS: delve, bolster, harness (abstract), unlock, unleash, empower (self-referential), underscore, illuminate, elucidate, embark, unravel, reimagine, revolutionize, transcend, resonate, reverberate, grapple (abstract), intertwine, entwine, weave (abstract), garner, espouse, evoke, exacerbate, amplify, augment, glean, maximize, unveil (abstract), uncover (abstract), champion (self-referential), spearhead, foster, elevate
ADJECTIVES: multifaceted, layered, intricate (unless a literal object), seamless, cutting-edge, holistic, meticulous, innovative, vibrant (abstract), compelling, invaluable, paramount, enduring, indelible, poignant, timeless, relentless, tireless, noteworthy, commendable, exemplary, versatile, unprecedented, captivating, daunting, bustling, burgeoning, flourishing, nuanced (standalone), unparalleled, unwavering, ever-evolving, state-of-the-art, game-changing
NOUNS: tapestry, beacon (metaphor), symphony (metaphor), intricacies, underpinnings, synergy, toolkit, quest (of education or career), nexus, bedrock, cornerstone, foundation (abstract), pinnacle, crucible, enigma, epicenter, linchpin, plethora, treasure trove, paradigm shift, trajectory (abstract), catalyst (abstract), interplay, roadmap (abstract), landscape, testament
ADVERBS: meticulously, profoundly, indelibly, tirelessly, relentlessly, remarkably, effortlessly, holistically, undoubtedly
HYPE: "exciting possibilities lie ahead", "represents a significant milestone", "paving the way for", "pushing the boundaries", "a game-changer", "reaching new heights", thrilled

BANNED OPENERS: "In today's world", "Now more than ever", "As technology continues to evolve", "When it comes to", "Furthermore,", "Moreover,", "Additionally,", "Notably,", "Crucially,", "It is important to note", "I have always been passionate about", "Ever since I was a child", "From a young age", "I want to make a difference"

BANNED CLICHES: "I am committed to giving back to my community", "I have overcome many obstacles" (show them instead), "My journey has been defined by", "I am uniquely qualified because", "I believe I am the ideal candidate", "This scholarship would mean the world to me", "In conclusion", "I would be honored to be selected". If the student is first-generation, state it as a fact inside a sentence, never as the opening line.`;

// The letter prompt. Framed as a DRAFT for the student to revise: the student is
// the author of record, and the prompt never aims at "passing" a detector.
export function buildLetterRequest(input = {}) {
  const {
    profile = {}, scholarship = {}, templateId, customTemplate, essayPrompt,
    wordLimit, voiceProfile, bragSheet, appAnswers, mode,
  } = input;

  const tpl = TEMPLATES[templateId] || (customTemplate && customTemplate.rules
    ? { name: s(customTemplate.name, 80) || "Custom style", rules: s(customTemplate.rules, 1500) }
    : TEMPLATES.narrative);

  const limit = clampWordLimit(wordLimit);
  const lengthRule = limit
    ? `Stay at or under ${limit} words (the application's limit). Aim for ${Math.round(limit * 0.85)}–${limit}.`
    : "350–450 words.";

  const question = s(essayPrompt, 2000);
  const outline = mode === "outline";

  const schName = s(scholarship.name, 200) || "this scholarship";
  const schText = scholarship.source === "custom"
    ? `- Name: ${schName}\n- Full description:\n${s(scholarship.description, 8000)}`
    : `- Name: ${schName}\n- Criteria: ${s(scholarship.criteria, 3000)}\n- Amount: ${s(scholarship.amount, 200)}`;

  const facts = [
    "STUDENT PROFILE (the student's own answers):",
    profileSummary(profile),
    voiceProfile ? `\nVOICE NOTES (built from the student's own answers; match this voice):\n${s(voiceProfile, 4000)}` : "",
    bragSheet ? `\nBRAG SHEET (the student's own document):\n${s(bragSheet, 8000)}` : "",
    appAnswers && Object.keys(appAnswers).length ? `\nAPPLICATION-PREP ANSWERS:\n${s(JSON.stringify(appAnswers), 6000)}` : "",
  ].join("\n");

  if (outline) {
    const system = `You help a high school student plan their own scholarship essay. The scholarship may limit AI writing help, so you do NOT write the essay. You produce a planning outline the student will write from in their own words.

Output, in plain text:
1. "What they're really asking": one or two sentences restating the prompt or criteria plainly.
2. "Your strongest material": 3–5 bullets, each pointing to a specific fact already in the student's profile (quote the fact). Never invent experiences.
3. "A shape for your essay": 3–5 paragraph-by-paragraph bullets, each a direction, not prose ("Open with the night the auger jammed...").
4. "Questions to answer before you write": 4–6 questions that pull out details the profile is missing.
Do not write sentences the student could paste as their essay.

${facts}`;
    return {
      model: LETTER_MODEL,
      max_tokens: 900,
      system,
      messages: [{ role: "user", content: `Scholarship: ${schName}\n${schText}${question ? `\n\nTHE APPLICATION'S QUESTION:\n${question}` : ""}\n\nMake the outline.` }],
    };
  }

  const system = `You help a high school student draft a scholarship application letter that they will then revise and make their own. The student is the author. Your draft must be built only from the student's real facts below, in a voice that fits how this student describes themselves, so that their edits are small and the finished letter is truly theirs. A committee member should finish it and think "I know who this person is," not "this applicant has strong qualifications."

STYLE: ${tpl.name}
${tpl.rules}

HONESTY RULES (non-negotiable):
- Use only facts from the profile, brag sheet, and answers below. Never invent experiences, names, numbers, awards, or feelings the student did not describe.
- If a field is blank, leave that topic out rather than filling it with generic claims.
- Do not claim eligibility the profile does not support. If the profile is silent on a criterion, write around it.

SPECIFICITY:
Every paragraph needs at least one concrete detail from the student's material: a school, a specific activity, a real number, a place, a named person. Replace "I developed leadership skills" with what the leadership actually looked like.

${question ? `ANSWER THE QUESTION:
The application asks: "${question}"
Answer that question directly. Every paragraph should serve the answer.` : `ADDRESS THE CRITERIA:
At least one paragraph shows, through a specific experience (not a claim), why this student fits the criterion that matters most. Do not restate the criteria back at the committee.`}

CRAFT (these make writing clearer for any reader):
- Vary sentence length: some short ones for emphasis, medium ones for narration, an occasional long one for a scene. Avoid runs of same-length sentences.
- Vary paragraph length. Do not end paragraphs with a summary of the paragraph.
- Show one real emotion through an action or memory instead of naming it.
- Open with a scene, a fact, or an action in progress. Never open with "My name is" or "I am applying for."
- No em-dashes. Use Oxford commas. At most two semicolons. Plain three-period ellipsis if needed.
- No bullet points, headers, or bold text. Standard paragraph breaks.

${BANNED}

LENGTH: ${lengthRule}

BEFORE YOU OUTPUT: re-read once and fix any invented fact, banned phrase, em-dash, or length problem. Output only the draft letter, with no preamble, notes, or sign-off commentary.

${facts}`;

  return {
    model: LETTER_MODEL,
    max_tokens: LETTER_MAX_TOKENS,
    system,
    messages: [{
      role: "user",
      content: `Draft a scholarship letter for "${schName}" that ${firstName(profile.name)} will revise and make their own.\n\nSCHOLARSHIP:\n${schText}${question ? `\n\nTHE APPLICATION'S QUESTION:\n${question}` : ""}`,
    }],
  };
}

// The "voice profile": a short description of how this student writes, used to
// keep later drafts in their voice. Built from the student's own answers only.
export function buildProfileRequest(input = {}) {
  const { profile = {}, bragSheet, appAnswers } = input;
  const content = `Write a short voice and strengths summary for a high school student, in Markdown, that will guide future scholarship drafts written FROM their own facts. Use only what is below; never invent.

# Voice profile: ${firstName(profile.name)}

**How they sound:** 2–3 sentences describing their natural voice, based on how they wrote their answers and the writing voice they chose.

**Authenticity rules for drafts:** 4 specific rules (for example, words or framings this student would or would not use).

**Strongest material:** 5 bullets, each naming a specific fact from their answers that a draft should lean on.

STUDENT ANSWERS:
${profileSummary(profile)}${bragSheet ? `\n\nBRAG SHEET:\n${s(bragSheet, 8000)}` : ""}${appAnswers && Object.keys(appAnswers).length ? `\n\nAPPLICATION-PREP ANSWERS:\n${s(JSON.stringify(appAnswers), 6000)}` : ""}`;
  return {
    model: LETTER_MODEL,
    max_tokens: PROFILE_MAX_TOKENS,
    messages: [{ role: "user", content }],
  };
}

export function buildUrlRequest(url) {
  return {
    model: LETTER_MODEL,
    max_tokens: URL_MAX_TOKENS,
    tools: [{ type: "web_search_20260209", name: "web_search" }],
    messages: [{
      role: "user",
      content: `Look up this scholarship page and extract its key details: ${url}\n\nReturn a structured plain-text summary with: Scholarship Name, Organization, Eligibility/Criteria, Award Amount, Deadline, Application Requirements, and the exact essay question(s) if the page lists any. If something isn't on the page, write "Not listed".`,
    }],
  };
}
