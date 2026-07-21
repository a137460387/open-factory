import type { PluginRegistryEntry } from '@open-factory/plugin-market';
import { RatingStars } from './RatingStars';
import { formatNumber, categoryLabel } from '@/lib/utils';

interface PluginCardProps {
  readonly plugin: PluginRegistryEntry;
}

export function PluginCard({ plugin }: PluginCardProps) {
  const { manifest, stats, rating, verified } = plugin;

  return (
    <a
      href={`/plugins/${manifest.id}`}
      className="group relative flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-4 transition-all duration-200 hover:border-[var(--accent)]/30 hover:bg-[var(--surface-2)] hover:shadow-lg hover:shadow-[var(--accent)]/5"
    >
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--surface-3)] text-xl">
          {manifest.icon || '🔌'}
        </div>
        {verified && (
          <span className="flex items-center gap-1 rounded-full bg-[var(--success)]/10 px-2 py-0.5 text-2xs font-medium text-[var(--success)]">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.403 12.652a3 3 0 010-5.304 3 3 0 00-1.39-1.203 3 3 0 01-1.134-4.95 3 3 0 00-2.306-.47 3 3 0 01-2.084-2.084 3 3 0 00-.47-2.306 3 3 0 01-4.95-1.134 3 3 0 00-1.204-1.39 3 3 0 01-5.304 0 3 3 0 00-1.203 1.39 3 3 0 01-4.95 1.134 3 3 0 00-2.306.47 3 3 0 01-2.084 2.084 3 3 0 00-.47 2.306 3 3 0 01-1.134 4.95 3 3 0 00-1.39 1.203 3 3 0 010 5.304 3 3 0 001.39 1.203 3 3 0 011.134 4.95 3 3 0 00.47 2.306 3 3 0 012.084 2.084 3 3 0 002.306.47 3 3 0 014.95 1.134 3 3 0 001.203 1.39 3 3 0 015.304 0 3 3 0 001.203-1.39 3 3 0 014.95-1.134 3 3 0 002.306-.47 3 3 0 012.084-2.084 3 3 0 00.47-2.306 3 3 0 011.134-4.95 3 3 0 001.39-1.203zM6.72 15.34a.75.75 0 01-1.06-1.06l4.25-4.25a.75.75 0 011.06 0l2.25 2.25a.75.75 0 01-1.06 1.06L8.5 12.31l-1.78 1.03z"
                clipRule="evenodd"
              />
            </svg>
            Verified
          </span>
        )}
      </div>

      {/* Name + description */}
      <h3 className="mt-3 text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
        {manifest.name}
      </h3>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)]">
        {manifest.description}
      </p>

      {/* Rating */}
      <div className="mt-3 flex items-center gap-2">
        <RatingStars rating={rating.averageRating} size="sm" />
        <span className="text-2xs text-[var(--text-tertiary)]">
          ({rating.totalReviews})
        </span>
      </div>

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between border-t border-[var(--border)] pt-3">
        <span className="text-2xs text-[var(--text-tertiary)]">
          {manifest.author}
        </span>
        <div className="flex items-center gap-3 text-2xs text-[var(--text-tertiary)]">
          <span className="flex items-center gap-1">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {formatNumber(stats.weeklyDownloads)}/w
          </span>
          <span className="rounded bg-[var(--surface-3)] px-1.5 py-0.5 text-2xs">
            {categoryLabel(manifest.category)}
          </span>
        </div>
      </div>
    </a>
  );
}
