// The student's uploaded background documents. They live in one text store (the
// "brag sheet" text that drafts, the fact check and the profile suggestions all
// read), split into labelled sections so a resume and a brag sheet can sit side
// by side and each can be replaced on its own.
//
//   <anything the student pasted>
//
//   --- Resume: resume.pdf ---
//   <text>
//
//   --- Brag sheet: brag.docx ---
//   <text>

export const DOC_KINDS = [
  { id: "resume", label: "Resume" },
  { id: "brag", label: "Brag sheet" },
];
const LABEL = { resume: "Resume", brag: "Brag sheet" };
// "Uploaded from" is the header older uploads used; treat those as brag sheets.
const HEAD = /^--- (Resume|Brag sheet|Uploaded from): (.+?) ---\s*$/;

export function parseDocs(doc) {
  const out = { pasted: "", resume: null, brag: null };
  let current = null; // null = pasted text
  const buf = { pasted: [], resume: [], brag: [] };
  for (const line of String(doc || "").split(/\r?\n/)) {
    const m = line.match(HEAD);
    if (m) {
      current = m[1] === "Resume" ? "resume" : "brag";
      const name = m[2].trim();
      // A second file of the same kind (older uploads appended) keeps both texts.
      out[current] = { name: out[current] ? `${out[current].name}, ${name}` : name, text: "" };
      if (buf[current].length) buf[current].push("");
      continue;
    }
    buf[current || "pasted"].push(line);
  }
  out.pasted = buf.pasted.join("\n").trim();
  for (const k of ["resume", "brag"]) if (out[k]) out[k].text = buf[k].join("\n").trim();
  return out;
}

export function buildDocs({ pasted = "", resume = null, brag = null }) {
  const parts = [];
  if (pasted.trim()) parts.push(pasted.trim());
  for (const [k, d] of [["resume", resume], ["brag", brag]]) {
    if (d && (d.text || "").trim()) parts.push(`--- ${LABEL[k]}: ${d.name || "file"} ---\n\n${d.text.trim()}`);
  }
  return parts.join("\n\n");
}

// Put a file's text in its slot, replacing whatever that slot held.
export function setDoc(doc, kind, name, text) {
  const d = parseDocs(doc);
  d[kind === "resume" ? "resume" : "brag"] = { name, text: String(text || "") };
  return buildDocs(d);
}

export function removeDoc(doc, kind) {
  const d = parseDocs(doc);
  d[kind === "resume" ? "resume" : "brag"] = null;
  return buildDocs(d);
}

// "resume.pdf, brag.docx" for the "drafting from" line.
export function docFileNames(doc) {
  const d = parseDocs(doc);
  return [d.resume?.name, d.brag?.name].filter(Boolean).join(", ");
}
