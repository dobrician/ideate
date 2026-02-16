"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";

interface ExportButtonsProps {
  projectId: string;
}

/**
 * Export buttons for downloading project reports as PDF/CSV
 */
export function ExportButtons({ projectId }: ExportButtonsProps) {
  function handleExport(format: "pdf" | "csv") {
    try {
      const url = `/api/projects/${projectId}/export?format=${format}`;
      window.open(url, "_blank");
    } catch {
      toast.error("Failed to export report");
    }
  }

  return (
    <div className="flex gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleExport("pdf")}
        title="Download HTML report"
      >
        <Download className="mr-1 h-3 w-3" />
        PDF
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleExport("csv")}
        title="Download CSV"
      >
        <Download className="mr-1 h-3 w-3" />
        CSV
      </Button>
    </div>
  );
}
