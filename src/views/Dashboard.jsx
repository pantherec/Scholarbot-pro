import { useApp } from "../AppContext.js";
import { COLORS, FONTS, TYPE } from "../ui/theme.js";
import { supabase } from "../lib/api.js";
import { GlowCard, AppIcon, Button, SectionHeader } from "../ui/components.jsx";
import { track } from "../analytics.js";

export default function Dashboard() {
  const { profile, scholarshipDB, matchResults, emailOptOut, setEmailOptOut, setSelectedScholarship, savedLetters, trackedApps, deadlineAlerts, setDeadlineAlerts, setScholarshipInputMode, authUser, setView, notify, trackApplication, profileCompletion, runMatching, parseDeadline, catalogReady, catalogCount, lastCheckedLabel } = useApp();
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
                  <div style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, letterSpacing: 2, textTransform: "uppercase", color: COLORS.gold, marginBottom: 6 }}>Your next step</div>
                  <h2 style={{ fontSize: TYPE["2xl"], fontWeight: 400, marginBottom: 6, textWrap: "balance" }}>{next.title}</h2>
                  <p style={{ fontSize: TYPE.base, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 16, maxWidth: 560 }}>{next.desc}</p>
                  <Button onClick={next.go}>{next.cta} →</Button>
                  {liveTracked.length > 1 && (
                    <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${COLORS.border}` }}>
                      <div style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 6 }}>Also coming up</div>
                      {liveTracked.slice(1, 4).map(a => (
                        <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: TYPE.sm, fontFamily: FONTS.body, padding: "3px 0" }}>
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
                        <div style={{ fontSize: TYPE["3xl"], fontWeight: 300, color: stat.color, marginBottom: 2, fontFamily: FONTS.heading }}>{stat.value}</div>
                        <div style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted, letterSpacing: 1, textTransform: "uppercase" }}>{stat.label}</div>
                        {stat.hint && (
                          <div style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: stat.color, marginTop: 8 }}>{stat.hint} →</div>
                        )}
                      </button>
                    </GlowCard>
                  ))}
                </div>

                {/* Catalog status: real numbers only */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
                  background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10,
                  marginBottom: 28, fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted,
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
                    <h2 style={{ fontSize: TYPE.md, fontWeight: 400, marginBottom: 10, color: COLORS.text, fontFamily: FONTS.heading }}>Reminders</h2>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {deadlineAlerts.slice(0, 5).map(alert => (
                        <div key={alert.id} style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                          padding: "10px 16px", background: COLORS.surface, border: `1px solid ${COLORS.pink}55`,
                          borderRadius: 10, fontFamily: FONTS.body, fontSize: TYPE.sm,
                        }}>
                          <span style={{ color: COLORS.text }}>{alert.title}</span>
                          <button type="button" onClick={async () => {
                            if (supabase) await supabase.from("notifications").update({ read: true }).eq("id", alert.id);
                            setDeadlineAlerts(prev => prev.filter(a => a.id !== alert.id));
                          }} style={{
                            background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: TYPE.xs, padding: "8px 4px",
                          }}>Dismiss</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Email reminders preference (the unsubscribe link in every email sets the same flag) */}
                {authUser && (
                  <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.textMuted, cursor: "pointer" }}>
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
}
