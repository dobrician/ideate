import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { recordTiming } from "@/lib/perf-monitor";

export function middleware(request: NextRequest) {
  const start = Date.now();
  const response = NextResponse.next();

  const durationMs = Date.now() - start;
  const path = request.nextUrl.pathname;
  const method = request.method;

  response.headers.set("x-response-time", `${durationMs}ms`);
  response.headers.set("server-timing", `total;dur=${durationMs}`);

  recordTiming({
    path,
    method,
    status: response.status,
    durationMs,
    timestamp: Date.now(),
  });

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/).*)",
  ],
};
