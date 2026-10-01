import { useApp } from "../AppContext.js";
import { COLORS, FONTS, TYPE } from "../ui/theme.js";
import { store } from "../lib/api.js";
import { GlowCard, SectionHeader } from "../ui/components.jsx";

export default function PracticeAnswers() {
  const { appAnswers, setAppAnswers, APP_QUESTIONS } = useApp();
  return (
              <div>
                <SectionHeader title="Application Prep" subtitle="Answer common scholarship questions. Your responses enhance generated letters." />
                {APP_QUESTIONS.map((q, i) => (
                  <div key={i} style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <span style={{
                        width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: TYPE.xs, fontFamily: FONTS.body, fontWeight: 600, flexShrink: 0,
                        background: appAnswers[`q${i}`] ? COLORS.goldDim : COLORS.surface,
                        color: appAnswers[`q${i}`] ? COLORS.gold : COLORS.textDim,
                        border: `1px solid ${appAnswers[`q${i}`] ? COLORS.gold + "44" : COLORS.border}`,
                      }}>
                        {appAnswers[`q${i}`] ? "✓" : i + 1}
                      </span>
                      <label style={{ fontSize: TYPE.base, fontFamily: FONTS.body, color: COLORS.textMuted }}>{q}</label>
                    </div>
                    <textarea value={appAnswers[`q${i}`] || ""} onChange={e => {
                      const next = {...appAnswers, [`q${i}`]: e.target.value};
                      setAppAnswers(next); store.set("scholarbot-answers", next);
                    }} rows={5} style={{
                      width: "100%", padding: "14px 18px", background: COLORS.surface,
                      border: `1px solid ${COLORS.border}`, borderRadius: 10,
                      color: COLORS.text, fontSize: TYPE.base, fontFamily: FONTS.body,
                      outline: "none", resize: "vertical", lineHeight: 1.7, boxSizing: "border-box",
                    }}/>
                  </div>
                ))}
                <GlowCard hover={false} style={{ fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6 }}>
                  These answers are saved automatically and feed into your letter generation. More detail = better letters.
                </GlowCard>
              </div>
  );
}
