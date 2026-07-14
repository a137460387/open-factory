import type { ExportTaskHistoryEntry } from './export-queue';

export type ExportCategoryTag = 'social-media' | 'client-delivery' | 'internal-preview' | 'archive-backup';

export interface ExportCategoryRule {
  tag: ExportCategoryTag;
  label: string;
  /** Preset ID patterns that trigger this category. */
  presetPatterns: string[];
  /** Export name patterns (lowercase). */
  namePatterns: string[];
}

export const EXPORT_CATEGORY_RULES: ExportCategoryRule[] = [
  {
    tag: 'social-media',
    label: '社媒发布',
    presetPatterns: ['web-1080p', 'youtube', 'tiktok', 'instagram', 'reels', 'shorts', 'bilibili', 'twitter'],
    namePatterns: ['社媒', '社交', '发布', 'youtube', 'tiktok', 'instagram', 'bilibili', 'short'],
  },
  {
    tag: 'client-delivery',
    label: '客户交付',
    presetPatterns: ['4k', 'prores', 'dnxhd', 'delivery', 'client', 'master'],
    namePatterns: ['客户', '交付', 'master', 'delivery', 'client', '最终'],
  },
  {
    tag: 'internal-preview',
    label: '内部预览',
    presetPatterns: ['preview', 'draft', 'review', 'proxy'],
    namePatterns: ['预览', '草稿', 'draft', 'preview', 'review', '内部'],
  },
  {
    tag: 'archive-backup',
    label: '存档备份',
    presetPatterns: ['archive', 'backup', 'lossless', 'prores-4444', 'png-sequence'],
    namePatterns: ['存档', '备份', 'archive', 'backup', '归档'],
  },
];

export interface ClassifiedExportEntry extends ExportTaskHistoryEntry {
  category: ExportCategoryTag;
  categoryLabel: string;
  presetId?: string;
  presetName?: string;
  projectSnapshotId?: string;
}

export interface ExportHistoryFilter {
  categories?: ExportCategoryTag[];
  dateFrom?: string;
  dateTo?: string;
  minFileSize?: number;
  maxFileSize?: number;
  statusOnly?: 'success' | 'error';
  searchText?: string;
}

export interface ExportCategoryStats {
  tag: ExportCategoryTag;
  label: string;
  count: number;
  trend: Array<{ week: string; count: number }>;
}

/** Auto-classify an export history entry based on preset ID and name. */
export function classifyExportEntry(
  entry: ExportTaskHistoryEntry,
  presetId?: string,
  presetName?: string,
  projectSnapshotId?: string,
): ClassifiedExportEntry {
  const category = inferCategory(entry, presetId, presetName);
  const rule = EXPORT_CATEGORY_RULES.find((r) => r.tag === category);
  return {
    ...entry,
    category,
    categoryLabel: rule?.label ?? '社媒发布',
    presetId,
    presetName,
    projectSnapshotId,
  };
}

function inferCategory(entry: ExportTaskHistoryEntry, presetId?: string, presetName?: string): ExportCategoryTag {
  const nameLower = (entry.name ?? '').toLowerCase();
  const presetLower = (presetId ?? '').toLowerCase();
  const presetNameLower = (presetName ?? '').toLowerCase();

  for (const rule of EXPORT_CATEGORY_RULES) {
    // Check preset patterns
    for (const pattern of rule.presetPatterns) {
      if (presetLower.includes(pattern) || presetNameLower.includes(pattern)) {
        return rule.tag;
      }
    }
    // Check name patterns
    for (const pattern of rule.namePatterns) {
      if (nameLower.includes(pattern)) {
        return rule.tag;
      }
    }
  }

  // Default to internal-preview for unknown
  return 'internal-preview';
}

/** Classify a batch of export history entries. */
export function classifyExportHistory(
  entries: ExportTaskHistoryEntry[],
  presetMap?: Map<string, { presetId: string; presetName?: string; projectSnapshotId?: string }>,
): ClassifiedExportEntry[] {
  return entries.map((entry) => {
    const meta = presetMap?.get(entry.id);
    return classifyExportEntry(entry, meta?.presetId, meta?.presetName, meta?.projectSnapshotId);
  });
}

/** Apply composite filter to classified entries. */
export function filterExportHistory(
  entries: ClassifiedExportEntry[],
  filter: ExportHistoryFilter,
): ClassifiedExportEntry[] {
  return entries.filter((entry) => {
    if (filter.categories && filter.categories.length > 0) {
      if (!filter.categories.includes(entry.category)) return false;
    }
    if (filter.dateFrom) {
      if (entry.finishedAt < filter.dateFrom) return false;
    }
    if (filter.dateTo) {
      if (entry.finishedAt > filter.dateTo) return false;
    }
    if (filter.statusOnly) {
      if (entry.status !== filter.statusOnly) return false;
    }
    if (filter.searchText) {
      const search = filter.searchText.toLowerCase();
      const name = (entry.name ?? '').toLowerCase();
      const output = (entry.outputPath ?? '').toLowerCase();
      if (!name.includes(search) && !output.includes(search)) return false;
    }
    return true;
  });
}

/** Calculate export category stats with weekly trend buckets. */
export function calculateExportCategoryStats(entries: ClassifiedExportEntry[]): ExportCategoryStats[] {
  const grouped = new Map<ExportCategoryTag, ClassifiedExportEntry[]>();
  for (const rule of EXPORT_CATEGORY_RULES) {
    grouped.set(rule.tag, []);
  }
  for (const entry of entries) {
    const arr = grouped.get(entry.category);
    if (arr) arr.push(entry);
  }

  return EXPORT_CATEGORY_RULES.map((rule) => {
    const items = grouped.get(rule.tag) ?? [];
    const trend = buildWeeklyTrend(items);
    return {
      tag: rule.tag,
      label: rule.label,
      count: items.length,
      trend,
    };
  });
}

function buildWeeklyTrend(entries: ClassifiedExportEntry[]): Array<{ week: string; count: number }> {
  const weeks = new Map<string, number>();
  for (const entry of entries) {
    const date = entry.finishedAt.slice(0, 10);
    // ISO week approximation: YYYY-Www
    const d = new Date(date);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const weekKey = weekStart.toISOString().slice(0, 10);
    weeks.set(weekKey, (weeks.get(weekKey) ?? 0) + 1);
  }
  return Array.from(weeks.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, count]) => ({ week, count }));
}

/** Find the associated preset and snapshot for a given history entry. */
export function findExportAssociation(
  entryId: string,
  presetMap: Map<string, { presetId: string; presetName?: string; projectSnapshotId?: string }>,
): { presetId?: string; presetName?: string; projectSnapshotId?: string } | undefined {
  return presetMap.get(entryId);
}

/** Manual category override: reclassify an entry. */
export function overrideEntryCategory(
  entry: ClassifiedExportEntry,
  newCategory: ExportCategoryTag,
): ClassifiedExportEntry {
  const rule = EXPORT_CATEGORY_RULES.find((r) => r.tag === newCategory);
  return {
    ...entry,
    category: newCategory,
    categoryLabel: rule?.label ?? entry.categoryLabel,
  };
}
