export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-4 w-24 rounded bg-[var(--surface-2)]" />
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 rounded-xl bg-[var(--surface-2)]" />
        <div className="space-y-3">
          <div className="h-6 w-48 rounded bg-[var(--surface-2)]" />
          <div className="h-4 w-32 rounded bg-[var(--surface-2)]" />
          <div className="h-4 w-64 rounded bg-[var(--surface-2)]" />
        </div>
      </div>
      <div className="h-32 rounded-xl bg-[var(--surface-2)]" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-[var(--surface-2)]" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="h-48 rounded-xl bg-[var(--surface-2)]" />
          <div className="h-64 rounded-xl bg-[var(--surface-2)]" />
        </div>
        <div className="space-y-6">
          <div className="h-48 rounded-xl bg-[var(--surface-2)]" />
          <div className="h-32 rounded-xl bg-[var(--surface-2)]" />
        </div>
      </div>
    </div>
  );
}
