// Reminder email is OFF unless EMAIL_REMINDERS_LIVE=true is set in Vercel,
// whatever keys are present. The privacy policy and the in-app copy say no
// reminder emails are sent until this switch and its client twin
// (EMAIL_REMINDERS_LIVE in src/lib/features.js) are flipped together.
export const emailRemindersLive = (env = process.env) =>
  Boolean(env.RESEND_API_KEY) && env.EMAIL_REMINDERS_LIVE === "true";
