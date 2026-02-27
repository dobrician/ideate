import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function WorkflowsLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-4 sm:py-8" aria-busy="true" role="status">
      <span className="sr-only">Loading workflows...</span>
      <div className="mb-5 flex items-center gap-3 sm:mb-8">
        <Skeleton className="h-8 w-16" />
        <div>
          <Skeleton className="mb-2 h-8 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      <Card>
        <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
