import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyMagicLinkToken, findOrCreateUser, setSessionCookie } from "@/lib/auth";

interface VerifyPageProps {
  searchParams: Promise<{ token?: string; redirect?: string }>;
}

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-bold text-destructive">{title}</h1>
        <p className="text-muted-foreground">{message}</p>
        <Link
          href="/auth/login"
          className="inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
}

/**
 * Auth verification page
 * Handles magic link verification and session creation
 */
export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const params = await searchParams;
  const token = params.token;

  if (!token) {
    return <ErrorCard title="Invalid Link" message="No verification token found. Please request a new magic link." />;
  }

  let email: string | null = null;
  let error = false;

  try {
    email = verifyMagicLinkToken(token);
  } catch (e) {
    console.error("Verification error:", e);
    error = true;
  }

  if (error || !email) {
    return (
      <ErrorCard
        title={error ? "Verification Failed" : "Invalid or Expired Link"}
        message={
          error
            ? "An error occurred during verification. Please try again."
            : "This magic link is invalid or has expired. Magic links are valid for 15 minutes."
        }
      />
    );
  }

  const userId = await findOrCreateUser(email);
  await setSessionCookie(userId, email);

  const redirectTo = params.redirect && params.redirect.startsWith("/") ? params.redirect : "/";
  redirect(redirectTo);
}
