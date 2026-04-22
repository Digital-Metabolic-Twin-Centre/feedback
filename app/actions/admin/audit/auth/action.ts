"use server";

import { pgPool } from "@/lib/db";

type AuthEvent = {
    userId: string;
    sessionId: string;
    event: "LOGIN" | "LOGOUT";
    ip?: string;
    userAgent?: string;
};

export async function logAuthEvent({
    userId,
    sessionId,
    event,
    ip,
    userAgent,
}: AuthEvent) {
    const client = await pgPool.connect();

    try {
        await client.query(
            `
            INSERT INTO imdhub_logs.auth_sessions
                (user_id, session_id, event, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5)
            `,
            [userId, sessionId, event, ip, userAgent]
        );
    } finally {
        client.release();
    }
}
