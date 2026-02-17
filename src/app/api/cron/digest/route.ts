import { NextResponse } from "next/server";
import { sendDigestEmails } from "@/lib/digest";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/digest — Send weekly digest emails to subscribers.
 * Designed to be called by an external cron job (e.g., every Monday).
 */
export async function GET() {
  try {
    const sent = await sendDigestEmails();
    return NextResponse.json({ sent });
  } catch (error) {
    logger.error({ err: error }, "Digest cron failed");
    return NextResponse.json(
      { error: "Failed to send digest" },
      { status: 500 }
    );
  }
}
