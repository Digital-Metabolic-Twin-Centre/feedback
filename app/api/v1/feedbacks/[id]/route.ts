import { NextRequest } from "next/server";
import { getFeedbackById, getThreadMessages } from "@/lib/feedback/sqlite-queries";
import { authenticateApiKey, v1Json, v1PreflightResponse } from "@/lib/api-v1";
import { logError } from "@/lib/error-logger";

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

    const { id: idStr } = await params;
    const id = Number(idStr);
    if (!Number.isInteger(id) || id < 1) {
      return v1Json({ success: false, error: "Invalid ID" }, { status: 400 });
    }

    const feedback = getFeedbackById(id, authResult.auth.projectId);
    if (!feedback) {
      return v1Json({ success: false, error: "Feedback not found for this project." }, { status: 404 });
    }

    const includeMessages = new URL(req.url).searchParams.get("includeMessages") === "true";
    if (!includeMessages) {
      return v1Json({ success: true, data: feedback });
    }

    const messages = getThreadMessages(id, authResult.auth.projectId);
    return v1Json({ success: true, data: { feedback, messages } });
  } catch (error) {
    logError(error, { operation: "v1/feedbacks/[id] GET", resource: req.url });
    return v1Json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
