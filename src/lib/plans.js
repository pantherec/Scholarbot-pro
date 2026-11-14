// One source of truth for what each plan includes. The landing cards, the upgrade
// dialog, and the sidebar all render from this, and api/_shared/usage.js enforces
// the same numbers (a test keeps them in step).
export const FREE_LIMITS = { matchesPerMonth: 5, lettersPerMonth: 2, outlinesPerMonth: 5 };
export const PAID_LIMITS = { matchesPerMonth: Infinity, lettersPerMonth: 50, outlinesPerMonth: 50 };
// A Season Pass lasts this many months from purchase and never renews (the
// server uses the same number; a test keeps them equal).
export const SEASON_PASS_MONTHS = 6;

// Auto-saved drafts are kept this long (api/_shared/account.js deletes older ones).
export const DRAFT_RETENTION_DAYS = 180;

// One refund policy, shown in the Terms and on the parent payment page.
export const REFUND_LETTER_CAP = 5;
export const REFUND_POLICY =
  `Refunds: if MeritLaunch is not right for you, email support@meritlaunch.com within 7 days of your first payment for a full refund, as long as ${REFUND_LETTER_CAP} or fewer letters have been drafted on the paid plan. After that, refunds are handled case by case.`;

export const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "/month",
    tagline: "Try it on a real application",
    features: [
      "Your full profile and brag sheet",
      "Browse every scholarship we track",
      `${FREE_LIMITS.matchesPerMonth} match runs per month`,
      `${FREE_LIMITS.lettersPerMonth} AI letter drafts per month`,
      `${FREE_LIMITS.outlinesPerMonth} essay outlines per month`,
      "All 4 writing styles",
      "\"Why this score\" breakdown on every match",
      // Say "emails" again once the Resend domain is verified and the weekly digest delivers.
      "Application tracker and deadline reminders",
    ],
    cta: "Start Free",
  },
  {
    id: "premium",
    name: "Premium",
    price: "$9.99",
    period: "/month",
    tagline: "For a full application season, month to month",
    features: [
      "Everything in Free, plus:",
      "Unlimited match runs",
      `${PAID_LIMITS.lettersPerMonth} AI letter drafts per month`,
      `${PAID_LIMITS.outlinesPerMonth} essay outlines per month`,
      "Score Coach: your GPA against our list, and sourced guidance by grade",
      "Import any scholarship from a URL",
      "Cancel anytime",
    ],
    cta: "Go Premium",
    highlight: true,
  },
  {
    id: "seasonal",
    name: "Season Pass",
    price: "$29.99",
    period: " one time",
    tagline: "One payment covers a full application season",
    features: [
      `Everything in Premium, for ${SEASON_PASS_MONTHS} months`,
      "Ends on its own. It never renews",
      `Half the cost of ${SEASON_PASS_MONTHS} months of Premium`,
    ],
    cta: "Get Season Pass",
  },
];
