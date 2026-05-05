import nodemailer from "nodemailer";
import { Resend } from "resend";
import { recordNotificationAudit, getRecentlyNotified } from "@/lib/feedback/sqlite-queries";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const DEFAULT_FEEDBACK_EMAIL_COOLDOWN_HOURS = 4;

function redactEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const [localPart, domain] = normalized.split("@");
  if (!localPart || !domain) return "redacted";
  if (localPart.length <= 2) return `**@${domain}`;
  return `${localPart.slice(0, 2)}***@${domain}`;
}

function parseCommaSeparatedEmails(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const deduped = new Set<string>();
  for (const token of raw.split(",")) {
    const email = token.trim().toLowerCase();
    if (!email || !EMAIL_REGEX.test(email)) continue;
    deduped.add(email);
  }
  return Array.from(deduped);
}

function buildFeedbackUrl(feedbackId: number): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "";
  const base = appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;
  return base
    ? `${base}/api/v1/admin/feedback?feedbackId=${feedbackId}`
    : `/api/v1/admin/feedback?feedbackId=${feedbackId}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getFeedbackEmailCooldownHours(): number {
  const raw = (process.env.FEEDBACK_EMAIL_COOLDOWN_HOURS ?? "").trim();
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_FEEDBACK_EMAIL_COOLDOWN_HOURS;
  return Math.min(Math.floor(parsed), 168);
}

function getFeedbackDistributionRecipients(): string[] {
  return parseCommaSeparatedEmails(process.env.FEEDBACK_DISTRIBUTION_EMAILS);
}

async function sendEmailToRecipients(input: {
  recipients: string[];
  subject: string;
  text: string;
  html: string;
  context: string;
  auditSessionId: string;
  feedbackId?: number;
}): Promise<void> {
  const { recipients, subject, text, html, context, auditSessionId, feedbackId } = input;
  if (recipients.length === 0) return;

  const normalizedRecipients = Array.from(
    new Set(recipients.map((r) => r.trim().toLowerCase()).filter(Boolean))
  );
  if (normalizedRecipients.length === 0) return;

  const cooldownHours = getFeedbackEmailCooldownHours();

  // Cooldown guard: one feedback notification email per recipient within configured hours.
  const recentlyNotified = getRecentlyNotified(
    normalizedRecipients,
    "feedback_%:%",
    cooldownHours
  );
  const eligibleRecipients = normalizedRecipients.filter((r) => !recentlyNotified.has(r));

  if (eligibleRecipients.length === 0) {
    console.info(`[${context}] Skipped: all recipients notified in the last ${cooldownHours} hours.`);
    return;
  }

  const provider = (process.env.MAIL_PROVIDER || "disabled").toLowerCase();

  try {
    if (provider === "disabled" || provider === "") {
      console.info(`[${context}] ✉️ Email would be sent (dev mode)`);
      console.info(`[${context}] Subject: ${subject}`);
      console.info(
        `[${context}] Metadata: ${JSON.stringify({
          feedbackId: feedbackId ?? null,
          recipientCount: eligibleRecipients.length,
          recipients: eligibleRecipients.map(redactEmail),
          auditSessionId,
        })}`
      );
      return;
    }

    if (provider !== "resend" && provider !== "smtp") {
      console.warn(`[${context}] Unknown MAIL_PROVIDER:`, provider);
      return;
    }

    const sentRecipients: string[] = [];
    const resend = provider === "resend" ? new Resend(process.env.RESEND_API_KEY) : null;
    const transporter =
      provider === "smtp"
        ? nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: false,
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
          })
        : null;

    for (const recipient of eligibleRecipients) {
      if (provider === "resend" && resend) {
        const { error } = await resend.emails.send({
          from: process.env.SMTP_FROM as string,
          to: [recipient],
          subject,
          text,
          html,
        });
        if (error) throw error;
        sentRecipients.push(recipient);
      } else if (provider === "smtp" && transporter) {
        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: recipient,
          subject,
          text,
          html,
        });
        sentRecipients.push(recipient);
      }
    }

    recordNotificationAudit(auditSessionId, sentRecipients);
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message ?? "Unknown error")
        : "Unknown error";

    console.warn(`[${context}] Email provider unavailable; suppressing outbound delivery.`);
    console.warn(`[${context}] Reason: ${message}`);
    console.info(`[${context}] Subject: ${subject}`);
    console.info(
      `[${context}] Metadata: ${JSON.stringify({
        feedbackId: feedbackId ?? null,
        recipientCount: eligibleRecipients.length,
        recipients: eligibleRecipients.map(redactEmail),
        auditSessionId,
      })}`
    );

    // Record the attempt so cooldown still applies during outages.
    recordNotificationAudit(auditSessionId, eligibleRecipients);
  }
}

export async function notifyfeedbackubmitted(input: {
  feedbackId: number;
  submittedByEmail: string;
  page?: string | null;
}): Promise<void> {
  const recipients = getFeedbackDistributionRecipients();
  if (recipients.length === 0) return;

  const feedbackUrl = buildFeedbackUrl(input.feedbackId);
  const pageText = input.page?.trim() ? input.page.trim() : "N/A";
  const submittedBy = input.submittedByEmail.trim().toLowerCase();
  const submittedBySafe = escapeHtml(submittedBy);
  const pageTextSafe = escapeHtml(pageText);
  const feedbackUrlSafe = escapeHtml(feedbackUrl);

  const subject = `Feedback submitted (#${input.feedbackId})`;
  const text = [
    "A new feedback item was submitted.",
    "",
    `Feedback ID: ${input.feedbackId}`,
    `Submitted by: ${submittedBy}`,
    `Page: ${pageText}`,
    `Open: ${feedbackUrl}`,
  ].join("\n");

  const html = `
    <p>A new feedback item was submitted.</p>
    <ul>
      <li><strong>Feedback ID:</strong> ${input.feedbackId}</li>
      <li><strong>Submitted by:</strong> ${submittedBySafe}</li>
      <li><strong>Page:</strong> ${pageTextSafe}</li>
    </ul>
    <p><a href="${feedbackUrlSafe}">Open feedback</a></p>
  `;

  await sendEmailToRecipients({
    recipients,
    subject,
    text,
    html,
    context: "notifyfeedbackubmitted",
    auditSessionId: `feedback_submitted:${input.feedbackId}`,
    feedbackId: input.feedbackId,
  });
}

