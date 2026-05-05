import { NextRequest } from "next/server";
import { selectfeedback } from "@/lib/feedback/sqlite-queries";
import { authenticateApiKey, requireAdmin, v1Json, v1PreflightResponse } from "@/lib/api-v1";

export async function OPTIONS() {
  return v1PreflightResponse();
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await authenticateApiKey(req);
    if (!authResult.ok) return authResult.response;

    const adminError = requireAdmin(authResult.auth);
    if (adminError) return adminError;

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = Math.min(500, Math.max(1, Number(searchParams.get("pageSize") || 100)));

    const filters: Record<string, string> = {};
    const softDelete = searchParams.get("soft_delete");
    const draft = searchParams.get("draft");
    const sessionEmail = searchParams.get("__session_email");

    if (softDelete !== null) filters.soft_delete = softDelete;
    if (draft !== null) filters.draft = draft;
    if (sessionEmail) filters.__session_email = sessionEmail;

    const result = selectfeedback(filters, [], { page, pageSize }, authResult.auth.projectId);

    return v1Json({
      data: result.data,
      meta: {
        total: result.total,
        page,
        pageSize,
      },
      project: {
        id: authResult.auth.projectId,
        slug: authResult.auth.projectSlug,
        name: authResult.auth.projectName,
      },
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
