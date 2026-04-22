/**
 * API Route: /api/notification
 *
 * Purpose:
 * Sends notification emails to configured admin contacts.
 *
 * Authorization:
 * - Requires valid session token
 */

import { NextRequest } from "next/server";
import { sendAdminNotification } from "@/lib/send-admin-notification";
import { verifyToken, handleApiError, successResponse } from "@/lib/api-helpers";
import { corsHeaders } from "@/lib/cors";
import { ADVERSE_EVENT_NOTIFICATION } from "@/lib/notification-message";
import { getUserEmailFromSession } from "@/utils/auth/get-user-server-session";
import { withRateLimit } from "@/lib/rate-limit";

type NotificationBody = {
    type: "authentication" | "adverse_event";
    subject: string;
    text: string;
    html: string;
    sessionId: string;
    userEmail?: string | null;
    // Optional fields for adverse event notifications
    ae_serious?: boolean | null;
    participant_id?: string
};

// CORS Preflight
export async function OPTIONS(req: NextRequest) {
    const origin = req.headers.get("origin");
    const headers = corsHeaders(origin, { allowCredentials: true });

    return new Response(null, { status: 204, headers });
}

const postHandler = async (req: NextRequest) => {
    try {
        const origin = req.headers.get("origin");
        const headers = corsHeaders(origin, { allowCredentials: true });


        const isServerSide = !origin;

        if (!headers["Access-Control-Allow-Origin"] && !isServerSide) {
            return new Response(
                JSON.stringify({ success: false, error: "Forbidden: Invalid origin" }),
                { status: 403, headers: { "Content-Type": "application/json" } }
            );
        }

        // Require authentication
        await verifyToken(req);
        const [userEmail] = await getUserEmailFromSession();

        const body = (await req.json()) as NotificationBody;

        const { type, ae_serious, participant_id } = body;

        let subject = "";
        let text = "";
        let html = "";
        let sessionId = "";

        if (!type) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: "Missing required fields",
                }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        if (type === "adverse_event") {
            subject = ADVERSE_EVENT_NOTIFICATION.subject;
            text = ADVERSE_EVENT_NOTIFICATION.text;
            html = ADVERSE_EVENT_NOTIFICATION.html;
            sessionId = ADVERSE_EVENT_NOTIFICATION.sessionId;
        }

        await sendAdminNotification({
            type,
            subject,
            text,
            html,
            sessionId,
            userEmail,
            ae_serious,
            participant_id
        });

        return successResponse({ message: "Notification sent" });

    } catch (err) {
        return handleApiError(err, req);
    }
};

export const POST = withRateLimit(postHandler);
