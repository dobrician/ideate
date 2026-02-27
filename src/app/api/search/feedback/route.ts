import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { recordSearchFeedback } from "@/lib/search";
import { z } from "zod";

export const dynamic = "force-dynamic";

const feedbackSchema = z.object({
  analyticsId: z.string().min(1),
  resultId: z.string().min(1),
  resultType: z.enum(["project", "proposal", "comment"]),
  rating: z.union([z.literal(1), z.literal(-1)]),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  await recordSearchFeedback({
    userId: user.id,
    ...parsed.data,
  });

  return NextResponse.json({ ok: true });
}
