import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { subscribeVotes } from "@/lib/vote-events";
import { logger } from "@/lib/logger";
import { captureError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

/**
 * SSE endpoint for real-time vote updates.
 * GET /api/votes/stream?projectId=xxx
 * Sends { proposalId, upvotes, downvotes } events.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const projectId = request.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return new Response(JSON.stringify({ error: "Missing projectId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const encoder = new TextEncoder();
    let unsubscribe: (() => void) | null = null;

    let keepaliveId: ReturnType<typeof setInterval> | null = null;

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(": keepalive\n\n"));

        unsubscribe = subscribeVotes(projectId, (event) => {
          try {
            const data = JSON.stringify({
              proposalId: event.proposalId,
              upvotes: event.upvotes,
              downvotes: event.downvotes,
            });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          } catch {
            // Stream closed
          }
        });

        keepaliveId = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(": keepalive\n\n"));
          } catch {
            if (keepaliveId) clearInterval(keepaliveId);
          }
        }, 30000);

        request.signal.addEventListener("abort", () => {
          if (keepaliveId) clearInterval(keepaliveId);
          unsubscribe?.();
        });
      },
      cancel() {
        if (keepaliveId) clearInterval(keepaliveId);
        unsubscribe?.();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Vote stream error");
    captureError(error, { route: "GET /api/votes/stream" });
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
