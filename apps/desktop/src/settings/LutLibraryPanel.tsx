import { useEffect } from 'react';
import { Star } from 'lucide-react';
import { zhCN } from '../i18n/strings';
import type { Clip, Project } from '@open-factory/editor-core';
import { useLutLibrary } from './hooks/useLutLibrary';

interface LutLibraryPanelProps {
  selectedClip: Clip | undefined;
  project: Project;
}

export function LutLibraryPanel({ selectedClip, project }: LutLibraryPanelProps) {
  const t = zhCN.settings;
  const { items, loading, error, selectedClipCanUseLut, refresh, preview, apply, toggleFavorite } = useLutLibrary(
    selectedClip,
    project,
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{t.lutLibrary.title}</h3>
          <p className="text-xs text-slate-500">
            {selectedClipCanUseLut
              ? t.lutLibrary.readyForClip(selectedClip?.name ?? '')
              : t.lutLibrary.noClipSelectedMessage}
          </p>
        </div>
        <button
          className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
          type="button"
          onClick={() => void refresh()}
          data-testid="lut-library-refresh-button"
        >
          {t.lutLibrary.refresh}
        </button>
      </div>
      {loading ? (
        <div className="rounded-md border border-line bg-panel p-3 text-sm text-slate-600">{t.lutLibrary.loading}</div>
      ) : null}
      {error ? (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</div>
      ) : null}
      {!loading && items.length === 0 ? (
        <div className="rounded-md border border-line bg-panel p-3 text-sm text-slate-600">{t.lutLibrary.empty}</div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.path}
            className="rounded-md border border-line bg-white p-3 shadow-sm"
            data-testid="lut-library-item"
          >
            <div className="flex items-start gap-3">
              <div className="h-[54px] w-24 shrink-0 overflow-hidden rounded bg-slate-100">
                {item.previewDataUrl ? (
                  <img className="h-full w-full object-cover" src={item.previewDataUrl} alt="" loading="lazy" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink" title={item.path}>
                  {item.name}
                </div>
                <div className="truncate text-xs text-slate-500" title={item.path}>
                  {item.path}
                </div>
              </div>
              <button
                className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line ${item.favorite ? 'bg-amber-50 text-amber-600' : 'bg-white text-slate-500'} hover:bg-panel`}
                type="button"
                title={item.favorite ? t.lutLibrary.unfavorite : t.lutLibrary.favorite}
                aria-label={item.favorite ? t.lutLibrary.unfavorite : t.lutLibrary.favorite}
                data-testid="lut-library-favorite-button"
                onClick={() => void toggleFavorite(item)}
              >
                <Star size={15} fill={item.favorite ? 'currentColor' : 'none'} />
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                className="flex-1 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={!selectedClipCanUseLut}
                data-testid="lut-library-preview-button"
                onClick={() => preview(item)}
              >
                {t.lutLibrary.preview}
              </button>
              <button
                className="flex-1 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={!selectedClipCanUseLut}
                data-testid="lut-library-apply-button"
                onClick={() => apply(item)}
              >
                {t.lutLibrary.apply}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
