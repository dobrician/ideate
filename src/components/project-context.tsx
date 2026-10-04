"use client";

import { useId, useState, type ReactNode } from "react";

/** Replace the overview with original context while keeping one compact footer. */
export function ProjectContext({ preview, context, stats, label }: {
  preview: ReactNode; context: ReactNode; stats: ReactNode; label: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  return (
    <>
      <div id={contentId} className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {expanded ? context : preview}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t pt-2">
        <div className="min-w-0 flex-1">{stats}</div>
        <button type="button" aria-expanded={expanded} aria-controls={contentId}
          onClick={() => setExpanded(!expanded)}
          className="cursor-pointer flex min-h-8 shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
          {label}
        </button>
      </div>
    </>
  );
}
