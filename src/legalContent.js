// Privacy Policy and Terms of Service content for MeritLaunch.
//
// This is a plain-language starting point written from what the app
// actually collects and does (see src/App.jsx and api/). It is NOT a
// substitute for review by a lawyer before relying on it — especially
// given MeritLaunch collects financial-need, ethnicity, and citizenship
// data from users who may be minors (13-17, per the signup age gate).

export const LAST_UPDATED = "July 2026";

export const PRIVACY_SECTIONS = [
  {
    heading: "What we collect",
    body: [
      "Account info: your email address and password (handled by our authentication provider, Supabase — we never see or store your raw password).",
      "Profile info you enter to get scholarship matches: GPA, test scores, financial need or household income bracket, ethnicity/heritage, citizenship or residency status, extracurricular activities, and any brag sheet, resume, or essay text you upload or paste in.",
      "Application letters generated for you, and your saved application/tracker status for individual scholarships.",
      "Billing info: if you upgrade to Premium or the Seasonal Pass, payment is handled entirely by Stripe. We store your Stripe customer ID and subscription status, never your full card number.",
      "Basic usage analytics (pages viewed, features used) tied to your account ID, not your name or email.",
    ],
  },
  {
    heading: "Age requirement",
    body: [
      "MeritLaunch is for students 13 and older. We ask for your date of birth at signup to confirm this, and we do not store it — it's checked once and discarded.",
    ],
  },
  {
    heading: "How we use it",
    body: [
      "To match you with scholarships you're actually eligible for.",
      "To draft application letters using your real profile details, in a style you choose. You review, edit, and remain the author of every letter before you send it anywhere.",
      "To send you deadline reminders for scholarships you're tracking, if you've enabled them.",
      "To process payment if you upgrade to a paid plan.",
      "To understand which features are useful so we can improve the product.",
    ],
  },
  {
    heading: "Who we share it with",
    body: [
      "Supabase — our database and authentication provider. Your profile and account data lives here.",
      "Stripe — processes payments for Premium/Seasonal plans. We never handle your raw card number.",
      "Anthropic (Claude) — your profile details are sent to generate the text of an application letter draft. This happens server-side; Anthropic does not receive your login credentials or payment info.",
      "PostHog — anonymized-where-possible product analytics, tied to your account ID rather than your name or email.",
      "We do not sell your personal data, and we do not share your profile data (GPA, financial need, ethnicity, essays) with scholarship providers or anyone else without your action — you choose what to submit and where.",
    ],
  },
  {
    heading: "How long we keep it",
    body: [
      "We keep your account and profile data as long as your account is active. If you want your account and data deleted, email us (contact below) and we'll delete it, typically within 30 days, except where we're required to keep billing records for tax/legal purposes.",
    ],
  },
  {
    heading: "Your choices",
    body: [
      "You can edit or remove most profile fields yourself at any time from your account.",
      "You can request a copy of your data, or full deletion of your account, by emailing us.",
      "You can opt out of deadline-reminder emails from your account settings.",
    ],
  },
  {
    heading: "Security",
    body: [
      "Data in transit is encrypted (HTTPS). Access to your account requires your password or a valid session token. We restrict which of our own systems can write to sensitive tables. No system is perfectly secure, and we can't guarantee absolute security, but we take reasonable, industry-standard precautions.",
    ],
  },
  {
    heading: "Contact",
    body: [
      "Questions about this policy, or a data access/deletion request: contact us through the email listed in your account confirmation, or via meritlaunch.com.",
    ],
  },
];

export const TERMS_SECTIONS = [
  {
    heading: "What MeritLaunch is",
    body: [
      "MeritLaunch matches students to scholarships based on the profile information they provide, and helps draft application letters from that information. It's a tool to speed up your own scholarship search and writing — not a guarantee of eligibility, award, or outcome for any scholarship.",
    ],
  },
  {
    heading: "Your account",
    body: [
      "You must be 13 or older to use MeritLaunch. You're responsible for the accuracy of the information you enter and for keeping your login credentials secure.",
    ],
  },
  {
    heading: "Your content, your letters",
    body: [
      "You own what you write and what you generate through MeritLaunch. Generated letters are drafts built from your own profile information — you're responsible for reviewing, editing, and fact-checking any letter before submitting it to a scholarship provider. You remain the author; MeritLaunch is a drafting aid, not a substitute for your own review and judgment.",
    ],
  },
  {
    heading: "Scholarship listings",
    body: [
      "We aggregate scholarship information from public sources and try to keep deadlines, amounts, and eligibility criteria current, but we can't guarantee every listing is accurate or still open. Always verify details on the scholarship provider's own site before applying or relying on a deadline.",
    ],
  },
  {
    heading: "Billing",
    body: [
      "Premium is a recurring monthly subscription; the Seasonal Pass is a one-time payment for a fixed period. Subscriptions renew automatically until canceled. You can cancel or manage billing from your account at any time — cancellation takes effect at the end of the current billing period. Payments are processed by Stripe; refunds are handled case-by-case, contact us if something went wrong with a charge.",
    ],
  },
  {
    heading: "Acceptable use",
    body: [
      "Don't use MeritLaunch to submit false information on scholarship applications, to scrape or resell scholarship data, or to attempt to disrupt or gain unauthorized access to the service.",
    ],
  },
  {
    heading: "No guarantee of results",
    body: [
      "MeritLaunch does not guarantee that you will be matched with, be eligible for, or win any scholarship. Scholarship awards are decided entirely by the awarding organizations, not by us.",
    ],
  },
  {
    heading: "Changes",
    body: [
      "We may update these terms or the Privacy Policy as the product changes. Material changes will be reflected here with an updated date. Continued use of MeritLaunch after a change means you accept the update.",
    ],
  },
  {
    heading: "Contact",
    body: [
      "Questions about these terms: contact us through the email listed in your account confirmation, or via meritlaunch.com.",
    ],
  },
];
