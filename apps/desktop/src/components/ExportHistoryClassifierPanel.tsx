import { useState, useMemo, useCallback } from 'react';
import { History, BarChart3 } from 'lucide-react';
import {
  classifyExportHistory,
  filterExportHistory,
  calculateExportCategoryStats,
  overrideEntryCategory,
  EXPORT_CATEGORY_RULES,
  type ClassifiedExportEntry,
  type ExportCategoryTag,
  type ExportHistoryFilter,
} from '@open-factory/editor-core';
import type { ExportTaskHistoryEntry } from '@open-factory/editor-core';
import { featureStrings } from '../i18n/featureStrings';

interface ExportHistoryClassifierPanelProps {
  open: boolean;
  onClose: () => void;
  history: ExportTaskHistoryEntry[];
  presetMap?: Map<string, { presetId: string; presetName?: string; projectSnapshotId?: string }>;
}

const ALL_CATEGORIES: ExportCategoryTag[] = ['social-media', 'client-delivery', 'internal-preview', 'archive-backup'];

export function ExportHistoryClassifierPanel({ open, onClose, history, presetMap }: ExportHistoryClassifierPanelProps) {
  const t = featureStrings.exportHistory;
  const [filter, setFilter] = useState<ExportHistoryFilter>({});
  const [classifiedOverride, setClassifiedOverride] = useState<Map<string, ExportCategoryTag>>(new Map());
  const [showStats, setShowStats] = useState(false);

  const classified = useMemo(() => {
    const base = classifyExportHistory(history, presetMap);
    // Apply manual overrides
    return base.map((entry) => {
      const override = classifiedOverride.get(entry.id);
      return override ? overrideEntryCategory(entry, override) : entry;
    });
  }, [history, presetMap, classifiedOverride]);

  const filtered = useMemo(() => filterExportHistory(classified, filter), [classified, filter]);
  const stats = useMemo(() => calculateExportCategoryStats(classified), [classified]);

  const handleOverrideCategory = useCallback((entryId: string, category: ExportCategoryTag) => {
    setClassifiedOverride((prev) => new Map(prev).set(entryId, category));
  }, []);

  const categoryColor = (tag: ExportCategoryTag): string => {
    switch (tag) {
      case 'social-media':
        return '#3b82f6';
      case 'client-delivery':
        return '#10b981';
      case 'internal-preview':
        return '#f59e0b';
      case 'archive-backup':
        return '#8b5cf6';
    }
  };

  if (!open) return null;

  return (
    <div
      data-testid="export-history-classifier-panel"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-neutral-900 border border-neutral-700 rounded-lg p-4 w-[600px] max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-neutral-200 flex items-center gap-2">
            <History size={16} /> {t.title}
          </h3>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 text-xs"
            data-testid="export-history-close"
          >
            ✕
          </button>
        </div>

        {/* Filters */}
        <div data-testid="export-history-filters" className="flex flex-wrap gap-2 mb-3">
          <div className="flex gap-1">
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                data-testid={`filter-${cat}`}
                onClick={() => {
                  const current = filter.categories ?? [];
                  const next = current.includes(cat) ? current.filter((c) => c !== cat) : [...current, cat];
                  setFilter({ ...filter, categories: next.length > 0 ? next : undefined });
                }}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  (filter.categories ?? []).includes(cat)
                    ? 'border-blue-500 bg-blue-900/30 text-blue-200'
                    : 'border-neutral-700 bg-neutral-800 text-neutral-400'
                }`}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1"
                  style={{ backgroundColor: categoryColor(cat) }}
                />
                {t.categories[cat]}
              </button>
            ))}
          </div>
          <select
            data-testid="filter-status"
            value={filter.statusOnly ?? ''}
            onChange={(e) =>
              setFilter({ ...filter, statusOnly: (e.target.value || undefined) as 'success' | 'error' | undefined })
            }
            className="text-xs bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-300"
          >
            <option value="">{t.filterStatus}</option>
            <option value="success">成功</option>
            <option value="error">失败</option>
          </select>
          <input
            data-testid="filter-search"
            type="text"
            placeholder={t.searchText}
            value={filter.searchText ?? ''}
            onChange={(e) => setFilter({ ...filter, searchText: e.target.value || undefined })}
            className="text-xs bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-neutral-300 w-32"
          />
        </div>

        {/* Stats toggle */}
        <button
          data-testid="toggle-stats"
          onClick={() => setShowStats(!showStats)}
          className="text-xs text-neutral-400 hover:text-neutral-200 mb-3 flex items-center gap-1"
        >
          <BarChart3 size={12} /> {t.stats}
        </button>

        {/* Stats */}
        {showStats && (
          <div data-testid="export-history-stats" className="grid grid-cols-4 gap-2 mb-3">
            {stats.map((stat) => (
              <div key={stat.tag} className="bg-neutral-800 rounded p-2 text-center">
                <div className="text-xs text-neutral-400">{stat.label}</div>
                <div className="text-lg font-mono text-neutral-200">{stat.count}</div>
                <div className="text-xs text-neutral-500">{stat.trend.length} 周</div>
              </div>
            ))}
          </div>
        )}

        {/* Entry list */}
        <div data-testid="export-history-list" className="space-y-1">
          {filtered.map((entry) => (
            <div key={entry.id} className="flex items-center gap-2 text-xs bg-neutral-800 rounded p-2">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: categoryColor(entry.category) }}
              />
              <span className="text-neutral-300 flex-1 truncate">{entry.name}</span>
              <span className="text-neutral-500">{entry.categoryLabel}</span>
              <select
                data-testid={`override-${entry.id}`}
                value={entry.category}
                onChange={(e) => handleOverrideCategory(entry.id, e.target.value as ExportCategoryTag)}
                className="text-xs bg-neutral-700 border border-neutral-600 rounded px-1 py-0.5 text-neutral-300"
              >
                {ALL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {t.categories[cat]}
                  </option>
                ))}
              </select>
              <span className={`text-xs ${entry.status === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                {entry.status === 'success' ? '✓' : '✗'}
              </span>
            </div>
          ))}
          {filtered.length === 0 && <div className="text-center text-neutral-500 text-xs py-4">无匹配记录</div>}
        </div>
      </div>
    </div>
  );
}
