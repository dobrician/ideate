import { redirect } from "next/navigation";
import { verifyMagicLinkToken, findOrCreateUser, setSessionCookie } from "@/lib/auth";

interface VerifyPageProps {
  searchParams: Promise<{ token?: string }>;
}

/**
 * Auth verification page
 * Handles magic link verification and session creation
 */
export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const params = await searchParams;
  const token = params.token;

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-2xl font-bold text-destructive">Invalid Link</h1>
          <p className="text-muted-foreground">
            No verification token found. Please request a new magic link.
          </p>
          <a
            href="/auth/login"
            className="inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            Back to Login
          </a>
        </div>
      </div>
    );
  }

  try {
    // Verify the magic link token
    const email = verifyMagicLinkToken(token);

    if (!email) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="w-full max-w-md space-y-4 text-center">
            <h1 className="text-2xl font-bold text-destructive">Invalid or Expired Link</h1>
            <p className="text-muted-foreground">
              This magic link is invalid or has expired. Magic links are valid for 15 minutes.
            </p>
            <a
              href="/auth/login"
              className="inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
            >
              Request New Link
            </a>
          </div>
        </div>
      );
    }

    // Find or create user
    const userId = await findOrCreateUser(email);

    // Create session
    await setSessionCookie(userId, email);

    // Redirect to home page
    redirect("/");
  } catch (error) {
    console.error("Verification error:", error);

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-2xl font-bold text-destructive">Verification Failed</h1>
          <p className="text-muted-foreground">
            An error occurred during verification. Please try again.
          </p>
          <a
            href="/auth/login"
            className="inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            Back to Login
          </a>
        </div>
      </div>
    );
  }
}
