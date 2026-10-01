import { useApp } from "../AppContext.js";
import { COLORS, FONTS, TYPE } from "../ui/theme.js";
import { GlowCard, AppIcon, Button, SectionHeader, EmptyState } from "../ui/components.jsx";
import { deadlineInfo } from "../lib/deadline.js";

export default function Deadlines() {
  const { trackedApps, setView, updateAppStatus, removeTrackedApp, parseDeadlineDate, parseDeadline } = useApp();
  return (
              <div>
                <SectionHeader title="My Deadlines" subtitle="Everything you're tracking, soonest first. We email reminders a week before each one." />
                {trackedApps.length === 0 ? (
                  <EmptyState icon="calendar" title="Nothing tracked yet" desc="Track a scholarship from your matches and its deadline shows up here, with a reminder email."
                    action={() => setView("matches")} actionLabel="Go to my matches" />
                ) : (
                  <div>
                    {/* Status summary */}
                    <div className="status-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
                      {[
                        { status: "interested", label: "Interested", color: COLORS.textMuted, icon: "○" },
                        { status: "in_progress", label: "In Progress", color: COLORS.gold, icon: "◐" },
                        { status: "submitted", label: "Submitted", color: COLORS.teal, icon: "●" },
                        { status: "accepted", label: "Accepted", color: COLORS.teal, icon: "✓" },
                        { status: "rejected", label: "Rejected", color: COLORS.pink, icon: "✗" },
                      ].map(s => (
                        <div key={s.status} style={{
                          textAlign: "center", padding: "12px 8px", borderRadius: 10,
                          background: COLORS.surface, border: `1px solid ${COLORS.border}`,
                        }}>
                          <div style={{ fontSize: TYPE["2xl"], color: s.color }}>{trackedApps.filter(a => a.status === s.status).length}</div>
                          <div style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted, marginTop: 2 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Application list */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {/* Copy before sorting — .sort() mutates, and trackedApps is state. */}
                      {[...trackedApps].sort((a, b) => {
                        // Sort by deadline urgency; undated entries sink to the bottom.
                        const da = parseDeadlineDate(a.deadline), db = parseDeadlineDate(b.deadline);
                        if (!da && !db) return 0;
                        if (!da) return 1;
                        if (!db) return -1;
                        return da - db;
                      }).map(app => {
                        const deadlineInfo = parseDeadline(app.deadline);
                        const statusColors = {
                          interested: COLORS.textMuted, in_progress: COLORS.gold,
                          submitted: COLORS.teal, accepted: COLORS.teal, rejected: COLORS.pink,
                        };
                        return (
                          <GlowCard key={app.id} hover={false}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                                  <div style={{ fontSize: TYPE.md, fontWeight: 400 }}>{app.name}</div>
                                  {deadlineInfo && (
                                    <span style={{
                                      fontSize: TYPE.xs, fontFamily: FONTS.body, padding: "2px 8px",
                                      borderRadius: 10, background: deadlineInfo.color + "22", color: deadlineInfo.color,
                                    }}>{deadlineInfo.label}</span>
                                  )}
                                </div>
                                <div style={{ fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.textDim, marginBottom: 8 }}>
                                  {app.amount} {app.link && <> · <a href={app.link} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.gold, textDecoration: "none" }}>Apply →</a></>}
                                </div>
                                {/* Status selector */}
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  {["interested", "in_progress", "submitted", "accepted", "rejected"].map(s => (
                                    <button type="button" key={s} aria-pressed={app.status === s} onClick={() => updateAppStatus(app.id, s)} style={{
                                      padding: "8px 12px", fontSize: TYPE.xs, minHeight: 36, fontFamily: FONTS.body, borderRadius: 6,
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
                              <Button variant="ghost" aria-label={`Stop tracking ${app.name}`} onClick={() => removeTrackedApp(app.id)} style={{ padding: 10, minWidth: 40, minHeight: 40, color: COLORS.textMuted }}>
                                <AppIcon name="close" size={16} />
                              </Button>
                            </div>
                          </GlowCard>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
  );
}
