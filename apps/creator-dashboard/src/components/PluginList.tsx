import type { Plugin } from '@open-factory/creator-dashboard';
import { formatNumber } from '@/lib/utils';

interface PluginListProps {
  plugins: Plugin[];
}

const statusColors: Record<string, string> = {
  published: 'text-success bg-success/10',
  draft: 'text-foreground-muted bg-foreground-muted/10',
  review: 'text-warning bg-warning/10',
  rejected: 'text-danger bg-danger/10',
  archived: 'text-foreground-muted bg-foreground-muted/10',
};

export function PluginList({ plugins }: PluginListProps) {
  return (
    <div className="space-y-3">
      {plugins.length === 0 ? (
        <div className="bg-surface-raised border border-border rounded-xl p-8 text-center text-foreground-muted text-sm">
          No plugins yet
        </div>
      ) : (
        plugins.map((plugin) => (
          <div
            key={plugin.id}
            className="bg-surface-raised border border-border rounded-xl p-4 flex items-center gap-4 hover:border-accent/30 transition-colors"
          >
            {/* Icon placeholder */}
            <div className="w-11 h-11 rounded-lg bg-accent/10 flex items-center justify-center text-accent font-bold text-lg flex-shrink-0">
              {plugin.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold truncate">{plugin.name}</span>
                <span className="text-[10px] text-foreground-muted">v{plugin.version}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColors[plugin.status] || ''}`}>
                  {plugin.status}
                </span>
              </div>
              <p className="text-xs text-foreground-muted mt-0.5 truncate">{plugin.description}</p>
            </div>
            <div className="flex items-center gap-5 text-xs text-foreground-muted flex-shrink-0">
              <div className="text-center">
                <div className="font-semibold text-foreground">{formatNumber(plugin.downloads)}</div>
                <div>Downloads</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-foreground">{plugin.rating > 0 ? plugin.rating.toFixed(1) : '-'}</div>
                <div>Rating</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-foreground">
                  {plugin.price > 0 ? `${plugin.price} CNY` : 'Free'}
                </div>
                <div>Price</div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
