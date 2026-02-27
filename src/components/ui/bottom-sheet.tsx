"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { useLocale } from "@/lib/use-locale";
import { trapFocus, prefersReducedMotion } from "@/lib/a11y";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  snapPoints?: number[];
}

/**
 * Mobile-friendly bottom sheet dialog.
 * Supports drag-to-dismiss and snap points.
 */
export function BottomSheet({ open, onClose, title, children, snapPoints = [0.5, 0.9] }: BottomSheetProps) {
  const { t } = useLocale();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const currentSnapRef = useRef(0);
  const [currentSnap, setCurrentSnap] = useState(0);
  const startY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) setDragY(delta);
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    if (dragY > 150) {
      onClose();
    } else if (dragY > 50 && currentSnapRef.current > 0) {
      setCurrentSnap((prev) => Math.max(0, prev - 1));
    }
    setDragY(0);
  }, [dragY, onClose]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      currentSnapRef.current = 0;
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Trap focus and escape key
  useEffect(() => {
    if (!open || !sheetRef.current) return;
    const cleanup = trapFocus(sheetRef.current);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cleanup();
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const snapHeight = snapPoints[currentSnap] || 0.5;
  const height = `${snapHeight * 100}vh`;
  const reduceMotion = prefersReducedMotion();

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 ${!reduceMotion ? "transition-opacity" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title || t("mobile.bottomSheet.close")}
        className={`fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-background shadow-2xl ${!reduceMotion ? "transition-transform duration-200" : ""}`}
        style={{
          height,
          transform: `translateY(${dragY}px)`,
          maxHeight: "90vh",
        }}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center py-3 cursor-grab active:cursor-grabbing min-h-[44px] items-center"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onKeyDown={(e) => { if (e.key === "ArrowDown") onClose(); }}
          aria-label={t("mobile.bottomSheet.drag")}
          role="button"
          tabIndex={0}
        >
          <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" aria-hidden="true" />
        </div>
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between border-b px-4 pb-3">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-muted"
              aria-label={t("mobile.bottomSheet.close")}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        {/* Content */}
        <div className="overflow-y-auto px-4 py-3" style={{ maxHeight: `calc(${height} - 5rem)` }}>
          {children}
        </div>
      </div>
    </>
  );
}
