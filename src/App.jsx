import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ============================================================
// DESIGN SYSTEM — Phase A: Brand Voice & Visual Identity
// ============================================================
const COLORS = {
  bg: "#08080d",
  surface: "#0f0f17",
  card: "#141420",
  cardHover: "#1a1a2d",
  border: "#1e1e30",
  borderHover: "#2a2a42",
  gold: "#c9a227",
  goldLight: "#d4b545",
  goldDim: "rgba(201,162,39,0.12)",
  goldGlow: "rgba(201,162,39,0.25)",
  teal: "#4ecdc4",
  tealDim: "rgba(78,205,196,0.12)",
  pink: "#e04040",
  pinkDim: "rgba(224,64,64,0.12)",
  purple: "#4ecdc4",
  purpleDim: "rgba(78,205,196,0.12)",
  orange: "#c9a227",
  text: "#e8e4dc",
  textMuted: "#8a8a9a",
  textDim: "#555566",
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

// ============================================================
// STRIPE CONFIG
// ============================================================
const STRIPE_PRICES = {
  premium: "price_1TCNywCKmFEw0ke8GFSBvuVc",
  seasonal: "price_1TCNzyCKmFEw0ke8Ej82CRAM",
};

async function fetchScholarshipsFromSupabase() {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from("scholarships").select("*");
    if (error || !data) return null;
    return data.map(r => ({
      id: r.id, name: r.name, criteria: r.criteria || "",
      link: r.link || "", deadline: r.deadline || "Varies",
      amount: r.amount || "Varies", needBased: r.need_based || "",
      country: r.country || "US",
    }));
  } catch(e) { return null; }
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
  {id:"db12aa0c",name:"National Merit Scholarship",criteria:"U.S. high school students. Based on PSAT/NMSQT scores taken in junior year. Must be enrolled or plan to enroll full-time in college.",link:"https://www.nationalmerit.org/",deadline:"2026-10-01",amount:"$2,500+",needBased:"",country:"US"},
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

// ============================================================
// PROFILE QUESTIONS
// ============================================================
const PROFILE_QUESTIONS = [
  {id:"name",q:"What is your full name?",type:"text",placeholder:"First Last",step:0},
  {id:"email",q:"Email address?",type:"text",placeholder:"you@email.com",step:0},
  {id:"phone",q:"Phone number?",type:"text",placeholder:"(555) 123-4567",step:0},
  {id:"location",q:"Where are you located? (City, State)",type:"text",placeholder:"Rochester, NY",step:0},
  {id:"citizenship",q:"Citizenship / Residency status?",type:"select",options:["U.S. Citizen","Dual Citizen (U.S./Canada)","Permanent Resident","DACA/TPS","International Student","Other"],step:1},
  {id:"ethnicity",q:"How do you identify? (helps match heritage-specific scholarships)",type:"multiselect",options:["African American/Black","Hispanic/Latino","Asian/Pacific Islander","Native American/Indigenous","White/Caucasian","Multiracial","Prefer not to say"],step:1},
  {id:"gpa",q:"Current GPA (unweighted)?",type:"text",placeholder:"3.7",step:1},
  {id:"satact",q:"SAT or ACT score (if taken)?",type:"text",placeholder:"1350 SAT or 30 ACT",step:1},
  {id:"school",q:"Current or most recent high school?",type:"text",placeholder:"Lincoln High School",step:1},
  {id:"gradYear",q:"Graduation year?",type:"select",options:["2025","2026","2027","2028"],step:1},
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
  {title: "Basic Info", desc: "Name, contact, and location"},
  {title: "Background", desc: "Academics, identity, and school"},
  {title: "Strengths", desc: "Major, activities, and achievements"},
  {title: "Your Story", desc: "Personal narrative and voice"},
];

// ============================================================
// STYLE TEMPLATES
// ============================================================
const DEFAULT_TEMPLATES = [
  {id:"narrative",name:"The Storyteller",description:"Opens with a personal anecdote, weaves narrative throughout. Best for scholarships that value personal journey.",rules:"1. Open with a specific moment or memory. 2. Use I-statements. 3. Connect personal story to scholarship mission. 4. Close with forward-looking vision. 5. NO AI-isms: avoid 'delve','foster','landscape','cutting-edge'.",icon:"✍"},
  {id:"evidence",name:"The Scientist",description:"Lead with evidence and accomplishments. Data-driven. Best for STEM and merit-based scholarships.",rules:"1. Open with a concrete achievement or metric. 2. Use specific numbers and outcomes. 3. Frame experiences as evidence of capability. 4. Connect technical skills to broader impact. 5. NO fluff: replace 'I am passionate about' with 'My work in X demonstrated...'",icon:"🔬"},
  {id:"mission",name:"The Mission Matcher",description:"Deeply aligns candidate values with the scholarship’s stated mission. Best for foundation and organization scholarships.",rules:"1. Reference the scholarship's mission statement directly. 2. Mirror their language naturally. 3. Show how your goals amplify their mission. 4. Provide specific examples of aligned work. 5. Keep tone collaborative, not sycophantic.",icon:"🎯"},
  {id:"underdog",name:"The Overcomer",description:"Emphasizes resilience, challenges overcome, and growth. Best for need-based and adversity scholarships.",rules:"1. Be honest about challenges without being pitiful. 2. Show agency — what YOU did about it. 3. Frame hardship as fuel, not excuse. 4. Demonstrate growth trajectory. 5. End with strength and vision, not gratitude alone.",icon:"💪"},
];

// ============================================================
// MATCH SCORING ENGINE
// ============================================================
function scoreMatch(profile, scholarship) {
  let score = 0;
  let reasons = [];
  const c = (scholarship.criteria || "").toLowerCase();
  const n = (scholarship.name || "").toLowerCase();

  if (profile.citizenship) {
    const cit = profile.citizenship.toLowerCase();
    if (c.includes("u.s. citizen") && (cit.includes("u.s.") || cit.includes("dual"))) { score += 20; reasons.push("Citizenship eligible"); }
    if (c.includes("daca") && cit.includes("daca")) { score += 25; reasons.push("DACA eligible"); }
  }

  if (profile.ethnicity && profile.ethnicity.length > 0) {
    const eth = profile.ethnicity.map(e => e.toLowerCase()).join(" ");
    if ((c.includes("african american") || n.includes("african american") || c.includes("black")) && eth.includes("african")) { score += 25; reasons.push("Heritage match"); }
    if ((c.includes("hispanic") || n.includes("hispanic") || c.includes("latino")) && eth.includes("hispanic")) { score += 25; reasons.push("Heritage match"); }
    if ((c.includes("asian") || n.includes("asian") || c.includes("pacific islander")) && eth.includes("asian")) { score += 25; reasons.push("Heritage match"); }
    if ((c.includes("native american") || c.includes("indigenous") || c.includes("tribal")) && eth.includes("native")) { score += 25; reasons.push("Heritage match"); }
  }

  if (profile.gpa) {
    const gpa = parseFloat(profile.gpa);
    const gpaMatch = c.match(/(\d\.\d)\+?\s*gpa|gpa\s*(?:of\s*)?(\d\.\d)/);
    if (gpaMatch) {
      const req = parseFloat(gpaMatch[1] || gpaMatch[2]);
      if (gpa >= req) { score += 15; reasons.push(`GPA ${gpa} meets ${req} req`); }
    } else if (gpa >= 3.0) { score += 10; reasons.push("Strong GPA"); }
  }

  if (profile.financialNeed) {
    const need = profile.financialNeed.toLowerCase();
    if (scholarship.needBased === "Y" && need.includes("yes")) { score += 15; reasons.push("Need-based match"); }
    if (scholarship.needBased !== "Y" && !need.includes("yes")) { score += 5; reasons.push("Merit-based fit"); }
  }

  if (profile.intendedMajor) {
    const major = profile.intendedMajor.toLowerCase();
    if ((c.includes("stem") || c.includes("science") || c.includes("engineering")) &&
        (major.includes("science") || major.includes("engineering") || major.includes("computer") || major.includes("math"))) {
      score += 15; reasons.push("STEM field match");
    }
  }

  if (profile.activities && profile.activities.length > 30) {
    if (c.includes("leadership")) { score += 10; reasons.push("Leadership valued"); }
    if (c.includes("community") || c.includes("volunteer")) { score += 10; reasons.push("Service match"); }
  }

  if (profile.gradYear && (c.includes("high school senior") || c.includes("graduating"))) {
    score += 5; reasons.push("Grade level match");
  }

  return { score: Math.min(score, 100), reasons };
}

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

function Button({ children, onClick, variant = "primary", disabled, style, icon }) {
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
    <button onClick={onClick} disabled={disabled} style={{
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
      <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.4 }}>{icon}</div>
      <div style={{ fontSize: 18, fontFamily: FONTS.heading, color: COLORS.textMuted, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, fontFamily: FONTS.body, color: COLORS.textDim, marginBottom: 24, maxWidth: 320, margin: "0 auto 24" }}>{desc}</div>
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

// ============================================================
// MAIN APP COMPONENT
// ============================================================
export default function MeritLaunch() {
  const [view, setView] = useState("landing");
  const [profile, setProfile] = useState({});
  const [bragSheet, setBragSheet] = useState("");
  const [scholarshipDB, setScholarshipDB] = useState(DEFAULT_SCHOLARSHIP_DB);
  const [dbLastUpdated, setDbLastUpdated] = useState("2026-02-11");
  const [dbSource, setDbSource] = useState("built-in");
  const [searchQuery, setSearchQuery] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [filterNeedBased, setFilterNeedBased] = useState("all");
  const [filterCountry, setFilterCountry] = useState("all");
  const [matchResults, setMatchResults] = useState([]);
  const [selectedScholarship, setSelectedScholarship] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(DEFAULT_TEMPLATES[0]);
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [generatedLetter, setGeneratedLetter] = useState("");
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
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [userSubscription, setUserSubscription] = useState("free"); // free | premium | seasonal
  const [monthlyLettersUsed, setMonthlyLettersUsed] = useState(0);
  const [monthlyMatchesUsed, setMonthlyMatchesUsed] = useState(0);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Feature gating
  const FREE_LIMITS = { matchesPerMonth: 5, lettersPerMonth: 2 };
  const PRO_LIMITS = { lettersPerMonth: 50 };
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

  // Sync usage counters to Supabase
  const syncUsageToSupabase = useCallback(async (field) => {
    if (!authUser || !supabase) return;
    try {
      const updates = { updated_at: new Date().toISOString() };
      if (field === "matches") {
        updates.matches_used_this_month = monthlyMatchesUsed + 1;
      } else if (field === "letters") {
        updates.letters_used_this_month = monthlyLettersUsed + 1;
      }
      await supabase.from("user_profiles").update(updates).eq("id", authUser.id);
    } catch (e) { console.error("Usage sync failed:", e); }
  }, [authUser, monthlyMatchesUsed, monthlyLettersUsed]);

  // Stripe checkout handler
  const handleCheckout = useCallback(async (plan) => {
    if (!authUser) {
      setShowAuthModal(true);
      return;
    }
    setCheckoutLoading(true);
    try {
      const isSubscription = plan === "premium";
      const resp = await fetch("/api/create-checkout", {
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
      notify("Payment successful! Your account has been upgraded.", "success");
      setUserSubscription("premium"); // Optimistic — webhook will confirm
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("checkout") === "cancelled") {
      notify("Checkout cancelled. No charges were made.", "error");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // File reader helper
  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const name = file.name.toLowerCase();
      if (name.endsWith(".pdf")) {
        reader.onload = async (e) => {
          try {
            const uint8 = new Uint8Array(e.target.result);
            const text = new TextDecoder("utf-8", { fatal: false }).decode(uint8);
            const readable = text.match(/[\x20-\x7E]{4,}/g) || [];
            const cleaned = readable.join(" ").replace(/\s+/g, " ").slice(0, 15000);
            if (cleaned.length > 100) {
              resolve(cleaned);
            } else {
              resolve(`[PDF DOCUMENT]\nFilename: ${file.name}\nRaw text fragments:\n${readable.slice(0, 200).join("\n")}`);
            }
          } catch(err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      } else {
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
      }
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
      notify("Error reading file. Try pasting the content instead.", "error");
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
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: `Search for this scholarship page and extract the key details: ${scholarshipUrl}\n\nReturn a structured summary with: Scholarship Name, Organization, Eligibility/Criteria, Award Amount, Deadline, and Application Requirements.` }]
        })
      });
      const data = await response.json();
      const text = data.content?.map(b => b.text || "").filter(Boolean).join("\n") || "";
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
    try {
      const { data, error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
      if (error) { setAuthError(error.message); }
      else { setAuthError(""); notify("Check your email for a confirmation link!", "success"); setAuthMode("signin"); }
    } catch(e) { setAuthError("Something went wrong. Please try again."); }
    setAuthSubmitting(false);
  };

  const handleSignIn = async () => {
    setAuthError(""); setAuthSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
      if (error) { setAuthError(error.message); }
      else { setShowAuthModal(false); setAuthEmail(""); setAuthPassword(""); notify("Welcome back!", "success"); }
    } catch(e) { setAuthError("Something went wrong. Please try again."); }
    setAuthSubmitting(false);
  };

  const handleForgotPassword = async () => {
    setAuthError(""); setAuthSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(authEmail, {
        redirectTo: window.location.origin,
      });
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
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) { setAuthError(error.message); }
      else {
        notify("Password updated successfully!", "success");
        setShowAuthModal(false); setNewPassword(""); setConfirmPassword(""); setAuthMode("signin");
      }
    } catch(e) { setAuthError("Something went wrong. Please try again."); }
    setAuthSubmitting(false);
  };

  const handleSignOut = async () => {
    await supabase?.auth.signOut();
    setAuthUser(null);
    notify("Signed out.", "info");
  };

  // Load data on mount + auth listener
  useEffect(() => {
    // Load local data first (fast)
    const p = store.get("scholarbot-profile"); if (p) setProfile(p);
    const l = store.get("scholarbot-letters"); if (l) setSavedLetters(l);
    const t = store.get("scholarbot-templates"); if (t) setTemplates(t);
    const a = store.get("scholarbot-answers"); if (a) setAppAnswers(a);

    // Fetch scholarships from Supabase
    fetchScholarshipsFromSupabase().then(rows => {
      if (rows && rows.length > 0) {
        setScholarshipDB(rows);
        setDbLastUpdated(new Date().toISOString().split("T")[0]);
        setDbSource("synced");
      }
    });

    // Auth listener
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setAuthUser(session?.user ?? null);
        setAuthLoading(false);
        // If logged in, try to load cloud profile
        if (session?.user) {
          loadProfileFromSupabase(session.user.id).then(cloudProfile => {
            if (cloudProfile && Object.keys(cloudProfile).length > 0) {
              setProfile(cloudProfile);
              store.set("scholarbot-profile", cloudProfile);
            }
          });
          loadLettersFromSupabase(session.user.id).then(cloudLetters => {
            if (cloudLetters && cloudLetters.length > 0) {
              setSavedLetters(cloudLetters);
            }
          });
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
        // Load subscription status from Supabase
        if (user && supabase) {
          const { data: prof } = await supabase
            .from("user_profiles")
            .select("subscription_status, letters_used_this_month, matches_used_this_month, usage_reset_at")
            .eq("id", user.id)
            .single();
          if (prof) {
            setUserSubscription(prof.subscription_status || "free");
            // Check if usage needs monthly reset
            const resetAt = prof.usage_reset_at ? new Date(prof.usage_reset_at) : new Date(0);
            const now = new Date();
            const monthsSinceReset = (now.getFullYear() - resetAt.getFullYear()) * 12 + now.getMonth() - resetAt.getMonth();
            if (monthsSinceReset >= 1) {
              // Reset counters for new month
              setMonthlyLettersUsed(0);
              setMonthlyMatchesUsed(0);
              supabase.from("user_profiles").update({
                letters_used_this_month: 0,
                matches_used_this_month: 0,
                usage_reset_at: now.toISOString(),
              }).eq("id", user.id);
            } else {
              setMonthlyLettersUsed(prof.letters_used_this_month || 0);
              setMonthlyMatchesUsed(prof.matches_used_this_month || 0);
            }
          }
          // Fetch deadline alerts
          const { data: alerts } = await supabase
            .from("notifications")
            .select("*")
            .eq("user_id", user.id)
            .eq("read", false)
            .order("created_at", { ascending: false })
            .limit(10);
          if (alerts) setDeadlineAlerts(alerts);

          // Load tracked applications from cloud
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
            // Merge with local, preferring cloud data
            const localIds = new Set(merged.map(a => a.scholarshipId));
            const localOnly = trackedApps.filter(a => !localIds.has(a.scholarshipId));
            const combined = [...merged, ...localOnly];
            setTrackedApps(combined);
            localStorage.setItem("scholarbot-tracked-apps", JSON.stringify(combined));
          }
        }
      });

      return () => subscription?.unsubscribe();
    } else {
      setAuthLoading(false);
    }
  }, []);

  const notify = (msg, type = "info") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const saveProfile = (p) => {
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

  const profileCompletion = Math.round(
    Object.keys(profile).filter(k => profile[k] && (Array.isArray(profile[k]) ? profile[k].length > 0 : true)).length / PROFILE_QUESTIONS.length * 100
  );

  // Matching
  const runMatching = useCallback(() => {
    if (!profile.name) { notify("Please complete your profile first.", "error"); return; }
    if (!canMatch) { setShowUpgradeModal(true); return; }
    const results = scholarshipDB.map(s => {
      const { score, reasons } = scoreMatch(profile, s);
      return { ...s, matchScore: score, matchReasons: reasons };
    }).filter(s => s.matchScore > 0).sort((a,b) => b.matchScore - a.matchScore);
    setMatchResults(results);
    setMonthlyMatchesUsed(prev => prev + 1);
    syncUsageToSupabase("matches");
    setView("matches");
    notify(`Found ${results.length} matches!`, "success");
  }, [profile, scholarshipDB, canMatch]);

  // Letter generation
  const generateLetter = async () => {
    const hasDbSelection = scholarshipInputMode === "database" && selectedScholarship;
    const hasCustomInput = scholarshipInputMode !== "database" && customScholarshipText.trim();
    if (!hasDbSelection && !hasCustomInput) {
      notify(scholarshipInputMode === "database" ? "Select a scholarship from the database." : "Please provide scholarship details.", "error");
      return;
    }
    if (!profile.name) { notify("Complete your profile first.", "error"); return; }
    if (!canGenerateLetter) {
      if (isPremium) {
        notify(`You've used all ${PRO_LIMITS.lettersPerMonth} letters this month. Your limit resets next month.`, "error");
      } else {
        setShowUpgradeModal(true);
      }
      return;
    }

    setGeneratingLetter(true);
    setGeneratedLetter("");
    setMonthlyLettersUsed(prev => prev + 1);
    syncUsageToSupabase("letters");

    let scholarshipDetails, scholarshipLabel;
    if (hasDbSelection) {
      scholarshipLabel = selectedScholarship.name;
      scholarshipDetails = `SCHOLARSHIP DETAILS (from database):\n- Name: ${selectedScholarship.name}\n- Criteria: ${selectedScholarship.criteria}\n- Amount: ${selectedScholarship.amount}\n- Link: ${selectedScholarship.link}`;
    } else {
      scholarshipLabel = customScholarshipName || "Custom Scholarship";
      scholarshipDetails = `SCHOLARSHIP DETAILS (provided by user):\n- Name: ${customScholarshipName || "Not specified"}\n${scholarshipUrl ? `- URL: ${scholarshipUrl}\n` : ""}- Full Description:\n${customScholarshipText.slice(0, 8000)}`;
    }

    const profileSummary = `CANDIDATE: ${profile.name}\nLOCATION: ${profile.location || "N/A"}\nCITIZENSHIP: ${profile.citizenship || "N/A"}\nHERITAGE: ${(profile.ethnicity || []).join(", ")}\nGPA: ${profile.gpa || "N/A"} | TEST SCORES: ${profile.satact || "N/A"}\nINTENDED MAJOR: ${profile.intendedMajor || "N/A"}\nGRADUATION: ${profile.gradYear || "N/A"}\nFINANCIAL NEED: ${profile.financialNeed || "N/A"}\nACTIVITIES: ${profile.activities || "N/A"}\nAWARDS: ${profile.awards || "N/A"}\nCOMMUNITY SERVICE: ${profile.communityService || "N/A"}\nPERSONAL STORY: ${profile.personalStory || "N/A"}\nCAREER GOAL: ${profile.careerGoal || "N/A"}\nWRITING VOICE: ${profile.writingStyle || "Warm and narrative"}\nBRAG SHEET: ${bragSheet || "None"}\nAPP ANSWERS: ${JSON.stringify(appAnswers)}`;

    const systemPrompt = `You are a scholarship letter writer. Your job is not to write a generic impressive letter. Write a letter that sounds unmistakably like THIS student wrote it — with their specific experiences, their particular details, and their real voice. A scholarship committee member should finish the letter and think: "I know who this person is." Not: "This applicant has strong qualifications."

STYLE: ${selectedTemplate.name}
${selectedTemplate.rules}

SPECIFICITY IS EVERYTHING:
Every paragraph must contain at least one concrete detail from the student's profile: a real school name, a specific activity or club, an actual number or achievement, a place, or a named person. Never write "throughout my high school career" — write something specific. Never write "I developed leadership skills" — write what the leadership actually looked like. Do not invent experiences the student did not mention. If a field is blank, omit it rather than filling with generic claims.

SENTENCE LENGTH — VARY IT DELIBERATELY:
Use short sentences (under 8 words) for emphasis and rhythm. Use medium sentences (15–25 words) for narration and explanation. Use longer sentences (30+ words) for immersive scenes and analysis, sparingly. Never write more than two sentences of similar length in a row. A paragraph of three long sentences reads as machine-generated.

PARAGRAPH LENGTH — MIX IT UP:
Opening paragraph: 3–4 sentences. Body paragraphs: alternate between 2-sentence punchy ones and 5–6 sentence immersive ones. Closing paragraph: 3–4 sentences. Never end a section with a neat summary statement — real writing doesn't wrap itself up neatly.

EMOTION — ONE REAL ONE:
Pick one emotion this student probably feels: pride, determination, quiet resolve, frustration turned to growth. Show it through a specific action or memory. Never write "I am passionate about" — show what the passion made them actually do.

BANNED WORDS — NEVER USE ANY OF THESE:
delve, bolster, harness (abstract sense), unlock, unleash, empower (self-referential), underscore, illuminate, elucidate, embark, unravel, reimagine, revolutionize, transcend, resonate, reverberate, grapple (abstract), intertwine, garner, amplify (abstract), glean, maximize, unveil (abstract), champion (self-referential), spearhead, multifaceted, seamless, cutting-edge, holistic, meticulous, innovative, vibrant (abstract), compelling, invaluable, paramount, enduring, indelible, poignant, timeless, relentless, tireless, noteworthy, commendable, exemplary, unprecedented, captivating, nuanced (standalone), unparalleled, unwavering, ever-evolving, game-changing, tapestry, beacon (metaphor), synergy, paradigm shift, catalyst (abstract), interplay, plethora, trajectory (abstract), landscape, foster, testament, thrilled, elevate

BANNED SENTENCE STARTERS — NEVER OPEN A SENTENCE OR PARAGRAPH WITH:
"In today's world," / "Now more than ever," / "As technology continues to evolve," / "Furthermore," / "Moreover," / "Additionally," / "Notably," / "Crucially," / "It is important to note" / "One of the most important" / "I have always been passionate about" / "Ever since I was a child" / "I want to make a difference"

BANNED CLOSING PHRASES — NEVER END THE LETTER WITH:
"In conclusion," / "To summarize," / "Overall," / "Ultimately," / "I would be honored to be selected" / "I am a strong candidate" / "This scholarship would mean the world to me" / "I am passionate about" (as a claim — show it instead)

PUNCTUATION RULES:
No em-dashes (—). Replace with a comma and conjunction, a period, parentheses, or a colon.
Always use Oxford commas: "biology, chemistry, and math" not "biology, chemistry and math."
Open the letter with a scene, a fact, a question, or an action in progress. Never open with "My name is" or "I am applying for."

FORMAT:
350–450 words. Narrative prose only — no bullet points, no headers, no bold text in the letter body. Standard paragraph breaks.

CANDIDATE PROFILE:
${profileSummary}`;

    try {
      const response = await fetch("/api/generate-stream", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1200, system: systemPrompt,
          messages: [{ role: "user", content: `Write a scholarship application letter for "${scholarshipLabel}".\n\n${scholarshipDetails}\n\nWrite a 350–450 word letter that sounds like this specific student wrote it. Use their actual details from the profile. Open with a specific moment or scene, not a statement of intent.` }]
        })
      });

      if (!response.ok) {
        // Fallback to non-streaming if streaming endpoint fails
        const errData = await response.json().catch(() => ({}));
        setGeneratedLetter(errData.error || "Error generating letter.");
        setGeneratingLetter(false);
        return;
      }

      // Parse SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // Parse SSE events from the chunk
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6);
            if (jsonStr === "[DONE]") continue;
            try {
              const evt = JSON.parse(jsonStr);
              if (evt.type === "content_block_delta" && evt.delta?.text) {
                fullText += evt.delta.text;
                setGeneratedLetter(fullText);
              }
            } catch(parseErr) { /* skip non-JSON lines */ }
          }
        }
      }

      if (!fullText) setGeneratedLetter("Error: Empty response from AI service.");
    } catch(e) {
      setGeneratedLetter("Error: Could not connect to the AI service.");
    }
    setGeneratingLetter(false);
  };

  // Profile generation
  const generateCandidateProfile = async () => {
    if (!profile.name) { notify("Complete your profile first.", "error"); return; }
    setGeneratingLetter(true);
    const profileData = PROFILE_QUESTIONS.map(q => `${q.q}: ${Array.isArray(profile[q.id]) ? profile[q.id].join(", ") : (profile[q.id] || "N/A")}`).join("\n");
    try {
      const response = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000,
          messages: [{ role: "user", content: `Create a candidate profile in Markdown format for scholarship applications:\n\n# Candidate Profile: [Name]\n\n**Contact Info:**\n* Email / Phone / Location\n\n**Voice:** [Describe their writing voice]\n\n**Authenticity & Voice Rules (CRITICAL):**\n[4 specific rules]\n\n**Key Directives:**\n[5 directives based on strongest assets]\n\nBASE THIS ON:\n${profileData}${bragSheet ? `\nBRAG SHEET:\n${bragSheet}` : ""}${Object.keys(appAnswers).length > 0 ? `\nAPPLICATION ANSWERS:\n${JSON.stringify(appAnswers)}` : ""}` }]
        })
      });
      const data = await response.json();
      setGeneratedProfile(data.content?.map(b => b.text || "").join("\n") || "Error.");
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

  const filteredScholarships = scholarshipDB.filter(s => {
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
    return matchesSearch && matchesNeed && matchesCountry;
  });

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

  // Deadline helpers
  const getDeadlineStatus = (deadline) => {
    if (!deadline || deadline === "Varies" || deadline === "Nomination Only") return { label: deadline || "Varies", color: COLORS.textDim };
    const d = new Date(deadline);
    const now = new Date();
    const days = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
    if (days < 0) return { label: "Expired", color: COLORS.pink };
    if (days <= 14) return { label: `${days}d left`, color: COLORS.pink };
    if (days <= 60) return { label: `${days}d left`, color: COLORS.orange };
    return { label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), color: COLORS.teal };
  };

  const navItems = [
    {id:"home",icon:"◇",label:"Dashboard"},
    {id:"profile",icon:"◈",label:"Build Profile"},
    {id:"search",icon:"⬡",label:"Scholarships"},
    {id:"matches",icon:"◆",label:"My Matches"},
    {id:"apply",icon:"▣",label:"App Prep"},
    {id:"generate",icon:"◉",label:"Letter Gen"},
    {id:"templates",icon:"▤",label:"Templates"},
    {id:"saved",icon:"▫",label:"Saved"},
    {id:"tracker",icon:"▦",label:"Tracker"},
  ];

  const isLanding = view === "landing";

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div style={{ fontFamily: FONTS.heading, minHeight: "100vh", background: COLORS.bg, color: COLORS.text, overflow: "hidden" }}>

      {/* NOTIFICATION TOAST */}
      {notification && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
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
      {showAuthModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10000,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
        }} onClick={() => { if (authMode !== "reset") setShowAuthModal(false); }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: COLORS.card, border: `1px solid ${COLORS.border}`,
            borderRadius: 16, padding: 36, width: 380, maxWidth: "90vw",
            boxShadow: `0 24px 80px rgba(0,0,0,0.5)`,
          }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontFamily: FONTS.body, letterSpacing: 3, color: COLORS.gold, textTransform: "uppercase", marginBottom: 4 }}>MeritLaunch</div>
              <h2 style={{ fontSize: 24, fontWeight: 400, marginBottom: 6 }}>
                {authMode === "signup" ? "Create Account" : authMode === "forgot" ? "Reset Password" : authMode === "reset" ? "Set New Password" : "Welcome Back"}
              </h2>
              <p style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted }}>
                {authMode === "signup" ? "Start finding scholarships in minutes" : authMode === "forgot" ? "We'll send you a reset link" : authMode === "reset" ? "Choose a new password for your account" : "Sign in to your account"}
              </p>
            </div>

            {authError && (
              <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13, fontFamily: FONTS.body, background: COLORS.pinkDim, color: COLORS.pink, border: `1px solid ${COLORS.pink}33` }}>
                {authError}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {authMode === "reset" ? (
                <>
                  <input
                    type="password" placeholder="New password (min 6 characters)" value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && confirmPassword && handleUpdatePassword()}
                    style={{
                      padding: "12px 16px", borderRadius: 10, fontSize: 14, fontFamily: FONTS.body,
                      background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.text,
                      outline: "none",
                    }}
                  />
                  <input
                    type="password" placeholder="Confirm new password" value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleUpdatePassword()}
                    style={{
                      padding: "12px 16px", borderRadius: 10, fontSize: 14, fontFamily: FONTS.body,
                      background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.text,
                      outline: "none",
                    }}
                  />
                  <Button
                    onClick={handleUpdatePassword}
                    disabled={authSubmitting || !newPassword || !confirmPassword}
                    style={{ width: "100%", justifyContent: "center", fontSize: 15, padding: "14px 24px", marginTop: 4 }}
                  >
                    {authSubmitting ? "Please wait..." : "Update Password"}
                  </Button>
                </>
              ) : (
                <>
                  <input
                    type="email" placeholder="Email address" value={authEmail}
                    onChange={e => setAuthEmail(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (authMode === "forgot" ? handleForgotPassword() : authMode === "signup" ? handleSignUp() : handleSignIn())}
                    style={{
                      padding: "12px 16px", borderRadius: 10, fontSize: 14, fontFamily: FONTS.body,
                      background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.text,
                      outline: "none",
                    }}
                  />
                  {authMode !== "forgot" && (
                    <input
                      type="password" placeholder="Password (min 6 characters)" value={authPassword}
                      onChange={e => setAuthPassword(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && (authMode === "signup" ? handleSignUp() : handleSignIn())}
                      style={{
                        padding: "12px 16px", borderRadius: 10, fontSize: 14, fontFamily: FONTS.body,
                        background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.text,
                        outline: "none",
                      }}
                    />
                  )}
                  <Button
                    onClick={authMode === "forgot" ? handleForgotPassword : authMode === "signup" ? handleSignUp : handleSignIn}
                    disabled={authSubmitting || !authEmail}
                    style={{ width: "100%", justifyContent: "center", fontSize: 15, padding: "14px 24px", marginTop: 4 }}
                  >
                    {authSubmitting ? "Please wait..." : authMode === "signup" ? "Create Account" : authMode === "forgot" ? "Send Reset Link" : "Sign In"}
                  </Button>
                </>
              )}
            </div>

            <div style={{ marginTop: 20, textAlign: "center", fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted }}>
              {authMode === "signin" && (
                <>
                  <span style={{ cursor: "pointer", color: COLORS.gold }} onClick={() => { setAuthMode("forgot"); setAuthError(""); }}>Forgot password?</span>
                  <span style={{ margin: "0 8px" }}>|</span>
                  <span>No account? <span style={{ cursor: "pointer", color: COLORS.gold }} onClick={() => { setAuthMode("signup"); setAuthError(""); }}>Sign up</span></span>
                </>
              )}
              {authMode === "signup" && (
                <span>Already have an account? <span style={{ cursor: "pointer", color: COLORS.gold }} onClick={() => { setAuthMode("signin"); setAuthError(""); }}>Sign in</span></span>
              )}
              {authMode === "forgot" && (
                <span style={{ cursor: "pointer", color: COLORS.gold }} onClick={() => { setAuthMode("signin"); setAuthError(""); }}>Back to sign in</span>
              )}
              {authMode === "reset" && (
                <span style={{ fontSize: 12, color: COLORS.textMuted }}>Enter your new password above to complete the reset.</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* UPGRADE MODAL */}
      {showUpgradeModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10000,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
        }} onClick={() => setShowUpgradeModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: COLORS.card, border: `1px solid ${COLORS.gold}44`,
            borderRadius: 16, padding: 36, width: 420, maxWidth: "90vw",
            boxShadow: `0 24px 80px rgba(0,0,0,0.5), 0 0 40px ${COLORS.goldGlow}`,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>&#9733;</div>
            <h2 style={{ fontSize: 24, fontWeight: 400, marginBottom: 8 }}>You've hit your free limit</h2>
            <p style={{ fontSize: 14, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 8 }}>
              Free accounts get {FREE_LIMITS.matchesPerMonth} matches and {FREE_LIMITS.lettersPerMonth} letters per month.
            </p>
            <p style={{ fontSize: 14, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 24 }}>
              Upgrade to Premium for unlimited matches, {PRO_LIMITS.lettersPerMonth} AI letters per month, all 4 writing templates, and deadline alerts.
            </p>
            <div style={{
              background: COLORS.surface, borderRadius: 12, padding: "20px 24px", marginBottom: 24,
              border: `1px solid ${COLORS.gold}33`,
            }}>
              <div style={{ fontSize: 32, fontWeight: 400, marginBottom: 4 }}>
                $9<span style={{ fontSize: 16 }}>.99</span><span style={{ fontSize: 13, color: COLORS.textDim }}>/month</span>
              </div>
              <div style={{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.textDim }}>Cancel anytime. No commitment.</div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 12 }}>
              <Button variant="ghost" onClick={() => setShowUpgradeModal(false)}>Maybe Later</Button>
              <Button disabled={checkoutLoading} onClick={() => { setShowUpgradeModal(false); handleCheckout("premium"); }}>
                {checkoutLoading ? "Loading..." : "Upgrade to Premium"}
              </Button>
            </div>
            <button onClick={() => { setShowUpgradeModal(false); handleCheckout("seasonal"); }} style={{
              background: "none", border: "none", color: COLORS.teal, cursor: "pointer",
              fontFamily: FONTS.body, fontSize: 13, textDecoration: "underline",
            }}>
              Or get the Seasonal Pass for $29.99 (one-time)
            </button>
          </div>
        </div>
      )}

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
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 11, fontFamily: FONTS.body, letterSpacing: 3, color: COLORS.gold, textTransform: "uppercase" }}>MeritLaunch</span>
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
                  <Button onClick={() => { setAuthMode("signup"); setShowAuthModal(true); }} style={{ fontSize: 13, padding: "8px 20px" }}>Get Started Free</Button>
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
            {/* Background Video */}
            <video
              autoPlay muted loop playsInline
              poster="/hero-poster.jpg"
              style={{
                position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                objectFit: "cover", zIndex: 0, opacity: 0.35,
              }}
            >
              <source src="/hero-bg-compressed.mp4" type="video/mp4" />
            </video>
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
                AI-powered scholarship matching and application letters that sound like you. Not like a robot. Built by a parent who's been where you are.
              </p>
              <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
                <Button onClick={() => setView("profile")} style={{ fontSize: 16, padding: "16px 36px" }}>
                  Start Free
                </Button>
                <Button variant="secondary" onClick={() => setView("search")} style={{ fontSize: 16, padding: "16px 36px" }}>
                  Browse {scholarshipDB.length} Scholarships
                </Button>
              </div>
            </div>
          </div>

          {/* Social proof strip */}
          <div className="landing-stats-grid reveal" style={{
            display: "flex", justifyContent: "center", gap: 48, padding: "32px 20px",
            borderTop: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}`,
            flexWrap: "wrap",
          }}>
            {[
              { val: `${scholarshipDB.length}+`, label: "Scholarships" },
              { val: "$2.3M+", label: "In Opportunities" },
              { val: "4", label: "Writing Styles" },
              { val: "Built by a Parent", label: "Who Gets It" },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 400, color: COLORS.gold, fontFamily: FONTS.heading }}>{s.val}</div>
                <div style={{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.textDim, marginTop: 2 }}>{s.label}</div>
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
                { icon: "◈", title: "Build Your Profile", desc: "Answer guided questions or upload your brag sheet. MeritLaunch learns your story, strengths, and goals.", color: COLORS.gold },
                { icon: "◆", title: "Get Matched", desc: "Our scoring engine analyzes eligibility, heritage, GPA, need, and field to rank your best-fit scholarships.", color: COLORS.teal },
                { icon: "◉", title: "Generate Letters", desc: "Choose a writing style. Draft application letters in your own authentic voice, grounded in your real story - you stay the author.", color: COLORS.teal },
              ].map((f, i) => (
                <GlowCard key={i} glow={f.color} style={{ textAlign: "center", padding: "40px 28px" }}>
                  <div style={{ fontSize: 40, marginBottom: 16, color: f.color }}>{f.icon}</div>
                  <div style={{ fontSize: 12, fontFamily: FONTS.body, color: f.color, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Step {i + 1}</div>
                  <h3 style={{ fontSize: 20, fontWeight: 400, marginBottom: 10 }}>{f.title}</h3>
                  <p style={{ fontSize: 14, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6 }}>{f.desc}</p>
                </GlowCard>
              ))}
            </div>
          </div>

          {/* Origin Story — Real Testimonial */}
          <div style={{ padding: "80px 40px", background: COLORS.surface }}>
            <div style={{ maxWidth: 800, margin: "0 auto" }}>
              <h2 style={{ fontSize: 30, fontWeight: 400, textAlign: "center", marginBottom: 12 }}>We've Been Where You Are</h2>
              <p style={{ textAlign: "center", fontFamily: FONTS.body, fontSize: 14, color: COLORS.textDim, marginBottom: 40 }}>A real story from the parent who built this tool</p>
              <GlowCard hover={false} glow={COLORS.gold} style={{ padding: "40px 36px", borderLeft: `3px solid ${COLORS.gold}` }}>
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
                    <div style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.textDim }}>Parent, Educator & Creator of MeritLaunch</div>
                  </div>
                </div>
              </GlowCard>
            </div>
          </div>

          {/* Pricing */}
          <div style={{ padding: "80px 40px", textAlign: "center" }}>
            <h2 style={{ fontSize: 30, fontWeight: 400, marginBottom: 8 }}>Simple, Transparent Pricing</h2>
            <p style={{ fontSize: 14, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 40 }}>Start free. Upgrade when you're ready to go all-in on scholarship season.</p>
            <div className="landing-pricing-grid reveal" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, maxWidth: 900, margin: "0 auto" }}>
              {/* Free Tier */}
              <GlowCard hover={false} style={{ padding: "32px 24px", textAlign: "left" }}>
                <div style={{ fontSize: 13, fontFamily: FONTS.body, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Free</div>
                <div style={{ fontSize: 36, fontWeight: 400, marginBottom: 4 }}>$0<span style={{ fontSize: 14, color: COLORS.textDim }}>/month</span></div>
                <div style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.textDim, marginBottom: 24 }}>Get started and explore</div>
                <div style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 2.2 }}>
                  <div>&#10003; Build your full profile</div>
                  <div>&#10003; Browse all {scholarshipDB.length} scholarships</div>
                  <div>&#10003; 3 AI matches per month</div>
                  <div>&#10003; 1 AI letter per month</div>
                  <div style={{ color: COLORS.textDim }}>&#10005; Advanced templates</div>
                  <div style={{ color: COLORS.textDim }}>&#10005; Deadline alerts</div>
                </div>
                <Button variant="secondary" onClick={() => { setAuthMode("signup"); setShowAuthModal(true); }} style={{ width: "100%", justifyContent: "center", marginTop: 24 }}>
                  Start Free
                </Button>
              </GlowCard>

              {/* Premium Tier */}
              <GlowCard hover={false} glow={COLORS.gold} style={{
                padding: "32px 24px", textAlign: "left",
                border: `2px solid ${COLORS.gold}44`,
                boxShadow: `0 0 40px ${COLORS.goldGlow}`,
                position: "relative",
              }}>
                <div style={{
                  position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                  background: `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.goldLight})`,
                  color: COLORS.bg, fontSize: 10, fontWeight: 700, fontFamily: FONTS.body,
                  padding: "4px 16px", borderRadius: 20, textTransform: "uppercase", letterSpacing: 2,
                }}>Most Popular</div>
                <div style={{ fontSize: 13, fontFamily: FONTS.body, fontWeight: 600, color: COLORS.gold, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Premium</div>
                <div style={{ fontSize: 36, fontWeight: 400, marginBottom: 4 }}>$9<span style={{ fontSize: 18 }}>.99</span><span style={{ fontSize: 14, color: COLORS.textDim }}>/month</span></div>
                <div style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.textDim, marginBottom: 24 }}>Everything you need to win</div>
                <div style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 2.2 }}>
                  <div style={{ color: COLORS.gold }}>&#10003; Everything in Free, plus:</div>
                  <div>&#10003; Unlimited AI matches</div>
                  <div>&#10003; 50 AI letters per month</div>
                  <div>&#10003; All 4 writing templates</div>
                  <div>&#10003; Deadline alert emails</div>
                  <div>&#10003; Scholarship URL import</div>
                </div>
                <Button disabled={checkoutLoading} onClick={() => authUser ? handleCheckout("premium") : (setAuthMode("signup"), setShowAuthModal(true))} style={{ width: "100%", justifyContent: "center", marginTop: 24 }}>
                  {checkoutLoading ? "Loading..." : "Go Premium"}
                </Button>
              </GlowCard>

              {/* Seasonal Pass */}
              <GlowCard hover={false} style={{ padding: "32px 24px", textAlign: "left" }}>
                <div style={{ fontSize: 13, fontFamily: FONTS.body, fontWeight: 600, color: COLORS.teal, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Seasonal</div>
                <div style={{ fontSize: 36, fontWeight: 400, marginBottom: 4 }}>$29<span style={{ fontSize: 18 }}>.99</span><span style={{ fontSize: 14, color: COLORS.textDim }}>/4 months</span></div>
                <div style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.textDim, marginBottom: 24 }}>Save 25% for scholarship season</div>
                <div style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 2.2 }}>
                  <div style={{ color: COLORS.teal }}>&#10003; Same as Premium, plus:</div>
                  <div>&#10003; 4 months of full access</div>
                  <div>&#10003; Batch letter generation</div>
                  <div>&#10003; Application tracker</div>
                  <div>&#10003; Priority support</div>
                  <div>&#10003; One-time payment</div>
                </div>
                <Button variant="secondary" disabled={checkoutLoading} onClick={() => authUser ? handleCheckout("seasonal") : (setAuthMode("signup"), setShowAuthModal(true))} style={{ width: "100%", justifyContent: "center", marginTop: 24, borderColor: COLORS.teal + "44", color: COLORS.teal }}>
                  {checkoutLoading ? "Loading..." : "Get Season Pass"}
                </Button>
              </GlowCard>
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
            <Button onClick={() => { setAuthMode("signup"); setShowAuthModal(true); }} style={{ fontSize: 16, padding: "16px 40px" }}>
              Get Started Free
            </Button>
          </div>

          {/* Footer */}
          <footer style={{
            padding: "24px 40px", borderTop: `1px solid ${COLORS.border}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
            fontFamily: FONTS.body, fontSize: 12, color: COLORS.textDim,
          }}>
            <span>MeritLaunch © 2026 — Not to replace the student. To give them back their time.</span>
            <span>{scholarshipDB.length} scholarships | $2.3M+ in opportunities</span>
          </footer>
        </div>
      )}

      {/* ====== APP SHELL (non-landing) ====== */}
      {!isLanding && (
        <>
          {/* Mobile hamburger */}
          <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{
            display: "none", position: "fixed", top: 12, left: 12, zIndex: 200,
            background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8,
            padding: "8px 12px", color: COLORS.text, fontSize: 18, cursor: "pointer",
          }}>{mobileMenuOpen ? "✕" : "☰"}</button>

          {/* SIDEBAR */}
          <div className={`app-sidebar${mobileMenuOpen ? " open" : ""}`} style={{
            position: "fixed", left: 0, top: 0, bottom: 0, width: 240,
            background: COLORS.surface, borderRight: `1px solid ${COLORS.border}`,
            display: "flex", flexDirection: "column", zIndex: 100,
            transition: "transform 0.3s",
          }}>
            {/* Logo */}
            <div style={{ padding: "24px 20px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 10, fontFamily: FONTS.body, letterSpacing: 3, color: COLORS.gold, textTransform: "uppercase" }}>MeritLaunch</span>
              </div>
              <div style={{ fontSize: 10, fontFamily: FONTS.body, color: COLORS.textDim, marginTop: 4 }}>
                {scholarshipDB.length} scholarships loaded
              </div>
            </div>

            {/* Nav Items */}
            <div style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
              {navItems.map(item => {
                const active = view === item.id || (view === "profileResult" && item.id === "profile");
                return (
                  <button key={item.id} onClick={() => { setView(item.id); setMobileMenuOpen(false); }} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "12px 20px",
                    border: "none", width: "100%", textAlign: "left",
                    background: active ? `linear-gradient(90deg, ${COLORS.goldDim}, transparent)` : "transparent",
                    color: active ? COLORS.gold : COLORS.textDim,
                    cursor: "pointer", fontSize: 13, fontFamily: FONTS.body,
                    borderLeft: active ? `2px solid ${COLORS.gold}` : "2px solid transparent",
                    transition: "all 0.2s",
                  }}>
                    <span style={{ fontSize: 14, opacity: 0.7, width: 20, textAlign: "center" }}>{item.icon}</span>
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Landing link */}
            <button onClick={() => setView("landing")} style={{
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
                      <span>Matches: {remainingMatches} left</span>
                      <span style={{ color: isPremium ? COLORS.teal : COLORS.textDim }}>{isPremium ? "PRO" : "Free"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: COLORS.textDim }}>
                      <span>Letters: {remainingLetters}{isPremium ? `/${PRO_LIMITS.lettersPerMonth}` : ""} left</span>
                      {!isPremium && <span style={{ cursor: "pointer", color: COLORS.gold }} onClick={() => setShowUpgradeModal(true)}>Upgrade</span>}
                    </div>
                  </div>
                  {isPremium && (
                    <button onClick={async () => {
                      try {
                        const { data: prof } = await supabase.from("user_profiles").select("stripe_customer_id").eq("id", authUser.id).single();
                        if (prof?.stripe_customer_id) {
                          const resp = await fetch("/api/customer-portal", {
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
                    }}>Manage Subscription</button>
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
          </div>

          {/* MAIN CONTENT */}
          {/* Mobile overlay */}
          {mobileMenuOpen && <div className="mobile-overlay" onClick={() => setMobileMenuOpen(false)} style={{
            display: "none", position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 99,
          }} />}

          <div className="app-main" style={{ marginLeft: 240, minHeight: "100vh", padding: "36px 44px" }}>

            {/* ====== DASHBOARD ====== */}
            {view === "home" && (
              <div>
                <SectionHeader
                  title={profile.name ? `Welcome back, ${profile.name.split(" ")[0]}` : "Your Scholarship Command Center"}
                  subtitle={`${scholarshipDB.length} scholarships loaded. AI-powered matching. Letters in your authentic voice.`}
                />

                {/* Stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
                  {[
                    { label: "Scholarships", value: scholarshipDB.length, color: COLORS.gold, icon: "⬡" },
                    { label: "Profile", value: profileCompletion + "%", color: COLORS.teal, icon: "◈" },
                    { label: "Matches", value: matchResults.length || "—", color: COLORS.pink, icon: "◆" },
                    { label: "Letters Saved", value: savedLetters.length, color: COLORS.purple, icon: "▫" },
                  ].map((stat, i) => (
                    <GlowCard key={i} glow={stat.color} style={{ padding: "22px 20px", position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", top: 12, right: 14, fontSize: 28, opacity: 0.08, color: stat.color }}>{stat.icon}</div>
                      <div style={{ fontSize: 32, fontWeight: 300, color: stat.color, marginBottom: 2 }}>{stat.value}</div>
                      <div style={{ fontSize: 11, fontFamily: FONTS.body, color: COLORS.textDim, letterSpacing: 1, textTransform: "uppercase" }}>{stat.label}</div>
                    </GlowCard>
                  ))}
                </div>

                {/* DB Status */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
                  background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10,
                  marginBottom: 36, fontSize: 12, fontFamily: FONTS.body,
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: dbSource === "synced" ? COLORS.teal : COLORS.gold, flexShrink: 0 }} />
                  <span style={{ color: COLORS.textDim }}>
                    {scholarshipDB.length} scholarships · Updated {dbLastUpdated} ·{" "}
                    <span style={{ color: dbSource === "synced" ? COLORS.teal : COLORS.gold }}>
                      {dbSource === "synced" ? "Auto-synced" : "Built-in (verified)"}
                    </span>
                  </span>
                </div>

                {/* Deadline Alerts */}
                {deadlineAlerts.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 400, marginBottom: 10, color: COLORS.pink, fontFamily: FONTS.heading }}>⚠ Upcoming Deadlines</h2>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {deadlineAlerts.slice(0, 5).map(alert => (
                        <div key={alert.id} style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "10px 16px", background: COLORS.pink + "0A", border: `1px solid ${COLORS.pink}33`,
                          borderRadius: 10, fontFamily: FONTS.body, fontSize: 13,
                        }}>
                          <span style={{ color: COLORS.text }}>{alert.title}</span>
                          <button onClick={async () => {
                            if (supabase) await supabase.from("notifications").update({ read: true }).eq("id", alert.id);
                            setDeadlineAlerts(prev => prev.filter(a => a.id !== alert.id));
                          }} style={{
                            background: "none", border: "none", color: COLORS.textDim, cursor: "pointer", fontSize: 12,
                          }}>Dismiss</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
                <h2 style={{ fontSize: 18, fontWeight: 400, marginBottom: 16, color: COLORS.textMuted, fontFamily: FONTS.heading }}>Quick Actions</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                  {[
                    { label: "Build Your Profile", desc: "Answer questions to create your scholarship persona.", action: () => setView("profile"), color: COLORS.gold, icon: "◈" },
                    { label: "Find Matches", desc: "AI matches you to best-fit scholarships.", action: () => { if (profile.name) runMatching(); else setView("profile"); }, color: COLORS.teal, icon: "◆" },
                    { label: "Generate a Letter", desc: "Draft a letter in your own authentic voice.", action: () => setView("generate"), color: COLORS.teal, icon: "◉" },
                    { label: "Track Applications", desc: `${trackedApps.length} scholarships in your pipeline.`, action: () => setView("tracker"), color: "#8B5CF6", icon: "▦" },
                  ].map((a, i) => (
                    <GlowCard key={i} onClick={a.action} glow={a.color} style={{ padding: "28px 24px", cursor: "pointer" }}>
                      <div style={{ fontSize: 28, marginBottom: 12, color: a.color, opacity: 0.6 }}>{a.icon}</div>
                      <div style={{ fontSize: 17, fontWeight: 400, marginBottom: 6 }}>{a.label}</div>
                      <div style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.5 }}>{a.desc}</div>
                    </GlowCard>
                  ))}
                </div>
              </div>
            )}

            {/* ====== PROFILE BUILDER (Stepped Wizard) ====== */}
            {view === "profile" && (
              <div>
                <SectionHeader title="Build Your Profile" subtitle="Answer these questions to create your scholarship candidate profile." />

                {/* Step Progress */}
                <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
                  {PROFILE_STEPS.map((s, i) => (
                    <button key={i} onClick={() => setProfileStep(i)} style={{
                      flex: 1, padding: "12px 14px", borderRadius: 10, border: "none",
                      background: i === profileStep ? COLORS.goldDim : COLORS.surface,
                      borderBottom: i === profileStep ? `2px solid ${COLORS.gold}` : `2px solid transparent`,
                      cursor: "pointer", textAlign: "left", transition: "all 0.2s",
                    }}>
                      <div style={{ fontSize: 11, fontFamily: FONTS.body, color: i === profileStep ? COLORS.gold : COLORS.textDim, fontWeight: 600, marginBottom: 2 }}>
                        Step {i + 1}
                      </div>
                      <div style={{ fontSize: 13, fontFamily: FONTS.body, color: i === profileStep ? COLORS.text : COLORS.textMuted }}>
                        {s.title}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Current Step Questions */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
                  {PROFILE_QUESTIONS.filter(q => q.step === profileStep).map(q => (
                    <div key={q.id} style={{ gridColumn: q.type === "textarea" ? "1 / -1" : "auto" }}>
                      <label style={{ display: "block", fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 8, fontWeight: 500 }}>{q.q}</label>
                      {q.type === "text" && (
                        <input value={profile[q.id] || ""} onChange={e => saveProfile({...profile, [q.id]: e.target.value})}
                          placeholder={q.placeholder} style={{
                            width: "100%", padding: "12px 16px", background: COLORS.surface,
                            border: `1px solid ${COLORS.border}`, borderRadius: 10,
                            color: COLORS.text, fontSize: 14, fontFamily: FONTS.body, outline: "none", boxSizing: "border-box",
                            transition: "border-color 0.2s",
                          }}/>
                      )}
                      {q.type === "select" && (
                        <select value={profile[q.id] || ""} onChange={e => saveProfile({...profile, [q.id]: e.target.value})}
                          style={{
                            width: "100%", padding: "12px 16px", background: COLORS.surface,
                            border: `1px solid ${COLORS.border}`, borderRadius: 10,
                            color: COLORS.text, fontSize: 14, fontFamily: FONTS.body, outline: "none",
                          }}>
                          <option value="">Select...</option>
                          {q.options.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      )}
                      {q.type === "multiselect" && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {q.options.map(o => {
                            const sel = (profile[q.id] || []).includes(o);
                            return (
                              <button key={o} onClick={() => {
                                const cur = profile[q.id] || [];
                                saveProfile({...profile, [q.id]: sel ? cur.filter(x => x !== o) : [...cur, o]});
                              }} style={{
                                padding: "8px 14px", borderRadius: 20,
                                border: sel ? `1px solid ${COLORS.gold}` : `1px solid ${COLORS.border}`,
                                background: sel ? COLORS.goldDim : COLORS.surface,
                                color: sel ? COLORS.gold : COLORS.textDim,
                                cursor: "pointer", fontSize: 12, fontFamily: FONTS.body,
                              }}>{o}</button>
                            );
                          })}
                        </div>
                      )}
                      {q.type === "textarea" && (
                        <textarea value={profile[q.id] || ""} onChange={e => saveProfile({...profile, [q.id]: e.target.value})}
                          placeholder={q.placeholder} rows={4} style={{
                            width: "100%", padding: "12px 16px", background: COLORS.surface,
                            border: `1px solid ${COLORS.border}`, borderRadius: 10,
                            color: COLORS.text, fontSize: 14, fontFamily: FONTS.body,
                            outline: "none", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box",
                          }}/>
                      )}
                    </div>
                  ))}
                </div>

                {/* Step Navigation */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
                  <Button variant="ghost" onClick={() => setProfileStep(Math.max(0, profileStep - 1))} disabled={profileStep === 0}>
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
                    <Button onClick={() => setProfileStep(profileStep + 1)}>
                      Next →
                    </Button>
                  ) : (
                    <Button onClick={generateCandidateProfile} disabled={generatingLetter}>
                      {generatingLetter ? "Generating..." : "Generate AI Profile →"}
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
                      <p style={{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.textDim }}>Upload a PDF, Word doc, or text file. Or paste directly.</p>
                    </div>
                    {bragSheet && (
                      <button onClick={() => { setBragSheet(""); setBragSheetFileName(""); }} style={{
                        fontSize: 11, fontFamily: FONTS.body, color: COLORS.pink,
                        background: "none", border: "none", cursor: "pointer",
                      }}>Clear all</button>
                    )}
                  </div>

                  <div
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

                  <textarea value={bragSheet} onChange={e => setBragSheet(e.target.value)}
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

                <div style={{ display: "flex", gap: 12 }}>
                  <Button onClick={generateCandidateProfile} disabled={generatingLetter}>
                    {generatingLetter ? "Generating..." : "Generate AI Profile"}
                  </Button>
                  <Button variant="secondary" onClick={runMatching}>Find My Matches</Button>
                </div>
              </div>
            )}

            {/* ====== GENERATED PROFILE ====== */}
            {view === "profileResult" && (
              <div>
                <button onClick={() => setView("profile")} style={{ background: "none", border: "none", color: COLORS.gold, cursor: "pointer", fontFamily: FONTS.body, fontSize: 13, marginBottom: 20 }}>← Back to Profile Builder</button>
                <SectionHeader title="Your Candidate Profile" />
                <GlowCard hover={false} style={{ maxWidth: 800, padding: 32 }}>
                  <pre style={{ whiteSpace: "pre-wrap", fontFamily: FONTS.body, fontSize: 14, lineHeight: 1.8, color: "#d4d0c8" }}>{generatedProfile}</pre>
                </GlowCard>
                <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
                  <Button onClick={() => { navigator.clipboard.writeText(generatedProfile); notify("Copied!", "success"); }}>Copy Profile</Button>
                  <Button variant="secondary" onClick={runMatching}>Find Matches →</Button>
                </div>
              </div>
            )}

            {/* ====== BROWSE SCHOLARSHIPS (Card Layout) ====== */}
            {view === "search" && (
              <div>
                <SectionHeader
                  title="Browse Scholarships"
                  subtitle={`${filteredScholarships.length} of ${scholarshipDB.length} scholarships shown`}
                />

                {/* Disclaimer Banner */}
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 12,
                  padding: "14px 18px", marginBottom: 24, borderRadius: 10,
                  background: `${COLORS.orange}08`, border: `1px solid ${COLORS.orange}22`,
                  fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6,
                }}>
                  <span style={{ fontSize: 18, flexShrink: 0, marginTop: -1 }}>&#9432;</span>
                  <span>
                    <strong style={{ color: COLORS.orange }}>Disclaimer:</strong> MeritLaunch aggregates scholarship information from public sources for your convenience. While we work to keep this data accurate, we cannot independently verify every listing. Always confirm eligibility, deadlines, and legitimacy directly with the scholarship provider before applying. <strong>Never pay an application fee for a legitimate scholarship.</strong>
                  </span>
                </div>

                {/* URL Import (Premium) */}
                {isPremium && (
                  <GlowCard hover={false} glow={COLORS.teal} style={{ padding: "16px 20px", marginBottom: 20 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.teal, marginBottom: 6, fontWeight: 500 }}>
                          ★ Import from URL
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input value={importUrl} onChange={e => setImportUrl(e.target.value)}
                            placeholder="Paste a scholarship page URL..."
                            style={{
                              flex: 1, padding: "8px 14px", background: COLORS.surface,
                              border: `1px solid ${COLORS.border}`, borderRadius: 8,
                              color: COLORS.text, fontSize: 13, fontFamily: FONTS.body, outline: "none",
                            }}/>
                          <Button disabled={importLoading || !importUrl.trim()} onClick={async () => {
                            setImportLoading(true);
                            try {
                              const resp = await fetch("/api/import-scholarship", {
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
                          <button key={tab.key} onClick={() => setFilterCountry(tab.key)} style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "8px 16px", borderRadius: 20, cursor: "pointer",
                            fontSize: 13, fontFamily: FONTS.body, fontWeight: active ? 600 : 400,
                            background: active ? (tab.key === "CA" ? "#5c1a1a" : tab.key === "US" ? "#1a3a5c" : tab.key === "BOTH" ? "#3a2a5c" : COLORS.gold + "22") : COLORS.surface,
                            border: `1px solid ${active ? (tab.key === "CA" ? "#8c2a2a" : tab.key === "US" ? "#2a5a8c" : tab.key === "BOTH" ? "#5a4a7c" : COLORS.gold) : COLORS.border}`,
                            color: active ? "#fff" : COLORS.textMuted,
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
                              background: active ? "rgba(255,255,255,0.2)" : COLORS.border,
                              color: active ? "#fff" : COLORS.textDim,
                            }}>{tab.count}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Search + Filters */}
                <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
                  <div style={{ flex: 1, position: "relative" }}>
                    <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: COLORS.textDim, fontSize: 16 }}>⚲</span>
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search by name, criteria, or amount..."
                      style={{
                        width: "100%", padding: "12px 16px 12px 38px", background: COLORS.surface,
                        border: `1px solid ${COLORS.border}`, borderRadius: 10,
                        color: COLORS.text, fontSize: 14, fontFamily: FONTS.body, outline: "none", boxSizing: "border-box",
                      }}/>
                  </div>
                  <select value={filterNeedBased} onChange={e => setFilterNeedBased(e.target.value)}
                    style={{
                      padding: "12px 16px", background: COLORS.surface,
                      border: `1px solid ${COLORS.border}`, borderRadius: 10,
                      color: COLORS.text, fontSize: 13, fontFamily: FONTS.body, outline: "none",
                    }}>
                    <option value="all">All Types</option>
                    <option value="need">Need-Based</option>
                    <option value="merit">Merit-Based</option>
                  </select>
                </div>

                {/* Scholarship Cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {filteredScholarships.map(s => {
                    const dl = getDeadlineStatus(s.deadline);
                    return (
                      <GlowCard key={s.id} style={{ padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 16, fontWeight: 400, marginBottom: 6, fontFamily: FONTS.heading }}>{s.name}</div>
                          <div style={{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.5, marginBottom: 10 }}>
                            {s.criteria.slice(0, 160)}{s.criteria.length > 160 ? "..." : ""}
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <CountryFlag country={s.country || "US"} />
                            {s.amount && <Badge color={COLORS.gold}>{s.amount}</Badge>}
                            <Badge color={dl.color}>{dl.label}</Badge>
                            {s.needBased === "Y" && <Badge color={COLORS.teal}>Need-Based</Badge>}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                          <Button onClick={() => { setSelectedScholarship(s); setView("generate"); }} style={{ fontSize: 12, padding: "8px 16px" }}>
                            Apply →
                          </Button>
                          <Button variant="secondary" onClick={() => trackApplication(s)} style={{ fontSize: 11, padding: "6px 14px" }}>
                            {trackedApps.some(a => a.scholarshipId === s.id) ? "✓ Tracked" : "Track"}
                          </Button>
                          {s.link && <a href={s.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: COLORS.textDim, fontFamily: FONTS.body, textDecoration: "none", textAlign: "center" }}>View source ↗</a>}
                        </div>
                      </GlowCard>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ====== MATCHES ====== */}
            {view === "matches" && (
              <div>
                <SectionHeader
                  title="Your Matches"
                  subtitle="Scholarships ranked by how well they match your profile."
                  action={<Button variant="secondary" onClick={runMatching} style={{ fontSize: 12, padding: "8px 16px" }}>Re-run Matching</Button>}
                />

                {/* Disclaimer Banner */}
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "12px 16px", marginBottom: 20, borderRadius: 10,
                  background: `${COLORS.orange}08`, border: `1px solid ${COLORS.orange}22`,
                  fontSize: 11, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.5,
                }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>&#9432;</span>
                  <span>
                    Scholarship data is aggregated from public sources. Always verify eligibility and deadlines directly with the provider. Never pay to apply.
                  </span>
                </div>

                {matchResults.length === 0 ? (
                  <EmptyState icon="◇" title="No matches yet" desc="Complete your profile to find matching scholarships."
                    action={() => setView("profile")} actionLabel="Complete Profile" />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {matchResults.map(s => {
                      const scoreColor = s.matchScore >= 70 ? COLORS.teal : s.matchScore >= 40 ? COLORS.gold : COLORS.pink;
                      return (
                        <GlowCard key={s.id} glow={scoreColor} style={{ padding: "18px 22px", display: "flex", alignItems: "center", gap: 18 }}>
                          <div style={{ position: "relative", flexShrink: 0 }}>
                            <ProgressRing value={s.matchScore} color={scoreColor} />
                            <div style={{
                              position: "absolute", top: "50%", left: "50%",
                              transform: "translate(-50%, -50%)",
                              fontSize: 14, fontWeight: 700, fontFamily: FONTS.body, color: scoreColor,
                            }}>{s.matchScore}</div>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                              <div style={{ fontSize: 16, fontWeight: 400 }}>{s.name}</div>
                              <CountryFlag country={s.country || "US"} />
                            </div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {s.matchReasons.map((r, j) => (
                                <span key={j} style={{
                                  fontSize: 11, fontFamily: FONTS.body,
                                  background: COLORS.surface, border: `1px solid ${COLORS.border}`,
                                  color: COLORS.textMuted, padding: "3px 8px", borderRadius: 5,
                                }}>{r}</span>
                              ))}
                            </div>
                            {s.amount && <div style={{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.gold, marginTop: 6 }}>{s.amount}</div>}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                            <Button onClick={() => { setSelectedScholarship(s); setView("generate"); }} style={{ fontSize: 12, padding: "10px 18px" }}>
                              Generate Letter
                            </Button>
                            <Button variant="secondary" onClick={() => trackApplication(s)} style={{ fontSize: 11, padding: "6px 14px" }}>
                              {trackedApps.some(a => a.scholarshipId === s.id) ? "✓ Tracked" : "Track"}
                            </Button>
                          </div>
                        </GlowCard>
                      );
                    })}
                  </div>
                )}
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
                <SectionHeader title="Letter Generator" subtitle="Select a scholarship and writing style, then generate." />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 28 }}>
                  {/* Scholarship Input */}
                  <div>
                    <label style={{ fontSize: 11, fontFamily: FONTS.body, color: COLORS.textDim, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10, display: "block" }}>
                      Scholarship Source
                    </label>

                    {/* Mode Tabs */}
                    <div style={{ display: "flex", gap: 0, marginBottom: 14, borderRadius: 10, overflow: "hidden", border: `1px solid ${COLORS.border}` }}>
                      {[
                        {id:"database",label:"Database"},
                        {id:"upload",label:"Upload"},
                        {id:"url",label:"URL"},
                        {id:"paste",label:"Paste"},
                      ].map(tab => (
                        <button key={tab.id} onClick={() => setScholarshipInputMode(tab.id)} style={{
                          flex: 1, padding: "10px 8px", border: "none", fontSize: 12, fontFamily: FONTS.body,
                          cursor: "pointer", fontWeight: scholarshipInputMode === tab.id ? 600 : 400,
                          background: scholarshipInputMode === tab.id ? COLORS.goldDim : COLORS.surface,
                          color: scholarshipInputMode === tab.id ? COLORS.gold : COLORS.textDim,
                          borderBottom: scholarshipInputMode === tab.id ? `2px solid ${COLORS.gold}` : "2px solid transparent",
                          transition: "all 0.2s",
                        }}>{tab.label}</button>
                      ))}
                    </div>

                    {scholarshipInputMode === "database" && (
                      <div>
                        <select value={selectedScholarship?.id || ""} onChange={e => {
                          const s = scholarshipDB.find(x => x.id === e.target.value);
                          setSelectedScholarship(s || null); setCustomScholarshipText(""); setCustomScholarshipName("");
                        }} style={{
                          width: "100%", padding: "12px 16px", background: COLORS.surface,
                          border: `1px solid ${COLORS.border}`, borderRadius: 10,
                          color: COLORS.text, fontSize: 14, fontFamily: FONTS.body, outline: "none",
                        }}>
                          <option value="">Select from database...</option>
                          {scholarshipDB.map(s => <option key={s.id} value={s.id}>{s.name} ({s.amount})</option>)}
                        </select>
                        {selectedScholarship && (
                          <div style={{
                            marginTop: 12, padding: 14, background: COLORS.bg,
                            border: `1px solid ${COLORS.border}`, borderRadius: 10,
                            fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6,
                          }}>
                            <strong style={{ color: COLORS.gold }}>Criteria:</strong> {selectedScholarship.criteria.slice(0, 300)}
                          </div>
                        )}
                      </div>
                    )}

                    {scholarshipInputMode === "upload" && (
                      <div>
                        <div
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
                              <div style={{ fontSize: 28, marginBottom: 6, color: COLORS.textDim }}>📄</div>
                              <div style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted }}>Drop scholarship application here</div>
                            </div>
                          )}
                        </div>
                        <input value={customScholarshipName} onChange={e => setCustomScholarshipName(e.target.value)}
                          placeholder="Scholarship name" style={{
                            width: "100%", padding: "10px 14px", background: COLORS.surface,
                            border: `1px solid ${COLORS.border}`, borderRadius: 10,
                            color: COLORS.text, fontSize: 13, fontFamily: FONTS.body, outline: "none", boxSizing: "border-box",
                          }}/>
                      </div>
                    )}

                    {scholarshipInputMode === "url" && (
                      <div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                          <input value={scholarshipUrl} onChange={e => setScholarshipUrl(e.target.value)}
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
                        <input value={customScholarshipName} onChange={e => setCustomScholarshipName(e.target.value)}
                          placeholder="Scholarship name" style={{
                            width: "100%", padding: "10px 14px", background: COLORS.surface,
                            border: `1px solid ${COLORS.border}`, borderRadius: 10,
                            color: COLORS.text, fontSize: 13, fontFamily: FONTS.body, outline: "none", boxSizing: "border-box", marginBottom: 10,
                          }}/>
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
                        <input value={customScholarshipName} onChange={e => setCustomScholarshipName(e.target.value)}
                          placeholder="Scholarship name" style={{
                            width: "100%", padding: "10px 14px", background: COLORS.surface,
                            border: `1px solid ${COLORS.border}`, borderRadius: 10,
                            color: COLORS.text, fontSize: 14, fontFamily: FONTS.body, outline: "none", boxSizing: "border-box", marginBottom: 10,
                          }}/>
                        <textarea value={customScholarshipText} onChange={e => setCustomScholarshipText(e.target.value)}
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
                    <label style={{ fontSize: 11, fontFamily: FONTS.body, color: COLORS.textDim, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10, display: "block" }}>
                      Writing Style
                    </label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {templates.map(t => (
                        <button key={t.id} onClick={() => setSelectedTemplate(t)} style={{
                          padding: "14px 16px", textAlign: "left", border: "none", borderRadius: 10, cursor: "pointer",
                          background: selectedTemplate?.id === t.id ? COLORS.goldDim : COLORS.surface,
                          outline: selectedTemplate?.id === t.id ? `1px solid ${COLORS.gold}44` : `1px solid ${COLORS.border}`,
                          color: COLORS.text, transition: "all 0.2s",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                            <span style={{ fontSize: 16 }}>{t.icon || "✍"}</span>
                            <span style={{ fontSize: 14, fontFamily: FONTS.body, fontWeight: 500 }}>{t.name}</span>
                          </div>
                          <div style={{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.4 }}>{t.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <Button onClick={generateLetter}
                  disabled={generatingLetter || (scholarshipInputMode === "database" ? !selectedScholarship : !customScholarshipText.trim())}
                  style={{ fontSize: 15, padding: "14px 40px", marginBottom: 28 }}>
                  {generatingLetter ? "◉ Crafting your letter..." : "Generate Scholarship Letter"}
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
                            <div style={{ fontSize: 14, fontFamily: FONTS.body, color: "#8a8578", marginBottom: 8 }}>Crafting your letter...</div>
                            <div style={{ fontSize: 12, fontFamily: FONTS.body, color: "#b0a89a" }}>Matching your voice to the scholarship requirements</div>
                          </div>
                        )}
                        <div style={{
                          whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.85,
                          color: "#2a2722", fontFamily: "Georgia, 'Times New Roman', serif",
                        }}>
                          {generatedLetter}
                          {generatingLetter && generatedLetter && (
                            <span style={{
                              display: "inline-block", width: 2, height: 18,
                              background: COLORS.gold, marginLeft: 2,
                              animation: "blink 0.8s infinite",
                            }} />
                          )}
                        </div>
                      </div>
                    </GlowCard>
                    {!generatingLetter && generatedLetter && (
                      <div style={{ display: "flex", gap: 12 }}>
                        <Button onClick={() => {
                          const label = scholarshipInputMode === "database" ? selectedScholarship?.name : (customScholarshipName || "Custom Scholarship");
                          saveLetter({ content: generatedLetter, scholarshipName: label, template: selectedTemplate?.name, scholarshipId: selectedScholarship?.id });
                        }}>Save Letter</Button>
                        <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(generatedLetter); notify("Copied!", "success"); }}>Copy to Clipboard</Button>
                        <Button variant="ghost" onClick={generateLetter}>Regenerate</Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ====== STYLE TEMPLATES ====== */}
            {view === "templates" && (
              <div>
                <SectionHeader title="Style Templates" subtitle="Different writing styles for different scholarship personalities." />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 32 }}>
                  {templates.map(t => (
                    <GlowCard key={t.id}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 22 }}>{t.icon || "✍"}</span>
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
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                    <input id="tpl-name" placeholder="Template name..." style={{
                      padding: "10px 14px", background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                      borderRadius: 10, color: COLORS.text, fontSize: 13, fontFamily: FONTS.body, outline: "none",
                    }}/>
                    <input id="tpl-desc" placeholder="Short description..." style={{
                      padding: "10px 14px", background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                      borderRadius: 10, color: COLORS.text, fontSize: 13, fontFamily: FONTS.body, outline: "none",
                    }}/>
                  </div>
                  <textarea id="tpl-rules" placeholder="Writing rules..." rows={4} style={{
                    width: "100%", padding: "10px 14px", background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                    borderRadius: 10, color: COLORS.text, fontSize: 13, fontFamily: FONTS.body,
                    outline: "none", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box", marginBottom: 12,
                  }}/>
                  <Button onClick={() => {
                    const name = document.getElementById("tpl-name").value;
                    const desc = document.getElementById("tpl-desc").value;
                    const rules = document.getElementById("tpl-rules").value;
                    if (!name || !rules) { notify("Name and rules are required.", "error"); return; }
                    saveTemplates([...templates, { id: `custom-${Date.now()}`, name, description: desc, rules, icon: "✨" }]);
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
                  <EmptyState icon="▫" title="No saved letters yet" desc="Generate your first letter to see it here."
                    action={() => setView("generate")} actionLabel="Generate a Letter" />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {savedLetters.map((l, i) => (
                      <GlowCard key={l.id} hover={false}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 400 }}>{l.scholarship || "Untitled"}</div>
                            <div style={{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.textDim }}>{l.template} · {l.date}</div>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(l.text); notify("Copied!", "success"); }}
                              style={{ fontSize: 11, padding: "6px 14px" }}>Copy</Button>
                            <Button variant="danger" onClick={() => {
                              const next = savedLetters.filter((_, j) => j !== i);
                              setSavedLetters(next); store.set("scholarbot-letters", next);
                              notify("Deleted.", "info");
                            }} style={{ fontSize: 11, padding: "6px 14px" }}>Delete</Button>
                          </div>
                        </div>
                        <div style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6, maxHeight: 120, overflow: "hidden" }}>
                          {l.text.slice(0, 400)}...
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
                <SectionHeader title="Application Tracker" />
                {trackedApps.length === 0 ? (
                  <EmptyState icon="▦" title="No applications tracked yet" desc="Find scholarships, then click 'Track' to add them to your pipeline."
                    action={() => setView("matches")} actionLabel="Find Matches" />
                ) : (
                  <div>
                    {/* Status summary */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
                      {[
                        { status: "interested", label: "Interested", color: COLORS.textMuted, icon: "○" },
                        { status: "in_progress", label: "In Progress", color: COLORS.gold, icon: "◐" },
                        { status: "submitted", label: "Submitted", color: COLORS.teal, icon: "●" },
                        { status: "accepted", label: "Accepted", color: "#4CAF50", icon: "✓" },
                        { status: "rejected", label: "Rejected", color: COLORS.pink, icon: "✗" },
                      ].map(s => (
                        <div key={s.status} style={{
                          textAlign: "center", padding: "12px 8px", borderRadius: 10,
                          background: COLORS.surface, border: `1px solid ${COLORS.border}`,
                        }}>
                          <div style={{ fontSize: 22, color: s.color }}>{trackedApps.filter(a => a.status === s.status).length}</div>
                          <div style={{ fontSize: 11, fontFamily: FONTS.body, color: COLORS.textDim, marginTop: 2 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Application list */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {trackedApps.sort((a, b) => {
                        // Sort by deadline urgency
                        const da = new Date(a.deadline), db = new Date(b.deadline);
                        if (isNaN(da)) return 1; if (isNaN(db)) return -1;
                        return da - db;
                      }).map(app => {
                        const deadlineInfo = parseDeadline(app.deadline);
                        const statusColors = {
                          interested: COLORS.textMuted, in_progress: COLORS.gold,
                          submitted: COLORS.teal, accepted: "#4CAF50", rejected: COLORS.pink,
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
                                    <button key={s} onClick={() => updateAppStatus(app.id, s)} style={{
                                      padding: "4px 10px", fontSize: 11, fontFamily: FONTS.body, borderRadius: 6,
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
                              <Button variant="ghost" onClick={() => removeTrackedApp(app.id)} style={{ fontSize: 11, padding: "4px 10px", color: COLORS.textDim }}>
                                ✕
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
      <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${COLORS.bg}; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: ${COLORS.borderHover}; }
        ::placeholder { color: ${COLORS.textDim}; }
        select option { background: ${COLORS.surface}; color: ${COLORS.text}; }
        input:focus, textarea:focus, select:focus { border-color: ${COLORS.gold} !important; }
        a { color: ${COLORS.gold}; }
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
          .landing-nav-buttons button { font-size: 11px !important; padding: 6px 12px !important; }

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
