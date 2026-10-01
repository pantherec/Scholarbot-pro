import { useApp } from "../AppContext.js";
import { COLORS, FONTS, TYPE } from "../ui/theme.js";
import { store } from "../lib/api.js";
import { GlowCard, Button, SectionHeader, EmptyState } from "../ui/components.jsx";

export default function SavedLetters() {
  const { savedLetters, setSavedLetters, setView, notify } = useApp();
  return (
              <div>
                <SectionHeader title="Saved Letters" />
                {savedLetters.length === 0 ? (
                  <EmptyState icon="saved" title="No saved letters yet" desc="Draft a letter, make it yours, and save it here."
                    action={() => setView("generate")} actionLabel="Write a letter" />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {savedLetters.map((l, i) => (
                      <GlowCard key={l.id} hover={false}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <div>
                            <div style={{ fontSize: TYPE.md, fontWeight: 400 }}>{l.scholarshipName || l.scholarship || "Untitled"}</div>
                            <div style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted }}>{l.template} · {l.date}</div>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(l.content || l.text || ""); notify("Copied!", "success"); }}
                              style={{ fontSize: TYPE.xs, padding: "6px 14px" }}>Copy</Button>
                            <Button variant="danger" onClick={() => {
                              const next = savedLetters.filter((_, j) => j !== i);
                              setSavedLetters(next); store.set("scholarbot-letters", next);
                              notify("Deleted.", "info");
                            }} style={{ fontSize: TYPE.xs, padding: "6px 14px" }}>Delete</Button>
                          </div>
                        </div>
                        <div style={{ fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6, maxHeight: 120, overflow: "hidden" }}>
                          {(l.content || l.text || "").slice(0, 400)}{(l.content || l.text || "").length > 400 ? "..." : ""}
                        </div>
                      </GlowCard>
                    ))}
                  </div>
                )}
              </div>
  );
}
