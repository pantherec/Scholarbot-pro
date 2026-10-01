import { createClient } from "@supabase/supabase-js";
import { verifyUnsubscribeToken } from "./_shared/email.js";

const supabase = createClient(
  process.env.SUPABASE_URL || "https://zudczsepvkjbjgomgilz.supabase.co",
  process.env.SUPABASE_SERVICE_KEY
);

function page(title, message) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head>
<body style="margin:0;background:#faf8f2;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
<div style="max-width:480px;margin:64px auto;padding:0 20px;">
<h1 style="color:#C9A227;font-size:24px;margin:0 0 12px 0;">MeritLaunch</h1>
<p style="font-size:16px;line-height:1.5;">${message}</p>
<p><a href="https://meritlaunch.com/app" style="color:#C9A227;">Go to your dashboard</a></p>
</div></body></html>`;
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).send(page("Not allowed", "That request isn't supported."));
  }

  const u = typeof req.query?.u === "string" ? req.query.u : "";
  const t = typeof req.query?.t === "string" ? req.query.t : "";

  if (!u || !t || !verifyUnsubscribeToken(u, t)) {
    return res.status(400).send(page("Link not valid", "This unsubscribe link isn't valid. You can turn email alerts off from your dashboard."));
  }

  try {
    const { error } = await supabase
      .from("user_profiles")
      .update({ email_alerts_opt_out: true })
      .eq("id", u);
    if (error) throw error;
    return res.status(200).send(page("Unsubscribed", "You're unsubscribed from MeritLaunch emails. You can turn alerts back on from your dashboard."));
  } catch (e) {
    console.error("Unsubscribe error:", e?.message || e);
    return res.status(500).send(page("Something went wrong", "Something went wrong on our end. Please try again in a bit, or turn email alerts off from your dashboard."));
  }
}
