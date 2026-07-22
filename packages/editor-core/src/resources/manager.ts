/**
 * Resource Manager - Local resource intelligent management system
 * Handles proxy generation, cache management, and duplicate detection
 */

import type {
  ResourceConfig,
  ResourceFile,
  ProxyFile,
  DuplicateGroup,
  CacheEntry,
  ResourceStats,
  ResourceReport,
  CleanupRecommendation,
  ResourceType,
  ResourceStatus,
  ProxyStatus,
  CacheCategory,
} from './types';

import { DEFAULT_RESOURCE_CONFIG } from './types';
import { formatDurationMs } from '../utils/time';
export { formatDurationMs } from '../utils/time';

let resourceIdCounter = 0;

function generateResourceId(): string {
  resourceIdCounter += 1;
  return `res-${Date.now()}-${resourceIdCounter}`;
}

/**
 * Generate a simple hash for file content (simplified for demo)
 * In production, use crypto.subtle.digest or a streaming hash
 */
export function generateFileHash(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let hash = 0;

  // Sample bytes for performance
  const sampleSize = Math.min(bytes.length, 1024);
  const step = Math.max(1, Math.floor(bytes.length / sampleSize));

  for (let i = 0; i < bytes.length; i += step) {
    hash = ((hash << 5) - hash + bytes[i]) | 0;
  }

  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Calculate file similarity based on perceptual hashing
 * Returns value between 0 (different) and 1 (identical)
 */
export function calculatePerceptualSimilarity(hash1: string, hash2: string): number {
  if (hash1 === hash2) return 1;

  // Convert hex to binary and compare bits
  const bin1 = parseInt(hash1, 16).toString(2).padStart(32, '0');
  const bin2 = parseInt(hash2, 16).toString(2).padStart(32, '0');

  let matches = 0;
  const len = Math.min(bin1.length, bin2.length);

  for (let i = 0; i < len; i++) {
    if (bin1[i] === bin2[i]) matches++;
  }

  return matches / len;
}

/**
 * Determine resource type from file extension
 */
export function getResourceType(filename: string): ResourceType {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'mxf', 'prores'];
  const audioExts = ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'];
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp', 'svg'];
  const projectExts = ['ofproject', 'aep', 'prproj', 'fcpxml'];

  if (videoExts.includes(ext)) return 'video';
  if (audioExts.includes(ext)) return 'audio';
  if (imageExts.includes(ext)) return 'image';
  if (projectExts.includes(ext)) return 'project';
  return 'other' as ResourceType;
}

/**
 * Check if file matches exclusion patterns
 */
function matchesExclusionPatterns(filename: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    const regex = new RegExp(
      '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
    );
    if (regex.test(filename)) return true;
  }
  return false;
}

/**
 * Detect duplicate files from resource list
 */
export function detectDuplicates(
  files: ResourceFile[],
  similarityThreshold: number = DEFAULT_RESOURCE_CONFIG.duplicates.similarityThreshold,
): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const processed = new Set<string>();

  // Group by exact hash first
  const hashGroups = new Map<string, ResourceFile[]>();
  for (const file of files) {
    const existing = hashGroups.get(file.hash) || [];
    existing.push(file);
    hashGroups.set(file.hash, existing);
  }

  // Create groups for exact duplicates
  for (const [hash, groupFiles] of hashGroups) {
    if (groupFiles.length > 1) {
      const totalSize = groupFiles.reduce((sum, f) => sum + f.size, 0);

      // Recommend keeping the most recently accessed file
      const sorted = [...groupFiles].sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);

      groups.push({
        id: generateResourceId(),
        hash,
        similarity: 1.0,
        files: sorted,
        totalSize,
        recommendedKeep: sorted[0].id,
      });

      for (const f of groupFiles) {
        processed.add(f.id);
      }
    }
  }

  // Check for similar files (perceptual similarity)
  const unprocessed = files.filter((f) => !processed.has(f.id));
  for (let i = 0; i < unprocessed.length; i++) {
    for (let j = i + 1; j < unprocessed.length; j++) {
      const similarity = calculatePerceptualSimilarity(unprocessed[i].hash, unprocessed[j].hash);
      if (similarity >= similarityThreshold) {
        const groupFiles = [unprocessed[i], unprocessed[j]];
        const totalSize = groupFiles.reduce((sum, f) => sum + f.size, 0);
        const sorted = [...groupFiles].sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);

        groups.push({
          id: generateResourceId(),
          hash: unprocessed[i].hash,
          similarity,
          files: sorted,
          totalSize,
          recommendedKeep: sorted[0].id,
        });
      }
    }
  }

  return groups;
}

