"use client";

import { useState, useEffect, type ReactNode } from "react";

/**
 * Wrapper that renders children only after client-side mount.
 * During SSR, renders the fallback (default: null).
 * This completely eliminates hydration mismatch for wrapped content
 * by ensuring there's nothing server-rendered to mismatch against.
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <>{children}</> : <>{fallback}</>;
}
