/**
 * Resource Manager Types
 * Local resource intelligent management system
 */

/** Resource file type */
export type ResourceType = 'video' | 'audio' | 'image' | 'proxy' | 'cache' | 'temp' | 'project';

/** Resource status */
export type ResourceStatus = 'active' | 'unused' | 'duplicate' | 'corrupted' | 'proxy-ready';

/** Proxy generation status */
export type ProxyStatus = 'pending' | 'generating' | 'ready' | 'failed';

/** Cache category */
export type CacheCategory = 'preview' | 'render' | 'ai-analysis' | 'thumbnail' | 'waveform' | 'other';

/** Resource file metadata */
export interface ResourceFile {
  id: string;
  path: string;
  name: string;
  type: ResourceType;
  size: number;
  hash: string;
  createdAt: number;
  modifiedAt: number;
  lastAccessedAt: number;
  status: ResourceStatus;
  metadata?: Record<string, unknown>;
}

/** Proxy file info */
export interface ProxyFile {
  id: string;
  originalId: string;
  originalPath: string;
  proxyPath: string;
  width: number;
  height: number;
  bitrate: number;
  size: number;
  status: ProxyStatus;
  progress: number;
  createdAt: number;
}

/** Duplicate group */
export interface DuplicateGroup {
  id: string;
  hash: string;
  similarity: number;
  files: ResourceFile[];
  totalSize: number;
  recommendedKeep: string;
}

/** Cache entry */
export interface CacheEntry {
  id: string;
  category: CacheCategory;
  path: string;
  size: number;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  isExpired: boolean;
}

/** Resource usage statistics */
export interface ResourceStats {
  totalFiles: number;
  totalSize: number;
  byType: Record<ResourceType, { count: number; size: number }>;
  byStatus: Record<ResourceStatus, { count: number; size: number }>;
  proxyCount: number;
  proxySize: number;
  cacheSize: number;
  duplicateCount: number;
  duplicateSize: number;
  unusedCount: number;
  unusedSize: number;
}

/** Cleanup recommendation */
export interface CleanupRecommendation {
  id: string;
  type: 'cache-expired' | 'unused-file' | 'duplicate-file' | 'old-version' | 'temp-file';
  files: string[];
  totalSize: number;
  description: string;
  risk: 'low' | 'medium' | 'high';
  autoCleanable: boolean;
}

/** Resource optimization report */
export interface ResourceReport {
  timestamp: number;
  stats: ResourceStats;
  recommendations: CleanupRecommendation[];
  proxyStats: {
    total: number;
    ready: number;
    generating: number;
    failed: number;
    savedSpace: number;
  };
}

/** Resource manager configuration */
export interface ResourceConfig {
  /** Proxy generation settings */
  proxy: {
    enabled: boolean;
    width: number;
    height: number;
    bitrate: number;
    codec: string;
    autoGenerate: boolean;
    generateThreshold: number; // Min file size to auto-generate proxy
  };
  /** Cache management settings */
  cache: {
    maxSize: number; // Max cache size in bytes
    maxAge: number; // Max age in milliseconds
    autoCleanup: boolean;
    cleanupThreshold: number; // Cleanup when cache exceeds this size
  };
  /** Duplicate detection settings */
  duplicates: {
    enabled: boolean;
    hashAlgorithm: 'md5' | 'sha256';
    similarityThreshold: number; // 0-1 for visual similarity
    autoRemove: boolean;
  };
  /** Unused file detection */
  unused: {
    enabled: boolean;
    olderThan: number; // Days since last access
    excludePatterns: string[];
  };
  /** Performance settings */
  performance: {
    maxConcurrentOps: number;
    backgroundProcessing: boolean;
    throttleIO: boolean;
  };
}

/** Default resource configuration */
export const DEFAULT_RESOURCE_CONFIG: ResourceConfig = {
  proxy: {
    enabled: true,
    width: 640,
    height: 360,
    bitrate: 1000000,
    codec: 'h264',
    autoGenerate: true,
    generateThreshold: 100 * 1024 * 1024, // 100MB
  },
  cache: {
    maxSize: 5 * 1024 * 1024 * 1024, // 5GB
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    autoCleanup: true,
    cleanupThreshold: 4 * 1024 * 1024 * 1024, // 4GB
  },
  duplicates: {
    enabled: true,
    hashAlgorithm: 'sha256',
    similarityThreshold: 0.95,
    autoRemove: false,
  },
  unused: {
    enabled: true,
    olderThan: 30, // 30 days
    excludePatterns: ['*.project', '*.aep', '*.prproj'],
  },
  performance: {
    maxConcurrentOps: 2,
    backgroundProcessing: true,
    throttleIO: true,
  },
};
