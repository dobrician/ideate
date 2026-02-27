/**
 * Loading state for projects pages
 */
export default function ProjectsLoading() {
  return (
    <div className="mx-auto max-w-6xl py-4 sm:py-8" aria-busy="true" role="status">
      <span className="sr-only">Loading projects...</span>
      <div className="mb-4 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 animate-pulse motion-reduce:animate-none rounded bg-muted" />
          <div className="h-4 w-64 animate-pulse motion-reduce:animate-none rounded bg-muted" />
        </div>
        <div className="h-10 w-32 animate-pulse motion-reduce:animate-none rounded bg-muted" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="space-y-4 rounded-lg border p-4 sm:p-6">
            <div className="h-6 w-3/4 animate-pulse motion-reduce:animate-none rounded bg-muted" />
            <div className="h-4 w-full animate-pulse motion-reduce:animate-none rounded bg-muted" />
            <div className="h-4 w-full animate-pulse motion-reduce:animate-none rounded bg-muted" />
            <div className="h-4 w-2/3 animate-pulse motion-reduce:animate-none rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
