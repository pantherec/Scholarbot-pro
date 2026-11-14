import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  initAnalytics,
  identifyUser,
  resetUser,
  trackSignupStarted,
  trackSignupCompleted,
  trackLetterGenerated,
  trackError,
  track,
} from "./analytics.js";
import { PRIVACY_SECTIONS, TERMS_SECTIONS, LAST_UPDATED } from "./legalContent.js";
import { statesOf, rankMatches } from "./lib/matching.js";
import { friendlyAuthError, passwordProblem, isRepeatSignUp, authLinkProblem } from "./lib/authErrors.js";
import { setDoc, docFileNames } from "./lib/studentDocs.js";
import { parseDeadlineDate as parseDeadlineDateLib, deadlineInfo, compareByDeadline } from "./lib/deadline.js";
import { PLANS, FREE_LIMITS, PAID_LIMITS } from "./lib/plans.js";
import { computeCatalogStats, formatAwardTotal } from "./lib/catalogStats.js";
import { createSseParser } from "./lib/sse.js";
import { COLORS, FONTS, TYPE } from "./ui/theme.js";
import { supabase, withTimeout, clearStaleSupabaseSession, clearStudentLocalData, authFetch, STRIPE_PRICES, fetchScholarshipsFromSupabase, saveProfileToSupabase, loadProfileFromSupabase, saveLetterToSupabase, loadLettersFromSupabase, store } from "./lib/api.js";
import { DEFAULT_SCHOLARSHIP_DB } from "./data/catalog.js";
import { isUnder13, PROFILE_QUESTIONS, DEFAULT_TEMPLATES, normalizeProfile } from "./data/profile.js";
import { Badge, AppIcon } from "./ui/components.jsx";
import { VIEW_PATHS, viewFromPath, titleFor } from "./routes.js";
import { AppContext } from "./AppContext.js";
import GlobalStyles from "./ui/GlobalStyles.jsx";
import { readFileAsText } from "./lib/files.js";
import Landing from "./views/Landing.jsx";
const ParentPay = lazy(() => import("./views/ParentPay.jsx"));
import Sidebar from "./views/Sidebar.jsx";
import AuthModal from "./views/modals/AuthModal.jsx";
import LegalModal from "./views/modals/LegalModal.jsx";
import UpgradeModal from "./views/modals/UpgradeModal.jsx";
const Dashboard = lazy(() => import("./views/Dashboard.jsx"));
const AgeBlocked = lazy(() => import("./views/AgeBlocked.jsx"));
const ProfileBuilder = lazy(() => import("./views/ProfileBuilder.jsx"));
const VoiceProfile = lazy(() => import("./views/VoiceProfile.jsx"));
const Browse = lazy(() => import("./views/Browse.jsx"));
const Matches = lazy(() => import("./views/Matches.jsx"));
const PracticeAnswers = lazy(() => import("./views/PracticeAnswers.jsx"));
const LetterWriter = lazy(() => import("./views/LetterWriter.jsx"));
const WritingStyles = lazy(() => import("./views/WritingStyles.jsx"));
const SavedLetters = lazy(() => import("./views/SavedLetters.jsx"));
const Deadlines = lazy(() => import("./views/Deadlines.jsx"));

export { ErrorBoundary } from "./ui/components.jsx";

