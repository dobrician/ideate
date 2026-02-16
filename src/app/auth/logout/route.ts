import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

/**
 * POST /auth/logout
 * Clear session and redirect to login (clean page, no sidebar)
 */
export async function POST(request: NextRequest) {
  try {
    await clearSession();

    const acceptHeader = request.headers.get("accept") || "";
    if (acceptHeader.includes("application/json")) {
      return NextResponse.json({
        success: true,
        message: "Logged out successfully",
      });
    }

    const url = new URL("/auth/login", request.url);
    const response = NextResponse.redirect(url);
    // Ensure cookies are cleared in the redirect response as well
    response.cookies.delete("session");
    response.cookies.delete("csrf_token");
    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "An error occurred during logout" },
      { status: 500 }
    );
  }
}
