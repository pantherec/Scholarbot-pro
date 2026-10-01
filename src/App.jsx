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
import { rankMatches } from "./lib/matching.js";
import { parseDeadlineDate as parseDeadlineDateLib, deadlineInfo, compareByDeadline } from "./lib/deadline.js";
import { PLANS, FREE_LIMITS, PAID_LIMITS } from "./lib/plans.js";
import { computeCatalogStats, formatAwardTotal } from "./lib/catalogStats.js";
import { createSseParser } from "./lib/sse.js";
import { COLORS, FONTS, TYPE } from "./ui/theme.js";
import { supabase, withTimeout, clearStaleSupabaseSession, authFetch, STRIPE_PRICES, fetchScholarshipsFromSupabase, saveProfileToSupabase, loadProfileFromSupabase, saveLetterToSupabase, loadLettersFromSupabase, store } from "./lib/api.js";
import { DEFAULT_SCHOLARSHIP_DB } from "./data/catalog.js";
import { isUnder13, PROFILE_QUESTIONS, DEFAULT_TEMPLATES, normalizeProfile } from "./data/profile.js";
import { Badge, AppIcon } from "./ui/components.jsx";
import { VIEW_PATHS, viewFromPath } from "./routes.js";
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
    const path = VIEW_PATHS[v] || "/";
    if (typeof window !== "undefined" && window.location.pathname !== path) {
      window.history.pushState({ view: v }, "", path);
    }
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    const onPop = () => setViewState(viewFromPath(window.location.pathname));
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
  const [aiPolicy, setAiPolicy] = useState("allowed"); // allowed | unsure
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
  const [bragSheetFileName, setBragSheetFileName] = useState("");
  const [bragSheetUploading, setBragSheetUploading] = useState(false);
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
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState("signin"); // signin | signup | forgot | reset
  const [legalModal, setLegalModal] = useState(null); // null | "privacy" | "terms"
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authDob, setAuthDob] = useState(""); // COPPA: used only for age check, never stored
  const [usageResetsOn, setUsageResetsOn] = useState(null);
  const [userSubscription, setUserSubscription] = useState("free"); // free | premium | seasonal
  const [monthlyLettersUsed, setMonthlyLettersUsed] = useState(0);
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
  const remainingLetters = isPremium
    ? Math.max(0, PRO_LIMITS.lettersPerMonth - monthlyLettersUsed)
    : Math.max(0, FREE_LIMITS.lettersPerMonth - monthlyLettersUsed);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Plan + usage come from the server, which owns the counters.
  const applyUsage = (u) => {
    if (!u || u.error) return;
    setUserSubscription(u.plan || "free");
    setMonthlyLettersUsed(u.lettersUsed || 0);
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

  // Stripe checkout handler
  const handleCheckout = useCallback(async (plan) => {
    if (!authUser) {
      setShowAuthModal(true);
      return;
    }
    setCheckoutLoading(true);
    track("checkout_started", { plan });
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

  // Check for checkout success/cancel on page load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      notify("Payment received. Activating your plan...", "success");
      track("checkout_completed");
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


  const handleBragSheetUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBragSheetUploading(true);
    setBragSheetFileName(file.name);
    try {
      const text = await readFileAsText(file);
      setBragSheet(prev => prev ? prev + "\n\n--- Uploaded from: " + file.name + " ---\n\n" + text : text);
      notify(`Brag sheet "${file.name}" uploaded successfully!`, "success");
    } catch(err) {
      notify(err?.message || "Error reading file. Try pasting the content instead.", "error");
      setBragSheetFileName("");
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
    setAuthError(""); setAuthSubmitting(true);
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
    setAuthDob(""); // discard DOB — not stored anywhere
    try {
      const result = await withTimeout(supabase.auth.signUp({ email: authEmail, password: authPassword }), 8000);
      if (result === null) {
        clearStaleSupabaseSession();
        setAuthError("That timed out — we've reset your session. Please try again.");
        setAuthSubmitting(false);
        return;
      }
      const { data, error } = result;
      if (error) { setAuthError(error.message); }
      else {
        setAuthError("");
        notify("Check your email for a confirmation link!", "success");
        setAuthMode("signin");
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
    setAuthError(""); setAuthSubmitting(true);
    try {
      const result = await withTimeout(supabase.auth.signInWithPassword({ email: authEmail, password: authPassword }), 8000);
      if (result === null) {
        clearStaleSupabaseSession();
        setAuthError("Sign-in timed out — we've reset your session. Please try again.");
        setAuthSubmitting(false);
        return;
      }
      const { data, error } = result;
      if (error) { setAuthError(error.message); }
      else {
        setShowAuthModal(false); setAuthEmail(""); setAuthPassword("");
        notify("Welcome back!", "success");
        if (data?.user?.id) identifyUser(data.user.id);
      }
    } catch(e) { setAuthError("Something went wrong. Please try again."); }
    setAuthSubmitting(false);
  };

  const handleForgotPassword = async () => {
    setAuthError(""); setAuthSubmitting(true);
    try {
      const result = await withTimeout(supabase.auth.resetPasswordForEmail(authEmail, {
        redirectTo: window.location.origin,
      }), 8000);
      if (result === null) {
        clearStaleSupabaseSession();
        setAuthError("That timed out — we've reset your session. Please try again.");
        setAuthSubmitting(false);
        return;
      }
      const { error } = result;
      if (error) { setAuthError(error.message); }
      else { notify("Password reset email sent!", "success"); setAuthMode("signin"); }
    } catch(e) { setAuthError("Something went wrong."); }
    setAuthSubmitting(false);
  };

  const handleUpdatePassword = async () => {
    setAuthError(""); setAuthSubmitting(true);
    if (newPassword.length < 6) { setAuthError("Password must be at least 6 characters."); setAuthSubmitting(false); return; }
    if (newPassword !== confirmPassword) { setAuthError("Passwords don't match."); setAuthSubmitting(false); return; }
    try {
      const result = await withTimeout(supabase.auth.updateUser({ password: newPassword }), 8000);
      if (result === null) {
        clearStaleSupabaseSession();
        setAuthError("That timed out — we've reset your session. Please try again.");
        setAuthSubmitting(false);
        return;
      }
      const { error } = result;
      if (error) { setAuthError(error.message); }
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
    setAuthUser(null);
    notify("Signed out.", "info");
  };

  // Load data on mount + auth listener
  useEffect(() => {
    initAnalytics(); // PostHog — no-op if VITE_POSTHOG_KEY not set

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
    loadScholarships();
    for (const delay of [5000, 20000, 60000]) {
      retryTimers.push(setTimeout(loadScholarships, delay));
    }

    // Loads subscription status, usage counters, notifications, and tracked
    // applications for a signed-in user. Called from BOTH the initial session
    // check and onAuthStateChange below — onAuthStateChange alone can miss a
    // session that's silently restored from localStorage on page load,
    // which was leaving premium users showing as "Free" after a refresh.
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
        const localOnly = trackedApps.filter(a => !localIds.has(a.scholarshipId));
        const combined = [...merged, ...localOnly];
        setTrackedApps(combined);
        localStorage.setItem("scholarbot-tracked-apps", JSON.stringify(combined));
      }
    };

    // Auth listener
    if (supabase) {
      // 8s cap — a stuck/corrupted session must never leave the app spinning on
      // auth forever. On timeout, clear the bad session so the next sign-in
      // attempt starts clean instead of inheriting the same deadlock.
      withTimeout(supabase.auth.getSession(), 8000).then(result => {
        if (result === null) {
          clearStaleSupabaseSession();
          setAuthUser(null);
          setAuthLoading(false);
          return;
        }
        const { data: { session } } = result;
        setAuthUser(session?.user ?? null);
        setAuthLoading(false);
        // If logged in, try to load cloud profile
        if (session?.user) {
          loadProfileFromSupabase(session.user.id).then(cloudProfile => {
            if (cloudProfile && Object.keys(cloudProfile).length > 0) {
              const normalized = normalizeProfile(cloudProfile);
              setProfile(normalized);
              store.set("scholarbot-profile", normalized);
            }
          });
          loadLettersFromSupabase(session.user.id).then(cloudLetters => {
            if (cloudLetters && cloudLetters.length > 0) {
              setSavedLetters(cloudLetters);
            }
          });
          loadAccountData(session.user);
        }
      });

      // Check URL for recovery flow on initial load
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const urlType = hashParams.get("type");
      if (urlType === "recovery") {
        // Supabase v2: recovery token is in the URL hash — wait for session, then show reset modal
        const checkRecovery = setInterval(async () => {
          const { data: { session: recoverySess } } = await supabase.auth.getSession();
          if (recoverySess) {
            clearInterval(checkRecovery);
            setAuthUser(recoverySess.user);
            setAuthMode("reset");
            setShowAuthModal(true);
            setNewPassword("");
            setConfirmPassword("");
            setAuthError("");
            // Clean up the URL hash so refresh doesn't re-trigger
            window.history.replaceState(null, "", window.location.pathname);
          }
        }, 300);
        setTimeout(() => clearInterval(checkRecovery), 10000); // safety timeout
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        const user = session?.user ?? null;
        setAuthUser(user);
        // If user arrived via password reset link, show the reset password modal
        if (_event === "PASSWORD_RECOVERY") {
          setAuthMode("reset");
          setShowAuthModal(true);
          setNewPassword("");
          setConfirmPassword("");
          setAuthError("");
          return;
        }
        if (user && supabase) {
          await loadAccountData(user);
        }
      });

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
    // Sync to cloud if logged in
    if (authUser) saveProfileToSupabase(authUser.id, p);
  };
  const saveLetter = (letter) => {
    const updated = [...savedLetters, { ...letter, id: Date.now(), date: new Date().toLocaleDateString() }];
    setSavedLetters(updated); store.set("scholarbot-letters", updated);
    // Sync to cloud if logged in
    if (authUser) saveLetterToSupabase(authUser.id, letter);
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
    notify(`Tracking "${scholarship.name}"`, "success");
  };

  const updateAppStatus = (appId, newStatus) => {
    const updated = trackedApps.map(a => a.id === appId ? { ...a, status: newStatus } : a);
    setTrackedApps(updated);
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

  const generateLetter = async ({ isRegenerate = false } = {}) => {
    if (!authUser) { setAuthMode("signup"); setShowAuthModal(true); notify("Create a free account to draft letters.", "info"); return; }
    const hasDbSelection = scholarshipInputMode === "database" && selectedScholarship;
    const hasCustomInput = scholarshipInputMode !== "database" && customScholarshipText.trim();
    if (!hasDbSelection && !hasCustomInput) {
      notify(scholarshipInputMode === "database" ? "Pick a scholarship first." : "Add the scholarship details first.", "error");
      return;
    }
    if (!profile.ageOk) { setView("profile"); notify("Finish the first step of your profile first.", "info"); return; }
    const outline = aiPolicy === "unsure";
    if (!outline && !canGenerateLetter) {
      if (isPremium) notify(`You've used all ${PRO_LIMITS.lettersPerMonth} letters this month. Your limit resets next month.`, "error");
      else openUpgrade("letter");
      return;
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

    const scholarshipLabel = hasDbSelection ? selectedScholarship.name : (customScholarshipName || "Custom Scholarship");
    const scholarship = hasDbSelection
      ? { source: "database", name: selectedScholarship.name, criteria: selectedScholarship.criteria, amount: selectedScholarship.amount }
      : { source: "custom", name: customScholarshipName || "Custom Scholarship", description: customScholarshipText.slice(0, 8000) };
    const builtIn = DEFAULT_TEMPLATES.some(t => t.id === selectedTemplate?.id);

    try {
      const response = await authFetch("/api/generate-stream", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: draftProfile(),
          scholarship,
          templateId: builtIn ? selectedTemplate.id : null,
          customTemplate: builtIn ? null : { name: selectedTemplate?.name, rules: selectedTemplate?.rules },
          essayPrompt: essayPrompt.trim(),
          wordLimit: wordLimit || null,
          voiceProfile: generatedProfile || "",
          bragSheet: bragSheet || "",
          appAnswers,
          mode: outline ? "outline" : "draft",
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        setGeneratingLetter(false);
        if (response.status === 402) { setGeneratedLetter(""); openUpgrade("letter", errData.resetsOn); return; }
        setGeneratedLetter("");
        notify(errData.error || "Couldn't draft the letter. Please try again.", "error");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      const parser = createSseParser((evt) => {
        if (evt.type === "content_block_delta" && evt.delta?.text) {
          fullText += evt.delta.text;
          setGeneratedLetter(fullText);
        } else if (evt.type === "meritlaunch_usage") {
          setMonthlyLettersUsed(evt.lettersUsed || 0);
        }
      });
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.push(decoder.decode(value, { stream: true }));
      }
      parser.flush();

      if (!fullText) {
        notify("The AI service returned an empty draft. You weren't charged. Please try again.", "error");
      } else {
        store.set("scholarbot-draft", fullText);
        trackLetterGenerated({ scholarshipName: scholarshipLabel, template: selectedTemplate?.name || "unknown" });
        if (outline) track("letter_outline_generated");
      }
    } catch (e) {
      notify("Couldn't reach the AI service. Check your connection and try again.", "error");
    }
    setGeneratingLetter(false);
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
    const matchesState = filterState === "all" || !s.state || s.state === filterState;
    return matchesSearch && matchesNeed && matchesCountry && matchesState;
  });

  // States that actually have scholarships in the DB (auto-grows as data is added)
  // Restrict the state filter to real US jurisdictions — the data also carries
  // Canadian province codes (e.g. "ON") that must not leak into "All States".
  const US_STATE_CODES = new Set(["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","PR","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"]);
  const availableStates = [...new Set(scholarshipDB.map(s => s.state).filter(s => s && US_STATE_CODES.has(s)))].sort();

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
  useEffect(() => { if (!generatingLetter) store.set("scholarbot-draft", generatedLetter); }, [generatedLetter, generatingLetter]);
  useEffect(() => { setBrowseLimit(24); }, [searchQuery, filterNeedBased, filterCountry, filterState, showExpired]);

  const navItems = [
    {group:"Plan"},
    {id:"home",icon:"home",label:"Home"},
    {id:"profile",icon:"profile",label:"My Profile"},
    {id:"matches",icon:"matches",label:"My Matches"},
    {id:"search",icon:"search",label:"Find Scholarships"},
    {group:"Write"},
    {id:"generate",icon:"generate",label:"Write a Letter"},
    {id:"saved",icon:"saved",label:"Saved Letters"},
    {id:"apply",icon:"apply",label:"Practice Answers"},
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
          position: "fixed", top: 20, right: 20, zIndex: 9999, maxWidth: "calc(100vw - 40px)",
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
          <div className="app-main" style={{ marginLeft: 240, minHeight: "100vh", padding: "36px 44px" }}>

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
          </div>
          </Suspense>
        </>
      )}

      <GlobalStyles />
    </div>
    </AppContext.Provider>
  );
}
