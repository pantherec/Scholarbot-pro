import { useApp } from "../AppContext.js";
import { COLORS, FONTS, TYPE } from "../ui/theme.js";
import { GlowCard, Badge, AppIcon, Button, SectionHeader, EmptyState, ProgressRing } from "../ui/components.jsx";

export default function Matches() {
  const { profile, matchResults, setSelectedScholarship, trackedApps, setScholarshipInputMode, setView, trackApplication, runMatching, parseDeadline, LinkCheck } = useApp();
  return (
              <div>
                <SectionHeader
                  title="My Matches"
                  subtitle="Only scholarships you appear eligible for, grouped by when they're due."
                  action={<Button variant="secondary" onClick={runMatching} style={{ fontSize: TYPE.xs, padding: "8px 16px" }}>Re-run matching</Button>}
                />

                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "12px 16px", marginBottom: 20, borderRadius: 10,
                  background: COLORS.surface, border: `1px solid ${COLORS.border}`,
                  fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.5,
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
                      <h2 style={{ fontSize: TYPE.lg, fontWeight: 400, marginBottom: 12, color: k === "closed" ? COLORS.textMuted : COLORS.text }}>
                        {title} <span style={{ fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.textMuted }}>({groups[k].length})</span>
                      </h2>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {groups[k].map(s => {
                          const scoreColor = s.matchScore >= 50 ? COLORS.teal : COLORS.gold;
                          const tracked = trackedApps.some(a => a.scholarshipId === s.id);
                          return (
                            <GlowCard key={s.id} glow={scoreColor} className="match-card" style={{ padding: "18px 22px", display: "flex", alignItems: "center", gap: 18, opacity: k === "closed" ? 0.85 : 1 }}>
                              <div style={{ position: "relative", flexShrink: 0 }} aria-label={`Fit score ${s.matchScore} out of 100`}>
                                <ProgressRing value={s.matchScore} color={scoreColor} />
                                <div aria-hidden="true" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", fontSize: TYPE.base, fontWeight: 700, fontFamily: FONTS.body, color: scoreColor }}>{s.matchScore}</div>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                                  <div style={{ fontSize: TYPE.md, fontWeight: 400 }}>{s.name}</div>
                                  <Badge color={s.dl.color}>{s.dl.tone === "undated" ? s.dl.label : s.dl.tone === "closed" ? "Closed this cycle" : `Due ${s.dl.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${s.dl.days}d`}</Badge>
                                  <LinkCheck s={s} />
                                </div>
                                <div style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 4 }}>Why you fit:</div>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  {s.matchReasons.map((r, j) => (
                                    <span key={j} style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, padding: "3px 8px", borderRadius: 5 }}>{r}</span>
                                  ))}
                                </div>
                                {s.amount && <div style={{ fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.gold, marginTop: 6 }}>{s.amount}</div>}
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                                {k === "closed" ? (
                                  <Button variant="secondary" onClick={() => trackApplication(s)} style={{ fontSize: TYPE.xs, padding: "10px 16px" }}>
                                    {tracked ? "✓ Tracking" : "Track for next year"}
                                  </Button>
                                ) : (
                                  <>
                                    <Button onClick={() => { setSelectedScholarship(s); setScholarshipInputMode("database"); setView("generate"); }} style={{ fontSize: TYPE.xs, padding: "10px 18px" }}>
                                      Draft a letter
                                    </Button>
                                    <Button variant="secondary" onClick={() => trackApplication(s)} style={{ fontSize: TYPE.xs, padding: "8px 14px" }}>
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
  );
}
