/**
 * Resource Manager Panel
 * Data layer for the "Resource Management" UI panel
 * Manages resource scanning, proxy generation, and cleanup operations
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
} from '../resources/types';

import { DEFAULT_RESOURCE_CONFIG } from '../resources/types';

// ─── Panel State ────────────────────────────────────────────────

export type ResourcePanelPhase =
  | 'idle'
  | 'scanning'
  | 'analyzing'
  | 'complete'
  | 'error';

export type ResourcePanelTab =
  | 'overview'
  | 'proxies'
  | 'cache'
  | 'duplicates'
  | 'unused';

export interface ResourcePanelState {
  /** Current phase */
  phase: ResourcePanelPhase;
  /** Active tab */
  activeTab: ResourcePanelTab;
  /** Resource configuration */
  config: ResourceConfig;
  /** Scan progress (0-100) */
  scanProgress: number;
  /** Current scan step */
  currentStep: string;
  /** Scanned files */
  files: ResourceFile[];
  /** Proxy files */
  proxies: ProxyFile[];
  /** Duplicate groups */
  duplicates: DuplicateGroup[];
  /** Cache entries */
  cacheEntries: CacheEntry[];
  /** Resource statistics */
  stats?: ResourceStats;
  /** Cleanup recommendations */
  recommendations: CleanupRecommendation[];
  /** Selected recommendation */
  selectedRecommendationId?: string;
  /** Error message if phase is error */
  error?: string;
}

export function createInitialResourcePanelState(): ResourcePanelState {
  return {
    phase: 'idle',
    activeTab: 'overview',
    config: { ...DEFAULT_RESOURCE_CONFIG },
    scanProgress: 0,
    currentStep: '',
    files: [],
    proxies: [],
    duplicates: [],
    cacheEntries: [],
    recommendations: [],
  };
}

// ─── Panel Actions ──────────────────────────────────────────────

export type ResourcePanelAction =
  | { type: 'START_SCAN' }
  | { type: 'UPDATE_SCAN_PROGRESS'; progress: number; step: string }
  | { type: 'SCAN_COMPLETE'; report: ResourceReport }
  | { type: 'SCAN_ERROR'; error: string }
  | { type: 'SET_TAB'; tab: ResourcePanelTab }
  | { type: 'UPDATE_CONFIG'; config: Partial<ResourceConfig> }
  | { type: 'SELECT_RECOMMENDATION'; id: string | undefined }
  | { type: 'GENERATE_PROXY'; fileId: string }
  | { type: 'PROXY_GENERATED'; proxy: ProxyFile }
  | { type: 'CLEANUP_RECOMMENDATION'; id: string }
  | { type: 'CLEANUP_COMPLETE'; freedSpace: number }
  | { type: 'RESET' };

/**
 * Pure state reducer for the resource management panel
 */
export function resourcePanelReducer(
  state: ResourcePanelState,
  action: ResourcePanelAction,
): ResourcePanelState {
  switch (action.type) {
    case 'START_SCAN':
      return {
        ...state,
        phase: 'scanning',
        scanProgress: 0,
        currentStep: '开始扫描...',
        error: undefined,
      };

    case 'UPDATE_SCAN_PROGRESS':
      return {
        ...state,
        scanProgress: action.progress,
        currentStep: action.step,
      };

    case 'SCAN_COMPLETE':
      return {
        ...state,
        phase: 'complete',
        scanProgress: 100,
        currentStep: '扫描完成',
        files: action.report.stats ? state.files : state.files,
        stats: action.report.stats,
        recommendations: action.report.recommendations,
        proxies: action.report.proxyStats ? state.proxies : state.proxies,
      };

    case 'SCAN_ERROR':
      return {
        ...state,
        phase: 'error',
        error: action.error,
      };

    case 'SET_TAB':
      return {
        ...state,
        activeTab: action.tab,
      };

    case 'UPDATE_CONFIG':
      return {
        ...state,
        config: { ...state.config, ...action.config },
      };

    case 'SELECT_RECOMMENDATION':
      return {
        ...state,
        selectedRecommendationId: action.id,
      };

    case 'GENERATE_PROXY':
      return {
        ...state,
        proxies: [
          ...state.proxies,
          {
            id: `proxy-${action.fileId}`,
            originalId: action.fileId,
            originalPath: '',
            proxyPath: '',
            width: state.config.proxy.width,
            height: state.config.proxy.height,
            bitrate: state.config.proxy.bitrate,
            size: 0,
            status: 'generating',
            progress: 0,
            createdAt: Date.now(),
          },
        ],
      };

    case 'PROXY_GENERATED':
      return {
        ...state,
        proxies: state.proxies.map((p) =>
          p.originalId === action.proxy.originalId ? action.proxy : p,
        ),
      };

    case 'CLEANUP_RECOMMENDATION':
      return {
        ...state,
        recommendations: state.recommendations.filter((r) => r.id !== action.id),
      };

    case 'CLEANUP_COMPLETE':
      return {
        ...state,
        recommendations: state.recommendations.filter((r) => r.id !== state.selectedRecommendationId),
        selectedRecommendationId: undefined,
      };

    case 'RESET':
      return createInitialResourcePanelState();

    default:
      return state;
  }
}

// ─── Selectors ──────────────────────────────────────────────────

/**
 * Get total size that can be freed
 */
export function getTotalReclaimableSpace(state: ResourcePanelState): number {
  return state.recommendations.reduce((sum, r) => sum + r.totalSize, 0);
}

/**
 * Get proxy generation statistics
 */
export function getProxyStats(proxies: ProxyFile[]): {
  total: number;
  ready: number;
  generating: number;
  failed: number;
} {
  return {
    total: proxies.length,
    ready: proxies.filter((p) => p.status === 'ready').length,
    generating: proxies.filter((p) => p.status === 'generating').length,
    failed: proxies.filter((p) => p.status === 'failed').length,
  };
}

/**
 * Get risk color for cleanup recommendations
 */
export function getRiskColor(risk: CleanupRecommendation['risk']): string {
  switch (risk) {
    case 'low':
      return '#22c55e';
    case 'medium':
      return '#f59e0b';
    case 'high':
      return '#ef4444';
  }
}

/**
 * Get risk label in Chinese
 */
export function getRiskLabel(risk: CleanupRecommendation['risk']): string {
  switch (risk) {
    case 'low':
      return '低风险';
    case 'medium':
      return '中风险';
    case 'high':
      return '高风险';
  }
}

/**
 * Get recommendation type label in Chinese
 */
export function getRecommendationTypeLabel(type: CleanupRecommendation['type']): string {
  switch (type) {
    case 'cache-expired':
      return '过期缓存';
    case 'unused-file':
      return '未使用文件';
    case 'duplicate-file':
      return '重复文件';
    case 'old-version':
      return '历史版本';
    case 'temp-file':
      return '临时文件';
  }
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

/**
 * Format date timestamp
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
