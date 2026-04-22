import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import Redis from "ioredis";
import { env } from "./env-validation";

/**
 * Reusable API route rate limiter.
 * Uses ioredis when REDIS_URL is configured and falls back to
 * in-memory buckets for local/dev environments.
 */

const clientHits = new Map<string, { count: number; reset: number }>();
const RATE_LIMIT = 100;
const WINDOW_MS = 60_000;

type RateLimitOptions = {
  keyPrefix?: string;
  limit?: number;
  windowMs?: number;
  skip?: (req: NextRequest) => boolean;
  trustProxyHeaders?: boolean;
};

type RouteHandler<TContext = unknown> = (
  req: NextRequest,
  context: TContext,
) => Promise<Response> | Response;

declare global {
  var __rateLimitRedis: Redis | undefined;
  var __rateLimitRedisRetryAfter: number | undefined;
}

// Clean up expired entries every minute without keeping Node test processes alive.
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [clientIdentifier, bucket] of clientHits.entries()) {
    if (now > bucket.reset) {
      clientHits.delete(clientIdentifier);
    }
  }
}, WINDOW_MS);

cleanupInterval.unref?.();

function hashIdentifier(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function getSessionTokenFromCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) {
    return null;
  }

  const match = cookieHeader.match(
    /(?:^|;\s*)(?:__Secure-next-auth\.session-token|next-auth\.session-token)=([^;]+)/,
  );

  return match?.[1] ?? null;
}

function getClientIdentifier(req: NextRequest, options: RateLimitOptions) {
  if (options.trustProxyHeaders) {
    const forwardedIp = req.headers.get("x-real-ip")
      ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim();
    if (forwardedIp) {
      return `ip:${forwardedIp}`;
    }
  }

  const sessionToken = getSessionTokenFromCookieHeader(req.headers.get("cookie"));
  if (sessionToken) {
    return `session:${hashIdentifier(sessionToken)}`;
  }

  const anonymousFingerprint = [
    req.headers.get("user-agent") ?? "unknown-agent",
    req.headers.get("accept-language") ?? "unknown-language",
    req.nextUrl.pathname,
  ].join("|");

  return `anon:${hashIdentifier(anonymousFingerprint)}`;
}

function markRedisTemporarilyUnavailable(error: unknown) {
  globalThis.__rateLimitRedisRetryAfter = Date.now() + 60_000;

  if (globalThis.__rateLimitRedis) {
    globalThis.__rateLimitRedis.disconnect();
    globalThis.__rateLimitRedis = undefined;
  }

  console.error("Redis rate limit fallback triggered:", error);
}

function getRedisClient() {
  if (!env.REDIS_URL) {
    return null;
  }

  if (
    globalThis.__rateLimitRedisRetryAfter &&
    Date.now() < globalThis.__rateLimitRedisRetryAfter
  ) {
    return null;
  }

  let parsedRedisUrl: URL;
  try {
    parsedRedisUrl = new URL(env.REDIS_URL);
  } catch {
    markRedisTemporarilyUnavailable(
      new Error("Invalid REDIS_URL format for rate limiter"),
    );
    return null;
  }

  if (!["redis:", "rediss:"].includes(parsedRedisUrl.protocol)) {
    markRedisTemporarilyUnavailable(
      new Error("REDIS_URL must use redis:// or rediss://"),
    );
    return null;
  }

  if (!globalThis.__rateLimitRedis) {
    globalThis.__rateLimitRedis = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    globalThis.__rateLimitRedis.on("error", (error: Error) => {
      markRedisTemporarilyUnavailable(error);
    });
  }

  return globalThis.__rateLimitRedis;
}

function createRateLimitResponse(windowMs: number) {
  return NextResponse.json(
    {
      success: false,
      message: "Too many requests",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil(windowMs / 1000)),
      },
    },
  );
}

function buildRateLimitKey(
  req: NextRequest,
  windowMs: number,
  keyPrefix: string,
  options: RateLimitOptions,
) {
  const clientId = getClientIdentifier(req, options);
  const windowId = Math.floor(Date.now() / windowMs);
  return `${keyPrefix}:${req.method}:${req.nextUrl.pathname}:${clientId}:${windowId}`;
}

async function rateLimitWithRedis(req: NextRequest, options: RateLimitOptions) {
  const redis = getRedisClient();
  if (!redis) {
    return null;
  }

  if (redis.status !== "ready") {
    await redis.connect();
  }

  const windowMs = options.windowMs ?? WINDOW_MS;
  const limit = options.limit ?? RATE_LIMIT;
  const key = buildRateLimitKey(
    req,
    windowMs,
    options.keyPrefix ?? "api_rate_limit",
    options,
  );
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.pexpire(key, windowMs);
  }

  if (count > limit) {
    return createRateLimitResponse(windowMs);
  }

  return null;
}

function rateLimitInMemory(req: NextRequest, options: RateLimitOptions) {
  const clientId = getClientIdentifier(req, options);
  const windowMs = options.windowMs ?? WINDOW_MS;
  const limit = options.limit ?? RATE_LIMIT;

  const now = Date.now();

  let bucket = clientHits.get(clientId);
  if (!bucket || now > bucket.reset) {
    bucket = {
      count: 0,
      reset: now + windowMs,
    };
  }

  bucket.count++;
  clientHits.set(clientId, bucket);

  if (bucket.count > limit) {
    return createRateLimitResponse(windowMs);
  }

  return null;
}

export async function enforceRateLimit(
  req: NextRequest,
  options: RateLimitOptions = {},
) {
  if (
    req.method === "OPTIONS" ||
    req.method === "HEAD" ||
    options.skip?.(req)
  ) {
    return null;
  }

  try {
    const redisResponse = await rateLimitWithRedis(req, options);
    if (redisResponse) {
      return redisResponse;
    }
  } catch (error) {
    markRedisTemporarilyUnavailable(error);
  }

  return rateLimitInMemory(req, options);
}

export function resetRateLimitStateForTests() {
  clientHits.clear();
  globalThis.__rateLimitRedisRetryAfter = undefined;
  if (globalThis.__rateLimitRedis) {
    globalThis.__rateLimitRedis.disconnect();
    globalThis.__rateLimitRedis = undefined;
  }
}

export function withRateLimit<TContext = unknown>(
  handler: RouteHandler<TContext>,
  options: RateLimitOptions = {},
) {
  return async (req: NextRequest, context: TContext) => {
    const limited = await enforceRateLimit(req, options);
    if (limited) {
      return limited;
    }

    return handler(req, context);
  };
}
