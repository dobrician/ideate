"use client";

import { Button } from "@/components/ui/button";

export default function ProfileError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold text-destructive">Something went wrong</h1>
        <p className="text-muted-foreground">
          {error.message || "Failed to load profile."}
        </p>
        <Button onClick={reset}>Try Again</Button>
      </div>
    </div>
  );
}
