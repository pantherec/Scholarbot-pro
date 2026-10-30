# MeritLaunch: Corey's six tasks before Nov 19 (written 2026-10-30)

Everything else from the Oct 30 review is being fixed in code. These six need your logins. Do them in
this order; the first one is the biggest speed-up on the site and takes about ten minutes. Say "done"
after each and I'll verify it from here. Never paste a secret into chat except the test-account
password (item 2), which I hold only in memory for the harness.

## 1. Upstash Redis (the 4.5-second delay on every draft, checkout and parent link), ~10 min

Why: production logs show "Rate limit Redis error … fetch failed" on every API call. The credentials
are set in Vercel but the database doesn't answer, so the paid routes also have no shared rate limit.

1. Open https://vercel.com, team **Synprax Labs**, project **scholarbot-pro**, then **Settings → Environment Variables**. Search `UPSTASH`. Note whether the two variables (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) are there and what the URL's host looks like (don't paste the token anywhere).
2. **If the URL ends in `upstash.io`:** go to https://console.upstash.com → **Redis**. Find the database with that host name.
   - If it says **Paused** or **Archived**: open it and click **Resume** (free databases pause after inactivity). Done with the console.
   - If it isn't there at all: click **Create Database**, name `meritlaunch-ratelimit`, type **Regional**, region **US-East-1 (N. Virginia)** (Vercel runs this project in `iad1`), TLS on, then **Create**. On its page, under **REST API**, copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
3. **If the URL ends in `vercel-storage.com` or the variables came from the Vercel Marketplace:** in Vercel go to the **Storage** tab of the project. If the store shows as suspended or missing, open it and follow the resume prompt, or create a new **Upstash Redis** store from **Storage → Create → Marketplace → Upstash**, connect it to scholarbot-pro (that writes the variables for you).
4. If you copied new values in step 2: back in **Settings → Environment Variables**, edit each of the two variables, paste the new value, environment **Production** (and Preview), **Save**.
5. Redeploy, because env vars bake at build time: **Deployments → the top production deployment → ⋯ → Redeploy**, leave "Use existing Build Cache" unticked, confirm.
6. Check (2 min after the deploy turns Ready): open https://meritlaunch.com/pay/test in a private window. The page should settle (to "This link has expired") within about one second instead of five. Tell me and I'll confirm from the logs.

## 2. The test-account password, ~2 min (or ~10 if you've lost it)

Why: the critic can only read real drafts by signing in to the five test accounts
(`coreyskinner+lexitest@…`, `+ethantest`, `+mariatest`, `+amaratest`, `+weitest`). It is the only
way to prove the invented-facts fix works on live drafts.

- If you have it: paste it in chat as "password: …". I'll pass it to the harness as an environment variable and never write it to a file.
- If you don't: open https://supabase.com/dashboard → project **ScholarBot Pro** (`zudczsepvkjbjgomgilz`) → **Authentication → Users**, search `+lexitest`, open the row menu (⋯) → **Send password recovery**. The email lands in your Gmail (all five are aliases of your inbox). Set a new password. Repeat for the other four with the same password, or just tell me "rotate them" and I'll set one password on all five with the service key and hand it to you in chat.

## 3. Resend DNS (deadline reminder emails), ~10 min, then a wait

Why: `resend._domainkey.meritlaunch.com` doesn't exist, so Resend can't send as `alerts@meritlaunch.com`.
Reminders stay switched off in code (`EMAIL_REMINDERS_LIVE = false`) until the first real email arrives.