/**
 * Identify unused files based on last access time
 */
export function identifyUnusedFiles(
  files: ResourceFile[],
  olderThanDays: number = DEFAULT_RESOURCE_CONFIG.unused.olderThan,
  excludePatterns: string[] = DEFAULT_RESOURCE_CONFIG.unused.excludePatterns,
): ResourceFile[] {
  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

  return files.filter((file) => {
    if (file.status !== 'active') return false;
    if (matchesExclusionPatterns(file.name, excludePatterns)) return false;
    return file.lastAccessedAt < cutoff;
  });
}

/**
 * Calculate cache statistics
 */
export function analyzeCache(entries: CacheEntry[]): {
  totalSize: number;
  expiredCount: number;
  expiredSize: number;
  byCategory: Record<CacheCategory, { count: number; size: number }>;
  recommendations: CleanupRecommendation[];
} {
  const totalSize = entries.reduce((sum, e) => sum + e.size, 0);
  const expired = entries.filter((e) => e.isExpired);
  const expiredSize = expired.reduce((sum, e) => sum + e.size, 0);

  const byCategory: Record<string, { count: number; size: number }> = {};
  for (const entry of entries) {
    const cat = entry.category;
    if (!byCategory[cat]) byCategory[cat] = { count: 0, size: 0 };
    byCategory[cat].count++;
    byCategory[cat].size += entry.size;
  }

  const recommendations: CleanupRecommendation[] = [];

  if (expired.length > 0) {
    recommendations.push({
      id: generateResourceId(),
      type: 'cache-expired',
      files: expired.map((e) => e.path),
      totalSize: expiredSize,
      description: `${expired.length} 个过期缓存文件，可释放 ${formatSize(expiredSize)}`,
      risk: 'low',
      autoCleanable: true,
    });
  }

  return {
    totalSize,
    expiredCount: expired.length,
    expiredSize,
    byCategory: byCategory as Record<CacheCategory, { count: number; size: number }>,
    recommendations,
  };
}

/**
 * Generate proxy file specification
 */
export function generateProxySpec(
  original: ResourceFile,
  config: ResourceConfig['proxy'],
): ProxyFile | null {
  if (original.type !== 'video') return null;
  if (original.size < config.generateThreshold) return null;

  const proxyPath = original.path.replace(/(\.[^.]+)$/, '_proxy.mp4');

  return {
    id: generateResourceId(),
    originalId: original.id,
    originalPath: original.path,
    proxyPath,
    width: config.width,
    height: config.height,
    bitrate: config.bitrate,
    size: estimateProxySize(original.size, config.bitrate),
    status: 'pending',
    progress: 0,
    createdAt: Date.now(),
  };
}

/**
 * Estimate proxy file size based on bitrate
 */
function estimateProxySize(originalSize: number, bitrate: number): number {
  // Rough estimation: assume original is ~20Mbps for 1080p
  const ratio = bitrate / 20000000;
  return Math.round(originalSize * ratio);
}

/**
 * Generate resource statistics
 */
