import { NextResponse } from "next/server";
import { checkDeliverability } from "@/lib/email-deliverability";

export const dynamic = "force-dynamic";

const SMTP_FROM = process.env.SMTP_FROM || "idea@surcod.ro";

/**
 * GET /api/email/deliverability — Check SPF/DKIM/MX for the sending domain
 */
export async function GET() {
  const domain = SMTP_FROM.split("@")[1];

  if (!domain) {
    return NextResponse.json(
      { error: "SMTP_FROM not configured" },
      { status: 500 }
    );
  }

  try {
    const report = await checkDeliverability(domain);
    return NextResponse.json(report);
  } catch {
    return NextResponse.json(
      { error: "Failed to check deliverability" },
      { status: 500 }
    );
  }
}
