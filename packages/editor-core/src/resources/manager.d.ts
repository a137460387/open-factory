/**
 * Resource Manager - Local resource intelligent management system
 * Handles proxy generation, cache management, and duplicate detection
 */
import type { ResourceConfig, ResourceFile, ProxyFile, DuplicateGroup, CacheEntry, ResourceStats, ResourceReport, CleanupRecommendation, ResourceType, CacheCategory } from './types';
export { formatDurationMs } from '../utils/time';
/**
 * Generate a simple hash for file content (simplified for demo)
 * In production, use crypto.subtle.digest or a streaming hash
 */
export declare function generateFileHash(data: ArrayBuffer | Uint8Array): string;
/**
 * Calculate file similarity based on perceptual hashing
 * Returns value between 0 (different) and 1 (identical)
 */
export declare function calculatePerceptualSimilarity(hash1: string, hash2: string): number;
/**
 * Determine resource type from file extension
 */
export declare function getResourceType(filename: string): ResourceType;
/**
 * Detect duplicate files from resource list
 */
export declare function detectDuplicates(files: ResourceFile[], similarityThreshold?: number): DuplicateGroup[];
/**
 * Identify unused files based on last access time
 */
export declare function identifyUnusedFiles(files: ResourceFile[], olderThanDays?: number, excludePatterns?: string[]): ResourceFile[];
/**
 * Calculate cache statistics
 */
export declare function analyzeCache(entries: CacheEntry[]): {
    totalSize: number;
    expiredCount: number;
    expiredSize: number;
    byCategory: Record<CacheCategory, {
        count: number;
        size: number;
    }>;
    recommendations: CleanupRecommendation[];
};
/**
 * Generate proxy file specification
 */
export declare function generateProxySpec(original: ResourceFile, config: ResourceConfig['proxy']): ProxyFile | null;
/**
 * Generate resource statistics
 */
export declare function calculateResourceStats(files: ResourceFile[]): ResourceStats;
/**
 * Generate cleanup recommendations
 */
export declare function generateCleanupRecommendations(files: ResourceFile[], cacheEntries: CacheEntry[], config: ResourceConfig): CleanupRecommendation[];
/**
 * Generate complete resource report
 */
export declare function generateResourceReport(files: ResourceFile[], cacheEntries: CacheEntry[], proxies: ProxyFile[], config?: ResourceConfig): ResourceReport;
/**
 * Format bytes to human-readable size
 */
export declare function formatSize(bytes: number): string;
//# sourceMappingURL=manager.d.ts.map