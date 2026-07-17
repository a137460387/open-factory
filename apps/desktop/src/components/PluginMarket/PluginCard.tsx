import { memo } from 'react';
import type { MarketPluginEntry } from '@open-factory/editor-core';
import type { PluginInstallState } from '../../plugins/plugin-market';

const categoryIcons: Record<string, string> = {
  effect: '🎨',
  export: '📤',
  workflow: '⚙️',
  'ai-model': '🤖',
};

const categoryLabels: Record<string, string> = {
  effect: '效果',
  export: '导出',
  workflow: '工作流',
  'ai-model': 'AI 模型',
};

function StarRating({ rating, count }: { rating: number; count: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground" title={`${rating.toFixed(1)} (${count} 条评价)`}>
      {'★'.repeat(full)}
      {half && '☆'}
      {'·'.repeat(empty)}
      <span className="ml-1">{rating.toFixed(1)}</span>
      {count > 0 && <span className="text-muted-foreground/60">({count})</span>}
    </span>
  );
}

export interface PluginCardProps {
  entry: MarketPluginEntry;
  installState?: PluginInstallState;
  onInstall?: (entry: MarketPluginEntry) => void;
  onUpdate?: (entry: MarketPluginEntry) => void;
  onShowDetail?: (entry: MarketPluginEntry) => void;
}

export const PluginCard = memo(function PluginCard({
  entry,
  installState,
  onInstall,
  onUpdate,
  onShowDetail,
}: PluginCardProps) {
  const status = installState?.status ?? 'not-installed';
  return (
    <div
      className="group flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent/30 cursor-pointer"
      onClick={() => onShowDetail?.(entry)}
      data-testid={`plugin-card-${entry.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-base" title={categoryLabels[entry.category] ?? entry.category}>
              {categoryIcons[entry.category] ?? '📦'}
            </span>
            <h3 className="truncate text-sm font-medium">{entry.name}</h3>
            {entry.official && (
              <span className="shrink-0 rounded bg-primary/10 px-1 py-0.5 text-[10px] font-medium text-primary">
                官方
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{entry.author}</p>
        </div>
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          v{entry.version}
        </span>
      </div>

      <p className="line-clamp-2 text-xs text-muted-foreground/80">{entry.description}</p>

      <div className="flex flex-wrap gap-1">
        {entry.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between pt-1">
        <StarRating rating={entry.rating.average} count={entry.rating.count} />
        <span className="text-[10px] text-muted-foreground/60">
          {entry.downloads > 1000
            ? `${(entry.downloads / 1000).toFixed(1)}k`
            : entry.downloads}{' '}
          次下载
        </span>
      </div>

      <div className="flex items-center gap-2 border-t border-border/40 pt-2">
        {status === 'not-installed' && (
          <button
            className="flex-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            onClick={(e) => {
              e.stopPropagation();
              onInstall?.(entry);
            }}
            data-testid={`plugin-install-${entry.id}`}
          >
            安装
          </button>
        )}
        {status === 'installed' && (
          <span className="flex-1 rounded-md bg-muted px-3 py-1 text-center text-xs text-muted-foreground">
            已安装
          </span>
        )}
        {status === 'update-available' && (
          <button
            className="flex-1 rounded-md bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
            onClick={(e) => {
              e.stopPropagation();
              onUpdate?.(entry);
            }}
            data-testid={`plugin-update-${entry.id}`}
          >
            更新
          </button>
        )}
      </div>
    </div>
  );
});
