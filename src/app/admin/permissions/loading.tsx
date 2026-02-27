export default function PermissionsLoading() {
  return (
    <div className="container mx-auto max-w-6xl p-4 space-y-6" aria-busy="true" role="status">
      <span className="sr-only">Loading permissions...</span>
      <div className="h-8 w-64 animate-pulse motion-reduce:animate-none rounded bg-muted" />
      <div className="h-4 w-96 animate-pulse motion-reduce:animate-none rounded bg-muted" />
      <div className="grid gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse motion-reduce:animate-none rounded-lg border bg-muted" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse motion-reduce:animate-none rounded-lg border bg-muted" />
        ))}
      </div>
    </div>
  );
}
