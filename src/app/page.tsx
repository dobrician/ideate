import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FolderOpen,
  Lightbulb,
  BarChart3,
  Users,
  LayoutDashboard,
} from "lucide-react";
import { getTranslations } from "@/lib/i18n-server";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Ideate",
  description:
    "Enterprise-grade democratic idea prioritization platform for teams",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Any",
  url: "https://idea.surmont.co",
};

export default async function HomePage() {
  const { t } = await getTranslations();

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-8" role="main">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="text-center sm:text-left">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("home.welcome")}
        </h2>
        <p className="mt-2 text-muted-foreground">
          {t("home.description")}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/projects">
            <FolderOpen className="mr-2 h-4 w-4" />
            {t("home.viewProjects")}
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/dashboard">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            {t("home.dashboard")}
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="region" aria-label="Platform features">
        <Card className="transition-shadow duration-200 hover:shadow-md">
          <CardHeader>
            <FolderOpen className="mb-2 h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <CardTitle>{t("home.feature.projects")}</CardTitle>
            <CardDescription>
              {t("home.feature.projectsDesc")}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="transition-shadow duration-200 hover:shadow-md">
          <CardHeader>
            <Lightbulb className="mb-2 h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <CardTitle>{t("home.feature.proposals")}</CardTitle>
            <CardDescription>
              {t("home.feature.proposalsDesc")}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="transition-shadow duration-200 hover:shadow-md">
          <CardHeader>
            <BarChart3 className="mb-2 h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <CardTitle>{t("home.feature.consensus")}</CardTitle>
            <CardDescription>
              {t("home.feature.consensusDesc")}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="transition-shadow duration-200 hover:shadow-md">
          <CardHeader>
            <Users className="mb-2 h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <CardTitle>{t("home.feature.discussion")}</CardTitle>
            <CardDescription>
              {t("home.feature.discussionDesc")}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="transition-shadow duration-200 hover:shadow-md">
          <CardHeader>
            <LayoutDashboard className="mb-2 h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <CardTitle>{t("home.feature.dashboardTitle")}</CardTitle>
            <CardDescription>
              {t("home.feature.dashboardDesc")}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </main>
  );
}
