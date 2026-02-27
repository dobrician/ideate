/**
 * Touch gesture detection utilities for mobile interactions.
 * Provides swipe detection with configurable thresholds.
 */

export type SwipeDirection = "left" | "right" | "up" | "down";

export interface SwipeEvent {
  direction: SwipeDirection;
  distance: number;
  velocity: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface SwipeConfig {
  threshold: number; // minimum distance in px
  velocityThreshold: number; // minimum velocity in px/ms
  allowedDirections: SwipeDirection[];
}

const DEFAULT_CONFIG: SwipeConfig = {
  threshold: 50,
  velocityThreshold: 0.3,
  allowedDirections: ["left", "right", "up", "down"],
};

/**
 * Detect swipe direction from touch coordinates.
 */
export function detectSwipe(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  duration: number,
  config: Partial<SwipeConfig> = {},
): SwipeEvent | null {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const dx = endX - startX;
  const dy = endY - startY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const distance = Math.sqrt(dx * dx + dy * dy);
  const velocity = distance / Math.max(duration, 1);

  if (distance < cfg.threshold || velocity < cfg.velocityThreshold) {
    return null;
  }

  let direction: SwipeDirection;
  if (absDx > absDy) {
    direction = dx > 0 ? "right" : "left";
  } else {
    direction = dy > 0 ? "down" : "up";
  }

  if (!cfg.allowedDirections.includes(direction)) {
    return null;
  }

  return { direction, distance, velocity, startX, startY, endX, endY };
}

/**
 * Validate touch target size meets WCAG 2.1 AAA requirements.
 * Returns true if the element meets the 44x44px minimum.
 */
export function validateTouchTarget(element: HTMLElement): { valid: boolean; width: number; height: number } {
  const rect = element.getBoundingClientRect();
  return {
    valid: rect.width >= 44 && rect.height >= 44,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Calculate if a point is within an element's hitbox
 * with minimum 44px padding for accessibility.
 */
export function isWithinTouchTarget(
  x: number,
  y: number,
  rect: DOMRect,
  minSize: number = 44,
): boolean {
  const padX = Math.max(0, (minSize - rect.width) / 2);
  const padY = Math.max(0, (minSize - rect.height) / 2);

  return (
    x >= rect.left - padX &&
    x <= rect.right + padX &&
    y >= rect.top - padY &&
    y <= rect.bottom + padY
  );
}
