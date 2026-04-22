import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyToken, handleApiError, successResponse } from "@/lib/api-helpers";
import { withRateLimit } from "@/lib/rate-limit";
import {
  logDownloadActivity,
} from "@/app/actions/admin/audit/download-activity/action";

const DOWNLOAD_ACTIVITY_EVENTS = [
  "EXPORT_CSV",
  "EXPORT_EXCEL",
  "COPY_ROW",
  "COPY_LINK",
  "DOWNLOAD_SHIPPING_TEMPLATE",
  "DOWNLOAD_UNDIAGNOSED_SAMPLE_TEMPLATE",
] as const;

const activitySchema = z.object({
  eventType: z.enum(DOWNLOAD_ACTIVITY_EVENTS),
  schemaName: z.string().max(100).optional(),
  tableName: z.string().max(100).optional(),
  pagePath: z.string().max(500).optional(),
  fileType: z.string().max(32).optional(),
  rowCount: z.number().int().nonnegative().optional(),
  clinicalSiteBreakdown: z.record(z.number().int().nonnegative()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

function anonymiseIp(ip: string): string | null {
  if (!ip || ip === "unknown") {
    return null;
  }

  if (ip.startsWith("::ffff:")) {
    ip = ip.replace("::ffff:", "");
  }

  if (ip === "127.0.0.1" || ip === "::1") {
    return ip;
  }

  const ipv4Parts = ip.split(".");
  if (ipv4Parts.length === 4) {
    return `${ipv4Parts[0]}.${ipv4Parts[1]}.0.0`;
  }

  if (ip.includes(":")) {
    const segments = ip.split(":");
    return segments.slice(0, 3).join(":") + "::";
  }

  return null;
}

const postHandler = async (req: NextRequest) => {
  try {
    await verifyToken(req);

    const body = await req.json();
    const parsed = activitySchema.parse(body);

    const rawIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    const result = await logDownloadActivity({
      ...parsed,
      ipAddress: anonymiseIp(rawIp),
      userAgent: req.headers.get("user-agent") ?? "unknown",
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message ?? "Unable to write activity log." },
        { status: 200 },
      );
    }

    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error, req);
  }
};

export const POST = withRateLimit(postHandler);
