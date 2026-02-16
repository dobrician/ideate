import { NextRequest, NextResponse } from "next/server";
import { authenticateWithPassword } from "@/lib/password";
import { setSessionCookie } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_PER_EMAIL = 5;
const MAX_PER_IP = 20;

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

/**
 * Extract client IP from request headers
 */
function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * POST /auth/login-password
 * Authenticate with email and password.
 * Rate limited: 5 per email / 20 per IP per 15 minutes.
 */
export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);

    // IP-level rate limit
    const ipCheck = checkRateLimit(
      `login:ip:${clientIp}`,
      MAX_PER_IP,
      WINDOW_MS
    );
    if (!ipCheck.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(ipCheck.retryAfterMs / 1000)),
          },
        }
      );
    }

    const body = await request.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, password } = result.data;

    // Per-email rate limit
    const emailCheck = checkRateLimit(
      `login:email:${email.toLowerCase().trim()}`,
      MAX_PER_EMAIL,
      WINDOW_MS
    );
    if (!emailCheck.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts for this email. Try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(emailCheck.retryAfterMs / 1000)),
          },
        }
      );
    }

    const authResult = await authenticateWithPassword(email, password);

    if (!authResult) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (!authResult.emailVerified) {
      return NextResponse.json(
        {
          error: "Please verify your email before signing in",
          code: "EMAIL_NOT_VERIFIED",
        },
        { status: 403 }
      );
    }

    await setSessionCookie(authResult.userId, email);

    return NextResponse.json({
      success: true,
      message: "Signed in successfully",
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}
