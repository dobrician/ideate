"use client";

import { useState, useEffect } from "react";

/**
 * React hook that reactively detects high contrast preference.
 * Listens for changes to forced-colors and prefers-contrast media queries.
 */
export function useHighContrast(): boolean {
  const [isHighContrast, setIsHighContrast] = useState(false);

  useEffect(() => {
    const forcedColors = window.matchMedia("(forced-colors: active)");
    const prefersContrast = window.matchMedia("(prefers-contrast: more)");

    const update = () => {
      setIsHighContrast(forcedColors.matches || prefersContrast.matches);
    };

    update();
    forcedColors.addEventListener("change", update);
    prefersContrast.addEventListener("change", update);

    return () => {
      forcedColors.removeEventListener("change", update);
      prefersContrast.removeEventListener("change", update);
    };
  }, []);

  return isHighContrast;
}
