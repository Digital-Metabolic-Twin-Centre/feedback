import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  SQLITE_PATH: z.string().min(1).default("./data/feedback.db"),
  KEYCLOAK_REALM: z.string().min(1).optional(),
  KEYCLOAK_CLIENT_ID: z.string().min(1).optional(),
  KEYCLOAK_DOMAIN: z.string().url().optional(),
  KEYCLOAK_ISSUER_URL: z.string().min(1).optional(),
  KEYCLOAK_JWKS_URI: z.string().min(1).optional(),
  KEYCLOAK_CLIENT_SECRET: z.string().min(1).optional(),
  NEXTAUTH_SECRET: z.string().min(8), // required for CSRF token signing
  NEXTAUTH_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  NEXT_PUBLIC_CENTRAL_RESOURCES_FOLDER_ID: z.string().min(1).optional(),
  CENTRAL_RESOURCES_FOLDER_ID: z.string().min(1).optional(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().min(1).optional(),
  GOOGLE_PRIVATE_KEY: z.string().min(1).optional(),
  UPLOADS_PATH: z.string().min(1).default("./data/uploads"),
  COOKIE_DOMAIN: z.string().min(1).default("localhost"),
  GITLAB_ISSUES_REPORTING_TOKEN: z.string().min(1).optional(),
  GITLAB_REPORTING_PROJECT_ID: z.string().min(1).optional(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.string().min(1).optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  SMTP_FROM: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1).optional(),
  FEEDBACK_DISTRIBUTION_EMAILS: z.string().optional(),
  FEEDBACK_EMAIL_COOLDOWN_HOURS: z.coerce.number().int().min(0).max(168).default(4),
  MAIL_PROVIDER: z.string().optional(),
  FEEDBACK_BOOTSTRAP_TOKEN: z.string().min(16).optional(),
  NEXT_PUBLIC_FEEDBACK_API_URL: z.string().url().optional(),
});

const isBuildPhase =
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.NODE_ENV === 'test' ||
  process.env.SKIP_ENV_VALIDATION === 'true';

export const env = isBuildPhase
  ? (process.env as unknown as z.infer<typeof envSchema>) // skip validation for dummy build env
  : envSchema.parse(process.env); // enforce validation for runtime
