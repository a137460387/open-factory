// Plugin Search Engine
// Multi-dimensional search with scoring, filtering, and pagination.

import type {
  PluginRegistryEntry,
  PluginSearchQuery,
  PluginSearchResult,
  PluginSearchResponse,
  PluginCategory,
  PluginSortField,
} from './types.js';

/** Search index entry with pre-computed text for fast matching. */
interface SearchIndexEntry {
  readonly entry: PluginRegistryEntry;
  readonly searchText: string;
  readonly tags: readonly string[];
}

/**
 * Plugin search engine with keyword matching, category filtering,
 * tag-based search, rating thresholds, and multi-field scoring.
 */
export class PluginSearchEngine {
  private readonly index: SearchIndexEntry[] = [];

  /** Rebuild the search index from a list of registry entries. */
  reindex(entries: readonly PluginRegistryEntry[]): void {
    this.index.length = 0;
    for (const entry of entries) {
      this.index.push(buildIndexEntry(entry));
    }
  }

  /** Add a single entry to the index. */
  addEntry(entry: PluginRegistryEntry): void {
    this.index.push(buildIndexEntry(entry));
  }

  /** Remove an entry from the index by plugin ID. */
  removeEntry(pluginId: string): void {
    const idx = this.index.findIndex((e) => e.entry.manifest.id === pluginId);
    if (idx >= 0) this.index.splice(idx, 1);
  }

  /** Execute a search query. */
  search(query: PluginSearchQuery): PluginSearchResponse {
    const { keyword, category, tags, minRating, sortBy, sortOrder, page, limit } = normalizeQuery(query);

    // Phase 1: Filter
    let candidates = this.index.filter((entry) => {
      if (category && entry.entry.manifest.category !== category) return false;
      if (tags && tags.length > 0) {
        const hasTag = tags.some((t) => entry.tags.includes(t.toLowerCase()));
        if (!hasTag) return false;
      }
      if (minRating && entry.entry.rating.averageRating < minRating) return false;
      if (entry.entry.deprecated) return false;
      return true;
    });

    // Phase 2: Score and match
    const scored: PluginSearchResult[] = [];
    for (const entry of candidates) {
      const result = scoreEntry(entry, keyword ?? '');
      if (result.score > 0 || !keyword) {
        scored.push(result);
      }
    }

    // Phase 3: Sort
    const sorted = sortResults(scored, sortBy ?? 'relevance', sortOrder ?? 'desc');

    // Phase 4: Paginate
    const total = sorted.length;
    const offset = (page - 1) * limit;
    const paged = sorted.slice(offset, offset + limit);

    return {
      results: paged,
      total,
      page,
      limit,
      hasMore: offset + limit < total,
    };
  }

  /** Get the number of indexed entries. */
  get size(): number {
    return this.index.length;
  }
}

function buildIndexEntry(entry: PluginRegistryEntry): SearchIndexEntry {
  const m = entry.manifest;
  const textParts = [
    m.name,
    m.description,
    m.author,
    m.category,
    ...m.keywords,
    ...(m.cliCommands?.map((c) => c.name) ?? []),
    ...(m.workflowNodes?.map((n) => `${n.type} ${n.name} ${n.category}`) ?? []),
  ];
  return {
    entry,
    searchText: textParts.join(' ').toLowerCase(),
    tags: m.keywords.map((k) => k.toLowerCase()),
  };
}

function scoreEntry(indexEntry: SearchIndexEntry, keyword: string): PluginSearchResult {
  const matchedFields: string[] = [];
  let score = 0;
  const m = indexEntry.entry.manifest;
  const kw = keyword.toLowerCase().trim();

  if (!kw) {
    // No keyword: give base score from rating and downloads
    score = baseScore(indexEntry.entry);
    return { plugin: indexEntry.entry, score, matchedFields: [] };
  }

  // Name match (highest weight)
  if (m.name.toLowerCase().includes(kw)) {
    score += 100;
    matchedFields.push('name');
    // Exact name match bonus
    if (m.name.toLowerCase() === kw) score += 50;
  }

  // Description match
  if (m.description.toLowerCase().includes(kw)) {
    score += 40;
    matchedFields.push('description');
  }

  // Keyword/tag match
  if (indexEntry.tags.some((t) => t.includes(kw))) {
    score += 60;
    matchedFields.push('keywords');
  }

  // Author match
  if (m.author.toLowerCase().includes(kw)) {
    score += 20;
    matchedFields.push('author');
  }

  // Category match
  if (m.category.toLowerCase().includes(kw)) {
    score += 30;
    matchedFields.push('category');
  }

  // CLI command name match
  if (m.cliCommands?.some((c) => c.name.toLowerCase().includes(kw))) {
    score += 50;
    matchedFields.push('cliCommands');
  }

  // Workflow node type match
  if (m.workflowNodes?.some((n) => n.type.toLowerCase().includes(kw) || n.name.toLowerCase().includes(kw))) {
    score += 50;
    matchedFields.push('workflowNodes');
  }

  // Apply quality multiplier
  score *= qualityMultiplier(indexEntry.entry);

  return { plugin: indexEntry.entry, score: Math.round(score * 100) / 100, matchedFields };
}

function baseScore(entry: PluginRegistryEntry): number {
  const ratingScore = entry.rating.averageRating * 10;
  const downloadScore = Math.log10(Math.max(entry.stats.downloads, 1)) * 5;
  return ratingScore + downloadScore;
}

function qualityMultiplier(entry: PluginRegistryEntry): number {
  let mult = 1.0;
  if (entry.verified) mult += 0.3;
  const avg = entry.rating.averageRating;
  if (avg >= 4.0) mult += 0.2;
  if (entry.stats.downloads > 1000) mult += 0.1;
  return mult;
}

function normalizeQuery(query: PluginSearchQuery): PluginSearchQuery {
  return {
    ...query,
    page: Math.max(1, query.page),
    limit: Math.max(1, Math.min(100, query.limit)),
  };
}

function sortResults(
  results: PluginSearchResult[],
  sortBy: PluginSortField,
  order: 'asc' | 'desc',
): PluginSearchResult[] {
  const dir = order === 'asc' ? 1 : -1;

  const comparators: Record<PluginSortField, (a: PluginSearchResult, b: PluginSearchResult) => number> = {
    relevance: (a, b) => (a.score - b.score) * dir,
    downloads: (a, b) => (a.plugin.stats.downloads - b.plugin.stats.downloads) * dir,
    rating: (a, b) => (a.plugin.rating.averageRating - b.plugin.rating.averageRating) * dir,
    updated: (a, b) => (a.plugin.updatedAt.localeCompare(b.plugin.updatedAt)) * dir,
    created: (a, b) => (a.plugin.publishedAt.localeCompare(b.plugin.publishedAt)) * dir,
    name: (a, b) => a.plugin.manifest.name.localeCompare(b.plugin.manifest.name) * dir,
  };

  return [...results].sort(comparators[sortBy]);
}
