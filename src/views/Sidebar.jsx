import { useApp } from "../AppContext.js";
import { COLORS, FONTS, TYPE } from "../ui/theme.js";
import { supabase, authFetch } from "../lib/api.js";
import { BrandMark, LinkButton, AppIcon } from "../ui/components.jsx";
import { track } from "../analytics.js";

export default function Sidebar() {
  const { view, isMobile, profile, mobileMenuOpen, setMobileMenuOpen, authUser, setShowAuthModal, setAuthMode, setView, PRO_LIMITS, isPremium, remainingMatches, remainingLetters, openUpgrade, handleSignOut, notify, profileCompletion, catalogCount, navItems } = useApp();
  return (
    <>
          {/* SIDEBAR */}
          <nav id="app-sidebar" aria-label="App" {...(isMobile && !mobileMenuOpen ? { inert: "" } : {})} className={`app-sidebar${mobileMenuOpen ? " open" : ""}`} style={{
            position: "fixed", left: 0, top: 0, bottom: 0, width: 240,
            background: COLORS.surface, borderRight: `1px solid ${COLORS.border}`,
            display: "flex", flexDirection: "column", zIndex: 100,
            transition: "transform 0.3s",
          }}>
            {/* Logo */}
            <div style={{ padding: "24px 20px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
              <button type="button" onClick={() => { setView("landing"); setMobileMenuOpen(false); }} aria-label="MeritLaunch home page"
                style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                <BrandMark size={26} />
                <span style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, letterSpacing: 3, color: COLORS.gold, textTransform: "uppercase" }}>MeritLaunch</span>
              </button>
              <div style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted, marginTop: 6 }}>
                {catalogCount ? `${catalogCount} scholarships` : "Loading scholarships..."}
              </div>
            </div>

            {/* Nav Items */}
            <div style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
              {navItems.map((item, idx) => {
                if (item.group) return (
                  <div key={`g-${idx}`} style={{ padding: "14px 20px 4px", fontSize: TYPE.xs, fontFamily: FONTS.body, letterSpacing: 2, textTransform: "uppercase", color: COLORS.textDim }}>{item.group}</div>
                );
                const active = view === item.id || (view === "profileResult" && item.id === "profile");
                return (
                  <button type="button" key={item.id} aria-current={active ? "page" : undefined} onClick={() => { setView(item.id); setMobileMenuOpen(false); }} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "11px 20px", minHeight: 44,
                    border: "none", width: "100%", textAlign: "left",
                    background: active ? `linear-gradient(90deg, ${COLORS.goldDim}, transparent)` : "transparent",
                    color: active ? COLORS.gold : COLORS.textMuted,
                    cursor: "pointer", fontSize: TYPE.sm, fontFamily: FONTS.body,
                    borderLeft: active ? `2px solid ${COLORS.gold}` : "2px solid transparent",
                    transition: "all 0.2s",
                  }}>
                    <span style={{ opacity: active ? 1 : 0.7, width: 20, display: "flex", justifyContent: "center" }}><AppIcon name={item.icon} size={16} /></span>
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Landing link */}
            <button type="button" onClick={() => setView("landing")} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "12px 20px",
              border: "none", background: "transparent", color: COLORS.textDim,
              cursor: "pointer", fontSize: TYPE.xs, fontFamily: FONTS.body,
              borderTop: `1px solid ${COLORS.border}`,
              width: "100%", textAlign: "left",
            }}>
              ← Back to Home
            </button>

            {/* User & Auth */}
            <div style={{ padding: "14px 20px", borderTop: `1px solid ${COLORS.border}`, fontSize: TYPE.xs, fontFamily: FONTS.body }}>
              {authUser ? (
                <>
                  <div style={{ color: COLORS.textDim, marginBottom: 2 }}>Signed in as</div>
                  <div style={{ color: COLORS.gold, fontWeight: 600, marginBottom: 4 }}>{profile.name || authUser.email}</div>
                  {profile.name && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ background: COLORS.border, borderRadius: 3, height: 4, overflow: "hidden" }}>
                        <div style={{ background: COLORS.gold, height: "100%", width: `${profileCompletion}%`, transition: "width 0.4s", borderRadius: 3 }} />
                      </div>
                      <div style={{ fontSize: TYPE.xs, color: COLORS.textDim, marginTop: 3 }}>{profileCompletion}% profile complete</div>
                    </div>
                  )}
                  {/* Usage stats */}
                  <div style={{ marginBottom: 8, padding: "8px 0", borderTop: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: TYPE.xs, color: COLORS.textDim, marginBottom: 4 }}>
                      <span>Match runs: {remainingMatches} left</span>
                      <span style={{ color: isPremium ? COLORS.teal : COLORS.textDim }}>{isPremium ? "PRO" : "Free"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: TYPE.xs, color: COLORS.textDim }}>
                      <span>Letters: {remainingLetters}{isPremium ? `/${PRO_LIMITS.lettersPerMonth}` : ""} left</span>
                      {!isPremium && <LinkButton onClick={() => openUpgrade(null)} style={{ fontSize: TYPE.xs }}>Upgrade</LinkButton>}
                    </div>
                  </div>
                  {isPremium && (
                    <button type="button" onClick={async () => {
                      track("portal_opened");
                      try {
                        const { data: prof } = await supabase.from("user_profiles").select("stripe_customer_id").eq("id", authUser.id).single();
                        if (prof?.stripe_customer_id) {
                          const resp = await authFetch("/api/customer-portal", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ customerId: prof.stripe_customer_id }),
                          });
                          const data = await resp.json();
                          if (data.url) window.location.href = data.url;
                        } else { notify("No billing account found.", "error"); }
                      } catch { notify("Could not open billing portal.", "error"); }
                    }} style={{
                      background: "transparent", border: `1px solid ${COLORS.gold}44`, color: COLORS.gold,
                      padding: "6px 12px", borderRadius: 6, fontSize: TYPE.xs, fontFamily: FONTS.body,
                      cursor: "pointer", width: "100%", marginBottom: 8,
                    }}>Manage billing</button>
                  )}
                  <button onClick={handleSignOut} style={{
                    background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.textDim,
                    padding: "6px 12px", borderRadius: 6, fontSize: TYPE.xs, fontFamily: FONTS.body,
                    cursor: "pointer", width: "100%",
                  }}>Sign Out</button>
                </>
              ) : (
                <>
                  <div style={{ color: COLORS.textDim, marginBottom: 6 }}>
                    {profile.name ? `Welcome, ${profile.name}` : "Sign in to save your work"}
                  </div>
                  <button onClick={() => { setAuthMode("signin"); setShowAuthModal(true); }} style={{
                    background: `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.goldLight})`,
                    border: "none", color: COLORS.bg, padding: "8px 12px", borderRadius: 6,
                    fontSize: TYPE.xs, fontWeight: 700, fontFamily: FONTS.body, cursor: "pointer", width: "100%",
                  }}>Sign In / Sign Up</button>
                </>
              )}
            </div>
          </nav>
    </>
  );
}
