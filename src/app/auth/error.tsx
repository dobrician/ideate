"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale } from "@/lib/use-locale";

/**
 * Error boundary for auth pages
 */
export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLocale();

  useEffect(() => {
    console.error("Auth error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-destructive">{t("common.error")}</CardTitle>
          <CardDescription>
            {error.message || t("common.errorOccurred")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button onClick={reset} className="flex-1">
              {t("common.retry")}
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <a href="/auth/login">{t("auth.backToLogin")}</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
