export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Loading page" className="mx-auto max-w-6xl px-6 py-20">
      <div className="h-5 w-32 animate-pulse rounded bg-[var(--surface-subtle)]" />
      <div className="mt-4 h-10 w-80 max-w-full animate-pulse rounded bg-[var(--surface-subtle)]" />
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div className="h-40 animate-pulse rounded-[var(--radius-lg)] bg-[var(--surface-subtle)]" key={item} />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </main>
  );
}
