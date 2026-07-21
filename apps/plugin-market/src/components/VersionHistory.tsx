import { formatDate } from '@/lib/utils';

interface VersionEntry {
  readonly version: string;
  readonly publishedAt: string;
  readonly changelog: string;
}

interface VersionHistoryProps {
  readonly versions: readonly VersionEntry[];
}

export function VersionHistory({ versions }: VersionHistoryProps) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-5">
      <h3 className="text-sm font-semibold">Version History</h3>
      <div className="mt-3 space-y-3">
        {versions.map((v, i) => (
          <div
            key={v.version}
            className="relative border-l-2 border-[var(--border)] pl-4"
          >
            {/* Dot on timeline */}
            <div
              className={`absolute -left-[5px] top-1 h-2 w-2 rounded-full ${
                i === 0 ? 'bg-[var(--accent)]' : 'bg-[var(--text-tertiary)]'
              }`}
            />

            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-medium text-[var(--accent)]">
                v{v.version}
              </span>
              {i === 0 && (
                <span className="rounded-full bg-[var(--success)]/10 px-2 py-0.5 text-2xs font-medium text-[var(--success)]">
                  Latest
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed">
              {v.changelog}
            </p>
            <p className="mt-1 text-2xs text-[var(--text-tertiary)]">
              {formatDate(v.publishedAt)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
