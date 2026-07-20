/**
 * Resource Manager Panel
 * Data layer for the "Resource Management" UI panel.
 * Manages resource state, proxy generation, and cleanup recommendations.
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

import {
  detectDuplicates,
  identifyUnusedFiles,
  analyzeCache,
  generateResourceReport,
  calculateResourceStats,
  formatSize,
  formatDuration,
} from '../resources/manager';

// ─── Panel State ────────────────────────────────────────────────

export type ResourcePanelPhase =
  | 'idle'
  | 'scanning'
  | 'analyzing'
  | 'complete'
  | 'cleaning'
  | 'error';

export interface ResourcePanelState {
  /** Current phase */
  phase: ResourcePanelPhase;
  /** Resource configuration */
  config: ResourceConfig;
  /** Current progress (0-100) */
  progress: number;
  /** Resource files */
  files: ResourceFile[];
  /** Proxy files */
  proxies: ProxyFile[];
  /** Cache entries */
  cacheEntries: CacheEntry[];
  /** Duplicate groups */
  duplicateGroups: DuplicateGroup[];
  /** Resource statistics */
  stats?: ResourceStats;
  /** Cleanup recommendations */
  recommendations: CleanupRecommendation[];
  /** Selected recommendation */
  selectedRecommendationId?: string;
  /** Active tab */
  activeTab: 'overview' | 'proxies' | 'cache' | 'duplicates' | 'unused';
  /** Error message if phase is error */
  error?: string;
}

export function createInitialResourcePanelState(): ResourcePanelState {
  return {
    phase: 'idle',
    config: { ...DEFAULT_RESOURCE_CONFIG },
    progress: 0,
    files: [],
    proxies: [],
    cacheEntries: [],
    duplicateGroups: [],
    recommendations: [],
    activeTab: 'overview',
  };
}

// ─── Panel Actions ──────────────────────────────────────────────

export type ResourcePanelAction =
  | { type: 'START_SCAN' }
  | { type: 'UPDATE_PROGRESS'; progress: number }
  | { type: 'SCAN_COMPLETE'; report: ResourceReport; files: ResourceFile[]; proxies: ProxyFile[]; cacheEntries: CacheEntry[] }
  | { type: 'SCAN_ERROR'; error: string }
  | { type: 'UPDATE_CONFIG'; config: Partial<ResourceConfig> }
  | { type: 'SET_TAB'; tab: ResourcePanelState['activeTab'] }
  | { type: 'SELECT_RECOMMENDATION'; id: string | undefined }
  | { type: 'START_CLEANUP'; recommendationIds: string[] }
  | { type: 'CLEANUP_COMPLETE'; cleanedSize: number }
  | { type: 'GENERATE_PROXY'; fileId: string }
  | { type: 'PROXY_PROGRESS'; proxyId: string; progress: number }
  | { type: 'PROXY_COMPLETE'; proxyId: string }
  | { type: 'RESET' };

/**
 * Pure state reducer for the resource manager panel.
 * Follows immutable update patterns.
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
        progress: 0,
        error: undefined,
        files: [],
        proxies: [],
        cacheEntries: [],
        duplicateGroups: [],
        recommendations: [],
      };

    case 'UPDATE_PROGRESS':
      return { ...state, progress: action.progress };

    case 'SCAN_COMPLETE': {
      const duplicateGroups = detectDuplicates(action.files, state.config.duplicates.similarityThreshold);
      return {
        ...state,
        phase: 'complete',
        progress: 100,
        files: action.files,
        proxies: action.proxies,
        cacheEntries: action.cacheEntries,
        stats: action.report.stats,
        recommendations: action.report.recommendations,
        duplicateGroups,
      };
    }

    case 'SCAN_ERROR':
      return { ...state, phase: 'error', error: action.error, progress: 0 };

    case 'UPDATE_CONFIG':
      return { ...state, config: { ...state.config, ...action.config } };

    case 'SET_TAB':
      return { ...state, activeTab: action.tab };

    case 'SELECT_RECOMMENDATION':
      return { ...state, selectedRecommendationId: action.id };

    case 'START_CLEANUP':
      return { ...state, phase: 'cleaning' };

    case 'CLEANUP_COMPLETE':
      return { ...state, phase: 'complete' };

    case 'GENERATE_PROXY': {
      const newProxy: ProxyFile = {
        id: `proxy-${Date.now()}`,
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
      };
      return { ...state, proxies: [...state.proxies, newProxy] };
    }

    case 'PROXY_PROGRESS': {
      const proxies = state.proxies.map((p) =>
        p.id === action.proxyId ? { ...p, progress: action.progress } : p,
      );
      return { ...state, proxies };
    }

    case 'PROXY_COMPLETE': {
      const proxies = state.proxies.map((p) =>
        p.id === action.proxyId ? { ...p, status: 'ready' as const, progress: 100 } : p,
      );
      return { ...state, proxies };
    }

    case 'RESET':
      return createInitialResourcePanelState();

    default:
      return state;
  }
}

// ─── Panel Selectors ────────────────────────────────────────────

/**
 * Get resource type label for UI display
 */
