"use client";

import { useEffect } from "react";

/**
 * Sets a --kb-inset CSS custom property on <html> reflecting the virtual
 * keyboard height (via the visualViewport API).  When the keyboard closes
 * the property is reset to 0px.
 */
export function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    function onResize() {
      const vv = window.visualViewport;
      if (!vv) return;
      const offsetBottom = window.innerHeight - vv.height - vv.offsetTop;
      document.documentElement.style.setProperty("--kb-inset", `${Math.max(0, offsetBottom)}px`);
    }
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
      document.documentElement.style.removeProperty("--kb-inset");
    };
  }, []);
}
