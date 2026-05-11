import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getFeedbackById,
  getThreadMessages,
  insertThreadMessage,
} from "@/lib/feedback/sqlite-queries";
import {
  notifyFeedbackDistributionOfReply,
  notifyfeedbackubmitterOfReply,
} from "@/lib/feedback-notifications";
import { authenticateApiKey, requireAdmin, v1Json, v1PreflightResponse } from "@/lib/api-v1";
import { logError } from "@/lib/error-logger";
import { syncPromotedFeedbackToAvailablePlatforms } from "@/lib/promoted-feedback-sync";

const postSchema = z.object({
  message: z.string().min(1).max(12000),
  createdBy: z.string().min(1).optional(),
});

export async function OPTIONS() {
  return v1PreflightResponse();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateApiKey(req);
    if (!authResult.ok) return authResult.response;

    const adminError = requireAdmin(authResult.auth);
    if (adminError) return adminError;

    const { id: idStr } = await params;
    const feedbackId = Number(idStr);
    if (!Number.isInteger(feedbackId) || feedbackId < 1) {
      return v1Json({ success: false, error: "Invalid feedback id." }, { status: 400 });
    }

    const feedback = getFeedbackById(feedbackId, authResult.auth.projectId);
    if (!feedback) {
      return v1Json({ success: false, error: "Feedback not found for this project." }, { status: 404 });
    }

    const messages = getThreadMessages(feedbackId, authResult.auth.projectId);
    return v1Json({ success: true, data: messages });
  } catch (error) {
    logError(error, { operation: "v1/admin/feedback/messages GET", resource: req.url });
    return v1Json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateApiKey(req);
    if (!authResult.ok) return authResult.response;

    const adminError = requireAdmin(authResult.auth);
    if (adminError) return adminError;

    const { id: idStr } = await params;
    const feedbackId = Number(idStr);
    if (!Number.isInteger(feedbackId) || feedbackId < 1) {
      return v1Json({ success: false, error: "Invalid feedback id." }, { status: 400 });
    }

    const payload = await req.json().catch(() => ({}));
    const parsed = postSchema.safeParse(payload);
    if (!parsed.success) {
      return v1Json(
        { success: false, error: "Invalid request payload.", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const feedback = getFeedbackById(feedbackId, authResult.auth.projectId);
    if (!feedback) {
      return v1Json({ success: false, error: "Feedback not found for this project." }, { status: 404 });
    }

    if (feedback.feedback_status_name?.toLowerCase() === "closed") {
      return v1Json(
        { success: false, error: "This feedback is closed and cannot accept new replies." },
        { status: 409 }
      );
    }

    const createdBy = parsed.data.createdBy?.trim() || `admin-key-${authResult.auth.keyId}`;

    insertThreadMessage({
      feedbackId,
      authorRole: "Admin",
      message: parsed.data.message.trim(),
      createdBy,
    });

    if (feedback.email) {
      notifyfeedbackubmitterOfReply({
        feedbackId,
        submitterEmail: feedback.email,
        replierEmail: createdBy,
        replierRole: "Admin",
      }).catch((err) => logError(err, { operation: "notifyfeedbackubmitterOfReply", resource: String(feedbackId) }));

      notifyFeedbackDistributionOfReply({
        feedbackId,
        submitterEmail: feedback.email,
        replierEmail: createdBy,
        replierRole: "Admin",
      }).catch((err) => logError(err, { operation: "notifyFeedbackDistributionOfReply", resource: String(feedbackId) }));
    }

    syncPromotedFeedbackToAvailablePlatforms(feedbackId).catch((err) => {
      logError(err, { operation: "syncPromotedFeedbackToPlatformsOnReply", resource: String(feedbackId) });
    });

    const messages = getThreadMessages(feedbackId, authResult.auth.projectId);
    return v1Json({ success: true, data: messages }, { status: 201 });
  } catch (error) {
    logError(error, { operation: "v1/admin/feedback/messages POST", resource: req.url });
    return v1Json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
