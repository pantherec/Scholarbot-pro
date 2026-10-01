import { useApp } from "../AppContext.js";
import { COLORS, FONTS, TYPE } from "../ui/theme.js";
import { GlowCard, ICON_PATHS, AppIcon, Button, SectionHeader } from "../ui/components.jsx";

export default function WritingStyles() {
  const { templates, notify, saveTemplates } = useApp();
  return (
              <div>
                <SectionHeader title="Writing Styles" subtitle="Different shapes for different scholarships. Every style uses only your real details." />
                <div className="two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 32 }}>
                  {templates.map(t => (
                    <GlowCard key={t.id}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <AppIcon name={ICON_PATHS[t.icon] ? t.icon : "generate"} size={22} color={COLORS.gold} />
                        <div style={{ fontSize: TYPE.lg, fontWeight: 400, color: COLORS.gold }}>{t.name}</div>
                      </div>
                      <div style={{ fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 14, lineHeight: 1.5 }}>{t.description}</div>
                      <div style={{
                        fontSize: TYPE.xs, fontFamily: FONTS.mono, color: COLORS.textDim,
                        background: COLORS.bg, padding: 14, borderRadius: 10, lineHeight: 1.6,
                      }}>{t.rules}</div>
                    </GlowCard>
                  ))}
                </div>

                {/* Custom Template Creator */}
                <GlowCard hover={false} style={{ border: `1px dashed ${COLORS.border}` }}>
                  <h3 style={{ fontSize: TYPE.md, fontWeight: 400, marginBottom: 16 }}>Create Custom Template</h3>
                  <div className="two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                    <input id="tpl-name" aria-label="Style name" placeholder="Style name..." style={{
                      padding: "10px 14px", background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                      borderRadius: 10, color: COLORS.text, fontSize: TYPE.sm, fontFamily: FONTS.body, outline: "none",
                    }}/>
                    <input id="tpl-desc" aria-label="Short description" placeholder="Short description..." style={{
                      padding: "10px 14px", background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                      borderRadius: 10, color: COLORS.text, fontSize: TYPE.sm, fontFamily: FONTS.body, outline: "none",
                    }}/>
                  </div>
                  <textarea id="tpl-rules" aria-label="Writing rules" placeholder="Writing rules..." rows={4} style={{
                    width: "100%", padding: "10px 14px", background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                    borderRadius: 10, color: COLORS.text, fontSize: TYPE.sm, fontFamily: FONTS.body,
                    outline: "none", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box", marginBottom: 12,
                  }}/>
                  <Button onClick={() => {
                    const name = document.getElementById("tpl-name").value;
                    const desc = document.getElementById("tpl-desc").value;
                    const rules = document.getElementById("tpl-rules").value;
                    if (!name || !rules) { notify("Name and rules are required.", "error"); return; }
                    saveTemplates([...templates, { id: `custom-${Date.now()}`, name, description: desc, rules, icon: "generate" }]);
                    notify("Template created!", "success");
                    document.getElementById("tpl-name").value = "";
                    document.getElementById("tpl-desc").value = "";
                    document.getElementById("tpl-rules").value = "";
                  }}>Save Template</Button>
                </GlowCard>
              </div>
  );
}
