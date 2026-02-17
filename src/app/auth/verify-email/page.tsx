"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/use-locale";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type VerifyState = "loading" | "success" | "error";

export default function VerifyEmailPage() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [state, setState] = useState<VerifyState>(token ? "loading" : "error");
  const [errorMsg, setErrorMsg] = useState(
    token ? "" : t("auth.invalidLinkDesc")
  );

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    async function verify() {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (cancelled) return;
        if (res.ok) {
          setState("success");
        } else {
          const data = await res.json();
          setState("error");
          setErrorMsg(data.error || t("common.errorOccurred"));
        }
      } catch {
        if (!cancelled) {
          setState("error");
          setErrorMsg(t("common.errorOccurred"));
        }
      }
    }
    verify();
    return () => { cancelled = true; };
  }, [token, t]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <p className="text-3xl font-bold tracking-tight">Ideate</p>
          <CardTitle className="text-2xl font-bold">
            {t("auth.verifyEmail")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {state === "loading" && (
            <p className="text-sm text-muted-foreground">
              {t("auth.verifying")}
            </p>
          )}

          {state === "success" && (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <svg className="h-6 w-6 text-green-600 dark:text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-green-800 dark:text-green-200">
                {t("auth.verifyEmailSuccess")}
              </p>
              <Link href="/auth/login">
                <Button className="w-full">{t("auth.backToLogin")}</Button>
              </Link>
            </>
          )}

          {state === "error" && (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                <svg className="h-6 w-6 text-red-700 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-sm text-red-800 dark:text-red-200">
                {errorMsg}
              </p>
              <Link href="/auth/login">
                <Button variant="outline" className="w-full">
                  {t("auth.backToLogin")}
                </Button>
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
