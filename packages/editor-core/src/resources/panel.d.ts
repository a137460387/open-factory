/**
 * Resource Manager Panel
 * Data layer for the "Resource Management" UI panel.
 * Manages resource state, proxy generation, and cleanup recommendations.
 */
import type { ResourceConfig, ResourceFile, ProxyFile, DuplicateGroup, CacheEntry, ResourceStats, ResourceReport, CleanupRecommendation } from '../resources/types';
export type ResourcePanelPhase = 'idle' | 'scanning' | 'analyzing' | 'complete' | 'cleaning' | 'error';
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
export declare function createInitialResourcePanelState(): ResourcePanelState;
export type ResourcePanelAction = {
    type: 'START_SCAN';
} | {
    type: 'UPDATE_PROGRESS';
    progress: number;
} | {
    type: 'SCAN_COMPLETE';
    report: ResourceReport;
    files: ResourceFile[];
    proxies: ProxyFile[];
    cacheEntries: CacheEntry[];
} | {
    type: 'SCAN_ERROR';
    error: string;
} | {
    type: 'UPDATE_CONFIG';
    config: Partial<ResourceConfig>;
} | {
    type: 'SET_TAB';
    tab: ResourcePanelState['activeTab'];
} | {
    type: 'SELECT_RECOMMENDATION';
    id: string | undefined;
} | {
    type: 'START_CLEANUP';
    recommendationIds: string[];
} | {
    type: 'CLEANUP_COMPLETE';
    cleanedSize: number;
} | {
    type: 'GENERATE_PROXY';
    fileId: string;
} | {
    type: 'PROXY_PROGRESS';
    proxyId: string;
    progress: number;
} | {
    type: 'PROXY_COMPLETE';
    proxyId: string;
} | {
    type: 'RESET';
};
/**
 * Pure state reducer for the resource manager panel.
 * Follows immutable update patterns.
 */
export declare function resourcePanelReducer(state: ResourcePanelState, action: ResourcePanelAction): ResourcePanelState;
/**
 * Get resource type label for UI display
 */
export declare function getResourceTypeLabel(type: string): string;
/**
 * Get resource type color for UI display
 */
export declare function getResourceTypeColor(type: string): string;
/**
 * Get proxy status label for UI display
 */
export declare function getProxyStatusLabel(status: string): string;
/**
 * Get proxy status color for UI display
 */
export declare function getProxyStatusColor(status: string): string;
/**
 * Get cleanup risk label for UI display
 */
export declare function getCleanupRiskLabel(risk: string): string;
/**
 * Get cleanup risk color for UI display
 */
export declare function getCleanupRiskColor(risk: string): string;
/**
 * Get cleanup type label for UI display
 */
export declare function getCleanupTypeLabel(type: string): string;
/**
 * Get overview statistics for display
 */
export declare function getResourceOverviewStats(state: ResourcePanelState): Array<{
    label: string;
    value: string | number;
    color?: string;
    icon?: string;
}>;
/**
 * Get proxy statistics for display
 */
export declare function getProxyStats(proxies: ProxyFile[]): {
    total: number;
    ready: number;
    generating: number;
    failed: number;
    savedSpace: number;
};
/**
 * Get tab options for navigation
 */
export declare function getResourceTabs(): Array<{
    id: ResourcePanelState['activeTab'];
    label: string;
    icon: string;
}>;
//# sourceMappingURL=panel.d.ts.map