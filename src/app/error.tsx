"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { useLocale } from "@/lib/use-locale";

/**
 * Global error boundary
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLocale();

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-destructive">
            {t("common.error")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {error.message || t("common.errorOccurred")}
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground">
              {t("common.errorId", { id: error.digest || "" })}
            </p>
          )}
          <div className="flex justify-center gap-2">
            <Button onClick={reset}>{t("common.retry")}</Button>
            <Button asChild variant="outline">
              <Link href="/">{t("common.goHome")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
