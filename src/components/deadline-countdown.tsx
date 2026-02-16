"use client";

import { useState, useEffect } from "react";
import { Clock, AlertTriangle } from "lucide-react";

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
 * Countdown timer showing time remaining until project deadline
 */
export function DeadlineCountdown({ deadline }: DeadlineCountdownProps) {
  const deadlineMs = new Date(deadline).getTime();
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(
    calcTimeLeft(new Date(deadlineMs))
  );

  useEffect(() => {
    const target = new Date(deadlineMs);
    const interval = setInterval(() => {
      setTimeLeft(calcTimeLeft(target));
    }, 1000);
    return () => clearInterval(interval);
  }, [deadlineMs]);

  if (timeLeft.expired) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-red-100 px-3 py-2 text-sm font-medium text-red-800 dark:bg-red-900 dark:text-red-200">
        <AlertTriangle className="h-4 w-4" />
        Voting Closed
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
      <span>
        {timeLeft.days > 0 && `${timeLeft.days}d `}
        {String(timeLeft.hours).padStart(2, "0")}:
        {String(timeLeft.minutes).padStart(2, "0")}:
        {String(timeLeft.seconds).padStart(2, "0")}
      </span>
      <span className="text-xs opacity-75">remaining</span>
    </div>
  );
}
