import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import {
  getEmbeddingMigrationStatus,
  getModelDistribution,
  migrateEmbeddingModel,
} from "@/lib/embeddings";
import { logger } from "@/lib/logger";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** GET: embedding migration status and model distribution. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role as Role, "user:manage")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [status, distribution] = await Promise.all([
      getEmbeddingMigrationStatus(),
      getModelDistribution(),
    ]);

    return NextResponse.json({ status, distribution });
  } catch (error) {
    logger.error({ err: error }, "Embeddings API GET error");
    return NextResponse.json({ error: "Failed to get embedding status" }, { status: 500 });
  }
}

const migrateSchema = z.object({
  targetModel: z.string().min(1).max(100),
});

/** POST: trigger model migration to a target model. */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role as Role, "user:manage")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = migrateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
    }

    const result = await migrateEmbeddingModel(parsed.data.targetModel);

    return NextResponse.json({
      message: `Migration initiated: ${result.queued} embeddings queued for regeneration`,
      ...result,
    });
  } catch (error) {
    logger.error({ err: error }, "Embeddings API POST error");
    return NextResponse.json({ error: "Failed to start migration" }, { status: 500 });
  }
}
