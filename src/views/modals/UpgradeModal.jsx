import { useState } from "react";
import { useApp } from "../../AppContext.js";
import { authFetch } from "../../lib/api.js";
import { COLORS, FONTS, TYPE } from "../../ui/theme.js";
import { Modal, Button } from "../../ui/components.jsx";
import { track } from "../../analytics.js";
import { PLANS, FREE_LIMITS } from "../../lib/plans.js";

export default function UpgradeModal() {
  const { profile, matchResults, upgradeReason, showUpgradeModal, setShowUpgradeModal, checkoutLoading, handleCheckout, notify, parseDeadline, authUser, setAuthMode, setShowAuthModal } = useApp();
  const [parentLink, setParentLink] = useState(null);
  const [linkBusy, setLinkBusy] = useState(false);
  return (
    <>
      {/* UPGRADE MODAL — shows the student's own live matches, both plans, and a
          no-data link they can send to a parent (the payer is often not the student). */}
      <Modal open={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} labelledBy="upgrade-title" width={480}>
        {(() => {
          const kind = upgradeReason?.kind;
          const resets = upgradeReason?.resetsOn ? new Date(upgradeReason.resetsOn).toLocaleDateString("en-US", { month: "long", day: "numeric" }) : null;
          const live = matchResults.filter(m => { const d = parseDeadline(m.deadline).days; return d !== null && d >= 0; })
            .sort((a, b) => parseDeadline(a.deadline).days - parseDeadline(b.deadline).days).slice(0, 3);
          // A private, 7-day link to a page where a parent can read what the plan
          // does and pay for it. The page shows nothing about the student.
          const sendToParent = async () => {
            if (!authUser) { setShowUpgradeModal(false); setAuthMode("signup"); setShowAuthModal(true); notify("Create a free account first so the plan can be added to it.", "info"); return; }
            setLinkBusy(true);
            try {
              const resp = await authFetch("/api/parent-pay", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "create" }),
              });
              const data = await resp.json();
              if (!resp.ok || !data.url) { notify(data.error || "Couldn't create the link. Please try again.", "error"); return; }
              setParentLink(data.url);
              track("parent_link_created");
              const text = "Could you look at MeritLaunch for my scholarship applications? This link explains the plans and lets you pay for my account:";
              try {
                if (navigator.share) { await navigator.share({ title: "MeritLaunch for my scholarships", text, url: data.url }); return; }
                await navigator.clipboard.writeText(`${text} ${data.url}`);
                notify("Link copied. Send it to a parent or guardian.", "success");
              } catch { /* the link is shown below to copy by hand */ }
            } catch { notify("Couldn't create the link. Please try again.", "error"); }
            finally { setLinkBusy(false); }
          };
          return (
            <>
              <h2 id="upgrade-title" style={{ fontSize: TYPE["2xl"], fontWeight: 400, marginBottom: 8 }}>
                {kind === "letter" ? `You've used your ${FREE_LIMITS.lettersPerMonth} free letters this month` : kind === "match" ? `You've used your ${FREE_LIMITS.matchesPerMonth} free match runs this month` : "Keep going with Premium"}
              </h2>
              <p style={{ fontSize: TYPE.base, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 16 }}>
                {resets ? `Your free allowance resets on ${resets}. ` : ""}Your profile, matches, drafts and tracker all stay put either way.
              </p>
              {live.length > 0 && (
                <div style={{ textAlign: "left", background: COLORS.surface, borderRadius: 12, padding: "14px 16px", marginBottom: 16, border: `1px solid ${COLORS.border}` }}>
                  <div style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 8 }}>Your next deadlines that still need a letter</div>
                  {live.map(m => (
                    <div key={m.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: TYPE.sm, fontFamily: FONTS.body, padding: "4px 0" }}>
                      <span style={{ color: COLORS.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                      <span style={{ color: parseDeadline(m.deadline).color, flexShrink: 0 }}>{parseDeadline(m.deadline).label}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }} className="two-col">
                {PLANS.filter(pl => pl.id !== "free").map(pl => (
                  <div key={pl.id} style={{ background: COLORS.surface, borderRadius: 12, padding: "14px 12px", border: `1px solid ${pl.highlight ? COLORS.gold + "66" : COLORS.border}`, textAlign: "left" }}>
                    <div style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: pl.highlight ? COLORS.gold : COLORS.teal, fontWeight: 600 }}>{pl.name}</div>
                    <div style={{ fontSize: TYPE["2xl"], margin: "4px 0" }}>{pl.price}<span style={{ fontSize: TYPE.xs, color: COLORS.textMuted, fontFamily: FONTS.body }}>{pl.period}</span></div>
                    <div style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.5, marginBottom: 10 }}>{pl.tagline}</div>
                    <Button variant={pl.highlight ? "primary" : "secondary"} disabled={checkoutLoading}
                      onClick={() => { setShowUpgradeModal(false); handleCheckout(pl.id); }}
                      style={{ width: "100%", justifyContent: "center", fontSize: TYPE.sm, padding: "10px 12px" }}>
                      {checkoutLoading ? "Loading..." : pl.cta}
                    </Button>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <Button variant="ghost" onClick={sendToParent} disabled={linkBusy} style={{ fontSize: TYPE.sm }}>{linkBusy ? "Creating link..." : "Ask a parent to pay"}</Button>
                <Button variant="ghost" onClick={() => setShowUpgradeModal(false)} style={{ fontSize: TYPE.sm }}>Not now</Button>
              </div>
              {parentLink && (
                <div style={{ marginTop: 14, textAlign: "left", fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6 }}>
                  <label htmlFor="parent-link">Your parent link (works for 7 days, shows nothing about you):</label>
                  <input id="parent-link" readOnly value={parentLink} onFocus={e => e.target.select()}
                    style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.fieldBorder}`, background: COLORS.surface, color: COLORS.text, fontFamily: FONTS.mono, fontSize: TYPE.xs, boxSizing: "border-box" }} />
                </div>
              )}
            </>
          );
        })()}
      </Modal>
    </>
  );
}
