"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLocale } from "@/lib/use-locale";

interface FieldErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
}

function validateEmail(email: string, t: (k: string) => string): string | undefined {
  if (!email.trim()) return t("auth.emailRequired");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return t("auth.emailInvalid");
  return undefined;
}

function validatePassword(password: string, t: (k: string) => string): string | undefined {
  if (!password) return t("auth.passwordRequired");
  if (password.length < 8) return t("auth.passwordMinLength");
  if (!/[A-Z]/.test(password)) return t("auth.passwordUppercase");
  if (!/[a-z]/.test(password)) return t("auth.passwordLowercase");
  if (!/\d/.test(password)) return t("auth.passwordNumber");
  return undefined;
}

function validateConfirmPassword(
  password: string,
  confirmPassword: string,
  t: (k: string) => string
): string | undefined {
  if (!confirmPassword) return t("auth.confirmPasswordRequired");
  if (password !== confirmPassword) return t("auth.passwordMismatch");
  return undefined;
}

export default function RegisterPage() {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  function validateAll(): FieldErrors {
    return {
      email: validateEmail(email, t),
      password: validatePassword(password, t),
      confirmPassword: validateConfirmPassword(password, confirmPassword, t),
    };
  }

  function handleBlur(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errors = validateAll();
    setFieldErrors(errors);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const errors = validateAll();
    setFieldErrors(errors);
    setTouched({ email: true, password: true, confirmPassword: true });

    if (errors.email || errors.password || errors.confirmPassword) return;

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, confirmPassword }),
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setError(t("auth.emailAlreadyExists"));
        } else if (response.status === 429) {
          setError(t("auth.tooManyAttempts"));
        } else {
          setError(data.error || t("common.errorOccurred"));
        }
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
      <div className="flex min-h-screen items-center justify-center bg-background px-4 sm:px-6">
        <Card className="w-full max-w-md px-2 shadow-lg sm:px-0">
          <CardHeader className="space-y-1 text-center">
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4 sm:px-6">
      <Card className="w-full max-w-md px-2 shadow-lg sm:px-0">
        <CardHeader className="space-y-1 text-center">
          <p className="text-3xl font-bold tracking-tight">Ideate</p>
          <h1 className="text-2xl font-bold leading-none">
            {t("auth.registerTitle")}
          </h1>
          <CardDescription>{t("auth.registerDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("auth.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => handleBlur("email")}
                disabled={isLoading}
                autoComplete="email"
                autoFocus
                aria-invalid={touched.email && !!fieldErrors.email}
                aria-describedby={fieldErrors.email ? "email-error" : undefined}
              />
              {touched.email && fieldErrors.email && (
                <p id="email-error" className="text-xs text-red-700 dark:text-red-400">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <PasswordInput
                id="password"
                placeholder={t("auth.createPassword")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => handleBlur("password")}
                disabled={isLoading}
                autoComplete="new-password"
                aria-invalid={touched.password && !!fieldErrors.password}
                aria-describedby={
                  touched.password && fieldErrors.password
                    ? "password-error"
                    : "password-hint"
                }
              />
              <p id="password-hint" className="text-xs text-muted-foreground">
                {t("auth.passwordRequirements")}
              </p>
              {touched.password && fieldErrors.password && (
                <p id="password-error" className="text-xs text-red-700 dark:text-red-400">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("auth.confirmPassword")}</Label>
              <PasswordInput
                id="confirmPassword"
                placeholder={t("auth.confirmNewPassword")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => handleBlur("confirmPassword")}
                disabled={isLoading}
                autoComplete="new-password"
                aria-invalid={touched.confirmPassword && !!fieldErrors.confirmPassword}
                aria-describedby={
                  touched.confirmPassword && fieldErrors.confirmPassword
                    ? "confirm-error"
                    : undefined
                }
              />
              {touched.confirmPassword && fieldErrors.confirmPassword && (
                <p id="confirm-error" className="text-xs text-red-700 dark:text-red-400">
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-3 dark:bg-red-950" role="alert">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t("auth.registering") : t("auth.register")}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {t("auth.haveAccount")}{" "}
              <Link
                href="/auth/login"
                className="inline-flex min-h-[44px] items-center font-medium text-primary hover:underline"
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