export function calculateResourceStats(files: ResourceFile[]): ResourceStats {
  const byType: Record<string, { count: number; size: number }> = {};
  const byStatus: Record<string, { count: number; size: number }> = {};

  for (const file of files) {
    // By type
    if (!byType[file.type]) byType[file.type] = { count: 0, size: 0 };
    byType[file.type].count++;
    byType[file.type].size += file.size;

    // By status
    if (!byStatus[file.status]) byStatus[file.status] = { count: 0, size: 0 };
    byStatus[file.status].count++;
    byStatus[file.status].size += file.size;
  }

  const duplicates = detectDuplicates(files);
  const duplicateCount = duplicates.reduce((sum, g) => sum + g.files.length - 1, 0);
  const duplicateSize = duplicates.reduce(
    (sum, g) => sum + g.files.slice(1).reduce((s, f) => s + f.size, 0),
    0,
  );

  const unused = identifyUnusedFiles(files);

  return {
    totalFiles: files.length,
    totalSize: files.reduce((sum, f) => sum + f.size, 0),
    byType: byType as Record<ResourceType, { count: number; size: number }>,
    byStatus: byStatus as Record<ResourceStatus, { count: number; size: number }>,
    proxyCount: files.filter((f) => f.type === 'proxy').length,
    proxySize: files.filter((f) => f.type === 'proxy').reduce((s, f) => s + f.size, 0),
    cacheSize: files.filter((f) => f.type === 'cache').reduce((s, f) => s + f.size, 0),
    duplicateCount,
    duplicateSize,
    unusedCount: unused.length,
    unusedSize: unused.reduce((s, f) => s + f.size, 0),
  };
}

/**
 * Generate cleanup recommendations
 */
export function generateCleanupRecommendations(
  files: ResourceFile[],
  cacheEntries: CacheEntry[],
  config: ResourceConfig,
): CleanupRecommendation[] {
  const recommendations: CleanupRecommendation[] = [];

  // Cache cleanup
  const cacheAnalysis = analyzeCache(cacheEntries);
  recommendations.push(...cacheAnalysis.recommendations);

  // Unused files
  if (config.unused.enabled) {
    const unused = identifyUnusedFiles(
      files,
      config.unused.olderThan,
      config.unused.excludePatterns,
    );
    if (unused.length > 0) {
      recommendations.push({
        id: generateResourceId(),
        type: 'unused-file',
        files: unused.map((f) => f.path),
        totalSize: unused.reduce((s, f) => s + f.size, 0),
        description: `${unused.length} 个文件超过 ${config.unused.olderThan} 天未使用`,
        risk: 'medium',
        autoCleanable: false,
      });
    }
  }

  // Duplicates
  if (config.duplicates.enabled) {
    const duplicates = detectDuplicates(files, config.duplicates.similarityThreshold);
    for (const group of duplicates) {
      const removable = group.files.filter((f) => f.id !== group.recommendedKeep);
      recommendations.push({
        id: generateResourceId(),
        type: 'duplicate-file',
        files: removable.map((f) => f.path),
        totalSize: removable.reduce((s, f) => s + f.size, 0),
        description: `${group.files.length} 个重复文件 (${(group.similarity * 100).toFixed(0)}% 相似)`,
        risk: 'low',
        autoCleanable: config.duplicates.autoRemove,
      });
    }
  }

  // Temp files
  const tempFiles = files.filter((f) => f.type === 'temp');
  if (tempFiles.length > 0) {
    recommendations.push({
      id: generateResourceId(),
      type: 'temp-file',
      files: tempFiles.map((f) => f.path),
      totalSize: tempFiles.reduce((s, f) => s + f.size, 0),
      description: `${tempFiles.length} 个临时文件可清理`,
      risk: 'low',
      autoCleanable: true,
    });
  }

  return recommendations;
}

/**
 * Generate complete resource report
 */
export function generateResourceReport(
  files: ResourceFile[],
  cacheEntries: CacheEntry[],
  proxies: ProxyFile[],
  config: ResourceConfig = DEFAULT_RESOURCE_CONFIG,
): ResourceReport {
  const stats = calculateResourceStats(files);
  const recommendations = generateCleanupRecommendations(files, cacheEntries, config);

  const proxyStats = {
    total: proxies.length,
    ready: proxies.filter((p) => p.status === 'ready').length,
    generating: proxies.filter((p) => p.status === 'generating').length,
    failed: proxies.filter((p) => p.status === 'failed').length,
    savedSpace: proxies
      .filter((p) => p.status === 'ready')
      .reduce((s, p) => {
        const original = files.find((f) => f.id === p.originalId);
        return s + (original ? original.size - p.size : 0);
      }, 0),
  };

  return {
    timestamp: Date.now(),
    stats,
    recommendations,
    proxyStats,
  };
}

/**
 * Format bytes to human-readable size
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}
