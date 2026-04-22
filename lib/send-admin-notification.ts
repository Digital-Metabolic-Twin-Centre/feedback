import { pgPool } from "@/lib/db";
import nodemailer from "nodemailer";
import { logError } from "@/lib/error-logger";
import { Resend } from "resend";
import { getAdminNotificationEmails, getAdverseEventNotificationEmails } from "./queries/select/administrative/recon4imd-contacts";


type SendAdminNotificationInput = {
  type: "authentication" | "adverse_event";
  sessionId: string;
  subject: string;
  text: string;
  html: string;
  userEmail?: string | null;
  ae_serious?: boolean | null;
  participant_id?: string | null;
};

function redactIdentifier(value: string | null | undefined): string {
  if (!value) return "redacted";
  if (value.length <= 4) return "****";
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

/**
 * Gets the list of admin email recipients from environment variables.
 * For sending notification emails to admins.
 * @returns {string[]} Array of admin email addresses
 */


async function getAdminRecipients(
  type: "authentication" | "adverse_event",
  ae_serious?: boolean | null,
  participant_id?: string | null
): Promise<string[]> {

  if (type === "authentication") {
    return await getAdminNotificationEmails();
  }

  if (type === "adverse_event") {
    if (!participant_id) {
      console.warn("[notification] Missing participant_id for AE notification");
      return [];
    }

    return await getAdverseEventNotificationEmails(
      ae_serious,
      participant_id)
  }

  return [];
}

async function hasRecentNoGroupNotification(
  userEmail: string
): Promise<boolean> {
  const client = await pgPool.connect();
  try {
    const res = await client.query(
      `
      SELECT 1
      FROM imdhub_logs.no_group_notifications
      WHERE user_email = $1
        AND created_at > now() - interval '24 hours'
      LIMIT 1
      `,
      [userEmail]
    );
    return (res.rowCount ?? 0) > 0;
  } finally {
    client.release();
  }
}

async function recordNotificationAudit(sessionId: string, userEmail: string) {
  const client = await pgPool.connect();
  try {
    await client.query(
      `
      INSERT INTO imdhub_logs.no_group_notifications (session_id, user_email)
      VALUES ($1,$2)
      `,
      [sessionId, userEmail]
    );
  } finally {
    client.release();
  }
}

/**
 * Function to send email notification to admins or users when required
 * This MUST NOT throw, auth should never fail because email failed
 */

export async function sendAdminNotification({
  type,
  text,
  html,
  subject,
  userEmail,
  sessionId,
  ae_serious,
  participant_id
}: SendAdminNotificationInput): Promise<void> {

  const recipients = await getAdminRecipients(type, ae_serious, participant_id);

  if (!userEmail) return;

  const alreadySent = await hasRecentNoGroupNotification(userEmail);

  if (alreadySent && type === "authentication") {
    console.info("[admin-notify] Skipped duplicate authentication notification within 24h");
    return;
  }

  try {
    const provider = (process.env.MAIL_PROVIDER || "disabled").toLowerCase();

    // DEV MODE
    if (provider === "disabled" || provider === "") {
      console.info("[admin-notify] ✉️ Email would be sent (dev mode)");
      console.info("[admin-notify] Recipient count:", recipients.length);
      console.info("[admin-notify] Subject:", subject);
      console.info("[admin-notify] User:", redactIdentifier(userEmail));
      console.info("[admin-notify] Session:", redactIdentifier(sessionId));
      console.info("[admin-notify] AE Serious:", ae_serious ?? "n/a");
      if (participant_id) {
        console.info("[admin-notify] Participant ID:", redactIdentifier(participant_id));
      }

      await recordNotificationAudit(sessionId, userEmail);
      return;
    } else if (provider === "resend") {

      // RESEND PROVIDER
      const resend = new Resend(process.env.RESEND_API_KEY);

      const { error } = await resend.emails.send({
        from: process.env.SMTP_FROM as string,
        to: recipients,
        subject,
        text,
        html,
      });

      if (error) {
        throw error;
      }
    } else if (provider === "smtp") {

      // SMTP PROVIDER
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: recipients,
        subject,
        text,
        html,
      });
    } else {
      console.warn("[admin-notify] Unknown MAIL_PROVIDER:", provider);
      return;
    }

    await recordNotificationAudit(sessionId, userEmail);

  } catch (error) {
    // MUST NOT break auth flow
    console.error("[admin-notify] Failed to send email");

    logError(
      error,
      {
        operation: "sendAdminNotification",
        metadata: {
          userEmail: redactIdentifier(userEmail),
          sessionId: redactIdentifier(sessionId),
          recipientCount: recipients.length,
        },
      },
      "error"
    );
  }
}
