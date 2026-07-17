/**
 * Plugin marketplace service.
 *
 * Provides catalog management, search/filter/sort, ratings, and
 * version compatibility checking for the plugin marketplace.
 */

import type { PluginCategory, PluginPermission } from './plugin-types';

// --- Market catalog entry (extended from basic catalog) ---

/** Rating summary for a plugin. */
export interface PluginRating {
  /** Average rating (1-5). */
  average: number;
  /** Total number of ratings. */
  count: number;
}

/** A single user review. */
export interface PluginReview {
  /** Review ID. */
  id: string;
  /** Plugin ID. */
  pluginId: string;
  /** Reviewer display name. */
  author: string;
  /** Rating (1-5). */
  rating: number;
  /** Review text. */
  comment: string;
  /** ISO timestamp. */
  createdAt: string;
}

/** Extended catalog entry for the marketplace. */
export interface MarketPluginEntry {
  /** Unique plugin identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Author name or organization. */
  author: string;
  /** Semver version string. */
  version: string;
  /** Short description. */
  description: string;
  /** Plugin category. */
  category: PluginCategory;
  /** Required permissions. */
  permissions: PluginPermission[];
  /** Download URL for the plugin bundle. */
  downloadUrl: string;
  /** SHA-256 hash of the plugin bundle. */
  sha256: string;
  /** Plugin tags for discovery. */
  tags: string[];
  /** Rating summary. */
  rating: PluginRating;
  /** Total download count. */
  downloads: number;
  /** Plugin homepage or repository URL. */
  homepage?: string;
  /** Minimum Open Factory version required. */
  minAppVersion?: string;
  /** ISO timestamp when this entry was published. */
  publishedAt: string;
  /** ISO timestamp of last update. */
  updatedAt: string;
  /** Whether this is an official plugin. */
  official?: boolean;
}

/** Raw catalog JSON shape. */
export interface MarketCatalogData {
  plugins: MarketPluginEntry[];
  /** Catalog schema version. */
  schemaVersion?: string;
  /** ISO timestamp of last catalog update. */
  updatedAt?: string;
}

/** Search and filter options. */
export interface MarketSearchOptions {
  /** Free-text search query. */
  query?: string;
  /** Filter by category. */
  category?: PluginCategory | 'all';
  /** Filter by tags (any match). */
  tags?: string[];
  /** Sort field. */
  sortBy?: 'name' | 'rating' | 'downloads' | 'publishedAt' | 'updatedAt';
  /** Sort direction. */
  sortDirection?: 'asc' | 'desc';
  /** Only show official plugins. */
  officialOnly?: boolean;
  /** Minimum rating filter (1-5). */
  minRating?: number;
}

/** Result of a marketplace search. */
export interface MarketSearchResult {
  entries: MarketPluginEntry[];
  total: number;
  /** Available categories with counts. */
  categories: Array<{ category: PluginCategory; count: number }>;
  /** Available tags with counts. */
  tags: Array<{ tag: string; count: number }>;
}

/** Version compatibility check result. */
export interface CompatibilityResult {
  compatible: boolean;
  reason?: string;
}

// --- Validation ---

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;
const VALID_CATEGORIES: PluginCategory[] = ['effect', 'export', 'workflow', 'ai-model'];
const VALID_PERMISSIONS: PluginPermission[] = [
  'read-project',
  'write-project',
  'read-media',
  'export-hook',
  'menu-register',
  'timeline-mutation',
  'ai-inference',
  'network-access',
];

/**
 * Validate and normalize a raw market catalog entry.
 * Returns the normalized entry or undefined if invalid.
 */
export function normalizeMarketEntry(input: unknown): MarketPluginEntry | undefined {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const id = stringValue(record.id);
  const name = stringValue(record.name);
  const author = stringValue(record.author);
  const version = stringValue(record.version);
  const downloadUrl = stringValue(record.downloadUrl);
  const sha256 = normalizeSha256(stringValue(record.sha256));
  if (!id || !name || !author || !version || !downloadUrl || !sha256) {
    return undefined;
  }
  const category = normalizeCategory(record.category);
  if (!category) {
    return undefined;
  }
  return {
    id,
    name,
    author,
    version,
    description: stringValue(record.description),
    category,
    permissions: normalizePermissions(record.permissions),
    downloadUrl,
    sha256,
    tags: normalizeTags(record.tags),
    rating: normalizeRating(record.rating),
    downloads: normalizeDownloads(record.downloads),
    homepage: stringValue(record.homepage) || undefined,
    minAppVersion: stringValue(record.minAppVersion) || undefined,
    publishedAt: stringValue(record.publishedAt) || new Date().toISOString(),
    updatedAt: stringValue(record.updatedAt) || new Date().toISOString(),
    official: record.official === true,
  };
}

/**
 * Parse market catalog JSON into validated entries.
 */
export function parseMarketCatalogJson(contents: string): MarketPluginEntry[] {
  const parsed = JSON.parse(contents) as unknown;
  const rawEntries = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { plugins?: unknown }).plugins)
      ? (parsed as { plugins: unknown[] }).plugins
      : [];
  return rawEntries.flatMap((entry) => {
    const normalized = normalizeMarketEntry(entry);
    return normalized ? [normalized] : [];
  });
}

/**
 * Search and filter marketplace entries.
 */
