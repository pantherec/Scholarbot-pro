import { readFileSync, writeFileSync } from "fs";

const dir = "C:/Users/corey/Desktop/Claude/Scholarbot_Pro/test-profiles";
const seed = JSON.parse(readFileSync(dir + "/test_profiles_seed.json", "utf8"));

const FIELD_LABELS = [
  ["name", "Full name"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["location", "Location"],
  ["citizenship", "Citizenship"],
  ["ethnicity", "Ethnicity (multiselect)"],
  ["gpa", "GPA (unweighted)"],
  ["satact", "SAT/ACT"],
  ["school", "High school"],
  ["gradYear", "Graduation year"],
  ["intendedMajor", "Intended major"],
  ["financialNeed", "Financial need"],
  ["writingStyle", "Writing voice"],
];
const ESSAY_FIELDS = [
  ["activities", "Activities & leadership"],
  ["awards", "Awards & honors"],
  ["communityService", "Community service (essay)"],
  ["personalStory", "Personal story (essay)"],
  ["careerGoal", "Career goal (essay)"],
];

// ---------- Markdown ----------
let md = `# MeritLaunch Test Profiles\n\nGenerated 2026-08-28 from \`test_profiles_seed.json\`. Field set matches \`PROFILE_QUESTIONS\` in \`src/App.jsx\` (19 fields) plus the separate Brag Sheet box. GPA field is **unweighted** per the form label; weighted GPA, class rank, and work experience live in the awards/activities/brag-sheet prose because the form has no dedicated fields for them.\n\nAll emails are \`coreyskinner+ml-*@gmail.com\` aliases so every test signup lands in one inbox. Phone numbers use the reserved 555-01xx fictional range.\n\n---\n`;

for (const p of seed.profiles) {
  const pr = p.profile;
  md += `\n## ${pr.name} — \`${p.id}\`\n\n> ${p.snapshot}\n\n`;
  md += `| Field | Value |\n|---|---|\n`;
  for (const [key, label] of FIELD_LABELS) {
    let v = pr[key];
    if (Array.isArray(v)) v = v.join(", ");
    md += `| ${label} | ${v} |\n`;
  }
  for (const [key, label] of ESSAY_FIELDS) {
    const words = pr[key].split(/\s+/).length;
    md += `\n### ${label} (${words} words)\n\n${pr[key]}\n`;
  }
  const bw = p.bragSheet.split(/\s+/).length;
  md += `\n### Brag sheet (${bw} words — paste into the Brag Sheet box)\n\n\`\`\`\n${p.bragSheet}\n\`\`\`\n\n---\n`;
}
writeFileSync(dir + "/test_profiles.md", md, "utf8");

// ---------- SQL ----------
const sqlEsc = (s) => (s == null ? "NULL" : "'" + String(s).replace(/'/g, "''") + "'");

let sql = `-- MeritLaunch test-profile loader (generated 2026-08-28 from test_profiles_seed.json)
-- Target: Supabase project zudczsepvkjbjgomgilz, table public.user_profiles
--
-- IMPORTANT: user_profiles.id = auth.users.id (the handle_new_user trigger creates the
-- row at signup). So FIRST sign up each test account in the app UI with the emails
-- below, THEN run this script in the Supabase SQL editor. It matches on auth.users.email
-- and upserts the denormalized columns + the full profile_data jsonb, exactly like
-- saveProfileToSupabase() in src/App.jsx. grade_level and leadership stay NULL because
-- the app maps them from fields the form never collects.
--
-- Accounts to create first:
`;
for (const p of seed.profiles) sql += `--   ${p.profile.email}  (${p.profile.name})\n`;
sql += `\n`;

for (const p of seed.profiles) {
  const pr = p.profile;
  const json = JSON.stringify(pr, null, 2);
  const tag = "$profile_json$";
  if (json.includes(tag)) throw new Error("dollar-quote tag collision");
  sql += `-- ============ ${pr.name} (${p.id}) ============\n`;
  sql += `INSERT INTO public.user_profiles
  (id, name, gpa, grade_level, intended_major, heritage, citizenship, financial_need, activities, leadership, profile_data, updated_at)
SELECT u.id,
  ${sqlEsc(pr.name)},
  ${sqlEsc(pr.gpa)},
  NULL,
  ${sqlEsc(pr.intendedMajor)},
  ${sqlEsc(pr.ethnicity.join(", "))},
  ${sqlEsc(pr.citizenship)},
  ${sqlEsc(pr.financialNeed)},
  ${sqlEsc(pr.activities)},
  NULL,
  ${tag}${json}${tag}::jsonb,
  now()
FROM auth.users u
WHERE u.email = ${sqlEsc(pr.email)}
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  gpa = EXCLUDED.gpa,
  intended_major = EXCLUDED.intended_major,
  heritage = EXCLUDED.heritage,
  citizenship = EXCLUDED.citizenship,
  financial_need = EXCLUDED.financial_need,
  activities = EXCLUDED.activities,
  profile_data = EXCLUDED.profile_data,
  updated_at = now();

`;
}
sql += `-- Sanity check:\n-- SELECT u.email, p.name, p.gpa, p.profile_data->>'school' AS school\n-- FROM public.user_profiles p JOIN auth.users u ON u.id = p.id\n-- WHERE u.email LIKE 'coreyskinner+ml-%';\n`;
writeFileSync(dir + "/test_profiles_load.sql", sql, "utf8");

console.log("wrote test_profiles.md and test_profiles_load.sql");
for (const p of seed.profiles) {
  const pr = p.profile;
  for (const [key] of ESSAY_FIELDS.filter(([k]) => ["communityService", "personalStory", "careerGoal"].includes(k))) {
    const w = pr[key].split(/\s+/).length;
    if (w < 150 || w > 650) console.log(`WORDCOUNT WARN: ${pr.name}.${key} = ${w}`);
  }
}
// banned-language sweep over all prose
const banned = /\bmoreover\b|\bfurthermore\b|\bdelv\w*|\btapestry\b|\btestament\b|\bmy journey\b|\bnavigat\w* (the|my|through)|at the intersection of|not just \w+ but|it's worth noting|passionate about|\bpassion\b|—|in conclusion|ever since i was|from a young age|make a difference\b/i;
for (const p of seed.profiles) {
  const blob = Object.values(p.profile).join(" ") + " " + p.bragSheet;
  const m = blob.match(banned);
  if (m) console.log(`BANNED HIT in ${p.profile.name}: "${m[0]}"`);
}
console.log("checks done");
