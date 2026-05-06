import { NextRequest } from "next/server";
import { authorizeBootstrap, v1Json, v1PreflightResponse } from "@/lib/api-v1";
import { deleteMetaResourceById, getMetaResourceById, metaResourceSchema, updateMetaResourceById } from "@/lib/admin-meta";

function parseId(idValue: string) {
  const id = Number(idValue);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function OPTIONS() {
  return v1PreflightResponse();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ resource: string; id: string }> }
) {
  try {
    const authError = authorizeBootstrap(req);
    if (authError) return authError;

    const { resource: resourceName, id: idValue } = await params;
    const parsedResource = metaResourceSchema.safeParse(resourceName);
    if (!parsedResource.success) {
      return v1Json({ success: false, error: "Unsupported meta resource." }, { status: 404 });
    }

    const id = parseId(idValue);
    if (!id) {
      return v1Json({ success: false, error: "Invalid resource id." }, { status: 400 });
    }

    const data = getMetaResourceById(parsedResource.data, id);
    if (!data) {
      return v1Json({ success: false, error: "Resource not found." }, { status: 404 });
    }

    return v1Json({ success: true, data });
  } catch (error) {
    return v1Json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ resource: string; id: string }> }
) {
  try {
    const authError = authorizeBootstrap(req);
    if (authError) return authError;

    const { resource: resourceName, id: idValue } = await params;
    const parsedResource = metaResourceSchema.safeParse(resourceName);
    if (!parsedResource.success) {
      return v1Json({ success: false, error: "Unsupported meta resource." }, { status: 404 });
    }

    const id = parseId(idValue);
    if (!id) {
      return v1Json({ success: false, error: "Invalid resource id." }, { status: 400 });
    }

    const payload = await req.json().catch(() => ({}));
    const data = updateMetaResourceById(parsedResource.data, id, payload);
    if (!data) {
      return v1Json({ success: false, error: "Resource not found." }, { status: 404 });
    }

    return v1Json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const lowered = message.toLowerCase();
    const status = lowered.includes("invalid request payload")
      || lowered.includes("at least one updatable field")
      || lowered.includes("cannot be empty")
      ? 400
      : lowered.includes("unique")
        ? 409
        : 500;
    return v1Json({ success: false, error: message }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ resource: string; id: string }> }
) {
  try {
    const authError = authorizeBootstrap(req);
    if (authError) return authError;

    const { resource: resourceName, id: idValue } = await params;
    const parsedResource = metaResourceSchema.safeParse(resourceName);
    if (!parsedResource.success) {
      return v1Json({ success: false, error: "Unsupported meta resource." }, { status: 404 });
    }

    const id = parseId(idValue);
    if (!id) {
      return v1Json({ success: false, error: "Invalid resource id." }, { status: 400 });
    }

    const deleted = deleteMetaResourceById(parsedResource.data, id);
    if (!deleted) {
      return v1Json({ success: false, error: "Resource not found." }, { status: 404 });
    }

    return v1Json({ success: true, deletedId: id });
  } catch (error) {
    return v1Json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
