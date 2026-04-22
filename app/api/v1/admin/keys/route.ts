import { NextRequest } from "next/server";
import { z } from "zod";
import { createApiKeyForProject } from "@/lib/api-keys";
import { env } from "@/lib/env-validation";
import { v1Json, v1PreflightResponse } from "@/lib/api-v1";

const keyRequestSchema = z.object({
  projectSlug: z.string().optional(),
  projectName: z.string().optional(),
  keyName: z.string().optional(),
  isAdmin: z.boolean().optional(),
});

export async function OPTIONS() {
  return v1PreflightResponse();
}

export async function POST(req: NextRequest) {
  try {
    const configuredToken = env.FEEDBACK_BOOTSTRAP_TOKEN;
    if (!configuredToken) {
      return v1Json(
        { success: false, error: "FEEDBACK_BOOTSTRAP_TOKEN is not configured." },
        { status: 503 }
      );
    }

    const provided = req.headers.get("x-bootstrap-token") || "";
    if (provided !== configuredToken) {
      return v1Json({ success: false, error: "Invalid bootstrap token." }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const parsed = keyRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return v1Json(
        { success: false, error: "Invalid request payload.", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const created = createApiKeyForProject({
      projectSlug: parsed.data.projectSlug,
      projectName: parsed.data.projectName,
      keyName: parsed.data.keyName,
      isAdmin: parsed.data.isAdmin,
    });

    return v1Json(
      {
        success: true,
        data: created,
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
