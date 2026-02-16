"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLocale } from "@/lib/use-locale";

/**
 * Forgot password page - request a password reset link
 */
export default function ForgotPasswordPage() {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send reset link");
        return;
      }

      setSuccess(true);
    } catch {
      setError(t("common.errorOccurred"));
    } finally {
      setIsLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold">
              {t("auth.checkEmailTitle")}
            </CardTitle>
            <CardDescription>
              {t("auth.checkEmailResetDesc", { email })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-green-50 p-4 dark:bg-green-950">
              <p className="text-sm text-green-800 dark:text-green-200">
                {t("auth.resetExpiry")}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setSuccess(false)}
              className="w-full"
            >
              {t("auth.sendAnother")}
            </Button>
            <Link href="/auth/login">
              <Button variant="ghost" className="w-full">
                {t("auth.backToLogin")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">
            {t("auth.forgotPasswordTitle")}
          </CardTitle>
          <CardDescription>
            {t("auth.forgotPasswordDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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

            {error && (
              <div className="rounded-md bg-red-50 p-3 dark:bg-red-950">
                <p className="text-sm text-red-800 dark:text-red-200">
                  {error}
                </p>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t("auth.sendingReset") : t("auth.sendResetLink")}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              <Link
                href="/auth/login"
                className="font-medium text-primary hover:underline"
              >
                {t("auth.backToLogin")}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
