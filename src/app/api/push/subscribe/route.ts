import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { saveSubscription, type PushSubscriptionData } from "@/lib/push";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = checkRateLimit(`push-subscribe:${user.id}`, 10, 60000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  try {
    const body = await req.json() as PushSubscriptionData;
    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    // Validate push keys are base64url-encoded
    const base64urlPattern = /^[A-Za-z0-9_-]+={0,2}$/;
    if (!base64urlPattern.test(body.keys.p256dh) || !base64urlPattern.test(body.keys.auth)) {
      return NextResponse.json({ error: "Invalid key format" }, { status: 400 });
    }

    // Validate endpoint is HTTPS URL
    try {
      const endpointUrl = new URL(body.endpoint);
      if (endpointUrl.protocol !== "https:") {
        return NextResponse.json({ error: "Endpoint must use HTTPS" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid endpoint URL" }, { status: 400 });
    }

    await saveSubscription(user.id, body);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }
}
