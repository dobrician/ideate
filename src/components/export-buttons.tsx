"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";

interface ExportButtonsProps {
  projectId: string;
}

/**
 * Export buttons for downloading project reports as PDF/CSV
 */
export function ExportButtons({ projectId }: ExportButtonsProps) {
  const { t } = useLocale();

  function handleExport(format: "pdf" | "csv") {
    try {
      const url = `/api/projects/${projectId}/export?format=${format}`;
      window.open(url, "_blank");
    } catch {
      toast.error(t("export.failed"));
    }
  }

  return (
    <div className="flex gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleExport("pdf")}
        title={t("export.pdfTooltip")}
      >
        <Download className="mr-1 h-3 w-3" />
        {t("export.pdf")}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleExport("csv")}
        title={t("export.csvTooltip")}
      >
        <Download className="mr-1 h-3 w-3" />
        {t("export.csv")}
      </Button>
    </div>
  );
}