export default function MeritLaunch() {
  const [view, setViewState] = useState(() => (typeof window !== "undefined" ? viewFromPath(window.location.pathname) : "landing"));
  const setView = useCallback((v) => {
    setViewState(v);
    if (typeof document !== "undefined") document.title = titleFor(v);
    const path = VIEW_PATHS[v] || "/";
    if (typeof window !== "undefined" && window.location.pathname !== path) {
      window.history.pushState({ view: v }, "", path);
    }
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }, []);
  // Titles and canonical follow the view on first load too, not only on setView.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = titleFor(view);
    const link = document.querySelector('link[rel="canonical"]');
    if (link) link.setAttribute("href", `https://meritlaunch.com${view === "landing" ? "/" : (VIEW_PATHS[view] || window.location.pathname)}`);
  }, [view]);
  useEffect(() => {
    const onPop = () => { const v = viewFromPath(window.location.pathname); setViewState(v); document.title = titleFor(v); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(max-width: 768px)").matches);
  const [reducedMotion] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia?.("(max-width: 768px)");
    if (!mq) return;
    const onChange = () => setIsMobile(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange); else mq.addListener(onChange);
    return () => { if (mq.removeEventListener) mq.removeEventListener("change", onChange); else mq.removeListener(onChange); };
  }, []);
  const [profile, setProfile] = useState({});
  const [bragSheet, setBragSheet] = useState(() => store.get("scholarbot-brag-sheet") || "");
  // Letter Gen scholarship picker (searchable combobox over the full database)
  const [scholarshipQuery, setScholarshipQuery] = useState("");
  const [scholarshipPickerOpen, setScholarshipPickerOpen] = useState(false);
  const [scholarshipDB, setScholarshipDB] = useState(DEFAULT_SCHOLARSHIP_DB);
  const [dbSource, setDbSource] = useState("built-in");
  const [searchQuery, setSearchQuery] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [filterNeedBased, setFilterNeedBased] = useState("all");
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterState, setFilterState] = useState("all");
  // Expired scholarships stay in the catalog and are visible by default — most are
  // annual and come back, and a monthly server job (api/refresh-expired.js) re-checks
  // them for new deadlines. Sorting keeps them below live listings; the toggle hides
  // them entirely for students who only want what's open right now.
  const [showExpired, setShowExpired] = useState(true);
  const [matchResults, setMatchResults] = useState(() => store.get("scholarbot-matches") || []);
  const [browseLimit, setBrowseLimit] = useState(24);
  const [essayPrompt, setEssayPrompt] = useState("");
  const [wordLimit, setWordLimit] = useState("");
  const [aiPolicy, setAiPolicy] = useState(""); // "" until the student answers | allowed | unsure
  // Citizenship status and financial need reach a draft only when the student
  // turns this on (or the scholarship itself asks). Off for every new draft.
  const [includeSensitive, setIncludeSensitive] = useState(false);
  const [pickerActive, setPickerActive] = useState(0);
  const [upgradeReason, setUpgradeReason] = useState(null); // { kind, resetsOn }
  const [emailOptOut, setEmailOptOut] = useState(false);
  const [selectedScholarship, setSelectedScholarship] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(DEFAULT_TEMPLATES[0]);
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [generatedLetter, setGeneratedLetter] = useState(() => store.get("scholarbot-draft") || "");
  const [generatingLetter, setGeneratingLetter] = useState(false);
  const [generatedProfile, setGeneratedProfile] = useState("");
  const [savedLetters, setSavedLetters] = useState([]);
  const [trackedApps, setTrackedApps] = useState(() => {
    try { return JSON.parse(localStorage.getItem("scholarbot-tracked-apps")) || []; } catch { return []; }
  });
  const [appAnswers, setAppAnswers] = useState({});
  const [notification, setNotification] = useState(null);
  const [deadlineAlerts, setDeadlineAlerts] = useState([]);
  const [bragSheetFileName, setBragSheetFileName] = useState(() => store.get("scholarbot-brag-sheet-name") || "");
  const [bragSheetUploading, setBragSheetUploading] = useState(false);
  // The draft asks before it invents: questions the model wants answered for
  // this scholarship + style (null until asked), the student's answers, and the
  // stage of the stream so the page can show real progress and real failures.
  const [draftQuestions, setDraftQuestions] = useState(null);
  const [draftAnswers, setDraftAnswers] = useState({}); // id -> { status: "answered" | "confirmed" | "skipped", text }
  const [askingQuestions, setAskingQuestions] = useState(false);
  const [draftStage, setDraftStage] = useState(""); // "" | "sending" | "waiting" | "writing"
  const [draftError, setDraftError] = useState(null); // { reason, message } when a draft stopped early
  const [profileStep, setProfileStep] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const bragFileRef = useRef(null);
  const [scholarshipInputMode, setScholarshipInputMode] = useState("database");
  const [customScholarshipText, setCustomScholarshipText] = useState("");
  const [customScholarshipName, setCustomScholarshipName] = useState("");
  const [scholarshipUrl, setScholarshipUrl] = useState("");
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [uploadedScholarshipName, setUploadedScholarshipName] = useState("");
  const scholarshipFileRef = useRef(null);

  // Auth state
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  // Which account's cloud profile has loaded (gates cloud profile saves), and
  // which one is loading now (so duplicate session events don't reload it).
  const cloudReadyRef = useRef(null);
  const restoringRef = useRef(null);
  // Which account's match list was rebuilt locally after sign-in (see below).
  const autoMatchedRef = useRef(null);
  // The page region; focused after each in-app route change so screen readers
  // hear where they landed instead of staying on the sidebar button.
  const mainRef = useRef(null);
  const firstViewRef = useRef(true);
  useEffect(() => {
    if (firstViewRef.current) { firstViewRef.current = false; return; }
    // While a lazy view's chunk loads, Suspense hides <main> and React detaches
    // its ref, so the first try sees nothing; keep trying until it's back.
    let tries = 12;
    const focusMain = () => {
      const el = mainRef.current;
      if (el) el.focus({ preventScroll: true });
      if ((!el || document.activeElement !== el) && --tries > 0) timer = setTimeout(focusMain, 150);
    };
    let timer = setTimeout(focusMain, 0);
    return () => clearTimeout(timer);
  }, [view]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState("signin"); // signin | signup | forgot | reset
  const [legalModal, setLegalModal] = useState(null); // null | "privacy" | "terms"
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState(""); // success text shown INSIDE the modal (toasts sit behind its backdrop)
  const [unconfirmedEmail, setUnconfirmedEmail] = useState(""); // set when sign-in fails with "Email not confirmed"
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authDob, setAuthDob] = useState(""); // COPPA: used only for age check, never stored
  const [usageResetsOn, setUsageResetsOn] = useState(null);
  const [userSubscription, setUserSubscription] = useState("free"); // free | premium | seasonal
  const [monthlyLettersUsed, setMonthlyLettersUsed] = useState(0);
  const [monthlyOutlinesUsed, setMonthlyOutlinesUsed] = useState(0);
  const [monthlyMatchesUsed, setMonthlyMatchesUsed] = useState(0);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Feature gating. Display only: the server (api/usage.js, api/generate-stream.js)
  // enforces the same limits from src/lib/plans.js / api/_shared/usage.js.
  const PRO_LIMITS = PAID_LIMITS;
  const isPremium = userSubscription === "premium" || userSubscription === "seasonal";
  const canMatch = isPremium || monthlyMatchesUsed < FREE_LIMITS.matchesPerMonth;
  const canGenerateLetter = isPremium
    ? monthlyLettersUsed < PRO_LIMITS.lettersPerMonth
    : monthlyLettersUsed < FREE_LIMITS.lettersPerMonth;
  const remainingMatches = isPremium ? "Unlimited" : Math.max(0, FREE_LIMITS.matchesPerMonth - monthlyMatchesUsed);
  const remainingOutlines = isPremium ? null : Math.max(0, FREE_LIMITS.outlinesPerMonth - monthlyOutlinesUsed);
  const remainingLetters = isPremium
    ? Math.max(0, PRO_LIMITS.lettersPerMonth - monthlyLettersUsed)
    : Math.max(0, FREE_LIMITS.lettersPerMonth - monthlyLettersUsed);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [usageLoaded, setUsageLoaded] = useState(false);

  // Plan + usage come from the server, which owns the counters.
  const applyUsage = (u) => {
    if (!u || u.error) return;
    setUserSubscription(u.plan || "free");
    setUsageLoaded(true);
    setMonthlyLettersUsed(u.lettersUsed || 0);
    setMonthlyOutlinesUsed(u.outlinesUsed || 0);
    setMonthlyMatchesUsed(u.matchesUsed || 0);
    setUsageResetsOn(u.resetsOn || null);
  };
  const refreshUsage = useCallback(async () => {
    try {
      const resp = await authFetch("/api/usage");
      if (resp.ok) { const u = await resp.json(); applyUsage(u); return u; }
    } catch (e) { /* keep the last known values */ }
    return null;
  }, []);

  // Signed-out students keep a soft local match counter (matching runs in the
  // browser); signed-in students are counted on the server.
  const localMonthKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth()}`; };
  const localMatchCount = () => { const r = store.get("scholarbot-local-matches"); return r && r.month === localMonthKey() ? r.count : 0; };

  const openUpgrade = (kind, resetsOn) => {
    setUpgradeReason({ kind, resetsOn: resetsOn || usageResetsOn });
    setShowUpgradeModal(true);
    track("upgrade_prompt_shown", { kind });
  };

  // A guest who picks a plan on the landing is sent to sign-up; remember the
  // plan (state + sessionStorage, for the email-confirm round trip) and start
  // its checkout once sign-in and the plan lookup finish.
  const PENDING_PLAN_KEY = "meritlaunch-pending-plan";
  const [pendingPlan, setPendingPlanState] = useState(() => {
    try {
      const raw = sessionStorage.getItem(PENDING_PLAN_KEY);
      const v = raw ? JSON.parse(raw) : null;
      return v && v.plan && Date.now() - v.at < 3600000 ? v.plan : null;
    } catch (e) { return null; }
  });
  const setPendingPlan = useCallback((plan) => {
    setPendingPlanState(plan);
    try {
      if (plan) sessionStorage.setItem(PENDING_PLAN_KEY, JSON.stringify({ plan, at: Date.now() }));
      else sessionStorage.removeItem(PENDING_PLAN_KEY);
    } catch (e) { /* storage blocked: state still works in this tab */ }
  }, []);

  // Stripe checkout handler
  const handleCheckout = useCallback(async (plan) => {
    if (!authUser) {
      setShowAuthModal(true);
      return;
    }
    setCheckoutLoading(true);
    track("checkout_started", { plan });
    store.set("scholarbot-checkout-plan", plan); // read back on the success URL
    try {
      const isSubscription = plan === "premium";
      const resp = await authFetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          userId: authUser.id,
          userEmail: authUser.email,

        }),
      });
      const data = await resp.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        notify("Checkout failed: " + (data.error || "Unknown error"), "error");
      }
    } catch (err) {
      notify("Could not start checkout. Please try again.", "error");
    } finally {
      setCheckoutLoading(false);
    }
  }, [authUser]);

  // Resume a plan picked before sign-in, once the account's plan is known.
  useEffect(() => {
    if (!pendingPlan || !authUser || !usageLoaded) return;
    setPendingPlan(null);
    if (!isPremium) handleCheckout(pendingPlan);
  }, [pendingPlan, authUser, usageLoaded, isPremium, handleCheckout, setPendingPlan]);

  // Check for checkout success/cancel on page load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      notify("Payment received. Activating your plan...", "success");
      track("checkout_completed", { plan: store.get("scholarbot-checkout-plan") || "unknown" });
      window.history.replaceState({}, "", window.location.pathname);
      // The webhook flips the plan; poll the server briefly instead of guessing.
      let tries = 0;
      const poll = async () => {
        const u = await refreshUsage();
        if (u && u.paid) { notify(u.plan === "seasonal" ? "Your Season Pass is active." : "Premium is active. Welcome!", "success"); return; }
        if (++tries < 6) setTimeout(poll, 2500);
      };
      setTimeout(poll, 1500);
    } else if (params.get("checkout") === "cancelled") {
      notify("Checkout cancelled. No charge was made.", "info");
      track("checkout_cancelled");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);


  const handleBragSheetUpload = async (e, kind = "brag") => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBragSheetUploading(kind);
    try {
      const text = await readFileAsText(file);
      // Each kind has its own slot; a new file replaces only that slot.
      setBragSheet(prev => { const next = setDoc(prev, kind, file.name, text); setBragSheetFileName(docFileNames(next)); return next; });
      notify(`Read "${file.name}". Check what it found for your profile below.`, "success");
    } catch(err) {
      notify(err?.message || "Error reading file. Try pasting the content instead.", "error");
    }
    setBragSheetUploading(false);
    if (bragFileRef.current) bragFileRef.current.value = "";
  };

  const handleScholarshipUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedScholarshipName(file.name);
    try {
      const text = await readFileAsText(file);
      setCustomScholarshipText(text);
      if (!customScholarshipName) setCustomScholarshipName(file.name.replace(/\.\w+$/, ""));
      notify(`Scholarship "${file.name}" loaded!`, "success");
    } catch(err) {
      notify("Error reading file. Try pasting the content instead.", "error");
    }
    if (scholarshipFileRef.current) scholarshipFileRef.current.value = "";
  };

  const fetchScholarshipFromUrl = async () => {
    if (!scholarshipUrl.trim()) { notify("Please enter a URL.", "error"); return; }
    setFetchingUrl(true);
    try {
      const response = await authFetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "scholarship_from_url", url: scholarshipUrl.trim() }),
      });
      const data = await response.json();
      if (!response.ok) { notify(data.error || "Could not fetch details. Try pasting the content.", "error"); setFetchingUrl(false); return; }
      const text = data.text || "";
      if (text) {
        setCustomScholarshipText(text);
        const nameMatch = text.match(/(?:Scholarship\s*Name|Name)\s*[:\-]\s*(.+)/i);
        if (nameMatch && !customScholarshipName) setCustomScholarshipName(nameMatch[1].trim().slice(0, 80));
        notify("Scholarship details fetched!", "success");
      } else {
        notify("Could not fetch details. Try pasting the content.", "error");
      }
    } catch(err) {
      notify("Error fetching URL. Try pasting manually.", "error");
    }
    setFetchingUrl(false);
  };

  // Auth handlers
  const handleSignUp = async () => {
    setAuthError(""); setAuthNotice(""); setUnconfirmedEmail(""); setAuthSubmitting(true);
    // Check the password before the age gate so a password error never costs
    // the student the date she already typed.
    const pwIssue = passwordProblem(authPassword);
    if (pwIssue) { setAuthError(pwIssue); setAuthSubmitting(false); return; }
    // COPPA age gate — check age, then discard DOB immediately (never stored)
    if (authDob) {
      const birthDate = new Date(authDob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
      if (age < 13) {
        setAuthError("You must be 13 or older to use MeritLaunch.");
        setAuthSubmitting(false);
        setAuthDob(""); // discard immediately
        return;
      }
    } else {
      setAuthError("Please enter your date of birth to confirm you are 13 or older.");
      setAuthSubmitting(false);
      return;
    }
    // The date stays in the form (in memory only, never stored or sent) until
    // sign-up succeeds, so a server-side error does not make her retype it.
    try {
      const result = await withTimeout(supabase.auth.signUp({ email: authEmail, password: authPassword }), 8000);
      if (result === null) {
        clearStaleSupabaseSession();
        setAuthError("That timed out, so we reset your session. Please try again.");
        setAuthSubmitting(false);
        return;
      }
      const { data, error } = result;
      if (error) { setAuthError(friendlyAuthError(error, "signup")); }
      else if (isRepeatSignUp(data)) {
        // Supabase answers a sign-up for an existing address with no error and
        // sends nothing, so saying "we sent a link" here would be false.
        setAuthDob("");
        setAuthPassword("");
        setAuthMode("signin");
        setAuthError("An account with that email already exists. Sign in here, or use Forgot password to set a new one.");
      }
      else {
        setAuthDob(""); // discard DOB — not stored anywhere
        setAuthError("");
        setAuthMode("signin");
        setAuthPassword("");
        setAuthNotice(`Almost there. We sent a confirmation link to ${authEmail}. Open it, then sign in here. If it is not in your inbox within a minute, check your spam folder.`);
        const newUserId = data?.user?.id;
        if (newUserId) {
          identifyUser(newUserId);
          trackSignupCompleted(newUserId);
        }
      }
    } catch(e) { setAuthError("Something went wrong. Please try again."); }
    setAuthSubmitting(false);
  };

  const handleSignIn = async () => {
    setAuthError(""); setAuthNotice(""); setUnconfirmedEmail(""); setAuthSubmitting(true);
    try {
      const result = await withTimeout(supabase.auth.signInWithPassword({ email: authEmail, password: authPassword }), 8000);
      if (result === null) {
        clearStaleSupabaseSession();
        setAuthError("Sign-in timed out, so we reset your session. Please try again.");
        setAuthSubmitting(false);
        return;
      }
      const { data, error } = result;
      if (error) {
        if (/not confirmed/i.test(error.message || "")) {
          setUnconfirmedEmail(authEmail);
          setAuthError("Your email address has not been confirmed yet. Open the confirmation link we emailed you when you signed up, then sign in. Need another copy? Use the resend link below.");
        } else {
          setAuthError(friendlyAuthError(error, "signin"));
        }
      }
      else {
        setShowAuthModal(false); setAuthEmail(""); setAuthPassword("");
        notify("Welcome back!", "success");
        track("signin_completed");
        // A returning student lands on their dashboard, not the marketing page.
        if (window.location.pathname === "/") setView("home");
        if (data?.user?.id) identifyUser(data.user.id);
      }
    } catch(e) { setAuthError("Something went wrong. Please try again."); }
    setAuthSubmitting(false);
  };

  const handleResendConfirmation = async () => {
    const email = unconfirmedEmail || authEmail;
    if (!email) return;
    setAuthError(""); setAuthSubmitting(true);
    try {
      const result = await withTimeout(supabase.auth.resend({ type: "signup", email }), 8000);
      const error = result === null ? { message: "That timed out. Please try again." } : result.error;
      if (error) { setAuthError(friendlyAuthError(error, "resend")); }
      else { setUnconfirmedEmail(""); setAuthNotice(`We sent a new confirmation link to ${email}. Open it, then sign in here.`); }
    } catch(e) { setAuthError("Something went wrong. Please try again."); }
    setAuthSubmitting(false);
  };

  const handleForgotPassword = async () => {
    setAuthError(""); setAuthNotice(""); setUnconfirmedEmail(""); setAuthSubmitting(true);
    try {
      const result = await withTimeout(supabase.auth.resetPasswordForEmail(authEmail, {
        redirectTo: window.location.origin,
      }), 8000);
      if (result === null) {
        clearStaleSupabaseSession();
        setAuthError("That timed out, so we reset your session. Please try again.");
        setAuthSubmitting(false);
        return;
      }
      const { error } = result;
      if (error) { setAuthError(friendlyAuthError(error, "forgot")); }
      else {
        // Supabase answers the same way whether or not the address has an
        // account, so say so: a student who never signed up would otherwise
        // wait for an email that is not coming.
        setAuthMode("signin");
        setAuthNotice(`If ${authEmail} has a MeritLaunch account, a reset link is on its way. It can take a minute, and it may land in spam. No email? You may have signed up with a different address, or not created an account yet. In that case choose Sign up below.`);
      }
    } catch(e) { setAuthError("Something went wrong."); }
    setAuthSubmitting(false);
  };

  const handleUpdatePassword = async () => {
    setAuthError(""); setAuthNotice(""); setUnconfirmedEmail(""); setAuthSubmitting(true);
    const pwIssue = passwordProblem(newPassword);
    if (pwIssue) { setAuthError(pwIssue); setAuthSubmitting(false); return; }
    if (newPassword !== confirmPassword) { setAuthError("Passwords don't match."); setAuthSubmitting(false); return; }
    try {
      const result = await withTimeout(supabase.auth.updateUser({ password: newPassword }), 8000);
      if (result === null) {
        clearStaleSupabaseSession();
        setAuthError("That timed out, so we reset your session. Please try again.");
        setAuthSubmitting(false);
        return;
      }
      const { error } = result;
      if (error) { setAuthError(friendlyAuthError(error, "reset")); }
      else {
        notify("Password updated successfully!", "success");
        setShowAuthModal(false); setNewPassword(""); setConfirmPassword(""); setAuthMode("signin");
      }
    } catch(e) { setAuthError("Something went wrong. Please try again."); }
    setAuthSubmitting(false);
  };

  // Analytics: fire signup_started whenever the modal opens in signup mode
  useEffect(() => {
    if (showAuthModal && authMode === "signup") {
      trackSignupStarted();
    }
  }, [showAuthModal, authMode]);

  const handleSignOut = async () => {
    // 3s cap — a deadlocked auth client must never trap the user signed-in.
    // On timeout, force-clear the persisted session so a reload starts clean.
    const result = await withTimeout(supabase?.auth.signOut() ?? Promise.resolve(true), 3000);
    if (result === null) clearStaleSupabaseSession();
    resetUser(); // clear PostHog identity on sign-out
    setUsageLoaded(false); setPendingPlan(null);
    // Shared Chromebooks: nothing about this student stays in the browser.
    clearStudentLocalData();
    cloudReadyRef.current = null;
    autoMatchedRef.current = null;
    setAuthUser(null);
    setProfile({}); setSavedLetters([]); setTrackedApps([]); setMatchResults([]);
    setGeneratedLetter(""); setAppAnswers({}); setGeneratedProfile(""); setBragSheet(""); setBragSheetFileName(""); setDraftQuestions(null); setDraftAnswers({}); setDraftError(null);
    setTemplates(DEFAULT_TEMPLATES); setSelectedScholarship(null); setEssayPrompt("");
    setView("landing");
    notify("Signed out.", "info");
  };

  // Load data on mount + auth listener
  useEffect(() => {
    // PostHog starts only once a user is signed in (see the auth listener below).

    // Load local data first (fast)
    const p = store.get("scholarbot-profile"); if (p) setProfile(normalizeProfile(p));
    const l = store.get("scholarbot-letters"); if (l) setSavedLetters(l);
    const t = store.get("scholarbot-templates"); if (t) setTemplates(t);
    const a = store.get("scholarbot-answers"); if (a) setAppAnswers(a);
    // Voice scaffold is fed into every letter's system prompt, so it has to
    // survive a reload — otherwise it only helps within the session that made it.
    const vp = store.get("scholarbot-voice-profile"); if (vp) setGeneratedProfile(vp);

    // Fetch scholarships from Supabase — retry with backoff so a transient
    // failure self-heals instead of stranding the app on the 30 built-ins.
    let scholarshipsLoaded = false;
    let inFlight = null; // a slow first fetch must not be duplicated by the retry timers
    const retryTimers = [];
    const loadScholarships = async () => {
      if (scholarshipsLoaded || inFlight) return;
      inFlight = fetchScholarshipsFromSupabase();
      try {
        const rows = await inFlight;
        if (rows && rows.length > 0) {
          scholarshipsLoaded = true;
          setScholarshipDB(rows);
          setDbSource("synced");
        }
      } finally { inFlight = null; }
    };
    // The parent payment page needs none of the 1,297 rows; skip the fetch so it
    // does not compete with the token check.
    if (viewFromPath(window.location.pathname) !== "parentPay") {
      loadScholarships();
      for (const delay of [5000, 20000, 60000]) {
        retryTimers.push(setTimeout(loadScholarships, delay));
      }
    }

    // Loads subscription status, usage counters, notifications, and tracked
    // applications for a signed-in user. Called from restoreAccount on the first
    // session event (INITIAL_SESSION on page load, SIGNED_IN on sign-in), and
    // again on later SIGNED_IN events for the same account.
    const loadAccountData = async (user) => {
      // Plan, Season Pass expiry and the monthly reset are all applied on the
      // server (api/usage.js); the browser can no longer write those columns.
      const usage = await refreshUsage();
      if (!usage) {
        const { data: prof } = await supabase
          .from("user_profiles")
          .select("subscription_status, letters_used_this_month, matches_used_this_month")
          .eq("id", user.id)
          .single();
        if (prof) {
          setUserSubscription(prof.subscription_status || "free");
          setMonthlyLettersUsed(prof.letters_used_this_month || 0);
          setMonthlyMatchesUsed(prof.matches_used_this_month || 0);
        }
      }
      const { data: prefs } = await supabase.from("user_profiles").select("email_alerts_opt_out").eq("id", user.id).single();
      if (prefs) setEmailOptOut(!!prefs.email_alerts_opt_out);

      const { data: alerts } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(10);
      if (alerts) setDeadlineAlerts(alerts);

      const { data: cloudApps } = await supabase
        .from("applications")
        .select("*")
        .eq("user_id", user.id);
      if (cloudApps && cloudApps.length > 0) {
        const merged = cloudApps.map(a => ({
          id: a.id,
          scholarshipId: a.scholarship_id,
          name: a.scholarship_name || a.scholarship_id,
          amount: "", deadline: "", link: "",
          status: a.status || "interested",
          addedAt: a.created_at,
          notes: a.notes || "",
        }));
        const localIds = new Set(merged.map(a => a.scholarshipId));
        const localApps = store.get("scholarbot-tracked-apps") || [];
        const localOnly = localApps.filter(a => !localIds.has(a.scholarshipId));
        const combined = [...merged, ...localOnly];
        setTrackedApps(combined);
        localStorage.setItem("scholarbot-tracked-apps", JSON.stringify(combined));
      }
    };

    // Restores everything a signed-in student saved: profile, letters, then
    // plan, usage and tracker (loadAccountData). Runs once per account, on the
    // first session event for it (page load or a fresh sign-in alike).
    const restoreAccount = async (user) => {
      const owner = store.get("scholarbot-owner");
      if (owner && owner !== user.id) {
        // A different student used this browser last: drop their local data so
        // none of it is shown to, or synced into, this account.
        clearStudentLocalData();
        setProfile({}); setSavedLetters([]); setTrackedApps([]); setMatchResults([]);
        setGeneratedLetter(""); setAppAnswers({}); setGeneratedProfile(""); setBragSheet(""); setBragSheetFileName(""); setDraftQuestions(null); setDraftAnswers({}); setDraftError(null);
        setTemplates(DEFAULT_TEMPLATES);
      }
      store.set("scholarbot-owner", user.id);

      const local = store.get("scholarbot-profile");
      const cloudProfile = await loadProfileFromSupabase(user.id);
      if (cloudProfile && Object.keys(cloudProfile).length > 0) {
        const normalized = normalizeProfile(cloudProfile);
        setProfile(normalized);
        store.set("scholarbot-profile", normalized);
        // Say so when guest edits in this browser were replaced by the saved copy.
        const localKeys = Object.keys(local || {}).filter(k => !["ageOk", "under13"].includes(k));
        if (localKeys.length > 0 && JSON.stringify(normalizeProfile(local)) !== JSON.stringify(normalized)) {
          notify("We loaded your saved profile. Edits made before signing in weren't kept.", "info");
        }
      } else if (local && !local.under13 && Object.keys(local).length > 0) {
        // New account: keep what they built as a guest and save it to the cloud.
        saveProfileToSupabase(user.id, local);
      }
      // Profile saves go to the cloud only after the cloud copy has loaded, so an
      // early edit can never overwrite the student's saved profile.
      cloudReadyRef.current = user.id;

      const cloudLetters = await loadLettersFromSupabase(user.id);
      if (cloudLetters && cloudLetters.length > 0) {
        setSavedLetters(cloudLetters);
        store.set("scholarbot-letters", cloudLetters);
      }
      await loadAccountData(user);
    };

    if (supabase) {
      // Password-reset links carry type=recovery in the URL hash. supabase-js
      // normally emits PASSWORD_RECOVERY; the flag covers the case where that
      // event fired before this listener was attached.
      let recoveryLink = new URLSearchParams(window.location.hash.substring(1)).get("type") === "recovery";
      // An expired or already-used email link comes back with an error in the
      // URL and no session. Say so, and offer a fresh link.
      const linkProblem = authLinkProblem(window.location.hash, window.location.search);
      if (linkProblem) {
        recoveryLink = false;
        setAuthMode("forgot");
        setAuthNotice("");
        setAuthError(linkProblem);
        setShowAuthModal(true);
        window.history.replaceState(null, "", window.location.pathname);
      }
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        // Keep this callback synchronous. supabase-js holds its auth lock while
        // it runs, and any awaited Supabase call in here waits on that same lock
        // forever, which used to sign students out on every reload. Deferred
        // work runs after the lock is released.
        const user = session?.user ?? null;
        setAuthUser(user);
        setAuthLoading(false);
        if (user && event !== "PASSWORD_RECOVERY") { initAnalytics(); identifyUser(user.id); } // PostHog: signed-in users only
        if (event === "PASSWORD_RECOVERY" || (recoveryLink && user)) {
          recoveryLink = false;
          setAuthMode("reset");
          setShowAuthModal(true);
          setNewPassword("");
          setConfirmPassword("");
          setAuthError("");
          if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
          return;
        }
        if (!user) { cloudReadyRef.current = null; return; }
        if (cloudReadyRef.current === user.id || restoringRef.current === user.id) {
          // Same account (token refresh, tab focus): refresh plan and usage only.
          if (event === "SIGNED_IN") setTimeout(() => loadAccountData(user), 0);
          return;
        }
        restoringRef.current = user.id;
        setTimeout(() => {
          restoreAccount(user).finally(() => { if (restoringRef.current === user.id) restoringRef.current = null; });
        }, 0);
      });

      // If supabase-js never reports a session (offline, blocked storage), stop
      // the spinner. Never delete a stored session here: a slow start is not a
      // bad token, and wiping it is what signed students out.
      retryTimers.push(setTimeout(() => setAuthLoading(false), 8000));

      return () => { subscription?.unsubscribe(); retryTimers.forEach(clearTimeout); };
    } else {
      setAuthLoading(false);
      return () => retryTimers.forEach(clearTimeout);
    }
  }, []);

  const notify = (msg, type = "info") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const saveProfile = (p) => {
    // COPPA: under-13 answers are never collected. Keep only a flag (so the block
    // screen persists), drop everything else, and never sync to the cloud.
    if (p.under13) {
      const minimal = { under13: true };
      setProfile(minimal);
      store.set("scholarbot-profile", minimal);
      return;
    }
    setProfile(p);
    store.set("scholarbot-profile", p);
    // Sync to cloud once this account's saved profile has loaded (see restoreAccount)
    if (authUser && cloudReadyRef.current === authUser.id) saveProfileToSupabase(authUser.id, p);
  };
  const saveLetter = (letter) => {
    const localId = Date.now();
    const updated = [...savedLetters, { ...letter, id: localId, date: new Date().toLocaleDateString() }];
    setSavedLetters(updated); store.set("scholarbot-letters", updated);
    // Sync to the account, and say so plainly if that fails: the browser copy
    // is wiped at sign-out, so a silent failure would lose the letter.
    if (authUser) {
      saveLetterToSupabase(authUser.id, letter).then((res) => {
        if (!res) { notify("Saved in this browser only. We couldn't reach your account, so copy the letter somewhere safe before you sign out.", "error"); return; }
        if (typeof res === "string") {
          setSavedLetters(cur => { const next = cur.map(l => l.id === localId ? { ...l, id: res } : l); store.set("scholarbot-letters", next); return next; });
        }
      });
    }
    track("letter_saved");
    notify("Letter saved!", "success");
  };
  const saveTemplates = (t) => { setTemplates(t); store.set("scholarbot-templates", t); };

  // Application tracker helpers
  const trackApplication = (scholarship, status = "interested") => {
    const existing = trackedApps.find(a => a.scholarshipId === scholarship.id);
    if (existing) {
      notify("Already tracking this scholarship.", "info");
      return;
    }
    const app = {
      id: Date.now(),
      scholarshipId: scholarship.id,
      name: scholarship.name,
      amount: scholarship.amount,
      deadline: scholarship.deadline,
      link: scholarship.link,
      status, // interested | in_progress | submitted | accepted | rejected
      addedAt: new Date().toISOString(),
      notes: "",
    };
    const updated = [...trackedApps, app];
    setTrackedApps(updated);
    localStorage.setItem("scholarbot-tracked-apps", JSON.stringify(updated));
    // Sync to Supabase if logged in
    if (authUser && supabase) {
      supabase.from("applications").insert({
        user_id: authUser.id,
        scholarship_id: scholarship.id,
        scholarship_name: scholarship.name,
        status,
        notes: "",
      }).then(() => {});
    }
    track("scholarship_tracked", { status });
    notify(`Tracking "${scholarship.name}"`, "success");
  };

  const updateAppStatus = (appId, newStatus) => {
    const updated = trackedApps.map(a => a.id === appId ? { ...a, status: newStatus } : a);
    setTrackedApps(updated);
    if (newStatus === "submitted") track("application_submitted");
    localStorage.setItem("scholarbot-tracked-apps", JSON.stringify(updated));
    // Sync to Supabase
    const app = trackedApps.find(a => a.id === appId);
    if (authUser && supabase && app) {
      supabase.from("applications").update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("user_id", authUser.id).eq("scholarship_id", app.scholarshipId).then(() => {});
    }
  };

  const removeTrackedApp = (appId) => {
    const app = trackedApps.find(a => a.id === appId);
    const updated = trackedApps.filter(a => a.id !== appId);
    setTrackedApps(updated);
    localStorage.setItem("scholarbot-tracked-apps", JSON.stringify(updated));
    if (authUser && supabase && app) {
      supabase.from("applications").delete().eq("user_id", authUser.id).eq("scholarship_id", app.scholarshipId).then(() => {});
    }
    notify("Removed from tracker.", "info");
  };

  const answered = (q) => q.type === "age" ? !!profile.ageOk
    : Array.isArray(profile[q.id]) ? profile[q.id].length > 0 : !!profile[q.id];
  const profileCompletion = Math.round(PROFILE_QUESTIONS.filter(answered).length / PROFILE_QUESTIONS.length * 100);

  // A student's match list lives only in this browser, and sign-out clears it.
  // On a new device the dashboard used to say "Run your first match" to someone
  // with a finished profile, and re-running spent a free run. Rebuild the list
  // locally instead (matching is local; only the counter is on the server) once
  // the saved profile and the catalog are both here.
  useEffect(() => {
    if (!authUser || !profile.ageOk || profileCompletion < 40 || dbSource !== "synced") return;
    if (matchResults.length > 0 || autoMatchedRef.current === authUser.id) return;
    if (cloudReadyRef.current !== authUser.id) return;
    autoMatchedRef.current = authUser.id;
    const results = rankMatches(profile, scholarshipDB);
    if (results.length) { setMatchResults(results); store.set("scholarbot-matches", results.slice(0, 200)); }
  }, [authUser, profile, profileCompletion, dbSource, matchResults.length, scholarshipDB]);

  // Matching
  const runMatching = async () => {
    if (!profile.ageOk) { setProfileStep(0); setView("profile"); notify("Answer the first question so we can match you.", "info"); return; }
    if (authUser) {
      try {
        const resp = await authFetch("/api/usage", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "match" }),
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.status === 402) { openUpgrade("match", data.resetsOn); return; }
        if (resp.ok) applyUsage(data);
      } catch (e) { /* matching runs locally; a network blip shouldn't block it */ }
    } else {
      if (localMatchCount() >= FREE_LIMITS.matchesPerMonth) { openUpgrade("match"); return; }
      store.set("scholarbot-local-matches", { month: localMonthKey(), count: localMatchCount() + 1 });
    }
    const results = rankMatches(profile, scholarshipDB);
    setMatchResults(results);
    store.set("scholarbot-matches", results.slice(0, 200));
    track("matches_run", { count: results.length });
    setView("matches");
    notify(results.length ? `Found ${results.length} scholarships you're eligible for.` : "No eligible matches yet. Add more to your profile.", results.length ? "success" : "info");
  };

  // Letter generation. The prompt, model and limits live on the server
  // (api/_shared/prompts.js); the browser sends the student's facts and choices.
  const draftProfile = () => {
    const { email, phone, birthYear, under13, ageOk, ...rest } = profile;
    return rest;
  };
  const thinFields = () => [
    ["activities", "activities"], ["communityService", "community service"],
    ["personalStory", "your personal story"], ["careerGoal", "your career goal"],
  ].filter(([k]) => !(profile[k] || "").trim()).map(([, label]) => label);

  // The answers and skips from the pre-draft questions, in the shape the
  // prompt builder takes. An unanswered question counts as skipped, so the
  // draft never fills it in.
  const draftDetails = () => {
    const details = [], declined = [];
    for (const q of draftQuestions || []) {
      const a = draftAnswers[q.id];
      if (!a || a.status === "skipped") { declined.push(q.question); continue; }
      const text = a.status === "confirmed" ? (q.example || "").replace(/^for example:?\s*/i, "").trim() : (a.text || "").trim();
      if (text) details.push({ question: q.question, answer: text }); else declined.push(q.question);
    }
    return { details, declined };
  };

  const draftRequestBase = () => {
    const hasDbSelection = scholarshipInputMode === "database" && selectedScholarship;
    const scholarship = hasDbSelection
      ? { source: "database", name: selectedScholarship.name, criteria: selectedScholarship.criteria, amount: selectedScholarship.amount }
      : { source: "custom", name: customScholarshipName || "Custom Scholarship", description: customScholarshipText.slice(0, 8000) };
    const builtIn = DEFAULT_TEMPLATES.some(t => t.id === selectedTemplate?.id);
    return {
      profile: draftProfile(),
      scholarship,
      templateId: builtIn ? selectedTemplate.id : null,
      customTemplate: builtIn ? null : { name: selectedTemplate?.name, rules: selectedTemplate?.rules },
      essayPrompt: essayPrompt.trim(),
      voiceProfile: generatedProfile || "",
      bragSheet: bragSheet || "",
      appAnswers,
      includeSensitive,
    };
  };

  // Asks Haiku which concrete details the chosen style would need that the
  // student's material doesn't have. Free (no letter spent); any failure means
  // "no questions" so it can never block a draft.
  const askDraftQuestions = async () => {
    setAskingQuestions(true);
    try {
      const resp = await authFetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "draft_questions", ...draftRequestBase() }),
      });
      const data = resp.ok ? await resp.json().catch(() => ({})) : {};
      const qs = Array.isArray(data.questions) ? data.questions : [];
      setDraftQuestions(qs); setDraftAnswers({});
      return qs;
    } catch (e) {
      setDraftQuestions([]);
      return [];
    } finally {
      setAskingQuestions(false);
    }
  };

  const generateLetter = async ({ isRegenerate = false, skipQuestions = false } = {}) => {
    if (!authUser) { setAuthMode("signup"); setShowAuthModal(true); notify("Create a free account to draft letters.", "info"); return; }
    const hasDbSelection = scholarshipInputMode === "database" && selectedScholarship;
    const hasCustomInput = scholarshipInputMode !== "database" && customScholarshipText.trim();
    if (!hasDbSelection && !hasCustomInput) {
      notify(scholarshipInputMode === "database" ? "Pick a scholarship first." : "Add the scholarship details first.", "error");
      return;
    }
    if (!profile.ageOk) { setView("profile"); notify("Finish the first step of your profile first.", "info"); return; }
    if (!aiPolicy) { notify("First tell us whether this scholarship allows AI help.", "info"); return; }
    const outline = aiPolicy === "unsure";
    if (!outline && !canGenerateLetter) {
      if (isPremium) notify(`You've used all ${PRO_LIMITS.lettersPerMonth} letters this month. Your limit resets next month.`, "error");
      else openUpgrade("letter");
      return;
    }

    // First pass for this scholarship + style: find out what the draft would
    // otherwise have to make up, and let the student fill it in or skip it.
    if (!outline && !skipQuestions && draftQuestions === null) {
      const qs = await askDraftQuestions();
      if (qs.length) { track("draft_questions_shown", { count: qs.length }); return; }
    }

    // Regenerating writes a new draft and costs a letter. Free users get only a
    // couple, so confirm before spending one.
    if (isRegenerate && !isPremium && !outline) {
      const left = Math.max(0, FREE_LIMITS.lettersPerMonth - monthlyLettersUsed);
      const ok = window.confirm(`Regenerating writes a brand new draft and uses one of your ${left} remaining free letter${left === 1 ? "" : "s"} this month.\n\nGenerate a new version?`);
      if (!ok) return;
    }

    setGeneratingLetter(true);
    setGeneratedLetter("");
    setDraftError(null);
    setDraftStage("sending");

    const scholarshipLabel = hasDbSelection ? selectedScholarship.name : (customScholarshipName || "Custom Scholarship");
    const { details, declined } = outline ? { details: [], declined: [] } : draftDetails();

    try {
      const response = await authFetch("/api/generate-stream", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draftRequestBase(),
          wordLimit: wordLimit || null,
          mode: outline ? "outline" : "draft",
          details,
          declined,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        setGeneratingLetter(false); setDraftStage("");
        if (response.status === 402) {
          setGeneratedLetter("");
          if (errData.kind === "outline") notify(errData.error || "You've used this month's outlines.", "info");
          openUpgrade("letter", errData.resetsOn);
          return;
        }
        setGeneratedLetter("");
        notify(errData.error || "Couldn't draft the letter. Please try again.", "error");
        return;
      }

      setDraftStage("waiting");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let streamError = null;
      const parser = createSseParser((evt) => {
        if (evt.type === "content_block_delta" && evt.delta?.text) {
          if (!fullText) setDraftStage("writing");
          fullText += evt.delta.text;
          setGeneratedLetter(fullText);
        } else if (evt.type === "meritlaunch_usage") {
          if (typeof evt.outlinesUsed === "number") setMonthlyOutlinesUsed(evt.outlinesUsed);
          else setMonthlyLettersUsed(evt.lettersUsed || 0);
        } else if (evt.type === "meritlaunch_error") {
          streamError = { reason: evt.reason || "error", message: evt.message || "The draft stopped early. You weren't charged. Try again." };
        }
      });
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.push(decoder.decode(value, { stream: true }));
      }
      parser.flush();

      if (streamError) {
        // The server saw the stream fail (overload, refusal, dropped socket).
        // Whatever arrived stays on screen, flagged, and no letter was spent.
        setDraftError(streamError);
        track("letter_cut_off", { reason: streamError.reason, chars: fullText.length });
        notify(streamError.message, "error");
      } else if (!fullText) {
        setDraftError({ reason: "empty", message: "The AI service returned an empty draft. You weren't charged. Please try again." });
        notify("The AI service returned an empty draft. You weren't charged. Please try again.", "error");
      } else {
        store.set("scholarbot-draft", fullText);
        trackLetterGenerated({ scholarshipName: scholarshipLabel, template: selectedTemplate?.name || "unknown" });
        if (outline) track("letter_outline_generated");
      }
    } catch (e) {
      setDraftError({ reason: "network", message: "Couldn't reach the AI service. Check your connection and try again." });
      notify("Couldn't reach the AI service. Check your connection and try again.", "error");
    }
    setGeneratingLetter(false);
    setDraftStage("");
  };

  // Profile generation
  const generateCandidateProfile = async () => {
    if (!authUser) { setAuthMode("signup"); setShowAuthModal(true); notify("Create a free account to continue.", "info"); return; }
    if (!profile.ageOk) { setProfileStep(0); notify("Answer the first question first.", "info"); return; }
    setGeneratingLetter(true);
    try {
      const response = await authFetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "profile", profile: draftProfile(), bragSheet: bragSheet || "", appAnswers }),
      });
      const data = await response.json();
      const text = data.text || "";
      if (!text) { notify("Error generating profile.", "error"); setGeneratingLetter(false); return; }
      setGeneratedProfile(text);
      store.set("scholarbot-voice-profile", text);
      setView("profileResult");
    } catch(e) { notify("Error generating profile.", "error"); }
    setGeneratingLetter(false);
  };

  const APP_QUESTIONS = [
    "Tell us about yourself and your educational goals. (150-300 words)",
    "Describe a challenge you've overcome and what you learned from it. (150-300 words)",
    "How will this scholarship help you achieve your goals? (100-200 words)",
    "Describe your most significant community contribution. (150-250 words)",
    "Why should you be selected for this scholarship? (100-200 words)"
  ];

  const matchedScholarships = scholarshipDB.filter(s => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.criteria.toLowerCase().includes(q) || (s.amount||"").toLowerCase().includes(q);
    const matchesNeed = filterNeedBased === "all" || (filterNeedBased === "need" && s.needBased === "Y") || (filterNeedBased === "merit" && s.needBased !== "Y");
    const sc = s.country || "US";
    const matchesCountry =
      filterCountry === "all" ||
      sc === filterCountry ||
      // "BOTH"-tagged scholarships show when filtering US or CA
      (sc === "BOTH" && (filterCountry === "US" || filterCountry === "CA")) ||
      // "US + Canada" filter shows only scholarships tagged BOTH
      (filterCountry === "BOTH" && sc === "BOTH");
    // Optional state filter: national scholarships (no state) ALWAYS show — a student
    // considering schools elsewhere still wants those. Picking a state adds that
    // state's scholarships on top; it never hides the national ones.
    const matchesState = filterState === "all" || !s.state || statesOf(s).includes(filterState);
    return matchesSearch && matchesNeed && matchesCountry && matchesState;
  });

  // States that actually have scholarships in the DB (auto-grows as data is added)
  // Restrict the state filter to real US jurisdictions — the data also carries
  // Canadian province codes (e.g. "ON") that must not leak into "All States".
  const US_STATE_CODES = new Set(["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","PR","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"]);
  const availableStates = [...new Set(scholarshipDB.flatMap(s => statesOf(s)).filter(s => US_STATE_CODES.has(s)))].sort();

  // Country flag helper — uses Flagpedia CDN for crisp flag images
  const CountryFlag = ({ country }) => {
    const flags = {
      US: { code: "us", label: "US", bg: "#1a3a5c", border: "#2a5a8c" },
      CA: { code: "ca", label: "Canada", bg: "#5c1a1a", border: "#8c2a2a" },
      BOTH: { label: "US + CA", bg: "#3a2a5c", border: "#5a4a7c" },
    };
    const f = flags[country] || flags.US;
    const flagImg = (code) => (
      <img src={`https://flagcdn.com/w40/${code}.png`} alt={code.toUpperCase()} style={{ height: 12, borderRadius: 1, verticalAlign: "middle" }} />
    );
    return (
      <span style={{
        fontSize: TYPE.xs, fontFamily: FONTS.body, padding: "3px 8px", borderRadius: 5,
        background: f.bg, border: `1px solid ${f.border}`, color: "#fff",
        whiteSpace: "nowrap", letterSpacing: 0.5, display: "inline-flex", alignItems: "center", gap: 5,
      }}>
        {country === "BOTH" ? <>{flagImg("us")}{flagImg("ca")}</> : flagImg(f.code)}
        <span>{f.label}</span>
      </span>
    );
  };

  // Deadline helpers (shared logic in src/lib/deadline.js; colours mapped here).
  const parseDeadlineDate = (deadline) => parseDeadlineDateLib(deadline);
  const TONE_COLORS = { closed: COLORS.textDim, urgent: COLORS.urgentText, soon: COLORS.gold, open: COLORS.teal, undated: COLORS.textDim };
  const parseDeadline = (deadline) => {
    const info = deadlineInfo(deadline);
    return { ...info, color: TONE_COLORS[info.tone] };
  };
  const getDeadlineStatus = (deadline) => parseDeadline(deadline);

  // Deadline-aware ordering + expiry filter. Defined here (not with the other
  // filters above) because it depends on the deadline parsers declared just above.
  // Order: soonest live deadline first, then undated ("Varies"/"Rolling"), then
  // expired last — an expired listing should never be the first thing a student sees.
  const expiredCount = matchedScholarships.filter(s => {
    const days = parseDeadline(s.deadline).days;
    return days !== null && days < 0;
  }).length;

  const filteredScholarships = matchedScholarships
    .filter(s => {
      if (showExpired) return true;
      const days = parseDeadline(s.deadline).days;
      return days === null || days >= 0;
    })
    .sort((a, b) => compareByDeadline(a, b));

  // Landing / dashboard numbers come from the live catalog only. Until it loads,
  // the UI shows placeholders, never the 30 built-in fallbacks as a count.
  const catalogReady = dbSource === "synced";
  const catalogStats = catalogReady ? computeCatalogStats(scholarshipDB) : null;
  const catalogCount = catalogReady ? scholarshipDB.length.toLocaleString() : null;
  const lastCheckedLabel = catalogStats?.lastChecked
    ? catalogStats.lastChecked.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;

  // Keep work across reloads.
  useEffect(() => { store.set("scholarbot-brag-sheet", bragSheet); }, [bragSheet]);
  useEffect(() => { store.set("scholarbot-brag-sheet-name", bragSheetFileName); }, [bragSheetFileName]);
  // A different scholarship, style or question means different gaps: ask again.
  useEffect(() => { setDraftQuestions(null); setDraftAnswers({}); setDraftError(null); }, [selectedScholarship?.id, customScholarshipText, selectedTemplate?.id, essayPrompt, scholarshipInputMode]);
  useEffect(() => { if (!generatingLetter) store.set("scholarbot-draft", generatedLetter); }, [generatedLetter, generatingLetter]);
  useEffect(() => { setBrowseLimit(24); }, [searchQuery, filterNeedBased, filterCountry, filterState, showExpired]);

  const navItems = [
    {group:"Plan"},
    {id:"home",icon:"home",label:"Home"},
    {id:"profile",icon:"profile",label:"My Profile"},
    {id:"matches",icon:"matches",label:"My Matches"},
    {id:"search",icon:"search",label:"Find Scholarships"},
    {id:"apply",icon:"apply",label:"Practice Answers"},
    {group:"Write"},
    {id:"generate",icon:"generate",label:"Write a Letter"},
    {id:"saved",icon:"saved",label:"Saved Letters"},
    {id:"templates",icon:"templates",label:"Writing Styles"},
    {group:"Track"},
    {id:"tracker",icon:"calendar",label:"My Deadlines"},
  ];

  const isLanding = view === "landing";
  // The parent payment page stands alone: no app shell, no student data.
  const isStandalone = view === "parentPay";
  // Shared "#pricing" links (e.g. the parent hand-off) scroll to the plans.
  useEffect(() => {
    if (isLanding && window.location.hash === "#pricing") {
      setTimeout(() => document.getElementById("pricing")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" }), 300);
    }
  }, [isLanding]);

  // Source-link health from the monthly re-check (api/refresh-expired.js).
  const LinkCheck = ({ s }) => {
    const st = s.linkStatus || "";
    if (st === "dead" || st === "invalid") return <Badge color={COLORS.urgentText}>Source page gone: verify first</Badge>;
    if (st.startsWith("unreachable")) return <Badge color={COLORS.gold}>Couldn't reach source: verify first</Badge>;
    if (s.linkVerifiedAt) return <Badge color={COLORS.textMuted}>Link checked {new Date(s.linkVerifiedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</Badge>;
    return null;
  };

  // ============================================================
  const ctx = {
    view,
    setViewState,
    isMobile,
    setIsMobile,
    reducedMotion,
    profile,
    setProfile,
    bragSheet,
    setBragSheet,
    scholarshipQuery,
    setScholarshipQuery,
    scholarshipPickerOpen,
    setScholarshipPickerOpen,
    scholarshipDB,
    setScholarshipDB,
    dbSource,
    setDbSource,
    searchQuery,
    setSearchQuery,
    importUrl,
    setImportUrl,
    importLoading,
    setImportLoading,
    filterNeedBased,
    setFilterNeedBased,
    filterCountry,
    setFilterCountry,
    filterState,
    setFilterState,
    showExpired,
    setShowExpired,
    matchResults,
    setMatchResults,
    browseLimit,
    setBrowseLimit,
    essayPrompt,
    setEssayPrompt,
    wordLimit,
    setWordLimit,
    aiPolicy,
    includeSensitive,
    setIncludeSensitive,
    setAiPolicy,
    pickerActive,
    setPickerActive,
    upgradeReason,
    setUpgradeReason,
    emailOptOut,
    setEmailOptOut,
    selectedScholarship,
    setSelectedScholarship,
    selectedTemplate,
    setSelectedTemplate,
    templates,
    setTemplates,
    generatedLetter,
    setGeneratedLetter,
    generatingLetter,
    setGeneratingLetter,
    generatedProfile,
    setGeneratedProfile,
    savedLetters,
    setSavedLetters,
    trackedApps,
    setTrackedApps,
    appAnswers,
    setAppAnswers,
    notification,
    setNotification,
    deadlineAlerts,
    setDeadlineAlerts,
    bragSheetFileName,
    draftQuestions,
    setDraftQuestions,
    draftAnswers,
    setDraftAnswers,
    askingQuestions,
    draftStage,
    draftError,
    setDraftError,
    setBragSheetFileName,
    bragSheetUploading,
    setBragSheetUploading,
    profileStep,
    setProfileStep,
    mobileMenuOpen,
    setMobileMenuOpen,
    scholarshipInputMode,
    setScholarshipInputMode,
    customScholarshipText,
    setCustomScholarshipText,
    customScholarshipName,
    setCustomScholarshipName,
    scholarshipUrl,
    setScholarshipUrl,
    fetchingUrl,
    setFetchingUrl,
    uploadedScholarshipName,
    setUploadedScholarshipName,
    authUser,
    setAuthUser,
    authLoading,
    setAuthLoading,
    showAuthModal,
    setShowAuthModal,
    setPendingPlan,
    authMode,
    setAuthMode,
    legalModal,
    setLegalModal,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    authError,
    authNotice,
    setAuthNotice,
    unconfirmedEmail,
    handleResendConfirmation,
    setAuthError,
    authSubmitting,
    setAuthSubmitting,
    authDob,
    setAuthDob,
    usageResetsOn,
    setUsageResetsOn,
    userSubscription,
    setUserSubscription,
    monthlyLettersUsed,
    setMonthlyLettersUsed,
    monthlyMatchesUsed,
    setMonthlyMatchesUsed,
    showUpgradeModal,
    setShowUpgradeModal,
    checkoutLoading,
    setCheckoutLoading,
    setView,
    bragFileRef,
    scholarshipFileRef,
    PRO_LIMITS,
    isPremium,
    canMatch,
    canGenerateLetter,
    remainingMatches,
    remainingLetters,
    remainingOutlines,
    applyUsage,
    refreshUsage,
    localMonthKey,
    localMatchCount,
    openUpgrade,
    handleCheckout,
    readFileAsText,
    handleBragSheetUpload,
    handleScholarshipUpload,
    fetchScholarshipFromUrl,
    handleSignUp,
    handleSignIn,
    handleForgotPassword,
    handleUpdatePassword,
    handleSignOut,
    notify,
    saveProfile,
    saveLetter,
    saveTemplates,
    trackApplication,
    updateAppStatus,
    removeTrackedApp,
    answered,
    profileCompletion,
    runMatching,
    draftProfile,
    thinFields,
    generateLetter,
    generateCandidateProfile,
    APP_QUESTIONS,
    matchedScholarships,
    US_STATE_CODES,
    availableStates,
    CountryFlag,
    parseDeadlineDate,
    TONE_COLORS,
    parseDeadline,
    getDeadlineStatus,
    expiredCount,
    filteredScholarships,
    catalogReady,
    catalogStats,
    catalogCount,
    lastCheckedLabel,
    navItems,
    isLanding,
    LinkCheck,
  };

  // RENDER
  // ============================================================
  return (
    <AppContext.Provider value={ctx}>
    <div style={{ fontFamily: FONTS.heading, minHeight: "100vh", background: COLORS.bg, color: COLORS.text, overflowX: "clip" }}>

      {/* NOTIFICATION TOAST */}
      {notification && (
        <div role="status" aria-live="polite" style={{
          position: "fixed", top: 20, right: 20, zIndex: 10001, /* above the modal backdrop (10000) */ maxWidth: "calc(100vw - 40px)",
          padding: "14px 24px", borderRadius: 12,
          fontFamily: FONTS.body, fontSize: TYPE.base, fontWeight: 600,
          background: notification.type === "error" ? COLORS.pink : notification.type === "success" ? COLORS.teal : COLORS.gold,
          color: COLORS.bg,
          boxShadow: `0 8px 32px ${notification.type === "error" ? COLORS.pinkDim : COLORS.goldGlow}`,
          animation: "toastIn 0.4s cubic-bezier(0.34,1.56,0.64,1)",
        }}>
          {notification.msg}
        </div>
      )}

      <AuthModal />

      <LegalModal />

      <UpgradeModal />

      {/* ====== LANDING PAGE (Phase C) ====== */}
      {isLanding && <Landing />}

      {/* ====== APP SHELL (non-landing) ====== */}
      {isStandalone && (
        <Suspense fallback={<div className="app-loading" aria-busy="true" />}>
          <ParentPay />
        </Suspense>
      )}

      {!isLanding && !isStandalone && (
        <>
          <a href="#main" className="skip-link">Skip to content</a>
          {/* Mobile hamburger */}
          <button type="button" className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu" aria-expanded={mobileMenuOpen} aria-controls="app-sidebar" style={{
            display: "none", position: "fixed", top: 10, left: 10, zIndex: 200, minWidth: 44, minHeight: 44,
            background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10,
            padding: 10, color: COLORS.text, cursor: "pointer",
          }}><AppIcon name={mobileMenuOpen ? "close" : "menu"} size={22} /></button>

          <Sidebar />

          {/* MAIN CONTENT */}
          {/* Mobile overlay */}
          {mobileMenuOpen && <div className="mobile-overlay" aria-hidden="true" onClick={() => setMobileMenuOpen(false)} style={{
            display: "none", position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 99,
          }} />}

          <Suspense fallback={<div className="app-loading" aria-busy="true" />}>
          <main id="main" ref={mainRef} tabIndex={-1} className="app-main" style={{ marginLeft: 240, minHeight: "100vh", padding: "36px 44px", outline: "none" }}>

            {/* ====== DASHBOARD ====== */}
            {view === "home" && <Dashboard />}

            {/* ====== PROFILE BUILDER — COPPA block for under-13 visitors ====== */}
            {view === "profile" && isUnder13(profile) && <AgeBlocked />}

            {/* ====== PROFILE BUILDER (Stepped Wizard) ====== */}
            {view === "profile" && !isUnder13(profile) && <ProfileBuilder />}

            {/* ====== GENERATED PROFILE ====== */}
            {view === "profileResult" && <VoiceProfile />}

            {/* ====== BROWSE SCHOLARSHIPS (Card Layout) ====== */}
            {view === "search" && <Browse />}

            {/* ====== MATCHES ====== */}
            {view === "matches" && <Matches />}

            {/* ====== APPLICATION PREP ====== */}
            {view === "apply" && <PracticeAnswers />}

            {/* ====== LETTER GENERATOR ====== */}
            {view === "generate" && <LetterWriter />}

            {/* ====== STYLE TEMPLATES ====== */}
            {view === "templates" && <WritingStyles />}

            {/* ====== SAVED LETTERS ====== */}
            {view === "saved" && <SavedLetters />}

            {/* ====== APPLICATION TRACKER ====== */}
            {view === "tracker" && <Deadlines />}
          </main>
          </Suspense>
        </>
      )}

      <GlobalStyles />
    </div>
    </AppContext.Provider>
  );
}
