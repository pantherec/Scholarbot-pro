# Supabase auth emails: send them from support@meritlaunch.com

*Written 2026-11-07 after Corey's own sign-up test: the confirmation email arrived from `Supabase Auth <noreply@mail.app.supabase.io>` with the subject "Confirm Your Signup". That is Supabase's built-in sender, which is meant for development only: it is rate-limited to a handful of emails per hour, it is not branded, and it lands in spam more often than a signed sender on our own domain. Fixing it is a dashboard change, not a code change.*

Project: `zudczsepvkjbjgomgilz` (the `VITE_SUPABASE_URL` in `.env`). Everything below happens at https://supabase.com/dashboard/project/zudczsepvkjbjgomgilz.

## 1. Custom SMTP through Resend (10 minutes, Corey only: it needs the Resend API key)

`meritlaunch.com` is already verified in Resend (the `alerts@` deadline emails use it), so no DNS work is needed.

1. Supabase dashboard → **Authentication → Emails → SMTP Settings** (older layout: Project Settings → Authentication → SMTP Settings). Turn on **Enable Custom SMTP**.
2. Fill in:
   - Sender email: `support@meritlaunch.com`
   - Sender name: `MeritLaunch`
   - Host: `smtp.resend.com`
   - Port: `465` (Resend also accepts 587 and 2465)
   - Username: `resend`
   - Password: the Resend API key (`re_...`). Paste it straight from the password manager into this field only; it never goes in the repo, a chat, or a doc.
   - Minimum interval between emails: leave the default.
3. Save. Then **Authentication → Rate Limits**: the "emails sent" limit was pinned low while the built-in sender was in use; raise it to something like 30 per hour so a launch-day burst of sign-ups does not get throttled.
4. Test: sign up with a `coreyskinner+smtp@gmail.com` style address and confirm the email arrives from `MeritLaunch <support@meritlaunch.com>` and passes DKIM (Gmail → Show original → "DKIM: PASS" for meritlaunch.com).

## 2. Make sure replies to support@ reach you

`support@meritlaunch.com` is a real inbox only if the ForwardEmail catch-all from `PORTFOLIO_EMAIL_SETUP.md` step 1 is in place for meritlaunch.com. Send a test to `support@meritlaunch.com` from your phone; if it does not arrive in Gmail, do that step first (MX records at Vercel DNS → forwardemail.net). Students will reply to the confirmation email, and a bouncing support address is worse than the Supabase sender.

## 3. Branded templates (Authentication → Emails → Templates)

Subjects first, since "Confirm Your Signup" is the first thing a new student reads.

| Template | Subject |
|---|---|
| Confirm signup | `Confirm your MeritLaunch account` |
| Reset password | `Reset your MeritLaunch password` |
| Magic link | `Your MeritLaunch sign-in link` |
| Change email address | `Confirm your new MeritLaunch email` |

Body for **Confirm signup** (plain, no images, so it renders everywhere and does not trip spam filters):

```html
<h2 style="font-family:Georgia,serif;font-weight:400">Welcome to MeritLaunch</h2>
<p>One click and your account is ready. This link confirms the email address you signed up with.</p>
<p><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 20px;background:#e8b923;color:#111;text-decoration:none;border-radius:8px;font-weight:600">Confirm my email</a></p>
<p>If the button does not work, copy this link into your browser:<br>{{ .ConfirmationURL }}</p>
<p style="color:#666;font-size:13px">You are getting this because someone entered this address at meritlaunch.com. If that was not you, ignore this email and nothing will happen.<br>Questions: reply to this email and it reaches a person at MeritLaunch.</p>
```

Body for **Reset password**:

```html
<h2 style="font-family:Georgia,serif;font-weight:400">Reset your password</h2>
<p>Use the link below to choose a new MeritLaunch password. It works once and expires after an hour.</p>
<p><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 20px;background:#e8b923;color:#111;text-decoration:none;border-radius:8px;font-weight:600">Choose a new password</a></p>
<p>If the button does not work, copy this link into your browser:<br>{{ .ConfirmationURL }}</p>
<p style="color:#666;font-size:13px">If you did not ask for a reset, ignore this email. Your password stays as it is.</p>
```

Keep `{{ .ConfirmationURL }}` exactly as written: Supabase fills it in.

## 4. Redirect URLs (check while you are there)

**Authentication → URL Configuration**: Site URL `https://meritlaunch.com`, and `https://meritlaunch.com/**` plus `http://localhost:5173/**` in Redirect URLs, so the confirmation link lands on the live app and the local dev build both work.

## What changed in the app (same day)

The "check your email" message after sign-up was a toast at `zIndex 9999`, and the auth modal's frosted backdrop sits at `10000`, so the toast rendered behind the blur and Corey never saw it. Now:

- the notice is shown inside the modal itself (`authNotice` in `App.jsx`, rendered in `AuthModal.jsx`), with the address it was sent to;
- toasts sit at `10001`, above any modal;
- a sign-in that fails with Supabase's "Email not confirmed" shows a plain-English explanation and a **Resend the confirmation email** link (`supabase.auth.resend({ type: "signup" })`).
