import { useState, useEffect, useCallback, useRef, Component } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  initAnalytics,
  identifyUser,
  resetUser,
  trackSignupStarted,
  trackSignupCompleted,
  trackLetterGenerated,
  trackError,
  track,
} from "./analytics.js";
import { PRIVACY_SECTIONS, TERMS_SECTIONS, LAST_UPDATED } from "./legalContent.js";
import { rankMatches } from "./lib/matching.js";
import { parseDeadlineDate as parseDeadlineDateLib, deadlineInfo, compareByDeadline } from "./lib/deadline.js";
import { PLANS, FREE_LIMITS, PAID_LIMITS } from "./lib/plans.js";
import { computeCatalogStats, formatAwardTotal } from "./lib/catalogStats.js";
import { createSseParser } from "./lib/sse.js";

// ============================================================
// DESIGN SYSTEM — Phase A: Brand Voice & Visual Identity
// ============================================================
const COLORS = {
  bg: "#08080d",
  surface: "#0f0f17",
  card: "#141420",
  cardHover: "#1a1a2d",
  border: "#26263b",
  borderHover: "#34344f",
  // Form-field outline: 3:1+ against the panel so a field reads as a field (WCAG 1.4.11).
  fieldBorder: "#62628a",
  gold: "#c9a227",
  goldLight: "#d4b545",
  goldDim: "rgba(201,162,39,0.12)",
  goldGlow: "rgba(201,162,39,0.25)",
  teal: "#4ecdc4",
  tealDim: "rgba(78,205,196,0.12)",
  pink: "#e04040",
  pinkDim: "rgba(224,64,64,0.12)",
  // Readable red for text on dark/tinted grounds (#e04040 measures 4.3:1 there).
  urgentText: "#f47a6f",
  purple: "#4ecdc4",
  purpleDim: "rgba(78,205,196,0.12)",
  orange: "#c9a227",
  text: "#e8e4dc",
  // Both clear 4.5:1 on bg, surface and card (textDim was #555566 at 2.5–2.7:1).
  textMuted: "#aeabbb",
  textDim: "#8f8da2",
  white: "#ffffff",
};

const FONTS = {
  heading: "'Instrument Serif', Georgia, 'Times New Roman', serif",
  body: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'DM Mono', 'Fira Code', monospace",
};

// ============================================================
// SUPABASE CONFIG & AUTH
// ============================================================
const SUPABASE_URL = "https://zudczsepvkjbjgomgilz.supabase.co";
const SUPABASE_KEY = (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_KEY)
  ? import.meta.env.VITE_SUPABASE_KEY
  : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1ZGN6c2VwdmtqYmpnb21naWx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMjcyMjUsImV4cCI6MjA4NjYwMzIyNX0.cyslrHtWjzvvmZfdQHWdP5xIMfP2xkYltdwMKCpNG2w";

const supabase = SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Race a promise against a timeout. Resolves null on timeout instead of hanging —
// a stale/deadlocked Supabase auth lock must never silently block the UI.
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(null), ms)),
  ]);
}

// Nuke the persisted Supabase session out of localStorage. Used whenever an auth
// call times out — a stuck/corrupted token can deadlock the client's internal
// lock for EVERY subsequent auth call in this tab (sign in, sign up, getSession,
// sign out all share it), so clearing it is what lets the next attempt succeed.
function clearStaleSupabaseSession() {
  try {
    const ref = SUPABASE_URL.replace("https://", "").split(".")[0];
    localStorage.removeItem("sb-" + ref + "-auth-token");
  } catch (e) { /* best effort */ }
}

// Get the current access token without ever hanging: try getSession() (3s cap),
// then fall back to the session Supabase persists in localStorage.
async function getAccessTokenSafe() {
  if (!supabase) return null;
  try {
    const result = await withTimeout(supabase.auth.getSession(), 3000);
    const token = result?.data?.session?.access_token;
    if (token) return token;
  } catch (e) { /* fall through to localStorage */ }
  try {
    const ref = SUPABASE_URL.replace("https://", "").split(".")[0];
    const raw = localStorage.getItem("sb-" + ref + "-auth-token");
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed?.access_token || parsed?.currentSession?.access_token || null;
    }
  } catch (e) { /* proceed unauthenticated */ }
  return null;
}

// Attach the Supabase access token to API requests so server endpoints can verify the user.
async function authFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = await getAccessTokenSafe();
  if (token) headers["Authorization"] = "Bearer " + token;
  return fetch(url, { ...options, headers });
}

// ============================================================
// STRIPE CONFIG
// ============================================================
const STRIPE_PRICES = {
  premium: "price_1Tm50TC3noYRmoDviVtHCicV",   // LIVE — MeritLaunch Premium $9.99/mo (2026-06-25)
  seasonal: "price_1Tm51gC3noYRmoDvTQZJndll",  // LIVE — MeritLaunch Seasonal Pass $29.99 one-time
};

function mapScholarshipRow(r) {
  return {
    id: r.id, name: r.name, criteria: r.criteria || "",
    link: r.link || "", deadline: r.deadline || "Varies",
    amount: r.amount || "Varies", needBased: r.need_based || "",
    country: r.country || "US", state: r.state || "",
    linkStatus: r.link_status || "", linkVerifiedAt: r.link_verified_at || null,
  };
}

// Fetch scholarships with a raw REST call to PostgREST — deliberately bypasses the
// supabase-js client so this read can NEVER be blocked by a stuck/corrupted auth
// session in this browser tab. supabase-js coordinates auth refresh via a single
// shared client-side lock; a stale session can deadlock that lock, which then
// hangs every call routed through the client (including plain .from().select()
// reads) — this is what stranded users on the 30 built-in scholarships even
// though the 8s-timeout+retry logic on the client-wrapped call kept firing.
// Scholarships are public data (no RLS/auth needed), so a bare fetch() with just
// the anon key is both simpler and immune to that failure mode. Paginated past
// PostgREST's default 1000-row-per-request cap so the full table always loads.
async function fetchScholarshipsFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const pageSize = 1000;
  let all = [];
  try {
    for (let offset = 0; ; offset += pageSize) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      let res;
      try {
        res = await fetch(`${SUPABASE_URL}/rest/v1/scholarships?select=*&order=id`, {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            Range: `${offset}-${offset + pageSize - 1}`,
          },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok && res.status !== 206) break;
      const page = await res.json();
      if (!Array.isArray(page) || page.length === 0) break;
      all = all.concat(page);
      if (page.length < pageSize) break; // last page
    }
  } catch (e) { /* return whatever pages succeeded before the network error */ }
  return all.length > 0 ? all.map(mapScholarshipRow) : null;
}

// Save user profile to Supabase
async function saveProfileToSupabase(userId, profileData) {
  if (!supabase || !userId) return false;
  try {
    const { error } = await supabase.from("user_profiles").upsert({
      id: userId,
      name: profileData.name || null,
      gpa: profileData.gpa || null,
      grade_level: profileData.gradeLevel || null,
      intended_major: profileData.intendedMajor || null,
      heritage: Array.isArray(profileData.heritage) ? profileData.heritage.join(", ") : profileData.heritage || null,
      citizenship: profileData.citizenship || null,
      financial_need: profileData.financialNeed || null,
      activities: profileData.activities || null,
      leadership: profileData.leadership || null,
      profile_data: profileData,
      updated_at: new Date().toISOString(),
    });
    return !error;
  } catch(e) { return false; }
}

// Load user profile from Supabase
async function loadProfileFromSupabase(userId) {
  if (!supabase || !userId) return null;
  try {
    const { data, error } = await supabase.from("user_profiles").select("profile_data").eq("id", userId).single();
    if (error || !data?.profile_data) return null;
    return data.profile_data;
  } catch(e) { return null; }
}

// Save letter to Supabase
async function saveLetterToSupabase(userId, letter) {
  if (!supabase || !userId) return false;
  try {
    const { error } = await supabase.from("saved_letters").insert({
      user_id: userId,
      scholarship_id: letter.scholarshipId || null,
      scholarship_name: letter.scholarshipName || "Unknown",
      template_name: letter.template || null,
      letter_content: letter.content,
    });
    return !error;
  } catch(e) { return false; }
}

// Load saved letters from Supabase
async function loadLettersFromSupabase(userId) {
  if (!supabase || !userId) return null;
  try {
    const { data, error } = await supabase.from("saved_letters").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error || !data) return null;
    return data.map(l => ({
      id: l.id,
      scholarshipName: l.scholarship_name,
      template: l.template_name,
      content: l.letter_content,
      date: new Date(l.created_at).toLocaleDateString(),
    }));
  } catch(e) { return null; }
}

const store = {
  get: (key) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch(e) { return null; } },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {} },
};

// ============================================================
// SCHOLARSHIP DATABASE (30 verified fallback)
// ============================================================
const DEFAULT_SCHOLARSHIP_DB = [
  {id:"a91bc024",name:"Gates Scholarship",criteria:"High school seniors from minority backgrounds (African American, Hispanic, Asian/Pacific Islander, Native American). Pell-eligible. Must demonstrate leadership and academic excellence. 3.3+ GPA on 4.0 scale. U.S. citizen, national, or permanent resident.",link:"https://www.thegatesscholarship.org/",deadline:"2026-09-15",amount:"Full Tuition",needBased:"Y",country:"US"},
  {id:"c7f3e011",name:"Ron Brown Scholar Program",criteria:"African American high school seniors. Must demonstrate academic excellence, leadership, and community service. U.S. citizen or permanent resident. Financial need considered.",link:"https://ronbrown.org/ron-brown-scholarship/",deadline:"2026-12-01",amount:"$40,000",needBased:"Y",country:"US"},
  {id:"e8a2d445",name:"Coca-Cola Scholars Foundation",criteria:"High school seniors with leadership in school and community. U.S. citizens, nationals, permanent residents, refugees, or asylees. Must be eligible for federal financial aid. Achievement-based.",link:"https://www.coca-colascholarsfoundation.org/apply/",deadline:"2026-09-30",amount:"$20,000",needBased:"",country:"US"},
  {id:"f12b9923",name:"Dell Scholars Program",criteria:"Must participate in an approved college readiness program. Demonstrate need for financial assistance. GPA of 2.4+. U.S. citizen or permanent resident. Must be a current high school senior.",link:"https://www.dellscholars.org/",deadline:"2026-12-01",amount:"$20,000",needBased:"Y",country:"US"},
  {id:"b34cd881",name:"QuestBridge National College Match",criteria:"High-achieving low-income students. Typically household income under $65,000. Strong academics. High school seniors applying to partner colleges.",link:"https://www.questbridge.org/",deadline:"2026-09-26",amount:"Full Ride",needBased:"Y",country:"US"},
  {id:"19afe723",name:"Elks Most Valuable Student Scholarship",criteria:"U.S. citizen high school senior. Judged on scholarship, leadership, financial need. Must plan to pursue a four-year degree.",link:"https://www.elks.org/scholars/scholarships/mvs.cfm",deadline:"2026-11-05",amount:"$12,500",needBased:"Y",country:"US"},
  {id:"20bcd561",name:"Burger King Scholars Program",criteria:"High school seniors in U.S., Canada, Puerto Rico, or Guam. GPA 2.0+. Demonstrate financial need, work experience, community involvement. Awards range $1,000 to $60,000.",link:"https://burgerking.scholarsapply.org/",deadline:"2026-12-15",amount:"$1,000-$60,000",needBased:"Y",country:"BOTH"},
  {id:"31def892",name:"Cameron Impact Scholarship",criteria:"High school seniors. Demonstrated academic achievement, community involvement, and leadership. U.S. citizens. Plan to attend four-year institution.",link:"https://www.bryancameroneducationfoundation.org/",deadline:"2026-09-14",amount:"Full Tuition",needBased:"",country:"US"},
  {id:"42eaf123",name:"Daniels Fund Scholarship",criteria:"Graduating high school seniors from CO, NM, UT, WY. Demonstrate strength of character, leadership, community service. Financial need.",link:"https://www.danielsfund.org/scholarships",deadline:"2026-11-15",amount:"Full Tuition",needBased:"Y",country:"US"},
  {id:"53fba234",name:"UNCF Scholarships",criteria:"Underrepresented minority students. Multiple scholarship programs available year-round. Must attend an HBCU or other accredited institution.",link:"https://uncf.org/scholarships",deadline:"Varies",amount:"Varies",needBased:"Y",country:"US"},
  {id:"64acb345",name:"Hispanic Scholarship Fund",criteria:"Of Hispanic heritage. U.S. citizen, permanent resident, or DACA eligible. Minimum 3.0 GPA. Plan to enroll full-time in accredited institution.",link:"https://www.hsf.net/scholarship",deadline:"2026-02-15",amount:"$500-$5,000",needBased:"",country:"US"},
  {id:"75bdc456",name:"Asian & Pacific Islander American Scholarship (APIASF)",criteria:"Asian American or Pacific Islander ethnicity. 2.7+ GPA. U.S. citizen, national, permanent resident, or citizen of Freely Associated States. Financial need.",link:"https://apiascholars.org/",deadline:"2026-01-11",amount:"Up to $20,000",needBased:"Y",country:"US"},
  {id:"eq01ex25",name:"Equitable Excellence Scholarship",criteria:"High school senior. U.S. citizen or legal resident in 50 states, D.C., or Puerto Rico. 2.5+ GPA. Demonstrate leadership, determination, and resilience. Formerly AXA Achievement Scholarship.",link:"https://equitable.com/foundation/equitable-excellence-scholarship",deadline:"2026-12-18",amount:"$5,000/yr renewable",needBased:"",country:"US"},
  {id:"97dfe678",name:"Horatio Alger Scholarship",criteria:"High school senior. Demonstrated financial need (family income under $55,000). Minimum 2.0 GPA. Involvement in co-curricular and community activities. U.S. citizen.",link:"https://scholars.horatioalger.org/",deadline:"2026-10-25",amount:"$25,000",needBased:"Y",country:"US"},
  {id:"a8ef7789",name:"Jack Kent Cooke Foundation College Scholarship",criteria:"High school senior with financial need (family income under $95,000). 3.5+ unweighted GPA. Standardized test scores. U.S. citizen or permanent resident.",link:"https://www.jkcf.org/our-scholarships/",deadline:"2026-11-18",amount:"Up to $55,000/yr",needBased:"Y",country:"US"},
  {id:"b9f0889a",name:"Posse Foundation Scholarship",criteria:"Must be nominated by high school. Urban public high school students with extraordinary leadership potential. Full tuition at partner colleges.",link:"https://www.possefoundation.org/",deadline:"Nomination Only",amount:"Full Tuition",needBased:"",country:"US"},
  {id:"ca01999b",name:"Regeneron Science Talent Search",criteria:"High school seniors in the U.S. Must submit original research project in science, math, or engineering. Prestigious STEM competition.",link:"https://www.societyforscience.org/regeneron-sts/",deadline:"2026-11-12",amount:"Up to $250,000",needBased:"",country:"US"},
  {id:"db12aa0c",name:"National Merit Scholarship",criteria:"U.S. high school students. Based on PSAT/NMSQT scores taken in junior year. Must be enrolled or plan to enroll full-time in college.",link:"https://www.nationalmerit.org/",deadline:"Via PSAT/NMSQT",amount:"$2,500+",needBased:"",country:"US"},
  {id:"ec23bb1d",name:"Cobell Scholarship (Native American)",criteria:"Must be enrolled member of a federally recognized tribe. Undergraduate or graduate student. Financial need demonstrated.",link:"https://cobellscholar.org/",deadline:"2026-01-31",amount:"Up to $5,000",needBased:"Y",country:"US"},
  {id:"fd34cc2e",name:"NAACP Scholarships",criteria:"African American students. Must be current NAACP member. Varies by specific scholarship program. Academic merit and financial need considered.",link:"https://naacp.org/find-resources/scholarships",deadline:"Varies",amount:"Varies",needBased:"Y",country:"US"},
  {id:"0e45dd3f",name:"Dream.US Scholarship (DREAMers)",criteria:"DACA or TPS recipients. First-time college students or community college transfers. Financial need. 2.5+ GPA. Must attend a partner college.",link:"https://www.thedream.us/",deadline:"2026-02-28",amount:"Up to $33,000",needBased:"Y",country:"US"},
  {id:"1f56ee40",name:"GE-Reagan Foundation Scholarship",criteria:"High school senior. U.S. citizen. Demonstrate leadership, drive, integrity, and citizenship. 3.0+ GPA. $20,000 renewable scholarship.",link:"https://www.reaganfoundation.org/education/scholarship-programs/",deadline:"2026-01-05",amount:"$10,000/yr renewable",needBased:"",country:"US"},
  {id:"3b780062",name:"Amazon Future Engineer Scholarship",criteria:"High school senior planning to study computer science. Financial need. Participation in STEM activities. Includes paid internship at Amazon.",link:"https://www.amazonfutureengineer.com/scholarships",deadline:"2026-01-20",amount:"$40,000",needBased:"Y",country:"US"},
  {id:"4c890173",name:"Buick Achievers Scholarship",criteria:"High school senior or current undergraduate. Plan to major in a STEM field. Demonstrate financial need. Leadership and community involvement.",link:"https://www.buickachievers.com/",deadline:"2026-02-28",amount:"$25,000",needBased:"Y",country:"US"},
  {id:"5d9a0284",name:"Davidson Fellows Scholarship",criteria:"Students 18 or under. Must complete a significant project in STEM, literature, music, philosophy, or outside the box. U.S. citizen or permanent resident.",link:"https://www.davidsongifted.org/gifted-programs/fellows-scholarship/",deadline:"2026-02-11",amount:"$10,000-$50,000",needBased:"",country:"US"},
  {id:"pev2026a",name:"Prudential Emerging Visionaries",criteria:"Ages 14-18. Must have created a financial or societal solution for your community. Replaces the former Prudential Spirit of Community Awards. U.S. residents.",link:"https://www.prudential.com/emerging-visionaries",deadline:"2026-11-01",amount:"Up to $15,000",needBased:"",country:"US"},
  {id:"7fbc24a6",name:"Taco Bell Live Mas Scholarship",criteria:"Ages 16-26. Must be pursuing education at an accredited institution in the U.S. Based on passion and innovation, not just grades. No GPA minimum.",link:"https://www.tacobellfoundation.org/live-mas-scholarship/",deadline:"2026-01-24",amount:"$5,000-$25,000",needBased:"",country:"US"},
  {id:"d65e378d",name:"Jackie Robinson Foundation Scholarship",criteria:"Minority high school senior with leadership potential. SAT/ACT scores considered. Financial need demonstrated. Must be U.S. citizen.",link:"https://www.jackierobinson.org/apply/",deadline:"2026-02-01",amount:"Up to $30,000",needBased:"Y",country:"US"},
  {id:"fluncf26",name:"Foot Locker Foundation-UNCF Scholarship",criteria:"Students attending a UNCF member HBCU. Minimum 2.5 GPA. U.S. citizen, permanent resident, or national. Demonstrate financial need. Seeking bachelor's degree.",link:"https://uncf.org/scholarships",deadline:"2026-04-10",amount:"$5,000",needBased:"Y",country:"US"},
  {id:"tmcfcoke",name:"TMCF Coca-Cola First Generation HBCU Scholarship",criteria:"First-generation college student. Graduating high school senior. Enrolling full-time at a TMCF member HBCU. Financial need. U.S. citizen or permanent resident.",link:"https://tmcf.org/",deadline:"2026-05-01",amount:"$5,000",needBased:"Y",country:"US"},
];

// Full names for the optional state filter (codes come from the scholarship data)
const US_STATE_NAMES = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",
  DE:"Delaware",DC:"District of Columbia",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",
  IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",
  MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",
  NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",
  OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",
  TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",
  WI:"Wisconsin",WY:"Wyoming",
};

// ============================================================
// PROFILE QUESTIONS
// ============================================================
// COPPA neutral age screen: plain question, honest year range (young years included
// so kids answer truthfully), and the under-13 block enforced in saveProfile + the wizard.
const CURRENT_YEAR = new Date().getFullYear();
const BIRTH_YEARS = Array.from({ length: 31 }, (_, i) => String(CURRENT_YEAR - 10 - i));
// Birth year alone can't tell 12 from 13 in the borderline year, so that year is
// treated as under 13 (MeritLaunch is for high schoolers). Only a yes/no flag is
// ever stored; the year itself is discarded.
const yearIsUnder13 = (birthYear) => {
  const y = parseInt(birthYear, 10);
  return !isNaN(y) && CURRENT_YEAR - y <= 13;
};
const isUnder13 = (p) => !!(p && p.under13);
const GRAD_YEARS = [...Array.from({ length: 6 }, (_, i) => String(CURRENT_YEAR - 1 + i)), "Already in college"];