export function getResourceTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    video: '视频',
    audio: '音频',
    image: '图片',
    proxy: '代理',
    cache: '缓存',
    temp: '临时',
    project: '项目',
  };
  return labels[type] || type;
}

/**
 * Get resource type color for UI display
 */
export function getResourceTypeColor(type: string): string {
  const colors: Record<string, string> = {
    video: '#2563eb',
    audio: '#7c3aed',
    image: '#059669',
    proxy: '#0891b2',
    cache: '#ca8a04',
    temp: '#6b7280',
    project: '#dc2626',
  };
  return colors[type] || '#6b7280';
}

/**
 * Get proxy status label for UI display
 */
export function getProxyStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: '等待中',
    generating: '生成中',
    ready: '就绪',
    failed: '失败',
  };
  return labels[status] || status;
}

/**
 * Get proxy status color for UI display
 */
export function getProxyStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: '#6b7280',
    generating: '#2563eb',
    ready: '#16a34a',
    failed: '#dc2626',
  };
  return colors[status] || '#6b7280';
}

/**
 * Get cleanup risk label for UI display
 */
export function getCleanupRiskLabel(risk: string): string {
  const labels: Record<string, string> = {
    low: '低风险',
    medium: '中风险',
    high: '高风险',
  };
  return labels[risk] || risk;
}

/**
 * Get cleanup risk color for UI display
 */
export function getCleanupRiskColor(risk: string): string {
  const colors: Record<string, string> = {
    low: '#16a34a',
    medium: '#ca8a04',
    high: '#dc2626',
  };
  return colors[risk] || '#6b7280';
}

/**
 * Get cleanup type label for UI display
 */
export function getCleanupTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'cache-expired': '过期缓存',
    'unused-file': '未使用文件',
    'duplicate-file': '重复文件',
    'old-version': '旧版本',
    'temp-file': '临时文件',
  };
  return labels[type] || type;
}

/**
 * Get overview statistics for display
 */
export function getResourceOverviewStats(state: ResourcePanelState): Array<{
  label: string;
  value: string | number;
  color?: string;
  icon?: string;
}> {
  if (!state.stats) return [];

  return [
    { label: '总文件数', value: state.stats.totalFiles, icon: 'files' },
    { label: '总大小', value: formatSize(state.stats.totalSize), icon: 'storage' },
    { label: '代理文件', value: state.stats.proxyCount, color: getResourceTypeColor('proxy'), icon: 'proxy' },
    { label: '缓存大小', value: formatSize(state.stats.cacheSize), color: getResourceTypeColor('cache'), icon: 'cache' },
    { label: '重复文件', value: state.stats.duplicateCount, color: '#ca8a04', icon: 'duplicate' },
    { label: '可释放空间', value: formatSize(state.stats.duplicateSize + state.stats.unusedSize), color: '#16a34a', icon: 'clean' },
  ];
}

/**
 * Get proxy statistics for display
 */
export function getProxyStats(proxies: ProxyFile[]): {
  total: number;
  ready: number;
  generating: number;
  failed: number;
  savedSpace: number;
} {
  return {
    total: proxies.length,
    ready: proxies.filter((p) => p.status === 'ready').length,
    generating: proxies.filter((p) => p.status === 'generating').length,
    failed: proxies.filter((p) => p.status === 'failed').length,
    savedSpace: proxies
      .filter((p) => p.status === 'ready')
      .reduce((s, p) => s + p.size, 0),
  };
}

/**
 * Get tab options for navigation
 */
export function getResourceTabs(): Array<{ id: ResourcePanelState['activeTab']; label: string; icon: string }> {
  return [
    { id: 'overview', label: '概览', icon: 'dashboard' },
    { id: 'proxies', label: '代理文件', icon: 'video' },
    { id: 'cache', label: '缓存管理', icon: 'database' },
    { id: 'duplicates', label: '重复检测', icon: 'copy' },
    { id: 'unused', label: '未使用文件', icon: 'archive' },
  ];
}
