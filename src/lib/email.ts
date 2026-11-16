// Sends an email. Every email is saved to the "emails" table (shown in the
// app's Inbox page). If RESEND_API_KEY is set it is also sent for real.
// Email is a side effect: it never throws, so a failed email can't break a save.
import { now, run } from "./db";

// Full address of the app, for links inside emails.
function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3001";
}

export async function sendEmail(to: string, subject: string, body: string, linkPath?: string) {
  const link = linkPath ? `${appUrl()}${linkPath}` : "";
  const text = link ? `${body}\n${link}` : body;
  let sentVia = "inbox only (no RESEND_API_KEY)";
  const key = process.env.RESEND_API_KEY;
  if (key) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "PMS <onboarding@resend.dev>",
          to,
          subject,
          html: `<p>${body.replace(/\n/g, "<br>")}</p>${link ? `<p><a href="${link}">Open in ReviewDesk</a></p>` : ""}`,
        }),
      });
      sentVia = res.ok ? "resend" : `resend failed (${res.status})`;
      if (!res.ok) console.error("Resend error:", await res.text());
    } catch (e) {
      sentVia = "resend failed";
      console.error("Email failed:", e);
    }
  }
  try {
    await run("INSERT INTO emails (to_email, subject, body, sent_via, created_at) VALUES ($1, $2, $3, $4, $5)",
      to, subject, text, sentVia, now());
  } catch (e) {
    console.error("Could not save email:", e);
  }
}