export async function notifyfeedbackubmitterOfReply(input: {
  feedbackId: number;
  submitterEmail: string;
  replierEmail: string;
  replierRole: "Admin" | "User";
}): Promise<void> {
  const submitter = input.submitterEmail.trim().toLowerCase();
  const replier = input.replierEmail.trim().toLowerCase();

  if (!EMAIL_REGEX.test(submitter)) return;
  if (submitter === replier) return;

  const feedbackUrl = buildFeedbackUrl(input.feedbackId);
  const replierSafe = escapeHtml(replier);
  const feedbackUrlSafe = escapeHtml(feedbackUrl);

  const subject = `New reply on your feedback (#${input.feedbackId})`;
  const text = [
    "A new reply was added to your feedback.",
    "",
    `Feedback ID: ${input.feedbackId}`,
    `Replied by: ${input.replierRole} (${replier})`,
    `Open: ${feedbackUrl}`,
  ].join("\n");

  const html = `
    <p>A new reply was added to your feedback.</p>
    <ul>
      <li><strong>Feedback ID:</strong> ${input.feedbackId}</li>
      <li><strong>Replied by:</strong> ${input.replierRole} (${replierSafe})</li>
    </ul>
    <p><a href="${feedbackUrlSafe}">Open feedback</a></p>
  `;

  await sendEmailToRecipients({
    recipients: [submitter],
    subject,
    text,
    html,
    context: "notifyfeedbackubmitterOfReply",
    auditSessionId: `feedback_reply:${input.feedbackId}`,
    feedbackId: input.feedbackId,
  });
}

export async function notifyFeedbackDistributionOfReply(input: {
  feedbackId: number;
  submitterEmail: string;
  replierEmail: string;
  replierRole: "Admin" | "User";
}): Promise<void> {
  const replier = input.replierEmail.trim().toLowerCase();
  const submitter = input.submitterEmail.trim().toLowerCase();

  const recipients = getFeedbackDistributionRecipients();
  if (recipients.length === 0) return;

  const feedbackUrl = buildFeedbackUrl(input.feedbackId);
  const replierSafe = escapeHtml(replier);
  const submitterSafe = escapeHtml(submitter || "unknown");
  const feedbackUrlSafe = escapeHtml(feedbackUrl);

  const subject = `New response on feedback (#${input.feedbackId})`;
  const text = [
    "A new response was added to a feedback thread.",
    "",
    `Feedback ID: ${input.feedbackId}`,
    `Feedback owner: ${submitter || "unknown"}`,
    `Replied by: ${input.replierRole} (${replier})`,
    `Open: ${feedbackUrl}`,
  ].join("\n");

  const html = `
    <p>A new response was added to a feedback thread.</p>
    <ul>
      <li><strong>Feedback ID:</strong> ${input.feedbackId}</li>
      <li><strong>Feedback owner:</strong> ${submitterSafe}</li>
      <li><strong>Replied by:</strong> ${input.replierRole} (${replierSafe})</li>
    </ul>
    <p><a href="${feedbackUrlSafe}">Open feedback</a></p>
  `;

  await sendEmailToRecipients({
    recipients,
    subject,
    text,
    html,
    context: "notifyFeedbackDistributionOfReply",
    auditSessionId: `feedback_reply_admin:${input.feedbackId}`,
    feedbackId: input.feedbackId,
  });
}
