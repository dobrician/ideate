"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale } from "@/lib/use-locale";

/**
 * Error boundary for the admin panel
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLocale();

  return (
    <div className="container mx-auto flex max-w-lg items-center justify-center px-4 py-16">
      <Card className="w-full">
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
              <Link href="/dashboard">{t("nav.dashboard")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
