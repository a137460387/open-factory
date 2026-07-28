import {GalleryHorizontal, Grid2X2, List} from 'lucide-react';
import type {ReactNode} from 'react';
import {clsx} from 'clsx';
import {zhCN} from '../../i18n/strings';
import type {MediaLibraryGridSize, MediaLibrarySortKey, MediaLibraryViewMode, MediaLibraryViewSettings} from '../../media/mediaLibraryView';

export function MediaLibraryViewToolbar({
  settings,
  onChange,
}: {
  settings: MediaLibraryViewSettings;
  onChange(patch: Partial<MediaLibraryViewSettings>): void;
}) {
  const viewModes: Array<{ mode: MediaLibraryViewMode; icon: ReactNode; label: string; testId: string }> = [
    { mode: 'grid', icon: <Grid2X2 size={14} />, label: zhCN.mediaBin.viewModes.grid, testId: 'media-view-grid' },
    { mode: 'list', icon: <List size={14} />, label: zhCN.mediaBin.viewModes.list, testId: 'media-view-list' },
    { mode: 'timeline', icon: <GalleryHorizontal size={14} />, label: zhCN.mediaBin.viewModes.timeline, testId: 'media-view-timeline' },
  ];
  return (
    <div className="space-y-2 rounded-md border border-line bg-panel p-2" data-testid="media-view-toolbar">
      <div className="grid grid-cols-3 gap-1" role="group" aria-label={zhCN.mediaBin.viewMode}>
        {viewModes.map((item) => (
          <button
            key={item.mode}
            className={clsx(
              'inline-flex items-center justify-center gap-1 rounded-md border px-1.5 py-1 text-xs font-semibold',
              settings.mode === item.mode
                ? 'border-brand bg-[var(--color-bg-elevated)] text-brand'
                : 'border-line bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]',
            )}
            type="button"
            title={item.label}
            aria-label={item.label}
            aria-pressed={settings.mode === item.mode}
            data-testid={item.testId}
            onClick={() => onChange({ mode: item.mode })}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[11px] font-medium text-[var(--color-text-secondary)]">
          {zhCN.mediaBin.sortBy}
          <select
            className="mt-1 h-8 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 text-xs text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
            value={settings.sortKey}
            data-testid="media-sort-key-select"
            onChange={(event) => onChange({ sortKey: event.target.value as MediaLibrarySortKey })}
          >
            {(['importedAt', 'name', 'duration', 'size', 'frameRate', 'codec'] as MediaLibrarySortKey[]).map((key) => (
              <option key={key} value={key}>{zhCN.mediaBin.sortKeys[key]}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-[1fr_auto] gap-1">
          <label className="block text-[11px] font-medium text-[var(--color-text-secondary)]">
            {zhCN.mediaBin.gridSize}
            <select
              className="mt-1 h-8 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 text-xs text-ink disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
              value={settings.gridSize}
              disabled={settings.mode !== 'grid'}
              data-testid="media-grid-size-select"
              onChange={(event) => onChange({ gridSize: event.target.value as MediaLibraryGridSize })}
            >
              {(['small', 'medium', 'large'] as MediaLibraryGridSize[]).map((size) => (
                <option key={size} value={size}>{zhCN.mediaBin.gridSizes[size]}</option>
              ))}
            </select>
          </label>
          <button
            className="mt-5 h-8 rounded border border-line bg-[var(--color-bg-elevated)] px-2 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
            type="button"
            data-testid="media-sort-direction-button"
            onClick={() => onChange({ sortDirection: settings.sortDirection === 'asc' ? 'desc' : 'asc' })}
          >
            {settings.sortDirection === 'asc' ? zhCN.mediaBin.sortAscending : zhCN.mediaBin.sortDescending}
          </button>
        </div>
      </div>
    </div>
  );
}
