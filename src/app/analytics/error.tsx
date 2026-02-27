"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <AlertTriangle className="mb-4 h-16 w-16 text-destructive" />
      <h1 className="text-2xl font-bold">Failed to load analytics</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        {error.message || "An unexpected error occurred while loading analytics data."}
      </p>
      <Button onClick={reset} className="mt-6">Try again</Button>
    </div>
  );
}
