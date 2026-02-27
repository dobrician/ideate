import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldX, ArrowLeft } from "lucide-react";
import { getTranslations } from "@/lib/i18n-server";
import { WorkflowManager } from "../workflow-manager";
import { getWorkflowPageData } from "./queries";

export default async function WorkflowsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const { t } = await getTranslations();

  if (!hasPermission(user.role as Role, "user:manage")) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <ShieldX className="mb-4 h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold">{t("common.accessDenied")}</h1>
        <p className="mt-2 max-w-md text-muted-foreground">{t("common.accessDeniedDesc")}</p>
        <Button asChild className="mt-6">
          <Link href="/dashboard">{t("common.goToDashboard")}</Link>
        </Button>
      </div>
    );
  }

  const { workflows, projects } = await getWorkflowPageData();

  return (
    <div className="mx-auto max-w-4xl px-4 py-4 sm:py-8">
      <div className="mb-5 flex items-center gap-3 sm:mb-8">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin"><ArrowLeft className="mr-1 h-4 w-4" />{t("advancedAnalytics.backToAdmin")}</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t("workflow.title")}</h1>
          <p className="text-muted-foreground">{t("workflow.description")}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("workflow.title")}</CardTitle>
          <CardDescription>{t("workflow.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkflowManager initialWorkflows={workflows} projects={projects} />
        </CardContent>
      </Card>
    </div>
  );
}
