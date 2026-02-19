import { NextRequest } from "next/server";
import { handleUpgrade, getConnectionStats } from "@/lib/websocket/server";

export const dynamic = "force-dynamic";

/**
 * WebSocket upgrade endpoint.
 *
 * In development or custom server setups, the HTTP upgrade is handled
 * by the server module directly. This GET handler serves as a health
 * check and returns connection stats for the admin dashboard.
 *
 * For WebSocket connections, clients connect via the ws:// or wss://
 * protocol and the upgrade is handled by the custom server integration
 * (see src/lib/websocket/server.ts handleUpgrade).
 */
export async function GET(request: NextRequest) {
  // Check if this is a WebSocket upgrade request
  const upgradeHeader = request.headers.get("upgrade");
  if (upgradeHeader?.toLowerCase() === "websocket") {
    // In Next.js, WebSocket upgrades must be handled at the HTTP server level.
    // The route handler cannot directly perform the upgrade.
    // The actual upgrade is handled by the custom server integration.
    // Return 426 to indicate upgrade required if the server integration isn't active.
    return new Response(
      JSON.stringify({
        error: "WebSocket upgrade must be handled by the server integration",
        hint: "Connect using ws:// or wss:// protocol",
      }),
      {
        status: 426,
        headers: {
          "Content-Type": "application/json",
          Upgrade: "websocket",
        },
      },
    );
  }

  // Health check / stats endpoint
  const stats = getConnectionStats();
  return new Response(
    JSON.stringify({
      status: "ok",
      connections: stats,
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
}

// Re-export handleUpgrade for use by the custom server integration
export { handleUpgrade };
