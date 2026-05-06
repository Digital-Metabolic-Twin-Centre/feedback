import { NextRequest } from "next/server";
import { authorizeBootstrap, v1Json, v1PreflightResponse } from "@/lib/api-v1";
import { createMetaResource, listMetaResource, metaResourceSchema } from "@/lib/admin-meta";

export async function OPTIONS() {
  return v1PreflightResponse();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ resource: string }> }
) {
  try {
    const authError = authorizeBootstrap(req);
    if (authError) return authError;

    const { resource: resourceName } = await params;
    const parsedResource = metaResourceSchema.safeParse(resourceName);
    if (!parsedResource.success) {
      return v1Json({ success: false, error: "Unsupported meta resource." }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const data = listMetaResource(parsedResource.data, searchParams);
    return v1Json({ success: true, data });
  } catch (error) {
    return v1Json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ resource: string }> }
) {
  try {
    const authError = authorizeBootstrap(req);
    if (authError) return authError;

    const { resource: resourceName } = await params;
    const parsedResource = metaResourceSchema.safeParse(resourceName);
    if (!parsedResource.success) {
      return v1Json({ success: false, error: "Unsupported meta resource." }, { status: 404 });
    }

    const payload = await req.json().catch(() => ({}));
    const data = createMetaResource(parsedResource.data, payload);
    return v1Json({ success: true, data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const lowered = message.toLowerCase();
    const status = lowered.includes("invalid request payload")
      ? 400
      : lowered.includes("exists") || lowered.includes("unique")
        ? 409
        : 500;
    return v1Json({ success: false, error: message }, { status });
  }
}
