import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tags } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/tags — List all tags (any authenticated user)
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = checkRateLimit(`tags:${getClientIp(request)}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const allTags = await db
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .orderBy(asc(tags.name));

  return NextResponse.json({ tags: allTags });
}
