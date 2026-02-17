"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";

interface Props {
  projectId: string;
}

export function RegenerateSummaryButton({ projectId }: Props) {
  const { t } = useLocale();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRegenerate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/summary`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.summary) {
        toast.success(t("projectSummary.success"));
        router.refresh();
      } else if (data.code === "RATE_LIMITED") {
        toast.error(t("projectSummary.rateLimited"));
      } else if (data.code === "NO_KEYS") {
        toast.error(t("projectSummary.noKeys"));
      } else if (data.code === "AI_UNAVAILABLE") {
        toast.error(t("projectSummary.unavailable"));
      } else {
        toast.error(data.error || t("projectSummary.error"));
      }
    } catch {
      toast.error(t("projectSummary.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleRegenerate}
      disabled={loading}
      className="text-muted-foreground"
    >
      <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
      {loading ? t("projectSummary.regenerating") : t("projectSummary.regenerate")}
    </Button>
  );
}
