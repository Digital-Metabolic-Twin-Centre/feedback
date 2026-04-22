import { feedbackOpenApiSpec } from "@/lib/openapi-feedback";
import { v1Json, v1PreflightResponse } from "@/lib/api-v1";

export async function OPTIONS() {
  return v1PreflightResponse();
}

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_FEEDBACK_API_URL || process.env.NEXT_PUBLIC_APP_URL;
  return v1Json(feedbackOpenApiSpec(baseUrl));
}
