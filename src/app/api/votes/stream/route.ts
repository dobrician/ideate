import { NextRequest } from "next/server";
import { subscribeVotes, type VoteEvent } from "@/lib/vote-events";

export const dynamic = "force-dynamic";

/**
 * SSE endpoint for real-time vote updates.
 * GET /api/votes/stream?projectId=xxx
 * Sends { proposalId, upvotes, downvotes } events.
 */
export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return new Response("Missing projectId", { status: 400 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial keepalive
      controller.enqueue(encoder.encode(": keepalive\n\n"));

      unsubscribe = subscribeVotes(projectId, (event: VoteEvent) => {
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

      // Keepalive every 30s
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepalive);
        }
      }, 30000);

      // Cleanup on abort
      request.signal.addEventListener("abort", () => {
        clearInterval(keepalive);
        unsubscribe?.();
      });
    },
    cancel() {
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
}
