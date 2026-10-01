import { useEffect, useState } from "react";
import { useApp } from "../AppContext.js";
import { COLORS, FONTS, TYPE } from "../ui/theme.js";
import { Button, BrandMark, AppIcon, GlowCard } from "../ui/components.jsx";
import { PLANS } from "../lib/plans.js";
import { track } from "../analytics.js";

// The page a parent opens from a student's "Ask a parent to pay" link.
// It deliberately shows nothing about the student (no name, school or profile):
// the student chose to send it, and the parent only needs to know what they buy.
export default function ParentPay() {
  const { setLegalModal } = useApp();
  const token = (typeof window !== "undefined" ? window.location.pathname.split("/pay/")[1] || "" : "").replace(/\/+$/, "");
  const paid = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("status") === "paid";
  const [state, setState] = useState(paid ? "paid" : "loading"); // loading | ready | invalid | active | paid | error
  const [plan, setPlan] = useState("premium");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (paid) { track("parent_checkout_completed"); return; }
    let cancelled = false;
    fetch(`/api/parent-pay?token=${encodeURIComponent(token)}`)
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (cancelled) return;
        if (!ok || !d.valid) setState("invalid");
        else setState(d.alreadyActive ? "active" : "ready");
      })
      .catch(() => !cancelled && setState("error"));
    track("parent_page_viewed");
    return () => { cancelled = true; };
  }, []);

  const checkout = async () => {
    setBusy(true); setError("");
    track("parent_checkout_started", { plan });
    try {
      const resp = await fetch("/api/parent-pay", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkout", token, plan }),
      });
      const data = await resp.json();
      if (resp.ok && data.url) { window.location.href = data.url; return; }
      setError(data.error || "Couldn't start checkout. Please try again.");
    } catch { setError("Couldn't reach our server. Check your connection and try again."); }
    setBusy(false);
  };

  const paidPlans = PLANS.filter(p => p.id !== "free");
  const text = { fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.65 };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text }}>
      <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 24px", borderBottom: `1px solid ${COLORS.border}` }}>
        <BrandMark size={28} />
        <span style={{ fontSize: TYPE.sm, fontFamily: FONTS.body, letterSpacing: 3, color: COLORS.gold, textTransform: "uppercase" }}>MeritLaunch</span>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px 80px" }}>
        {state === "loading" && <p style={{ ...text, fontSize: TYPE.md }} aria-busy="true">Checking your link...</p>}

        {state === "paid" && (
          <GlowCard hover={false} glow={COLORS.teal} style={{ padding: "36px 32px", textAlign: "center" }}>
            <AppIcon name="check" size={40} color={COLORS.teal} style={{ margin: "0 auto 14px" }} />
            <h1 style={{ fontSize: TYPE["3xl"], fontWeight: 400, marginBottom: 10 }}>Thank you. The plan is on its way.</h1>
            <p style={{ ...text, fontSize: TYPE.base }}>
              It's added to your student's account within a minute or two. Stripe emails you a receipt.
              They can manage or cancel billing anytime from their dashboard.
            </p>
          </GlowCard>
        )}

        {(state === "invalid" || state === "error") && (
          <GlowCard hover={false} style={{ padding: "36px 32px", textAlign: "center" }}>
            <h1 style={{ fontSize: TYPE["2xl"], fontWeight: 400, marginBottom: 10 }}>
              {state === "invalid" ? "This link has expired or was already used" : "We couldn't load this page"}
            </h1>
            <p style={{ ...text, fontSize: TYPE.base }}>
              {state === "invalid"
                ? "Links work for 7 days and only once. Ask your student to send a new one from MeritLaunch."
                : "Please refresh the page in a moment."}
            </p>
          </GlowCard>
        )}

        {state === "active" && (
          <GlowCard hover={false} glow={COLORS.teal} style={{ padding: "36px 32px", textAlign: "center" }}>
            <h1 style={{ fontSize: TYPE["2xl"], fontWeight: 400, marginBottom: 10 }}>This account already has a plan</h1>
            <p style={{ ...text, fontSize: TYPE.base }}>There's nothing to pay for right now.</p>
          </GlowCard>
        )}

        {state === "ready" && (
          <>
            <div style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, letterSpacing: 2, textTransform: "uppercase", color: COLORS.gold, marginBottom: 10 }}>For a parent or guardian</div>
            <h1 style={{ fontSize: TYPE["4xl"], fontWeight: 400, lineHeight: 1.15, marginBottom: 14, textWrap: "balance" }}>
              Your student asked you to look at MeritLaunch
            </h1>
            <p style={{ ...text, fontSize: TYPE.md, marginBottom: 32 }}>
              MeritLaunch helps students find scholarships they're actually eligible for and draft application letters from their own real experiences.
              Here's what you'd be paying for, so you can decide.
            </p>

            <section aria-labelledby="pp-what" style={{ marginBottom: 32 }}>
              <h2 id="pp-what" style={{ fontSize: TYPE.xl, fontWeight: 400, marginBottom: 12 }}>What your student gets</h2>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  "Matches checked for eligibility first (state, citizenship, GPA, heritage), with every deadline tracked.",
                  "Letter drafts built only from what they've told us. Nothing is invented, and they revise each one into their own words.",
                  "An outline-only option for scholarships that limit AI help. Students are responsible for following each scholarship's rules.",
                  "Deadline reminder emails, with an unsubscribe link in every one.",
                ].map(item => (
                  <li key={item} style={{ display: "flex", gap: 10, fontSize: TYPE.base, ...text }}>
                    <AppIcon name="check" size={16} color={COLORS.teal} style={{ marginTop: 3 }} />{item}
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="pp-plans" style={{ marginBottom: 24 }}>
              <h2 id="pp-plans" style={{ fontSize: TYPE.xl, fontWeight: 400, marginBottom: 12 }}>Choose a plan</h2>
              <div role="radiogroup" aria-labelledby="pp-plans" className="two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {paidPlans.map(p => {
                  const on = plan === p.id;
                  return (
                    <label key={p.id} style={{
                      display: "block", cursor: "pointer", padding: "18px 18px", borderRadius: 14,
                      background: COLORS.card, border: `2px solid ${on ? COLORS.gold : COLORS.border}`,
                    }}>
                      <input type="radio" name="pp-plan" value={p.id} checked={on} onChange={() => setPlan(p.id)} className="sr-only" />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontSize: TYPE.base, fontFamily: FONTS.body, fontWeight: 600, color: on ? COLORS.gold : COLORS.text }}>{p.name}</span>
                        {on && <AppIcon name="check" size={18} color={COLORS.gold} />}
                      </div>
                      <div style={{ fontSize: TYPE["2xl"], margin: "6px 0 4px" }}>{p.price}<span style={{ fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.textMuted }}>{p.period}</span></div>
                      <div style={{ fontSize: TYPE.sm, ...text }}>{p.tagline}</div>
                      <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: TYPE.sm, ...text }}>
                        {p.features.filter(f => !f.endsWith("plus:")).map(f => <li key={f}>{f}</li>)}
                      </ul>
                    </label>
                  );
                })}
              </div>
            </section>

            {error && <div role="alert" style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 14, fontSize: TYPE.sm, fontFamily: FONTS.body, background: COLORS.pinkDim, color: COLORS.text, border: `1px solid ${COLORS.pink}66` }}>{error}</div>}

            <Button onClick={checkout} disabled={busy} style={{ fontSize: TYPE.md, padding: "14px 32px" }}>
              {busy ? "Opening secure checkout..." : `Continue to secure checkout (${paidPlans.find(p => p.id === plan)?.price})`}
            </Button>
            <p style={{ ...text, fontSize: TYPE.sm, marginTop: 12 }}>
              Payment is handled by Stripe. Your card details never reach MeritLaunch.
              {plan === "premium" ? " Premium renews monthly and can be canceled anytime." : " The Season Pass is one payment and does not renew."}
            </p>

            <section aria-labelledby="pp-privacy" style={{ marginTop: 36, paddingTop: 24, borderTop: `1px solid ${COLORS.border}` }}>
              <h2 id="pp-privacy" style={{ fontSize: TYPE.lg, fontWeight: 400, marginBottom: 10 }}>Our promise about student data</h2>
              <p style={{ ...text, fontSize: TYPE.sm }}>
                MeritLaunch is for students 13 and older. We collect only what matching and drafting need, we never sell or share student data
                for advertising, and this page shows you nothing from your student's profile. Built by a parent who's been through scholarship season.
              </p>
              <p style={{ ...text, fontSize: TYPE.sm, marginTop: 10, display: "flex", gap: 16 }}>
                <button type="button" onClick={() => setLegalModal("privacy")} style={{ background: "none", border: "none", color: COLORS.gold, cursor: "pointer", padding: "8px 0", font: "inherit", textDecoration: "underline" }}>Privacy Policy</button>
                <button type="button" onClick={() => setLegalModal("terms")} style={{ background: "none", border: "none", color: COLORS.gold, cursor: "pointer", padding: "8px 0", font: "inherit", textDecoration: "underline" }}>Terms of Service</button>
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
