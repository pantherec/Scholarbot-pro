import { useState, useEffect, useCallback, useRef } from "react";

// ============================================================
// SUPABASE CONFIG — pulls 457 scholarships from your database
// ============================================================
const SUPABASE_URL = "https://zudczsepvkjbjgomgilz.supabase.co";
const SUPABASE_KEY = typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_KEY 
  ? import.meta.env.VITE_SUPABASE_KEY 
  : null;

async function fetchScholarshipsFromSupabase() {
  if (!SUPABASE_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/scholarships?select=*`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows.map(r => ({
      id: r.id, name: r.name, criteria: r.criteria || "",
      link: r.link || "", deadline: r.deadline || "Varies",
      amount: r.amount || "Varies", needBased: r.need_based || "",
    }));
  } catch(e) { return null; }
}

// Simple localStorage helper (works in all browsers, unlike window.storage)
const store = {
  get: (key) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch(e) { return null; } },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {} },
};

// ============================================================
// SCHOLARSHIP DATABASE (30 verified fallback — full 457 loads from Supabase)
// ============================================================
const DEFAULT_SCHOLARSHIP_DB = [
  {id:"a91bc024",name:"Gates Scholarship",criteria:"High school seniors from minority backgrounds (African American, Hispanic, Asian/Pacific Islander, Native American). Pell-eligible. Must demonstrate leadership and academic excellence. 3.3+ GPA on 4.0 scale. U.S. citizen, national, or permanent resident.",link:"https://www.thegatesscholarship.org/",deadline:"2026-09-15",amount:"Full Tuition",needBased:"Y"},
  {id:"c7f3e011",name:"Ron Brown Scholar Program",criteria:"African American high school seniors. Must demonstrate academic excellence, leadership, and community service. U.S. citizen or permanent resident. Financial need considered.",link:"https://ronbrown.org/ron-brown-scholarship/",deadline:"2026-12-01",amount:"$40,000",needBased:"Y"},
  {id:"e8a2d445",name:"Coca-Cola Scholars Foundation",criteria:"High school seniors with leadership in school and community. U.S. citizens, nationals, permanent residents, refugees, or asylees. Must be eligible for federal financial aid. Achievement-based.",link:"https://www.coca-colascholarsfoundation.org/apply/",deadline:"2026-09-30",amount:"$20,000",needBased:""},
  {id:"f12b9923",name:"Dell Scholars Program",criteria:"Must participate in an approved college readiness program. Demonstrate need for financial assistance. GPA of 2.4+. U.S. citizen or permanent resident. Must be a current high school senior.",link:"https://www.dellscholars.org/",deadline:"2026-12-01",amount:"$20,000",needBased:"Y"},
  {id:"b34cd881",name:"QuestBridge National College Match",criteria:"High-achieving low-income students. Typically household income under $65,000. Strong academics. High school seniors applying to partner colleges.",link:"https://www.questbridge.org/",deadline:"2026-09-26",amount:"Full Ride",needBased:"Y"},
  {id:"19afe723",name:"Elks Most Valuable Student Scholarship",criteria:"U.S. citizen high school senior. Judged on scholarship, leadership, financial need. Must plan to pursue a four-year degree.",link:"https://www.elks.org/scholars/scholarships/mvs.cfm",deadline:"2026-11-05",amount:"$12,500",needBased:"Y"},
  {id:"20bcd561",name:"Burger King Scholars Program",criteria:"High school seniors in U.S., Canada, Puerto Rico, or Guam. GPA 2.0+. Demonstrate financial need, work experience, community involvement. Awards range $1,000 to $60,000.",link:"https://burgerking.scholarsapply.org/",deadline:"2026-12-15",amount:"$1,000-$60,000",needBased:"Y"},
  {id:"31def892",name:"Cameron Impact Scholarship",criteria:"High school seniors. Demonstrated academic achievement, community involvement, and leadership. U.S. citizens. Plan to attend four-year institution.",link:"https://www.bryancameroneducationfoundation.org/",deadline:"2026-09-14",amount:"Full Tuition",needBased:""},
  {id:"42eaf123",name:"Daniels Fund Scholarship",criteria:"Graduating high school seniors from CO, NM, UT, WY. Demonstrate strength of character, leadership, community service. Financial need.",link:"https://www.danielsfund.org/scholarships",deadline:"2026-11-15",amount:"Full Tuition",needBased:"Y"},
  {id:"53fba234",name:"UNCF Scholarships",criteria:"Underrepresented minority students. Multiple scholarship programs available year-round. Must attend an HBCU or other accredited institution.",link:"https://uncf.org/scholarships",deadline:"Varies",amount:"Varies",needBased:"Y"},
  {id:"64acb345",name:"Hispanic Scholarship Fund",criteria:"Of Hispanic heritage. U.S. citizen, permanent resident, or DACA eligible. Minimum 3.0 GPA. Plan to enroll full-time in accredited institution.",link:"https://www.hsf.net/scholarship",deadline:"2026-02-15",amount:"$500-$5,000",needBased:""},
  {id:"75bdc456",name:"Asian & Pacific Islander American Scholarship (APIASF)",criteria:"Asian American or Pacific Islander ethnicity. 2.7+ GPA. U.S. citizen, national, permanent resident, or citizen of Freely Associated States. Financial need.",link:"https://apiascholars.org/",deadline:"2026-01-11",amount:"Up to $20,000",needBased:"Y"},
  {id:"eq01ex25",name:"Equitable Excellence Scholarship",criteria:"High school senior. U.S. citizen or legal resident in 50 states, D.C., or Puerto Rico. 2.5+ GPA. Demonstrate leadership, determination, and resilience. Formerly AXA Achievement Scholarship.",link:"https://equitable.com/foundation/equitable-excellence-scholarship",deadline:"2026-12-18",amount:"$5,000/yr renewable",needBased:""},
  {id:"97dfe678",name:"Horatio Alger Scholarship",criteria:"High school senior. Demonstrated financial need (family income under $55,000). Minimum 2.0 GPA. Involvement in co-curricular and community activities. U.S. citizen.",link:"https://scholars.horatioalger.org/",deadline:"2026-10-25",amount:"$25,000",needBased:"Y"},
  {id:"a8ef7789",name:"Jack Kent Cooke Foundation College Scholarship",criteria:"High school senior with financial need (family income under $95,000). 3.5+ unweighted GPA. Standardized test scores. U.S. citizen or permanent resident.",link:"https://www.jkcf.org/our-scholarships/",deadline:"2026-11-18",amount:"Up to $55,000/yr",needBased:"Y"},
  {id:"b9f0889a",name:"Posse Foundation Scholarship",criteria:"Must be nominated by high school. Urban public high school students with extraordinary leadership potential. Full tuition at partner colleges.",link:"https://www.possefoundation.org/",deadline:"Nomination Only",amount:"Full Tuition",needBased:""},
  {id:"ca01999b",name:"Regeneron Science Talent Search",criteria:"High school seniors in the U.S. Must submit original research project in science, math, or engineering. Prestigious STEM competition.",link:"https://www.societyforscience.org/regeneron-sts/",deadline:"2026-11-12",amount:"Up to $250,000",needBased:""},
  {id:"db12aa0c",name:"National Merit Scholarship",criteria:"U.S. high school students. Based on PSAT/NMSQT scores taken in junior year. Must be enrolled or plan to enroll full-time in college.",link:"https://www.nationalmerit.org/",deadline:"2026-10-01",amount:"$2,500+",needBased:""},
  {id:"ec23bb1d",name:"Cobell Scholarship (Native American)",criteria:"Must be enrolled member of a federally recognized tribe. Undergraduate or graduate student. Financial need demonstrated.",link:"https://cobellscholar.org/",deadline:"2026-01-31",amount:"Up to $5,000",needBased:"Y"},
  {id:"fd34cc2e",name:"NAACP Scholarships",criteria:"African American students. Must be current NAACP member. Varies by specific scholarship program. Academic merit and financial need considered.",link:"https://naacp.org/find-resources/scholarships",deadline:"Varies",amount:"Varies",needBased:"Y"},
  {id:"0e45dd3f",name:"Dream.US Scholarship (DREAMers)",criteria:"DACA or TPS recipients. First-time college students or community college transfers. Financial need. 2.5+ GPA. Must attend a partner college.",link:"https://www.thedream.us/",deadline:"2026-02-28",amount:"Up to $33,000",needBased:"Y"},
  {id:"1f56ee40",name:"GE-Reagan Foundation Scholarship",criteria:"High school senior. U.S. citizen. Demonstrate leadership, drive, integrity, and citizenship. 3.0+ GPA. $20,000 renewable scholarship.",link:"https://www.reaganfoundation.org/education/scholarship-programs/",deadline:"2026-01-05",amount:"$10,000/yr renewable",needBased:""},
  {id:"3b780062",name:"Amazon Future Engineer Scholarship",criteria:"High school senior planning to study computer science. Financial need. Participation in STEM activities. Includes paid internship at Amazon.",link:"https://www.amazonfutureengineer.com/scholarships",deadline:"2026-01-20",amount:"$40,000",needBased:"Y"},
  {id:"4c890173",name:"Buick Achievers Scholarship",criteria:"High school senior or current undergraduate. Plan to major in a STEM field. Demonstrate financial need. Leadership and community involvement.",link:"https://www.buickachievers.com/",deadline:"2026-02-28",amount:"$25,000",needBased:"Y"},
  {id:"5d9a0284",name:"Davidson Fellows Scholarship",criteria:"Students 18 or under. Must complete a significant project in STEM, literature, music, philosophy, or outside the box. U.S. citizen or permanent resident.",link:"https://www.davidsongifted.org/gifted-programs/fellows-scholarship/",deadline:"2026-02-11",amount:"$10,000-$50,000",needBased:""},
  {id:"pev2026a",name:"Prudential Emerging Visionaries",criteria:"Ages 14-18. Must have created a financial or societal solution for your community. Replaces the former Prudential Spirit of Community Awards. U.S. residents.",link:"https://www.prudential.com/emerging-visionaries",deadline:"2026-11-01",amount:"Up to $15,000",needBased:""},
  {id:"7fbc24a6",name:"Taco Bell Live Mas Scholarship",criteria:"Ages 16-26. Must be pursuing education at an accredited institution in the U.S. Based on passion and innovation, not just grades. No GPA minimum.",link:"https://www.tacobellfoundation.org/live-mas-scholarship/",deadline:"2026-01-24",amount:"$5,000-$25,000",needBased:""},
  {id:"d65e378d",name:"Jackie Robinson Foundation Scholarship",criteria:"Minority high school senior with leadership potential. SAT/ACT scores considered. Financial need demonstrated. Must be U.S. citizen.",link:"https://www.jackierobinson.org/apply/",deadline:"2026-02-01",amount:"Up to $30,000",needBased:"Y"},
  {id:"fluncf26",name:"Foot Locker Foundation-UNCF Scholarship",criteria:"Students attending a UNCF member HBCU. Minimum 2.5 GPA. U.S. citizen, permanent resident, or national. Demonstrate financial need. Seeking bachelor's degree.",link:"https://uncf.org/scholarships",deadline:"2026-04-10",amount:"$5,000",needBased:"Y"},
  {id:"tmcfcoke",name:"TMCF Coca-Cola First Generation HBCU Scholarship",criteria:"First-generation college student. Graduating high school senior. Enrolling full-time at a TMCF member HBCU. Financial need. U.S. citizen or permanent resident.",link:"https://tmcf.org/",deadline:"2026-05-01",amount:"$5,000",needBased:"Y"},
];

// ============================================================
// PROFILE QUESTIONS for building candidate profiles
// ============================================================
const PROFILE_QUESTIONS = [
  {id:"name",q:"What is your full name?",type:"text",placeholder:"First Last"},
  {id:"email",q:"Email address?",type:"text",placeholder:"you@email.com"},
  {id:"phone",q:"Phone number?",type:"text",placeholder:"(555) 123-4567"},
  {id:"location",q:"Where are you located? (City, State)",type:"text",placeholder:"Rochester, NY"},
  {id:"citizenship",q:"Citizenship / Residency status?",type:"select",options:["U.S. Citizen","Dual Citizen (U.S./Canada)","Permanent Resident","DACA/TPS","International Student","Other"]},
  {id:"ethnicity",q:"How do you identify? (helps match heritage-specific scholarships)",type:"multiselect",options:["African American/Black","Hispanic/Latino","Asian/Pacific Islander","Native American/Indigenous","White/Caucasian","Multiracial","Prefer not to say"]},
  {id:"gpa",q:"Current GPA (unweighted)?",type:"text",placeholder:"3.7"},
  {id:"satact",q:"SAT or ACT score (if taken)?",type:"text",placeholder:"1350 SAT or 30 ACT"},
  {id:"school",q:"Current or most recent high school?",type:"text",placeholder:"Lincoln High School"},
  {id:"gradYear",q:"Graduation year?",type:"select",options:["2025","2026","2027","2028"]},
  {id:"intendedMajor",q:"Intended college major or field of study?",type:"text",placeholder:"Computer Science, Biology, etc."},
  {id:"financialNeed",q:"Do you demonstrate financial need?",type:"select",options:["Yes — Pell-eligible","Yes — moderate need","No significant need","Unsure"]},
  {id:"activities",q:"List your top 3-5 extracurricular activities / leadership roles:",type:"textarea",placeholder:"e.g., Captain of Debate Team, Volunteer at Food Bank, NSBE chapter co-founder..."},
  {id:"awards",q:"Notable awards or honors?",type:"textarea",placeholder:"e.g., AP Scholar, Regional Science Fair Winner, Honor Roll..."},
  {id:"communityService",q:"Describe your most impactful community service experience:",type:"textarea",placeholder:"What did you do? How many hours? What was the impact?"},
  {id:"personalStory",q:"What is your personal story? What challenges have you overcome?",type:"textarea",placeholder:"This is the heart of your application. Be authentic — what makes you, YOU?"},
  {id:"careerGoal",q:"What is your career goal and how does college fit into it?",type:"textarea",placeholder:"Where do you see yourself in 10 years? Why does this education matter?"},
  {id:"writingStyle",q:"How would you describe your writing voice?",type:"select",options:["Warm and narrative — I tell stories","Direct and evidence-based — I show data","Enthusiastic and energetic — I radiate passion","Reflective and thoughtful — I go deep","Professional and polished — I sound mature"]},
];

// ============================================================
// STYLE TEMPLATES
// ============================================================
const DEFAULT_TEMPLATES = [
  {id:"narrative",name:"The Storyteller",description:"Opens with a personal anecdote, weaves narrative throughout. Best for scholarships that value personal journey.",rules:"1. Open with a specific moment or memory. 2. Use I-statements. 3. Connect personal story to scholarship mission. 4. Close with forward-looking vision. 5. NO AI-isms: avoid 'delve','foster','landscape','cutting-edge'."},
  {id:"evidence",name:"The Scientist",description:"Lead with evidence and accomplishments. Data-driven. Best for STEM and merit-based scholarships.",rules:"1. Open with a concrete achievement or metric. 2. Use specific numbers and outcomes. 3. Frame experiences as evidence of capability. 4. Connect technical skills to broader impact. 5. NO fluff: replace 'I am passionate about' with 'My work in X demonstrated...'"},
  {id:"mission",name:"The Mission Matcher",description:"Deeply aligns candidate values with the scholarship's stated mission. Best for foundation and organization scholarships.",rules:"1. Reference the scholarship's mission statement directly. 2. Mirror their language naturally. 3. Show how your goals amplify their mission. 4. Provide specific examples of aligned work. 5. Keep tone collaborative, not sycophantic."},
  {id:"underdog",name:"The Overcomer",description:"Emphasizes resilience, challenges overcome, and growth. Best for need-based and adversity scholarships.",rules:"1. Be honest about challenges without being pitiful. 2. Show agency — what YOU did about it. 3. Frame hardship as fuel, not excuse. 4. Demonstrate growth trajectory. 5. End with strength and vision, not gratitude alone."},
];

// ============================================================
// UTILITY: Match scoring engine
// ============================================================
function scoreMatch(profile, scholarship) {
  let score = 0;
  let reasons = [];
  const c = (scholarship.criteria || "").toLowerCase();
  const n = (scholarship.name || "").toLowerCase();
  
  // Citizenship match
  if (profile.citizenship) {
    const cit = profile.citizenship.toLowerCase();
    if (c.includes("u.s. citizen") && (cit.includes("u.s.") || cit.includes("dual"))) { score += 20; reasons.push("Citizenship eligible"); }
    if (c.includes("daca") && cit.includes("daca")) { score += 25; reasons.push("DACA eligible"); }
  }
  
  // Ethnicity match
  if (profile.ethnicity && profile.ethnicity.length > 0) {
    const eth = profile.ethnicity.map(e => e.toLowerCase()).join(" ");
    if ((c.includes("african american") || n.includes("african american") || c.includes("black")) && eth.includes("african")) { score += 25; reasons.push("Heritage match"); }
    if ((c.includes("hispanic") || n.includes("hispanic") || c.includes("latino")) && eth.includes("hispanic")) { score += 25; reasons.push("Heritage match"); }
    if ((c.includes("asian") || n.includes("asian") || c.includes("pacific islander")) && eth.includes("asian")) { score += 25; reasons.push("Heritage match"); }
    if ((c.includes("native american") || c.includes("indigenous") || c.includes("tribal")) && eth.includes("native")) { score += 25; reasons.push("Heritage match"); }
  }
  
  // GPA match
  if (profile.gpa) {
    const gpa = parseFloat(profile.gpa);
    const gpaMatch = c.match(/(\d\.\d)\+?\s*gpa|gpa\s*(?:of\s*)?(\d\.\d)/);
    if (gpaMatch) {
      const req = parseFloat(gpaMatch[1] || gpaMatch[2]);
      if (gpa >= req) { score += 15; reasons.push(`GPA ${gpa} meets ${req} req`); }
    } else if (gpa >= 3.0) { score += 10; reasons.push("Strong GPA"); }
  }
  
  // Financial need
  if (profile.financialNeed) {
    const need = profile.financialNeed.toLowerCase();
    if (scholarship.needBased === "Y" && need.includes("yes")) { score += 15; reasons.push("Need-based match"); }
    if (scholarship.needBased !== "Y" && !need.includes("yes")) { score += 5; reasons.push("Merit-based fit"); }
  }
  
  // Major/Field match
  if (profile.intendedMajor) {
    const major = profile.intendedMajor.toLowerCase();
    if ((c.includes("stem") || c.includes("science") || c.includes("engineering")) && 
        (major.includes("science") || major.includes("engineering") || major.includes("computer") || major.includes("math"))) {
      score += 15; reasons.push("STEM field match");
    }
  }
  
  // Leadership / Activities
  if (profile.activities && profile.activities.length > 30) {
    if (c.includes("leadership")) { score += 10; reasons.push("Leadership valued"); }
    if (c.includes("community") || c.includes("volunteer")) { score += 10; reasons.push("Service match"); }
  }
  
  // High school senior match
  if (profile.gradYear && (c.includes("high school senior") || c.includes("graduating"))) {
    score += 5; reasons.push("Grade level match");
  }
  
  return { score: Math.min(score, 100), reasons };
}

// ============================================================
// MAIN APP COMPONENT
// ============================================================
export default function ScholarBotPro() {
  const [view, setView] = useState("home");
  const [profile, setProfile] = useState({});
  const [profileComplete, setProfileComplete] = useState(false);
  const [bragSheet, setBragSheet] = useState("");
  const [scholarshipDB, setScholarshipDB] = useState(DEFAULT_SCHOLARSHIP_DB);
  const [dbLastUpdated, setDbLastUpdated] = useState("2026-02-11");
  const [dbSource, setDbSource] = useState("built-in");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterNeedBased, setFilterNeedBased] = useState("all");
  const [matchResults, setMatchResults] = useState([]);
  const [selectedScholarship, setSelectedScholarship] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(DEFAULT_TEMPLATES[0]);
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [generatedLetter, setGeneratedLetter] = useState("");
  const [generatingLetter, setGeneratingLetter] = useState(false);
  const [generatedProfile, setGeneratedProfile] = useState("");
  const [savedLetters, setSavedLetters] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [appAnswers, setAppAnswers] = useState({});
  const [notification, setNotification] = useState(null);
  const [bragSheetFileName, setBragSheetFileName] = useState("");
  const [bragSheetUploading, setBragSheetUploading] = useState(false);
  const bragFileRef = useRef(null);
  // Letter generator: custom scholarship input
  const [scholarshipInputMode, setScholarshipInputMode] = useState("database"); // "database" | "upload" | "url" | "paste"
  const [customScholarshipText, setCustomScholarshipText] = useState("");
  const [customScholarshipName, setCustomScholarshipName] = useState("");
  const [scholarshipUrl, setScholarshipUrl] = useState("");
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [uploadedScholarshipName, setUploadedScholarshipName] = useState("");
  const scholarshipFileRef = useRef(null);

  // Helper: Read file as text (PDF via basic extraction, TXT/DOC as-is)
  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const name = file.name.toLowerCase();
      if (name.endsWith(".pdf")) {
        // For PDFs, read as array buffer and do basic text extraction
        reader.onload = async (e) => {
          try {
            const uint8 = new Uint8Array(e.target.result);
            // Basic PDF text extraction: find text between BT/ET markers and parentheses
            const text = new TextDecoder("utf-8", { fatal: false }).decode(uint8);
            // Extract readable strings (rough but works for most PDFs)
            const readable = text.match(/[\x20-\x7E]{4,}/g) || [];
            const cleaned = readable.join(" ").replace(/\s+/g, " ").slice(0, 15000);
            if (cleaned.length > 100) {
              resolve(cleaned);
            } else {
              // Fallback: send the base64 to Claude for extraction
              const base64 = btoa(String.fromCharCode(...uint8.slice(0, 50000)));
              resolve(`[PDF DOCUMENT - Base64 encoded, first portion]\nFilename: ${file.name}\nNote: This is a PDF file. Please extract and analyze the scholarship information from this content.\n\nRaw text fragments found:\n${readable.slice(0, 200).join("\n")}`);
            }
          } catch(err) {
            reject(err);
          }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      } else {
        // Text-based files
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
      }
    });
  };

  // Handle brag sheet file upload
  const handleBragSheetUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBragSheetUploading(true);
    setBragSheetFileName(file.name);
    try {
      const text = await readFileAsText(file);
      setBragSheet(prev => prev ? prev + "\n\n--- Uploaded from: " + file.name + " ---\n\n" + text : text);
      notify(`Brag sheet "${file.name}" uploaded successfully!`);
    } catch(err) {
      notify("Error reading file. Try pasting the content instead.");
    }
    setBragSheetUploading(false);
    if (bragFileRef.current) bragFileRef.current.value = "";
  };

  // Handle scholarship file upload
  const handleScholarshipUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedScholarshipName(file.name);
    try {
      const text = await readFileAsText(file);
      setCustomScholarshipText(text);
      if (!customScholarshipName) setCustomScholarshipName(file.name.replace(/\.\w+$/, ""));
      notify(`Scholarship "${file.name}" loaded!`);
    } catch(err) {
      notify("Error reading file. Try pasting the content instead.");
    }
    if (scholarshipFileRef.current) scholarshipFileRef.current.value = "";
  };

  // Fetch scholarship from URL via Claude API
  const fetchScholarshipFromUrl = async () => {
    if (!scholarshipUrl.trim()) { notify("Please enter a URL."); return; }
    setFetchingUrl(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{
            role: "user",
            content: `Search for this scholarship page and extract the key details: ${scholarshipUrl}\n\nReturn a structured summary with: Scholarship Name, Organization, Eligibility/Criteria, Award Amount, Deadline, and Application Requirements. Be thorough.`
          }]
        })
      });
      const data = await response.json();
      const text = data.content?.map(b => b.text || "").filter(Boolean).join("\n") || "";
      if (text) {
        setCustomScholarshipText(text);
        // Try to extract name from the response
        const nameMatch = text.match(/(?:Scholarship\s*Name|Name)\s*[:\-]\s*(.+)/i);
        if (nameMatch && !customScholarshipName) setCustomScholarshipName(nameMatch[1].trim().slice(0, 80));
        notify("Scholarship details fetched successfully!");
      } else {
        notify("Could not fetch details. Try pasting the content manually.");
      }
    } catch(err) {
      notify("Error fetching URL. Try pasting the content manually.");
    }
    setFetchingUrl(false);
  };

  // Load saved data from localStorage + scholarships from Supabase
  useEffect(() => {
    // Load user data from localStorage
    const p = store.get("scholarbot-profile"); if (p) setProfile(p);
    const l = store.get("scholarbot-letters"); if (l) setSavedLetters(l);
    const t = store.get("scholarbot-templates"); if (t) setTemplates(t);
    const a = store.get("scholarbot-answers"); if (a) setAppAnswers(a);
    // Load scholarships from Supabase
    fetchScholarshipsFromSupabase().then(rows => {
      if (rows && rows.length > 0) {
        setScholarshipDB(rows);
        setDbLastUpdated(new Date().toISOString().split("T")[0]);
        setDbSource("synced");
      }
    });
  }, []);

  const notify = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const saveProfile = async (p) => {
    setProfile(p);
    store.set("scholarbot-profile", p);
  };

  const saveLetter = async (letter) => {
    const updated = [...savedLetters, { ...letter, id: Date.now(), date: new Date().toLocaleDateString() }];
    setSavedLetters(updated);
    store.set("scholarbot-letters", updated);
    notify("Letter saved!");
  };

  const saveTemplates = async (t) => {
    setTemplates(t);
    store.set("scholarbot-templates", t);
  };

  // MATCHING ENGINE
  const runMatching = useCallback(() => {
    if (!profile.name) { notify("Please complete your profile first."); return; }
    const results = scholarshipDB.map(s => {
      const { score, reasons } = scoreMatch(profile, s);
      return { ...s, matchScore: score, matchReasons: reasons };
    }).filter(s => s.matchScore > 0).sort((a,b) => b.matchScore - a.matchScore);
    setMatchResults(results);
    setView("matches");
    notify(`Found ${results.length} matches!`);
  }, [profile, scholarshipDB]);

  // LETTER GENERATION via Anthropic API
  const generateLetter = async () => {
    // Determine scholarship info based on input mode
    const hasDbSelection = scholarshipInputMode === "database" && selectedScholarship;
    const hasCustomInput = scholarshipInputMode !== "database" && customScholarshipText.trim();
    
    if (!hasDbSelection && !hasCustomInput) {
      notify(scholarshipInputMode === "database" 
        ? "Select a scholarship from the database." 
        : "Please provide scholarship details (upload, paste URL, or paste text).");
      return;
    }
    if (!profile.name) { notify("Complete your profile first."); return; }
    
    setGeneratingLetter(true);
    setGeneratedLetter("");
    
    // Build scholarship details based on source
    let scholarshipDetails;
    let scholarshipLabel;
    
    if (hasDbSelection) {
      scholarshipLabel = selectedScholarship.name;
      scholarshipDetails = `
SCHOLARSHIP DETAILS (from database):
- Name: ${selectedScholarship.name}
- Criteria: ${selectedScholarship.criteria}
- Amount: ${selectedScholarship.amount}
- Link: ${selectedScholarship.link}`;
    } else {
      scholarshipLabel = customScholarshipName || "Custom Scholarship";
      scholarshipDetails = `
SCHOLARSHIP DETAILS (provided by user):
- Name: ${customScholarshipName || "Not specified"}
${scholarshipUrl ? `- URL: ${scholarshipUrl}` : ""}
- Full Description/Requirements:
${customScholarshipText.slice(0, 8000)}`;
    }
    
    const profileSummary = `
CANDIDATE: ${profile.name}
LOCATION: ${profile.location || "N/A"}
CITIZENSHIP: ${profile.citizenship || "N/A"}
HERITAGE: ${(profile.ethnicity || []).join(", ")}
GPA: ${profile.gpa || "N/A"} | TEST SCORES: ${profile.satact || "N/A"}
INTENDED MAJOR: ${profile.intendedMajor || "N/A"}
GRADUATION: ${profile.gradYear || "N/A"}
FINANCIAL NEED: ${profile.financialNeed || "N/A"}
ACTIVITIES: ${profile.activities || "N/A"}
AWARDS: ${profile.awards || "N/A"}
COMMUNITY SERVICE: ${profile.communityService || "N/A"}
PERSONAL STORY: ${profile.personalStory || "N/A"}
CAREER GOAL: ${profile.careerGoal || "N/A"}
WRITING VOICE: ${profile.writingStyle || "Warm and narrative"}
BRAG SHEET NOTES: ${bragSheet || "None provided"}
APPLICATION ANSWERS: ${JSON.stringify(appAnswers)}
    `.trim();
    
    const systemPrompt = `You are a scholarship application letter writer. You must write in the candidate's authentic voice — NOT like an AI.

STYLE TEMPLATE: "${selectedTemplate.name}"
RULES: ${selectedTemplate.rules}

CRITICAL ANTI-DETECTION RULES:
1. NEVER use: "delve," "cutting-edge," "landscape," "foster," "tapestry," "game-changer," "testament," "unwavering," "thrilled," "elevate," "synergy"
2. Vary sentence length. Mix short punchy sentences with longer ones.
3. Use specific details — names, dates, numbers, places.
4. Sound like a real ${profile.gradYear || "2026"} high school student, not a corporate press release.
5. NO em-dashes (—). Use periods or commas instead.
6. Don't start paragraphs with "Additionally," "Furthermore," or "Moreover."
7. Open with something MEMORABLE, not generic.

CANDIDATE PROFILE:
${profileSummary}`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{
            role: "user",
            content: `Write a scholarship application letter for the "${scholarshipLabel}" scholarship.

${scholarshipDetails}

Write a compelling, authentic letter (350-500 words) that matches this specific scholarship's criteria to the candidate's profile. Make it feel HUMAN, not AI-generated. If a full scholarship description was provided, carefully analyze its eligibility requirements, mission, and values to tailor the letter precisely.`
          }]
        })
      });
      const data = await response.json();
      const text = data.content?.map(b => b.text || "").join("\n") || "Error generating letter.";
      setGeneratedLetter(text);
    } catch(e) {
      setGeneratedLetter("Error: Could not connect to the AI service. Please try again.");
    }
    setGeneratingLetter(false);
  };

  // PROFILE GENERATION
  const generateCandidateProfile = async () => {
    if (!profile.name) { notify("Complete your profile first."); return; }
    setGeneratingLetter(true);
    
    const profileData = PROFILE_QUESTIONS.map(q => `${q.q}: ${Array.isArray(profile[q.id]) ? profile[q.id].join(", ") : (profile[q.id] || "N/A")}`).join("\n");
    
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `Create a candidate profile in Markdown format for scholarship applications, modeled after this template:

# Candidate Profile: [Name]

**Contact Info:**
* Email / Phone / Location

**Voice:** [Describe their writing voice based on their style preference]
* Style: How they write
* Key trait: What makes them unique

**Humanization & Anti-Detection Rules (CRITICAL):**
[Include 4 specific rules for making their letters sound authentic, NOT AI-generated]

**Key Directives for the AI:**
[5 specific directives based on their strongest assets, like certifications, heritage, unique projects, leadership roles, and personal story elements that should be highlighted]

BASE THIS ON:
${profileData}
${bragSheet ? `\nBRAG SHEET:\n${bragSheet}` : ""}
${Object.keys(appAnswers).length > 0 ? `\nAPPLICATION ANSWERS:\n${JSON.stringify(appAnswers)}` : ""}`
          }]
        })
      });
      const data = await response.json();
      const text = data.content?.map(b => b.text || "").join("\n") || "Error.";
      setGeneratedProfile(text);
      setView("profileResult");
    } catch(e) {
      notify("Error generating profile.");
    }
    setGeneratingLetter(false);
  };

  // GENERIC APPLICATION PROMPTS
  const APP_QUESTIONS = [
    "Tell us about yourself and your educational goals. (150-300 words)",
    "Describe a challenge you've overcome and what you learned from it. (150-300 words)",
    "How will this scholarship help you achieve your goals? (100-200 words)",
    "Describe your most significant community contribution. (150-250 words)",
    "Why should you be selected for this scholarship? (100-200 words)"
  ];

  // ============================================================
  // FILTERED SCHOLARSHIP LIST
  // ============================================================
  const filteredScholarships = scholarshipDB.filter(s => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.criteria.toLowerCase().includes(q) || (s.amount||"").toLowerCase().includes(q);
    const matchesNeed = filterNeedBased === "all" || (filterNeedBased === "need" && s.needBased === "Y") || (filterNeedBased === "merit" && s.needBased !== "Y");
    return matchesSearch && matchesNeed;
  });

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div style={{fontFamily:"'Instrument Serif', Georgia, 'Times New Roman', serif",minHeight:"100vh",background:"#0a0a0f",color:"#e8e4dc",overflow:"hidden"}}>
      
      {/* NOTIFICATION TOAST */}
      {notification && (
        <div style={{position:"fixed",top:20,right:20,background:"#c9a227",color:"#0a0a0f",padding:"12px 24px",borderRadius:8,zIndex:9999,fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:600,boxShadow:"0 8px 32px rgba(201,162,39,0.3)",animation:"slideIn 0.3s ease"}}>
          {notification}
        </div>
      )}

      {/* SIDEBAR NAV */}
      <div style={{position:"fixed",left:0,top:0,bottom:0,width:260,background:"#111118",borderRight:"1px solid #1e1e2e",display:"flex",flexDirection:"column",zIndex:100}}>
        <div style={{padding:"28px 24px 20px",borderBottom:"1px solid #1e1e2e"}}>
          <div style={{fontSize:11,fontFamily:"'DM Sans',sans-serif",letterSpacing:3,color:"#c9a227",textTransform:"uppercase",marginBottom:4}}>ScholarBot</div>
          <div style={{fontSize:22,fontWeight:400,letterSpacing:1,color:"#e8e4dc"}}>PRO</div>
        </div>
        
        {[
          {id:"home",icon:"◇",label:"Dashboard"},
          {id:"profile",icon:"◈",label:"Build Profile"},
          {id:"search",icon:"⬡",label:"Browse Scholarships"},
          {id:"matches",icon:"◆",label:"My Matches"},
          {id:"apply",icon:"▣",label:"Application Prep"},
          {id:"generate",icon:"◉",label:"Letter Generator"},
          {id:"templates",icon:"▤",label:"Style Templates"},
          {id:"saved",icon:"◫",label:"Saved Letters"},
        ].map(item => (
          <button key={item.id} onClick={() => setView(item.id)} style={{
            display:"flex",alignItems:"center",gap:12,padding:"14px 24px",border:"none",
            background:view === item.id ? "linear-gradient(90deg,#1a1a2e,transparent)" : "transparent",
            color:view === item.id ? "#c9a227" : "#777",cursor:"pointer",fontSize:14,
            fontFamily:"'DM Sans',sans-serif",textAlign:"left",width:"100%",
            borderLeft:view === item.id ? "2px solid #c9a227" : "2px solid transparent",
            transition:"all 0.2s"
          }}>
            <span style={{fontSize:16,opacity:0.8}}>{item.icon}</span>
            {item.label}
          </button>
        ))}
        
        {profile.name && (
          <div style={{marginTop:"auto",padding:"16px 24px",borderTop:"1px solid #1e1e2e",fontSize:12,fontFamily:"'DM Sans',sans-serif",color:"#555"}}>
            Logged in as<br/><span style={{color:"#c9a227"}}>{profile.name}</span>
          </div>
        )}
      </div>

      {/* MAIN CONTENT */}
      <div style={{marginLeft:260,minHeight:"100vh",padding:"40px 48px"}}>
        
        {/* ====== HOME / DASHBOARD ====== */}
        {view === "home" && (
          <div>
            <div style={{marginBottom:48}}>
              <h1 style={{fontSize:48,fontWeight:400,lineHeight:1.1,marginBottom:8,background:"linear-gradient(135deg,#e8e4dc,#c9a227)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Your Scholarship<br/>Command Center</h1>
              <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:16,color:"#666",maxWidth:500,lineHeight:1.6}}>
                {scholarshipDB.length} scholarships loaded. AI-powered matching. Human-sounding application letters. Everything you need to fund your future.
                {scholarshipDB.length <= 30 && <span style={{display:"block",marginTop:8,fontSize:13,color:"#c9a227"}}>Run the Scholarship Verifier to load 400+ scholarships from your master spreadsheets.</span>}
              </p>
            </div>
            
            {/* Stats Grid */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:20,marginBottom:16}}>
              {[
                {label:"Scholarships in Database",value:scholarshipDB.length,color:"#c9a227"},
                {label:"Profile Completion",value:profile.name ? `${Math.round(Object.keys(profile).filter(k=>profile[k]).length / PROFILE_QUESTIONS.length * 100)}%` : "0%",color:"#4ecdc4"},
                {label:"Matched Opportunities",value:matchResults.length || "—",color:"#e056a0"},
                {label:"Letters Generated",value:savedLetters.length,color:"#7c6bff"},
              ].map((stat,i) => (
                <div key={i} style={{background:"#111118",border:"1px solid #1e1e2e",borderRadius:12,padding:"24px 20px"}}>
                  <div style={{fontSize:36,fontWeight:300,color:stat.color,marginBottom:4}}>{stat.value}</div>
                  <div style={{fontSize:12,fontFamily:"'DM Sans',sans-serif",color:"#555",letterSpacing:1,textTransform:"uppercase"}}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Database Status Bar */}
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 18px",background:"#111118",border:"1px solid #1e1e2e",borderRadius:10,marginBottom:40,fontSize:12,fontFamily:"'DM Sans',sans-serif"}}>
              <span style={{width:8,height:8,borderRadius:"50%",background:dbSource === "synced" ? "#4ecdc4" : "#c9a227",flexShrink:0}}/>
              <span style={{color:"#777"}}>
                Database: <span style={{color:"#aaa"}}>{scholarshipDB.length} scholarships</span> · 
                Last updated: <span style={{color:"#aaa"}}>{dbLastUpdated}</span> · 
                Source: <span style={{color:dbSource === "synced" ? "#4ecdc4" : "#c9a227"}}>{dbSource === "synced" ? "Auto-synced from ScholarBot Hunter" : "Built-in (verified Feb 11, 2026)"}</span>
              </span>
            </div>

            {/* Quick Actions */}
            <h2 style={{fontSize:20,fontWeight:400,marginBottom:20,color:"#888"}}>Quick Actions</h2>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
              {[
                {label:"Build Your Profile",desc:"Answer questions to create your scholarship persona.",action:()=>setView("profile"),color:"#c9a227"},
                {label:"Find Matches",desc:"AI matches you to the best-fit scholarships.",action:()=>{if(profile.name){runMatching()}else{setView("profile")}},color:"#4ecdc4"},
                {label:"Generate a Letter",desc:"Create a human-sounding scholarship application letter.",action:()=>setView("generate"),color:"#e056a0"},
              ].map((a,i) => (
                <button key={i} onClick={a.action} style={{
                  background:"#111118",border:`1px solid ${a.color}22`,borderRadius:12,padding:"28px 24px",
                  cursor:"pointer",textAlign:"left",transition:"all 0.3s",color:"#e8e4dc"
                }}
                onMouseEnter={e => {e.currentTarget.style.borderColor = a.color; e.currentTarget.style.transform = "translateY(-2px)"}}
                onMouseLeave={e => {e.currentTarget.style.borderColor = a.color+"22"; e.currentTarget.style.transform = "translateY(0)"}}>
                  <div style={{fontSize:18,fontWeight:400,marginBottom:8}}>{a.label}</div>
                  <div style={{fontSize:13,fontFamily:"'DM Sans',sans-serif",color:"#666",lineHeight:1.5}}>{a.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ====== PROFILE BUILDER ====== */}
        {view === "profile" && (
          <div>
            <h1 style={{fontSize:36,fontWeight:400,marginBottom:8}}>Build Your Profile</h1>
            <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,color:"#666",marginBottom:32}}>
              Answer these questions to create your scholarship candidate profile. Upload or paste your brag sheet below.
            </p>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,marginBottom:32}}>
              {PROFILE_QUESTIONS.map(q => (
                <div key={q.id} style={{gridColumn: q.type === "textarea" ? "1/-1" : "auto"}}>
                  <label style={{display:"block",fontSize:13,fontFamily:"'DM Sans',sans-serif",color:"#999",marginBottom:8}}>{q.q}</label>
                  
                  {q.type === "text" && (
                    <input value={profile[q.id] || ""} onChange={e => saveProfile({...profile, [q.id]: e.target.value})}
                      placeholder={q.placeholder} style={{
                        width:"100%",padding:"12px 16px",background:"#111118",border:"1px solid #1e1e2e",
                        borderRadius:8,color:"#e8e4dc",fontSize:14,fontFamily:"'DM Sans',sans-serif",outline:"none",boxSizing:"border-box"
                      }}/>
                  )}
                  
                  {q.type === "select" && (
                    <select value={profile[q.id] || ""} onChange={e => saveProfile({...profile, [q.id]: e.target.value})}
                      style={{width:"100%",padding:"12px 16px",background:"#111118",border:"1px solid #1e1e2e",borderRadius:8,color:"#e8e4dc",fontSize:14,fontFamily:"'DM Sans',sans-serif",outline:"none"}}>
                      <option value="">Select...</option>
                      {q.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )}
                  
                  {q.type === "multiselect" && (
                    <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                      {q.options.map(o => {
                        const sel = (profile[q.id] || []).includes(o);
                        return (
                          <button key={o} onClick={() => {
                            const cur = profile[q.id] || [];
                            const next = sel ? cur.filter(x => x !== o) : [...cur, o];
                            saveProfile({...profile, [q.id]: next});
                          }} style={{
                            padding:"8px 14px",borderRadius:20,border:sel ? "1px solid #c9a227" : "1px solid #1e1e2e",
                            background:sel ? "#c9a22722" : "#111118",color:sel ? "#c9a227" : "#777",
                            cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif"
                          }}>{o}</button>
                        );
                      })}
                    </div>
                  )}
                  
                  {q.type === "textarea" && (
                    <textarea value={profile[q.id] || ""} onChange={e => saveProfile({...profile, [q.id]: e.target.value})}
                      placeholder={q.placeholder} rows={4} style={{
                        width:"100%",padding:"12px 16px",background:"#111118",border:"1px solid #1e1e2e",
                        borderRadius:8,color:"#e8e4dc",fontSize:14,fontFamily:"'DM Sans',sans-serif",
                        outline:"none",resize:"vertical",lineHeight:1.6,boxSizing:"border-box"
                      }}/>
                  )}
                </div>
              ))}
            </div>

            {/* Brag Sheet Upload + Paste */}
            <div style={{background:"#111118",border:"1px solid #1e1e2e",borderRadius:12,padding:24,marginBottom:24}}>
              <h3 style={{fontSize:16,fontWeight:400,marginBottom:4}}>Your Brag Sheet <span style={{color:"#666",fontSize:12}}>(optional)</span></h3>
              <p style={{fontSize:12,fontFamily:"'DM Sans',sans-serif",color:"#555",marginBottom:16}}>Upload a PDF, Word doc, or text file. Or paste directly below. Both work together.</p>
              
              {/* File Upload Zone */}
              <div 
                onClick={() => bragFileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "#c9a227"; }}
                onDragLeave={e => { e.currentTarget.style.borderColor = "#1e1e2e"; }}
                onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = "#1e1e2e"; const f = e.dataTransfer.files[0]; if(f) handleBragSheetUpload({target:{files:[f]}}); }}
                style={{
                  border:"2px dashed #1e1e2e",borderRadius:10,padding:"24px 20px",textAlign:"center",
                  cursor:"pointer",marginBottom:14,transition:"border-color 0.2s",background:"#0a0a0f"
                }}>
                <input ref={bragFileRef} type="file" accept=".pdf,.doc,.docx,.txt,.md,.rtf" onChange={handleBragSheetUpload} style={{display:"none"}} />
                {bragSheetUploading ? (
                  <div style={{color:"#c9a227",fontFamily:"'DM Sans',sans-serif",fontSize:13}}>Reading file...</div>
                ) : bragSheetFileName ? (
                  <div>
                    <div style={{fontSize:20,marginBottom:4}}>✓</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#c9a227"}}>{bragSheetFileName}</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#555",marginTop:4}}>Click or drop to replace</div>
                  </div>
                ) : (
                  <div>
                    <div style={{fontSize:24,marginBottom:6,color:"#333"}}>↑</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#777"}}>Drop your brag sheet here, or click to browse</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#444",marginTop:4}}>PDF, Word, or text files accepted</div>
                  </div>
                )}
              </div>

              {/* Paste Area */}
              <textarea value={bragSheet} onChange={e => setBragSheet(e.target.value)}
                placeholder="Or paste your resume, brag sheet, or activity list here. Both upload and paste work together — uploaded content appears here too."
                rows={6} style={{
                  width:"100%",padding:"12px 16px",background:"#0a0a0f",border:"1px solid #1e1e2e",
                  borderRadius:8,color:"#e8e4dc",fontSize:14,fontFamily:"'DM Sans',sans-serif",
                  outline:"none",resize:"vertical",lineHeight:1.6,boxSizing:"border-box"
                }}/>
              {bragSheet && (
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
                  <span style={{fontSize:11,fontFamily:"'DM Sans',sans-serif",color:"#444"}}>{bragSheet.length.toLocaleString()} characters loaded</span>
                  <button onClick={() => { setBragSheet(""); setBragSheetFileName(""); }} style={{fontSize:11,fontFamily:"'DM Sans',sans-serif",color:"#e056a0",background:"none",border:"none",cursor:"pointer"}}>Clear all</button>
                </div>
              )}
            </div>

            <div style={{display:"flex",gap:16}}>
              <button onClick={generateCandidateProfile} disabled={generatingLetter} style={{
                padding:"14px 32px",background:generatingLetter?"#333":"linear-gradient(135deg,#c9a227,#b8911e)",
                border:"none",borderRadius:8,color:"#0a0a0f",fontSize:14,fontWeight:600,
                fontFamily:"'DM Sans',sans-serif",cursor:generatingLetter?"wait":"pointer"
              }}>
                {generatingLetter ? "Generating..." : "Generate AI Profile →"}
              </button>
              <button onClick={runMatching} style={{
                padding:"14px 32px",background:"transparent",border:"1px solid #c9a227",
                borderRadius:8,color:"#c9a227",fontSize:14,fontFamily:"'DM Sans',sans-serif",cursor:"pointer"
              }}>
                Find My Matches
              </button>
            </div>
          </div>
        )}

        {/* ====== GENERATED PROFILE RESULT ====== */}
        {view === "profileResult" && (
          <div>
            <button onClick={() => setView("profile")} style={{background:"none",border:"none",color:"#c9a227",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:13,marginBottom:20}}>← Back to Profile Builder</button>
            <h1 style={{fontSize:36,fontWeight:400,marginBottom:24}}>Your Candidate Profile</h1>
            <div style={{background:"#111118",border:"1px solid #1e1e2e",borderRadius:12,padding:32,maxWidth:800}}>
              <pre style={{whiteSpace:"pre-wrap",fontFamily:"'DM Sans','Courier New',monospace",fontSize:14,lineHeight:1.8,color:"#d4d0c8"}}>{generatedProfile}</pre>
            </div>
            <div style={{marginTop:20,display:"flex",gap:12}}>
              <button onClick={() => {navigator.clipboard.writeText(generatedProfile); notify("Copied to clipboard!")}} style={{
                padding:"12px 24px",background:"#c9a227",border:"none",borderRadius:8,color:"#0a0a0f",
                fontSize:13,fontWeight:600,fontFamily:"'DM Sans',sans-serif",cursor:"pointer"
              }}>Copy Profile</button>
              <button onClick={runMatching} style={{
                padding:"12px 24px",background:"transparent",border:"1px solid #c9a227",borderRadius:8,
                color:"#c9a227",fontSize:13,fontFamily:"'DM Sans',sans-serif",cursor:"pointer"
              }}>Find Matches →</button>
            </div>
          </div>
        )}

        {/* ====== SCHOLARSHIP SEARCH ====== */}
        {view === "search" && (
          <div>
            <h1 style={{fontSize:36,fontWeight:400,marginBottom:24}}>Browse Scholarships</h1>
            
            <div style={{display:"flex",gap:16,marginBottom:24}}>
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name, criteria, or amount..."
                style={{flex:1,padding:"12px 20px",background:"#111118",border:"1px solid #1e1e2e",borderRadius:8,color:"#e8e4dc",fontSize:14,fontFamily:"'DM Sans',sans-serif",outline:"none"}}/>
              <select value={filterNeedBased} onChange={e => setFilterNeedBased(e.target.value)}
                style={{padding:"12px 16px",background:"#111118",border:"1px solid #1e1e2e",borderRadius:8,color:"#e8e4dc",fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none"}}>
                <option value="all">All Types</option>
                <option value="need">Need-Based</option>
                <option value="merit">Merit-Based</option>
              </select>
            </div>

            <div style={{fontSize:12,fontFamily:"'DM Sans',sans-serif",color:"#555",marginBottom:16}}>
              Showing {filteredScholarships.length} of {scholarshipDB.length} scholarships
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {filteredScholarships.map(s => (
                <div key={s.id} style={{background:"#111118",border:"1px solid #1e1e2e",borderRadius:10,padding:"20px 24px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:20}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:16,fontWeight:400,marginBottom:6}}>{s.name}</div>
                    <div style={{fontSize:12,fontFamily:"'DM Sans',sans-serif",color:"#777",lineHeight:1.5,marginBottom:8}}>{s.criteria.slice(0,150)}{s.criteria.length > 150 ? "..." : ""}</div>
                    <div style={{display:"flex",gap:12,fontSize:11,fontFamily:"'DM Sans',sans-serif"}}>
                      {s.amount && <span style={{background:"#c9a22722",color:"#c9a227",padding:"4px 10px",borderRadius:4}}>{s.amount}</span>}
                      {s.deadline && <span style={{color:"#666"}}>Deadline: {s.deadline.split(" ")[0]}</span>}
                      {s.needBased === "Y" && <span style={{background:"#4ecdc422",color:"#4ecdc4",padding:"4px 10px",borderRadius:4}}>Need-Based</span>}
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    <button onClick={() => {setSelectedScholarship(s); setView("generate")}} style={{
                      padding:"8px 16px",background:"#c9a227",border:"none",borderRadius:6,color:"#0a0a0f",
                      fontSize:12,fontWeight:600,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",whiteSpace:"nowrap"
                    }}>Apply →</button>
                    {s.link && <a href={s.link} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:"#666",fontFamily:"'DM Sans',sans-serif",textDecoration:"none"}}>View source ↗</a>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ====== MATCHES ====== */}
        {view === "matches" && (
          <div>
            <h1 style={{fontSize:36,fontWeight:400,marginBottom:8}}>Your Matches</h1>
            <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,color:"#666",marginBottom:24}}>
              Scholarships ranked by how well they match your profile. Higher scores mean better fit.
            </p>
            
            {matchResults.length === 0 ? (
              <div style={{textAlign:"center",padding:60}}>
                <div style={{fontSize:48,marginBottom:16}}>◇</div>
                <div style={{fontSize:16,color:"#666",marginBottom:20}}>No matches yet.</div>
                <button onClick={() => setView("profile")} style={{padding:"12px 24px",background:"#c9a227",border:"none",borderRadius:8,color:"#0a0a0f",fontSize:14,fontWeight:600,fontFamily:"'DM Sans',sans-serif",cursor:"pointer"}}>
                  Complete Your Profile
                </button>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {matchResults.map((s,i) => (
                  <div key={s.id} style={{background:"#111118",border:"1px solid #1e1e2e",borderRadius:10,padding:"20px 24px",display:"flex",alignItems:"center",gap:20}}>
                    <div style={{width:56,height:56,borderRadius:12,background:`conic-gradient(${s.matchScore >= 70 ? "#4ecdc4" : s.matchScore >= 40 ? "#c9a227" : "#e056a0"} ${s.matchScore*3.6}deg, #1e1e2e 0deg)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <div style={{width:44,height:44,borderRadius:8,background:"#111118",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:600,color:s.matchScore >= 70 ? "#4ecdc4" : s.matchScore >= 40 ? "#c9a227" : "#e056a0"}}>
                        {s.matchScore}
                      </div>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:16,fontWeight:400,marginBottom:4}}>{s.name}</div>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        {s.matchReasons.map((r,j) => (
                          <span key={j} style={{fontSize:11,fontFamily:"'DM Sans',sans-serif",background:"#1e1e2e",color:"#999",padding:"3px 8px",borderRadius:4}}>{r}</span>
                        ))}
                      </div>
                      {s.amount && <div style={{fontSize:12,fontFamily:"'DM Sans',sans-serif",color:"#c9a227",marginTop:6}}>{s.amount}</div>}
                    </div>
                    <button onClick={() => {setSelectedScholarship(s); setView("generate")}} style={{
                      padding:"10px 20px",background:"#c9a227",border:"none",borderRadius:8,color:"#0a0a0f",
                      fontSize:13,fontWeight:600,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",flexShrink:0
                    }}>Generate Letter</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ====== APPLICATION PREP ====== */}
        {view === "apply" && (
          <div>
            <h1 style={{fontSize:36,fontWeight:400,marginBottom:8}}>Application Prep</h1>
            <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,color:"#666",marginBottom:32}}>
              Answer these common scholarship questions. Your responses will be used to generate more targeted letters.
            </p>
            
            {APP_QUESTIONS.map((q, i) => (
              <div key={i} style={{marginBottom:28}}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                  <span style={{width:28,height:28,borderRadius:"50%",background:appAnswers[`q${i}`] ? "#c9a22733" : "#1e1e2e",color:appAnswers[`q${i}`] ? "#c9a227" : "#555",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontFamily:"'DM Sans',sans-serif",fontWeight:600,flexShrink:0}}>
                    {appAnswers[`q${i}`] ? "✓" : i+1}
                  </span>
                  <label style={{fontSize:14,fontFamily:"'DM Sans',sans-serif",color:"#bbb"}}>{q}</label>
                </div>
                <textarea value={appAnswers[`q${i}`] || ""} onChange={e => {
                  const next = {...appAnswers, [`q${i}`]: e.target.value};
                  setAppAnswers(next);
                  store.set("scholarbot-answers", next);
                }} rows={5} style={{
                  width:"100%",padding:"14px 18px",background:"#111118",border:"1px solid #1e1e2e",
                  borderRadius:8,color:"#e8e4dc",fontSize:14,fontFamily:"'DM Sans',sans-serif",
                  outline:"none",resize:"vertical",lineHeight:1.7,boxSizing:"border-box"
                }}/>
              </div>
            ))}

            <div style={{marginTop:12,padding:20,background:"#111118",border:"1px solid #1e1e2e",borderRadius:10,fontSize:13,fontFamily:"'DM Sans',sans-serif",color:"#777",lineHeight:1.6}}>
              These answers are saved automatically and feed into your letter generation. The more detail you provide, the better your generated letters will be.
            </div>
          </div>
        )}

        {/* ====== LETTER GENERATOR ====== */}
        {view === "generate" && (
          <div>
            <h1 style={{fontSize:36,fontWeight:400,marginBottom:24}}>Letter Generator</h1>
            
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,marginBottom:28}}>
              {/* Scholarship Input — Multi-Mode */}
              <div>
                <label style={{fontSize:12,fontFamily:"'DM Sans',sans-serif",color:"#777",letterSpacing:1,textTransform:"uppercase",marginBottom:10,display:"block"}}>Scholarship Source</label>
                
                {/* Mode Tabs */}
                <div style={{display:"flex",gap:0,marginBottom:14,borderRadius:8,overflow:"hidden",border:"1px solid #1e1e2e"}}>
                  {[
                    {id:"database",label:"Database"},
                    {id:"upload",label:"Upload"},
                    {id:"url",label:"URL"},
                    {id:"paste",label:"Paste"},
                  ].map(tab => (
                    <button key={tab.id} onClick={() => setScholarshipInputMode(tab.id)} style={{
                      flex:1,padding:"10px 8px",border:"none",fontSize:12,fontFamily:"'DM Sans',sans-serif",
                      cursor:"pointer",fontWeight:scholarshipInputMode === tab.id ? 600 : 400,
                      background:scholarshipInputMode === tab.id ? "#c9a22720" : "#111118",
                      color:scholarshipInputMode === tab.id ? "#c9a227" : "#666",
                      borderBottom:scholarshipInputMode === tab.id ? "2px solid #c9a227" : "2px solid transparent",
                      transition:"all 0.2s"
                    }}>{tab.label}</button>
                  ))}
                </div>

                {/* MODE: Database Selection */}
                {scholarshipInputMode === "database" && (
                  <div>
                    <select value={selectedScholarship?.id || ""} onChange={e => {
                      const s = scholarshipDB.find(x => x.id === e.target.value);
                      setSelectedScholarship(s || null);
                      setCustomScholarshipText("");
                      setCustomScholarshipName("");
                    }} style={{width:"100%",padding:"12px 16px",background:"#111118",border:"1px solid #1e1e2e",borderRadius:8,color:"#e8e4dc",fontSize:14,fontFamily:"'DM Sans',sans-serif",outline:"none"}}>
                      <option value="">Select from your database...</option>
                      {scholarshipDB.map(s => <option key={s.id} value={s.id}>{s.name} ({s.amount})</option>)}
                    </select>
                    {selectedScholarship && scholarshipInputMode === "database" && (
                      <div style={{marginTop:12,padding:16,background:"#0a0a0f",border:"1px solid #1e1e2e",borderRadius:8,fontSize:12,fontFamily:"'DM Sans',sans-serif",color:"#888",lineHeight:1.6}}>
                        <strong style={{color:"#c9a227"}}>Criteria:</strong> {selectedScholarship.criteria.slice(0,300)}
                      </div>
                    )}
                  </div>
                )}

                {/* MODE: Upload PDF/Doc */}
                {scholarshipInputMode === "upload" && (
                  <div>
                    <div
                      onClick={() => scholarshipFileRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "#c9a227"; }}
                      onDragLeave={e => { e.currentTarget.style.borderColor = "#1e1e2e"; }}
                      onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = "#1e1e2e"; const f = e.dataTransfer.files[0]; if(f) handleScholarshipUpload({target:{files:[f]}}); }}
                      style={{
                        border:"2px dashed #1e1e2e",borderRadius:10,padding:"28px 20px",textAlign:"center",
                        cursor:"pointer",transition:"border-color 0.2s",background:"#0a0a0f",marginBottom:12
                      }}>
                      <input ref={scholarshipFileRef} type="file" accept=".pdf,.doc,.docx,.txt,.md,.html,.rtf" onChange={handleScholarshipUpload} style={{display:"none"}} />
                      {uploadedScholarshipName ? (
                        <div>
                          <div style={{fontSize:20,marginBottom:4}}>✓</div>
                          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#c9a227"}}>{uploadedScholarshipName}</div>
                          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#555",marginTop:4}}>Click or drop to replace</div>
                        </div>
                      ) : (
                        <div>
                          <div style={{fontSize:28,marginBottom:6,color:"#333"}}>📄</div>
                          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#777"}}>Drop scholarship application here</div>
                          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#444",marginTop:4}}>PDF, Word, text, or HTML files</div>
                        </div>
                      )}
                    </div>
                    <input value={customScholarshipName} onChange={e => setCustomScholarshipName(e.target.value)}
                      placeholder="Scholarship name (auto-detected or type manually)"
                      style={{width:"100%",padding:"10px 14px",background:"#111118",border:"1px solid #1e1e2e",borderRadius:8,color:"#e8e4dc",fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none",boxSizing:"border-box"}}/>
                    {customScholarshipText && (
                      <div style={{marginTop:10,padding:12,background:"#0a0a0f",border:"1px solid #1e1e2e",borderRadius:8,fontSize:11,fontFamily:"'DM Sans',sans-serif",color:"#555",maxHeight:80,overflow:"hidden"}}>
                        {customScholarshipText.slice(0,200)}...
                        <span style={{color:"#c9a227",marginLeft:4}}>{customScholarshipText.length.toLocaleString()} chars loaded</span>
                      </div>
                    )}
                  </div>
                )}

                {/* MODE: Fetch from URL */}
                {scholarshipInputMode === "url" && (
                  <div>
                    <div style={{display:"flex",gap:8,marginBottom:12}}>
                      <input value={scholarshipUrl} onChange={e => setScholarshipUrl(e.target.value)}
                        placeholder="https://www.scholarship-site.com/apply"
                        style={{flex:1,padding:"12px 16px",background:"#111118",border:"1px solid #1e1e2e",borderRadius:8,color:"#e8e4dc",fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none"}}/>
                      <button onClick={fetchScholarshipFromUrl} disabled={fetchingUrl} style={{
                        padding:"12px 20px",background:fetchingUrl ? "#333" : "#c9a227",border:"none",borderRadius:8,
                        color:"#0a0a0f",fontSize:12,fontWeight:600,fontFamily:"'DM Sans',sans-serif",
                        cursor:fetchingUrl?"wait":"pointer",whiteSpace:"nowrap"
                      }}>
                        {fetchingUrl ? "Fetching..." : "Fetch →"}
                      </button>
                    </div>
                    <input value={customScholarshipName} onChange={e => setCustomScholarshipName(e.target.value)}
                      placeholder="Scholarship name (auto-detected or type manually)"
                      style={{width:"100%",padding:"10px 14px",background:"#111118",border:"1px solid #1e1e2e",borderRadius:8,color:"#e8e4dc",fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none",marginBottom:10,boxSizing:"border-box"}}/>
                    {customScholarshipText && (
                      <div style={{padding:12,background:"#0a0a0f",border:"1px solid #1e1e2e",borderRadius:8,fontSize:11,fontFamily:"'DM Sans',sans-serif",color:"#555",maxHeight:100,overflow:"auto"}}>
                        <div style={{color:"#4ecdc4",marginBottom:6}}>✓ Scholarship details fetched</div>
                        {customScholarshipText.slice(0,300)}...
                      </div>
                    )}
                    <div style={{fontSize:11,fontFamily:"'DM Sans',sans-serif",color:"#444",marginTop:8}}>
                      Uses AI web search to extract scholarship details from the page. Works best with direct application pages.
                    </div>
                  </div>
                )}

                {/* MODE: Paste Description */}
                {scholarshipInputMode === "paste" && (
                  <div>
                    <input value={customScholarshipName} onChange={e => setCustomScholarshipName(e.target.value)}
                      placeholder="Scholarship name"
                      style={{width:"100%",padding:"10px 14px",background:"#111118",border:"1px solid #1e1e2e",borderRadius:8,color:"#e8e4dc",fontSize:14,fontFamily:"'DM Sans',sans-serif",outline:"none",marginBottom:10,boxSizing:"border-box"}}/>
                    <textarea value={customScholarshipText} onChange={e => setCustomScholarshipText(e.target.value)}
                      placeholder="Paste the full scholarship description, eligibility criteria, and requirements here. The more detail you include, the better your letter will be tailored."
                      rows={8} style={{
                        width:"100%",padding:"12px 16px",background:"#0a0a0f",border:"1px solid #1e1e2e",
                        borderRadius:8,color:"#e8e4dc",fontSize:13,fontFamily:"'DM Sans',sans-serif",
                        outline:"none",resize:"vertical",lineHeight:1.6,boxSizing:"border-box"
                      }}/>
                    {customScholarshipText && (
                      <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
                        <span style={{fontSize:11,fontFamily:"'DM Sans',sans-serif",color:"#444"}}>{customScholarshipText.length.toLocaleString()} characters</span>
                        <button onClick={() => { setCustomScholarshipText(""); setCustomScholarshipName(""); }} style={{fontSize:11,fontFamily:"'DM Sans',sans-serif",color:"#e056a0",background:"none",border:"none",cursor:"pointer"}}>Clear</button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Template Selection */}
              <div>
                <label style={{fontSize:12,fontFamily:"'DM Sans',sans-serif",color:"#777",letterSpacing:1,textTransform:"uppercase",marginBottom:10,display:"block"}}>Writing Style</label>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {templates.map(t => (
                    <button key={t.id} onClick={() => setSelectedTemplate(t)} style={{
                      padding:"12px 16px",background:selectedTemplate?.id === t.id ? "#c9a22715" : "#111118",
                      border:selectedTemplate?.id === t.id ? "1px solid #c9a227" : "1px solid #1e1e2e",
                      borderRadius:8,cursor:"pointer",textAlign:"left",color:"#e8e4dc"
                    }}>
                      <div style={{fontSize:14,fontWeight:400,marginBottom:2}}>{t.name}</div>
                      <div style={{fontSize:11,fontFamily:"'DM Sans',sans-serif",color:"#666"}}>{t.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={generateLetter} disabled={generatingLetter || (scholarshipInputMode === "database" ? !selectedScholarship : !customScholarshipText.trim())} style={{
              padding:"14px 40px",background:generatingLetter ? "#333" : "linear-gradient(135deg,#c9a227,#b8911e)",
              border:"none",borderRadius:8,color:"#0a0a0f",fontSize:15,fontWeight:600,
              fontFamily:"'DM Sans',sans-serif",cursor:generatingLetter?"wait":"pointer",marginBottom:28
            }}>
              {generatingLetter ? "◉ Generating..." : "Generate Scholarship Letter"}
            </button>

            {generatedLetter && (
              <div>
                <div style={{background:"#111118",border:"1px solid #1e1e2e",borderRadius:12,padding:32,marginBottom:16}}>
                  <div style={{whiteSpace:"pre-wrap",fontSize:15,lineHeight:1.8,color:"#d4d0c8",fontFamily:"Georgia,'Times New Roman',serif"}}>{generatedLetter}</div>
                </div>
                <div style={{display:"flex",gap:12}}>
                  <button onClick={() => {
                    const label = scholarshipInputMode === "database" 
                      ? selectedScholarship?.name 
                      : (customScholarshipName || "Custom Scholarship");
                    saveLetter({text:generatedLetter,scholarship:label,template:selectedTemplate?.name});
                  }} style={{padding:"10px 20px",background:"#c9a227",border:"none",borderRadius:8,color:"#0a0a0f",fontSize:13,fontWeight:600,fontFamily:"'DM Sans',sans-serif",cursor:"pointer"}}>
                    Save Letter
                  </button>
                  <button onClick={() => {navigator.clipboard.writeText(generatedLetter); notify("Copied!")}} style={{
                    padding:"10px 20px",background:"transparent",border:"1px solid #c9a227",borderRadius:8,
                    color:"#c9a227",fontSize:13,fontFamily:"'DM Sans',sans-serif",cursor:"pointer"
                  }}>Copy to Clipboard</button>
                  <button onClick={generateLetter} style={{
                    padding:"10px 20px",background:"transparent",border:"1px solid #444",borderRadius:8,
                    color:"#888",fontSize:13,fontFamily:"'DM Sans',sans-serif",cursor:"pointer"
                  }}>Regenerate</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ====== STYLE TEMPLATES ====== */}
        {view === "templates" && (
          <div>
            <h1 style={{fontSize:36,fontWeight:400,marginBottom:8}}>Style Templates</h1>
            <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,color:"#666",marginBottom:32}}>
              Different writing styles for different scholarship personalities. Create your own or customize existing ones.
            </p>
            
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:32}}>
              {templates.map(t => (
                <div key={t.id} style={{background:"#111118",border:"1px solid #1e1e2e",borderRadius:12,padding:24}}>
                  <div style={{fontSize:18,fontWeight:400,marginBottom:8,color:"#c9a227"}}>{t.name}</div>
                  <div style={{fontSize:13,fontFamily:"'DM Sans',sans-serif",color:"#888",marginBottom:16,lineHeight:1.5}}>{t.description}</div>
                  <div style={{fontSize:12,fontFamily:"'DM Sans',monospace",color:"#555",background:"#0a0a0f",padding:12,borderRadius:8,lineHeight:1.6}}>
                    {t.rules}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Add Custom Template */}
            <div style={{background:"#111118",border:"1px dashed #1e1e2e",borderRadius:12,padding:24}}>
              <h3 style={{fontSize:16,fontWeight:400,marginBottom:16}}>Create Custom Template</h3>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
                <input id="tpl-name" placeholder="Template name..." style={{padding:"10px 14px",background:"#0a0a0f",border:"1px solid #1e1e2e",borderRadius:8,color:"#e8e4dc",fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none"}}/>
                <input id="tpl-desc" placeholder="Short description..." style={{padding:"10px 14px",background:"#0a0a0f",border:"1px solid #1e1e2e",borderRadius:8,color:"#e8e4dc",fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none"}}/>
              </div>
              <textarea id="tpl-rules" placeholder="Writing rules (e.g., 1. Open with a question. 2. Keep sentences under 20 words...)" rows={4} style={{
                width:"100%",padding:"10px 14px",background:"#0a0a0f",border:"1px solid #1e1e2e",borderRadius:8,
                color:"#e8e4dc",fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none",resize:"vertical",lineHeight:1.6,boxSizing:"border-box",marginBottom:12
              }}/>
              <button onClick={() => {
                const name = document.getElementById("tpl-name").value;
                const desc = document.getElementById("tpl-desc").value;
                const rules = document.getElementById("tpl-rules").value;
                if (!name || !rules) { notify("Name and rules are required."); return; }
                const newTpl = {id:`custom-${Date.now()}`,name,description:desc,rules};
                saveTemplates([...templates, newTpl]);
                notify("Template created!");
                document.getElementById("tpl-name").value = "";
                document.getElementById("tpl-desc").value = "";
                document.getElementById("tpl-rules").value = "";
              }} style={{padding:"10px 24px",background:"#c9a227",border:"none",borderRadius:8,color:"#0a0a0f",fontSize:13,fontWeight:600,fontFamily:"'DM Sans',sans-serif",cursor:"pointer"}}>
                Save Template
              </button>
            </div>
          </div>
        )}

        {/* ====== SAVED LETTERS ====== */}
        {view === "saved" && (
          <div>
            <h1 style={{fontSize:36,fontWeight:400,marginBottom:24}}>Saved Letters</h1>
            
            {savedLetters.length === 0 ? (
              <div style={{textAlign:"center",padding:60,color:"#555"}}>
                <div style={{fontSize:48,marginBottom:16}}>◫</div>
                <div style={{fontSize:16,marginBottom:20}}>No saved letters yet.</div>
                <button onClick={() => setView("generate")} style={{padding:"12px 24px",background:"#c9a227",border:"none",borderRadius:8,color:"#0a0a0f",fontSize:14,fontWeight:600,fontFamily:"'DM Sans',sans-serif",cursor:"pointer"}}>
                  Generate Your First Letter
                </button>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                {savedLetters.map((l,i) => (
                  <div key={l.id} style={{background:"#111118",border:"1px solid #1e1e2e",borderRadius:10,padding:24}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                      <div>
                        <div style={{fontSize:16,fontWeight:400}}>{l.scholarship || "Untitled"}</div>
                        <div style={{fontSize:12,fontFamily:"'DM Sans',sans-serif",color:"#666"}}>{l.template} • {l.date}</div>
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={() => {navigator.clipboard.writeText(l.text); notify("Copied!")}} style={{
                          padding:"6px 14px",background:"transparent",border:"1px solid #c9a227",borderRadius:6,
                          color:"#c9a227",fontSize:11,fontFamily:"'DM Sans',sans-serif",cursor:"pointer"
                        }}>Copy</button>
                        <button onClick={async () => {
                          const next = savedLetters.filter((_,j) => j !== i);
                          setSavedLetters(next);
                          try { store.set("scholarbot-letters", next); } catch(e) {}
                          notify("Deleted.");
                        }} style={{
                          padding:"6px 14px",background:"transparent",border:"1px solid #333",borderRadius:6,
                          color:"#555",fontSize:11,fontFamily:"'DM Sans',sans-serif",cursor:"pointer"
                        }}>Delete</button>
                      </div>
                    </div>
                    <div style={{fontSize:13,fontFamily:"'DM Sans',sans-serif",color:"#888",lineHeight:1.6,maxHeight:120,overflow:"hidden"}}>
                      {l.text.slice(0,400)}...
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Google Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0a0a0f; }
        ::-webkit-scrollbar-thumb { background: #1e1e2e; border-radius: 3px; }
        ::placeholder { color: #444; }
        select option { background: #111118; color: #e8e4dc; }
        @keyframes slideIn { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        input:focus, textarea:focus, select:focus { border-color: #c9a227 !important; }
        a { color: #c9a227; }
      `}</style>
    </div>
  );
}
