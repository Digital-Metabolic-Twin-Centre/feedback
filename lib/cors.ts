const ALLOW_ORIGINS = new Set(['https://imdhub.org', 'https://beta.imdhub.org']);

function isLocalhostOrigin(origin: string) {
  try {
    const u = new URL(origin);
    return u.hostname === 'localhost' || u.hostname.startsWith('127.');
  } catch {
    return false;
  }
}

function normalizeOrigin(origin: string) {
  return origin.endsWith('/') ? origin.slice(0, -1) : origin;
}

export function corsHeaders(origin: string | null | undefined, opts?: { allowCredentials?: boolean }) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const o = origin ? normalizeOrigin(origin) : null;

  const allowed =
    !!o &&
    (ALLOW_ORIGINS.has(o) ||
      (isDevelopment && isLocalhostOrigin(o)));

  if (!allowed) return {};

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': o!,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };

  if (opts?.allowCredentials) {
    // Only set this when you need cookies/authorization headers across origins
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}
