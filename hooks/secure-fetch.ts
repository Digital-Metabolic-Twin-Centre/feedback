/**
 * A secure fetch utility for internal authenticated API calls.
 *
 * Automatically includes:
 *  - JSON headers
 *  - cookies for session-based authentication
 *  - CSRF tokens for state-changing operations (POST, PUT, PATCH, DELETE)
 *
 * When called with `{ secure: false }`, it skips cookies (for public endpoints).
 */

let csrfToken: string | null = null;
let csrfHeaderName: string = "x-csrf-token";

/**
 * Fetch and cache CSRF token
 */
let csrfPromise: Promise<string | null> | null = null;

async function getCsrfToken(): Promise<string | null> {
  if (csrfToken) return csrfToken;

  if (!csrfPromise) {
    csrfPromise = fetch("/api/csrf-token", {
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) return null;

        const data = await res.json();
        csrfToken = data.token;
        csrfHeaderName = data.headerName;

        return csrfToken;
      })
      .finally(() => {
        csrfPromise = null;
      });
  }

  return csrfPromise;
}

export async function secureFetch(
  url: string,
  options: RequestInit & { secure?: boolean } = {}
): Promise<Response> {
  const { secure = true, ...rest } = options;

  // Add CSRF token for state-changing operations
  const method = rest.method?.toUpperCase() || "GET";
  const requiresCsrf = secure && ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(rest.headers || {}),
  };

  if (requiresCsrf) {
    let token = csrfToken;

    if (!token) {
      token = await getCsrfToken();
    }

    if (!token) {
      throw new Error("CSRF token missing - aborting request");
    }

    (headers as Record<string, string>)[csrfHeaderName] = token;
  }

  const response = await fetch(url, {
    ...rest,
    headers,
    credentials: secure ? "include" : "same-origin",
  });

  // Handle CSRF errors clear cache and retry once
  if (response.status === 403 && requiresCsrf) {
    const data = await response.clone().json().catch(() => ({}));
    if (data.message?.includes("CSRF")) {
      csrfToken = null;
      const retryToken = await getCsrfToken();
      if (retryToken) {
        (headers as Record<string, string>)[csrfHeaderName] = retryToken;
        return fetch(url, {
          ...rest,
          headers,
          credentials: "include",
        });
      }
    }
  }

  return response;
}

/**
 * Clear cached CSRF token (useful for manual refresh)
 */
export function clearCsrfCache(): void {
  csrfToken = null;
}
