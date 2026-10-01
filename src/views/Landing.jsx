import { useApp } from "../AppContext.js";
import { COLORS, FONTS, TYPE } from "../ui/theme.js";
import { GlowCard, BrandMark, LinkButton, AppIcon, LetterDemo, Button } from "../ui/components.jsx";
import { PLANS } from "../lib/plans.js";
import { formatAwardTotal } from "../lib/catalogStats.js";

export default function Landing() {
  const { isMobile, reducedMotion, profile, authUser, setShowAuthModal, setAuthMode, setLegalModal, checkoutLoading, setView, handleCheckout, handleSignOut, catalogReady, catalogStats, catalogCount, lastCheckedLabel } = useApp();
  return (
        <div style={{ minHeight: "100vh" }}>
          {/* Landing Nav */}
          <nav className="landing-nav" style={{
            position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
            padding: "16px 40px", display: "flex", justifyContent: "space-between", alignItems: "center",
            background: "rgba(8,8,13,0.85)", backdropFilter: "blur(20px)",
            borderBottom: `1px solid ${COLORS.border}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <BrandMark size={28} />
              <span style={{ fontSize: TYPE.sm, fontFamily: FONTS.body, letterSpacing: 3, color: COLORS.gold, textTransform: "uppercase" }}>MeritLaunch</span>
            </div>
            <div className="landing-nav-buttons" style={{ display: "flex", gap: 12 }}>
              {authUser ? (
                <>
                  <Button variant="ghost" onClick={handleSignOut} style={{ fontSize: TYPE.sm, padding: "8px 16px" }}>Sign Out</Button>
                  <Button onClick={() => setView("home")} style={{ fontSize: TYPE.sm, padding: "8px 20px" }}>Dashboard</Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => { setAuthMode("signin"); setShowAuthModal(true); }} style={{ fontSize: TYPE.sm, padding: "8px 16px" }}>Sign In</Button>
                  <Button onClick={() => setView("profile")} style={{ fontSize: TYPE.sm, padding: "8px 20px" }}>Get Started Free</Button>
                </>
              )}
            </div>
          </nav>

          {/* Hero with Video Background */}
          <div style={{
            position: "relative", overflow: "hidden",
            padding: "160px 40px 80px", textAlign: "center",
            minHeight: "85vh", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
          }}>
            {/* Background: video on desktop when motion is welcome; a still otherwise.
                Phones never request the video file. */}
            {!isMobile && !reducedMotion ? (
              <video autoPlay muted loop playsInline preload="none" poster="/hero-poster.jpg" aria-hidden="true"
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0, opacity: 0.35 }}>
                <source src="/hero-bg-small.mp4" type="video/mp4" />
              </video>
            ) : (
              <div aria-hidden="true" style={{
                position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                backgroundImage: "url(/hero-poster.jpg)", backgroundSize: "cover", backgroundPosition: "center",
                opacity: 0.35, zIndex: 0,
              }} />
            )}
            {/* Dark gradient overlay for text readability */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1,
              background: `linear-gradient(180deg, rgba(8,8,13,0.7) 0%, rgba(8,8,13,0.4) 40%, rgba(8,8,13,0.8) 100%), radial-gradient(ellipse 80% 50% at 50% -10%, ${COLORS.goldDim}, transparent)`,
            }} />
            {/* Hero Content */}
            <div style={{ position: "relative", zIndex: 2 }}>
              <div style={{
                fontSize: TYPE.xs, fontFamily: FONTS.body, letterSpacing: 4, color: COLORS.gold,
                textTransform: "uppercase", marginBottom: 20,
              }}>
                AI-Powered Scholarship Matching
              </div>
              <h1 className="landing-hero-title" style={{
                fontSize: TYPE.display, fontWeight: 400, lineHeight: 1.08, marginBottom: 20,
                maxWidth: 720, margin: "0 auto 20px",
              }}>
                <span style={{ color: COLORS.text }}>Your Story Is the Application.</span><br/>
                <span style={{
                  background: `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.goldLight})`,
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}>We Just Help You Tell It.</span>
              </h1>
              <p className="landing-hero-subtitle" style={{
                fontSize: TYPE.lg, fontFamily: FONTS.body, color: COLORS.textMuted,
                maxWidth: 560, margin: "0 auto 40px", lineHeight: 1.6,
              }}>
                Find scholarships you're actually eligible for, and draft letters from your real story that you revise and send as your own. Built by a parent who's been where you are.
              </p>
              <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
                <Button onClick={() => setView("profile")} style={{ fontSize: TYPE.md, padding: "16px 36px" }}>
                  Start Free
                </Button>
                <Button variant="secondary" onClick={() => setView("search")} style={{ fontSize: TYPE.md, padding: "16px 36px" }}>
                  {catalogCount ? `Browse ${catalogCount} Scholarships` : "Browse Scholarships"}
                </Button>
              </div>
            </div>
          </div>

          {/* Catalog strip: computed from the live data (src/lib/catalogStats.js).
              Skeletons until it loads; never the 30 built-in fallbacks or a made-up date. */}
          <div className="landing-stats-grid reveal" aria-live="polite" style={{
            display: "flex", justifyContent: "center", gap: 48, padding: "32px 20px",
            borderTop: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}`,
            flexWrap: "wrap",
          }}>
            {[
              { val: catalogCount, label: "Scholarships tracked" },
              { val: catalogStats ? formatAwardTotal(catalogStats.totalAwards) : null, label: "In listed award amounts" },
              { val: catalogReady ? (lastCheckedLabel || "Monthly") : null, label: lastCheckedLabel ? "Listings last checked" : "Listing checks" },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: "center", minWidth: 120 }}>
                {s.val ? (
                  <div style={{ fontSize: TYPE["3xl"], fontWeight: 400, color: COLORS.gold, fontFamily: FONTS.heading }}>{s.val}</div>
                ) : (
                  <div aria-hidden="true" className="skeleton" style={{ height: 34, width: 96, margin: "0 auto", borderRadius: 6 }} />
                )}
                <div style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Feature Pillars */}
          <div style={{ padding: "80px 40px", maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <h2 style={{ fontSize: TYPE["4xl"], fontWeight: 400, marginBottom: 10 }}>How MeritLaunch Works</h2>
              <p style={{ fontSize: TYPE.md, fontFamily: FONTS.body, color: COLORS.textMuted }}>Three steps to scholarship-ready applications</p>
            </div>
            <div className="landing-steps-grid reveal" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
              {[
                { icon: "profile", title: "Build Your Profile", desc: "Answer guided questions or upload your brag sheet. MeritLaunch learns your story, strengths, and goals.", color: COLORS.gold },
                { icon: "matches", title: "Get Matched", desc: "We check eligibility first (citizenship, state, GPA, heritage), then rank what fits you, with every deadline shown.", color: COLORS.teal },
                { icon: "generate", title: "Draft, Then Make It Yours", desc: "Pick a writing style and get a draft built only from your real details. You revise it and send it as your own.", color: COLORS.teal },
              ].map((f, i) => (
                <GlowCard key={i} glow={f.color} style={{ textAlign: "center", padding: "40px 28px" }}>
                  <AppIcon name={f.icon} size={38} color={f.color} strokeWidth={1.4} style={{ margin: "0 auto 16px" }} />
                  <div style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: f.color, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Step {i + 1}</div>
                  <h3 style={{ fontSize: TYPE.xl, fontWeight: 400, marginBottom: 10 }}>{f.title}</h3>
                  <p style={{ fontSize: TYPE.base, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6 }}>{f.desc}</p>
                </GlowCard>
              ))}
            </div>
          </div>

          {/* Live letter demo — the product's signature moment, on the marketing page */}
          <div style={{ padding: "80px 40px", textAlign: "center" }}>
            <h2 style={{ fontSize: TYPE["3xl"], fontWeight: 400, marginBottom: 8 }}>You Stay the Author</h2>
            <p style={{ fontSize: TYPE.base, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 36, maxWidth: 520, marginLeft: "auto", marginRight: "auto" }}>
              Watch a draft take shape from one student's real details. Nothing invented, no stock phrases. A starting point the student revises into their own letter.
            </p>
            <div className="reveal"><LetterDemo /></div>
          </div>

          {/* Origin Story — editorial spread */}
          <div style={{ padding: "80px 40px", background: COLORS.surface }}>
            <div style={{ maxWidth: 1040, margin: "0 auto" }}>
              <h2 style={{ fontSize: TYPE["3xl"], fontWeight: 400, textAlign: "center", marginBottom: 12 }}>We've Been Where You Are</h2>
              <p style={{ textAlign: "center", fontFamily: FONTS.body, fontSize: TYPE.base, color: COLORS.textDim, marginBottom: 40 }}>A real story from the parent who built this tool</p>
              <div className="landing-story-grid reveal" style={{ display: "grid", gridTemplateColumns: "5fr 7fr", alignItems: "stretch" }}>
                <div className="landing-story-image" style={{ position: "relative", minHeight: 340 }}>
                  <img src="/story-still.jpg" alt="A student working at a kitchen table in the evening" loading="lazy" style={{
                    position: "absolute", inset: 0, width: "100%", height: "100%",
                    objectFit: "cover", borderRadius: "14px 0 0 14px", filter: "saturate(0.85)",
                  }} />
                  <div style={{
                    position: "absolute", inset: 0, borderRadius: "14px 0 0 14px",
                    background: "linear-gradient(200deg, rgba(8,8,13,0.15) 0%, rgba(8,8,13,0.82) 100%)",
                  }} />
                  <div style={{
                    position: "absolute", left: 26, right: 26, bottom: 26,
                    fontFamily: FONTS.heading, fontStyle: "italic", fontSize: TYPE["2xl"], lineHeight: 1.35, color: COLORS.text,
                  }}>
                    "It was like applying to college 40 more times."
                  </div>
                </div>
              <GlowCard hover={false} glow={COLORS.gold} style={{ padding: "40px 36px", borderRadius: "0 14px 14px 0" }}>
                <div style={{ fontSize: TYPE.lg, fontFamily: FONTS.heading, color: COLORS.textMuted, lineHeight: 1.7, fontStyle: "italic" }}>
                  <p style={{ marginBottom: 16 }}>
                    "It was the fall of their senior year, and my kids were running on fumes. They were carrying full loads of advanced coursework. Multiple AP classes, college-level engineering. Just about honors everything."
                  </p>
                  <p style={{ marginBottom: 16 }}>
                    "Then scholarship season hit. Suddenly we weren't just a family getting through the school year. We were a small, overwhelmed operation. The kitchen table disappeared under stacks of printed applications. We tracked deadlines on a spreadsheet while I proofread essays at midnight."
                  </p>
                  <p style={{ marginBottom: 16 }}>
                    "We found dozens of scholarships they qualified for. But each one needed a tailored application. Unique essays. Specific formatting. Different portals. It was like applying to college 40 more times."
                  </p>
                  <p style={{ marginBottom: 16 }}>
                    "My children did it. They finished strong in their coursework AND submitted every application. I'm proud of that. But I watched the cost. The late nights. The stress of choosing between studying for an exam and polishing a scholarship letter."
                  </p>
                  <p style={{ marginBottom: 0 }}>
                    "I kept thinking: what if they could have focused on what mattered most — their ideas, their story, their voice — and let a tool handle the rest? That's why MeritLaunch exists. Not to replace the student. To give them back their time."
                  </p>
                </div>
                <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.goldLight})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: TYPE.xl, color: COLORS.bg, fontWeight: 700 }}>
                    CS
                  </div>
                  <div>
                    <div style={{ fontSize: TYPE.md, fontWeight: 600, fontFamily: FONTS.body, color: COLORS.gold }}>Corey S.</div>
                    <div style={{ fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.textDim }}>Parent and creator of MeritLaunch</div>
                  </div>
                </div>
              </GlowCard>
              </div>
            </div>
          </div>

          {/* Pricing — rendered from src/lib/plans.js, the same numbers the server enforces */}
          <div id="pricing" style={{ padding: "80px 40px", textAlign: "center", scrollMarginTop: 80 }}>
            <h2 style={{ fontSize: TYPE["3xl"], fontWeight: 400, marginBottom: 8 }}>Simple, Transparent Pricing</h2>
            <p style={{ fontSize: TYPE.base, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 40 }}>Start free. Upgrade only if you want more for a full application season.</p>
            <div className="landing-pricing-grid reveal" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, maxWidth: 940, margin: "0 auto" }}>
              {PLANS.map(pl => {
                const accent = pl.id === "premium" ? COLORS.gold : pl.id === "seasonal" ? COLORS.teal : COLORS.textMuted;
                const go = () => pl.id === "free" ? setView("profile")
                  : authUser ? handleCheckout(pl.id) : (setAuthMode("signup"), setShowAuthModal(true));
                return (
                  <GlowCard key={pl.id} hover={false} glow={accent} style={{
                    padding: "32px 24px", textAlign: "left", display: "flex", flexDirection: "column",
                    ...(pl.highlight ? { border: `2px solid ${COLORS.gold}55`, boxShadow: `0 0 40px ${COLORS.goldGlow}` } : {}),
                  }}>
                    <div style={{ fontSize: TYPE.sm, fontFamily: FONTS.body, fontWeight: 600, color: accent, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>{pl.name}</div>
                    <div style={{ fontSize: TYPE["4xl"], fontWeight: 400, marginBottom: 4 }}>{pl.price}<span style={{ fontSize: TYPE.base, color: COLORS.textMuted }}>{pl.period}</span></div>
                    <div style={{ fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 22, lineHeight: 1.5 }}>{pl.tagline}</div>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                      {pl.features.map(f => (
                        <li key={f} style={{ display: "flex", gap: 8, fontSize: TYPE.sm, fontFamily: FONTS.body, color: f.endsWith("plus:") ? accent : COLORS.textMuted, lineHeight: 1.45 }}>
                          <AppIcon name="check" size={15} color={accent} style={{ marginTop: 2 }} />{f}
                        </li>
                      ))}
                    </ul>
                    <Button variant={pl.highlight ? "primary" : "secondary"} disabled={checkoutLoading && pl.id !== "free"} onClick={go}
                      style={{ width: "100%", justifyContent: "center", marginTop: 24, ...(pl.id === "seasonal" ? { borderColor: COLORS.teal + "55", color: COLORS.teal } : {}) }}>
                      {checkoutLoading && pl.id !== "free" ? "Loading..." : pl.cta}
                    </Button>
                  </GlowCard>
                );
              })}
            </div>
          </div>

          {/* CTA */}
          <div style={{
            padding: "80px 40px", textAlign: "center",
            background: `radial-gradient(ellipse 60% 40% at 50% 100%, ${COLORS.goldDim}, transparent)`,
          }}>
            <h2 style={{ fontSize: TYPE["4xl"], fontWeight: 400, marginBottom: 12 }}>Ready to Fund Your Future?</h2>
            <p style={{ fontSize: TYPE.md, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 32 }}>
              Your story is the application. Build your profile in under 10 minutes and start today.
            </p>
            <Button onClick={() => setView("profile")} style={{ fontSize: TYPE.md, padding: "16px 40px" }}>
              Get Started Free
            </Button>
          </div>

          {/* Footer */}
          <footer className="landing-footer" style={{
            padding: "24px 40px", borderTop: `1px solid ${COLORS.border}`,
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap",
            fontFamily: FONTS.body, fontSize: TYPE.xs, color: COLORS.textMuted,
          }}>
            <span>MeritLaunch © 2026. Not to replace the student. To give them back their time.</span>
            <span style={{ display: "flex", gap: 14 }}>
              <LinkButton onClick={() => setLegalModal("privacy")} style={{ color: COLORS.textMuted, padding: "10px 4px" }}>Privacy</LinkButton>
              <LinkButton onClick={() => setLegalModal("terms")} style={{ color: COLORS.textMuted, padding: "10px 4px" }}>Terms</LinkButton>
            </span>
            {catalogCount && <span>{catalogCount} scholarships · {formatAwardTotal(catalogStats.totalAwards)} in listed awards</span>}
          </footer>
        </div>
  );
}
