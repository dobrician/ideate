import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, type Role } from "@/lib/rbac";
import { checkDeliverability } from "@/lib/email-deliverability";

export const dynamic = "force-dynamic";

const SMTP_FROM = process.env.SMTP_FROM || "idea@surcod.ro";

/**
 * GET /api/email/deliverability — Check SPF/DKIM/MX for the sending domain.
 * Admin-only: exposes infrastructure configuration details.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role as Role, "user:manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const domain = SMTP_FROM.split("@")[1];
    if (!domain) {
      return NextResponse.json(
        { error: "SMTP_FROM not configured" },
        { status: 500 }
      );
    }

    const report = await checkDeliverability(domain);
    return NextResponse.json(report);
  } catch (error) {
    console.error("Deliverability check error:", error);
    return NextResponse.json(
      { error: "Failed to check deliverability" },
      { status: 500 }
    );
  }
}
