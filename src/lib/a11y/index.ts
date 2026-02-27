/**
 * Accessibility utilities for WCAG 2.1 AAA compliance.
 * Live region announcements, focus management, and reduced motion detection.
 */

/**
 * Announce a message to screen readers via a live region.
 * Creates a temporary aria-live element that is auto-removed.
 */
export function announce(message: string, priority: "polite" | "assertive" = "polite"): void {
  if (typeof document === "undefined") return;

  const el = document.createElement("div");
  el.setAttribute("aria-live", priority);
  el.setAttribute("aria-atomic", "true");
  el.setAttribute("role", priority === "assertive" ? "alert" : "status");
  el.className = "sr-only";
  el.style.cssText = "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0;";
  document.body.appendChild(el);

  // Delay to ensure screen readers pick up the change
  requestAnimationFrame(() => {
    el.textContent = message;
  });

  setTimeout(() => {
    document.body.removeChild(el);
  }, 5000);
}

/**
 * Check if the user prefers reduced motion.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Check if the user prefers high contrast.
 */
export function prefersHighContrast(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(forced-colors: active)").matches ||
    window.matchMedia("(prefers-contrast: more)").matches;
}

/**
 * Trap focus within a container element.
 * Returns a cleanup function to restore focus.
 */
export function trapFocus(container: HTMLElement): () => void {
  const previousFocus = document.activeElement as HTMLElement | null;
  const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const focusableElements = container.querySelectorAll<HTMLElement>(focusableSelector);
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  if (firstFocusable) firstFocusable.focus();

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    }
  };

  container.addEventListener("keydown", handleKeyDown);

  return () => {
    container.removeEventListener("keydown", handleKeyDown);
    previousFocus?.focus();
  };
}

/**
 * Generate a unique ID for ARIA relationships.
 */
let idCounter = 0;
export function generateAriaId(prefix: string = "aria"): string {
  return `${prefix}-${++idCounter}`;
}

/**
 * WCAG 2.1 AAA contrast ratio checker.
 * AAA requires 7:1 for normal text, 4.5:1 for large text.
 */
export function checkContrastRatio(
  foreground: [number, number, number],
  background: [number, number, number],
): { ratio: number; passesAAA: boolean; passesAAALarge: boolean } {
  const luminance = (rgb: [number, number, number]) => {
    const [r, g, b] = rgb.map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const l1 = luminance(foreground);
  const l2 = luminance(background);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

  return {
    ratio: Math.round(ratio * 100) / 100,
    passesAAA: ratio >= 7,
    passesAAALarge: ratio >= 4.5,
  };
}
