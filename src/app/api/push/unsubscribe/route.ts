import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { removeSubscription } from "@/lib/push";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { endpoint } = await req.json();
    if (!endpoint) {
      return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
    }

    await removeSubscription(user.id, endpoint);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to remove subscription" }, { status: 500 });
  }
}
