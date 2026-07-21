import type { PluginRegistryEntry } from '@open-factory/plugin-market';
import { RatingStars } from './RatingStars';
import { formatNumber } from '@/lib/utils';

interface TrendingListProps {
  readonly plugins: readonly PluginRegistryEntry[];
}

export function TrendingList({ plugins }: TrendingListProps) {
  return (
    <div className="space-y-2">
      {plugins.map((plugin, index) => (
        <a
          key={plugin.manifest.id}
          href={`/plugins/${plugin.manifest.id}`}
          className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-3 transition-all hover:border-[rgba(var(--accent-rgb),0.2)] hover:bg-[var(--surface-2)]"
        >
          {/* Rank */}
          <span
            className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-xs font-bold ${
              index < 3
                ? 'bg-[rgba(var(--accent-rgb),0.15)] text-[var(--accent)]'
                : 'bg-[var(--surface-3)] text-[var(--text-tertiary)]'
            }`}
          >
            {index + 1}
          </span>

          {/* Icon */}
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--surface-3)] text-lg">
            {plugin.manifest.icon || '🔌'}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-medium">
              {plugin.manifest.name}
            </h3>
            <p className="truncate text-xs text-[var(--text-tertiary)]">
              {plugin.manifest.author}
            </p>
          </div>

          {/* Rating */}
          <div className="hidden sm:block">
            <RatingStars rating={plugin.rating.averageRating} size="sm" />
          </div>

          {/* Downloads */}
          <div className="text-right">
            <p className="text-sm font-medium text-[var(--success)]">
              +{formatNumber(plugin.stats.weeklyDownloads)}
            </p>
            <p className="text-2xs text-[var(--text-tertiary)]">this week</p>
          </div>
        </a>
      ))}
    </div>
  );
}
