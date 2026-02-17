"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/use-locale";

const MOBILE_LIMIT = 3;

/**
 * Wraps a list of children and collapses to 3 items on mobile.
 * On desktop all items are always visible.
 */
export function CollapsibleList({
  children,
  total,
}: {
  children: React.ReactNode[];
  total: number;
}) {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(false);

  if (total <= MOBILE_LIMIT) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Desktop: show all */}
      <div className="hidden sm:block">{children}</div>
      {/* Mobile: collapsible */}
      <div className="sm:hidden">
        {expanded ? children : children.slice(0, MOBILE_LIMIT)}
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full text-xs"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? t("dashboard.showLess") : t("dashboard.showMore", { count: total - MOBILE_LIMIT })}
        </Button>
      </div>
    </>
  );
}
