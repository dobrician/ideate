"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { useLocale } from "@/lib/use-locale";
import { useLoginForm } from "@/lib/use-login-form";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

const oidcEnabled = process.env.NEXT_PUBLIC_OIDC_ENABLED === "true";

export function getSafeRedirect(value: string | null): string {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  if (value.includes("\\")) return "/";
  return value;
}

function OrDivider({ label }: { label: string }) {
  return (
    <div className="relative my-4">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-background px-2 text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const verified = searchParams.get("verified") === "true";
  const errorParam = searchParams.get("error");
  const [verifiedBanner, setVerifiedBanner] = useState(verified);

  const form = useLoginForm(t, searchParams.get("redirect"));

  // Map OIDC error params to initial error
  if (errorParam && !form.error) {
    const oidcErrors: Record<string, string> = {
      oidc_error: t("auth.oidcError"),
      oidc_denied: t("auth.oidcDenied"),
      oidc_state_mismatch: t("auth.oidcError"),
      oidc_not_configured: t("auth.oidcError"),
      oidc_missing_params: t("auth.oidcError"),
      oidc_no_subject: t("auth.oidcError"),
    };
    if (oidcErrors[errorParam]) form.setError(oidcErrors[errorParam]);
    else if (errorParam) form.setError(errorParam);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 sm:px-6">
      <Card className="w-full max-w-md px-2 shadow-lg sm:px-0">
        <CardHeader className="space-y-1 text-center">
          <p className="text-3xl font-bold tracking-tight">Ideate</p>
          <h1 className="text-2xl font-bold leading-none">{t("auth.signIn")}</h1>
          <CardDescription>
            {form.mode === "magic-link" ? t("auth.signInMagicDesc") : t("auth.signInDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {verifiedBanner && (
            <div className="mb-4 rounded-md bg-green-50 p-3 dark:bg-green-950">
              <p className="text-sm text-green-800 dark:text-green-200">{t("auth.emailVerified")}</p>
              <Button variant="link" onClick={() => setVerifiedBanner(false)} className="mt-1 px-0 text-xs text-green-600 dark:text-green-300">
                {t("auth.dismiss")}
              </Button>
            </div>
          )}

          {form.success ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <svg className="h-6 w-6 text-green-600 dark:text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </div>
              <h3 className="text-lg font-semibold">{t("auth.magicLinkCheckTitle")}</h3>
              <p className="text-sm text-muted-foreground">{t("auth.magicLinkCheckDesc")}</p>
              <p className="text-xs text-muted-foreground">{t("auth.magicLinkCheckSpam")}</p>
              <Button variant="outline" onClick={() => form.setSuccess(false)} className="w-full">{t("auth.sendAnother")}</Button>
            </div>
          ) : form.mode === "password" ? (
            <form onSubmit={form.handlePasswordLogin} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input id="email" type="email" placeholder={t("auth.emailPlaceholder")} value={form.email} onChange={(e) => form.setEmail(e.target.value)} onBlur={() => form.handleBlur("email")} disabled={form.isLoading} autoComplete="email" autoFocus aria-invalid={form.touched.email && !!form.fieldErrors.email} aria-describedby={form.fieldErrors.email ? "login-email-error" : undefined} />
                {form.touched.email && form.fieldErrors.email && (
                  <p id="login-email-error" className="text-xs text-red-700 dark:text-red-400">{form.fieldErrors.email}</p>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  <Link href="/auth/forgot-password" className="inline-flex min-h-[44px] items-center text-xs text-muted-foreground hover:underline">{t("auth.forgotPassword")}</Link>
                </div>
                <PasswordInput id="password" placeholder={t("auth.enterPassword")} value={form.password} onChange={(e) => form.setPassword(e.target.value)} onBlur={() => form.handleBlur("password")} disabled={form.isLoading} autoComplete="current-password" aria-invalid={form.touched.password && !!form.fieldErrors.password} aria-describedby={form.fieldErrors.password ? "login-password-error" : undefined} />
                {form.touched.password && form.fieldErrors.password && (
                  <p id="login-password-error" className="text-xs text-red-700 dark:text-red-400">{form.fieldErrors.password}</p>
                )}
              </div>

              {form.error && (
                <div className="rounded-md bg-red-50 p-3 dark:bg-red-950" role="alert">
                  <p className="text-sm text-red-800 dark:text-red-200">{form.error}</p>
                  {form.needsVerification && !form.resendSuccess && (
                    <Button type="button" variant="link" className="mt-1 px-0 text-xs text-red-700 dark:text-red-300" onClick={form.handleResendVerification} disabled={form.resendLoading}>
                      {form.resendLoading ? t("auth.sending") : t("auth.resendVerification")}
                    </Button>
                  )}
                  {form.resendSuccess && (
                    <p className="mt-1 text-xs text-green-700 dark:text-green-300">{t("auth.verifyEmailNote")}</p>
                  )}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={form.isLoading}>
                {form.isLoading ? t("auth.signingIn") : t("auth.signInWithPassword")}
              </Button>
              <OrDivider label={t("auth.or")} />
              {oidcEnabled && (
                <Button type="button" variant="outline" className="w-full" onClick={() => { window.location.href = "/api/auth/oidc"; }}>
                  {t("auth.signInWithOidc")}
                </Button>
              )}
              <Button type="button" variant="outline" className="w-full" onClick={() => form.switchMode("magic-link")}>{t("auth.signInWithMagicLink")}</Button>
              <p className="text-center text-sm text-muted-foreground">
                {t("auth.noAccount")}{" "}
                <Link href="/auth/register" className="inline-flex min-h-[44px] items-center font-medium text-primary hover:underline">{t("auth.register")}</Link>
              </p>
            </form>
          ) : (
            <form onSubmit={form.handleMagicLink} className="space-y-4" noValidate>
              <p className="text-sm text-muted-foreground">{t("auth.magicLinkExplainer")}</p>
              <div className="space-y-2">
                <Label htmlFor="email-magic">{t("auth.email")}</Label>
                <Input id="email-magic" type="email" placeholder={t("auth.emailPlaceholder")} value={form.email} onChange={(e) => form.setEmail(e.target.value)} onBlur={() => form.handleBlur("email")} disabled={form.isLoading} autoComplete="email" autoFocus aria-invalid={form.touched.email && !!form.fieldErrors.email} aria-describedby={form.fieldErrors.email ? "magic-email-error" : undefined} />
                {form.touched.email && form.fieldErrors.email && (
                  <p id="magic-email-error" className="text-xs text-red-700 dark:text-red-400">{form.fieldErrors.email}</p>
                )}
              </div>
              {form.error && (
                <div className="rounded-md bg-red-50 p-3 dark:bg-red-950" role="alert">
                  <p className="text-sm text-red-800 dark:text-red-200">{form.error}</p>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={form.isLoading}>
                {form.isLoading ? t("auth.sending") : t("auth.sendLink")}
              </Button>
              <p className="text-center text-xs text-muted-foreground">{t("auth.magicLinkExpiry")}</p>
              <OrDivider label={t("auth.or")} />
              <Button type="button" variant="outline" className="w-full" onClick={() => form.switchMode("password")}>{t("auth.signInWithPassword")}</Button>
              <p className="text-center text-sm text-muted-foreground">
                {t("auth.noAccount")}{" "}
                <Link href="/auth/register" className="inline-flex min-h-[44px] items-center font-medium text-primary hover:underline">{t("auth.register")}</Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
