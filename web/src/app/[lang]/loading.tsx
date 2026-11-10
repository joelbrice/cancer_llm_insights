export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-live="polite">
      <div className="h-8 w-1/3 rounded-lg bg-surface-3" />
      <div className="h-4 w-2/3 rounded bg-surface-3" />
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 rounded-2xl bg-surface-2" />
        ))}
      </div>
    </div>
  );
}
