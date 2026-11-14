import { useState } from "react";
import { useApp } from "../AppContext.js";
import { COLORS, FONTS, TYPE } from "../ui/theme.js";
import { GlowCard, Button } from "../ui/components.jsx";
import { DRAFT_RETENTION_DAYS } from "../lib/plans.js";

// What the account holds, and the two ways to remove it without emailing us.
export default function YourData() {
  const { authUser, deleteMyWork, deleteMyAccount, isPremium } = useApp();
  const [busy, setBusy] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [asking, setAsking] = useState(false);
  if (!authUser) return null;
  const text = { fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6, margin: 0 };
  return (
    <GlowCard hover={false} style={{ marginTop: 24 }}>
      <h3 style={{ fontSize: TYPE.md, fontWeight: 400, marginBottom: 8 }}>Your data</h3>
      <p style={{ ...text, marginBottom: 10 }}>
        Your account keeps your profile, saved letters, drafts, practice answers, resume and brag sheet text, voice notes, writing styles and tracked scholarships, so they follow you to any device.
        Phone numbers, emails and street addresses are removed from uploads before they are kept. Drafts you never saved are deleted after {DRAFT_RETENTION_DAYS} days.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <Button variant="secondary" disabled={!!busy} onClick={async () => {
          if (!window.confirm("Delete your saved letters, drafts, practice answers, resume and brag sheet text, voice notes, writing styles and tracked scholarships?\n\nYour profile and account stay. This cannot be undone.")) return;
          setBusy("work"); await deleteMyWork(); setBusy("");
        }} style={{ fontSize: TYPE.sm, padding: "10px 16px" }}>
          {busy === "work" ? "Deleting..." : "Delete my saved work"}
        </Button>
        <Button variant="danger" disabled={!!busy} onClick={() => setAsking(a => !a)} aria-expanded={asking} style={{ fontSize: TYPE.sm, padding: "10px 16px" }}>
          Delete my account
        </Button>
      </div>
      {asking && (
        <div style={{ marginTop: 14, padding: "14px 16px", borderRadius: 10, border: `1px solid ${COLORS.pink}66`, background: COLORS.pinkDim }}>
          <p style={{ ...text, color: COLORS.text, marginBottom: 10 }}>
            This removes your account and everything in it: profile, letters, drafts, practice answers, uploads and tracked scholarships.
            {isPremium ? " Any Premium subscription is cancelled first, so you are not billed again. A Season Pass is not refunded automatically." : ""} It cannot be undone.
          </p>
          <label htmlFor="delete-confirm" style={{ ...text, display: "block", marginBottom: 6 }}>Type DELETE to confirm</label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input id="delete-confirm" value={confirmText} onChange={e => setConfirmText(e.target.value)} autoComplete="off"
              style={{ padding: "10px 14px", borderRadius: 8, fontSize: TYPE.base, fontFamily: FONTS.body, background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, color: COLORS.text, width: 160 }} />
            <Button variant="danger" disabled={confirmText.trim() !== "DELETE" || !!busy} onClick={async () => { setBusy("account"); await deleteMyAccount(); setBusy(""); }}
              style={{ fontSize: TYPE.sm, padding: "10px 16px" }}>
              {busy === "account" ? "Deleting..." : "Delete everything"}
            </Button>
          </div>
        </div>
      )}
    </GlowCard>
  );
}