const PROFILE_QUESTIONS = [
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

const PROFILE_STEPS = [
  {title: "About You", desc: "Age check, name, and state"},
  {title: "Background", desc: "Academics, identity, and school"},
  {title: "Strengths", desc: "Major, activities, and achievements"},
  {title: "Your Story", desc: "Personal narrative and voice"},
];

// ============================================================
// STYLE TEMPLATES
// ============================================================
const DEFAULT_TEMPLATES = [
  {id:"narrative",name:"The Storyteller",description:"Opens with a personal anecdote, weaves narrative throughout. Best for scholarships that value personal journey.",rules:"1. Open with a specific moment or memory. 2. Use I-statements. 3. Connect personal story to scholarship mission. 4. Close with forward-looking vision. 5. Ground every claim in a scene the reader can picture.",icon:"generate"},
  {id:"evidence",name:"The Scientist",description:"Lead with evidence and accomplishments. Data-driven. Best for STEM and merit-based scholarships.",rules:"1. Open with a concrete achievement or metric. 2. Use specific numbers and outcomes. 3. Frame experiences as evidence of capability. 4. Connect technical skills to broader impact. 5. NO fluff: replace 'I am passionate about' with 'My work in X demonstrated...'",icon:"science"},
  {id:"mission",name:"The Mission Matcher",description:"Deeply aligns candidate values with the scholarship’s stated mission. Best for foundation and organization scholarships.",rules:"1. Reference the scholarship's mission statement directly. 2. Mirror their language naturally. 3. Show how your goals advance the same work they fund. 4. Provide specific examples of aligned work. 5. Keep tone collaborative, not sycophantic.",icon:"matches"},
  {id:"underdog",name:"The Overcomer",description:"Emphasizes resilience, challenges overcome, and growth. Best for need-based and adversity scholarships.",rules:"1. Be honest about challenges without being pitiful. 2. Show agency — what YOU did about it. 3. Frame hardship as fuel, not excuse. 4. Demonstrate growth trajectory. 5. End with strength and vision, not gratitude alone.",icon:"rise"},
];

// ============================================================
// REUSABLE UI COMPONENTS
// ============================================================
function GlowCard({ children, style, hover = true, onClick, glow = COLORS.gold }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => hover && setHovered(true)}
      onMouseLeave={() => hover && setHovered(false)}
      style={{
        background: COLORS.card,
        border: `1px solid ${hovered ? glow + "44" : COLORS.border}`,
        borderRadius: 14,
        padding: 24,
        transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
        boxShadow: hovered ? `0 12px 40px ${glow}15` : "none",
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Badge({ children, color = COLORS.gold, style }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "4px 10px", borderRadius: 6, fontSize: 11,
      fontFamily: FONTS.body, fontWeight: 600,
      background: color + "18", color: color,
      ...style,
    }}>
      {children}
    </span>
  );
}

// Custom stroke icon set — replaces the unicode glyphs (◇ ◈ ⬡ ◆ …) that used to
// carry the app chrome, so weight, caps, and color stay uniform everywhere.
const ICON_PATHS = {
  home: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-5.5h5V21"/></>,
  profile: <><circle cx="12" cy="7.5" r="3.5"/><path d="M4.5 20.5c0-3.6 3.3-6 7.5-6s7.5 2.4 7.5 6"/></>,
  search: <><circle cx="11" cy="11" r="6.5"/><path d="m16 16 5 5"/></>,
  matches: <><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 11.6v.8"/></>,
  apply: <><rect x="6" y="4.5" width="12" height="16.5" rx="2"/><path d="M9.5 4.5a2.5 2.5 0 0 1 5 0"/><path d="m9 13.5 2 2 4-4.5"/></>,
  generate: <><path d="M4 20l1.2-4.2L16.7 4.3a2 2 0 0 1 2.9 2.9L8.2 18.7 4 20z"/><path d="m14.5 6.5 3 3"/></>,
  templates: <><path d="m12 3.5 8.5 4.7L12 13 3.5 8.2 12 3.5z"/><path d="M3.5 12.5 12 17.3l8.5-4.8"/><path d="M3.5 16.5 12 21.3l8.5-4.8"/></>,
  saved: <path d="M6.5 3.5h11V21L12 16.7 6.5 21V3.5z"/>,
  tracker: <><rect x="3.5" y="4" width="4.6" height="12" rx="1"/><rect x="9.7" y="4" width="4.6" height="16.5" rx="1"/><rect x="15.9" y="4" width="4.6" height="8" rx="1"/></>,
  science: <><path d="M9.5 3.5h5"/><path d="M10.5 3.5v5.2L5.2 18.2A1.6 1.6 0 0 0 6.6 20.5h10.8a1.6 1.6 0 0 0 1.4-2.3L13.5 8.7V3.5"/><path d="M7.6 14h8.8"/></>,
  rise: <><path d="M4 18 10 12l3.5 3.5L20 9"/><path d="M15 9h5v5"/></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17"/><path d="M8 3v4M16 3v4"/></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5"/>,
  menu: <><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></>,
  close: <><path d="m6 6 12 12"/><path d="M18 6 6 18"/></>,
  upload: <><path d="M12 15.5V4.5"/><path d="m7.5 9 4.5-4.5L16.5 9"/><path d="M4.5 15v3.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V15"/></>,
  doc: <><path d="M7 3.5h7l4.5 4.5V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z"/><path d="M14 3.5V8h4.5"/><path d="M9 13h6M9 16.5h6"/></>,
  info: <><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><path d="M12 7.6v.4"/></>,
};

// Brand mark: the gold serif monogram used in the nav, sidebar, favicon and OG image.
function BrandMark({ size = 26 }) {
  return (
    <span aria-hidden="true" style={{
      width: size, height: size, borderRadius: 6, background: "#0A0A0F",
      border: "1px solid rgba(201,162,39,0.45)", display: "inline-flex",
      alignItems: "center", justifyContent: "center", color: "#c9a227",
      fontFamily: "'Instrument Serif', Georgia, serif", fontSize: size * 0.72, lineHeight: 1, flexShrink: 0,
    }}>M</span>
  );
}

// Accessible dialog: labelled, modal, traps Tab, closes on Escape (unless
// `locked`), and returns focus to whatever opened it.
function Modal({ open, onClose, labelledBy, locked = false, children, width = 420, align = "center" }) {
  const panelRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement;
    const focusables = () => [...(panelRef.current?.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) || [])];
    const first = focusables()[0];
    (first || panelRef.current)?.focus();
    const onKey = (e) => {
      if (e.key === "Escape" && !locked) { e.stopPropagation(); onClose?.(); return; }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) { e.preventDefault(); return; }
      const firstEl = items[0], lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      if (opener && typeof opener.focus === "function") opener.focus();
    };
  }, [open, locked]);
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000, padding: 16,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
    }} onClick={() => { if (!locked) onClose?.(); }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}
        onClick={e => e.stopPropagation()} style={{
          background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16,
          padding: 32, width, maxWidth: "100%", maxHeight: "88vh", overflowY: "auto",
          boxShadow: "0 24px 80px rgba(0,0,0,0.5)", textAlign: align, outline: "none",
        }}>
        {children}
      </div>
    </div>
  );
}

// Text-styled control that is a real button (keyboard reachable, announced).
function LinkButton({ children, onClick, style }) {
  return (
    <button type="button" onClick={onClick} style={{
      background: "none", border: "none", padding: 0, cursor: "pointer",
      color: COLORS.gold, font: "inherit", textDecoration: "underline", textUnderlineOffset: 2, ...style,
    }}>{children}</button>
  );
}
function AppIcon({ name, size = 18, color = "currentColor", strokeWidth = 1.7, style }) {
  const paths = ICON_PATHS[name];
  if (!paths) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      style={{ display: "block", flexShrink: 0, ...style }} aria-hidden="true">
      {paths}
    </svg>
  );
}

// Landing letter demo — surfaces the product's signature streaming-letter moment
// on the marketing page as a short scripted loop over a labeled sample profile.
// Renders the full text statically when the visitor prefers reduced motion.
const DEMO_LETTER = "The first thing I ever fixed was a grain auger. Nine at night, rain coming, flashlight in my teeth.\n\nMy robotics coach says I engineer like a farmer. He means I fix things with whatever is on hand. I want to study agricultural engineering so that next time, the fix starts before the bolt shears.";
function LetterDemo() {
  const [chars, setChars] = useState(0);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setChars(DEMO_LETTER.length);
      return;
    }
    let i = 0, timer;
    const tick = () => {
      i += 1;
      setChars(i);
      if (i < DEMO_LETTER.length) {
        timer = setTimeout(tick, 26 + (".!?\n".includes(DEMO_LETTER[i - 1]) ? 180 : 0));
      } else {
        timer = setTimeout(() => { i = 0; setChars(0); timer = setTimeout(tick, 400); }, 4200);
      }
    };
    timer = setTimeout(tick, 800);
    return () => clearTimeout(timer);
  }, []);
  const done = chars >= DEMO_LETTER.length;
  return (
    <div style={{
      maxWidth: 640, margin: "0 auto", background: COLORS.card,
      border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: "hidden",
      textAlign: "left",
    }}>
      <div style={{
        padding: "12px 20px", borderBottom: `1px solid ${COLORS.border}`,
        fontFamily: FONTS.mono, fontSize: 11, color: COLORS.textDim, letterSpacing: 0.5,
        display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
      }}>
        <span style={{ color: COLORS.teal }}>SAMPLE PROFILE</span>
        <span>FFA vice president · robotics captain · first-gen · Hartley, IA</span>
      </div>
      <div style={{
        padding: "26px 28px", fontFamily: FONTS.heading, fontSize: 19, lineHeight: 1.65,
        color: COLORS.text, whiteSpace: "pre-wrap", minHeight: 178,
      }}>
        {DEMO_LETTER.slice(0, chars)}
        <span style={{
          display: "inline-block", width: 2, height: "1.05em", background: COLORS.gold,
          verticalAlign: "text-bottom", marginLeft: 2,
          animation: done ? "blink 1.1s step-end infinite" : "none",
        }} />
      </div>
    </div>
  );
}

function Button({ children, onClick, variant = "primary", disabled, style, icon, ...rest }) {
  const styles = {
    primary: {
      background: disabled ? COLORS.textDim : `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.goldLight})`,
      color: COLORS.bg, fontWeight: 700, border: "none",
      boxShadow: disabled ? "none" : `0 4px 20px ${COLORS.goldGlow}`,
    },
    secondary: {
      background: "transparent", color: COLORS.gold,
      border: `1px solid ${COLORS.gold}44`, fontWeight: 600,
    },
    ghost: {
      background: "transparent", color: COLORS.textMuted,
      border: `1px solid ${COLORS.border}`, fontWeight: 500,
    },
    danger: {
      background: "transparent", color: COLORS.pink,
      border: `1px solid ${COLORS.pink}44`, fontWeight: 600,
    },
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled} {...rest} style={{
      padding: "12px 24px", borderRadius: 10, fontSize: 14,
      fontFamily: FONTS.body, cursor: disabled ? "not-allowed" : "pointer",
      display: "inline-flex", alignItems: "center", gap: 8,
      transition: "all 0.2s", ...styles[variant], ...style,
    }}>
      {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
      {children}
    </button>
  );
}

function SectionHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
      <div>
        <h1 style={{
          fontSize: 38, fontWeight: 400, fontFamily: FONTS.heading,
          lineHeight: 1.15, marginBottom: subtitle ? 6 : 0,
          background: `linear-gradient(135deg, ${COLORS.text}, ${COLORS.gold})`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontFamily: FONTS.body, fontSize: 15, color: COLORS.textMuted, lineHeight: 1.5, maxWidth: 520 }}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

function EmptyState({ icon, title, desc, action, actionLabel }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ width: 72, height: 72, margin: "0 auto 18px", borderRadius: "50%", background: COLORS.goldDim, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <AppIcon name={icon} size={32} color={COLORS.gold} strokeWidth={1.5} />
      </div>
      <div style={{ fontSize: 20, fontFamily: FONTS.heading, color: COLORS.text, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, fontFamily: FONTS.body, color: COLORS.textMuted, maxWidth: 360, margin: "0 auto 24px", lineHeight: 1.6 }}>{desc}</div>
      {action && <Button onClick={action}>{actionLabel}</Button>}
    </div>
  );
}

function ProgressRing({ value, size = 52, color = COLORS.teal }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={COLORS.border} strokeWidth={4} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)" }} />
    </svg>
  );
}

// The profile's multiselect fields must be arrays. Older saved profiles (and
// profiles edited directly in the database) sometimes stored `ethnicity` as a
// plain string, which then blew up anywhere it was used with array methods like
// .map()/.join(). Coerce these fields on every load so a stale shape can never
// crash the app.
const PROFILE_ARRAY_FIELDS = ["ethnicity"];
function normalizeProfile(p) {
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

// Fallback shown when a render error is caught. Fully inline-styled so it never
// depends on anything the crashed subtree was providing.
function ErrorFallback({ onReset, onReload }) {
  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: FONTS.body }}>
      <div style={{ maxWidth: 460, textAlign: "center", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: "40px 32px" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>&#9888;&#65039;</div>
        <div style={{ fontSize: 20, fontFamily: FONTS.heading, color: COLORS.gold, marginBottom: 10 }}>Something went wrong</div>
        <div style={{ fontSize: 14, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 24 }}>
          This page hit an unexpected error. You&#39;re still signed in &mdash; try again to pick up where you left off.
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={onReset} style={{ padding: "12px 24px", borderRadius: 10, border: "none", cursor: "pointer", background: COLORS.gold, color: COLORS.bg, fontSize: 14, fontWeight: 600, fontFamily: FONTS.body }}>Try again</button>
          <button onClick={onReload} style={{ padding: "12px 24px", borderRadius: 10, cursor: "pointer", background: "transparent", color: COLORS.textMuted, fontSize: 14, fontFamily: FONTS.body, border: `1px solid ${COLORS.border}` }}>Reload page</button>
        </div>
      </div>
    </div>
  );
}

// Without a boundary, ANY render-time throw unmounts the whole React tree and
// leaves a blank white page — which is what stranded the user mid-letter and
// forced a reload (and, on reload, a fresh session-restore that could time out
// and "log them out"). This contains such a throw to a recoverable card and
// reports the real stack so we can pinpoint and fix the underlying cause.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error("MeritLaunch render error:", error, info?.componentStack);
    trackError(error, { componentStack: (info?.componentStack || "").slice(0, 3000) });
  }
  handleReset = () => {
    this.setState({ hasError: false });
    if (this.props.onReset) this.props.onReset();
  };
  render() {
    if (this.state.hasError) {
      return <ErrorFallback onReset={this.handleReset} onReload={() => window.location.reload()} />;
    }
    return this.props.children;
  }
}

// ============================================================
// MAIN APP COMPONENT
// ============================================================
// Each view has a real URL so returns from Stripe/email land in the right place,
// Back works, and pages can be linked.
const VIEW_PATHS = {
  landing: "/", search: "/scholarships", home: "/app", profile: "/app/profile",
  profileResult: "/app/profile/voice", matches: "/app/matches", apply: "/app/prep",
  generate: "/app/letters", templates: "/app/styles", saved: "/app/saved", tracker: "/app/deadlines",
};
const PATH_VIEWS = Object.fromEntries(Object.entries(VIEW_PATHS).map(([v, p]) => [p, v]));
function viewFromPath(pathname) {
  const clean = (pathname || "/").replace(/\/+$/, "") || "/";
  return PATH_VIEWS[clean] || (clean.startsWith("/app") ? "home" : "landing");
}

