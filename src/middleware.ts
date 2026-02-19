import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { recordTiming } from "@/lib/perf-monitor";

export const REQUEST_TIMEOUT_MS = 30_000;

export function middleware(request: NextRequest) {
  const start = Date.now();
  const deadline = start + REQUEST_TIMEOUT_MS;
  const response = NextResponse.next();

  const durationMs = Date.now() - start;
  const path = request.nextUrl.pathname;
  const method = request.method;

  response.headers.set("x-response-time", `${durationMs}ms`);
  response.headers.set("server-timing", `total;dur=${durationMs}`);
  response.headers.set("x-request-deadline", String(deadline));
  response.headers.set("x-request-timeout", String(REQUEST_TIMEOUT_MS));

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
