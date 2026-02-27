import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, type Role } from "@/lib/rbac";
import {
  getAdminAlertPreferences,
  updateAdminAlertPreference,
  type AdminAlertCategory,
  type AlertChannel,
} from "@/lib/admin-notification-prefs";
import { z } from "zod";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES: AdminAlertCategory[] = ["ci_alerts", "search_quality", "embedding_alerts", "system_events"];
const VALID_CHANNELS: AlertChannel[] = ["in_app", "email"];

const updateSchema = z.object({
  category: z.enum(["ci_alerts", "search_quality", "embedding_alerts", "system_events"]),
  channel: z.enum(["in_app", "email"]),
  enabled: z.boolean(),
});

/**
 * GET /api/admin/notification-prefs — Get current user's admin alert preferences
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role as Role, "user:manage")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const preferences = await getAdminAlertPreferences(user.id);
    return NextResponse.json({ preferences });
  } catch (error) {
    logger.error({ err: error }, "Failed to get notification preferences");
    return NextResponse.json({ error: "Failed to get preferences" }, { status: 500 });
  }
}

/**
 * POST /api/admin/notification-prefs — Update an admin alert preference
 * Body: { category, channel, enabled }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role as Role, "user:manage")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await updateAdminAlertPreference(
      user.id,
      parsed.data.category,
      parsed.data.channel,
      parsed.data.enabled
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error({ err: error }, "Failed to update notification preference");
    return NextResponse.json({ error: "Failed to update preference" }, { status: 500 });
  }
}
