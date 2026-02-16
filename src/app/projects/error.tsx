"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale } from "@/lib/use-locale";

/**
 * Error boundary for projects pages
 */
export default function ProjectsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLocale();

  useEffect(() => {
    console.error("Projects error:", error);
  }, [error]);

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="mx-auto max-w-lg">
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
              <Link href="/">{t("common.goHome")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
