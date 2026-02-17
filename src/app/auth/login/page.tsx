"use client";

import { useState, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { useLocale } from "@/lib/use-locale";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type AuthMode = "magic-link" | "password";

/**
 * Login page with dual authentication: magic link + email/password
 */
export default function LoginPage() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const verified = searchParams.get("verified") === "true";
  const errorParam = searchParams.get("error");

  const [mode, setMode] = useState<AuthMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(errorParam || "");
  const [success, setSuccess] = useState(false);
  const [verifiedBanner, setVerifiedBanner] = useState(verified);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  async function handleMagicLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess(false);

    try {
      const response = await fetch("/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to send magic link");
        return;
      }
      setSuccess(true);
      setEmail("");
    } catch {
      setError(t("common.errorOccurred"));
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePasswordLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setNeedsVerification(false);
    setResendSuccess(false);

    try {
      const response = await fetch("/api/auth/login-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.code === "EMAIL_NOT_VERIFIED") {
          setNeedsVerification(true);
        }
        setError(data.error || "Failed to sign in");
        return;
      }
      window.location.href = searchParams.get("redirect") || "/";
    } catch {
      setError(t("common.errorOccurred"));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendVerification() {
    setResendLoading(true);
    setResendSuccess(false);
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (response.ok) {
        setResendSuccess(true);
      }
    } catch {
      // silent — the button already gave feedback
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <p className="text-3xl font-bold tracking-tight">Ideate</p>
          <CardTitle className="text-2xl font-bold">
            {t("auth.signIn")}
          </CardTitle>
          <CardDescription>
            {mode === "magic-link"
              ? t("auth.signInMagicDesc")
              : t("auth.signInDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {verifiedBanner && (
            <div className="mb-4 rounded-md bg-green-50 p-3 dark:bg-green-950">
              <p className="text-sm text-green-800 dark:text-green-200">
                {t("auth.emailVerified")}
              </p>
              <button
                onClick={() => setVerifiedBanner(false)}
                className="mt-1 inline-flex min-h-[44px] items-center text-xs text-green-600 underline dark:text-green-400"
              >
                {t("auth.dismiss")}
              </button>
            </div>
          )}

          {success ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <svg className="h-6 w-6 text-green-600 dark:text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </div>
              <h3 className="text-lg font-semibold">{t("auth.magicLinkCheckTitle")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("auth.magicLinkCheckDesc")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("auth.magicLinkCheckSpam")}
              </p>
              <Button
                variant="outline"
                onClick={() => setSuccess(false)}
                className="w-full"
              >
                {t("auth.sendAnother")}
              </Button>
            </div>
          ) : mode === "password" ? (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="email"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="inline-flex min-h-[44px] items-center text-xs text-muted-foreground hover:underline"
                  >
                    {t("auth.forgotPassword")}
                  </Link>
                </div>
                <PasswordInput
                  id="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <div className="rounded-md bg-red-50 p-3 dark:bg-red-950">
                  <p className="text-sm text-red-800 dark:text-red-200">
                    {error}
                  </p>
                  {needsVerification && !resendSuccess && (
                    <Button
                      type="button"
                      variant="link"
                      className="mt-1 min-h-[44px] px-0 text-xs text-red-700 dark:text-red-300"
                      onClick={handleResendVerification}
                      disabled={resendLoading}
                    >
                      {resendLoading ? t("auth.sending") : t("auth.resendVerification")}
                    </Button>
                  )}
                  {resendSuccess && (
                    <p className="mt-1 text-xs text-green-700 dark:text-green-300">
                      {t("auth.verifyEmailNote")}
                    </p>
                  )}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? t("auth.signingIn") : t("auth.signInWithPassword")}
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {t("auth.or")}
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setMode("magic-link");
                  setError("");
                }}
              >
                {t("auth.signInWithMagicLink")}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                {t("auth.noAccount")}{" "}
                <Link
                  href="/auth/register"
                  className="inline-flex min-h-[44px] items-center font-medium text-primary hover:underline"
                >
                  {t("auth.register")}
                </Link>
              </p>
            </form>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("auth.magicLinkExplainer")}
              </p>
              <div className="space-y-2">
                <Label htmlFor="email-magic">{t("auth.email")}</Label>
                <Input
                  id="email-magic"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="email"
                  autoFocus
                />
              </div>

              {error && (
                <div className="rounded-md bg-red-50 p-3 dark:bg-red-950">
                  <p className="text-sm text-red-800 dark:text-red-200">
                    {error}
                  </p>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? t("auth.sending") : t("auth.sendLink")}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                {t("auth.magicLinkExpiry")}
              </p>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {t("auth.or")}
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setMode("password");
                  setError("");
                }}
              >
                {t("auth.signInWithPassword")}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                {t("auth.noAccount")}{" "}
                <Link
                  href="/auth/register"
                  className="inline-flex min-h-[44px] items-center font-medium text-primary hover:underline"
                >
                  {t("auth.register")}
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
