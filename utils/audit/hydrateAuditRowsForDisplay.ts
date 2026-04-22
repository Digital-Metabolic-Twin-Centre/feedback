import { secureFetch } from "@/hooks/secure-fetch";

export type AuditHydration = {
    changes?: unknown;
};

export async function hydrateAuditRowsForDisplay<
    T extends { id: number }
>(
    rows: T[]
): Promise<(T & AuditHydration)[]> {
    if (!rows.length) return rows;

    const ids = rows.map((r) => r.id);

    const res = await secureFetch("/api/select/changelog-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
    });

    if (!res.ok) return rows;

    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) return rows;

    const map = new Map<number, AuditHydration>(
        //eslint-disable-next-line @typescript-eslint/no-explicit-any
        json.data.map((r: any) => [
            r.id,
            { changes: r.changes },
        ])
    );

    return rows.map((r) => ({
        ...r,
        changes: map.get(r.id)?.changes ?? null,
    }));
}
