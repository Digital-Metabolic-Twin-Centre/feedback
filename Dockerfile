# Install dependencies (only prod for runtime)
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Build stage
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Ensure devDependencies are installed in this stage
ENV NODE_ENV=development
ENV NPM_CONFIG_PRODUCTION=false

# Copy only manifests first to leverage caching
COPY package.json package-lock.json ./

RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-factor 2 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000


RUN npm ci

# Copy the rest
COPY . .

# Optional: assert that TypeScript is resolvable (fails build if not)
RUN node -e "console.log('TypeScript:', require('typescript').version)"

# Ensure clean build by removing any copied .next directory
RUN rm -rf .next

ENV NEXTAUTH_URL="http://localhost:4001"
ENV NEXT_PUBLIC_APP_URL="http://localhost:4001"
ENV NEXT_PUBLIC_FEEDBACK_API_URL="http://localhost:4001"
ENV SQLITE_PATH="./data/feedback.db"
ENV MAIL_PROVIDER="disabled"
ENV SMTP_HOST="localhost"
ENV SMTP_PORT="25"
ENV SMTP_USER="dummy"
ENV SMTP_PASS="dummy"
ENV SMTP_FROM="dummy@example.com"
ENV GITLAB_REPORTING_PROJECT_ID="dummy"

# Memory tweak for Next build
ENV NODE_OPTIONS="--max-old-space-size=4096"

RUN SKIP_ENV_VALIDATION=true \
    NEXTAUTH_SECRET="dummy-secret-for-build-only" \
    FEEDBACK_BOOTSTRAP_TOKEN="dummy-bootstrap-token" \
    GITLAB_ISSUES_REPORTING_TOKEN="dummy" \
    npm run build

RUN rm -f .env .env.local || true

# Production runtime
FROM node:22-bookworm-slim AS runner
WORKDIR /app

# Install runtime utilities
RUN apt-get update \
 && apt-get install -y --no-install-recommends bash curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Copy only required artifacts
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/data ./data

# Copy entrypoint
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Real secret only injected at runtime
ENV NODE_ENV=production

# Do NOT bake the secret into the image
# GitLab / Docker runtime will inject this automatically
# e.g., docker run -e NEXTAUTH_SECRET=$NEXTAUTH_SECRET image

EXPOSE 4001
ENTRYPOINT ["./entrypoint.sh"]
