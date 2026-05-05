import { NextRequest } from "next/server";
import { z } from "zod";
import { insertFeedback, insertThreadMessage, selectfeedback } from "@/lib/feedback/sqlite-queries";
import { notifyfeedbackubmitted } from "@/lib/feedback-notifications";
import { authenticateApiKey, requireAdmin, v1Json, v1PreflightResponse } from "@/lib/api-v1";

const feedbackPayloadSchema = z.object({
  email: z.string().email(),
  organisation: z.coerce.number().int().positive().optional().nullable(),
  page: z.string().max(500).optional().nullable(),
  feedback_type: z.coerce.number().int().positive().optional().nullable(),
  feedback_status: z.coerce.number().int().positive().optional().nullable(),
  initial_message: z.string().max(12000).optional().nullable(),
  draft: z.boolean().optional(),
  promote: z.boolean().optional(),
});

export async function OPTIONS() {
  return v1PreflightResponse();
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await authenticateApiKey(req);
    if (!authResult.ok) return authResult.response;

    const body = await req.json().catch(() => ({}));
    const parsed = feedbackPayloadSchema.safeParse(body);

    if (!parsed.success) {
      return v1Json(
        {
          success: false,
          error: "Invalid request payload.",
          issues: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const payload = parsed.data;
    const result = insertFeedback({
      ...payload,
      project_id: authResult.auth.projectId,
      created_by: payload.email,
      updated_by: payload.email,
    });

    const initialMessage = payload.initial_message?.trim();
    if (initialMessage) {
      insertThreadMessage({
        feedbackId: result.insertedId,
        authorRole: "User",
        message: initialMessage,
        createdBy: payload.email,
      });
    }

    if (!payload.draft) {
      notifyfeedbackubmitted({
        feedbackId: result.insertedId,
        submittedByEmail: payload.email,
        page: payload.page ?? null,
      }).catch(() => undefined);
    }

    return v1Json(
      {
        success: true,
        id: result.insertedId,
        project: {
          id: authResult.auth.projectId,
          slug: authResult.auth.projectSlug,
          name: authResult.auth.projectName,
        },
      },
      { status: 201 }
    );
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
        project: {
          id: authResult.auth.projectId,
          slug: authResult.auth.projectSlug,
          name: authResult.auth.projectName,
        },
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
