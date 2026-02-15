import { NextRequest, NextResponse } from "next/server";
import { generateMagicLink } from "@/lib/auth";
import { sendMagicLinkEmail } from "@/lib/mail";
import { z } from "zod";

/**
 * Email validation schema
 */
const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address").toLowerCase().trim(),
});

/**
 * POST /auth/request
 * Request a magic link to be sent to the provided email
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate email
    const result = emailSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email } = result.data;

    // Generate magic link
    const magicLink = generateMagicLink(email);

    // Send email (in production, handle errors gracefully to prevent email enumeration)
    try {
      await sendMagicLinkEmail(email, magicLink);
    } catch (error) {
      console.error("Failed to send magic link:", error);
      // In production, still return success to prevent email enumeration
      // In dev, we can show the error
      if (process.env.NODE_ENV === "development") {
        return NextResponse.json(
          { error: "Failed to send email. Check SMTP configuration." },
          { status: 500 }
        );
      }
    }

    // Always return success to prevent email enumeration attacks
    return NextResponse.json({
      success: true,
      message: "If an account exists with this email, a magic link has been sent.",
    });
  } catch (error) {
    console.error("Magic link request error:", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}
