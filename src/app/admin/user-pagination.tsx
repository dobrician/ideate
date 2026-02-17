"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_SIZE, type TranslateFn } from "./user-role-manager-types";

interface UserPaginationProps {
  safePage: number;
  totalPages: number;
  filteredCount: number;
  onPageChange: (page: number) => void;
  t: TranslateFn;
}

export function UserPagination({
  safePage,
  totalPages,
  filteredCount,
  onPageChange,
  t,
}: UserPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between pt-2">
      <p className="text-sm text-muted-foreground">
        {t("admin.showingUsers", {
          from: (safePage - 1) * PAGE_SIZE + 1,
          to: Math.min(safePage * PAGE_SIZE, filteredCount),
          total: filteredCount,
        })}
      </p>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="icon"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label={t("pagination.previous")}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          aria-label={t("pagination.next")}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
