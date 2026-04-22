interface ApiFetchOptions extends RequestInit {
  token?: string;
  apiKey?: string;
}

export async function apiFetch(url: string, options: ApiFetchOptions = {}): Promise<Response> {
  const { token, apiKey, ...rest } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(rest.headers as Record<string, string> ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (apiKey) headers["x-api-key"] = apiKey;
  return fetch(url, { ...rest, headers });
}
