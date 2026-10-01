// One source of truth for what each plan includes. The landing cards, the upgrade
// dialog, and the sidebar all render from this, and api/_shared/usage.js enforces
// the same numbers (a test keeps them in step).
export const FREE_LIMITS = { matchesPerMonth: 5, lettersPerMonth: 2 };
export const PAID_LIMITS = { matchesPerMonth: Infinity, lettersPerMonth: 50 };

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
      "All 4 writing styles",
      "Application tracker and deadline emails",
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
    tagline: "One payment covers fall through winter deadlines",
    features: [
      "Everything in Premium, for 4 months",
      "No auto-renewal",
      "Saves 25% vs. 4 months of Premium",
    ],
    cta: "Get Season Pass",
  },
];
