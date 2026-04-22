import { NextRequest } from "next/server";
import { getFeedbackStatuses, getFeedbackTypes, getOrganisations } from "@/lib/feedback/sqlite-queries";
import { authenticateApiKey, v1Json, v1PreflightResponse } from "@/lib/api-v1";

export async function OPTIONS() {
  return v1PreflightResponse();
}

export async function GET(req: NextRequest) {
  try {
    const authResult = authenticateApiKey(req);
    if (!authResult.ok) return authResult.response;

    return v1Json({
      types: getFeedbackTypes(),
      organisations: getOrganisations(),
      statuses: getFeedbackStatuses(),
    });
  } catch (error) {
    return v1Json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