1. https://resend.com → **Domains → Add Domain** → `meritlaunch.com`, region **North Virginia (us-east-1)** → **Add**.
2. Resend shows three records. Keep that tab open. Typically: a **TXT** at `resend._domainkey` (the DKIM key), an **MX** at `send` (priority 10, `feedback-smtp.us-east-1.amazonses.com`), and a **TXT** at `send` (`v=spf1 include:amazonses.com ~all`). Copy each exactly from Resend's page; don't type them from here.
3. DNS lives at Vercel: https://vercel.com → team **Synprax Labs** → **Domains → meritlaunch.com → DNS Records**. Add the three records with the Name column exactly as Resend shows it (`resend._domainkey` and `send`, without the domain). Do **not** touch the existing apex SPF, DKIM (`google._domainkey`) or DMARC records; Google Workspace mail depends on them, and Resend's SPF goes on the `send` subdomain only.
4. Back in Resend click **Verify DNS Records**. It usually turns green in a few minutes; allow up to an hour.
5. Only after it's verified: in Vercel **Settings → Environment Variables** add `RESEND_API_KEY` (from Resend → **API Keys → Create**, sending access only) and `RESEND_FROM` = `MeritLaunch <alerts@meritlaunch.com>`, Production, then redeploy. (Setting the key before the domain verifies makes every send throw.)
6. Tell me. I'll trigger one reminder to a test account, confirm it arrived, then flip `EMAIL_REMINDERS_LIVE` to true so the site may promise emails again.

## 4. Sentry (error alerts), ~5 min

Why: the code and the security headers are ready; only the key is missing, so no production error reaches you today.

1. https://sentry.io → sign in (or create an org named **Synprax Labs** on the free Developer plan).
2. **Projects → Create Project → React**, name `meritlaunch`, alert me on every new issue, **Create**.
3. Copy the **DSN** it shows (looks like `https://…@…ingest.sentry.io/…`).
4. Vercel → scholarbot-pro → **Settings → Environment Variables → Add**: name `VITE_SENTRY_DSN`, value the DSN, environment **Production** only. **Save**, then **Redeploy** (same as step 1.5).
5. Check: the DSN is public by design, so it's fine that it ends up in the page. I'll confirm the bundle picked it up and that the CSP allows the ingest host.

## 5. One refund sentence, ~2 min

Why: the terms say "Refunds are handled case-by-case" and the parent page and upgrade dialog say nothing.
A parent paying for a 17-year-old wants one plain sentence. Pick one (or write your own) and I'll put the
same sentence in all three places:

- **A (simplest):** "If MeritLaunch isn't right for your student, email support@meritlaunch.com within 14 days of your first payment and we'll refund it in full."
- **B (subscription-shaped):** "Cancel any time; you keep access until the end of the period you paid for. Charged by mistake, or unhappy in the first 14 days? Email support@meritlaunch.com for a full refund."
- **C (one-time pass included):** "Full refund within 14 days of any first payment, Premium or Season Pass; just email support@meritlaunch.com."

Reply with the letter. (Stripe refunds are issued from the Stripe dashboard; the webhook doesn't need to change for a manual refund.)

## 6. Social proof, no deadline, consented quotes only

Why: the landing has no testimonials, which is correct; nothing may be invented. Real ones come from real
families, and you'll have some within two weeks of launch if you ask.

1. Decide who may be quoted: parents (first name, state, "parent of a senior") and students 18+; under-18 students only through a parent's words. Never a school name.
2. After launch, when a family has saved a letter or paid, send one short email from `corey@synpraxlabs.com` reply-as `support@meritlaunch.com`: what did MeritLaunch do for you this week, in a sentence or two, and may we quote you by first name and state on meritlaunch.com? (I'll draft the email when you say so; it goes out from you.)
3. Keep each "yes" (the email itself) in a `Consent` label in Gmail. That's the record.
4. Send me the approved quotes and I'll add them to the landing with first name and state only. Until then the page stays quiet.

## After you're done

Items 1 and 4 need a redeploy each; do them together to save a build. When 1 and 2 are done I run the
real drafts on two test accounts and close the "unverified" list in the review. When 3 is verified I
flip the email flag. The code fixes from the review are on branch `critic-1030/*` and will come to you
as one pull request.
