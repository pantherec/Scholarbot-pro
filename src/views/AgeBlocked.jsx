import { useApp } from "../AppContext.js";
import { COLORS, FONTS, TYPE } from "../ui/theme.js";
import { GlowCard, AppIcon, Button } from "../ui/components.jsx";

export default function AgeBlocked() {
  const { profile, setView } = useApp();
  return (
              <div style={{ maxWidth: 560, margin: "60px auto", textAlign: "center" }}>
                <GlowCard hover={false} style={{ padding: "44px 36px" }}>
                  <AppIcon name="profile" size={40} color={COLORS.gold} style={{ margin: "0 auto 18px" }} />
                  <h2 style={{ fontSize: TYPE["2xl"], fontWeight: 400, marginBottom: 12 }}>MeritLaunch is for students 13 and up</h2>
                  <p style={{ fontFamily: FONTS.body, fontSize: TYPE.base, color: COLORS.textMuted, lineHeight: 1.7, marginBottom: 10 }}>
                    We didn't save anything you entered. Come back when you're 13, and we'll be ready for your story.
                  </p>
                  <p style={{ fontFamily: FONTS.body, fontSize: TYPE.sm, color: COLORS.textDim, lineHeight: 1.7, marginBottom: 24 }}>
                    A parent exploring ahead of time? You're welcome to browse the scholarship database — no account or profile needed.
                  </p>
                  <Button variant="secondary" onClick={() => setView("search")}>Browse Scholarships</Button>
                </GlowCard>
              </div>
  );
}
