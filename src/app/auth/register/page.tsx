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
 * Registration page with email and password
 */
export default function RegisterPage() {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError(t("auth.passwordMismatch"));
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, confirmPassword }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Registration failed");
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
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">
              {t("auth.verifyEmailTitle")}
            </CardTitle>
            <CardDescription>
              {t("auth.verifyEmailDesc")}{" "}
              <span className="font-medium">{email}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-green-50 p-4 dark:bg-green-950">
              <p className="text-sm text-green-800 dark:text-green-200">
                {t("auth.verifyEmailNote")}
              </p>
            </div>
            <Link href="/auth/login">
              <Button variant="outline" className="w-full">
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
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">
            {t("auth.registerTitle")}
          </CardTitle>
          <CardDescription>
            {t("auth.registerDesc")}
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
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t("auth.createPassword")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="new-password"
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">
                {t("auth.passwordRequirements")}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("auth.confirmPassword")}</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder={t("auth.confirmNewPassword")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="new-password"
                minLength={8}
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
              {isLoading ? t("auth.registering") : t("auth.register")}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {t("auth.haveAccount")}{" "}
              <Link
                href="/auth/login"
                className="font-medium text-primary hover:underline"
              >
                {t("auth.login")}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
