"use client";
import { useState, useEffect, useCallback } from "react";
import type { FeedbackData } from "../types";

interface UseFeedbacksOptions {
  endpoint: string;
  adminEmail?: string;
  token?: string;
  apiKey?: string;
  enabled?: boolean;
}

export function useFeedbacks({ endpoint, adminEmail, token, apiKey, enabled = true }: UseFeedbacksOptions) {
  const [feedbacks, setFeedbacks] = useState<FeedbackData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildHeaders = useCallback(() => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (apiKey) headers["x-api-key"] = apiKey;
    return headers;
  }, [token, apiKey]);

  const fetchFeedbacks = useCallback(async () => {
    if (!enabled || !endpoint) return;
    setLoading(true);
    setError(null);
    try {
      const url = adminEmail
        ? `${endpoint}?__session_email=${encodeURIComponent(adminEmail)}`
        : endpoint;
      const res = await fetch(url, { headers: buildHeaders() });
      const json = await res.json();
      setFeedbacks(json.data ?? json ?? []);
    } catch {
      setError("Failed to load feedbacks.");
    } finally {
      setLoading(false);
    }
  }, [endpoint, adminEmail, buildHeaders, enabled]);

  useEffect(() => { fetchFeedbacks(); }, [fetchFeedbacks]);

  return { feedbacks, loading, error, refetch: fetchFeedbacks };
}
