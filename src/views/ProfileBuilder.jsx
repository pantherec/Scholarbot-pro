import { useState, useMemo, useEffect, useRef } from "react";
import { useApp } from "../AppContext.js";
import { COLORS, FONTS, TYPE } from "../ui/theme.js";
import { yearIsUnder13, PROFILE_QUESTIONS, PROFILE_STEPS, GRAD_YEARS } from "../data/profile.js";
import { GlowCard, AppIcon, Button, SectionHeader, LinkButton } from "../ui/components.jsx";
import { suggestFromBragSheet, applySuggestions, SUGGESTION_LABELS } from "../lib/bragsheet.js";
import { DOC_KINDS, parseDocs, removeDoc, docFileNames } from "../lib/studentDocs.js";
import { track } from "../analytics.js";

// Optional, and asked warmly: some awards are for women or men only. Stored as
// "female" | "male" | "nonbinary" | "prefer_not"; blank excludes nothing. It is
// used only for matching and is never sent to the letter model.
const GENDER_QUESTION = {
  id: "gender", q: "Gender (optional)", type: "select", step: 1,
  options: [
    { value: "female", label: "Female" }, { value: "male", label: "Male" },
    { value: "nonbinary", label: "Nonbinary" }, { value: "prefer_not", label: "Prefer not to say" },
  ],
  why: "Some awards are for women or men only. If you'd like us to skip the ones that aren't for you, tell us; otherwise leave this blank.",
};
const QUESTIONS = (() => {
  const i = PROFILE_QUESTIONS.findIndex(q => q.id === "ethnicity");
  const out = [...PROFILE_QUESTIONS];
  out.splice(i < 0 ? out.length : i + 1, 0, GENDER_QUESTION);
  return out;
})();

