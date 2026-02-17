import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projectTemplates } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, type Role } from "@/lib/rbac";
import { requireOrigin } from "@/lib/csrf";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/templates — List all project templates
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const all = await db.select().from(projectTemplates);
    const result = all.map((tpl) => ({
      ...tpl,
      defaultTags: tpl.defaultTags ? JSON.parse(tpl.defaultTags) as string[] : [],
    }));

    return NextResponse.json({ templates: result });
  } catch (error) {
    logger.error({ err: error }, "Failed to list templates");
    return NextResponse.json({ error: "Failed to list templates" }, { status: 500 });
  }
}

/**
 * POST /api/admin/templates — Create a project template (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const originError = requireOrigin(request);
    if (originError) return originError;

    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role as Role, "project:manage_all")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, titlePrefix, deadlineOffset, defaultTags } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Template name is required" }, { status: 400 });
    }

    if (name.trim().length > 200) {
      return NextResponse.json({ error: "Template name too long" }, { status: 400 });
    }

    const [template] = await db
      .insert(projectTemplates)
      .values({
        name: name.trim(),
        description: description || null,
        titlePrefix: titlePrefix || null,
        deadlineOffset: deadlineOffset ? Number(deadlineOffset) : null,
        defaultTags: Array.isArray(defaultTags) ? JSON.stringify(defaultTags) : null,
      })
      .returning();

    return NextResponse.json(
      {
        template: {
          ...template,
          defaultTags: template.defaultTags ? JSON.parse(template.defaultTags) : [],
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error({ err: error }, "Failed to create template");
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}
