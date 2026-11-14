import { useState } from "react";
import { useApp } from "../AppContext.js";
import { COLORS, FONTS, TYPE } from "../ui/theme.js";
import { store, deleteLetterFromSupabase } from "../lib/api.js";
import { copyText } from "../lib/clipboard.js";
import { GlowCard, Button, SectionHeader, EmptyState } from "../ui/components.jsx";

export default function SavedLetters() {
  const { savedLetters, setSavedLetters, setView, notify, authUser } = useApp();
  const [openId, setOpenId] = useState(null);
  const bodyOf = (l) => l.content || l.text || "";
  return (
              <div>
                <SectionHeader title="Saved Letters" subtitle={savedLetters.length ? "Open a letter to read all of it, then copy it into your application." : undefined} />
                {savedLetters.length === 0 ? (
                  <EmptyState icon="saved" title="No saved letters yet" desc="Draft a letter, make it yours, and save it here."
                    action={() => setView("generate")} actionLabel="Write a letter" />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {savedLetters.map((l, i) => {
                      const open = openId === l.id;
                      const body = bodyOf(l);
                      const panelId = `saved-letter-${l.id}`;
                      return (
                      <GlowCard key={l.id} hover={false}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                          <button type="button" onClick={() => setOpenId(open ? null : l.id)} aria-expanded={open} aria-controls={panelId}
                            style={{ background: "none", border: "none", padding: 0, margin: 0, textAlign: "left", cursor: "pointer", color: COLORS.text, flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: TYPE.md, fontWeight: 400, fontFamily: FONTS.heading }}>{l.scholarshipName || l.scholarship || "Untitled"}</div>
                            <div style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted }}>{[l.template, l.date].filter(Boolean).join(" · ")}</div>
                          </button>
                          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                            <Button variant="secondary" onClick={() => setOpenId(open ? null : l.id)} aria-expanded={open} aria-controls={panelId}
                              style={{ fontSize: TYPE.xs, padding: "6px 14px" }}>{open ? "Close" : "Open"}</Button>
                            <Button variant="secondary" onClick={async () => {
                              const ok = await copyText(body);
                              notify(ok ? "Copied the whole letter." : "Your browser blocked the copy. Open the letter, select the text and copy it by hand.", ok ? "success" : "error");
                              if (!ok) setOpenId(l.id);
                            }} style={{ fontSize: TYPE.xs, padding: "6px 14px" }}>Copy</Button>
                            <Button variant="danger" onClick={() => {
                              if (!window.confirm("Delete this saved letter? This cannot be undone.")) return;
                              const next = savedLetters.filter((_, j) => j !== i);
                              setSavedLetters(next); store.set("scholarbot-letters", next);
                              if (authUser) deleteLetterFromSupabase(l.id);
                              notify("Deleted.", "info");
                            }} style={{ fontSize: TYPE.xs, padding: "6px 14px" }}>Delete</Button>
                          </div>
                        </div>
                        {open ? (
                          <div id={panelId} style={{ fontSize: TYPE.base, fontFamily: FONTS.body, color: COLORS.text, lineHeight: 1.7, whiteSpace: "pre-wrap", overflowWrap: "anywhere", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "16px 18px", userSelect: "text" }}>
                            {body}
                          </div>
                        ) : (
                          <div id={panelId} style={{ fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6, maxHeight: 120, overflow: "hidden" }}>
                            {body.slice(0, 400)}{body.length > 400 ? "..." : ""}
                          </div>
                        )}
                      </GlowCard>
                      );
                    })}
                  </div>
                )}
              </div>
  );
}
