// READ-ONLY. Finds catalog rows that name exactly one US state or Canadian
// province in their name or criteria but carry no `state` tag (so they show up
// for every student), and prints a proposed UPDATE list for review. It never
// writes to the database.
//
//   node scripts/state_tag_backfill.mjs
//
// Fetches the public catalog the way src/lib/api.js does (anon key, REST GET).
import { SUPABASE_URL, SUPABASE_KEY } from "../src/lib/api.js";

const STATES = {
  AL:"alabama",AK:"alaska",AZ:"arizona",AR:"arkansas",CA:"california",CO:"colorado",CT:"connecticut",
  DE:"delaware",DC:"district of columbia",FL:"florida",GA:"georgia",HI:"hawaii",ID:"idaho",IL:"illinois",
  IN:"indiana",IA:"iowa",KS:"kansas",KY:"kentucky",LA:"louisiana",ME:"maine",MD:"maryland",MA:"massachusetts",
  MI:"michigan",MN:"minnesota",MS:"mississippi",MO:"missouri",MT:"montana",NE:"nebraska",NV:"nevada",
  NH:"new hampshire",NJ:"new jersey",NM:"new mexico",NY:"new york",NC:"north carolina",ND:"north dakota",
  OH:"ohio",OK:"oklahoma",OR:"oregon",PA:"pennsylvania",RI:"rhode island",SC:"south carolina",SD:"south dakota",
  TN:"tennessee",TX:"texas",UT:"utah",VT:"vermont",VA:"virginia",WA:"washington",WV:"west virginia",
  WI:"wisconsin",WY:"wyoming",PR:"puerto rico",
  ON:"ontario",QC:"quebec",AB:"alberta",BC:"british columbia",MB:"manitoba",SK:"saskatchewan",
  NS:"nova scotia",NB:"new brunswick",NL:"newfoundland",PE:"prince edward island",
};

// Phrases that contain a state name without meaning the state.
const NOT_A_STATE = [
  /\bwest virginia\b/g,                      // handled as WV; stops "virginia" matching VA
  /\bnew york (?:city )?times\b/g, /\bgeorge washington\b/g, /\bbooker t\.? washington\b/g,
  /\bwashington,? d\.?c\.?\b/g, /\bwashington (?:post|monument)\b/g, /\bdenzel washington\b/g,
  /\bindiana jones\b/g, /\bkansas city\b/g, /\bjersey (?:mike|shore)\b/g, /\bgeorgia tech\b/g,
  /\bnew mexico (?:state )?military\b/g,
];

export function statesNamed(text) {
  let t = ` ${String(text || "").toLowerCase()} `;
  const found = new Set();
  if (/\bwest virginia\b/.test(t)) found.add("WV");
  for (const re of NOT_A_STATE) t = t.replace(re, " ");
  if (/\bwashington,? d\.?c\.?\b/.test(` ${String(text || "").toLowerCase()} `)) found.add("DC");
  for (const [code, name] of Object.entries(STATES)) {
    if (code === "WV") continue;
    if (new RegExp("\\b" + name + "\\b").test(t)) found.add(code);
  }
  return found;
}

async function fetchCatalog() {
  let all = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/scholarships?select=id,name,criteria,country,state&order=id`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Range: `${offset}-${offset + 999}` },
    });
    if (!res.ok && res.status !== 206) throw new Error(`catalog fetch failed: ${res.status}`);
    const page = await res.json();
    if (!Array.isArray(page) || !page.length) break;
    all = all.concat(page);
    if (page.length < 1000) break;
  }
  return all;
}

const rows = await fetchCatalog();
const proposals = [];
for (const r of rows) {
  if (r.state) continue;
  const found = statesNamed(`${r.name || ""} . ${r.criteria || ""}`);
  // "open to residents of the U.S. and the District of Columbia" is a nationwide
  // award, not a DC one: DC counts only when the award's own name says so.
  if (found.has("DC") && !statesNamed(r.name).has("DC")) found.delete("DC");
  if (found.size === 1) {
    const code = [...found][0];
    proposals.push({ id: r.id, state: code, inName: statesNamed(r.name).has(code), name: r.name, criteria: String(r.criteria || "").slice(0, 110) });
  }
}
console.log(`-- ${rows.length} catalog rows; ${rows.filter((r) => !r.state).length} have no state tag; ${proposals.length} name exactly one state or province.`);
console.log("-- Review each line before running anything. This script only prints.");
for (const p of proposals) {
  console.log(`UPDATE scholarships SET state='${p.state}' WHERE id='${String(p.id).replace(/'/g, "''")}';  -- [${p.inName ? "name" : "criteria only"}] ${p.name} | ${p.criteria}`);
}
console.log(`-- count: ${proposals.length}`);
