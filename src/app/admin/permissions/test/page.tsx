import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { ShieldX, ArrowLeft } from "lucide-react";
import { getTranslations } from "@/lib/i18n-server";
import { getUsersForSelect } from "../queries";
import { PermissionSimulator } from "./permission-simulator";

export default async function PermissionTestPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const { t } = await getTranslations();

  if (!hasPermission(user.role as Role, "user:manage")) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <ShieldX className="mb-4 h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold">{t("common.accessDenied")}</h1>
      </div>
    );
  }

  const allUsers = await getUsersForSelect();

  return (
    <div className="mx-auto max-w-4xl py-4 sm:py-8">
      <div className="mb-5 flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/permissions"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t("permissions.testTitle")}</h1>
          <p className="text-muted-foreground">{t("permissions.testDesc")}</p>
        </div>
      </div>
      <PermissionSimulator users={allUsers} />
    </div>
  );
}
