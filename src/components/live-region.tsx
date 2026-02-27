"use client";

import { useEffect, useRef } from "react";

interface LiveRegionProps {
  message: string;
  priority?: "polite" | "assertive";
}

/**
 * Accessible live region component for dynamic content announcements.
 * Updates the aria-live region when message changes.
 */
export function LiveRegion({ message, priority = "polite" }: LiveRegionProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && message) {
      ref.current.textContent = "";
      requestAnimationFrame(() => {
        if (ref.current) ref.current.textContent = message;
      });
    }
  }, [message]);

  return (
    <div
      ref={ref}
      aria-live={priority}
      aria-atomic="true"
      role={priority === "assertive" ? "alert" : "status"}
      className="sr-only"
    />
  );
}
