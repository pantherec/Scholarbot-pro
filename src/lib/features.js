// Feature flags that change what the site promises. Flip one only when the
// thing it describes actually works in production.

// Deadline reminder emails go out through Resend. Until the meritlaunch.com
// sending domain is verified (DKIM and the send. subdomain), no email can
// leave, so the copy says "reminders in your account" and the opt-out toggle
// stays hidden. Set this to true after the first delivered send, and set
// EMAIL_REMINDERS_LIVE=true in Vercel in the same change: the daily job in
// api/deadline-alerts.js sends nothing until that server switch is on.
export const EMAIL_REMINDERS_LIVE = false;
