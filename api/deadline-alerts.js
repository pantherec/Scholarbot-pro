import { createClient } from "@supabase/supabase-js";
import { sendEmail, emailFooter } from "./_shared/email.js";

const supabase = createClient(
  process.env.SUPABASE_URL || "https://zudczsepvkjbjgomgilz.supabase.co",
  process.env.SUPABASE_SERVICE_KEY
);

// Email goes through the shared Resend helper. If RESEND_API_KEY is unset,
// email is skipped gracefully (in-app notifications still work).
const RESEND_API_KEY = process.env.RESEND_API_KEY;

function buildSeasonEndingHtml(name, endDate, userId) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
    <h2 style="color:#c9a227;margin-bottom:4px;">Your Season Pass ends ${endDate}</h2>
    <p>Hi${name ? " " + name : ""}, just a friendly heads-up: your MeritLaunch Season Pass access ends on ${endDate}.</p>
    <p>Your saved letters and your tracker stay available on the free plan, so nothing you've built goes away.</p>
    <p>If you'd like more time with full access, you can renew anytime from your dashboard.</p>
    <p><a href="https://meritlaunch.com/app" style="color:#c9a227;">Open MeritLaunch</a></p>
    ${emailFooter(userId)}
  </div>`;
}

function buildDigestHtml(name, items, userId) {
  const rows = items
    .map(
      (a) =>
        `<li style="margin:0 0 10px 0;"><strong>${a.scholarshipName}</strong> - due ${new Date(
          a.deadline
        ).toLocaleDateString()} (${a.daysUntil} day${a.daysUntil === 1 ? "" : "s"} left)</li>`
    )
    .join("");
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
    <h2 style="color:#c9a227;margin-bottom:4px;">MeritLaunch deadline reminder</h2>
    <p>Hi${name ? " " + name : ""}, here ${items.length === 1 ? "is" : "are"} ${items.length} scholarship deadline${
    items.length === 1 ? "" : "s"
  } coming up in the next week:</p>
    <ul style="padding-left:18px;">${rows}</ul>
    <p style="margin-top:18px;">Open MeritLaunch to finish your application and generate a letter.</p>
    ${emailFooter(userId)}
  </div>`;
}

