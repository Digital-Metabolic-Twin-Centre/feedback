/**
 * API Route: /api/healthcheck
 *
 * Purpose:
 * Minimal health check endpoint for uptime monitoring.
 *
 * Notes:
 * - Public endpoint
 * - No sensitive information exposed
 * - No dependency checks
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { status: "ok" },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