export default function ProfileBuilder() {
  const { profile, bragSheet, setBragSheet, generatingLetter, bragSheetFileName, setBragSheetFileName, bragSheetUploading, profileStep, setProfileStep, bragFileRef, handleBragSheetUpload, saveProfile, answered, profileCompletion, runMatching, generateCandidateProfile, notify } = useApp();
  const docs = parseDocs(bragSheet);
  return (
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
                      <div style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: i === profileStep ? COLORS.gold : COLORS.textMuted, fontWeight: 600, marginBottom: 2 }}>
                        Step {i + 1}
                      </div>
                      <div style={{ fontSize: TYPE.sm, fontFamily: FONTS.body, color: i === profileStep ? COLORS.text : COLORS.textMuted }}>
                        {s.title}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Current Step Questions. On step 1 the age question comes first and
                    alone; nothing else is asked until it's answered 13+. */}
                <div className="two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
                  {QUESTIONS
                    .filter(q => q.step === profileStep)
                    .filter(q => profile.ageOk || q.type === "age")
                    .map(q => {
                    const id = `pq-${q.id}`;
                    const hintId = q.why ? `${id}-why` : undefined;
                    return (
                    <div key={q.id} style={{ gridColumn: q.type === "textarea" || q.type === "multiselect" ? "1 / -1" : "auto" }}>
                      {q.type === "multiselect"
                        ? <div id={`${id}-label`} style={{ display: "block", fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 8, fontWeight: 500 }}>{q.q}</div>
                        : <label htmlFor={id} style={{ display: "block", fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 8, fontWeight: 500 }}>{q.q}</label>}
                      {q.type === "age" && (profile.ageOk ? (
                        <div id={id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderRadius: 10, background: COLORS.tealDim, color: COLORS.text, fontSize: TYPE.base, fontFamily: FONTS.body }}>
                          <AppIcon name="check" size={16} color={COLORS.teal} /> Thanks, you're all set.
                        </div>
                      ) : (
                        <AgeQuestion id={id} hintId={hintId} options={q.options} onConfirm={v => {
                          if (yearIsUnder13(v)) saveProfile({ under13: true });
                          else saveProfile({ ...profile, ageOk: true });
                        }} />
                      ))}
                      {q.type === "text" && (
                        <input id={id} aria-describedby={hintId} value={profile[q.id] || ""} onChange={e => saveProfile({...profile, [q.id]: e.target.value})}
                          placeholder={q.placeholder} style={{ width: "100%", padding: "12px 16px", background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, borderRadius: 10, color: COLORS.text, fontSize: TYPE.base, fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" }}/>
                      )}
                      {q.type === "select" && (
                        <select id={id} aria-describedby={hintId} value={profile[q.id] || ""} onChange={e => saveProfile({...profile, [q.id]: e.target.value})}
                          style={{ width: "100%", padding: "12px 16px", background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, borderRadius: 10, color: COLORS.text, fontSize: TYPE.base, fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" }}>
                          <option value="">Select...</option>
                          {q.options.map(o => typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
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
                                cursor: "pointer", fontSize: TYPE.sm, fontFamily: FONTS.body,
                                display: "inline-flex", alignItems: "center", gap: 6,
                              }}>{sel && <AppIcon name="check" size={13} />}{o}</button>
                            );
                          })}
                        </div>
                      )}
                      {q.type === "textarea" && (
                        <textarea id={id} aria-describedby={hintId} value={profile[q.id] || ""} onChange={e => saveProfile({...profile, [q.id]: e.target.value})}
                          placeholder={q.placeholder} rows={4} style={{ ...{ width: "100%", padding: "12px 16px", background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, borderRadius: 10, color: COLORS.text, fontSize: TYPE.base, fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" }, resize: "vertical", lineHeight: 1.6 }}/>
                      )}
                      {q.why && <div id={hintId} style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted, marginTop: 6 }}>{q.why}</div>}
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
                      <h3 style={{ fontSize: TYPE.md, fontWeight: 400, marginBottom: 4 }}>
                        Your Resume and Brag Sheet <span style={{ color: COLORS.textDim, fontSize: TYPE.xs }}>(optional)</span>
                      </h3>
                      <p style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted }}>Add a resume, a brag sheet, or both. Each can be a PDF, Word doc, or text file, or you can paste below. Letter drafts and the profile suggestions read both.</p>
                    </div>
                    {bragSheet && (
                      <button onClick={() => { setBragSheet(""); setBragSheetFileName(""); }} style={{
                        fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.pink,
                        background: "none", border: "none", cursor: "pointer",
                      }}>Clear all</button>
                    )}
                  </div>

                  <div className="two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                    {DOC_KINDS.map(k => <DocSlot key={k.id} kind={k} doc={docs[k.id]} busy={bragSheetUploading === k.id}
                      onFile={(e) => handleBragSheetUpload(e, k.id)}
                      onRemove={() => { const next = removeDoc(bragSheet, k.id); setBragSheet(next); setBragSheetFileName(docFileNames(next)); }} />)}
                  </div>

                  <textarea value={bragSheet} onChange={e => setBragSheet(e.target.value)} aria-label="Resume and brag sheet text"
                    placeholder="Or paste your resume, brag sheet, or activity list here..."
                    rows={5} style={{
                      width: "100%", padding: "12px 16px", background: COLORS.bg,
                      border: `1px solid ${COLORS.border}`, borderRadius: 10,
                      color: COLORS.text, fontSize: TYPE.base, fontFamily: FONTS.body,
                      outline: "none", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box",
                    }}/>
                  {bragSheet && (
                    <div style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textDim, marginTop: 6 }}>
                      {bragSheet.length.toLocaleString()} characters loaded. Letter drafts read all of it.
                    </div>
                  )}
                  {bragSheet && <BragSuggestions bragSheet={bragSheet} profile={profile} saveProfile={saveProfile} notify={notify} />}
                </GlowCard>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Button onClick={() => { track("profile_completed", { completion: profileCompletion }); runMatching(); }} disabled={!profile.ageOk}>See my matches</Button>
                  <Button variant="ghost" onClick={generateCandidateProfile} disabled={generatingLetter || !profile.ageOk}>
                    {generatingLetter ? "Working..." : "Build my voice profile (optional)"}
                  </Button>
                </div>
              </div>
  );
}

