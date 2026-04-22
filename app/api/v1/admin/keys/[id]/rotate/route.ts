import { NextRequest } from "next/server";
import { rotateApiKeyById } from "@/lib/api-keys";
import { env } from "@/lib/env-validation";
import { v1Json, v1PreflightResponse } from "@/lib/api-v1";

function authorizeBootstrap(req: NextRequest) {
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

  return null;
}

export async function OPTIONS() {
  return v1PreflightResponse();
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = authorizeBootstrap(req);
    if (authError) return authError;

    const { id: idStr } = await params;
    const keyId = Number(idStr);

    if (!Number.isInteger(keyId) || keyId < 1) {
      return v1Json({ success: false, error: "Invalid key id." }, { status: 400 });
    }

    const rotated = rotateApiKeyById(keyId);
    if (!rotated.success) {
      return v1Json({ success: false, error: rotated.error }, { status: 404 });
    }

    return v1Json({ success: true, data: rotated.data }, { status: 201 });
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
