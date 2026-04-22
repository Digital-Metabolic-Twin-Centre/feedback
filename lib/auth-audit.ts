"use server";

import { headers } from "next/headers";
import { logAuthEvent } from "@/app/actions/admin/audit/auth/action";

type AuthAuditParams = {
    event: "LOGIN" | "LOGOUT" | "FORCED_LOGOUT" | "SESSION_EXPIRED";
    email?: string | null;
    sessionId?: string;
};

function anonymiseIp(ip: string): string {
    // Normalize IPv6-mapped IPv4 (::ffff:127.0.0.1 → 127.0.0.1)
    if (ip.startsWith("::ffff:")) {
        ip = ip.replace("::ffff:", "");
    }

    // Localhost
    if (ip === "127.0.0.1" || ip === "::1") {
        return ip;
    }

    // IPv4 anonymisation
    const ipv4Parts = ip.split(".");
    if (ipv4Parts.length === 4) {
        return `${ipv4Parts[0]}.${ipv4Parts[1]}.0.0`;
    }

    // IPv6 anonymisation (safe method)
    if (ip.includes(":")) {
        const segments = ip.split(":");
        return segments.slice(0, 3).join(":") + "::";
    }

    return "unknown";
}



export async function auditAuthEvent({
    event,
    email,
    sessionId,
}: AuthAuditParams) {
    const h = await headers();
    const userEmail =
        email ?? "unknown@imdhub-system";

    const rawIp =
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        h.get("x-real-ip") ??
        "unknown";

    const ip = anonymiseIp(rawIp);

    const userAgent =
        h.get("user-agent") ?? "unknown";

    const mappedEvent = event === "FORCED_LOGOUT" || event === "SESSION_EXPIRED" ? "LOGOUT" : event;

    // Fall back to a generated UUID so the event is always recorded.
    // The generated ID is prefixed in user_agent to make it identifiable.
    const resolvedSessionId = sessionId ?? crypto.randomUUID();
    const resolvedUserAgent = sessionId
        ? userAgent
        : `[session-id-unavailable] ${userAgent}`;

    await logAuthEvent({
        userId: userEmail,
        sessionId: resolvedSessionId,
        event: mappedEvent,
        ip,
        userAgent: resolvedUserAgent,
    });
}
