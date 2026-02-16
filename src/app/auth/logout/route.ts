import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

/**
 * POST /auth/logout
 * Clear session and logout user
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

    return NextResponse.redirect(
      new URL(
        "/auth/login",
        process.env.APP_URL || "http://localhost:3000"
      )
    );
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "An error occurred during logout" },
      { status: 500 }
    );
  }
}
