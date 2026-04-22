import { NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env-validation";
import { createProject, listProjects } from "@/lib/projects";
import { v1Json, v1PreflightResponse } from "@/lib/api-v1";

const createProjectSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
});

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

export async function GET(req: NextRequest) {
  try {
    const authError = authorizeBootstrap(req);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get("includeArchived") === "true";

    return v1Json({
      success: true,
      data: listProjects(includeArchived),
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

export async function POST(req: NextRequest) {
  try {
    const authError = authorizeBootstrap(req);
    if (authError) return authError;

    const payload = await req.json().catch(() => ({}));
    const parsed = createProjectSchema.safeParse(payload);
    if (!parsed.success) {
      return v1Json(
        { success: false, error: "Invalid request payload.", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const project = createProject(parsed.data);
    return v1Json({ success: true, data: project }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.toLowerCase().includes("exists") ? 409 : 500;
    return v1Json({ success: false, error: message }, { status });
  }
}
