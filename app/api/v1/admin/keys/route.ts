import { NextRequest } from "next/server";
import { z } from "zod";
import { createApiKeyForProject, listApiKeys } from "@/lib/api-keys";
import { authorizeBootstrap, v1Json, v1PreflightResponse } from "@/lib/api-v1";

const keyRequestSchema = z.object({
  projectSlug: z.string().optional(),
  projectName: z.string().optional(),
  keyName: z.string().optional(),
  isAdmin: z.boolean().optional(),
});

export async function OPTIONS() {
  return v1PreflightResponse();
}

export async function GET(req: NextRequest) {
  try {
    const authError = authorizeBootstrap(req);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const projectSlug = searchParams.get("projectSlug") ?? undefined;
    const includeRevoked = searchParams.get("includeRevoked") === "true";

    const keys = listApiKeys({ projectSlug, includeRevoked });
    return v1Json({ success: true, data: keys });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.toLowerCase().includes("already exists") ? 409 : 500;
    return v1Json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authError = authorizeBootstrap(req);
    if (authError) return authError;

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
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.toLowerCase().includes("already exists") ? 409 : 500;
    return v1Json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}
