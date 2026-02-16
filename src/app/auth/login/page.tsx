"use client";

import { useState, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

    try {
      const response = await fetch("/api/auth/login-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
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
                className="mt-1 text-xs text-green-600 underline dark:text-green-400"
              >
                {t("auth.dismiss")}
              </button>
            </div>
          )}

          {success ? (
            <div className="space-y-4">
              <div className="rounded-md bg-green-50 p-4 dark:bg-green-950">
                <p className="text-sm text-green-800 dark:text-green-200">
                  {t("auth.magicLinkSent")}
                </p>
              </div>
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
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    {t("auth.forgotPassword")}
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
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
                  className="font-medium text-primary hover:underline"
                >
                  {t("auth.register")}
                </Link>
              </p>
            </form>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-4">
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
                  className="font-medium text-primary hover:underline"
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
