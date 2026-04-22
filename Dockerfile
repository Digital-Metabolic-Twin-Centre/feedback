# Install dependencies (only prod for runtime)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

# Build stage
FROM node:22-alpine AS builder
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

ENV SKIP_ENV_VALIDATION=true

# Dummy environment values to satisfy Zod / env validation during build
ENV NEXTAUTH_SECRET="dummy-secret-for-build-only"
ENV NEXTAUTH_URL="http://localhost:3000"
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV KEYCLOAK_REALM="dummy"
ENV KEYCLOAK_CLIENT_ID="dummy"
ENV KEYCLOAK_DOMAIN="http://localhost:8080"
ENV KEYCLOAK_ISSUER_URL="http://localhost:8080/realms/dummy"
ENV KEYCLOAK_JWKS_URI="http://localhost:8080/realms/dummy/protocol/openid-connect/certs"
ENV KEYCLOAK_CLIENT_SECRET="dummy"
ENV CENTRAL_RESOURCES_FOLDER_ID="dummy"
ENV GOOGLE_SERVICE_ACCOUNT_EMAIL="dummy@dummy.iam.gserviceaccount.com"
ENV GOOGLE_PRIVATE_KEY="dummy"
ENV SMTP_HOST="localhost"
ENV SMTP_PORT="25"
ENV SMTP_USER="dummy"
ENV SMTP_PASS="dummy"
ENV SMTP_FROM="dummy@example.com"
ENV GITLAB_ISSUES_REPORTING_TOKEN="dummy"
ENV GITLAB_REPORTING_PROJECT_ID="dummy"

# Memory tweak for Next build
ENV NODE_OPTIONS="--max-old-space-size=4096"

ENV SKIP_ENV_VALIDATION=true

# Set dummy secret only for build process without storing in image
RUN npm run build

RUN rm -f .env .env.local || true

# Production runtime
FROM node:22-alpine AS runner
WORKDIR /app

# Install runtime utilities
RUN apk add --no-cache bash curl postgresql-client

# Copy only required artifacts
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/lib/security ./lib/security
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/migrations ./migrations 

# Copy entrypoint
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Real secret only injected at runtime
ENV NODE_ENV=production

# Do NOT bake the secret into the image
# GitLab / Docker runtime will inject this automatically
# e.g., docker run -e NEXTAUTH_SECRET=$NEXTAUTH_SECRET image

EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
