import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { removeSubscription } from "@/lib/push";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = checkRateLimit(`push-unsubscribe:${user.id}`, 10, 60000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  try {
    const { endpoint } = await req.json();
    if (!endpoint || typeof endpoint !== "string") {
      return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
    }

    // Validate endpoint is a valid HTTPS URL
    try {
      const endpointUrl = new URL(endpoint);
      if (endpointUrl.protocol !== "https:") {
        return NextResponse.json({ error: "Endpoint must use HTTPS" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid endpoint URL" }, { status: 400 });
    }

    await removeSubscription(user.id, endpoint);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to remove subscription" }, { status: 500 });
  }
}
