"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface CsrfTokenResponse {
  token: string;
  headerName: string;
  message: string;
}

interface UseCsrfTokenReturn {
  token: string | null;
  headerName: string;
  isLoading: boolean;
  error: Error | null;
  refreshToken: () => Promise<void>;
}

/**
 * React hook for managing CSRF tokens
 * 
 * Automatically fetches and refreshes CSRF tokens
 * Use this hook in components that make state-changing API requests
 *
 */
export function useCsrfToken(): UseCsrfTokenReturn {
  const [token, setToken] = useState<string | null>(null);
  const [headerName, setHeaderName] = useState<string>("x-csrf-token");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef(true);

  const fetchToken = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/csrf-token", {
        method: "GET",
        credentials: "include", // Include cookies
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch CSRF token: ${response.statusText}`);
      }

      const data: CsrfTokenResponse = await response.json();

      if (isMountedRef.current) {
        setToken(data.token);
        setHeaderName(data.headerName);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        console.error("CSRF token fetch error:", error);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Fetch token on mount
  useEffect(() => {
    isMountedRef.current = true;
    fetchToken();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchToken]);

  // Refresh token every 30 minutes to prevent expiration
  useEffect(() => {
    const interval = setInterval(() => {
      if (isMountedRef.current) {
        fetchToken();
      }
    }, 30 * 60 * 1000); // 30 minutes

    return () => clearInterval(interval);
  }, [fetchToken]);

  return {
    token,
    headerName,
    isLoading,
    error,
    refreshToken: fetchToken,
  };
}

/**
 * Helper function to add CSRF token to fetch headers
 * 
 * @example
 * ```tsx
 * const headers = addCsrfToHeaders(baseHeaders, csrfToken, csrfHeaderName);
 * ```
 */
export function addCsrfToHeaders(
  headers: HeadersInit,
  token: string | null,
  headerName: string
): HeadersInit {
  if (!token) {
    console.warn("CSRF token not available");
    return headers;
  }

  if (headers instanceof Headers) {
    headers.set(headerName, token);
    return headers;
  }

  if (Array.isArray(headers)) {
    return [...headers, [headerName, token]];
  }

  return {
    ...headers,
    [headerName]: token,
  };
}
