import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTranslations } from "@/lib/i18n-server";

/**
 * Global 404 page
 */
export default async function NotFound() {
  const { t } = await getTranslations();

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-6xl font-bold text-muted-foreground">
            404
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            {t("common.notFoundDesc")}
          </p>
          <div className="flex justify-center gap-2">
            <Button asChild>
              <Link href="/">{t("common.goHome")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/projects">{t("common.viewProjects")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
