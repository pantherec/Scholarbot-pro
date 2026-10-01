// Privacy Policy and Terms of Service content for MeritLaunch.
//
// This is a plain-language starting point written from what the app
// actually collects and does (see src/App.jsx and api/). It is NOT a
// substitute for review by a lawyer before relying on it — especially
// given MeritLaunch collects financial-need, heritage, and citizenship
// data from users who may be minors (13-17, per the age gate).

export const LAST_UPDATED = "September 2026";

export const PRIVACY_SECTIONS = [
  {
    heading: "What we collect",
    body: [
      "Account info: your email address and password. Your password is handled by our sign-in provider, Supabase. We never see or store your raw password.",
      "Profile info you enter to get scholarship matches: first and last name, city and state, citizenship or residency status, how you identify (heritage, optional, with a \"prefer not to say\" choice), GPA, SAT or ACT score, high school, graduation year, intended major, financial-need category, activities, awards, community service, your personal story, your career goal, and your preferred writing voice.",
      "Optional extras: a brag sheet (text from a file you upload, or text you paste) and application-prep answers.",
      "Letters you generate and save, and the scholarships you track, with a status for each.",
      "Billing info: if you upgrade, payment is handled by Stripe. Card details go directly to Stripe and never touch our servers. We keep only your plan and payment status.",
      "Basic product analytics for signed-in users, tied to an internal user ID. It does not include your name or email.",
      "We do not ask for your phone number.",
    ],
  },
  {
    heading: "Age requirement",
    body: [
      "You must be 13 or older to use MeritLaunch.",
      "At sign-up we ask for your date of birth only to confirm you are 13 or older. The date is checked in your browser and then discarded. We never store it.",
      "In the profile builder we ask for your birth year only to confirm you are 13 or older. We keep only a yes/no \"13 or older\" flag, not the year.",
      "If you are under 13, you will see a block screen, and nothing you typed is saved.",
    ],
  },
  {
    heading: "Where your data is stored",
    body: [
      "On your own device, in your browser storage. This always happens.",
      "In our database (Supabase), when you have an account and are signed in.",
    ],
  },
  {
    heading: "How we use it",
    body: [
      "To match you with scholarships you may be eligible for.",
      "To draft application letters and a voice profile from your real profile details, in a style you choose. The draft is a starting point. You review it, edit it, and decide what to submit.",
      "To send you emails: deadline reminders for scholarships you track, reminders that your Season Pass is ending, and payment notices.",
      "To process payment if you upgrade to a paid plan.",
      "To understand which features are useful so we can improve the product.",
    ],
  },
  {
    heading: "AI and authorship",
    body: [
      "Letters from MeritLaunch are drafts. You choose what to keep, change, and submit.",
      "You are responsible for following each scholarship's own rules about outside help or AI.",
    ],
  },
  {
    heading: "Who receives your data",
    body: [
      "These are service providers that help us run MeritLaunch. We do not sell or rent student data, and we do not share it for advertising.",
      "Supabase: our database and sign-in provider.",
      "Anthropic (Claude AI): writes letter drafts and your voice profile. To do that, we send the profile details and brag sheet needed for that draft, plus your first name. We never send your email address.",
      "Vercel: hosting and the serverless functions that run our app.",
      "Stripe: payments. Card details go directly to Stripe and never touch our servers.",
      "Resend: sends our deadline-alert and account emails.",
      "PostHog: product analytics, only for signed-in users. You are identified by an internal user ID with no name or email. Automatic click capture is turned off.",
      "Sentry: error reports, only if enabled. It is set up not to collect personal information.",
      "We do not send your profile data to scholarship providers. You choose what to submit and where.",
    ],
  },
  {
    heading: "Emails",
    body: [
      "We send deadline reminders for scholarships you track, Season Pass ending reminders, and payment notices.",
      "Every email has an unsubscribe link. You can also turn email alerts off with the toggle on your dashboard.",
    ],
  },
  {
    heading: "How long we keep it",
    body: [
      "We keep your account and profile data in our database as long as your account is active. If you delete your account, we remove your profile, saved letters, and tracked applications from our database. We may keep billing records where we are required to for tax or legal reasons.",
    ],
  },
  {
    heading: "Your choices",
    body: [
      "You can edit or remove most profile fields yourself at any time.",
      "To download a copy of your data, or to delete your account, contact us at privacy@meritlaunch.com. Deleting your account removes your profile, saved letters, and tracked applications from our database.",
      "Clearing your browser storage removes the copy kept on your device.",
      "You can unsubscribe from emails with the link in any email, or turn alerts off from the toggle on your dashboard.",
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
      "Questions about this policy, or a data download or deletion request: privacy@meritlaunch.com.",
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
      "You own what you write and what you generate through MeritLaunch. Generated letters are drafts built from your own profile information. You're responsible for reviewing, editing, and fact-checking any letter before submitting it to a scholarship provider, and for following each scholarship's own rules about outside help or AI. You remain the author; MeritLaunch is a drafting aid, not a substitute for your own review and judgment.",
    ],
  },
  {
    heading: "Scholarship listings",
    body: [
      "We aggregate scholarship information from public sources and try to keep deadlines, amounts, and eligibility criteria current, but we can't guarantee every listing is accurate or still open. Always verify details on the scholarship provider's own site before applying or relying on a deadline.",
    ],
  },
  {
    heading: "Plans and billing",
    body: [
      "Free: 5 match runs and 2 AI letters per month, all 4 writing styles, the tracker, and deadline alerts.",
      "Premium, $9.99 per month: unlimited match runs, 50 AI letters per month, and scholarship import from a URL.",
      "Season Pass, $29.99 one time: everything in Premium for 4 months. It does not auto-renew.",
      "Premium is a recurring monthly subscription and renews automatically until canceled. You can cancel or manage billing at any time. Cancellation takes effect at the end of the current billing period. Payments are processed by Stripe. Refunds are handled case-by-case. Contact support@meritlaunch.com if something went wrong with a charge.",
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
      "Questions about these terms: support@meritlaunch.com.",
    ],
  },
];
