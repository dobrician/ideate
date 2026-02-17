"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale } from "@/lib/use-locale";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
}

/**
 * Pagination controls with page numbers and prev/next buttons
 */
export function Pagination({ currentPage, totalPages }: PaginationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useLocale();

  if (totalPages <= 1) return null;

  function buildHref(page: number): string {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", page.toString());
    return `${pathname}?${params.toString()}`;
  }

  // Show up to 5 page numbers centered on current page
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, start + 4);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <nav
      className="flex items-center justify-center gap-1"
      aria-label={t("pagination.ariaNav")}
    >
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 min-h-[44px] min-w-[44px]"
        asChild
        disabled={currentPage <= 1}
        aria-label={t("pagination.ariaPrev")}
      >
        {currentPage > 1 ? (
          <Link href={buildHref(currentPage - 1)}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : (
          <span>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </Button>

      {pages.map((page) => (
        <Button
          key={page}
          variant={page === currentPage ? "default" : "outline"}
          size="icon"
          className="h-8 w-8 min-h-[44px] min-w-[44px]"
          asChild={page !== currentPage}
          aria-label={t("pagination.ariaPage", { page })}
          aria-current={page === currentPage ? "page" : undefined}
        >
          {page === currentPage ? (
            <span>{page}</span>
          ) : (
            <Link href={buildHref(page)}>{page}</Link>
          )}
        </Button>
      ))}

      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 min-h-[44px] min-w-[44px]"
        asChild
        disabled={currentPage >= totalPages}
        aria-label={t("pagination.ariaNext")}
      >
        {currentPage < totalPages ? (
          <Link href={buildHref(currentPage + 1)}>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : (
          <span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </Button>
    </nav>
  );
}
