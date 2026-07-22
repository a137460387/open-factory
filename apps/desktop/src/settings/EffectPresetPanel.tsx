import { Download, FilePlus, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { zhCN } from '../i18n/strings';
import type { EffectPresetFilters } from '@open-factory/editor-core';
import type { EffectPresetCommunityCard, EffectPresetCommunityLoadResult } from '../effects/effect-preset-library';

function EffectPresetFilterSelect({
  label,
  value,
  options,
  testId,
  onChange,
}: {
  label: string;
  value: string;
  options: Record<string, string>;
  testId: string;
  onChange(value: string): void;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <select
        className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
        value={value}
        data-testid={testId}
        onChange={(event) => onChange(event.target.value)}
      >
        {Object.entries(options).map(([option, optionLabel]) => (
          <option key={option} value={option}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

export function EffectPresetCommunityPanel({
  cards,
  filters,
  loading,
  source,
  warning,
  installingCardId,
  canShare,
  onFiltersChange,
  onRefresh,
  onInstall,
  onShare,
}: {
  cards: EffectPresetCommunityCard[];
  filters: EffectPresetFilters;
  loading: boolean;
  source: EffectPresetCommunityLoadResult['source'];
  warning?: string;
  installingCardId?: string;
  canShare: boolean;
  onFiltersChange(filters: EffectPresetFilters): void;
  onRefresh(): void;
  onInstall(card: EffectPresetCommunityCard): void;
  onShare(): void;
}) {
  const t = zhCN.effectPresetLibrary;
  const updateFilter = (key: keyof EffectPresetFilters, value: string) => onFiltersChange({ ...filters, [key]: value });

  return (
    <section className="rounded-md border border-line bg-panel p-3" data-testid="effect-preset-community-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
          <p className="text-xs text-slate-500">{t.description}</p>
          <p
            className="mt-1 text-[11px] font-medium text-slate-500"
            data-testid="effect-preset-source"
            data-source={source}
          >
            {t.sourceLabels[source]}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={!canShare}
            data-testid="effect-preset-share-button"
            onClick={onShare}
          >
            <FilePlus size={13} />
            {t.share}
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={loading}
            data-testid="effect-preset-refresh-button"
            onClick={onRefresh}
          >
            <RotateCcw size={13} />
            {loading ? t.loading : t.refresh}
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="effect-preset-filters">
        <EffectPresetFilterSelect
          label={t.filters.style}
          value={filters.style ?? 'all'}
          options={t.filters.styleOptions}
          testId="effect-preset-style-filter"
          onChange={(value) => updateFilter('style', value)}
        />
        <EffectPresetFilterSelect
          label={t.filters.use}
          value={filters.use ?? 'all'}
          options={t.filters.useOptions}
          testId="effect-preset-use-filter"
          onChange={(value) => updateFilter('use', value)}
        />
      </div>

      {warning ? (
        <div
          className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
          data-testid="effect-preset-warning"
        >
          {warning}
        </div>
      ) : null}
      {loading ? (
        <div className="mt-3 rounded-md border border-line bg-white p-3 text-sm text-slate-600">{t.loading}</div>
      ) : null}
      {!loading && cards.length === 0 ? (
        <div className="mt-3 rounded-md border border-line bg-white p-3 text-sm text-slate-600">{t.empty}</div>
      ) : null}

      <div className="mt-3 grid gap-2 md:grid-cols-2" data-testid="effect-preset-community-list">
        {cards.map((card) => {
          const installing = installingCardId === card.id;
          return (
            <div
              key={card.id}
              className="rounded-md border border-line bg-white p-3"
              data-testid="effect-preset-community-card"
              data-preset-id={card.id}
            >
              <div className="flex items-start gap-3">
                <div className="grid h-20 w-28 shrink-0 place-items-center overflow-hidden rounded border border-line bg-panel">
                  {card.thumbnail ? (
                    <img
                      className="h-full w-full object-cover"
                      src={card.thumbnail}
                      alt=""
                      data-testid="effect-preset-community-thumbnail"
                      loading="lazy"
                    />
                  ) : (
                    <SlidersHorizontal size={18} className="text-slate-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">{card.name}</div>
                  <div className="truncate text-xs text-slate-500">{t.byAuthor(card.author)}</div>
                  {card.description ? (
                    <p className="mt-2 line-clamp-2 text-xs text-slate-500">{card.description}</p>
                  ) : null}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1" data-testid="effect-preset-community-tags">
                {card.tags.map((tag) => (
                  <span key={tag} className="rounded bg-panel px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    {(t.tagLabels as Record<string, string>)[tag] ?? tag}
                  </span>
                ))}
              </div>
              <button
                className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={installing}
                data-testid="effect-preset-install-button"
                onClick={() => onInstall(card)}
              >
                <Download size={13} />
                {installing ? t.installing : t.install}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
