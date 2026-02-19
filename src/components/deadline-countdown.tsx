"use client";

import { useState, useEffect } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { useLocale } from "@/lib/use-locale";

interface DeadlineCountdownProps {
  deadline: Date | string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

function calcTimeLeft(deadline: Date): TimeLeft {
  const diff = deadline.getTime() - Date.now();
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    expired: false,
  };
}

/**
 * Countdown timer showing time remaining until project deadline.
 * Defers time computation to after mount to avoid hydration mismatch
 * (Date.now() differs between server and client rendering).
 */
export function DeadlineCountdown({ deadline }: DeadlineCountdownProps) {
  const { t } = useLocale();
  const deadlineMs = new Date(deadline).getTime();
  // Start as null so server and client render the same placeholder
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  useEffect(() => {
    const target = new Date(deadlineMs);
    setTimeLeft(calcTimeLeft(target));
    const interval = setInterval(() => {
      setTimeLeft(calcTimeLeft(target));
    }, 1000);
    return () => clearInterval(interval);
  }, [deadlineMs]);

  if (timeLeft === null) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-blue-100 px-3 py-2 text-sm font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
        <Clock className="h-4 w-4" />
        <span>&hellip;</span>
      </div>
    );
  }

  if (timeLeft.expired) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-red-100 px-3 py-2 text-sm font-medium text-red-800 dark:bg-red-900 dark:text-red-200">
        <AlertTriangle className="h-4 w-4" />
        {t("deadline.closed")}
      </div>
    );
  }

  const isUrgent = timeLeft.days === 0 && timeLeft.hours < 24;

  return (
    <div
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
        isUrgent
          ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
          : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      }`}
    >
      <Clock className="h-4 w-4" />
      {timeLeft.days > 0 ? (
        <span>{t("deadline.daysLeft", { count: timeLeft.days + (timeLeft.hours > 0 || timeLeft.minutes > 0 ? 1 : 0) })}</span>
      ) : (
        <>
          <span>
            {String(timeLeft.hours).padStart(2, "0")}:
            {String(timeLeft.minutes).padStart(2, "0")}:
            {String(timeLeft.seconds).padStart(2, "0")}
          </span>
          <span className="text-xs opacity-75">{t("deadline.remaining")}</span>
        </>
      )}
    </div>
  );
}
