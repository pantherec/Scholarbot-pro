// ============================================================
// PROFILE QUESTIONS
// ============================================================
// COPPA neutral age screen: plain question, honest year range (young years included
// so kids answer truthfully), and the under-13 block enforced in saveProfile + the wizard.
export const CURRENT_YEAR = new Date().getFullYear();
export const BIRTH_YEARS = Array.from({ length: 31 }, (_, i) => String(CURRENT_YEAR - 10 - i));
// Birth year alone can't tell 12 from 13 in the borderline year, so that year is
// treated as under 13 (MeritLaunch is for high schoolers). Only a yes/no flag is
// ever stored; the year itself is discarded.
export const yearIsUnder13 = (birthYear) => {
  const y = parseInt(birthYear, 10);
  return !isNaN(y) && CURRENT_YEAR - y <= 13;
};
export const isUnder13 = (p) => !!(p && p.under13);
export const GRAD_YEARS = [...Array.from({ length: 6 }, (_, i) => String(CURRENT_YEAR - 1 + i)), "Already in college"];

export const PROFILE_QUESTIONS = [
  {id:"birthYear",q:"What year were you born?",type:"age",options:BIRTH_YEARS,step:0,why:"Only to confirm you're 13 or older. We keep a yes/no, never the year."},
  {id:"name",q:"What is your name?",type:"text",placeholder:"First Last",step:0,why:"Letters use your first name only."},
  {id:"location",q:"Where do you live? (City, State)",type:"text",placeholder:"Rochester, NY",step:0,why:"Many scholarships are for one state. This finds yours."},
  {id:"citizenship",q:"Citizenship / Residency status?",type:"select",options:["U.S. Citizen","Dual Citizen (U.S./Canada)","Permanent Resident","DACA/TPS","International Student","Other"],step:1},
  {id:"ethnicity",q:"How do you identify? (helps match heritage-specific scholarships)",type:"multiselect",options:["African American/Black","Hispanic/Latino","Asian/Pacific Islander","Native American/Indigenous","White/Caucasian","Multiracial","Prefer not to say"],step:1},
  {id:"gpa",q:"Current GPA (unweighted)?",type:"text",placeholder:"3.7",step:1},
  {id:"satact",q:"SAT or ACT score (if taken)?",type:"text",placeholder:"1350 SAT or 30 ACT",step:1},
  {id:"school",q:"Current or most recent high school?",type:"text",placeholder:"Lincoln High School",step:1},
  {id:"gradYear",q:"High school graduation year?",type:"select",options:GRAD_YEARS,step:1},
  {id:"intendedMajor",q:"Intended college major or field of study?",type:"text",placeholder:"Computer Science, Biology, etc.",step:2},
  {id:"financialNeed",q:"Do you demonstrate financial need?",type:"select",options:["Yes — Pell-eligible","Yes — moderate need","No significant need","Unsure"],step:2},
  {id:"activities",q:"List your top 3-5 extracurricular activities / leadership roles:",type:"textarea",placeholder:"e.g., Captain of Debate Team, Volunteer at Food Bank, NSBE chapter co-founder...",step:2},
  {id:"awards",q:"Notable awards or honors?",type:"textarea",placeholder:"e.g., AP Scholar, Regional Science Fair Winner, Honor Roll...",step:2},
  {id:"communityService",q:"Describe your most impactful community service experience:",type:"textarea",placeholder:"What did you do? How many hours? What was the impact?",step:3},
  {id:"personalStory",q:"What is your personal story? What challenges have you overcome?",type:"textarea",placeholder:"This is the heart of your application. Be authentic — what makes you, YOU?",step:3},
  {id:"careerGoal",q:"What is your career goal and how does college fit into it?",type:"textarea",placeholder:"Where do you see yourself in 10 years? Why does this education matter?",step:3},
  {id:"writingStyle",q:"How would you describe your writing voice?",type:"select",options:["Warm and narrative — I tell stories","Direct and evidence-based — I show data","Enthusiastic and energetic — I radiate passion","Reflective and thoughtful — I go deep","Professional and polished — I sound mature"],step:3},
];

export const PROFILE_STEPS = [
  {title: "About You", desc: "Age check, name, and state"},
  {title: "Background", desc: "Academics, identity, and school"},
  {title: "Strengths", desc: "Major, activities, and achievements"},
  {title: "Your Story", desc: "Personal narrative and voice"},
];

// ============================================================
// STYLE TEMPLATES
// ============================================================
export const DEFAULT_TEMPLATES = [
  {id:"narrative",name:"The Storyteller",description:"Opens with a personal anecdote, weaves narrative throughout. Best for scholarships that value personal journey.",rules:"1. Open with a specific moment or memory. 2. Use I-statements. 3. Connect personal story to scholarship mission. 4. Close with forward-looking vision. 5. Ground every claim in a scene the reader can picture.",icon:"generate"},
  {id:"evidence",name:"The Scientist",description:"Lead with evidence and accomplishments. Data-driven. Best for STEM and merit-based scholarships.",rules:"1. Open with a concrete achievement or metric. 2. Use specific numbers and outcomes. 3. Frame experiences as evidence of capability. 4. Connect technical skills to broader impact. 5. NO fluff: replace 'I am passionate about' with 'My work in X demonstrated...'",icon:"science"},
  {id:"mission",name:"The Mission Matcher",description:"Deeply aligns candidate values with the scholarship’s stated mission. Best for foundation and organization scholarships.",rules:"1. Reference the scholarship's mission statement directly. 2. Mirror their language naturally. 3. Show how your goals advance the same work they fund. 4. Provide specific examples of aligned work. 5. Keep tone collaborative, not sycophantic.",icon:"matches"},
  {id:"underdog",name:"The Overcomer",description:"Emphasizes resilience, challenges overcome, and growth. Best for need-based and adversity scholarships.",rules:"1. Be honest about challenges without being pitiful. 2. Show agency — what YOU did about it. 3. Frame hardship as fuel, not excuse. 4. Demonstrate growth trajectory. 5. End with strength and vision, not gratitude alone.",icon:"rise"},
];

// The profile's multiselect fields must be arrays. Older saved profiles (and
// profiles edited directly in the database) sometimes stored `ethnicity` as a
// plain string, which then blew up anywhere it was used with array methods like
// .map()/.join(). Coerce these fields on every load so a stale shape can never
// crash the app.
export const PROFILE_ARRAY_FIELDS = ["ethnicity"];
export function normalizeProfile(p) {
  if (!p || typeof p !== "object") return {};
  const out = { ...p };
  // Older builds stored email, phone and the raw birth year. Matching never used
  // them, so they are dropped on load; a 13+ answer becomes a yes/no flag.
  delete out.email; delete out.phone;
  if (out.birthYear) {
    if (yearIsUnder13(out.birthYear)) { return { under13: true }; }
    out.ageOk = true; delete out.birthYear;
  }
  for (const f of PROFILE_ARRAY_FIELDS) {
    const v = out[f];
    if (v == null || v === "") out[f] = [];
    else if (!Array.isArray(v)) out[f] = [String(v)];
  }
  return out;
}
