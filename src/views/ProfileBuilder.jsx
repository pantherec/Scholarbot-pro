import { useApp } from "../AppContext.js";
import { COLORS, FONTS, TYPE } from "../ui/theme.js";
import { yearIsUnder13, PROFILE_QUESTIONS, PROFILE_STEPS } from "../data/profile.js";
import { GlowCard, AppIcon, Button, SectionHeader } from "../ui/components.jsx";
import { track } from "../analytics.js";

export default function ProfileBuilder() {
  const { profile, bragSheet, setBragSheet, generatingLetter, bragSheetFileName, setBragSheetFileName, bragSheetUploading, profileStep, setProfileStep, bragFileRef, handleBragSheetUpload, saveProfile, answered, profileCompletion, runMatching, generateCandidateProfile } = useApp();
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
                  {PROFILE_QUESTIONS
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
                        <select id={id} aria-describedby={hintId} value="" onChange={e => {
                          const v = e.target.value;
                          if (!v) return;
                          if (yearIsUnder13(v)) saveProfile({ under13: true });
                          else saveProfile({ ...profile, ageOk: true });
                        }} style={{ width: "100%", padding: "12px 16px", background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, borderRadius: 10, color: COLORS.text, fontSize: TYPE.base, fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" }}>
                          <option value="">Select a year...</option>
                          {q.options.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ))}
                      {q.type === "text" && (
                        <input id={id} aria-describedby={hintId} value={profile[q.id] || ""} onChange={e => saveProfile({...profile, [q.id]: e.target.value})}
                          placeholder={q.placeholder} style={{ width: "100%", padding: "12px 16px", background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, borderRadius: 10, color: COLORS.text, fontSize: TYPE.base, fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" }}/>
                      )}
                      {q.type === "select" && (
                        <select id={id} aria-describedby={hintId} value={profile[q.id] || ""} onChange={e => saveProfile({...profile, [q.id]: e.target.value})}
                          style={{ width: "100%", padding: "12px 16px", background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, borderRadius: 10, color: COLORS.text, fontSize: TYPE.base, fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" }}>
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
                        Your Brag Sheet <span style={{ color: COLORS.textDim, fontSize: TYPE.xs }}>(optional)</span>
                      </h3>
                      <p style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted }}>Upload a PDF, Word doc, or text file, or paste it. Letter drafts can draw on it.</p>
                    </div>
                    {bragSheet && (
                      <button onClick={() => { setBragSheet(""); setBragSheetFileName(""); }} style={{
                        fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.pink,
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
                      <div style={{ color: COLORS.gold, fontFamily: FONTS.body, fontSize: TYPE.sm }}>Reading file...</div>
                    ) : bragSheetFileName ? (
                      <div>
                        <div style={{ fontSize: TYPE.xl, marginBottom: 4, color: COLORS.teal }}>✓</div>
                        <div style={{ fontFamily: FONTS.body, fontSize: TYPE.sm, color: COLORS.gold }}>{bragSheetFileName}</div>
                        <div style={{ fontFamily: FONTS.body, fontSize: TYPE.xs, color: COLORS.textDim, marginTop: 4 }}>Click or drop to replace</div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: TYPE["2xl"], marginBottom: 6, color: COLORS.textDim }}>↑</div>
                        <div style={{ fontFamily: FONTS.body, fontSize: TYPE.sm, color: COLORS.textMuted }}>Drop your brag sheet here, or click to browse</div>
                        <div style={{ fontFamily: FONTS.body, fontSize: TYPE.xs, color: COLORS.textDim, marginTop: 4 }}>PDF, Word, or text files accepted</div>
                      </div>
                    )}
                  </div>

                  <textarea value={bragSheet} onChange={e => setBragSheet(e.target.value)} aria-label="Brag sheet text"
                    placeholder="Or paste your resume, brag sheet, or activity list here..."
                    rows={5} style={{
                      width: "100%", padding: "12px 16px", background: COLORS.bg,
                      border: `1px solid ${COLORS.border}`, borderRadius: 10,
                      color: COLORS.text, fontSize: TYPE.base, fontFamily: FONTS.body,
                      outline: "none", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box",
                    }}/>
                  {bragSheet && (
                    <div style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textDim, marginTop: 6 }}>
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
  );
}
