"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Archive } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";
import { unarchiveProject } from "@/app/projects/actions";
import { getCsrfTokenClient } from "@/lib/csrf-client";
import { useRouter } from "next/navigation";

interface ArchiveBannerProps {
  projectId: string;
  isAdmin: boolean;
}

export function ArchiveBanner({ projectId, isAdmin }: ArchiveBannerProps) {
  const { t } = useLocale();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleUnarchive() {
    setLoading(true);
    const result = await unarchiveProject(projectId, getCsrfTokenClient());
    if (result?.error) {
      toast.error(result.error);
      setLoading(false);
    } else {
      toast.success(t("archive.unarchived"));
      router.refresh();
    }
  }

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950">
      <Archive className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="flex-1 text-sm font-medium text-amber-800 dark:text-amber-200">
        {t("archive.banner")}
      </p>
      {isAdmin && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleUnarchive}
          disabled={loading}
          className="shrink-0"
        >
          {loading ? t("archive.unarchiving") : t("archive.unarchive")}
        </Button>
      )}
    </div>
  );
}
