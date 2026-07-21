import type { PluginRegistryEntry } from '@open-factory/plugin-market';
import { PluginCard } from './PluginCard';

interface PluginGridProps {
  readonly plugins: readonly PluginRegistryEntry[];
  readonly columns?: 2 | 3 | 4;
}

export function PluginGrid({ plugins, columns = 3 }: PluginGridProps) {
  const gridClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  }[columns];

  return (
    <div className={`grid gap-4 ${gridClass}`}>
      {plugins.map((plugin) => (
        <PluginCard key={plugin.manifest.id} plugin={plugin} />
      ))}
    </div>
  );
}
