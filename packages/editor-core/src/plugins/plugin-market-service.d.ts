/**
 * Plugin marketplace service.
 *
 * Provides catalog management, search/filter/sort, ratings, and
 * version compatibility checking for the plugin marketplace.
 */
import type { PluginCategory, PluginPermission } from './plugin-types';
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
    categories: Array<{
        category: PluginCategory;
        count: number;
    }>;
    /** Available tags with counts. */
    tags: Array<{
        tag: string;
        count: number;
    }>;
}
/** Version compatibility check result. */
export interface CompatibilityResult {
    compatible: boolean;
    reason?: string;
}
/**
 * Validate and normalize a raw market catalog entry.
 * Returns the normalized entry or undefined if invalid.
 */
export declare function normalizeMarketEntry(input: unknown): MarketPluginEntry | undefined;
/**
 * Parse market catalog JSON into validated entries.
 */
export declare function parseMarketCatalogJson(contents: string): MarketPluginEntry[];
/**
 * Search and filter marketplace entries.
 */
export declare function searchMarketEntries(entries: MarketPluginEntry[], options?: MarketSearchOptions): MarketSearchResult;
/**
 * Check if a plugin version is compatible with the given app version.
 */
export declare function checkVersionCompatibility(pluginMinVersion: string | undefined, appVersion: string): CompatibilityResult;
/**
 * Compare two semver strings.
 * Returns 1 if left > right, -1 if left < right, 0 if equal.
 */
export declare function compareSemver(left: string, right: string): number;
/**
 * Calculate a weighted plugin score combining rating and download count.
 * Used for "hot" or "recommended" sorting.
 */
export declare function calculatePluginScore(entry: MarketPluginEntry): number;
//# sourceMappingURL=plugin-market-service.d.ts.map