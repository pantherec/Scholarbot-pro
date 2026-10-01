import { useApp } from "../../AppContext.js";
import { COLORS, FONTS, TYPE } from "../../ui/theme.js";
import { Modal, AppIcon } from "../../ui/components.jsx";
import { PRIVACY_SECTIONS, TERMS_SECTIONS, LAST_UPDATED } from "../../legalContent.js";

export default function LegalModal() {
  const { legalModal, setLegalModal } = useApp();
  return (
    <>
      {/* LEGAL MODAL (Privacy Policy / Terms of Service) */}
      <Modal open={!!legalModal} onClose={() => setLegalModal(null)} labelledBy="legal-title" width={660} align="left">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, gap: 12 }}>
              <div>
                <div style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, letterSpacing: 3, color: COLORS.gold, textTransform: "uppercase", marginBottom: 4 }}>MeritLaunch</div>
                <h2 id="legal-title" style={{ fontSize: TYPE["2xl"], fontWeight: 400, margin: 0 }}>
                  {legalModal === "privacy" ? "Privacy Policy" : "Terms of Service"}
                </h2>
                <p style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textDim, marginTop: 6 }}>Last updated {LAST_UPDATED}</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setLegalModal(null)} style={{
                background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", padding: 8, minWidth: 40, minHeight: 40,
              }}><AppIcon name="close" size={20} /></button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              {(legalModal === "privacy" ? PRIVACY_SECTIONS : TERMS_SECTIONS).map((section, i) => (
                <div key={i}>
                  <h3 style={{ fontSize: TYPE.base, fontFamily: FONTS.body, fontWeight: 600, color: COLORS.teal, marginBottom: 8 }}>
                    {section.heading}
                  </h3>
                  <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                    {section.body.map((line, j) => (
                      <li key={j} style={{ fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.6 }}>
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <p style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textDim, marginTop: 28, paddingTop: 16, borderTop: `1px solid ${COLORS.border}` }}>
              This is general information, not legal advice, and may be updated as MeritLaunch changes.
            </p>
      </Modal>
    </>
  );
}
