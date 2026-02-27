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

  const lastMessageRef = useRef("");

  useEffect(() => {
    if (ref.current && message) {
      // Clear first to ensure screen readers detect changes for repeated messages
      ref.current.textContent = "";
      requestAnimationFrame(() => {
        if (ref.current) {
          // Append invisible character for identical repeated messages
          const suffix = message === lastMessageRef.current ? "\u200B" : "";
          ref.current.textContent = message + suffix;
          lastMessageRef.current = message;
        }
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
