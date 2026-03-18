import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL || "https://zudczsepvkjbjgomgilz.supabase.co",
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  // Verify cron secret or allow manual trigger
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Find applications with deadlines in the next 7 days
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Get all tracked applications with upcoming deadlines
    const { data: apps, error } = await supabase
      .from("applications")
      .select("*, user_profiles!inner(user_id, profile_data)")
      .in("status", ["interested", "in_progress"])
      .not("scholarship_id", "is", null);

    if (error) {
      console.error("Failed to fetch applications:", error);
      return res.status(500).json({ error: "Failed to fetch applications" });
    }

    // Cross-reference with scholarships to check deadlines
    const scholarshipIds = [...new Set(apps.map(a => a.scholarship_id))];
    const { data: scholarships } = await supabase
      .from("scholarships")
      .select("id, name, deadline")
      .in("id", scholarshipIds);

    const deadlineMap = {};
    (scholarships || []).forEach(s => { deadlineMap[s.id] = s; });

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

    // For now, log alerts. In production, integrate with an email service
    // (Resend, SendGrid, or Supabase Edge Functions with email)
    console.log(`Found ${alerts.length} deadline alerts to send`);

    // Store alerts in a notifications table for in-app display
    if (alerts.length > 0) {
      const notifications = alerts.map(a => ({
        user_id: a.userId,
        type: "deadline_alert",
        title: `${a.scholarshipName} deadline in ${a.daysUntil} day${a.daysUntil === 1 ? "" : "s"}`,
        body: `Your tracked scholarship "${a.scholarshipName}" has a deadline on ${new Date(a.deadline).toLocaleDateString()}. Status: ${a.status}.`,
        read: false,
        created_at: new Date().toISOString(),
      }));

      await supabase.from("notifications").upsert(notifications, {
        onConflict: "user_id,title",
        ignoreDuplicates: true,
      });
    }

    return res.status(200).json({
      success: true,
      alertsGenerated: alerts.length,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("Deadline alert error:", error);
    return res.status(500).json({ error: "Failed to process deadline alerts" });
  }
}