// The birth year only counts once the student presses Continue. Committing on
// change let a single arrow key (the list starts at the youngest year) lock a
// 16-year-old keyboard user out for good.
function AgeQuestion({ id, hintId, options, onConfirm }) {
  const [year, setYear] = useState("");
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <select id={id} aria-describedby={hintId} value={year} onChange={e => setYear(e.target.value)}
        style={{ flex: "1 1 180px", padding: "12px 16px", background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, borderRadius: 10, color: COLORS.text, fontSize: TYPE.base, fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" }}>
        <option value="">Select a year...</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <Button onClick={() => year && onConfirm(year)} disabled={!year}>Continue</Button>
    </div>
  );
}

// What the brag sheet could add to the profile, sorted into the fields the
// matcher and the letter prompt read. Ticked by default; the student unticks
// anything the keyword router got wrong, then adds the rest with one click.
// Items already in the profile drop out, so the panel empties as it is used.
// One upload slot. A new file replaces only this slot's text.
function DocSlot({ kind, doc, busy, onFile, onRemove }) {
  const ref = useRef(null);
  return (
    <div>
      <div
        role="button" tabIndex={0} aria-label={`Upload your ${kind.label.toLowerCase()}`}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ref.current?.click(); } }}
        onClick={() => ref.current?.click()}
        onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = COLORS.gold; }}
        onDragLeave={e => { e.currentTarget.style.borderColor = COLORS.border; }}
        onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = COLORS.border; const f = e.dataTransfer.files[0]; if (f) onFile({ target: { files: [f] } }); }}
        style={{ border: `2px dashed ${COLORS.border}`, borderRadius: 12, padding: "18px 14px", textAlign: "center", cursor: "pointer", transition: "border-color 0.2s", background: COLORS.bg, minHeight: 104, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <input ref={ref} type="file" accept=".pdf,.doc,.docx,.txt,.md,.rtf" onChange={onFile} style={{ display: "none" }} />
        <div style={{ fontFamily: FONTS.body, fontSize: TYPE.sm, color: COLORS.text, marginBottom: 4 }}>{kind.label}</div>
        {busy ? (
          <div style={{ color: COLORS.gold, fontFamily: FONTS.body, fontSize: TYPE.sm }}>Reading file...</div>
        ) : doc ? (
          <>
            <div style={{ fontFamily: FONTS.body, fontSize: TYPE.sm, color: COLORS.gold, overflowWrap: "anywhere" }}>✓ {doc.name}</div>
            <div style={{ fontFamily: FONTS.body, fontSize: TYPE.xs, color: COLORS.textDim, marginTop: 4 }}>Click or drop to replace</div>
          </>
        ) : (
          <div style={{ fontFamily: FONTS.body, fontSize: TYPE.xs, color: COLORS.textMuted }}>Drop a file here, or click to browse</div>
        )}
      </div>
      {doc && !busy && (
        <button type="button" onClick={onRemove} style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.pink, background: "none", border: "none", cursor: "pointer", padding: "6px 0 0" }}>
          Remove {kind.label.toLowerCase()}
        </button>
      )}
    </div>
  );
}

