import { NextResponse } from "next/server";
import { openapiSpec } from "@/lib/openapi-spec";

export const dynamic = "force-dynamic";

/**
 * GET /api/docs/spec — Serve the OpenAPI JSON specification
 */
export async function GET() {
  return NextResponse.json(openapiSpec, {
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  });
}
