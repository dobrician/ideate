import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function ProfileLoading() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 h-8 w-32 animate-pulse rounded bg-muted" />
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="h-6 w-24 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                  <div className="h-5 w-40 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
