import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  SQLITE_PATH: z.string().min(1).default("./data/feedback.db"),

  NEXTAUTH_SECRET: z.string().min(8).optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_FEEDBACK_API_URL: z.string().url().optional(),

  FEEDBACK_BOOTSTRAP_TOKEN: z.string().min(16).optional(),

  GITLAB_ISSUES_REPORTING_TOKEN: z.string().min(1).optional(),
  GITLAB_REPORTING_PROJECT_ID: z.string().min(1).optional(),

  GITHUB_ISSUES_REPORTING_TOKEN: z.string().min(1).optional(),
  GITHUB_REPORTING_OWNER: z.string().min(1).optional(),
  GITHUB_REPORTING_REPO: z.string().min(1).optional(),

  MAIL_PROVIDER: z.string().optional(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.string().min(1).optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  SMTP_FROM: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),

  FEEDBACK_DISTRIBUTION_EMAILS: z.string().optional(),
  FEEDBACK_EMAIL_COOLDOWN_HOURS: z.coerce.number().int().min(0).max(168).default(4),
});

const isBuildPhase =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.NODE_ENV === "test" ||
  process.env.SKIP_ENV_VALIDATION === "true";

export const env = isBuildPhase
  ? (process.env as unknown as z.infer<typeof envSchema>)
  : envSchema.parse(process.env);
