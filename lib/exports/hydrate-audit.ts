/* eslint-disable */

import { secureFetch } from "@/hooks/secure-fetch";

type AuditChangePayload = {
  changes?: any;
};

export async function hydrateAuditLogData(
  data: any[],
  isAuditLogTable: boolean
): Promise<any[]> {
  if (!isAuditLogTable || data.length === 0) return data;

  const ids = data.map((r) => r.id);

  try {
    const res = await secureFetch("/api/select/changelog-json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });

    if (!res.ok) return data;

    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) return data;

    const map = new Map<number, AuditChangePayload>(
      json.data.map((r: any) => [
        r.id,
        {
          changes: r.changes,
        },
      ])
    );

    return data.map((row) => {
      const hydrated = map.get(row.id);

      return {
        ...row,
        changes: hydrated?.changes ?? null,
      };
    });
  } catch (err) {
    console.error("Audit hydration failed:", err);
    return data;
  }
}
