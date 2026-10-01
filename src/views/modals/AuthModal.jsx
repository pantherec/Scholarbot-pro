import { useApp } from "../../AppContext.js";
import { COLORS, FONTS, TYPE } from "../../ui/theme.js";
import { BrandMark, Modal, LinkButton, Button } from "../../ui/components.jsx";

export default function AuthModal() {
  const { showAuthModal, setShowAuthModal, authMode, setAuthMode, setLegalModal, authEmail, setAuthEmail, authPassword, setAuthPassword, newPassword, setNewPassword, confirmPassword, setConfirmPassword, authError, setAuthError, authSubmitting, authDob, setAuthDob, handleSignUp, handleSignIn, handleForgotPassword, handleUpdatePassword } = useApp();
  return (
    <>
      {/* AUTH MODAL */}
      <Modal open={showAuthModal} onClose={() => setShowAuthModal(false)} locked={authMode === "reset"} labelledBy="auth-title" width={400}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><BrandMark size={30} /></div>
              <h2 id="auth-title" style={{ fontSize: TYPE["2xl"], fontWeight: 400, marginBottom: 6 }}>
                {authMode === "signup" ? "Create your free account" : authMode === "forgot" ? "Reset your password" : authMode === "reset" ? "Set a new password" : "Welcome back"}
              </h2>
              <p style={{ fontSize: TYPE.sm, fontFamily: FONTS.body, color: COLORS.textMuted }}>
                {authMode === "signup" ? "Save your matches, drafts and deadlines" : authMode === "forgot" ? "We'll email you a reset link" : authMode === "reset" ? "Choose a new password for your account" : "Sign in to pick up where you left off"}
              </p>
            </div>

            {authError && (
              <div role="alert" style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: TYPE.sm, fontFamily: FONTS.body, background: COLORS.pinkDim, color: COLORS.text, border: `1px solid ${COLORS.pink}66`, textAlign: "left" }}>
                {authError}
              </div>
            )}

            <form onSubmit={e => { e.preventDefault(); (authMode === "reset" ? handleUpdatePassword : authMode === "forgot" ? handleForgotPassword : authMode === "signup" ? handleSignUp : handleSignIn)(); }}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {authMode === "reset" ? (
                <>
                  <div>
                    <label htmlFor="auth-newpw" style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted, display: "block", marginBottom: 6, textAlign: "left" }}>New password (at least 6 characters)</label>
                    <input id="auth-newpw" type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ padding: "12px 16px", borderRadius: 10, fontSize: TYPE.base, fontFamily: FONTS.body, background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, color: COLORS.text, outline: "none", width: "100%", boxSizing: "border-box" }}/>
                  </div>
                  <div>
                    <label htmlFor="auth-confirmpw" style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted, display: "block", marginBottom: 6, textAlign: "left" }}>Confirm new password</label>
                    <input id="auth-confirmpw" type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={{ padding: "12px 16px", borderRadius: 10, fontSize: TYPE.base, fontFamily: FONTS.body, background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, color: COLORS.text, outline: "none", width: "100%", boxSizing: "border-box" }}/>
                  </div>
                  <Button type="submit" disabled={authSubmitting || !newPassword || !confirmPassword}
                    style={{ width: "100%", justifyContent: "center", fontSize: TYPE.md, padding: "14px 24px", marginTop: 4 }}>
                    {authSubmitting ? "Please wait..." : "Update password"}
                  </Button>
                </>
              ) : (
                <>
                  <div>
                    <label htmlFor="auth-email" style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted, display: "block", marginBottom: 6, textAlign: "left" }}>Email</label>
                    <input id="auth-email" type="email" autoComplete="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} style={{ padding: "12px 16px", borderRadius: 10, fontSize: TYPE.base, fontFamily: FONTS.body, background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, color: COLORS.text, outline: "none", width: "100%", boxSizing: "border-box" }}/>
                  </div>
                  {authMode !== "forgot" && (
                    <div>
                      <label htmlFor="auth-password" style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted, display: "block", marginBottom: 6, textAlign: "left" }}>Password{authMode === "signup" ? " (at least 6 characters)" : ""}</label>
                      <input id="auth-password" type="password" autoComplete={authMode === "signup" ? "new-password" : "current-password"} value={authPassword} onChange={e => setAuthPassword(e.target.value)} style={{ padding: "12px 16px", borderRadius: 10, fontSize: TYPE.base, fontFamily: FONTS.body, background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, color: COLORS.text, outline: "none", width: "100%", boxSizing: "border-box" }}/>
                    </div>
                  )}
                  {authMode === "signup" && (
                    <div>
                      <label htmlFor="auth-dob" style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted, display: "block", marginBottom: 6, textAlign: "left" }}>Date of birth (only to confirm you're 13 or older; never stored)</label>
                      <input id="auth-dob" type="date" value={authDob} onChange={e => setAuthDob(e.target.value)} max={new Date().toISOString().split("T")[0]} style={{ padding: "12px 16px", borderRadius: 10, fontSize: TYPE.base, fontFamily: FONTS.body, background: COLORS.surface, border: `1px solid ${COLORS.fieldBorder}`, color: COLORS.text, outline: "none", width: "100%", boxSizing: "border-box" }}/>
                    </div>
                  )}
                  {authMode === "signup" && (
                    <p style={{ fontSize: TYPE.xs, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 1.5, margin: 0, textAlign: "left" }}>
                      By creating an account, you agree to our{" "}
                      <LinkButton onClick={() => setLegalModal("terms")}>Terms of Service</LinkButton>
                      {" "}and{" "}
                      <LinkButton onClick={() => setLegalModal("privacy")}>Privacy Policy</LinkButton>.
                    </p>
                  )}
                  <Button type="submit" disabled={authSubmitting || !authEmail}
                    style={{ width: "100%", justifyContent: "center", fontSize: TYPE.md, padding: "14px 24px", marginTop: 4 }}>
                    {authSubmitting ? "Please wait..." : authMode === "signup" ? "Create account" : authMode === "forgot" ? "Send reset link" : "Sign in"}
                  </Button>
                </>
              )}
            </form>

            <div style={{ marginTop: 20, textAlign: "center", fontFamily: FONTS.body, fontSize: TYPE.sm, color: COLORS.textMuted, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              {authMode === "signin" && (
                <>
                  <LinkButton onClick={() => { setAuthMode("forgot"); setAuthError(""); }}>Forgot password?</LinkButton>
                  <span aria-hidden="true">|</span>
                  <span>No account? <LinkButton onClick={() => { setAuthMode("signup"); setAuthError(""); }}>Sign up</LinkButton></span>
                </>
              )}
              {authMode === "signup" && (
                <span>Already have an account? <LinkButton onClick={() => { setAuthMode("signin"); setAuthError(""); setAuthDob(""); }}>Sign in</LinkButton></span>
              )}
              {authMode === "forgot" && (
                <LinkButton onClick={() => { setAuthMode("signin"); setAuthError(""); }}>Back to sign in</LinkButton>
              )}
              {authMode === "reset" && (
                <span style={{ fontSize: TYPE.xs }}>Enter your new password above to finish the reset.</span>
              )}
            </div>
      </Modal>
    </>
  );
}
