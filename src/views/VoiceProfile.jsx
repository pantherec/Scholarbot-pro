import { useApp } from "../AppContext.js";
import { COLORS, FONTS, TYPE } from "../ui/theme.js";
import { GlowCard, Button, SectionHeader } from "../ui/components.jsx";

export default function VoiceProfile() {
  const { profile, generatedProfile, setView, notify, runMatching } = useApp();
  return (
              <div>
                <button type="button" onClick={() => setView("profile")} style={{ background: "none", border: "none", color: COLORS.gold, cursor: "pointer", fontFamily: FONTS.body, fontSize: TYPE.sm, marginBottom: 20, padding: "8px 0" }}>← Back to my profile</button>
                <SectionHeader title="Your Voice Profile" subtitle="How you write, in your own words. Every draft uses this to sound like you." />
                <GlowCard hover={false} style={{ maxWidth: 800, padding: 32 }}>
                  <pre style={{ whiteSpace: "pre-wrap", fontFamily: FONTS.body, fontSize: TYPE.base, lineHeight: 1.8, color: "#d4d0c8" }}>{generatedProfile}</pre>
                </GlowCard>
                <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
                  <Button onClick={() => { navigator.clipboard.writeText(generatedProfile); notify("Copied!", "success"); }}>Copy Profile</Button>
                  <Button variant="secondary" onClick={runMatching}>See my matches →</Button>
                </div>
              </div>
  );
}