function BragSuggestions({ bragSheet, profile, saveProfile, notify }) {
  const sug = useMemo(() => suggestFromBragSheet(bragSheet, profile, { gradYears: GRAD_YEARS }), [bragSheet, profile]);
  const [off, setOff] = useState(() => new Set());       // keys the student unticked
  const [showUnsorted, setShowUnsorted] = useState(false);
  const [hidden, setHidden] = useState(false);
  useEffect(() => { setHidden(false); }, [bragSheet]);
  const total = sug.count + (showUnsorted ? sug.unsorted.length : 0);
  if (hidden || (sug.count === 0 && sug.unsorted.length === 0)) return null;
  // Everything recognisable is already in the profile; only the lines no rule
  // could place remain, offered quietly.
  if (sug.count === 0 && !showUnsorted) {
    return (
      <div style={{ marginTop: 12, fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6 }}>
        Everything we recognised from your brag sheet is in your profile. {sug.unsorted.length} line{sug.unsorted.length === 1 ? "" : "s"} we couldn't place: <LinkButton onClick={() => setShowUnsorted(true)}>show</LinkButton>
      </div>
    );
  }

  const key = (kind, field, i) => `${kind}:${field}:${i}`;
  const on = (k) => !off.has(k);
  const toggle = (k) => setOff((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const picked = () => {
    const fields = {}, items = {};
    for (const [f, v] of Object.entries(sug.fields)) if (on(key("field", f, 0))) fields[f] = v;
    for (const [f, list] of Object.entries(sug.items)) {
      const sel = list.filter((_, i) => on(key("item", f, i)));
      if (sel.length) items[f] = sel;
    }
    if (showUnsorted) {
      const sel = sug.unsorted.filter((_, i) => on(key("unsorted", "otherDetails", i)));
      if (sel.length) items.otherDetails = [...(items.otherDetails || []), ...sel];
    }
    return { fields, items };
  };
  const n = (() => { const p = picked(); return Object.keys(p.fields).length + Object.values(p.items).reduce((a, l) => a + l.length, 0); })();
  const apply = () => {
    const p = picked();
    saveProfile(applySuggestions(profile, p));
    track("brag_sheet_sorted", { count: n });
    notify(`Added ${n} detail${n === 1 ? "" : "s"} to your profile. Check each field and edit anything that's off.`, "success");
  };
  const row = (k, text, label) => (
    <label key={k} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "6px 0", cursor: "pointer", fontSize: TYPE.sm, fontFamily: FONTS.body, color: on(k) ? COLORS.text : COLORS.textDim, lineHeight: 1.5 }}>
      <input type="checkbox" checked={on(k)} onChange={() => toggle(k)} style={{ width: 16, height: 16, accentColor: COLORS.gold, marginTop: 3, flexShrink: 0 }} />
      <span>{label && <span style={{ color: COLORS.textMuted }}>{label}: </span>}{text}</span>
    </label>
  );
  const sectionStyle = { fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.gold, letterSpacing: 1.5, textTransform: "uppercase", margin: "14px 0 2px" };
  return (
    <div role="region" aria-label="Details found in your brag sheet" style={{ marginTop: 16, padding: "14px 16px", borderRadius: 12, background: COLORS.goldDim, border: `1px solid ${COLORS.gold}55` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: TYPE.base, fontFamily: FONTS.body, color: COLORS.text, fontWeight: 500 }}>
            {sug.count > 0
              ? `Your brag sheet has ${sug.count} detail${sug.count === 1 ? "" : "s"} that aren't in your profile yet.`
              : "Lines from your brag sheet we couldn't place"}
          </div>
          <div style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted, marginTop: 4, lineHeight: 1.5 }}>
            Sorted by what each line says. Untick anything in the wrong place, then add them. Nothing is written until you click.
          </div>
        </div>
        <LinkButton onClick={() => setHidden(true)}>Not now</LinkButton>
      </div>
      {Object.keys(sug.fields).length > 0 && (
        <div>
          <div style={sectionStyle}>About you</div>
          {Object.entries(sug.fields).map(([f, v]) => row(key("field", f, 0), v, SUGGESTION_LABELS.fields[f] || f))}
        </div>
      )}
      {Object.entries(sug.items).map(([f, list]) => list.length ? (
        <div key={f}>
          <div style={sectionStyle}>{SUGGESTION_LABELS.items[f]}</div>
          {list.map((it, i) => row(key("item", f, i), it))}
        </div>
      ) : null)}
      {sug.unsorted.length > 0 && (
        <div>
          <div style={{ ...sectionStyle, display: "flex", alignItems: "center", gap: 10 }}>
            <span>Couldn't tell where these go ({sug.unsorted.length})</span>
            <LinkButton onClick={() => setShowUnsorted((v) => !v)} style={{ textTransform: "none", letterSpacing: 0 }}>{showUnsorted ? "Hide" : "Show, and add to Other details"}</LinkButton>
          </div>
          {showUnsorted && sug.unsorted.map((it, i) => row(key("unsorted", "otherDetails", i), it))}
        </div>
      )}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
        <Button onClick={apply} disabled={n === 0} style={{ padding: "10px 20px", fontSize: TYPE.sm }}>Add {n} to my profile</Button>
        <span style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textDim }}>{total - n > 0 ? `${total - n} unticked` : "Everything ticked"}</span>
      </div>
    </div>
  );
}
