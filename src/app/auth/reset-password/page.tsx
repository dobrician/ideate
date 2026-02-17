"use client";

import { useState, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
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

/**
 * Reset password page - set a new password using a reset token
 */
export default function ResetPasswordPage() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  function validatePw(v: string) {
    if (!v) return t("auth.passwordRequired");
    if (v.length < 8) return t("auth.passwordMinLength");
    if (!/[A-Z]/.test(v)) return t("auth.passwordUppercase");
    if (!/[a-z]/.test(v)) return t("auth.passwordLowercase");
    if (!/\d/.test(v)) return t("auth.passwordNumber");
    return undefined;
  }

  function validateConfirm(pw: string, cpw: string) {
    if (!cpw) return t("auth.confirmPasswordRequired");
    if (pw !== cpw) return t("auth.passwordMismatch");
    return undefined;
  }

  function handleBlur(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (field === "password") {
      setFieldErrors((prev) => ({ ...prev, password: validatePw(password) }));
    } else {
      setFieldErrors((prev) => ({ ...prev, confirmPassword: validateConfirm(password, confirmPassword) }));
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">{t("auth.invalidLink")}</CardTitle>
            <CardDescription>
              {t("auth.invalidLinkDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/auth/forgot-password">
              <Button className="w-full">{t("auth.requestNewLink")}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const pwErr = validatePw(password);
    const cpErr = validateConfirm(password, confirmPassword);
    setFieldErrors({ password: pwErr, confirmPassword: cpErr });
    setTouched({ password: true, confirmPassword: true });
    if (pwErr || cpErr) return;

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t("common.errorOccurred"));
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
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">
              {t("auth.passwordReset")}
            </CardTitle>
            <CardDescription>
              {t("auth.passwordResetSuccess")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="rounded-md bg-green-50 p-4 dark:bg-green-950">
                <p className="text-sm text-green-800 dark:text-green-200">
                  {t("auth.signInNow")}
                </p>
              </div>
              <Link href="/auth/login">
                <Button className="w-full">{t("auth.login")}</Button>
              </Link>
            </div>
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
            {t("auth.resetPasswordTitle")}
          </CardTitle>
          <CardDescription>
            {t("auth.resetPasswordDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.newPassword")}</Label>
              <PasswordInput
                id="password"
                placeholder={t("auth.createNewPassword")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => handleBlur("password")}
                disabled={isLoading}
                autoComplete="new-password"
                autoFocus
                aria-invalid={touched.password && !!fieldErrors.password}
                aria-describedby={touched.password && fieldErrors.password ? "reset-pw-error" : "reset-pw-hint"}
              />
              <p id="reset-pw-hint" className="text-xs text-muted-foreground">
                {t("auth.passwordRequirements")}
              </p>
              {touched.password && fieldErrors.password && (
                <p id="reset-pw-error" className="text-xs text-red-600 dark:text-red-400">{fieldErrors.password}</p>
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
                aria-describedby={fieldErrors.confirmPassword ? "reset-cpw-error" : undefined}
              />
              {touched.confirmPassword && fieldErrors.confirmPassword && (
                <p id="reset-cpw-error" className="text-xs text-red-600 dark:text-red-400">{fieldErrors.confirmPassword}</p>
              )}
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-3 dark:bg-red-950">
                <p className="text-sm text-red-800 dark:text-red-200">
                  {error}
                </p>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t("auth.resetting") : t("auth.resetPassword")}
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
