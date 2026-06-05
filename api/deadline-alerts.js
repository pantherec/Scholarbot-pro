import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL || "https://zudczsepvkjbjgomgilz.supabase.co",
  process.env.SUPABASE_SERVICE_KEY
);

// Resend email. If RESEND_API_KEY is unset, email is skipped gracefully
// (in-app notifications still work). RESEND_FROM must be a verified sender.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || "MeritLaunch <alerts@meritlaunch.com>";

async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY) return { skipped: true };
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
  });
  if (!resp.ok) throw new Error(`Resend ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

function buildDigestHtml(name, items) {
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
    <p style="color:#777;font-size:12px;margin-top:24px;">You're receiving this because you're tracking these scholarships in MeritLaunch.</p>
  </div>`;
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
      const deadline = new Date(scholarship.deadline);
      if (isNaN(deadline.getTime())) continue;
      const daysUntil = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
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
        .select("id, email, name")
        .in("id", userIds);
      const profileMap = {};
      (profiles || []).forEach((p) => { profileMap[p.id] = p; });

      for (const userId of userIds) {
        const profile = profileMap[userId];
        if (!profile || !profile.email) continue;
        const items = byUser[userId].sort((x, y) => x.daysUntil - y.daysUntil);
        const subject = items.length === 1
          ? `Deadline soon: ${items[0].scholarshipName}`
          : `${items.length} scholarship deadlines coming up`;
        try {
          await sendEmail(profile.email, subject, buildDigestHtml(profile.name, items));
          emailsSent++;
        } catch (e) {
          emailErrors++;
          console.error(`Email send failed for user ${userId}:`, e.message);
        }
      }
    }

    return res.status(200).json({
      success: true,
      alertsGenerated: alerts.length,
      emailsSent,
      emailErrors,
      emailEnabled: Boolean(RESEND_API_KEY),
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("Deadline alert error:", error);
    return res.status(500).json({ error: "Failed to process deadline alerts" });
  }
}
