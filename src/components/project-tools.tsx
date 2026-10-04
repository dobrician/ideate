"use client";

import type { ReactNode } from "react";
import { Popover } from "radix-ui";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/use-locale";

/** Keep project administration available without competing with voting. */
export function ProjectTools({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("projects.moreActions")}>
          <MoreHorizontal className="size-5" aria-hidden="true" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end" sideOffset={8} collisionPadding={16}
          aria-label={t("projects.actions")}
          className="z-50 w-72 max-w-[calc(100vw-2rem)] rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg focus:outline-none"
        >
          <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">{t("projects.actions")}</p>
          <div className="flex flex-wrap items-center gap-1">{children}</div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
