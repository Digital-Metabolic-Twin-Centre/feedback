import { NextRequest } from "next/server";
import { revokeApiKeyById } from "@/lib/api-keys";
import { authorizeBootstrap, v1Json, v1PreflightResponse } from "@/lib/api-v1";

export async function OPTIONS() {
  return v1PreflightResponse();
}

export async function DELETE(
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

    const revoked = revokeApiKeyById(keyId);
    if (!revoked.success) {
      return v1Json({ success: false, error: "API key not found or already revoked." }, { status: 404 });
    }

    return v1Json({ success: true, revokedKeyId: keyId });
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
