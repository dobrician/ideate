import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Loading state for auth pages
 */
export default function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" aria-busy="true" role="status">
      <span className="sr-only">Loading...</span>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="h-8 w-3/4 animate-pulse motion-reduce:animate-none rounded bg-muted" />
          <div className="h-4 w-full animate-pulse motion-reduce:animate-none rounded bg-muted" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-10 w-full animate-pulse motion-reduce:animate-none rounded bg-muted" />
          <div className="h-10 w-full animate-pulse motion-reduce:animate-none rounded bg-muted" />
        </CardContent>
      </Card>
    </div>
  );
}