export default function MeritLaunch() {
  const [view, setViewState] = useState(() => (typeof window !== "undefined" ? viewFromPath(window.location.pathname) : "landing"));
  const setView = useCallback((v) => {
    setViewState(v);
    const path = VIEW_PATHS[v] || "/";
    if (typeof window !== "undefined" && window.location.pathname !== path) {
      window.history.pushState({ view: v }, "", path);
    }
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    const onPop = () => setViewState(viewFromPath(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(max-width: 768px)").matches);
  const [reducedMotion] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia?.("(max-width: 768px)");
    if (!mq) return;
    const onChange = () => setIsMobile(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange); else mq.addListener(onChange);
    return () => { if (mq.removeEventListener) mq.removeEventListener("change", onChange); else mq.removeListener(onChange); };
  }, []);
  const [profile, setProfile] = useState({});
  const [bragSheet, setBragSheet] = useState(() => store.get("scholarbot-brag-sheet") || "");
  // Letter Gen scholarship picker (searchable combobox over the full database)
  const [scholarshipQuery, setScholarshipQuery] = useState("");
  const [scholarshipPickerOpen, setScholarshipPickerOpen] = useState(false);
  const [scholarshipDB, setScholarshipDB] = useState(DEFAULT_SCHOLARSHIP_DB);
  const [dbSource, setDbSource] = useState("built-in");
  const [searchQuery, setSearchQuery] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [filterNeedBased, setFilterNeedBased] = useState("all");
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterState, setFilterState] = useState("all");
  // Expired scholarships stay in the catalog and are visible by default — most are
  // annual and come back, and a monthly server job (api/refresh-expired.js) re-checks
  // them for new deadlines. Sorting keeps them below live listings; the toggle hides
  // them entirely for students who only want what's open right now.
  const [showExpired, setShowExpired] = useState(true);
  const [matchResults, setMatchResults] = useState(() => store.get("scholarbot-matches") || []);
  const [browseLimit, setBrowseLimit] = useState(24);
  const [essayPrompt, setEssayPrompt] = useState("");
  const [wordLimit, setWordLimit] = useState("");
  const [aiPolicy, setAiPolicy] = useState("allowed"); // allowed | unsure
  const [pickerActive, setPickerActive] = useState(0);
  const [upgradeReason, setUpgradeReason] = useState(null); // { kind, resetsOn }
  const [emailOptOut, setEmailOptOut] = useState(false);
  const [selectedScholarship, setSelectedScholarship] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(DEFAULT_TEMPLATES[0]);
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [generatedLetter, setGeneratedLetter] = useState(() => store.get("scholarbot-draft") || "");
  const [generatingLetter, setGeneratingLetter] = useState(false);
  const [generatedProfile, setGeneratedProfile] = useState("");
  const [savedLetters, setSavedLetters] = useState([]);
  const [trackedApps, setTrackedApps] = useState(() => {
    try { return JSON.parse(localStorage.getItem("scholarbot-tracked-apps")) || []; } catch { return []; }
  });
  const [appAnswers, setAppAnswers] = useState({});
  const [notification, setNotification] = useState(null);
  const [deadlineAlerts, setDeadlineAlerts] = useState([]);
  const [bragSheetFileName, setBragSheetFileName] = useState("");
  const [bragSheetUploading, setBragSheetUploading] = useState(false);
  const [profileStep, setProfileStep] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const bragFileRef = useRef(null);
  const [scholarshipInputMode, setScholarshipInputMode] = useState("database");
  const [customScholarshipText, setCustomScholarshipText] = useState("");
  const [customScholarshipName, setCustomScholarshipName] = useState("");
  const [scholarshipUrl, setScholarshipUrl] = useState("");
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [uploadedScholarshipName, setUploadedScholarshipName] = useState("");
  const scholarshipFileRef = useRef(null);

  // Auth state
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState("signin"); // signin | signup | forgot | reset
  const [legalModal, setLegalModal] = useState(null); // null | "privacy" | "terms"
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authDob, setAuthDob] = useState(""); // COPPA: used only for age check, never stored
  const [usageResetsOn, setUsageResetsOn] = useState(null);
  const [userSubscription, setUserSubscription] = useState("free"); // free | premium | seasonal
  const [monthlyLettersUsed, setMonthlyLettersUsed] = useState(0);
  const [monthlyMatchesUsed, setMonthlyMatchesUsed] = useState(0);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Feature gating. Display only: the server (api/usage.js, api/generate-stream.js)
  // enforces the same limits from src/lib/plans.js / api/_shared/usage.js.
  const PRO_LIMITS = PAID_LIMITS;
  const isPremium = userSubscription === "premium" || userSubscription === "seasonal";
  const canMatch = isPremium || monthlyMatchesUsed < FREE_LIMITS.matchesPerMonth;
  const canGenerateLetter = isPremium
    ? monthlyLettersUsed < PRO_LIMITS.lettersPerMonth
    : monthlyLettersUsed < FREE_LIMITS.lettersPerMonth;
  const remainingMatches = isPremium ? "Unlimited" : Math.max(0, FREE_LIMITS.matchesPerMonth - monthlyMatchesUsed);
  const remainingLetters = isPremium
    ? Math.max(0, PRO_LIMITS.lettersPerMonth - monthlyLettersUsed)
    : Math.max(0, FREE_LIMITS.lettersPerMonth - monthlyLettersUsed);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Plan + usage come from the server, which owns the counters.
  const applyUsage = (u) => {
    if (!u || u.error) return;
    setUserSubscription(u.plan || "free");
    setMonthlyLettersUsed(u.lettersUsed || 0);
    setMonthlyMatchesUsed(u.matchesUsed || 0);
    setUsageResetsOn(u.resetsOn || null);
  };
  const refreshUsage = useCallback(async () => {
    try {
      const resp = await authFetch("/api/usage");
      if (resp.ok) { const u = await resp.json(); applyUsage(u); return u; }
    } catch (e) { /* keep the last known values */ }
    return null;
  }, []);

  // Signed-out students keep a soft local match counter (matching runs in the
  // browser); signed-in students are counted on the server.
  const localMonthKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth()}`; };
  const localMatchCount = () => { const r = store.get("scholarbot-local-matches"); return r && r.month === localMonthKey() ? r.count : 0; };

  const openUpgrade = (kind, resetsOn) => {
    setUpgradeReason({ kind, resetsOn: resetsOn || usageResetsOn });
    setShowUpgradeModal(true);
    track("upgrade_prompt_shown", { kind });
  };

  // Stripe checkout handler
  const handleCheckout = useCallback(async (plan) => {
    if (!authUser) {
      setShowAuthModal(true);
      return;
    }
    setCheckoutLoading(true);
    track("checkout_started", { plan });
    try {
      const isSubscription = plan === "premium";
      const resp = await authFetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId: STRIPE_PRICES[plan],
          userId: authUser.id,
          userEmail: authUser.email,
          mode: isSubscription ? "subscription" : "payment",
        }),
      });
      const data = await resp.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        notify("Checkout failed: " + (data.error || "Unknown error"), "error");
      }
    } catch (err) {
      notify("Could not start checkout. Please try again.", "error");
    } finally {
      setCheckoutLoading(false);
    }
  }, [authUser]);

  // Check for checkout success/cancel on page load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      notify("Payment received. Activating your plan...", "success");
      track("checkout_completed");
      window.history.replaceState({}, "", window.location.pathname);
      // The webhook flips the plan; poll the server briefly instead of guessing.
      let tries = 0;
      const poll = async () => {
        const u = await refreshUsage();
        if (u && u.paid) { notify(u.plan === "seasonal" ? "Your Season Pass is active." : "Premium is active. Welcome!", "success"); return; }
        if (++tries < 6) setTimeout(poll, 2500);
      };
      setTimeout(poll, 1500);
    } else if (params.get("checkout") === "cancelled") {
      notify("Checkout cancelled. No charge was made.", "info");
      track("checkout_cancelled");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // File reader helper. PDFs and .docx get real text extraction (pdfjs / mammoth,
  // lazy-loaded so they stay out of the main bundle); plain-text formats are read
  // directly. Legacy binary .doc can't be parsed in the browser — tell the user
  // instead of silently feeding the AI garbage bytes.
  const readFileAsText = async (file) => {
    const name = file.name.toLowerCase();
    const MAX_CHARS = 15000;

    if (name.endsWith(".pdf")) {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
      const data = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data }).promise;
      let text = "";
      for (let i = 1; i <= doc.numPages && text.length < MAX_CHARS; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((it) => it.str).join(" ") + "\n";
      }
      const cleaned = text.replace(/[ \t]+/g, " ").trim().slice(0, MAX_CHARS);
      if (!cleaned) throw new Error("No readable text found in this PDF — it may be a scanned image. Try pasting the content instead.");
      return cleaned;
    }

    if (name.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const arrayBuffer = await file.arrayBuffer();
      const { value } = await mammoth.extractRawText({ arrayBuffer });
      const cleaned = (value || "").trim().slice(0, MAX_CHARS);
      if (!cleaned) throw new Error("No readable text found in this Word document. Try pasting the content instead.");
      return cleaned;
    }

    if (name.endsWith(".doc")) {
      throw new Error("Legacy .doc files aren't supported — save it as .docx or PDF, or paste the text.");
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(String(e.target.result).slice(0, MAX_CHARS));
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleBragSheetUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBragSheetUploading(true);
    setBragSheetFileName(file.name);
    try {
      const text = await readFileAsText(file);
      setBragSheet(prev => prev ? prev + "\n\n--- Uploaded from: " + file.name + " ---\n\n" + text : text);
      notify(`Brag sheet "${file.name}" uploaded successfully!`, "success");
    } catch(err) {
      notify(err?.message || "Error reading file. Try pasting the content instead.", "error");
      setBragSheetFileName("");
    }
    setBragSheetUploading(false);
    if (bragFileRef.current) bragFileRef.current.value = "";
  };

  const handleScholarshipUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedScholarshipName(file.name);
    try {
      const text = await readFileAsText(file);
      setCustomScholarshipText(text);
      if (!customScholarshipName) setCustomScholarshipName(file.name.replace(/\.\w+$/, ""));
      notify(`Scholarship "${file.name}" loaded!`, "success");
    } catch(err) {
      notify("Error reading file. Try pasting the content instead.", "error");
    }
    if (scholarshipFileRef.current) scholarshipFileRef.current.value = "";
  };

  const fetchScholarshipFromUrl = async () => {
    if (!scholarshipUrl.trim()) { notify("Please enter a URL.", "error"); return; }
    setFetchingUrl(true);
    try {
      const response = await authFetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "scholarship_from_url", url: scholarshipUrl.trim() }),
      });
      const data = await response.json();
      if (!response.ok) { notify(data.error || "Could not fetch details. Try pasting the content.", "error"); setFetchingUrl(false); return; }
      const text = data.text || "";
      if (text) {
        setCustomScholarshipText(text);
        const nameMatch = text.match(/(?:Scholarship\s*Name|Name)\s*[:\-]\s*(.+)/i);
        if (nameMatch && !customScholarshipName) setCustomScholarshipName(nameMatch[1].trim().slice(0, 80));
        notify("Scholarship details fetched!", "success");
      } else {
        notify("Could not fetch details. Try pasting the content.", "error");
      }
    } catch(err) {
      notify("Error fetching URL. Try pasting manually.", "error");
    }
    setFetchingUrl(false);
  };

  // Auth handlers
  const handleSignUp = async () => {
    setAuthError(""); setAuthSubmitting(true);
    // COPPA age gate — check age, then discard DOB immediately (never stored)
    if (authDob) {
      const birthDate = new Date(authDob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
      if (age < 13) {
        setAuthError("You must be 13 or older to use MeritLaunch.");
        setAuthSubmitting(false);
        setAuthDob(""); // discard immediately
        return;
      }
    } else {
      setAuthError("Please enter your date of birth to confirm you are 13 or older.");
      setAuthSubmitting(false);
      return;
    }
    setAuthDob(""); // discard DOB — not stored anywhere
    try {
      const result = await withTimeout(supabase.auth.signUp({ email: authEmail, password: authPassword }), 8000);
      if (result === null) {
        clearStaleSupabaseSession();
        setAuthError("That timed out — we've reset your session. Please try again.");
        setAuthSubmitting(false);
        return;
      }
      const { data, error } = result;
      if (error) { setAuthError(error.message); }
      else {
        setAuthError("");
        notify("Check your email for a confirmation link!", "success");
        setAuthMode("signin");
        const newUserId = data?.user?.id;
        if (newUserId) {
          identifyUser(newUserId);
          trackSignupCompleted(newUserId);
        }
      }
    } catch(e) { setAuthError("Something went wrong. Please try again."); }
    setAuthSubmitting(false);
  };

  const handleSignIn = async () => {
    setAuthError(""); setAuthSubmitting(true);
    try {
      const result = await withTimeout(supabase.auth.signInWithPassword({ email: authEmail, password: authPassword }), 8000);
      if (result === null) {
        clearStaleSupabaseSession();
        setAuthError("Sign-in timed out — we've reset your session. Please try again.");
        setAuthSubmitting(false);
        return;
      }
      const { data, error } = result;
      if (error) { setAuthError(error.message); }
      else {
        setShowAuthModal(false); setAuthEmail(""); setAuthPassword("");
        notify("Welcome back!", "success");
        if (data?.user?.id) identifyUser(data.user.id);
      }
    } catch(e) { setAuthError("Something went wrong. Please try again."); }
    setAuthSubmitting(false);
  };

  const handleForgotPassword = async () => {
    setAuthError(""); setAuthSubmitting(true);
    try {
      const result = await withTimeout(supabase.auth.resetPasswordForEmail(authEmail, {
        redirectTo: window.location.origin,
      }), 8000);
      if (result === null) {
        clearStaleSupabaseSession();
        setAuthError("That timed out — we've reset your session. Please try again.");
        setAuthSubmitting(false);
        return;
      }
      const { error } = result;
      if (error) { setAuthError(error.message); }
      else { notify("Password reset email sent!", "success"); setAuthMode("signin"); }
    } catch(e) { setAuthError("Something went wrong."); }
    setAuthSubmitting(false);
  };

  const handleUpdatePassword = async () => {
    setAuthError(""); setAuthSubmitting(true);
    if (newPassword.length < 6) { setAuthError("Password must be at least 6 characters."); setAuthSubmitting(false); return; }
    if (newPassword !== confirmPassword) { setAuthError("Passwords don't match."); setAuthSubmitting(false); return; }
    try {
      const result = await withTimeout(supabase.auth.updateUser({ password: newPassword }), 8000);
      if (result === null) {
        clearStaleSupabaseSession();
        setAuthError("That timed out — we've reset your session. Please try again.");
        setAuthSubmitting(false);
        return;
      }
      const { error } = result;
      if (error) { setAuthError(error.message); }
      else {
        notify("Password updated successfully!", "success");
        setShowAuthModal(false); setNewPassword(""); setConfirmPassword(""); setAuthMode("signin");
      }
    } catch(e) { setAuthError("Something went wrong. Please try again."); }
    setAuthSubmitting(false);
  };

  // Analytics: fire signup_started whenever the modal opens in signup mode
  useEffect(() => {
    if (showAuthModal && authMode === "signup") {
      trackSignupStarted();
    }
  }, [showAuthModal, authMode]);

  const handleSignOut = async () => {
    // 3s cap — a deadlocked auth client must never trap the user signed-in.
    // On timeout, force-clear the persisted session so a reload starts clean.
    const result = await withTimeout(supabase?.auth.signOut() ?? Promise.resolve(true), 3000);
    if (result === null) clearStaleSupabaseSession();
    resetUser(); // clear PostHog identity on sign-out
    setAuthUser(null);
    notify("Signed out.", "info");
  };

  // Load data on mount + auth listener
  useEffect(() => {
    initAnalytics(); // PostHog — no-op if VITE_POSTHOG_KEY not set

    // Load local data first (fast)
    const p = store.get("scholarbot-profile"); if (p) setProfile(normalizeProfile(p));
    const l = store.get("scholarbot-letters"); if (l) setSavedLetters(l);
    const t = store.get("scholarbot-templates"); if (t) setTemplates(t);
    const a = store.get("scholarbot-answers"); if (a) setAppAnswers(a);
    // Voice scaffold is fed into every letter's system prompt, so it has to
    // survive a reload — otherwise it only helps within the session that made it.
    const vp = store.get("scholarbot-voice-profile"); if (vp) setGeneratedProfile(vp);

    // Fetch scholarships from Supabase — retry with backoff so a transient
    // failure self-heals instead of stranding the app on the 30 built-ins.
    let scholarshipsLoaded = false;
    let inFlight = null; // a slow first fetch must not be duplicated by the retry timers
    const retryTimers = [];
    const loadScholarships = async () => {
      if (scholarshipsLoaded || inFlight) return;
      inFlight = fetchScholarshipsFromSupabase();
      try {
        const rows = await inFlight;
        if (rows && rows.length > 0) {
          scholarshipsLoaded = true;
          setScholarshipDB(rows);
          setDbSource("synced");
        }
      } finally { inFlight = null; }
    };
    loadScholarships();
    for (const delay of [5000, 20000, 60000]) {
      retryTimers.push(setTimeout(loadScholarships, delay));
    }

    // Loads subscription status, usage counters, notifications, and tracked
    // applications for a signed-in user. Called from BOTH the initial session
    // check and onAuthStateChange below — onAuthStateChange alone can miss a
    // session that's silently restored from localStorage on page load,
    // which was leaving premium users showing as "Free" after a refresh.
    const loadAccountData = async (user) => {
      // Plan, Season Pass expiry and the monthly reset are all applied on the
      // server (api/usage.js); the browser can no longer write those columns.
      const usage = await refreshUsage();
      if (!usage) {
        const { data: prof } = await supabase
          .from("user_profiles")
          .select("subscription_status, letters_used_this_month, matches_used_this_month")
          .eq("id", user.id)
          .single();
        if (prof) {
          setUserSubscription(prof.subscription_status || "free");
          setMonthlyLettersUsed(prof.letters_used_this_month || 0);
          setMonthlyMatchesUsed(prof.matches_used_this_month || 0);
        }
      }
      const { data: prefs } = await supabase.from("user_profiles").select("email_alerts_opt_out").eq("id", user.id).single();
      if (prefs) setEmailOptOut(!!prefs.email_alerts_opt_out);

      const { data: alerts } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(10);
      if (alerts) setDeadlineAlerts(alerts);

      const { data: cloudApps } = await supabase
        .from("applications")
        .select("*")
        .eq("user_id", user.id);
      if (cloudApps && cloudApps.length > 0) {
        const merged = cloudApps.map(a => ({
          id: a.id,
          scholarshipId: a.scholarship_id,
          name: a.scholarship_name || a.scholarship_id,
          amount: "", deadline: "", link: "",
          status: a.status || "interested",
          addedAt: a.created_at,
          notes: a.notes || "",
        }));
        const localIds = new Set(merged.map(a => a.scholarshipId));
        const localOnly = trackedApps.filter(a => !localIds.has(a.scholarshipId));
        const combined = [...merged, ...localOnly];
        setTrackedApps(combined);
        localStorage.setItem("scholarbot-tracked-apps", JSON.stringify(combined));
      }
    };

    // Auth listener
    if (supabase) {
      // 8s cap — a stuck/corrupted session must never leave the app spinning on
      // auth forever. On timeout, clear the bad session so the next sign-in
      // attempt starts clean instead of inheriting the same deadlock.
      withTimeout(supabase.auth.getSession(), 8000).then(result => {
        if (result === null) {
          clearStaleSupabaseSession();
          setAuthUser(null);
          setAuthLoading(false);
          return;
        }
        const { data: { session } } = result;
        setAuthUser(session?.user ?? null);
        setAuthLoading(false);
        // If logged in, try to load cloud profile
        if (session?.user) {
          loadProfileFromSupabase(session.user.id).then(cloudProfile => {
            if (cloudProfile && Object.keys(cloudProfile).length > 0) {
              const normalized = normalizeProfile(cloudProfile);
              setProfile(normalized);
              store.set("scholarbot-profile", normalized);
            }
          });
          loadLettersFromSupabase(session.user.id).then(cloudLetters => {
            if (cloudLetters && cloudLetters.length > 0) {
              setSavedLetters(cloudLetters);
            }
          });
          loadAccountData(session.user);
        }
      });

      // Check URL for recovery flow on initial load
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const urlType = hashParams.get("type");
      if (urlType === "recovery") {
        // Supabase v2: recovery token is in the URL hash — wait for session, then show reset modal
        const checkRecovery = setInterval(async () => {
          const { data: { session: recoverySess } } = await supabase.auth.getSession();
          if (recoverySess) {
            clearInterval(checkRecovery);
            setAuthUser(recoverySess.user);
            setAuthMode("reset");
            setShowAuthModal(true);
            setNewPassword("");
            setConfirmPassword("");
            setAuthError("");
            // Clean up the URL hash so refresh doesn't re-trigger
            window.history.replaceState(null, "", window.location.pathname);
          }
        }, 300);
        setTimeout(() => clearInterval(checkRecovery), 10000); // safety timeout
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        const user = session?.user ?? null;
        setAuthUser(user);
        // If user arrived via password reset link, show the reset password modal
        if (_event === "PASSWORD_RECOVERY") {
          setAuthMode("reset");
          setShowAuthModal(true);
          setNewPassword("");
          setConfirmPassword("");
          setAuthError("");
          return;
        }
        if (user && supabase) {
          await loadAccountData(user);
        }
      });

      return () => { subscription?.unsubscribe(); retryTimers.forEach(clearTimeout); };
    } else {
      setAuthLoading(false);
      return () => retryTimers.forEach(clearTimeout);
    }
  }, []);

  const notify = (msg, type = "info") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const saveProfile = (p) => {
    // COPPA: under-13 answers are never collected. Keep only a flag (so the block
    // screen persists), drop everything else, and never sync to the cloud.
    if (p.under13) {
      const minimal = { under13: true };
      setProfile(minimal);
      store.set("scholarbot-profile", minimal);
      return;
    }
    setProfile(p);
    store.set("scholarbot-profile", p);
    // Sync to cloud if logged in
    if (authUser) saveProfileToSupabase(authUser.id, p);
  };
  const saveLetter = (letter) => {
    const updated = [...savedLetters, { ...letter, id: Date.now(), date: new Date().toLocaleDateString() }];
    setSavedLetters(updated); store.set("scholarbot-letters", updated);
    // Sync to cloud if logged in
    if (authUser) saveLetterToSupabase(authUser.id, letter);
    notify("Letter saved!", "success");
  };
  const saveTemplates = (t) => { setTemplates(t); store.set("scholarbot-templates", t); };

  // Application tracker helpers
  const trackApplication = (scholarship, status = "interested") => {
    const existing = trackedApps.find(a => a.scholarshipId === scholarship.id);
    if (existing) {
      notify("Already tracking this scholarship.", "info");
      return;
    }
    const app = {
      id: Date.now(),
      scholarshipId: scholarship.id,
      name: scholarship.name,
      amount: scholarship.amount,
      deadline: scholarship.deadline,
      link: scholarship.link,
      status, // interested | in_progress | submitted | accepted | rejected
      addedAt: new Date().toISOString(),
      notes: "",
    };
    const updated = [...trackedApps, app];
    setTrackedApps(updated);
    localStorage.setItem("scholarbot-tracked-apps", JSON.stringify(updated));
    // Sync to Supabase if logged in
    if (authUser && supabase) {
      supabase.from("applications").insert({
        user_id: authUser.id,
        scholarship_id: scholarship.id,
        scholarship_name: scholarship.name,
        status,
        notes: "",
      }).then(() => {});
    }
    notify(`Tracking "${scholarship.name}"`, "success");
  };

  const updateAppStatus = (appId, newStatus) => {
    const updated = trackedApps.map(a => a.id === appId ? { ...a, status: newStatus } : a);
    setTrackedApps(updated);
    localStorage.setItem("scholarbot-tracked-apps", JSON.stringify(updated));
    // Sync to Supabase
    const app = trackedApps.find(a => a.id === appId);
    if (authUser && supabase && app) {
      supabase.from("applications").update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("user_id", authUser.id).eq("scholarship_id", app.scholarshipId).then(() => {});
    }
  };

  const removeTrackedApp = (appId) => {
    const app = trackedApps.find(a => a.id === appId);
    const updated = trackedApps.filter(a => a.id !== appId);
    setTrackedApps(updated);
    localStorage.setItem("scholarbot-tracked-apps", JSON.stringify(updated));
    if (authUser && supabase && app) {
      supabase.from("applications").delete().eq("user_id", authUser.id).eq("scholarship_id", app.scholarshipId).then(() => {});
    }
    notify("Removed from tracker.", "info");
  };

  const answered = (q) => q.type === "age" ? !!profile.ageOk
    : Array.isArray(profile[q.id]) ? profile[q.id].length > 0 : !!profile[q.id];
  const profileCompletion = Math.round(PROFILE_QUESTIONS.filter(answered).length / PROFILE_QUESTIONS.length * 100);

  // Matching
  const runMatching = async () => {
    if (!profile.ageOk) { setProfileStep(0); setView("profile"); notify("Answer the first question so we can match you.", "info"); return; }
    if (authUser) {
      try {
        const resp = await authFetch("/api/usage", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "match" }),
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.status === 402) { openUpgrade("match", data.resetsOn); return; }
        if (resp.ok) applyUsage(data);
      } catch (e) { /* matching runs locally; a network blip shouldn't block it */ }
    } else {
      if (localMatchCount() >= FREE_LIMITS.matchesPerMonth) { openUpgrade("match"); return; }
      store.set("scholarbot-local-matches", { month: localMonthKey(), count: localMatchCount() + 1 });
    }
    const results = rankMatches(profile, scholarshipDB);
    setMatchResults(results);
    store.set("scholarbot-matches", results.slice(0, 200));
    track("matches_run", { count: results.length });
    setView("matches");
    notify(results.length ? `Found ${results.length} scholarships you're eligible for.` : "No eligible matches yet. Add more to your profile.", results.length ? "success" : "info");
  };

  // Letter generation. The prompt, model and limits live on the server
  // (api/_shared/prompts.js); the browser sends the student's facts and choices.
  const draftProfile = () => {
    const { email, phone, birthYear, under13, ageOk, ...rest } = profile;
    return rest;
  };
  const thinFields = () => [
    ["activities", "activities"], ["communityService", "community service"],
    ["personalStory", "your personal story"], ["careerGoal", "your career goal"],
  ].filter(([k]) => !(profile[k] || "").trim()).map(([, label]) => label);

  const generateLetter = async ({ isRegenerate = false } = {}) => {
    if (!authUser) { setAuthMode("signup"); setShowAuthModal(true); notify("Create a free account to draft letters.", "info"); return; }
    const hasDbSelection = scholarshipInputMode === "database" && selectedScholarship;
    const hasCustomInput = scholarshipInputMode !== "database" && customScholarshipText.trim();
    if (!hasDbSelection && !hasCustomInput) {
      notify(scholarshipInputMode === "database" ? "Pick a scholarship first." : "Add the scholarship details first.", "error");
      return;
    }
    if (!profile.ageOk) { setView("profile"); notify("Finish the first step of your profile first.", "info"); return; }
    const outline = aiPolicy === "unsure";
    if (!outline && !canGenerateLetter) {
      if (isPremium) notify(`You've used all ${PRO_LIMITS.lettersPerMonth} letters this month. Your limit resets next month.`, "error");
      else openUpgrade("letter");
      return;
    }
    // Regenerating writes a new draft and costs a letter. Free users get only a
    // couple, so confirm before spending one.
    if (isRegenerate && !isPremium && !outline) {
      const left = Math.max(0, FREE_LIMITS.lettersPerMonth - monthlyLettersUsed);
      const ok = window.confirm(`Regenerating writes a brand new draft and uses one of your ${left} remaining free letter${left === 1 ? "" : "s"} this month.\n\nGenerate a new version?`);
      if (!ok) return;
    }

    setGeneratingLetter(true);
    setGeneratedLetter("");

    const scholarshipLabel = hasDbSelection ? selectedScholarship.name : (customScholarshipName || "Custom Scholarship");
    const scholarship = hasDbSelection
      ? { source: "database", name: selectedScholarship.name, criteria: selectedScholarship.criteria, amount: selectedScholarship.amount }
      : { source: "custom", name: customScholarshipName || "Custom Scholarship", description: customScholarshipText.slice(0, 8000) };
    const builtIn = DEFAULT_TEMPLATES.some(t => t.id === selectedTemplate?.id);

    try {
      const response = await authFetch("/api/generate-stream", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: draftProfile(),
          scholarship,
          templateId: builtIn ? selectedTemplate.id : null,
          customTemplate: builtIn ? null : { name: selectedTemplate?.name, rules: selectedTemplate?.rules },
          essayPrompt: essayPrompt.trim(),
          wordLimit: wordLimit || null,
          voiceProfile: generatedProfile || "",
          bragSheet: bragSheet || "",
          appAnswers,
          mode: outline ? "outline" : "draft",
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        setGeneratingLetter(false);
        if (response.status === 402) { setGeneratedLetter(""); openUpgrade("letter", errData.resetsOn); return; }
        setGeneratedLetter("");
        notify(errData.error || "Couldn't draft the letter. Please try again.", "error");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      const parser = createSseParser((evt) => {
        if (evt.type === "content_block_delta" && evt.delta?.text) {
          fullText += evt.delta.text;
          setGeneratedLetter(fullText);
        } else if (evt.type === "meritlaunch_usage") {
          setMonthlyLettersUsed(evt.lettersUsed || 0);
        }
      });
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.push(decoder.decode(value, { stream: true }));
      }
      parser.flush();

      if (!fullText) {
        notify("The AI service returned an empty draft. You weren't charged. Please try again.", "error");
      } else {
        store.set("scholarbot-draft", fullText);
        trackLetterGenerated({ scholarshipName: scholarshipLabel, template: selectedTemplate?.name || "unknown" });
        if (outline) track("letter_outline_generated");
      }
    } catch (e) {
      notify("Couldn't reach the AI service. Check your connection and try again.", "error");
    }
    setGeneratingLetter(false);
  };

  // Profile generation
  const generateCandidateProfile = async () => {
    if (!authUser) { setAuthMode("signup"); setShowAuthModal(true); notify("Create a free account to continue.", "info"); return; }
    if (!profile.ageOk) { setProfileStep(0); notify("Answer the first question first.", "info"); return; }
    setGeneratingLetter(true);
    try {
      const response = await authFetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "profile", profile: draftProfile(), bragSheet: bragSheet || "", appAnswers }),
      });
      const data = await response.json();
      const text = data.text || "";
      if (!text) { notify("Error generating profile.", "error"); setGeneratingLetter(false); return; }
      setGeneratedProfile(text);
      store.set("scholarbot-voice-profile", text);
      setView("profileResult");
    } catch(e) { notify("Error generating profile.", "error"); }
    setGeneratingLetter(false);
  };

  const APP_QUESTIONS = [
    "Tell us about yourself and your educational goals. (150-300 words)",
    "Describe a challenge you've overcome and what you learned from it. (150-300 words)",
    "How will this scholarship help you achieve your goals? (100-200 words)",
    "Describe your most significant community contribution. (150-250 words)",
    "Why should you be selected for this scholarship? (100-200 words)"
  ];

  const matchedScholarships = scholarshipDB.filter(s => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.criteria.toLowerCase().includes(q) || (s.amount||"").toLowerCase().includes(q);
    const matchesNeed = filterNeedBased === "all" || (filterNeedBased === "need" && s.needBased === "Y") || (filterNeedBased === "merit" && s.needBased !== "Y");
    const sc = s.country || "US";
    const matchesCountry =
      filterCountry === "all" ||
      sc === filterCountry ||
      // "BOTH"-tagged scholarships show when filtering US or CA
      (sc === "BOTH" && (filterCountry === "US" || filterCountry === "CA")) ||
      // "US + Canada" filter shows only scholarships tagged BOTH
      (filterCountry === "BOTH" && sc === "BOTH");
    // Optional state filter: national scholarships (no state) ALWAYS show — a student
    // considering schools elsewhere still wants those. Picking a state adds that
    // state's scholarships on top; it never hides the national ones.
    const matchesState = filterState === "all" || !s.state || s.state === filterState;
    return matchesSearch && matchesNeed && matchesCountry && matchesState;
  });

  // States that actually have scholarships in the DB (auto-grows as data is added)
  // Restrict the state filter to real US jurisdictions — the data also carries
  // Canadian province codes (e.g. "ON") that must not leak into "All States".
  const US_STATE_CODES = new Set(["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","PR","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"]);
  const availableStates = [...new Set(scholarshipDB.map(s => s.state).filter(s => s && US_STATE_CODES.has(s)))].sort();

  // Country flag helper — uses Flagpedia CDN for crisp flag images
  const CountryFlag = ({ country }) => {
    const flags = {
      US: { code: "us", label: "US", bg: "#1a3a5c", border: "#2a5a8c" },
      CA: { code: "ca", label: "Canada", bg: "#5c1a1a", border: "#8c2a2a" },
      BOTH: { label: "US + CA", bg: "#3a2a5c", border: "#5a4a7c" },
    };
    const f = flags[country] || flags.US;
    const flagImg = (code) => (
      <img src={`https://flagcdn.com/w40/${code}.png`} alt={code.toUpperCase()} style={{ height: 12, borderRadius: 1, verticalAlign: "middle" }} />
    );
    return (
      <span style={{
        fontSize: 10, fontFamily: FONTS.body, padding: "3px 8px", borderRadius: 5,
        background: f.bg, border: `1px solid ${f.border}`, color: "#fff",
        whiteSpace: "nowrap", letterSpacing: 0.5, display: "inline-flex", alignItems: "center", gap: 5,
      }}>
        {country === "BOTH" ? <>{flagImg("us")}{flagImg("ca")}</> : flagImg(f.code)}
        <span>{f.label}</span>
      </span>
    );
  };

  // Deadline helpers (shared logic in src/lib/deadline.js; colours mapped here).
  const parseDeadlineDate = (deadline) => parseDeadlineDateLib(deadline);
  const TONE_COLORS = { closed: COLORS.textDim, urgent: COLORS.urgentText, soon: COLORS.gold, open: COLORS.teal, undated: COLORS.textDim };
  const parseDeadline = (deadline) => {
    const info = deadlineInfo(deadline);
    return { ...info, color: TONE_COLORS[info.tone] };
  };
  const getDeadlineStatus = (deadline) => parseDeadline(deadline);

  // Deadline-aware ordering + expiry filter. Defined here (not with the other
  // filters above) because it depends on the deadline parsers declared just above.
  // Order: soonest live deadline first, then undated ("Varies"/"Rolling"), then
  // expired last — an expired listing should never be the first thing a student sees.
  const expiredCount = matchedScholarships.filter(s => {
    const days = parseDeadline(s.deadline).days;
    return days !== null && days < 0;
  }).length;

  const filteredScholarships = matchedScholarships
    .filter(s => {
      if (showExpired) return true;
      const days = parseDeadline(s.deadline).days;
      return days === null || days >= 0;
    })
    .sort((a, b) => compareByDeadline(a, b));

  // Landing / dashboard numbers come from the live catalog only. Until it loads,
  // the UI shows placeholders, never the 30 built-in fallbacks as a count.
  const catalogReady = dbSource === "synced";
  const catalogStats = catalogReady ? computeCatalogStats(scholarshipDB) : null;
  const catalogCount = catalogReady ? scholarshipDB.length.toLocaleString() : null;
  const lastCheckedLabel = catalogStats?.lastChecked
    ? catalogStats.lastChecked.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;

  // Keep work across reloads.
  useEffect(() => { store.set("scholarbot-brag-sheet", bragSheet); }, [bragSheet]);
  useEffect(() => { if (!generatingLetter) store.set("scholarbot-draft", generatedLetter); }, [generatedLetter, generatingLetter]);
  useEffect(() => { setBrowseLimit(24); }, [searchQuery, filterNeedBased, filterCountry, filterState, showExpired]);

  const navItems = [
    {group:"Plan"},
    {id:"home",icon:"home",label:"Home"},
    {id:"profile",icon:"profile",label:"My Profile"},
    {id:"matches",icon:"matches",label:"My Matches"},
    {id:"search",icon:"search",label:"Find Scholarships"},
    {group:"Write"},
    {id:"generate",icon:"generate",label:"Write a Letter"},
    {id:"saved",icon:"saved",label:"Saved Letters"},
    {id:"apply",icon:"apply",label:"Practice Answers"},
    {id:"templates",icon:"templates",label:"Writing Styles"},
    {group:"Track"},
    {id:"tracker",icon:"calendar",label:"My Deadlines"},
  ];

  const isLanding = view === "landing";
  // Shared "#pricing" links (e.g. the parent hand-off) scroll to the plans.
  useEffect(() => {
    if (isLanding && window.location.hash === "#pricing") {
      setTimeout(() => document.getElementById("pricing")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" }), 300);
    }
  }, [isLanding]);

  // Source-link health from the monthly re-check (api/refresh-expired.js).
  const LinkCheck = ({ s }) => {
    const st = s.linkStatus || "";
    if (st === "dead" || st === "invalid") return <Badge color={COLORS.urgentText}>Source page gone: verify first</Badge>;
    if (st.startsWith("unreachable")) return <Badge color={COLORS.gold}>Couldn't reach source: verify first</Badge>;
    if (s.linkVerifiedAt) return <Badge color={COLORS.textMuted}>Link checked {new Date(s.linkVerifiedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</Badge>;
    return null;
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div style={{ fontFamily: FONTS.heading, minHeight: "100vh", background: COLORS.bg, color: COLORS.text, overflowX: "clip" }}>

      {/* NOTIFICATION TOAST */}
      {notification && (
        <div role="status" aria-live="polite" style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999, maxWidth: "calc(100vw - 40px)",
          padding: "14px 24px", borderRadius: 12,
          fontFamily: FONTS.body, fontSize: 14, fontWeight: 600,
          background: notification.type === "error" ? COLORS.pink : notification.type === "success" ? COLORS.teal : COLORS.gold,
          color: COLORS.bg,
          boxShadow: `0 8px 32px ${notification.type === "error" ? COLORS.pinkDim : COLORS.goldGlow}`,
          animation: "toastIn 0.4s cubic-bezier(0.34,1.56,0.64,1)",
        }}>
          {notification.msg}
        </div>
      )}

      {/* AUTH MODAL */}
      <Modal open={showAuthModal} onClose={() => setShowAuthModal(false)} locked={authMode === "reset"} labelledBy="auth-title" width={400}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><BrandMark size={30} /></div>
              <h2 id="auth-title" style={{ fontSize: 24, fontWeight: 400, marginBottom: 6 }}>
                {authMode === "signup" ? "Create your free account" : authMode === "forgot" ? "Reset your password" : authMode === "reset" ? "Set a new password" : "Welcome back"}
              </h2>
              <p style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted }}>
                {authMode === "signup" ? "Save your matches, drafts and deadlines" : authMode === "forgot" ? "We'll email you a reset link" : authMode === "reset" ? "Choose a new password for your account" : "Sign in to pick up where you left off"}
              </p>
            </div>

            {authError && (
              <div role="alert" style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13, fontFamily: FONTS.body, background: COLORS.pinkDim, color: COLORS.text, border: `1px solid ${COLORS.pink}66`, textAlign: "left" }}>
                {authError}
              </div>
            )}

            <form onSubmit={e => { e.preventDefault(); (authMode === "reset" ? handleUpdatePassword : authMode === "forgot" ? handleForgotPassword : authMode === "signup" ? handleSignUp : handleSignIn)(); }}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {authMode === "reset" ? (
                <>
                  <div>
                    <label htmlFor="auth-newpw" style={{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, display: "block", marginBottom: 6, textAlign: "left" }}>New password (at least 6 characters)</label>
                    <input id="auth-newpw" type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ padding: "12px 16px", borderRadius: 10, fontSize: 14, fontFamily: FONTS.body, background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, color: COLORS.text, outline: "none", width: "100%", boxSizing: "border-box" }}/>
                  </div>
                  <div>
                    <label htmlFor="auth-confirmpw" style={{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, display: "block", marginBottom: 6, textAlign: "left" }}>Confirm new password</label>
                    <input id="auth-confirmpw" type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={{ padding: "12px 16px", borderRadius: 10, fontSize: 14, fontFamily: FONTS.body, background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, color: COLORS.text, outline: "none", width: "100%", boxSizing: "border-box" }}/>
                  </div>
                  <Button type="submit" disabled={authSubmitting || !newPassword || !confirmPassword}
                    style={{ width: "100%", justifyContent: "center", fontSize: 15, padding: "14px 24px", marginTop: 4 }}>
                    {authSubmitting ? "Please wait..." : "Update password"}
                  </Button>
                </>
              ) : (
                <>
                  <div>
                    <label htmlFor="auth-email" style={{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, display: "block", marginBottom: 6, textAlign: "left" }}>Email</label>
                    <input id="auth-email" type="email" autoComplete="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} style={{ padding: "12px 16px", borderRadius: 10, fontSize: 14, fontFamily: FONTS.body, background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, color: COLORS.text, outline: "none", width: "100%", boxSizing: "border-box" }}/>
                  </div>
                  {authMode !== "forgot" && (
                    <div>
                      <label htmlFor="auth-password" style={{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, display: "block", marginBottom: 6, textAlign: "left" }}>Password{authMode === "signup" ? " (at least 6 characters)" : ""}</label>
                      <input id="auth-password" type="password" autoComplete={authMode === "signup" ? "new-password" : "current-password"} value={authPassword} onChange={e => setAuthPassword(e.target.value)} style={{ padding: "12px 16px", borderRadius: 10, fontSize: 14, fontFamily: FONTS.body, background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, color: COLORS.text, outline: "none", width: "100%", boxSizing: "border-box" }}/>
                    </div>
                  )}
                  {authMode === "signup" && (
                    <div>
                      <label htmlFor="auth-dob" style={{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, display: "block", marginBottom: 6, textAlign: "left" }}>Date of birth (only to confirm you're 13 or older; never stored)</label>
                      <input id="auth-dob" type="date" value={authDob} onChange={e => setAuthDob(e.target.value)} max={new Date().toISOString().split("T")[0]} style={{ padding: "12px 16px", borderRadius: 10, fontSize: 14, fontFamily: FONTS.body, background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, color: COLORS.text, outline: "none", width: "100%", boxSizing: "border-box" }}/>
                    </div>
                  )}
                  {authMode === "signup" && (
                    <p style={{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.5, margin: 0, textAlign: "left" }}>
                      By creating an account, you agree to our{" "}
                      <LinkButton onClick={() => setLegalModal("terms")}>Terms of Service</LinkButton>
                      {" "}and{" "}
                      <LinkButton onClick={() => setLegalModal("privacy")}>Privacy Policy</LinkButton>.
                    </p>
                  )}
                  <Button type="submit" disabled={authSubmitting || !authEmail}
                    style={{ width: "100%", justifyContent: "center", fontSize: 15, padding: "14px 24px", marginTop: 4 }}>
                    {authSubmitting ? "Please wait..." : authMode === "signup" ? "Create account" : authMode === "forgot" ? "Send reset link" : "Sign in"}
                  </Button>
                </>
              )}
            </form>

            <div style={{ marginTop: 20, textAlign: "center", fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              {authMode === "signin" && (
                <>
                  <LinkButton onClick={() => { setAuthMode("forgot"); setAuthError(""); }}>Forgot password?</LinkButton>
                  <span aria-hidden="true">|</span>
                  <span>No account? <LinkButton onClick={() => { setAuthMode("signup"); setAuthError(""); }}>Sign up</LinkButton></span>
                </>
              )}
              {authMode === "signup" && (
                <span>Already have an account? <LinkButton onClick={() => { setAuthMode("signin"); setAuthError(""); setAuthDob(""); }}>Sign in</LinkButton></span>
              )}
              {authMode === "forgot" && (
                <LinkButton onClick={() => { setAuthMode("signin"); setAuthError(""); }}>Back to sign in</LinkButton>
              )}
              {authMode === "reset" && (
                <span style={{ fontSize: 12 }}>Enter your new password above to finish the reset.</span>
              )}
            </div>
      </Modal>

      {/* LEGAL MODAL (Privacy Policy / Terms of Service) */}
      <Modal open={!!legalModal} onClose={() => setLegalModal(null)} labelledBy="legal-title" width={660} align="left">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontFamily: FONTS.body, letterSpacing: 3, color: COLORS.gold, textTransform: "uppercase", marginBottom: 4 }}>MeritLaunch</div>
                <h2 id="legal-title" style={{ fontSize: 24, fontWeight: 400, margin: 0 }}>
                  {legalModal === "privacy" ? "Privacy Policy" : "Terms of Service"}
                </h2>
                <p style={{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.textDim, marginTop: 6 }}>Last updated {LAST_UPDATED}</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setLegalModal(null)} style={{
                background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", padding: 8, minWidth: 40, minHeight: 40,
              }}><AppIcon name="close" size={20} /></button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              {(legalModal === "privacy" ? PRIVACY_SECTIONS : TERMS_SECTIONS).map((section, i) => (
                <div key={i}>
                  <h3 style={{ fontSize: 14, fontFamily: FONTS.body, fontWeight: 600, color: COLORS.teal, marginBottom: 8 }}>
                    {section.heading}
                  </h3>
                  <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                    {section.body.map((line, j) => (
                      <li key={j} style={{ fontSize: 13.5, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6 }}>
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.textDim, marginTop: 28, paddingTop: 16, borderTop: `1px solid ${COLORS.border}` }}>
              This is general information, not legal advice, and may be updated as MeritLaunch changes.
            </p>
      </Modal>

      {/* UPGRADE MODAL — shows the student's own live matches, both plans, and a
          no-data link they can send to a parent (the payer is often not the student). */}
      <Modal open={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} labelledBy="upgrade-title" width={480}>
        {(() => {
          const kind = upgradeReason?.kind;
          const resets = upgradeReason?.resetsOn ? new Date(upgradeReason.resetsOn).toLocaleDateString("en-US", { month: "long", day: "numeric" }) : null;
          const live = matchResults.filter(m => { const d = parseDeadline(m.deadline).days; return d !== null && d >= 0; })
            .sort((a, b) => parseDeadline(a.deadline).days - parseDeadline(b.deadline).days).slice(0, 3);
          const shareUrl = "https://meritlaunch.com/#pricing";
          const sendToParent = async () => {
            track("parent_link_shared");
            const text = "Can you look at MeritLaunch for my scholarship applications? Plans are here:";
            try {
              if (navigator.share) { await navigator.share({ title: "MeritLaunch plans", text, url: shareUrl }); return; }
              await navigator.clipboard.writeText(`${text} ${shareUrl}`);
              notify("Link copied. Send it to a parent or guardian.", "success");
            } catch { notify(`Share this link: ${shareUrl}`, "info"); }
          };
          return (
            <>
              <h2 id="upgrade-title" style={{ fontSize: 24, fontWeight: 400, marginBottom: 8 }}>
                {kind === "letter" ? `You've used your ${FREE_LIMITS.lettersPerMonth} free letters this month` : kind === "match" ? `You've used your ${FREE_LIMITS.matchesPerMonth} free match runs this month` : "Keep going with Premium"}
              </h2>
              <p style={{ fontSize: 14, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 16 }}>
                {resets ? `Your free allowance resets on ${resets}. ` : ""}Your profile, matches, drafts and tracker all stay put either way.
              </p>
              {live.length > 0 && (
                <div style={{ textAlign: "left", background: COLORS.surface, borderRadius: 12, padding: "14px 16px", marginBottom: 16, border: `1px solid ${COLORS.border}` }}>
                  <div style={{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 8 }}>Your next deadlines that still need a letter</div>
                  {live.map(m => (
                    <div key={m.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, fontFamily: FONTS.body, padding: "4px 0" }}>
                      <span style={{ color: COLORS.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                      <span style={{ color: parseDeadline(m.deadline).color, flexShrink: 0 }}>{parseDeadline(m.deadline).label}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }} className="two-col">
                {PLANS.filter(pl => pl.id !== "free").map(pl => (
                  <div key={pl.id} style={{ background: COLORS.surface, borderRadius: 12, padding: "14px 12px", border: `1px solid ${pl.highlight ? COLORS.gold + "66" : COLORS.border}`, textAlign: "left" }}>
                    <div style={{ fontSize: 12, fontFamily: FONTS.body, color: pl.highlight ? COLORS.gold : COLORS.teal, fontWeight: 600 }}>{pl.name}</div>
                    <div style={{ fontSize: 24, margin: "4px 0" }}>{pl.price}<span style={{ fontSize: 12, color: COLORS.textMuted, fontFamily: FONTS.body }}>{pl.period}</span></div>
                    <div style={{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.5, marginBottom: 10 }}>{pl.tagline}</div>
                    <Button variant={pl.highlight ? "primary" : "secondary"} disabled={checkoutLoading}
                      onClick={() => { setShowUpgradeModal(false); handleCheckout(pl.id); }}
                      style={{ width: "100%", justifyContent: "center", fontSize: 13, padding: "10px 12px" }}>
                      {checkoutLoading ? "Loading..." : pl.cta}
                    </Button>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <Button variant="ghost" onClick={sendToParent} style={{ fontSize: 13 }}>Send to a parent</Button>
                <Button variant="ghost" onClick={() => setShowUpgradeModal(false)} style={{ fontSize: 13 }}>Not now</Button>
              </div>
            </>
          );
        })()}
      </Modal>

      {/* ====== LANDING PAGE (Phase C) ====== */}
      {isLanding && (
        <div style={{ minHeight: "100vh" }}>
          {/* Landing Nav */}
          <nav className="landing-nav" style={{
            position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
            padding: "16px 40px", display: "flex", justifyContent: "space-between", alignItems: "center",
            background: "rgba(8,8,13,0.85)", backdropFilter: "blur(20px)",
            borderBottom: `1px solid ${COLORS.border}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <BrandMark size={28} />
              <span style={{ fontSize: 13, fontFamily: FONTS.body, letterSpacing: 3, color: COLORS.gold, textTransform: "uppercase" }}>MeritLaunch</span>
            </div>
            <div className="landing-nav-buttons" style={{ display: "flex", gap: 12 }}>
              {authUser ? (
                <>
                  <Button variant="ghost" onClick={handleSignOut} style={{ fontSize: 13, padding: "8px 16px" }}>Sign Out</Button>
                  <Button onClick={() => setView("home")} style={{ fontSize: 13, padding: "8px 20px" }}>Dashboard</Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => { setAuthMode("signin"); setShowAuthModal(true); }} style={{ fontSize: 13, padding: "8px 16px" }}>Sign In</Button>
                  <Button onClick={() => setView("profile")} style={{ fontSize: 13, padding: "8px 20px" }}>Get Started Free</Button>
                </>
              )}
            </div>
          </nav>

          {/* Hero with Video Background */}
          <div style={{
            position: "relative", overflow: "hidden",
            padding: "160px 40px 80px", textAlign: "center",
            minHeight: "85vh", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
          }}>
            {/* Background: video on desktop when motion is welcome; a still otherwise.
                Phones never request the video file. */}
            {!isMobile && !reducedMotion ? (
              <video autoPlay muted loop playsInline preload="none" poster="/hero-poster.jpg" aria-hidden="true"
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0, opacity: 0.35 }}>
                <source src="/hero-bg-small.mp4" type="video/mp4" />
              </video>
            ) : (
              <div aria-hidden="true" style={{
                position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                backgroundImage: "url(/hero-poster.jpg)", backgroundSize: "cover", backgroundPosition: "center",
                opacity: 0.35, zIndex: 0,
              }} />
            )}
            {/* Dark gradient overlay for text readability */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1,
              background: `linear-gradient(180deg, rgba(8,8,13,0.7) 0%, rgba(8,8,13,0.4) 40%, rgba(8,8,13,0.8) 100%), radial-gradient(ellipse 80% 50% at 50% -10%, ${COLORS.goldDim}, transparent)`,
            }} />
            {/* Hero Content */}
            <div style={{ position: "relative", zIndex: 2 }}>
              <div style={{
                fontSize: 11, fontFamily: FONTS.body, letterSpacing: 4, color: COLORS.gold,
                textTransform: "uppercase", marginBottom: 20,
              }}>
                AI-Powered Scholarship Matching
              </div>
              <h1 className="landing-hero-title" style={{
                fontSize: 64, fontWeight: 400, lineHeight: 1.08, marginBottom: 20,
                maxWidth: 720, margin: "0 auto 20px",
              }}>
                <span style={{ color: COLORS.text }}>Your Story Is the Application.</span><br/>
                <span style={{
                  background: `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.goldLight})`,
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}>We Just Help You Tell It.</span>
              </h1>
              <p className="landing-hero-subtitle" style={{
                fontSize: 18, fontFamily: FONTS.body, color: COLORS.textMuted,
                maxWidth: 560, margin: "0 auto 40px", lineHeight: 1.6,
              }}>
                Find scholarships you're actually eligible for, and draft letters from your real story that you revise and send as your own. Built by a parent who's been where you are.
              </p>
              <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
                <Button onClick={() => setView("profile")} style={{ fontSize: 16, padding: "16px 36px" }}>
                  Start Free
                </Button>
                <Button variant="secondary" onClick={() => setView("search")} style={{ fontSize: 16, padding: "16px 36px" }}>
                  {catalogCount ? `Browse ${catalogCount} Scholarships` : "Browse Scholarships"}
                </Button>
              </div>
            </div>
          </div>

          {/* Catalog strip: computed from the live data (src/lib/catalogStats.js).
              Skeletons until it loads; never the 30 built-in fallbacks or a made-up date. */}
          <div className="landing-stats-grid reveal" aria-live="polite" style={{
            display: "flex", justifyContent: "center", gap: 48, padding: "32px 20px",
            borderTop: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}`,
            flexWrap: "wrap",
          }}>
            {[
              { val: catalogCount, label: "Scholarships tracked" },
              { val: catalogStats ? formatAwardTotal(catalogStats.totalAwards) : null, label: "In listed award amounts" },
              { val: catalogReady ? (lastCheckedLabel || "Monthly") : null, label: lastCheckedLabel ? "Listings last checked" : "Listing checks" },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: "center", minWidth: 120 }}>
                {s.val ? (
                  <div style={{ fontSize: 28, fontWeight: 400, color: COLORS.gold, fontFamily: FONTS.heading }}>{s.val}</div>
                ) : (
                  <div aria-hidden="true" className="skeleton" style={{ height: 34, width: 96, margin: "0 auto", borderRadius: 6 }} />
                )}
                <div style={{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Feature Pillars */}
          <div style={{ padding: "80px 40px", maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <h2 style={{ fontSize: 36, fontWeight: 400, marginBottom: 10 }}>How MeritLaunch Works</h2>
              <p style={{ fontSize: 15, fontFamily: FONTS.body, color: COLORS.textMuted }}>Three steps to scholarship-ready applications</p>
            </div>
            <div className="landing-steps-grid reveal" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
              {[
                { icon: "profile", title: "Build Your Profile", desc: "Answer guided questions or upload your brag sheet. MeritLaunch learns your story, strengths, and goals.", color: COLORS.gold },
                { icon: "matches", title: "Get Matched", desc: "We check eligibility first (citizenship, state, GPA, heritage), then rank what fits you, with every deadline shown.", color: COLORS.teal },
                { icon: "generate", title: "Draft, Then Make It Yours", desc: "Pick a writing style and get a draft built only from your real details. You revise it and send it as your own.", color: COLORS.teal },
              ].map((f, i) => (
                <GlowCard key={i} glow={f.color} style={{ textAlign: "center", padding: "40px 28px" }}>
                  <AppIcon name={f.icon} size={38} color={f.color} strokeWidth={1.4} style={{ margin: "0 auto 16px" }} />
                  <div style={{ fontSize: 12, fontFamily: FONTS.body, color: f.color, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Step {i + 1}</div>
                  <h3 style={{ fontSize: 20, fontWeight: 400, marginBottom: 10 }}>{f.title}</h3>
                  <p style={{ fontSize: 14, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6 }}>{f.desc}</p>
                </GlowCard>
              ))}
            </div>
          </div>

          {/* Live letter demo — the product's signature moment, on the marketing page */}
          <div style={{ padding: "80px 40px", textAlign: "center" }}>
            <h2 style={{ fontSize: 30, fontWeight: 400, marginBottom: 8 }}>You Stay the Author</h2>
            <p style={{ fontSize: 14, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 36, maxWidth: 520, marginLeft: "auto", marginRight: "auto" }}>
              Watch a draft take shape from one student's real details. Nothing invented, no stock phrases. A starting point the student revises into their own letter.
            </p>
            <div className="reveal"><LetterDemo /></div>
          </div>

          {/* Origin Story — editorial spread */}
          <div style={{ padding: "80px 40px", background: COLORS.surface }}>
            <div style={{ maxWidth: 1040, margin: "0 auto" }}>
              <h2 style={{ fontSize: 30, fontWeight: 400, textAlign: "center", marginBottom: 12 }}>We've Been Where You Are</h2>
              <p style={{ textAlign: "center", fontFamily: FONTS.body, fontSize: 14, color: COLORS.textDim, marginBottom: 40 }}>A real story from the parent who built this tool</p>
              <div className="landing-story-grid reveal" style={{ display: "grid", gridTemplateColumns: "5fr 7fr", alignItems: "stretch" }}>
                <div className="landing-story-image" style={{ position: "relative", minHeight: 340 }}>
                  <img src="/story-still.jpg" alt="A student working at a kitchen table in the evening" loading="lazy" style={{
                    position: "absolute", inset: 0, width: "100%", height: "100%",
                    objectFit: "cover", borderRadius: "14px 0 0 14px", filter: "saturate(0.85)",
                  }} />
                  <div style={{
                    position: "absolute", inset: 0, borderRadius: "14px 0 0 14px",
                    background: "linear-gradient(200deg, rgba(8,8,13,0.15) 0%, rgba(8,8,13,0.82) 100%)",
                  }} />
                  <div style={{
                    position: "absolute", left: 26, right: 26, bottom: 26,
                    fontFamily: FONTS.heading, fontStyle: "italic", fontSize: 27, lineHeight: 1.35, color: COLORS.text,
                  }}>
                    "It was like applying to college 40 more times."
                  </div>
                </div>
              <GlowCard hover={false} glow={COLORS.gold} style={{ padding: "40px 36px", borderRadius: "0 14px 14px 0" }}>
                <div style={{ fontSize: 17, fontFamily: FONTS.heading, color: COLORS.textMuted, lineHeight: 1.7, fontStyle: "italic" }}>
                  <p style={{ marginBottom: 16 }}>
                    "It was the fall of their senior year, and my kids were running on fumes. They were carrying full loads of advanced coursework. Multiple AP classes, college-level engineering. Just about honors everything."
                  </p>
                  <p style={{ marginBottom: 16 }}>
                    "Then scholarship season hit. Suddenly we weren't just a family getting through the school year. We were a small, overwhelmed operation. The kitchen table disappeared under stacks of printed applications. We tracked deadlines on a spreadsheet while I proofread essays at midnight."
                  </p>
                  <p style={{ marginBottom: 16 }}>
                    "We found dozens of scholarships they qualified for. But each one needed a tailored application. Unique essays. Specific formatting. Different portals. It was like applying to college 40 more times."
                  </p>
                  <p style={{ marginBottom: 16 }}>
                    "My children did it. They finished strong in their coursework AND submitted every application. I'm proud of that. But I watched the cost. The late nights. The stress of choosing between studying for an exam and polishing a scholarship letter."
                  </p>
                  <p style={{ marginBottom: 0 }}>
                    "I kept thinking: what if they could have focused on what mattered most — their ideas, their story, their voice — and let a tool handle the rest? That's why MeritLaunch exists. Not to replace the student. To give them back their time."
                  </p>
                </div>
                <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.goldLight})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: COLORS.bg, fontWeight: 700 }}>
                    CS
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, fontFamily: FONTS.body, color: COLORS.gold }}>Corey S.</div>
                    <div style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.textDim }}>Parent and creator of MeritLaunch</div>
                  </div>
                </div>
              </GlowCard>
              </div>
            </div>
          </div>

          {/* Pricing — rendered from src/lib/plans.js, the same numbers the server enforces */}
          <div id="pricing" style={{ padding: "80px 40px", textAlign: "center", scrollMarginTop: 80 }}>
            <h2 style={{ fontSize: 30, fontWeight: 400, marginBottom: 8 }}>Simple, Transparent Pricing</h2>
            <p style={{ fontSize: 14, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 40 }}>Start free. Upgrade only if you want more for a full application season.</p>
            <div className="landing-pricing-grid reveal" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, maxWidth: 940, margin: "0 auto" }}>
              {PLANS.map(pl => {
                const accent = pl.id === "premium" ? COLORS.gold : pl.id === "seasonal" ? COLORS.teal : COLORS.textMuted;
                const go = () => pl.id === "free" ? setView("profile")
                  : authUser ? handleCheckout(pl.id) : (setAuthMode("signup"), setShowAuthModal(true));
                return (
                  <GlowCard key={pl.id} hover={false} glow={accent} style={{
                    padding: "32px 24px", textAlign: "left", display: "flex", flexDirection: "column",
                    ...(pl.highlight ? { border: `2px solid ${COLORS.gold}55`, boxShadow: `0 0 40px ${COLORS.goldGlow}` } : {}),
                  }}>
                    <div style={{ fontSize: 13, fontFamily: FONTS.body, fontWeight: 600, color: accent, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>{pl.name}</div>
                    <div style={{ fontSize: 36, fontWeight: 400, marginBottom: 4 }}>{pl.price}<span style={{ fontSize: 14, color: COLORS.textMuted }}>{pl.period}</span></div>
                    <div style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 22, lineHeight: 1.5 }}>{pl.tagline}</div>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                      {pl.features.map(f => (
                        <li key={f} style={{ display: "flex", gap: 8, fontSize: 13, fontFamily: FONTS.body, color: f.endsWith("plus:") ? accent : COLORS.textMuted, lineHeight: 1.45 }}>
                          <AppIcon name="check" size={15} color={accent} style={{ marginTop: 2 }} />{f}
                        </li>
                      ))}
                    </ul>
                    <Button variant={pl.highlight ? "primary" : "secondary"} disabled={checkoutLoading && pl.id !== "free"} onClick={go}
                      style={{ width: "100%", justifyContent: "center", marginTop: 24, ...(pl.id === "seasonal" ? { borderColor: COLORS.teal + "55", color: COLORS.teal } : {}) }}>
                      {checkoutLoading && pl.id !== "free" ? "Loading..." : pl.cta}
                    </Button>
                  </GlowCard>
                );
              })}
            </div>
          </div>

          {/* CTA */}
          <div style={{
            padding: "80px 40px", textAlign: "center",
            background: `radial-gradient(ellipse 60% 40% at 50% 100%, ${COLORS.goldDim}, transparent)`,
          }}>
            <h2 style={{ fontSize: 40, fontWeight: 400, marginBottom: 12 }}>Ready to Fund Your Future?</h2>
            <p style={{ fontSize: 16, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 32 }}>
              Your story is the application. Build your profile in under 10 minutes and start today.
            </p>
            <Button onClick={() => setView("profile")} style={{ fontSize: 16, padding: "16px 40px" }}>
              Get Started Free
            </Button>
          </div>

          {/* Footer */}
          <footer className="landing-footer" style={{
            padding: "24px 40px", borderTop: `1px solid ${COLORS.border}`,
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap",
            fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted,
          }}>
            <span>MeritLaunch © 2026. Not to replace the student. To give them back their time.</span>
            <span style={{ display: "flex", gap: 14 }}>
              <LinkButton onClick={() => setLegalModal("privacy")} style={{ color: COLORS.textMuted, padding: "10px 4px" }}>Privacy</LinkButton>
              <LinkButton onClick={() => setLegalModal("terms")} style={{ color: COLORS.textMuted, padding: "10px 4px" }}>Terms</LinkButton>
            </span>
            {catalogCount && <span>{catalogCount} scholarships · {formatAwardTotal(catalogStats.totalAwards)} in listed awards</span>}
          </footer>
        </div>
      )}

      {/* ====== APP SHELL (non-landing) ====== */}
      {!isLanding && (
        <>
          {/* Mobile hamburger */}
          <button type="button" className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu" aria-expanded={mobileMenuOpen} aria-controls="app-sidebar" style={{
            display: "none", position: "fixed", top: 10, left: 10, zIndex: 200, minWidth: 44, minHeight: 44,
            background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10,
            padding: 10, color: COLORS.text, cursor: "pointer",
          }}><AppIcon name={mobileMenuOpen ? "close" : "menu"} size={22} /></button>

          {/* SIDEBAR */}
          <nav id="app-sidebar" aria-label="App" {...(isMobile && !mobileMenuOpen ? { inert: "" } : {})} className={`app-sidebar${mobileMenuOpen ? " open" : ""}`} style={{
            position: "fixed", left: 0, top: 0, bottom: 0, width: 240,
            background: COLORS.surface, borderRight: `1px solid ${COLORS.border}`,
            display: "flex", flexDirection: "column", zIndex: 100,
            transition: "transform 0.3s",
          }}>
            {/* Logo */}
            <div style={{ padding: "24px 20px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
              <button type="button" onClick={() => { setView("landing"); setMobileMenuOpen(false); }} aria-label="MeritLaunch home page"
                style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                <BrandMark size={26} />
                <span style={{ fontSize: 12, fontFamily: FONTS.body, letterSpacing: 3, color: COLORS.gold, textTransform: "uppercase" }}>MeritLaunch</span>
              </button>
              <div style={{ fontSize: 11, fontFamily: FONTS.body, color: COLORS.textMuted, marginTop: 6 }}>
                {catalogCount ? `${catalogCount} scholarships` : "Loading scholarships..."}
              </div>
            </div>

            {/* Nav Items */}
            <div style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
              {navItems.map((item, idx) => {
                if (item.group) return (
                  <div key={`g-${idx}`} style={{ padding: "14px 20px 4px", fontSize: 10, fontFamily: FONTS.body, letterSpacing: 2, textTransform: "uppercase", color: COLORS.textDim }}>{item.group}</div>
                );
                const active = view === item.id || (view === "profileResult" && item.id === "profile");
                return (
                  <button type="button" key={item.id} aria-current={active ? "page" : undefined} onClick={() => { setView(item.id); setMobileMenuOpen(false); }} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "11px 20px", minHeight: 44,
                    border: "none", width: "100%", textAlign: "left",
                    background: active ? `linear-gradient(90deg, ${COLORS.goldDim}, transparent)` : "transparent",
                    color: active ? COLORS.gold : COLORS.textMuted,
                    cursor: "pointer", fontSize: 13, fontFamily: FONTS.body,
                    borderLeft: active ? `2px solid ${COLORS.gold}` : "2px solid transparent",
                    transition: "all 0.2s",
                  }}>
                    <span style={{ opacity: active ? 1 : 0.7, width: 20, display: "flex", justifyContent: "center" }}><AppIcon name={item.icon} size={16} /></span>
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Landing link */}
            <button type="button" onClick={() => setView("landing")} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "12px 20px",
              border: "none", background: "transparent", color: COLORS.textDim,
              cursor: "pointer", fontSize: 12, fontFamily: FONTS.body,
              borderTop: `1px solid ${COLORS.border}`,
              width: "100%", textAlign: "left",
            }}>
              ← Back to Home
            </button>

            {/* User & Auth */}
            <div style={{ padding: "14px 20px", borderTop: `1px solid ${COLORS.border}`, fontSize: 12, fontFamily: FONTS.body }}>
              {authUser ? (
                <>
                  <div style={{ color: COLORS.textDim, marginBottom: 2 }}>Signed in as</div>
                  <div style={{ color: COLORS.gold, fontWeight: 600, marginBottom: 4 }}>{profile.name || authUser.email}</div>
                  {profile.name && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ background: COLORS.border, borderRadius: 3, height: 4, overflow: "hidden" }}>
                        <div style={{ background: COLORS.gold, height: "100%", width: `${profileCompletion}%`, transition: "width 0.4s", borderRadius: 3 }} />
                      </div>
                      <div style={{ fontSize: 10, color: COLORS.textDim, marginTop: 3 }}>{profileCompletion}% profile complete</div>
                    </div>
                  )}
                  {/* Usage stats */}
                  <div style={{ marginBottom: 8, padding: "8px 0", borderTop: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: COLORS.textDim, marginBottom: 4 }}>
                      <span>Match runs: {remainingMatches} left</span>
                      <span style={{ color: isPremium ? COLORS.teal : COLORS.textDim }}>{isPremium ? "PRO" : "Free"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: COLORS.textDim }}>
                      <span>Letters: {remainingLetters}{isPremium ? `/${PRO_LIMITS.lettersPerMonth}` : ""} left</span>
                      {!isPremium && <LinkButton onClick={() => openUpgrade(null)} style={{ fontSize: 11 }}>Upgrade</LinkButton>}
                    </div>
                  </div>
                  {isPremium && (
                    <button type="button" onClick={async () => {
                      track("portal_opened");
                      try {
                        const { data: prof } = await supabase.from("user_profiles").select("stripe_customer_id").eq("id", authUser.id).single();
                        if (prof?.stripe_customer_id) {
                          const resp = await authFetch("/api/customer-portal", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ customerId: prof.stripe_customer_id }),
                          });
                          const data = await resp.json();
                          if (data.url) window.location.href = data.url;
                        } else { notify("No billing account found.", "error"); }
                      } catch { notify("Could not open billing portal.", "error"); }
                    }} style={{
                      background: "transparent", border: `1px solid ${COLORS.gold}44`, color: COLORS.gold,
                      padding: "6px 12px", borderRadius: 6, fontSize: 10, fontFamily: FONTS.body,
                      cursor: "pointer", width: "100%", marginBottom: 8,
                    }}>Manage billing</button>
                  )}
                  <button onClick={handleSignOut} style={{
                    background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.textDim,
                    padding: "6px 12px", borderRadius: 6, fontSize: 11, fontFamily: FONTS.body,
                    cursor: "pointer", width: "100%",
                  }}>Sign Out</button>
                </>
              ) : (
                <>
                  <div style={{ color: COLORS.textDim, marginBottom: 6 }}>
                    {profile.name ? `Welcome, ${profile.name}` : "Sign in to save your work"}
                  </div>
                  <button onClick={() => { setAuthMode("signin"); setShowAuthModal(true); }} style={{
                    background: `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.goldLight})`,
                    border: "none", color: COLORS.bg, padding: "8px 12px", borderRadius: 6,
                    fontSize: 12, fontWeight: 700, fontFamily: FONTS.body, cursor: "pointer", width: "100%",
                  }}>Sign In / Sign Up</button>
                </>
              )}
            </div>
          </nav>

          {/* MAIN CONTENT */}
          {/* Mobile overlay */}
          {mobileMenuOpen && <div className="mobile-overlay" aria-hidden="true" onClick={() => setMobileMenuOpen(false)} style={{
            display: "none", position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 99,
          }} />}

          <div className="app-main" style={{ marginLeft: 240, minHeight: "100vh", padding: "36px 44px" }}>

            {/* ====== DASHBOARD ====== */}
            {view === "home" && (() => {
              const liveTracked = trackedApps
                .map(a => ({ ...a, dl: parseDeadline(a.deadline) }))
                .filter(a => a.dl.days !== null && a.dl.days >= 0 && !["submitted", "accepted", "rejected"].includes(a.status))
                .sort((a, b) => a.dl.days - b.dl.days);
              const liveMatches = matchResults
                .map(m => ({ ...m, dl: parseDeadline(m.deadline) }))
                .filter(m => m.dl.days !== null && m.dl.days >= 0 && !trackedApps.some(a => a.scholarshipId === m.id))
                .sort((a, b) => a.dl.days - b.dl.days);
              const draftFor = (id) => {
                const sch = scholarshipDB.find(x => x.id === id);
                if (sch) { setSelectedScholarship(sch); setScholarshipInputMode("database"); }
                setView("generate");
              };
              const next = !profile.ageOk || profileCompletion < 40
                ? { title: profileCompletion ? `Finish your profile (${profileCompletion}% done)` : "Start your profile", desc: "About 10 minutes. It's what makes your matches yours, and it's what every draft is built from.", cta: "Continue my profile", go: () => setView("profile") }
                : matchResults.length === 0
                ? { title: "See the scholarships you're eligible for", desc: "We check eligibility first (state, citizenship, GPA, heritage), then rank what fits you.", cta: "See my matches", go: runMatching }
                : liveTracked.length > 0
                ? { title: `Next deadline: ${liveTracked[0].name}`, desc: `Due ${liveTracked[0].dl.date.toLocaleDateString("en-US", { month: "long", day: "numeric" })}, ${liveTracked[0].dl.days} days from now. Start the letter this week.`, cta: "Draft this letter", go: () => draftFor(liveTracked[0].scholarshipId) }
                : liveMatches.length > 0
                ? { title: `Track your nearest match: ${liveMatches[0].name}`, desc: `Due ${liveMatches[0].dl.date.toLocaleDateString("en-US", { month: "long", day: "numeric" })}. Tracking it adds deadline reminders.`, cta: "Track it", go: () => trackApplication(liveMatches[0]) }
                : { title: "Draft your first letter", desc: "Pick any scholarship and get a draft built from your real details.", cta: "Write a letter", go: () => setView("generate") };
              return (
              <div>
                <SectionHeader
                  title={profile.name ? `Welcome back, ${profile.name.split(" ")[0]}` : "Your scholarship plan"}
                  subtitle="Here's the most useful thing to do next."
                />

                {/* Next step: one clear action, driven by where the student actually is */}
                <GlowCard hover={false} glow={COLORS.gold} style={{ padding: "24px 26px", marginBottom: 20, border: `1px solid ${COLORS.gold}55`, background: `linear-gradient(135deg, ${COLORS.goldDim}, ${COLORS.card} 60%)` }}>
                  <div style={{ fontSize: 11, fontFamily: FONTS.body, letterSpacing: 2, textTransform: "uppercase", color: COLORS.gold, marginBottom: 6 }}>Your next step</div>
                  <h2 style={{ fontSize: 24, fontWeight: 400, marginBottom: 6, textWrap: "balance" }}>{next.title}</h2>
                  <p style={{ fontSize: 14, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 16, maxWidth: 560 }}>{next.desc}</p>
                  <Button onClick={next.go}>{next.cta} →</Button>
                  {liveTracked.length > 1 && (
                    <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${COLORS.border}` }}>
                      <div style={{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 6 }}>Also coming up</div>
                      {liveTracked.slice(1, 4).map(a => (
                        <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, fontFamily: FONTS.body, padding: "3px 0" }}>
                          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                          <span style={{ color: a.dl.color, flexShrink: 0 }}>{a.dl.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </GlowCard>

                {/* Stats */}
                <div className="dash-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
                  {[
                    // Empty tiles coach toward their full state instead of shrugging "0".
                    { label: "Scholarships", value: catalogCount || "...", color: COLORS.gold, icon: "search", go: () => setView("search") },
                    { label: "Profile", value: profileCompletion + "%", color: COLORS.teal, icon: "profile", go: () => setView("profile"),
                      hint: profileCompletion === 0 ? "10 minutes unlocks matching" : profileCompletion < 100 ? "Finish to sharpen your matches" : null },
                    { label: "Matches", value: matchResults.length || "—", color: COLORS.gold, icon: "matches", go: () => matchResults.length ? setView("matches") : runMatching(),
                      hint: matchResults.length === 0 ? "Run your first match" : null },
                    { label: "Letters saved", value: savedLetters.length, color: COLORS.teal, icon: "saved", go: () => setView(savedLetters.length ? "saved" : "generate"),
                      hint: savedLetters.length === 0 ? "Your first draft is one click away" : null },
                  ].map((stat, i) => (
                    <GlowCard key={i} glow={stat.color} style={{ padding: 0, position: "relative", overflow: "hidden" }}>
                      <button type="button" onClick={stat.go} style={{ all: "unset", display: "block", width: "100%", boxSizing: "border-box", padding: "22px 20px", cursor: "pointer" }}>
                        <div style={{ position: "absolute", top: 14, right: 14, opacity: 0.2 }}><AppIcon name={stat.icon} size={28} color={stat.color} /></div>
                        <div style={{ fontSize: 32, fontWeight: 300, color: stat.color, marginBottom: 2, fontFamily: FONTS.heading }}>{stat.value}</div>
                        <div style={{ fontSize: 11, fontFamily: FONTS.body, color: COLORS.textMuted, letterSpacing: 1, textTransform: "uppercase" }}>{stat.label}</div>
                        {stat.hint && (
                          <div style={{ fontSize: 12, fontFamily: FONTS.body, color: stat.color, marginTop: 8 }}>{stat.hint} →</div>
                        )}
                      </button>
                    </GlowCard>
                  ))}
                </div>

                {/* Catalog status: real numbers only */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
                  background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10,
                  marginBottom: 28, fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted,
                }}>
                  <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: catalogReady ? COLORS.teal : COLORS.gold, flexShrink: 0 }} />
                  <span>
                    {catalogReady
                      ? `${catalogCount} scholarships${lastCheckedLabel ? ` · listings last checked ${lastCheckedLabel}` : ""} · closed listings are re-checked monthly for a new cycle`
                      : "Loading the latest scholarship list..."}
                  </span>
                </div>

                {/* Deadline Alerts */}
                {deadlineAlerts.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 400, marginBottom: 10, color: COLORS.text, fontFamily: FONTS.heading }}>Reminders</h2>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {deadlineAlerts.slice(0, 5).map(alert => (
                        <div key={alert.id} style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                          padding: "10px 16px", background: COLORS.surface, border: `1px solid ${COLORS.pink}55`,
                          borderRadius: 10, fontFamily: FONTS.body, fontSize: 13,
                        }}>
                          <span style={{ color: COLORS.text }}>{alert.title}</span>
                          <button type="button" onClick={async () => {
                            if (supabase) await supabase.from("notifications").update({ read: true }).eq("id", alert.id);
                            setDeadlineAlerts(prev => prev.filter(a => a.id !== alert.id));
                          }} style={{
                            background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 12, padding: "8px 4px",
                          }}>Dismiss</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Email reminders preference (the unsubscribe link in every email sets the same flag) */}
                {authUser && (
                  <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, cursor: "pointer" }}>
                    <input type="checkbox" checked={!emailOptOut} onChange={async (e) => {
                      const optOut = !e.target.checked;
                      setEmailOptOut(optOut);
                      const { error } = await supabase.from("user_profiles").update({ email_alerts_opt_out: optOut }).eq("id", authUser.id);
                      if (error) { setEmailOptOut(!optOut); notify("Couldn't save that setting. Please try again.", "error"); }
                      else notify(optOut ? "Email reminders turned off." : "Email reminders turned on.", "success");
                    }} style={{ width: 18, height: 18, accentColor: COLORS.gold }} />
                    Email me deadline reminders for scholarships I track
                  </label>
                )}
              </div>
              );
            })()}

            {/* ====== PROFILE BUILDER — COPPA block for under-13 visitors ====== */}
            {view === "profile" && isUnder13(profile) && (
              <div style={{ maxWidth: 560, margin: "60px auto", textAlign: "center" }}>
                <GlowCard hover={false} style={{ padding: "44px 36px" }}>
                  <AppIcon name="profile" size={40} color={COLORS.gold} style={{ margin: "0 auto 18px" }} />
                  <h2 style={{ fontSize: 26, fontWeight: 400, marginBottom: 12 }}>MeritLaunch is for students 13 and up</h2>
                  <p style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.textMuted, lineHeight: 1.7, marginBottom: 10 }}>
                    We didn't save anything you entered. Come back when you're 13, and we'll be ready for your story.
                  </p>
                  <p style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.textDim, lineHeight: 1.7, marginBottom: 24 }}>
                    A parent exploring ahead of time? You're welcome to browse the scholarship database — no account or profile needed.
                  </p>
                  <Button variant="secondary" onClick={() => setView("search")}>Browse Scholarships</Button>
                </GlowCard>
              </div>
            )}

            {/* ====== PROFILE BUILDER (Stepped Wizard) ====== */}
            {view === "profile" && !isUnder13(profile) && (
              <div>
                <SectionHeader title="My Profile" subtitle="Your answers drive your matches, and every letter draft is built only from them." />

                {/* Step Progress */}
                <div className="step-tabs" style={{ display: "flex", gap: 8, marginBottom: 32 }}>
                  {PROFILE_STEPS.map((s, i) => (
                    <button type="button" key={i} disabled={i > 0 && !profile.ageOk} aria-current={i === profileStep ? "step" : undefined}
                      onClick={() => setProfileStep(i)} style={{
                      opacity: i > 0 && !profile.ageOk ? 0.5 : 1,
                      flex: 1, padding: "12px 14px", borderRadius: 10, border: "none",
                      background: i === profileStep ? COLORS.goldDim : COLORS.surface,
                      borderBottom: i === profileStep ? `2px solid ${COLORS.gold}` : `2px solid transparent`,
                      cursor: "pointer", textAlign: "left", transition: "all 0.2s",
                    }}>
                      <div style={{ fontSize: 11, fontFamily: FONTS.body, color: i === profileStep ? COLORS.gold : COLORS.textMuted, fontWeight: 600, marginBottom: 2 }}>
                        Step {i + 1}
                      </div>
                      <div style={{ fontSize: 13, fontFamily: FONTS.body, color: i === profileStep ? COLORS.text : COLORS.textMuted }}>
                        {s.title}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Current Step Questions. On step 1 the age question comes first and
                    alone; nothing else is asked until it's answered 13+. */}
                <div className="two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
                  {PROFILE_QUESTIONS
                    .filter(q => q.step === profileStep)
                    .filter(q => profile.ageOk || q.type === "age")
                    .map(q => {
                    const id = `pq-${q.id}`;
                    const hintId = q.why ? `${id}-why` : undefined;
                    return (
                    <div key={q.id} style={{ gridColumn: q.type === "textarea" || q.type === "multiselect" ? "1 / -1" : "auto" }}>
                      {q.type === "multiselect"
                        ? <div id={`${id}-label`} style={{ display: "block", fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 8, fontWeight: 500 }}>{q.q}</div>
                        : <label htmlFor={id} style={{ display: "block", fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 8, fontWeight: 500 }}>{q.q}</label>}
                      {q.type === "age" && (profile.ageOk ? (
                        <div id={id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderRadius: 10, background: COLORS.tealDim, color: COLORS.text, fontSize: 14, fontFamily: FONTS.body }}>
                          <AppIcon name="check" size={16} color={COLORS.teal} /> Thanks, you're all set.
                        </div>
                      ) : (
                        <select id={id} aria-describedby={hintId} value="" onChange={e => {
                          const v = e.target.value;
                          if (!v) return;
                          if (yearIsUnder13(v)) saveProfile({ under13: true });
                          else saveProfile({ ...profile, ageOk: true });
                        }} style={{ width: "100%", padding: "12px 16px", background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, borderRadius: 10, color: COLORS.text, fontSize: 14, fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" }}>
                          <option value="">Select a year...</option>
                          {q.options.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ))}
                      {q.type === "text" && (
                        <input id={id} aria-describedby={hintId} value={profile[q.id] || ""} onChange={e => saveProfile({...profile, [q.id]: e.target.value})}
                          placeholder={q.placeholder} style={{ width: "100%", padding: "12px 16px", background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, borderRadius: 10, color: COLORS.text, fontSize: 14, fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" }}/>
                      )}
                      {q.type === "select" && (
                        <select id={id} aria-describedby={hintId} value={profile[q.id] || ""} onChange={e => saveProfile({...profile, [q.id]: e.target.value})}
                          style={{ width: "100%", padding: "12px 16px", background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, borderRadius: 10, color: COLORS.text, fontSize: 14, fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" }}>
                          <option value="">Select...</option>
                          {q.options.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      )}
                      {q.type === "multiselect" && (
                        <div role="group" aria-labelledby={`${id}-label`} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {q.options.map(o => {
                            const sel = (profile[q.id] || []).includes(o);
                            return (
                              <button type="button" key={o} aria-pressed={sel} onClick={() => {
                                const cur = profile[q.id] || [];
                                saveProfile({...profile, [q.id]: sel ? cur.filter(x => x !== o) : [...cur, o]});
                              }} style={{
                                padding: "10px 14px", borderRadius: 20, minHeight: 40,
                                border: sel ? `1px solid ${COLORS.gold}` : `1px solid ${COLORS.fieldBorder}`,
                                background: sel ? COLORS.goldDim : COLORS.surface,
                                color: sel ? COLORS.gold : COLORS.textMuted,
                                cursor: "pointer", fontSize: 13, fontFamily: FONTS.body,
                                display: "inline-flex", alignItems: "center", gap: 6,
                              }}>{sel && <AppIcon name="check" size={13} />}{o}</button>
                            );
                          })}
                        </div>
                      )}
                      {q.type === "textarea" && (
                        <textarea id={id} aria-describedby={hintId} value={profile[q.id] || ""} onChange={e => saveProfile({...profile, [q.id]: e.target.value})}
                          placeholder={q.placeholder} rows={4} style={{ ...{ width: "100%", padding: "12px 16px", background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, borderRadius: 10, color: COLORS.text, fontSize: 14, fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" }, resize: "vertical", lineHeight: 1.6 }}/>
                      )}
                      {q.why && <div id={hintId} style={{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, marginTop: 6 }}>{q.why}</div>}
                    </div>
                    );
                  })}
                </div>

                {/* Step Navigation */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
                  <Button variant="ghost" onClick={() => setProfileStep(Math.max(0, profileStep - 1))} disabled={profileStep === 0} aria-label="Previous step">
                    ← Previous
                  </Button>
                  <div style={{ display: "flex", gap: 6 }}>
                    {PROFILE_STEPS.map((_, i) => (
                      <div key={i} style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: i === profileStep ? COLORS.gold : i < profileStep ? COLORS.teal : COLORS.border,
                        transition: "all 0.3s",
                      }} />
                    ))}
                  </div>
                  {profileStep < PROFILE_STEPS.length - 1 ? (
                    <Button onClick={() => setProfileStep(profileStep + 1)} disabled={!profile.ageOk}>
                      Next →
                    </Button>
                  ) : (
                    <Button onClick={() => { track("profile_completed", { completion: profileCompletion }); runMatching(); }}>
                      See my matches →
                    </Button>
                  )}
                </div>

                {/* Brag Sheet */}
                <GlowCard hover={false} style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 400, marginBottom: 4 }}>
                        Your Brag Sheet <span style={{ color: COLORS.textDim, fontSize: 12 }}>(optional)</span>
                      </h3>
                      <p style={{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted }}>Upload a PDF, Word doc, or text file, or paste it. Letter drafts can draw on it.</p>
                    </div>
                    {bragSheet && (
                      <button onClick={() => { setBragSheet(""); setBragSheetFileName(""); }} style={{
                        fontSize: 11, fontFamily: FONTS.body, color: COLORS.pink,
                        background: "none", border: "none", cursor: "pointer",
                      }}>Clear all</button>
                    )}
                  </div>

                  <div
                    role="button" tabIndex={0} aria-label="Upload your brag sheet"
                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); bragFileRef.current?.click(); } }}
                    onClick={() => bragFileRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = COLORS.gold; }}
                    onDragLeave={e => { e.currentTarget.style.borderColor = COLORS.border; }}
                    onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = COLORS.border; const f = e.dataTransfer.files[0]; if(f) handleBragSheetUpload({target:{files:[f]}}); }}
                    style={{
                      border: `2px dashed ${COLORS.border}`, borderRadius: 12, padding: "24px 20px",
                      textAlign: "center", cursor: "pointer", marginBottom: 14, transition: "border-color 0.2s",
                      background: COLORS.bg,
                    }}>
                    <input ref={bragFileRef} type="file" accept=".pdf,.doc,.docx,.txt,.md,.rtf" onChange={handleBragSheetUpload} style={{ display: "none" }} />
                    {bragSheetUploading ? (
                      <div style={{ color: COLORS.gold, fontFamily: FONTS.body, fontSize: 13 }}>Reading file...</div>
                    ) : bragSheetFileName ? (
                      <div>
                        <div style={{ fontSize: 20, marginBottom: 4, color: COLORS.teal }}>✓</div>
                        <div style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.gold }}>{bragSheetFileName}</div>
                        <div style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.textDim, marginTop: 4 }}>Click or drop to replace</div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: 24, marginBottom: 6, color: COLORS.textDim }}>↑</div>
                        <div style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted }}>Drop your brag sheet here, or click to browse</div>
                        <div style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.textDim, marginTop: 4 }}>PDF, Word, or text files accepted</div>
                      </div>
                    )}
                  </div>

                  <textarea value={bragSheet} onChange={e => setBragSheet(e.target.value)} aria-label="Brag sheet text"
                    placeholder="Or paste your resume, brag sheet, or activity list here..."
                    rows={5} style={{
                      width: "100%", padding: "12px 16px", background: COLORS.bg,
                      border: `1px solid ${COLORS.border}`, borderRadius: 10,
                      color: COLORS.text, fontSize: 14, fontFamily: FONTS.body,
                      outline: "none", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box",
                    }}/>
                  {bragSheet && (
                    <div style={{ fontSize: 11, fontFamily: FONTS.body, color: COLORS.textDim, marginTop: 6 }}>
                      {bragSheet.length.toLocaleString()} characters loaded
                    </div>
                  )}
                </GlowCard>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Button onClick={runMatching} disabled={!profile.ageOk}>See my matches</Button>
                  <Button variant="ghost" onClick={generateCandidateProfile} disabled={generatingLetter || !profile.ageOk}>
                    {generatingLetter ? "Working..." : "Build my voice profile (optional)"}
                  </Button>
                </div>
              </div>
            )}

            {/* ====== GENERATED PROFILE ====== */}
            {view === "profileResult" && (
              <div>
                <button type="button" onClick={() => setView("profile")} style={{ background: "none", border: "none", color: COLORS.gold, cursor: "pointer", fontFamily: FONTS.body, fontSize: 13, marginBottom: 20, padding: "8px 0" }}>← Back to my profile</button>
                <SectionHeader title="Your Voice Profile" subtitle="How you write, in your own words. Every draft uses this to sound like you." />
                <GlowCard hover={false} style={{ maxWidth: 800, padding: 32 }}>
                  <pre style={{ whiteSpace: "pre-wrap", fontFamily: FONTS.body, fontSize: 14, lineHeight: 1.8, color: "#d4d0c8" }}>{generatedProfile}</pre>
                </GlowCard>
                <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
                  <Button onClick={() => { navigator.clipboard.writeText(generatedProfile); notify("Copied!", "success"); }}>Copy Profile</Button>
                  <Button variant="secondary" onClick={runMatching}>See my matches →</Button>
                </div>
              </div>
            )}

            {/* ====== BROWSE SCHOLARSHIPS (Card Layout) ====== */}
            {view === "search" && (
              <div>
                <SectionHeader
                  title="Browse Scholarships"
                  subtitle={catalogReady
                    ? `${filteredScholarships.length.toLocaleString()} of ${catalogCount} scholarships${!showExpired && expiredCount > 0 ? ` · ${expiredCount} closed hidden` : ""}`
                    : "Loading the latest scholarship list..."}
                />

                {/* Disclaimer Banner */}
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 12,
                  padding: "14px 18px", marginBottom: 24, borderRadius: 10,
                  background: `${COLORS.orange}08`, border: `1px solid ${COLORS.orange}22`,
                  fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6,
                }}>
                  <AppIcon name="info" size={18} color={COLORS.gold} style={{ marginTop: 1 }} />
                  <span>
                    <strong style={{ color: COLORS.gold }}>Before you apply:</strong> MeritLaunch aggregates scholarship information from public sources for your convenience. While we work to keep this data accurate, we cannot independently verify every listing. Always confirm eligibility, deadlines, and legitimacy directly with the scholarship provider before applying. <strong>Never pay an application fee for a legitimate scholarship.</strong> Closed listings stay in the catalog because most scholarships are annual, and we re-check each one monthly for a new deadline.
                  </span>
                </div>

                {/* URL Import (Premium) — enforced on the server too */}
                {!isPremium && authUser && (
                  <div style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 16 }}>
                    Found a scholarship somewhere else? <LinkButton onClick={() => openUpgrade(null)}>Import any scholarship from a URL with Premium</LinkButton>, or paste it into Write a Letter for free.
                  </div>
                )}
                {isPremium && (
                  <GlowCard hover={false} glow={COLORS.teal} style={{ padding: "16px 20px", marginBottom: 20 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.teal, marginBottom: 6, fontWeight: 500 }}>
                          ★ Import from URL
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input value={importUrl} onChange={e => setImportUrl(e.target.value)} aria-label="Scholarship page URL"
                            placeholder="Paste a scholarship page URL..."
                            style={{
                              flex: 1, padding: "8px 14px", background: COLORS.surface,
                              border: `1px solid ${COLORS.border}`, borderRadius: 8,
                              color: COLORS.text, fontSize: 13, fontFamily: FONTS.body, outline: "none",
                            }}/>
                          <Button disabled={importLoading || !importUrl.trim()} onClick={async () => {
                            setImportLoading(true);
                            try {
                              const resp = await authFetch("/api/import-scholarship", {
                                method: "POST", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ url: importUrl.trim() }),
                              });
                              const data = await resp.json();
                              if (resp.ok && data.name) {
                                setScholarshipDB(prev => [data, ...prev]);
                                setImportUrl("");
                                notify(`Imported "${data.name}" — ${data.amount}`, "success");
                              } else {
                                notify(data.error || "Could not extract scholarship info.", "error");
                              }
                            } catch { notify("Import failed. Check the URL and try again.", "error"); }
                            finally { setImportLoading(false); }
                          }} style={{ fontSize: 12, padding: "8px 16px" }}>
                            {importLoading ? "Importing..." : "Import"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </GlowCard>
                )}

                {/* Country Filter Tabs */}
                {(() => {
                  const countUS = scholarshipDB.filter(s => (s.country || "US") === "US" || (s.country || "US") === "BOTH").length;
                  const countCA = scholarshipDB.filter(s => (s.country || "US") === "CA" || (s.country || "US") === "BOTH").length;
                  const countBoth = scholarshipDB.filter(s => (s.country || "US") === "BOTH").length;
                  const tabs = [
                    { key: "all", label: "All Scholarships", count: scholarshipDB.length },
                    { key: "US", label: "US", count: countUS, flag: "us" },
                    { key: "CA", label: "Canada", count: countCA, flag: "ca" },
                    { key: "BOTH", label: "US + Canada", count: countBoth },
                  ];
                  return (
                    <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                      {tabs.map(tab => {
                        const active = filterCountry === tab.key;
                        return (
                          <button type="button" key={tab.key} aria-pressed={active} onClick={() => setFilterCountry(tab.key)} style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "8px 16px", borderRadius: 20, cursor: "pointer",
                            fontSize: 13, fontFamily: FONTS.body, fontWeight: active ? 600 : 400,
                            background: active ? COLORS.goldDim : COLORS.surface,
                            border: `1px solid ${active ? COLORS.gold : COLORS.border}`,
                            color: active ? COLORS.text : COLORS.textMuted, minHeight: 40,
                            transition: "all 0.2s ease",
                          }}>
                            {tab.flag && <img src={`https://flagcdn.com/w40/${tab.flag}.png`} alt={tab.flag} style={{ height: 13, borderRadius: 1 }} />}
                            {tab.key === "BOTH" && <>
                              <img src="https://flagcdn.com/w40/us.png" alt="US" style={{ height: 13, borderRadius: 1 }} />
                              <img src="https://flagcdn.com/w40/ca.png" alt="CA" style={{ height: 13, borderRadius: 1, marginLeft: -3 }} />
                            </>}
                            <span>{tab.label}</span>
                            <span style={{
                              fontSize: 11, padding: "1px 7px", borderRadius: 10,
                              background: active ? "rgba(255,255,255,0.12)" : COLORS.border,
                              color: active ? COLORS.text : COLORS.textMuted,
                            }}>{tab.count}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Search + Filters */}
                <div className="filters-row" style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 260px", position: "relative" }}>
                    <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: COLORS.textMuted }}><AppIcon name="search" size={16} /></span>
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} aria-label="Search scholarships"
                      placeholder="Search name, criteria, amount..."
                      style={{
                        width: "100%", padding: "12px 16px 12px 38px", background: COLORS.surface,
                        border: `1px solid ${COLORS.border}`, borderRadius: 10,
                        color: COLORS.text, fontSize: 14, fontFamily: FONTS.body, outline: "none", boxSizing: "border-box",
                      }}/>
                  </div>
                  <select value={filterNeedBased} onChange={e => setFilterNeedBased(e.target.value)} aria-label="Need-based or merit-based"
                    style={{
                      padding: "12px 16px", background: COLORS.surface,
                      border: `1px solid ${COLORS.border}`, borderRadius: 10,
                      color: COLORS.text, fontSize: 13, fontFamily: FONTS.body, outline: "none",
                    }}>
                    <option value="all">All Types</option>
                    <option value="need">Need-Based</option>
                    <option value="merit">Merit-Based</option>
                  </select>
                  <button
                    onClick={() => setShowExpired(v => !v)}
                    aria-pressed={!showExpired}
                    title={showExpired ? "Hide scholarships whose deadline has passed (they stay in the catalog and are re-checked monthly)" : "Show scholarships whose deadline has passed"}
                    style={{
                      padding: "12px 16px", background: showExpired ? COLORS.surface : COLORS.pinkDim,
                      border: `1px solid ${showExpired ? COLORS.border : COLORS.pink}`, borderRadius: 10,
                      color: showExpired ? COLORS.textDim : COLORS.pink,
                      fontSize: 13, fontFamily: FONTS.body, cursor: "pointer", whiteSpace: "nowrap",
                    }}>
                    {showExpired ? "Hide closed" : "Show closed"}{expiredCount > 0 ? ` (${expiredCount})` : ""}
                  </button>
                  {availableStates.length > 0 && (
                    <select value={filterState} onChange={e => setFilterState(e.target.value)} aria-label="State"
                      title="Show national scholarships plus those for a state you're considering"
                      style={{
                        padding: "12px 16px", background: COLORS.surface,
                        border: `1px solid ${COLORS.border}`, borderRadius: 10,
                        color: COLORS.text, fontSize: 13, fontFamily: FONTS.body, outline: "none",
                      }}>
                      <option value="all">All States</option>
                      {availableStates.map(code => (
                        <option key={code} value={code}>{US_STATE_NAMES[code] || code}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Scholarship Cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {filteredScholarships.slice(0, browseLimit).map(s => {
                    const dl = getDeadlineStatus(s.deadline);
                    return (
                      <GlowCard key={s.id} style={{ padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 16, fontWeight: 400, marginBottom: 6, fontFamily: FONTS.heading }}>{s.name}</div>
                          <div style={{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.5, marginBottom: 10 }}>
                            {s.criteria.slice(0, 160)}{s.criteria.length > 160 ? "..." : ""}
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <CountryFlag country={s.country || "US"} />
                            {s.amount && <Badge color={COLORS.gold}>{s.amount}</Badge>}
                            <Badge color={dl.color}>{dl.label}</Badge>
                            {s.needBased === "Y" && <Badge color={COLORS.teal}>Need-Based</Badge>}
                            <LinkCheck s={s} />
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                          <Button onClick={() => { setSelectedScholarship(s); setView("generate"); }} style={{ fontSize: 12, padding: "8px 16px" }}>
                            Apply →
                          </Button>
                          <Button variant="secondary" onClick={() => trackApplication(s)} style={{ fontSize: 11, padding: "6px 14px" }}>
                            {trackedApps.some(a => a.scholarshipId === s.id) ? "✓ Tracked" : "Track"}
                          </Button>
                          {s.link && <a href={s.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: COLORS.textMuted, fontFamily: FONTS.body, textAlign: "center", padding: "8px 4px", minHeight: 32 }}>Source ↗<span className="sr-only"> for {s.name} (opens in a new tab)</span></a>}
                        </div>
                      </GlowCard>
                    );
                  })}
                </div>
                {filteredScholarships.length > browseLimit && (
                  <div style={{ textAlign: "center", marginTop: 20 }}>
                    <Button variant="secondary" onClick={() => setBrowseLimit(n => n + 24)}>
                      Show more ({(filteredScholarships.length - browseLimit).toLocaleString()} left)
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* ====== MATCHES ====== */}
            {view === "matches" && (
              <div>
                <SectionHeader
                  title="My Matches"
                  subtitle="Only scholarships you appear eligible for, grouped by when they're due."
                  action={<Button variant="secondary" onClick={runMatching} style={{ fontSize: 12, padding: "8px 16px" }}>Re-run matching</Button>}
                />

                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "12px 16px", marginBottom: 20, borderRadius: 10,
                  background: COLORS.surface, border: `1px solid ${COLORS.border}`,
                  fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.5,
                }}>
                  <AppIcon name="info" size={16} color={COLORS.gold} style={{ marginTop: 1 }} />
                  <span>We screen on state, citizenship, GPA minimums and heritage, but listings come from public sources. Always confirm eligibility and deadlines with the provider. Never pay to apply.</span>
                </div>

                {matchResults.length === 0 ? (
                  <EmptyState icon="matches" title="No matches yet" desc="Finish the first steps of your profile and we'll show the scholarships you're eligible for."
                    action={() => setView("profile")} actionLabel="Continue my profile" />
                ) : (() => {
                  const groups = { soon: [], later: [], undated: [], closed: [] };
                  for (const m of matchResults) {
                    const dl = parseDeadline(m.deadline);
                    const g = dl.days === null ? "undated" : dl.days < 0 ? "closed" : dl.days <= 30 ? "soon" : "later";
                    groups[g].push({ ...m, dl });
                  }
                  groups.soon.sort((a, b) => a.dl.days - b.dl.days);
                  const sections = [
                    ["soon", "Due in the next 30 days"], ["later", "Due later"],
                    ["undated", "Rolling or varies"], ["closed", "Closed this cycle (usually back next year)"],
                  ];
                  return sections.filter(([k]) => groups[k].length).map(([k, title]) => (
                    <section key={k} style={{ marginBottom: 28 }}>
                      <h2 style={{ fontSize: 18, fontWeight: 400, marginBottom: 12, color: k === "closed" ? COLORS.textMuted : COLORS.text }}>
                        {title} <span style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted }}>({groups[k].length})</span>
                      </h2>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {groups[k].map(s => {
                          const scoreColor = s.matchScore >= 50 ? COLORS.teal : COLORS.gold;
                          const tracked = trackedApps.some(a => a.scholarshipId === s.id);
                          return (
                            <GlowCard key={s.id} glow={scoreColor} className="match-card" style={{ padding: "18px 22px", display: "flex", alignItems: "center", gap: 18, opacity: k === "closed" ? 0.85 : 1 }}>
                              <div style={{ position: "relative", flexShrink: 0 }} aria-label={`Fit score ${s.matchScore} out of 100`}>
                                <ProgressRing value={s.matchScore} color={scoreColor} />
                                <div aria-hidden="true" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", fontSize: 14, fontWeight: 700, fontFamily: FONTS.body, color: scoreColor }}>{s.matchScore}</div>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                                  <div style={{ fontSize: 16, fontWeight: 400 }}>{s.name}</div>
                                  <Badge color={s.dl.color}>{s.dl.tone === "undated" ? s.dl.label : s.dl.tone === "closed" ? "Closed this cycle" : `Due ${s.dl.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${s.dl.days}d`}</Badge>
                                  <LinkCheck s={s} />
                                </div>
                                <div style={{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 4 }}>Why you fit:</div>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  {s.matchReasons.map((r, j) => (
                                    <span key={j} style={{ fontSize: 12, fontFamily: FONTS.body, background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, padding: "3px 8px", borderRadius: 5 }}>{r}</span>
                                  ))}
                                </div>
                                {s.amount && <div style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.gold, marginTop: 6 }}>{s.amount}</div>}
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                                {k === "closed" ? (
                                  <Button variant="secondary" onClick={() => trackApplication(s)} style={{ fontSize: 12, padding: "10px 16px" }}>
                                    {tracked ? "✓ Tracking" : "Track for next year"}
                                  </Button>
                                ) : (
                                  <>
                                    <Button onClick={() => { setSelectedScholarship(s); setScholarshipInputMode("database"); setView("generate"); }} style={{ fontSize: 12, padding: "10px 18px" }}>
                                      Draft a letter
                                    </Button>
                                    <Button variant="secondary" onClick={() => trackApplication(s)} style={{ fontSize: 12, padding: "8px 14px" }}>
                                      {tracked ? "✓ Tracked" : "Track"}
                                    </Button>
                                  </>
                                )}
                              </div>
                            </GlowCard>
                          );
                        })}
                      </div>
                    </section>
                  ));
                })()}
              </div>
            )}

            {/* ====== APPLICATION PREP ====== */}
            {view === "apply" && (
              <div>
                <SectionHeader title="Application Prep" subtitle="Answer common scholarship questions. Your responses enhance generated letters." />
                {APP_QUESTIONS.map((q, i) => (
                  <div key={i} style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <span style={{
                        width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontFamily: FONTS.body, fontWeight: 600, flexShrink: 0,
                        background: appAnswers[`q${i}`] ? COLORS.goldDim : COLORS.surface,
                        color: appAnswers[`q${i}`] ? COLORS.gold : COLORS.textDim,
                        border: `1px solid ${appAnswers[`q${i}`] ? COLORS.gold + "44" : COLORS.border}`,
                      }}>
                        {appAnswers[`q${i}`] ? "✓" : i + 1}
                      </span>
                      <label style={{ fontSize: 14, fontFamily: FONTS.body, color: COLORS.textMuted }}>{q}</label>
                    </div>
                    <textarea value={appAnswers[`q${i}`] || ""} onChange={e => {
                      const next = {...appAnswers, [`q${i}`]: e.target.value};
                      setAppAnswers(next); store.set("scholarbot-answers", next);
                    }} rows={5} style={{
                      width: "100%", padding: "14px 18px", background: COLORS.surface,
                      border: `1px solid ${COLORS.border}`, borderRadius: 10,
                      color: COLORS.text, fontSize: 14, fontFamily: FONTS.body,
                      outline: "none", resize: "vertical", lineHeight: 1.7, boxSizing: "border-box",
                    }}/>
                  </div>
                ))}
                <GlowCard hover={false} style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6 }}>
                  These answers are saved automatically and feed into your letter generation. More detail = better letters.
                </GlowCard>
              </div>
            )}

            {/* ====== LETTER GENERATOR ====== */}
            {view === "generate" && (
              <div>
                <SectionHeader title="Write a Letter" subtitle="Pick a scholarship and a style. You get a draft built from your real details, then you make it yours." />

                <div className="two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
                  {/* Scholarship Input */}
                  <div>
                    <div id="sch-source-label" style={{ fontSize: 11, fontFamily: FONTS.body, color: COLORS.textMuted, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
                      Scholarship
                    </div>

                    {/* Mode Tabs */}
                    <div role="group" aria-labelledby="sch-source-label" style={{ display: "flex", gap: 0, marginBottom: 14, borderRadius: 10, overflow: "hidden", border: `1px solid ${COLORS.border}` }}>
                      {[
                        {id:"database",label:"Our list"},
                        {id:"upload",label:"Upload"},
                        {id:"url",label:"From URL"},
                        {id:"paste",label:"Paste"},
                      ].map(tab => (
                        <button type="button" key={tab.id} aria-pressed={scholarshipInputMode === tab.id} onClick={() => setScholarshipInputMode(tab.id)} style={{
                          minHeight: 44,
                          flex: 1, padding: "10px 8px", border: "none", fontSize: 12, fontFamily: FONTS.body,
                          cursor: "pointer", fontWeight: scholarshipInputMode === tab.id ? 600 : 400,
                          background: scholarshipInputMode === tab.id ? COLORS.goldDim : COLORS.surface,
                          color: scholarshipInputMode === tab.id ? COLORS.gold : COLORS.textMuted,
                          borderBottom: scholarshipInputMode === tab.id ? `2px solid ${COLORS.gold}` : "2px solid transparent",
                          transition: "all 0.2s",
                        }}>{tab.label}</button>
                      ))}
                    </div>

                    {scholarshipInputMode === "database" && (
                      <div>
                        {/* Searchable combobox — a native select over 1,297 unsorted
                            options made specific scholarships effectively unfindable. */}
                        {(() => {
                          const q = scholarshipQuery.trim().toLowerCase();
                          const list = scholarshipPickerOpen ? scholarshipDB
                            .filter(s => !q || (s.name || "").toLowerCase().includes(q) || (s.criteria || "").toLowerCase().includes(q))
                            .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                            .slice(0, 60) : [];
                          const active = Math.min(pickerActive, Math.max(0, list.length - 1));
                          const choose = (s) => {
                            setSelectedScholarship(s); setCustomScholarshipText(""); setCustomScholarshipName("");
                            setScholarshipQuery(s.name); setScholarshipPickerOpen(false);
                          };
                          return (
                        <div style={{ position: "relative" }}>
                          <label htmlFor="sch-combobox" className="sr-only">Search scholarships</label>
                          <input
                            id="sch-combobox"
                            type="text"
                            role="combobox"
                            aria-autocomplete="list"
                            aria-expanded={scholarshipPickerOpen && list.length > 0}
                            aria-controls="sch-listbox"
                            aria-activedescendant={scholarshipPickerOpen && list.length ? `sch-opt-${list[active].id}` : undefined}
                            value={scholarshipPickerOpen ? scholarshipQuery : (selectedScholarship?.name || scholarshipQuery)}
                            placeholder={catalogCount ? `Search ${catalogCount} scholarships...` : "Search scholarships..."}
                            onFocus={() => { setScholarshipPickerOpen(true); setScholarshipQuery(""); setPickerActive(0); }}
                            onBlur={() => setTimeout(() => setScholarshipPickerOpen(false), 150)}
                            onChange={e => { setScholarshipQuery(e.target.value); setScholarshipPickerOpen(true); setPickerActive(0); }}
                            onKeyDown={e => {
                              if (e.key === "ArrowDown") { e.preventDefault(); setScholarshipPickerOpen(true); setPickerActive(Math.min(active + 1, list.length - 1)); }
                              else if (e.key === "ArrowUp") { e.preventDefault(); setPickerActive(Math.max(active - 1, 0)); }
                              else if (e.key === "Enter" && scholarshipPickerOpen && list[active]) { e.preventDefault(); choose(list[active]); }
                              else if (e.key === "Escape") { setScholarshipPickerOpen(false); setScholarshipQuery(""); }
                            }}
                            style={{ width: "100%", padding: "12px 16px", background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, borderRadius: 10, color: COLORS.text, fontSize: 14, fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" }}
                          />
                          {scholarshipPickerOpen && (
                            <div id="sch-listbox" role="listbox" aria-label="Scholarships" style={{
                              position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 50,
                              maxHeight: 320, overflowY: "auto", background: COLORS.card,
                              border: `1px solid ${COLORS.border}`, borderRadius: 10,
                              boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
                            }}>
                              {list.length === 0 ? (
                                <div role="option" aria-disabled="true" aria-selected="false" style={{ padding: "14px 16px", fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted }}>
                                  No scholarships match "{scholarshipQuery}". Try a broader term, or use the Paste tab.
                                </div>
                              ) : list.map((s, i) => {
                                const dl = parseDeadline(s.deadline);
                                const isActive = i === active;
                                return (
                                  <div key={s.id} id={`sch-opt-${s.id}`} role="option" aria-selected={selectedScholarship?.id === s.id}
                                    onMouseDown={(e) => { e.preventDefault(); choose(s); }}
                                    onMouseEnter={() => setPickerActive(i)}
                                    style={{
                                      padding: "10px 16px", cursor: "pointer", fontFamily: FONTS.body,
                                      borderBottom: `1px solid ${COLORS.border}`,
                                      background: isActive ? COLORS.goldDim : "transparent",
                                      outline: isActive ? `1px solid ${COLORS.gold}66` : "none", outlineOffset: -1,
                                    }}>
                                    <div style={{ fontSize: 14, color: COLORS.text }}>{s.name}</div>
                                    <div style={{ fontSize: 12, color: COLORS.textMuted, display: "flex", gap: 10, marginTop: 2 }}>
                                      <span>{(s.amount || "").trim() || "Amount varies"}</span>
                                      <span style={{ color: dl.color }}>{dl.label}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                          );
                        })()}
                        {selectedScholarship && (
                          <div style={{
                            marginTop: 12, padding: 14, background: COLORS.bg,
                            border: `1px solid ${COLORS.border}`, borderRadius: 10,
                            fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6,
                          }}>
                            <strong style={{ color: COLORS.gold }}>Criteria:</strong> {(selectedScholarship.criteria || "").slice(0, 300)}
                          </div>
                        )}
                      </div>
                    )}

                    {scholarshipInputMode === "upload" && (
                      <div>
                        <div
                          role="button" tabIndex={0} aria-label="Upload a scholarship application file"
                          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); scholarshipFileRef.current?.click(); } }}
                          onClick={() => scholarshipFileRef.current?.click()}
                          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = COLORS.gold; }}
                          onDragLeave={e => { e.currentTarget.style.borderColor = COLORS.border; }}
                          onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = COLORS.border; const f = e.dataTransfer.files[0]; if(f) handleScholarshipUpload({target:{files:[f]}}); }}
                          style={{
                            border: `2px dashed ${COLORS.border}`, borderRadius: 12, padding: "28px 20px",
                            textAlign: "center", cursor: "pointer", transition: "border-color 0.2s",
                            background: COLORS.bg, marginBottom: 12,
                          }}>
                          <input ref={scholarshipFileRef} type="file" accept=".pdf,.doc,.docx,.txt,.md,.html,.rtf" onChange={handleScholarshipUpload} style={{ display: "none" }} />
                          {uploadedScholarshipName ? (
                            <div>
                              <div style={{ fontSize: 20, marginBottom: 4, color: COLORS.teal }}>✓</div>
                              <div style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.gold }}>{uploadedScholarshipName}</div>
                            </div>
                          ) : (
                            <div>
                              <AppIcon name="doc" size={30} color={COLORS.textMuted} style={{ margin: "0 auto 8px" }} />
                              <div style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted }}>Drop scholarship application here</div>
                            </div>
                          )}
                        </div>
                        <input value={customScholarshipName} onChange={e => setCustomScholarshipName(e.target.value)} aria-label="Scholarship name"
                          placeholder="Scholarship name" style={{ width: "100%", padding: "12px 16px", background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, borderRadius: 10, color: COLORS.text, fontSize: 14, fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" }}/>
                      </div>
                    )}

                    {scholarshipInputMode === "url" && (
                      <div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                          <input value={scholarshipUrl} onChange={e => setScholarshipUrl(e.target.value)} aria-label="Scholarship page URL"
                            placeholder="https://www.scholarship-site.com/apply"
                            style={{
                              flex: 1, padding: "12px 16px", background: COLORS.surface,
                              border: `1px solid ${COLORS.border}`, borderRadius: 10,
                              color: COLORS.text, fontSize: 13, fontFamily: FONTS.body, outline: "none",
                            }}/>
                          <Button onClick={fetchScholarshipFromUrl} disabled={fetchingUrl} style={{ fontSize: 12, padding: "10px 18px" }}>
                            {fetchingUrl ? "Fetching..." : "Fetch →"}
                          </Button>
                        </div>
                        <input value={customScholarshipName} onChange={e => setCustomScholarshipName(e.target.value)} aria-label="Scholarship name"
                          placeholder="Scholarship name" style={{ ...{ width: "100%", padding: "12px 16px", background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, borderRadius: 10, color: COLORS.text, fontSize: 14, fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" }, marginBottom: 10 }}/>
                        {customScholarshipText && (
                          <div style={{
                            padding: 12, background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                            borderRadius: 10, fontSize: 11, fontFamily: FONTS.body, color: COLORS.textDim,
                          }}>
                            <span style={{ color: COLORS.teal }}>✓ Fetched</span> · {customScholarshipText.length.toLocaleString()} chars
                          </div>
                        )}
                      </div>
                    )}

                    {scholarshipInputMode === "paste" && (
                      <div>
                        <input value={customScholarshipName} onChange={e => setCustomScholarshipName(e.target.value)} aria-label="Scholarship name"
                          placeholder="Scholarship name" style={{ ...{ width: "100%", padding: "12px 16px", background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, borderRadius: 10, color: COLORS.text, fontSize: 14, fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" }, marginBottom: 10 }}/>
                        <textarea value={customScholarshipText} onChange={e => setCustomScholarshipText(e.target.value)} aria-label="Scholarship description"
                          placeholder="Paste the full scholarship description here..."
                          rows={8} style={{
                            width: "100%", padding: "12px 16px", background: COLORS.bg,
                            border: `1px solid ${COLORS.border}`, borderRadius: 10,
                            color: COLORS.text, fontSize: 13, fontFamily: FONTS.body,
                            outline: "none", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box",
                          }}/>
                      </div>
                    )}
                  </div>

                  {/* Template Selection */}
                  <div>
                    <div id="style-label" style={{ fontSize: 11, fontFamily: FONTS.body, color: COLORS.textMuted, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
                      Writing Style
                    </div>
                    <div role="group" aria-labelledby="style-label" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {templates.map(t => (
                        <button type="button" key={t.id} aria-pressed={selectedTemplate?.id === t.id} onClick={() => setSelectedTemplate(t)} style={{
                          padding: "14px 16px", textAlign: "left", border: "none", borderRadius: 10, cursor: "pointer",
                          background: selectedTemplate?.id === t.id ? COLORS.goldDim : COLORS.surface,
                          outline: selectedTemplate?.id === t.id ? `1px solid ${COLORS.gold}44` : `1px solid ${COLORS.border}`,
                          color: COLORS.text, transition: "all 0.2s",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                            <AppIcon name={ICON_PATHS[t.icon] ? t.icon : "generate"} size={16} color={COLORS.gold} />
                            <span style={{ fontSize: 14, fontFamily: FONTS.body, fontWeight: 500 }}>{t.name}</span>
                          </div>
                          <div style={{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.4 }}>{t.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* The application's real question + length, and the AI-policy check */}
                <div className="two-col" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div>
                    <label htmlFor="essay-prompt" style={{ display: "block", fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 6 }}>
                      The application's essay question (optional, but it makes a big difference)
                    </label>
                    <textarea id="essay-prompt" rows={3} value={essayPrompt} onChange={e => setEssayPrompt(e.target.value)}
                      placeholder="e.g. Describe a challenge you overcame and what it taught you."
                      style={{ ...{ width: "100%", padding: "12px 16px", background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, borderRadius: 10, color: COLORS.text, fontSize: 14, fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" }, resize: "vertical", lineHeight: 1.6 }} />
                  </div>
                  <div>
                    <label htmlFor="word-limit" style={{ display: "block", fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 6 }}>
                      Word limit
                    </label>
                    <input id="word-limit" type="number" min={100} max={1000} step={25} inputMode="numeric" value={wordLimit}
                      onChange={e => setWordLimit(e.target.value)} placeholder="e.g. 500" style={{ width: "100%", padding: "12px 16px", background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, borderRadius: 10, color: COLORS.text, fontSize: 14, fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" }} />
                  </div>
                </div>

                <fieldset style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
                  <legend style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.text, padding: "0 6px" }}>Does this scholarship allow AI help?</legend>
                  <p style={{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6, margin: "0 0 10px" }}>
                    Some scholarships limit outside help or AI. Check their rules. You're responsible for following them.
                  </p>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    {[
                      ["allowed", "Allowed: draft a letter I'll revise"],
                      ["unsure", "Not sure or not allowed: give me an outline and questions instead (free)"],
                    ].map(([val, label]) => (
                      <label key={val} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, cursor: "pointer", maxWidth: 420 }}>
                        <input type="radio" name="ai-policy" value={val} checked={aiPolicy === val} onChange={() => setAiPolicy(val)} style={{ width: 18, height: 18, accentColor: COLORS.gold, marginTop: 1 }} />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                {aiPolicy === "allowed" && profile.ageOk && thinFields().length > 0 && (
                  <div style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
                    Your draft will be thinner without {thinFields().join(", ")}. Drafts only use what you've told us.{" "}
                    <LinkButton onClick={() => { setProfileStep(thinFields().includes("activities") ? 2 : 3); setView("profile"); }}>Add one detail</LinkButton>
                  </div>
                )}

                <Button onClick={() => generateLetter()}
                  disabled={generatingLetter || (scholarshipInputMode === "database" ? !selectedScholarship : !customScholarshipText.trim())}
                  style={{ fontSize: 15, padding: "14px 40px", marginBottom: 28 }}>
                  {generatingLetter ? "Drafting from your details..." : aiPolicy === "unsure" ? "Make my outline" : "Draft my letter"}
                </Button>

                {(generatedLetter || generatingLetter) && (
                  <div>
                    <GlowCard hover={false} style={{
                      padding: 32, marginBottom: 16,
                      background: COLORS.card,
                      boxShadow: generatingLetter ? `0 0 30px ${COLORS.goldGlow}` : "none",
                      transition: "box-shadow 0.5s ease",
                    }}>
                      {/* Letter paper styling */}
                      <div style={{
                        background: "#fdfcf8", borderRadius: 8, padding: "36px 40px",
                        boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
                        minHeight: generatingLetter && !generatedLetter ? 200 : "auto",
                      }}>
                        {generatingLetter && !generatedLetter && (
                          <div style={{ textAlign: "center", padding: "40px 0" }}>
                            <div style={{ fontSize: 14, fontFamily: FONTS.body, color: "#5f5a50", marginBottom: 8 }}>Drafting from your details...</div>
                            <div style={{ fontSize: 12, fontFamily: FONTS.body, color: "#6f6a60" }}>Using only what's in your profile</div>
                          </div>
                        )}
                        {/* While streaming, render read-only so the typing effect and
                            cursor aren't fighting a controlled input. Once it's done,
                            swap to a textarea — this is a draft the student edits and
                            signs, not a finished artifact handed to them. */}
                        {generatingLetter ? (
                          <div style={{
                            whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.85,
                            color: "#2a2722", fontFamily: "Georgia, 'Times New Roman', serif",
                          }}>
                            {generatedLetter}
                            {generatedLetter && (
                              <span style={{
                                display: "inline-block", width: 2, height: 18,
                                background: COLORS.gold, marginLeft: 2,
                                animation: "blink 0.8s infinite",
                              }} />
                            )}
                          </div>
                        ) : (
                          <textarea
                            value={generatedLetter}
                            onChange={e => setGeneratedLetter(e.target.value)}
                            spellCheck
                            aria-label="Your letter — edit before saving"
                            style={{
                              width: "100%", minHeight: 480, boxSizing: "border-box",
                              whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.85,
                              color: "#2a2722", fontFamily: "Georgia, 'Times New Roman', serif",
                              background: "transparent", border: "none", outline: "none",
                              padding: 0, resize: "vertical", display: "block",
                            }}
                          />
                        )}
                      </div>
                    </GlowCard>
                    {!generatingLetter && generatedLetter && (
                      <div style={{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.textDim, marginBottom: 12 }}>
                        This is a draft built from your details. Click into it and rewrite anything so it's fully yours before you save or send it.
                      </div>
                    )}
                    {!generatingLetter && generatedLetter && (
                      <div style={{ display: "flex", gap: 12 }}>
                        <Button onClick={() => {
                          const label = scholarshipInputMode === "database" ? selectedScholarship?.name : (customScholarshipName || "Custom Scholarship");
                          saveLetter({ content: generatedLetter, scholarshipName: label, template: selectedTemplate?.name, scholarshipId: selectedScholarship?.id });
                        }}>Save Letter</Button>
                        <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(generatedLetter); notify("Copied!", "success"); }}>Copy to Clipboard</Button>
                        <Button variant="ghost" onClick={() => generateLetter({ isRegenerate: true })}>Regenerate</Button>
                      </div>
                    )}
                    {!generatingLetter && generatedLetter && !isPremium && authUser && (
                      <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 10, background: COLORS.surface, border: `1px solid ${COLORS.border}`, fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6 }}>
                        Letter {Math.min(monthlyLettersUsed, FREE_LIMITS.lettersPerMonth)} of {FREE_LIMITS.lettersPerMonth} free this month
                        {(() => { const n = matchResults.filter(m => { const d = parseDeadline(m.deadline).days; return d !== null && d >= 0 && d <= 60; }).length;
                          return n > 0 ? `. You have ${n} matched scholarship${n === 1 ? "" : "s"} due in the next 60 days.` : "."; })()}{" "}
                        <LinkButton onClick={() => openUpgrade("letter")}>See plans</LinkButton>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ====== STYLE TEMPLATES ====== */}
            {view === "templates" && (
              <div>
                <SectionHeader title="Writing Styles" subtitle="Different shapes for different scholarships. Every style uses only your real details." />
                <div className="two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 32 }}>
                  {templates.map(t => (
                    <GlowCard key={t.id}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <AppIcon name={ICON_PATHS[t.icon] ? t.icon : "generate"} size={22} color={COLORS.gold} />
                        <div style={{ fontSize: 18, fontWeight: 400, color: COLORS.gold }}>{t.name}</div>
                      </div>
                      <div style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 14, lineHeight: 1.5 }}>{t.description}</div>
                      <div style={{
                        fontSize: 12, fontFamily: FONTS.mono, color: COLORS.textDim,
                        background: COLORS.bg, padding: 14, borderRadius: 10, lineHeight: 1.6,
                      }}>{t.rules}</div>
                    </GlowCard>
                  ))}
                </div>

                {/* Custom Template Creator */}
                <GlowCard hover={false} style={{ border: `1px dashed ${COLORS.border}` }}>
                  <h3 style={{ fontSize: 16, fontWeight: 400, marginBottom: 16 }}>Create Custom Template</h3>
                  <div className="two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                    <input id="tpl-name" aria-label="Style name" placeholder="Style name..." style={{
                      padding: "10px 14px", background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                      borderRadius: 10, color: COLORS.text, fontSize: 13, fontFamily: FONTS.body, outline: "none",
                    }}/>
                    <input id="tpl-desc" aria-label="Short description" placeholder="Short description..." style={{
                      padding: "10px 14px", background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                      borderRadius: 10, color: COLORS.text, fontSize: 13, fontFamily: FONTS.body, outline: "none",
                    }}/>
                  </div>
                  <textarea id="tpl-rules" aria-label="Writing rules" placeholder="Writing rules..." rows={4} style={{
                    width: "100%", padding: "10px 14px", background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                    borderRadius: 10, color: COLORS.text, fontSize: 13, fontFamily: FONTS.body,
                    outline: "none", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box", marginBottom: 12,
                  }}/>
                  <Button onClick={() => {
                    const name = document.getElementById("tpl-name").value;
                    const desc = document.getElementById("tpl-desc").value;
                    const rules = document.getElementById("tpl-rules").value;
                    if (!name || !rules) { notify("Name and rules are required.", "error"); return; }
                    saveTemplates([...templates, { id: `custom-${Date.now()}`, name, description: desc, rules, icon: "generate" }]);
                    notify("Template created!", "success");
                    document.getElementById("tpl-name").value = "";
                    document.getElementById("tpl-desc").value = "";
                    document.getElementById("tpl-rules").value = "";
                  }}>Save Template</Button>
                </GlowCard>
              </div>
            )}

            {/* ====== SAVED LETTERS ====== */}
            {view === "saved" && (
              <div>
                <SectionHeader title="Saved Letters" />
                {savedLetters.length === 0 ? (
                  <EmptyState icon="saved" title="No saved letters yet" desc="Draft a letter, make it yours, and save it here."
                    action={() => setView("generate")} actionLabel="Write a letter" />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {savedLetters.map((l, i) => (
                      <GlowCard key={l.id} hover={false}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 400 }}>{l.scholarshipName || l.scholarship || "Untitled"}</div>
                            <div style={{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted }}>{l.template} · {l.date}</div>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(l.content || l.text || ""); notify("Copied!", "success"); }}
                              style={{ fontSize: 11, padding: "6px 14px" }}>Copy</Button>
                            <Button variant="danger" onClick={() => {
                              const next = savedLetters.filter((_, j) => j !== i);
                              setSavedLetters(next); store.set("scholarbot-letters", next);
                              notify("Deleted.", "info");
                            }} style={{ fontSize: 11, padding: "6px 14px" }}>Delete</Button>
                          </div>
                        </div>
                        <div style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6, maxHeight: 120, overflow: "hidden" }}>
                          {(l.content || l.text || "").slice(0, 400)}{(l.content || l.text || "").length > 400 ? "..." : ""}
                        </div>
                      </GlowCard>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ====== APPLICATION TRACKER ====== */}
            {view === "tracker" && (
              <div>
                <SectionHeader title="My Deadlines" subtitle="Everything you're tracking, soonest first. We email reminders a week before each one." />
                {trackedApps.length === 0 ? (
                  <EmptyState icon="calendar" title="Nothing tracked yet" desc="Track a scholarship from your matches and its deadline shows up here, with a reminder email."
                    action={() => setView("matches")} actionLabel="Go to my matches" />
                ) : (
                  <div>
                    {/* Status summary */}
                    <div className="status-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
                      {[
                        { status: "interested", label: "Interested", color: COLORS.textMuted, icon: "○" },
                        { status: "in_progress", label: "In Progress", color: COLORS.gold, icon: "◐" },
                        { status: "submitted", label: "Submitted", color: COLORS.teal, icon: "●" },
                        { status: "accepted", label: "Accepted", color: COLORS.teal, icon: "✓" },
                        { status: "rejected", label: "Rejected", color: COLORS.pink, icon: "✗" },
                      ].map(s => (
                        <div key={s.status} style={{
                          textAlign: "center", padding: "12px 8px", borderRadius: 10,
                          background: COLORS.surface, border: `1px solid ${COLORS.border}`,
                        }}>
                          <div style={{ fontSize: 22, color: s.color }}>{trackedApps.filter(a => a.status === s.status).length}</div>
                          <div style={{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, marginTop: 2 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Application list */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {/* Copy before sorting — .sort() mutates, and trackedApps is state. */}
                      {[...trackedApps].sort((a, b) => {
                        // Sort by deadline urgency; undated entries sink to the bottom.
                        const da = parseDeadlineDate(a.deadline), db = parseDeadlineDate(b.deadline);
                        if (!da && !db) return 0;
                        if (!da) return 1;
                        if (!db) return -1;
                        return da - db;
                      }).map(app => {
                        const deadlineInfo = parseDeadline(app.deadline);
                        const statusColors = {
                          interested: COLORS.textMuted, in_progress: COLORS.gold,
                          submitted: COLORS.teal, accepted: COLORS.teal, rejected: COLORS.pink,
                        };
                        return (
                          <GlowCard key={app.id} hover={false}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                                  <div style={{ fontSize: 16, fontWeight: 400 }}>{app.name}</div>
                                  {deadlineInfo && (
                                    <span style={{
                                      fontSize: 10, fontFamily: FONTS.body, padding: "2px 8px",
                                      borderRadius: 10, background: deadlineInfo.color + "22", color: deadlineInfo.color,
                                    }}>{deadlineInfo.label}</span>
                                  )}
                                </div>
                                <div style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.textDim, marginBottom: 8 }}>
                                  {app.amount} {app.link && <> · <a href={app.link} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.gold, textDecoration: "none" }}>Apply →</a></>}
                                </div>
                                {/* Status selector */}
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  {["interested", "in_progress", "submitted", "accepted", "rejected"].map(s => (
                                    <button type="button" key={s} aria-pressed={app.status === s} onClick={() => updateAppStatus(app.id, s)} style={{
                                      padding: "8px 12px", fontSize: 12, minHeight: 36, fontFamily: FONTS.body, borderRadius: 6,
                                      border: `1px solid ${app.status === s ? statusColors[s] : COLORS.border}`,
                                      background: app.status === s ? statusColors[s] + "22" : "transparent",
                                      color: app.status === s ? statusColors[s] : COLORS.textDim,
                                      cursor: "pointer", transition: "all 0.2s",
                                    }}>
                                      {s.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <Button variant="ghost" aria-label={`Stop tracking ${app.name}`} onClick={() => removeTrackedApp(app.id)} style={{ padding: 10, minWidth: 40, minHeight: 40, color: COLORS.textMuted }}>
                                <AppIcon name="close" size={16} />
                              </Button>
                            </div>
                          </GlowCard>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* GLOBAL STYLES */}
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${COLORS.bg}; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: ${COLORS.borderHover}; }
        ::placeholder { color: ${COLORS.textDim}; }
        select option { background: ${COLORS.surface}; color: ${COLORS.text}; }
        input:not([type=checkbox]):not([type=radio]), select, textarea { border-color: ${COLORS.fieldBorder}; }
        input:focus, textarea:focus, select:focus { border-color: ${COLORS.gold} !important; }
        /* Keyboard focus is always visible (never remove outlines on controls) */
        :focus-visible { outline: 2px solid ${COLORS.gold}; outline-offset: 2px; }
        a { color: ${COLORS.gold}; }
        .sr-only { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
        .skeleton { background: linear-gradient(90deg, ${COLORS.card}, ${COLORS.cardHover}, ${COLORS.card}); background-size: 200% 100%; animation: shimmer 1.4s ease-in-out infinite; }
        @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
        @media (prefers-reduced-motion: reduce) {
          .skeleton { animation: none; }
          *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
        }
        @keyframes toastIn {
          from { transform: translateX(100px) scale(0.95); opacity: 0; }
          to { transform: translateX(0) scale(1); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        button:hover { opacity: 0.92; }
        button:active { transform: scale(0.98); }

        @keyframes revealUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @supports (animation-timeline: view()) {
          @media (prefers-reduced-motion: no-preference) {
            .reveal { animation: revealUp linear both; animation-timeline: view(); animation-range: entry 5% cover 25%; }
          }
        }
        @media (max-width: 1024px) {
          .landing-hero-title { font-size: clamp(40px, 6vw, 60px) !important; }
          .app-main { padding: 28px 28px !important; }
        }

        /* Mobile responsiveness */
        @media (max-width: 768px) {
          /* Landing page */
          .landing-hero-title { font-size: 36px !important; }
          .landing-hero-subtitle { font-size: 15px !important; }
          .landing-stats-grid { gap: 20px !important; }
          .landing-steps-grid { grid-template-columns: 1fr !important; }
          .landing-pricing-grid { grid-template-columns: 1fr !important; max-width: 380px !important; }
          .landing-nav { padding: 12px 16px !important; }
          .landing-nav-buttons { gap: 6px !important; }
          /* 44px minimum touch target — small type is fine, small hit areas are not */
          .landing-nav-buttons button { font-size: 12px !important; padding: 10px 14px !important; min-height: 44px; }

          /* App grids stack on phones (inline grid styles need !important here) */
          .two-col { grid-template-columns: 1fr !important; }
          .dash-stats { grid-template-columns: 1fr 1fr !important; }
          .status-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .step-tabs { overflow-x: auto; }
          .step-tabs > button { min-width: 120px; }
          .filters-row > select, .filters-row > button { flex: 1 1 140px; }
          .landing-footer { justify-content: center !important; text-align: center; }

          /* Editorial story spread stacks on small screens */
          .landing-story-grid { grid-template-columns: 1fr !important; }
          .landing-story-grid .landing-story-image { min-height: 260px !important; }
          .landing-story-grid img, .landing-story-image > div:first-of-type { border-radius: 14px 14px 0 0 !important; }

          /* App shell */
          .mobile-menu-btn { display: block !important; }
          .mobile-overlay { display: block !important; }
          .app-sidebar { transform: translateX(-100%); }
          .app-sidebar.open { transform: translateX(0); }
          .app-main { margin-left: 0 !important; padding: 20px 16px !important; padding-top: 56px !important; }
        }
      `}</style>
    </div>
  );
}
