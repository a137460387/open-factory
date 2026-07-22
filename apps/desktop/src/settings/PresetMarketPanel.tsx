import { Download, FilePlus, RotateCcw, Star } from 'lucide-react';
import { zhCN } from '../i18n/strings';
import type { PresetMarketCard, PresetMarketFilters, PresetMarketLoadResult } from '../export/preset-market';

function PresetMarketFilterSelect({
  label,
  value,
  options,
  testId,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
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
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function PresetMarketPanel({
  cards,
  ratings,
  filters,
  loading,
  source,
  warning,
  installingCardId,
  onFiltersChange,
  onRefresh,
  onInstall,
  onRate,
  onShare,
}: {
  cards: PresetMarketCard[];
  ratings: Record<string, number>;
  filters: PresetMarketFilters;
  loading: boolean;
  source: PresetMarketLoadResult['source'];
  warning?: string;
  installingCardId?: string;
  onFiltersChange(filters: PresetMarketFilters): void;
  onRefresh(): void;
  onInstall(card: PresetMarketCard): void;
  onRate(cardId: string, rating: number): void;
  onShare(): void;
}) {
  const t = zhCN.presetMarket;
  const updateFilter = (key: keyof PresetMarketFilters, value: string) => onFiltersChange({ ...filters, [key]: value });

  return (
    <section className="rounded-md border border-line bg-panel p-3" data-testid="preset-market-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
          <p className="text-xs text-slate-500">{t.description}</p>
          <p
            className="mt-1 text-[11px] font-medium text-slate-500"
            data-testid="preset-market-source"
            data-source={source}
          >
            {t.sourceLabels[source]}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
            type="button"
            data-testid="preset-market-share-button"
            onClick={onShare}
          >
            <FilePlus size={13} />
            {t.share}
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={loading}
            data-testid="preset-market-refresh-button"
            onClick={onRefresh}
          >
            <RotateCcw size={13} />
            {loading ? t.loading : t.refresh}
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3" data-testid="preset-market-filters">
        <PresetMarketFilterSelect
          label={t.filters.platform}
          value={filters.platform ?? 'all'}
          options={t.filters.platformOptions}
          testId="preset-market-platform-filter"
          onChange={(value) => updateFilter('platform', value)}
        />
        <PresetMarketFilterSelect
          label={t.filters.quality}
          value={filters.quality ?? 'all'}
          options={t.filters.qualityOptions}
          testId="preset-market-quality-filter"
          onChange={(value) => updateFilter('quality', value)}
        />
        <PresetMarketFilterSelect
          label={t.filters.format}
          value={filters.format ?? 'all'}
          options={t.filters.formatOptions}
          testId="preset-market-format-filter"
          onChange={(value) => updateFilter('format', value)}
        />
      </div>

      {warning ? (
        <div
          className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
          data-testid="preset-market-warning"
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

      <div className="mt-3 grid gap-2 md:grid-cols-2" data-testid="preset-market-list">
        {cards.map((card) => {
          const displayedRating = ratings[card.id] ?? card.rating;
          const installing = installingCardId === card.id;
          return (
            <div
              key={card.id}
              className="rounded-md border border-line bg-white p-3"
              data-testid="preset-market-card"
              data-preset-id={card.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">{card.name}</div>
                  <div className="truncate text-xs text-slate-500">{t.byAuthor(card.author)}</div>
                </div>
                <div
                  className="shrink-0 rounded bg-panel px-2 py-1 text-[11px] font-semibold text-slate-600"
                  data-testid="preset-market-downloads"
                >
                  {t.downloads(card.downloads)}
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-slate-500">{card.description}</p>
              <div className="mt-2 flex flex-wrap gap-1" data-testid="preset-market-tags">
                {card.tags.map((tag) => (
                  <span key={tag} className="rounded bg-panel px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div
                  className="flex items-center gap-1"
                  data-testid="preset-market-rating"
                  data-rating={displayedRating}
                >
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-line ${rating <= displayedRating ? 'bg-amber-50 text-amber-600' : 'bg-white text-slate-400'} hover:bg-panel`}
                      type="button"
                      title={t.rate(rating)}
                      aria-label={t.rate(rating)}
                      data-testid={`preset-market-rate-${rating}`}
                      onClick={() => onRate(card.id, rating)}
                    >
                      <Star size={13} fill={rating <= displayedRating ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
                <button
                  className="inline-flex items-center justify-center gap-1 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled={installing}
                  data-testid="preset-market-install-button"
                  onClick={() => onInstall(card)}
                >
                  <Download size={13} />
                  {installing ? t.installing : t.install}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
