import { useState, useMemo, useRef, useEffect } from "react";
import { useApp } from "../AppContext.js";
import { COLORS, FONTS, TYPE } from "../ui/theme.js";
import { GlowCard, ICON_PATHS, LinkButton, AppIcon, Button, SectionHeader } from "../ui/components.jsx";
import { FREE_LIMITS } from "../lib/plans.js";
import { findUnsupportedDetails, describeDetail } from "../lib/factcheck.js";
import { PROFILE_QUESTIONS } from "../data/profile.js";
import { track } from "../analytics.js";

export default function LetterWriter() {
  const { bragSheet, appAnswers, generatedProfile, includeSensitive, setIncludeSensitive, profile, scholarshipQuery, setScholarshipQuery, scholarshipPickerOpen, setScholarshipPickerOpen, scholarshipDB, matchResults, essayPrompt, setEssayPrompt, wordLimit, setWordLimit, aiPolicy, setAiPolicy, pickerActive, setPickerActive, selectedScholarship, setSelectedScholarship, selectedTemplate, setSelectedTemplate, templates, generatedLetter, setGeneratedLetter, generatingLetter, setProfileStep, scholarshipInputMode, setScholarshipInputMode, customScholarshipText, setCustomScholarshipText, customScholarshipName, setCustomScholarshipName, scholarshipUrl, setScholarshipUrl, fetchingUrl, uploadedScholarshipName, authUser, monthlyLettersUsed, setView, scholarshipFileRef, isPremium, openUpgrade, handleScholarshipUpload, fetchScholarshipFromUrl, notify, saveLetter, thinFields, generateLetter, parseDeadline, catalogCount, bragSheetFileName, draftQuestions, draftAnswers, setDraftAnswers, askingQuestions, draftStage, draftError } = useApp();

  // What this draft is built from, named, so "using only what's in your
  // profile" is never shown while a brag sheet or answers are in play.
  const profileFilled = PROFILE_QUESTIONS.filter(q => q.type !== "age" && (Array.isArray(profile[q.id]) ? profile[q.id].length : String(profile[q.id] || "").trim())).length;
  const answeredCount = (draftQuestions || []).filter(q => { const a = draftAnswers[q.id]; return a && a.status !== "skipped" && (a.status === "confirmed" || (a.text || "").trim()); }).length;
  const sources = [
    `your profile (${profileFilled} of ${PROFILE_QUESTIONS.length - 1} answers)`,
    bragSheet ? `your brag sheet${bragSheetFileName ? ` (${bragSheetFileName})` : ""}` : null,
    generatedProfile ? "your voice notes" : null,
    Object.keys(appAnswers || {}).length ? "your practice answers" : null,
    essayPrompt.trim() ? "the application's question" : null,
    answeredCount ? `your ${answeredCount} answer${answeredCount === 1 ? "" : "s"} below` : null,
  ].filter(Boolean);

  // Progress while drafting: a clock until the first words, then words written
  // against the target length.
  const letterCardRef = useRef(null);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!generatingLetter) { setElapsed(0); return; }
    letterCardRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(id);
  }, [generatingLetter]);
  const parsedLimit = parseInt(wordLimit, 10);
  const targetWords = Number.isFinite(parsedLimit) ? Math.min(1000, Math.max(100, parsedLimit)) : (aiPolicy === "unsure" ? 250 : 400);
  const wordsSoFar = generatedLetter.trim() ? generatedLetter.trim().split(/\s+/).length : 0;
  const pct = generatingLetter && wordsSoFar ? Math.min(96, Math.round((wordsSoFar / targetWords) * 100)) : 0;

  // The questions panel opens when questions arrive and folds once a draft is written.
  const [qOpen, setQOpen] = useState(true);
  useEffect(() => { if (draftQuestions && draftQuestions.length) setQOpen(true); }, [draftQuestions]);
  useEffect(() => { if (generatingLetter) setQOpen(false); }, [generatingLetter]);
  const setAnswer = (id, patch) => setDraftAnswers(prev => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
  const skippedCount = (draftQuestions || []).filter(q => draftAnswers[q.id]?.status === "skipped").length;
  const openCount = (draftQuestions || []).length - answeredCount - skippedCount;

  // Details the draft added that the student never gave us (an age, a count, a
  // weekday, a name). Each one is listed until the student marks it true or
  // rewrites it; Save and Copy wait until the list is empty.
  const [kept, setKept] = useState(() => new Set());
  const letterRef = useRef(null);
  useEffect(() => { if (generatingLetter) setKept(new Set()); }, [generatingLetter]);
  const flagged = useMemo(() => {
    if (generatingLetter || !generatedLetter) return [];
    const scholarship = scholarshipInputMode === "database" ? (selectedScholarship || {}) : { name: customScholarshipName, description: customScholarshipText };
    return findUnsupportedDetails(generatedLetter, { profile, bragSheet, appAnswers, scholarship, essayPrompt, voiceProfile: generatedProfile });
  }, [generatedLetter, generatingLetter, profile, bragSheet, appAnswers, scholarshipInputMode, selectedScholarship, customScholarshipName, customScholarshipText, essayPrompt, generatedProfile]);
  const toCheck = flagged.filter(f => !kept.has(f.text.toLowerCase()));
  const findInLetter = (f) => {
    const el = letterRef.current;
    const i = generatedLetter.indexOf(f.text);
    if (!el || i < 0) return;
    el.focus();
    el.setSelectionRange(i, i + f.text.length);
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  };
  return (
              <div>
                <SectionHeader title="Write a Letter" subtitle="Pick a scholarship and a style. You get a draft built from your real details, then you make it yours." />

                <div className="two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
                  {/* Scholarship Input */}
                  <div>
                    <div id="sch-source-label" style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
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
                          flex: 1, padding: "10px 8px", border: "none", fontSize: TYPE.xs, fontFamily: FONTS.body,
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
                            style={{ width: "100%", padding: "12px 16px", background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, borderRadius: 10, color: COLORS.text, fontSize: TYPE.base, fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" }}
                          />
                          {scholarshipPickerOpen && (
                            <div id="sch-listbox" role="listbox" aria-label="Scholarships" style={{
                              position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 50,
                              maxHeight: 320, overflowY: "auto", background: COLORS.card,
                              border: `1px solid ${COLORS.border}`, borderRadius: 10,
                              boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
                            }}>
                              {list.length === 0 ? (
                                <div role="option" aria-disabled="true" aria-selected="false" style={{ padding: "14px 16px", fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.textMuted }}>
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
                                    <div style={{ fontSize: TYPE.base, color: COLORS.text }}>{s.name}</div>
                                    <div style={{ fontSize: TYPE.xs, color: COLORS.textMuted, display: "flex", gap: 10, marginTop: 2 }}>
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
                            fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6,
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
                              <div style={{ fontSize: TYPE.xl, marginBottom: 4, color: COLORS.teal }}>✓</div>
                              <div style={{ fontFamily: FONTS.body, fontSize: TYPE.sm, color: COLORS.gold }}>{uploadedScholarshipName}</div>
                            </div>
                          ) : (
                            <div>
                              <AppIcon name="doc" size={30} color={COLORS.textMuted} style={{ margin: "0 auto 8px" }} />
                              <div style={{ fontFamily: FONTS.body, fontSize: TYPE.sm, color: COLORS.textMuted }}>Drop scholarship application here</div>
                            </div>
                          )}
                        </div>
                        <input value={customScholarshipName} onChange={e => setCustomScholarshipName(e.target.value)} aria-label="Scholarship name"
                          placeholder="Scholarship name" style={{ width: "100%", padding: "12px 16px", background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, borderRadius: 10, color: COLORS.text, fontSize: TYPE.base, fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" }}/>
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
                              color: COLORS.text, fontSize: TYPE.sm, fontFamily: FONTS.body, outline: "none",
                            }}/>
                          <Button onClick={fetchScholarshipFromUrl} disabled={fetchingUrl} style={{ fontSize: TYPE.xs, padding: "10px 18px" }}>
                            {fetchingUrl ? "Fetching..." : "Fetch →"}
                          </Button>
                        </div>
                        <input value={customScholarshipName} onChange={e => setCustomScholarshipName(e.target.value)} aria-label="Scholarship name"
                          placeholder="Scholarship name" style={{ ...{ width: "100%", padding: "12px 16px", background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, borderRadius: 10, color: COLORS.text, fontSize: TYPE.base, fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" }, marginBottom: 10 }}/>
                        {customScholarshipText && (
                          <div style={{
                            padding: 12, background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                            borderRadius: 10, fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textDim,
                          }}>
                            <span style={{ color: COLORS.teal }}>✓ Fetched</span> · {customScholarshipText.length.toLocaleString()} chars
                          </div>
                        )}
                      </div>
                    )}

                    {scholarshipInputMode === "paste" && (
                      <div>
                        <input value={customScholarshipName} onChange={e => setCustomScholarshipName(e.target.value)} aria-label="Scholarship name"
                          placeholder="Scholarship name" style={{ ...{ width: "100%", padding: "12px 16px", background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, borderRadius: 10, color: COLORS.text, fontSize: TYPE.base, fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" }, marginBottom: 10 }}/>
                        <textarea value={customScholarshipText} onChange={e => setCustomScholarshipText(e.target.value)} aria-label="Scholarship description"
                          placeholder="Paste the full scholarship description here..."
                          rows={8} style={{
                            width: "100%", padding: "12px 16px", background: COLORS.bg,
                            border: `1px solid ${COLORS.border}`, borderRadius: 10,
                            color: COLORS.text, fontSize: TYPE.sm, fontFamily: FONTS.body,
                            outline: "none", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box",
                          }}/>
                      </div>
                    )}
                  </div>

                  {/* Template Selection */}
                  <div>
                    <div id="style-label" style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
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
                            <span style={{ fontSize: TYPE.base, fontFamily: FONTS.body, fontWeight: 500 }}>{t.name}</span>
                          </div>
                          <div style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.4 }}>{t.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* The application's real question + length, and the AI-policy check */}
                <div className="two-col" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div>
                    <label htmlFor="essay-prompt" style={{ display: "block", fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 6 }}>
                      The application's essay question (optional, but it makes a big difference)
                    </label>
                    <textarea id="essay-prompt" rows={3} value={essayPrompt} onChange={e => setEssayPrompt(e.target.value)}
                      placeholder="e.g. Describe a challenge you overcame and what it taught you."
                      style={{ ...{ width: "100%", padding: "12px 16px", background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, borderRadius: 10, color: COLORS.text, fontSize: TYPE.base, fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" }, resize: "vertical", lineHeight: 1.6 }} />
                  </div>
                  <div>
                    <label htmlFor="word-limit" style={{ display: "block", fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 6 }}>
                      Word limit
                    </label>
                    <input id="word-limit" type="number" min={100} max={1000} step={25} inputMode="numeric" value={wordLimit}
                      onChange={e => setWordLimit(e.target.value)} placeholder="e.g. 500" style={{ width: "100%", padding: "12px 16px", background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, borderRadius: 10, color: COLORS.text, fontSize: TYPE.base, fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" }} />
                  </div>
                </div>

                <fieldset style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
                  <legend style={{ fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.text, padding: "0 6px" }}>Does this scholarship allow AI help?</legend>
                  <p style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6, margin: "0 0 10px" }}>
                    Some scholarships limit outside help or AI. Check their rules. You're responsible for following them.
                  </p>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    {[
                      ["allowed", "Allowed: draft a letter I'll revise"],
                      ["unsure", "Not sure or not allowed: give me an outline and questions instead (free)"],
                    ].map(([val, label]) => (
                      <label key={val} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.textMuted, cursor: "pointer", maxWidth: 420 }}>
                        <input type="radio" name="ai-policy" value={val} checked={aiPolicy === val} onChange={() => setAiPolicy(val)} style={{ width: 18, height: 18, accentColor: COLORS.gold, marginTop: 1 }} />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                {(profile.citizenship || profile.financialNeed) && (
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.textMuted, cursor: "pointer", maxWidth: 560, marginBottom: 16, lineHeight: 1.5 }}>
                    <input type="checkbox" checked={includeSensitive} onChange={e => setIncludeSensitive(e.target.checked)} style={{ width: 18, height: 18, accentColor: COLORS.gold, marginTop: 1, flexShrink: 0 }} />
                    <span>Let this draft mention my citizenship status and financial need. Off unless the scholarship asks about them, so you decide what a committee learns.</span>
                  </label>
                )}

                {aiPolicy === "allowed" && profile.ageOk && thinFields().length > 0 && (
                  <div style={{ fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
                    Your profile is missing {thinFields().join(", ")}.{bragSheet ? " Your brag sheet still counts, but the profile fields are what matching reads." : " Drafts only use what you've told us."}{" "}
                    <LinkButton onClick={() => { setProfileStep(thinFields().includes("activities") ? 2 : 3); setView("profile"); }}>Add one detail</LinkButton>
                  </div>
                )}

                {aiPolicy && (
                  <p style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted, margin: "0 0 12px", lineHeight: 1.6 }}>
                    {aiPolicy === "unsure" ? "Outline from" : "Drafting from"}: {sources.join(" · ")}.
                  </p>
                )}
                <Button onClick={() => generateLetter()}
                  disabled={generatingLetter || askingQuestions || !aiPolicy || (scholarshipInputMode === "database" ? !selectedScholarship : !customScholarshipText.trim())}
                  style={{ fontSize: TYPE.md, padding: "14px 40px", marginBottom: 28 }}>
                  {askingQuestions ? "Checking what your draft needs..." : generatingLetter ? (draftStage === "writing" ? "Writing..." : "Drafting from your details...") : aiPolicy === "unsure" ? "Make my outline" : draftQuestions && draftQuestions.length && !generatedLetter ? "Write my draft" : "Draft my letter"}
                </Button>
                {!aiPolicy && !generatingLetter && (
                  <p style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted, margin: "-16px 0 28px" }}>
                    Answer the AI-help question above first.
                  </p>
                )}
                {askingQuestions && (
                  <p style={{ fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.textMuted, margin: "-16px 0 28px", lineHeight: 1.6 }}>
                    Reading your details against {selectedTemplate?.name || "the chosen style"} to see if anything is missing. This takes a few seconds and doesn't use a letter.
                  </p>
                )}

                {aiPolicy === "allowed" && draftQuestions && draftQuestions.length > 0 && !generatingLetter && (
                  <div role="region" aria-label="Questions before your draft" style={{ marginBottom: 28, padding: "16px 18px", borderRadius: 12, background: COLORS.surface, border: `1px solid ${COLORS.gold}66` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: TYPE.md, fontFamily: FONTS.heading, color: COLORS.text }}>
                          {generatedLetter ? `Your answers (${answeredCount} given, ${skippedCount + openCount} left out)` : `Before we draft: ${draftQuestions.length} quick question${draftQuestions.length === 1 ? "" : "s"}`}
                        </div>
                        <div style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted, marginTop: 4, lineHeight: 1.5, maxWidth: 620 }}>
                          {selectedTemplate?.name || "This style"} wants details your profile and brag sheet don't have. Rather than make them up, the draft asks. Answer in a sentence or two, say the example is true, or skip it and that topic stays out.
                        </div>
                      </div>
                      <LinkButton onClick={() => setQOpen(v => !v)}>{qOpen ? "Hide" : "Show"}</LinkButton>
                    </div>
                    {qOpen && (
                      <ol style={{ listStyle: "none", padding: 0, margin: "14px 0 0", display: "flex", flexDirection: "column", gap: 14 }}>
                        {draftQuestions.map((q, i) => {
                          const a = draftAnswers[q.id] || {};
                          const status = a.status || "";
                          const example = (q.example || "").replace(/^for example:?\s*/i, "");
                          return (
                            <li key={q.id} style={{ padding: "12px 14px", borderRadius: 10, background: COLORS.bg, border: `1px solid ${status === "skipped" ? COLORS.border : status ? COLORS.teal + "66" : COLORS.border}`, opacity: status === "skipped" ? 0.7 : 1 }}>
                              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                                <span style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.gold }}>{i + 1}{q.about ? ` · ${q.about}` : ""}</span>
                                {q.why && <span style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textDim }}>for {q.why}</span>}
                                {status === "skipped" && <span style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted }}>Skipped: this stays out of the draft.</span>}
                                {status === "confirmed" && <span style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.teal }}>You said the example is what happened.</span>}
                              </div>
                              <label htmlFor={`dq-${q.id}`} style={{ display: "block", fontSize: TYPE.base, fontFamily: FONTS.body, color: COLORS.text, margin: "6px 0 8px", lineHeight: 1.5 }}>{q.question}</label>
                              {example && status !== "confirmed" && (
                                <div style={{ fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.textMuted, fontStyle: "italic", marginBottom: 8, lineHeight: 1.5 }}>
                                  Example only: “{example}” <span style={{ fontStyle: "normal", color: COLORS.textDim }}>Keep it only if it's what actually happened.</span>
                                </div>
                              )}
                              {status !== "skipped" && status !== "confirmed" && (
                                <textarea id={`dq-${q.id}`} rows={2} value={a.text || ""}
                                  onChange={e => setAnswer(q.id, { status: e.target.value.trim() ? "answered" : "", text: e.target.value })}
                                  placeholder="What actually happened, in your words"
                                  style={{ width: "100%", padding: "10px 14px", background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, borderRadius: 10, color: COLORS.text, fontSize: TYPE.base, fontFamily: FONTS.body, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.6 }} />
                              )}
                              <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
                                {example && status !== "confirmed" && <LinkButton onClick={() => setAnswer(q.id, { status: "confirmed" })}>That's true, use the example</LinkButton>}
                                {status !== "skipped" && <LinkButton onClick={() => setAnswer(q.id, { status: "skipped" })}>Skip, leave it out</LinkButton>}
                                {(status === "skipped" || status === "confirmed") && <LinkButton onClick={() => setAnswer(q.id, { status: (a.text || "").trim() ? "answered" : "" })}>Answer instead</LinkButton>}
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                    {!generatedLetter && (
                      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
                        <Button onClick={() => generateLetter({ skipQuestions: true })} disabled={generatingLetter}>Write my draft{answeredCount ? ` with ${answeredCount} answer${answeredCount === 1 ? "" : "s"}` : ""}</Button>
                        <span style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textDim }}>
                          {openCount > 0 ? `${openCount} unanswered question${openCount === 1 ? "" : "s"} will be left out of the draft.` : "Nothing unanswered."}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {(generatedLetter || generatingLetter) && (
                  <div>
                    <div ref={letterCardRef} style={{ scrollMarginTop: 24 }} />
                    {generatingLetter && (
                      <div role="status" aria-live="polite" style={{ marginBottom: 12, padding: "12px 16px", borderRadius: 10, background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.text, flexWrap: "wrap" }}>
                          <span>
                            {draftStage === "writing"
                              ? `Writing: about ${pct}% of a ${targetWords}-word ${aiPolicy === "unsure" ? "outline" : "draft"}`
                              : draftStage === "waiting"
                                ? "Reading your profile, brag sheet and the scholarship. The first words take a few seconds."
                                : "Sending your details..."}
                          </span>
                          <span style={{ color: COLORS.textDim }}>{draftStage === "writing" ? `${wordsSoFar} words` : `${elapsed}s`}</span>
                        </div>
                        <div aria-hidden="true" style={{ height: 6, borderRadius: 3, background: COLORS.border, marginTop: 10, overflow: "hidden" }}>
                          <div style={{
                            height: "100%", borderRadius: 3,
                            width: draftStage === "writing" ? `${pct}%` : "100%",
                            background: draftStage === "writing" ? `linear-gradient(90deg, ${COLORS.gold}, ${COLORS.goldLight})` : `linear-gradient(90deg, ${COLORS.border} 0%, ${COLORS.gold} 50%, ${COLORS.border} 100%)`,
                            backgroundSize: draftStage === "writing" ? "100% 100%" : "200% 100%",
                            animation: draftStage === "writing" ? "none" : "shimmer 1.6s linear infinite",
                            transition: "width 0.4s ease",
                          }} />
                        </div>
                        <div style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted, marginTop: 8 }}>Using {sources.join(" · ")}.</div>
                      </div>
                    )}
                    {!generatingLetter && draftError && (
                      <div role="alert" style={{ marginBottom: 12, padding: "12px 16px", borderRadius: 10, background: COLORS.pinkDim, border: `1px solid ${COLORS.pink}66`, fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.text, lineHeight: 1.6, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                        <span><strong>This draft stopped early.</strong> {draftError.message}{generatedLetter ? " What arrived is below, but it isn't a whole letter." : ""}</span>
                        <Button variant="secondary" onClick={() => generateLetter({ skipQuestions: true })} style={{ padding: "8px 16px", fontSize: TYPE.sm }}>Try again</Button>
                      </div>
                    )}
                    <GlowCard hover={false} className="letter-card" style={{
                      padding: 32, marginBottom: 16,
                      background: COLORS.card,
                      boxShadow: generatingLetter ? `0 0 30px ${COLORS.goldGlow}` : "none",
                      transition: "box-shadow 0.5s ease",
                    }}>
                      {/* Letter paper styling */}
                      <div className="letter-paper" style={{
                        background: "#fdfcf8", borderRadius: 8, padding: "36px 40px",
                        maxWidth: 680, margin: "0 auto",
                        boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
                        minHeight: generatingLetter && !generatedLetter ? 200 : "auto",
                      }}>
                        {generatingLetter && !generatedLetter && (
                          <div style={{ textAlign: "center", padding: "40px 0" }}>
                            <div style={{ fontSize: TYPE.base, fontFamily: FONTS.body, color: "#5f5a50", marginBottom: 8 }}>{draftStage === "waiting" ? "The first words are on their way..." : "Drafting from your details..."}</div>
                            <div style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: "#6f6a60", lineHeight: 1.6, maxWidth: 440, margin: "0 auto" }}>Built only from {sources.join(", ")}. Nothing is added that you didn't tell us.</div>
                          </div>
                        )}
                        {/* While streaming, render read-only so the typing effect and
                            cursor aren't fighting a controlled input. Once it's done,
                            swap to a textarea — this is a draft the student edits and
                            signs, not a finished artifact handed to them. */}
                        {generatingLetter ? (
                          <div style={{
                            whiteSpace: "pre-wrap", fontSize: TYPE.md, lineHeight: 1.85,
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
                            ref={letterRef}
                            value={generatedLetter}
                            onChange={e => setGeneratedLetter(e.target.value)}
                            spellCheck
                            aria-label="Your letter — edit before saving"
                            style={{
                              width: "100%", minHeight: 480, boxSizing: "border-box",
                              whiteSpace: "pre-wrap", fontSize: TYPE.md, lineHeight: 1.85,
                              color: "#2a2722", fontFamily: "Georgia, 'Times New Roman', serif",
                              background: "transparent", border: "none", outline: "none",
                              padding: 0, resize: "vertical", display: "block",
                            }}
                          />
                        )}
                      </div>
                    </GlowCard>
                    {!generatingLetter && generatedLetter && (
                      <div style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textDim, marginBottom: 12 }}>
                        This is a draft built from your details. Click into it and rewrite anything so it's fully yours before you save or send it.
                      </div>
                    )}
                    {!generatingLetter && generatedLetter && toCheck.length > 0 && (
                      <div role="region" aria-label="Details to check" style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 10, background: COLORS.goldDim, border: `1px solid ${COLORS.gold}55` }}>
                        <div style={{ fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.text, marginBottom: 8, lineHeight: 1.5 }}>
                          <strong>{toCheck.length} detail{toCheck.length === 1 ? " isn't" : "s aren't"} in your profile.</strong> The draft added {toCheck.length === 1 ? "it" : "them"}. If it's true, keep it. If not, rewrite that line before you save.
                        </div>
                        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                          {toCheck.map(f => (
                            <li key={f.text} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: TYPE.sm, fontFamily: FONTS.body }}>
                              <span style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, padding: "3px 8px", borderRadius: 6, color: COLORS.text }}>“{f.text}”</span>
                              <span style={{ color: COLORS.textMuted }}>{describeDetail(f)}</span>
                              <LinkButton onClick={() => findInLetter(f)}>Find it</LinkButton>
                              <LinkButton onClick={() => setKept(k => new Set([...k, f.text.toLowerCase()]))}>It's true</LinkButton>
                            </li>
                          ))}
                        </ul>
                        {toCheck.length > 1 && (
                          <LinkButton onClick={() => setKept(new Set(flagged.map(f => f.text.toLowerCase())))} style={{ marginTop: 10 }}>All of these are true</LinkButton>
                        )}
                      </div>
                    )}
                    {!generatingLetter && generatedLetter && (
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        <Button disabled={toCheck.length > 0 || !!draftError} title={draftError ? "This draft stopped early. Try again first." : toCheck.length ? "Check the details above first" : undefined} onClick={() => {
                          const label = scholarshipInputMode === "database" ? selectedScholarship?.name : (customScholarshipName || "Custom Scholarship");
                          saveLetter({ content: generatedLetter, scholarshipName: label, template: selectedTemplate?.name, scholarshipId: selectedScholarship?.id });
                        }}>Save Letter</Button>
                        <Button variant="secondary" disabled={toCheck.length > 0} title={toCheck.length ? "Check the details above first" : undefined} onClick={() => { navigator.clipboard.writeText(generatedLetter); track("letter_copied"); notify("Copied!", "success"); }}>Copy to Clipboard</Button>
                        <Button variant="ghost" onClick={() => generateLetter({ isRegenerate: true })}>Regenerate</Button>
                      </div>
                    )}
                    {!generatingLetter && generatedLetter && !isPremium && authUser && (
                      <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 10, background: COLORS.surface, border: `1px solid ${COLORS.border}`, fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6 }}>
                        Letter {Math.min(monthlyLettersUsed, FREE_LIMITS.lettersPerMonth)} of {FREE_LIMITS.lettersPerMonth} free this month
                        {(() => { const n = matchResults.filter(m => { const d = parseDeadline(m.deadline).days; return d !== null && d >= 0 && d <= 60; }).length;
                          return n > 0 ? `. You have ${n} matched scholarship${n === 1 ? "" : "s"} due in the next 60 days.` : "."; })()}{" "}
                        <LinkButton onClick={() => openUpgrade("letter")}>See plans</LinkButton>
                      </div>
                    )}
                  </div>
                )}
              </div>
  );
}