// Deadlines arrive as ISO dates ("2026-09-15"), recurring year-less dates
// ("Mar 1"), or free text ("Varies", "Rolling"). `new Date("Mar 1")` resolves to
// the year 2001, so those rows produced a hugely negative daysUntil and never
// fired a reminder — every recurring-deadline scholarship was silently skipped.
// NOTE: src/App.jsx carries a copy of this parser — keep them in sync.
function parseDeadlineDate(deadline) {
  if (!deadline || typeof deadline !== "string") return null;
  const raw = deadline.trim();
  if (!raw || /^(varies|rolling|ongoing|nomination only|n\/?a|tbd|none|open)$/i.test(raw)) return null;

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);

  if (!/\d{4}/.test(raw)) {
    const probe = new Date(`${raw.replace(/(\d+)(st|nd|rd|th)\b/i, "$1")} 2000`);
    if (!isNaN(probe)) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let next = new Date(now.getFullYear(), probe.getMonth(), probe.getDate());
      if (next < today) next = new Date(now.getFullYear() + 1, probe.getMonth(), probe.getDate());
      return next;
    }
  }

  const d = new Date(raw);
  return isNaN(d) ? null : d;
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const now = new Date();

    const { data: apps, error } = await supabase
      .from("applications")
      .select("*")
      .in("status", ["interested", "in_progress"])
      .not("scholarship_id", "is", null);

    if (error) {
      console.error("Failed to fetch applications:", error);
      return res.status(500).json({ error: "Failed to fetch applications" });
    }

    const scholarshipIds = [...new Set(apps.map((a) => a.scholarship_id))];
    const { data: scholarships } = await supabase
      .from("scholarships")
      .select("id, name, deadline")
      .in("id", scholarshipIds);

    const deadlineMap = {};
    (scholarships || []).forEach((s) => { deadlineMap[s.id] = s; });

    const alerts = [];
    for (const app of apps) {
      const scholarship = deadlineMap[app.scholarship_id];
      if (!scholarship || !scholarship.deadline) continue;
      const deadline = parseDeadlineDate(scholarship.deadline);
      if (!deadline) continue;
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const daysUntil = Math.round((deadline - today) / 86400000);
      if (daysUntil >= 0 && daysUntil <= 7) {
        alerts.push({
          userId: app.user_id,
          scholarshipName: scholarship.name,
          deadline: scholarship.deadline,
          daysUntil,
          status: app.status,
        });
      }
    }

    console.log(`Found ${alerts.length} deadline alerts to send`);

    if (alerts.length > 0) {
      const notifications = alerts.map((a) => ({
        user_id: a.userId,
        type: "deadline_alert",
        title: `${a.scholarshipName} deadline in ${a.daysUntil} day${a.daysUntil === 1 ? "" : "s"}`,
        body: `Your tracked scholarship "${a.scholarshipName}" has a deadline on ${new Date(
          a.deadline
        ).toLocaleDateString()}. Status: ${a.status}.`,
        read: false,
        created_at: new Date().toISOString(),
      }));
      await supabase.from("notifications").upsert(notifications, {
        onConflict: "user_id,title",
        ignoreDuplicates: true,
      });
    }

    let emailsSent = 0, emailErrors = 0;
    if (alerts.length > 0 && RESEND_API_KEY) {
      const byUser = {};
      for (const a of alerts) (byUser[a.userId] = byUser[a.userId] || []).push(a);
      const userIds = Object.keys(byUser);
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, email, name, email_alerts_opt_out")
        .in("id", userIds);
      const profileMap = {};
      (profiles || []).forEach((p) => { profileMap[p.id] = p; });

      for (const userId of userIds) {
        const profile = profileMap[userId];
        if (!profile || !profile.email) continue;
        if (profile.email_alerts_opt_out) continue;
        const items = byUser[userId].sort((x, y) => x.daysUntil - y.daysUntil);
        const subject = items.length === 1
          ? `Deadline soon: ${items[0].scholarshipName}`
          : `${items.length} scholarship deadlines coming up`;
        try {
          await sendEmail(profile.email, subject, buildDigestHtml(profile.name, items, userId));
          emailsSent++;
        } catch (e) {
          emailErrors++;
          console.error(`Email send failed for user ${userId}:`, e.message);
        }
      }
    }

    // Job 2: Season Pass ending within 7 days.
    let seasonEndingNotices = 0, seasonEndingEmails = 0;
    try {
      const weekOut = new Date(now.getTime() + 7 * 86400000);
      const { data: ending, error: endErr } = await supabase
        .from("user_profiles")
        .select("id, email, name, seasonal_expires_at, email_alerts_opt_out")
        .eq("subscription_status", "seasonal")
        .gte("seasonal_expires_at", now.toISOString())
        .lte("seasonal_expires_at", weekOut.toISOString());
      if (endErr) throw endErr;

      const rows = [];
      for (const p of ending || []) {
        const endDate = new Date(p.seasonal_expires_at).toLocaleDateString("en-US", {
          month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
        });
        rows.push({
          user_id: p.id,
          type: "season_ending",
          title: `Your Season Pass ends ${endDate}`,
          body: "Your saved letters and tracker stay available on the free plan. You can renew anytime from your dashboard.",
          read: false,
          created_at: new Date().toISOString(),
        });
        p._endDate = endDate;
      }
      if (rows.length > 0) {
        await supabase.from("notifications").upsert(rows, {
          onConflict: "user_id,title",
          ignoreDuplicates: true,
        });
        seasonEndingNotices = rows.length;
      }

      if (RESEND_API_KEY) {
        for (const p of ending || []) {
          if (!p.email || p.email_alerts_opt_out) continue;
          try {
            await sendEmail(
              p.email,
              `Your Season Pass ends ${p._endDate}`,
              buildSeasonEndingHtml(p.name, p._endDate, p.id)
            );
            seasonEndingEmails++;
          } catch (e) {
            emailErrors++;
            console.error(`Season-ending email failed for user ${p.id}:`, e.message);
          }
        }
      }
    } catch (e) {
      console.error("Season-ending job error:", e.message || e);
    }

    return res.status(200).json({
      success: true,
      alertsGenerated: alerts.length,
      emailsSent,
      emailErrors,
      seasonEndingNotices,
      seasonEndingEmails,
      emailEnabled: Boolean(RESEND_API_KEY),
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("Deadline alert error:", error);
    return res.status(500).json({ error: "Failed to process deadline alerts" });
  }
}