export function searchMarketEntries(
  entries: MarketPluginEntry[],
  options: MarketSearchOptions = {},
): MarketSearchResult {
  let filtered = [...entries];

  // Text search
  if (options.query) {
    const query = options.query.toLowerCase();
    filtered = filtered.filter(
      (entry) =>
        entry.name.toLowerCase().includes(query) ||
        entry.description.toLowerCase().includes(query) ||
        entry.author.toLowerCase().includes(query) ||
        entry.tags.some((tag) => tag.toLowerCase().includes(query)),
    );
  }

  // Category filter
  if (options.category && options.category !== 'all') {
    filtered = filtered.filter((entry) => entry.category === options.category);
  }

  // Tag filter
  if (options.tags && options.tags.length > 0) {
    const tagSet = new Set(options.tags.map((t) => t.toLowerCase()));
    filtered = filtered.filter((entry) => entry.tags.some((tag) => tagSet.has(tag.toLowerCase())));
  }

  // Official filter
  if (options.officialOnly) {
    filtered = filtered.filter((entry) => entry.official);
  }

  // Minimum rating filter
  if (options.minRating && options.minRating > 0) {
    filtered = filtered.filter((entry) => entry.rating.average >= options.minRating!);
  }

  // Sort
  const sortBy = options.sortBy ?? 'downloads';
  const sortDir = options.sortDirection ?? 'desc';
  filtered.sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'name':
        cmp = a.name.localeCompare(b.name);
        break;
      case 'rating':
        cmp = a.rating.average - b.rating.average;
        break;
      case 'downloads':
        cmp = a.downloads - b.downloads;
        break;
      case 'publishedAt':
        cmp = a.publishedAt.localeCompare(b.publishedAt);
        break;
      case 'updatedAt':
        cmp = a.updatedAt.localeCompare(b.updatedAt);
        break;
    }
    return sortDir === 'desc' ? -cmp : cmp;
  });

  // Build facet counts
  const categoryMap = new Map<PluginCategory, number>();
  const tagMap = new Map<string, number>();
  for (const entry of entries) {
    categoryMap.set(entry.category, (categoryMap.get(entry.category) ?? 0) + 1);
    for (const tag of entry.tags) {
      tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
    }
  }

  return {
    entries: filtered,
    total: filtered.length,
    categories: Array.from(categoryMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    tags: Array.from(tagMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
  };
}

/**
 * Check if a plugin version is compatible with the given app version.
 */
export function checkVersionCompatibility(
  pluginMinVersion: string | undefined,
  appVersion: string,
): CompatibilityResult {
  if (!pluginMinVersion) {
    return { compatible: true };
  }
  const cmp = compareSemver(appVersion, pluginMinVersion);
  if (cmp < 0) {
    return {
      compatible: false,
      reason: `插件要求 Open Factory ${pluginMinVersion} 或更高版本，当前版本 ${appVersion}`,
    };
  }
  return { compatible: true };
}

/**
 * Compare two semver strings.
 * Returns 1 if left > right, -1 if left < right, 0 if equal.
 */
export function compareSemver(left: string, right: string): number {
  const leftParts = parseSemver(left);
  const rightParts = parseSemver(right);
  for (let index = 0; index < 3; index += 1) {
    const delta = leftParts[index] - rightParts[index];
    if (delta !== 0) {
      return delta > 0 ? 1 : -1;
    }
  }
  return 0;
}

/**
 * Calculate a weighted plugin score combining rating and download count.
 * Used for "hot" or "recommended" sorting.
 */
export function calculatePluginScore(entry: MarketPluginEntry): number {
  const ratingWeight = 0.6;
  const downloadWeight = 0.4;
  const normalizedRating = entry.rating.average / 5;
  // Log-scale downloads to prevent mega-popular plugins from dominating
  const normalizedDownloads = entry.downloads > 0 ? Math.log10(entry.downloads + 1) / 6 : 0;
  return normalizedRating * ratingWeight + Math.min(normalizedDownloads, 1) * downloadWeight;
}

// --- Internal helpers ---

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSha256(value: string): string | undefined {
  const hash = value.toLowerCase();
  return SHA256_HEX_PATTERN.test(hash) ? hash : undefined;
}

function normalizeCategory(value: unknown): PluginCategory | undefined {
  if (typeof value === 'string' && VALID_CATEGORIES.includes(value as PluginCategory)) {
    return value as PluginCategory;
  }
  return undefined;
}

function normalizePermissions(input: unknown): PluginPermission[] {
  const permissions = Array.isArray(input) ? input : [];
  return permissions.filter((permission): permission is PluginPermission =>
    VALID_PERMISSIONS.includes(permission as PluginPermission),
  );
}

function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return Array.from(
    new Set(
      input
        .filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
        .map((tag) => tag.trim().toLowerCase()),
    ),
  );
}

function normalizeRating(input: unknown): PluginRating {
  if (input && typeof input === 'object') {
    const record = input as Record<string, unknown>;
    const average = typeof record.average === 'number' ? Math.max(0, Math.min(5, record.average)) : 0;
    const count = typeof record.count === 'number' ? Math.max(0, Math.floor(record.count)) : 0;
    return { average, count };
  }
  return { average: 0, count: 0 };
}

function normalizeDownloads(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function parseSemver(value: string): [number, number, number] {
  const [major = '0', minor = '0', patch = '0'] = value.split(/[+-]/)[0].split('.');
  return [major, minor, patch].map((part) => {
    const parsed = Number.parseInt(part, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }) as [number, number, number];
}
