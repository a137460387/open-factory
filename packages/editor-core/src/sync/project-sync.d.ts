/**
 * 项目云同步模块
 *
 * 功能：
 * 1. 项目配置与调色预设的云端同步
 * 2. 媒体代理的压缩传输
 * 3. 差量同步（仅传输变更部分）
 * 4. 用户数据隐私保护（需明确授权）
 * 5. 冲突检测与合并策略
 * 6. 离线队列与断线重连
 */
/** 同步状态 */
export type SyncStatus = 'idle' | 'syncing' | 'paused' | 'error' | 'unauthorized';
/** 同步项目类型 */
export type SyncItemType = 'project-config' | 'color-preset' | 'lut-file' | 'media-proxy' | 'collaboration-state' | 'user-preferences';
/** 同步方向 */
export type SyncDirection = 'upload' | 'download' | 'bidirectional';
/** 冲突解决策略 */
export type ConflictStrategy = 'local-wins' | 'remote-wins' | 'newest-wins' | 'manual' | 'merge';
/** 同步授权配置 */
export interface SyncAuthorization {
    /** 用户是否已授权 */
    authorized: boolean;
    /** 授权令牌 */
    authToken: string;
    /** 授权时间 */
    authorizedAt: number;
    /** 授权过期时间 */
    expiresAt: number;
    /** 允许同步的项目类型 */
    allowedTypes: SyncItemType[];
    /** 端到端加密密钥 (可选) */
    encryptionKey?: string;
}
/** 同步配置 */
export interface SyncConfig {
    /** 同步服务器 URL */
    serverUrl: string;
    /** 同步方向 */
    direction: SyncDirection;
    /** 冲突解决策略 */
    conflictStrategy: ConflictStrategy;
    /** 是否启用压缩 */
    enableCompression: boolean;
    /** 压缩级别 (1-9) */
    compressionLevel: number;
    /** 是否启用端到端加密 */
    enableEncryption: boolean;
    /** 自动同步间隔 (ms, 0 = 手动) */
    autoSyncIntervalMs: number;
    /** 最大重试次数 */
    maxRetries: number;
    /** 重试延迟 (ms) */
    retryDelayMs: number;
    /** 最大并发传输数 */
    maxConcurrentTransfers: number;
    /** 代理媒体最大尺寸 (bytes) */
    maxProxySizeBytes: number;
}
/** 同步项元数据 */
export interface SyncItemMeta {
    id: string;
    type: SyncItemType;
    projectId: string;
    version: number;
    hash: string;
    sizeBytes: number;
    createdAt: number;
    updatedAt: number;
    deletedAt: number | null;
    compressed: boolean;
    encrypted: boolean;
}
/** 同步项 */
export interface SyncItem {
    meta: SyncItemMeta;
    data: Uint8Array;
}
/** 同步差异 */
export interface SyncDiff {
    toUpload: SyncItemMeta[];
    toDownload: SyncItemMeta[];
    conflicts: SyncConflict[];
    deleted: SyncItemMeta[];
}
/** 同步冲突 */
export interface SyncConflict {
    itemId: string;
    type: SyncItemType;
    localMeta: SyncItemMeta;
    remoteMeta: SyncItemMeta;
    resolution: 'pending' | 'resolved';
    resolvedWith: 'local' | 'remote' | 'merged' | null;
}
/** 同步任务 */
export interface SyncTask {
    id: string;
    itemMeta: SyncItemMeta;
    direction: 'upload' | 'download';
    status: 'queued' | 'in-progress' | 'completed' | 'failed' | 'cancelled';
    progress: number;
    startedAt: number | null;
    completedAt: number | null;
    error: string | null;
    retries: number;
}
/** 同步会话结果 */
export interface SyncSessionResult {
    sessionId: string;
    startedAt: number;
    completedAt: number;
    uploaded: number;
    downloaded: number;
    conflicts: number;
    errors: number;
    bytesTransferred: number;
}
/** 同步状态回调 */
export type SyncStatusCallback = (status: SyncStatus, detail?: string) => void;
/** 同步进度回调 */
export type SyncProgressCallback = (task: SyncTask) => void;
/** 同步事件 */
export type SyncEvent = {
    type: 'status';
    status: SyncStatus;
    detail?: string;
} | {
    type: 'progress';
    task: SyncTask;
} | {
    type: 'conflict';
    conflict: SyncConflict;
} | {
    type: 'completed';
    result: SyncSessionResult;
} | {
    type: 'error';
    error: string;
};
/** 同步事件处理器 */
export type SyncEventHandler = (event: SyncEvent) => void;
/** 隐私策略 */
export interface PrivacyPolicy {
    /** 收集哪些数据 */
    collectedData: string[];
    /** 数据用途 */
    dataPurpose: string[];
    /** 数据保留期限 (天) */
    retentionDays: number;
    /** 是否与第三方共享 */
    sharedWithThirdParty: boolean;
    /** 用户可否删除云端数据 */
    canDeleteRemoteData: boolean;
    /** 最后更新日期 */
    lastUpdated: string;
}
/** 简单哈希 (FNV-1a) */
export declare function computeDataHash(data: Uint8Array): string;
/** 简单字符串哈希 */
export declare function computeStringHash(str: string): string;
/** 创建默认同步配置 */
export declare function createDefaultSyncConfig(partial?: Partial<SyncConfig>): SyncConfig;
/** 创建默认隐私策略 */
export declare function createDefaultPrivacyPolicy(): PrivacyPolicy;
/** 创建授权对象（未授权状态） */
export declare function createUnauthorizedState(): SyncAuthorization;
/** 创建已授权对象 */
export declare function createAuthorizedState(authToken: string, allowedTypes: SyncItemType[], durationMs?: number, encryptionKey?: string): SyncAuthorization;
/** 创建同步项元数据 */
export declare function createSyncItemMeta(type: SyncItemType, projectId: string, data: Uint8Array, version?: number): SyncItemMeta;
/** 验证授权是否有效 */
export declare function isAuthorizationValid(auth: SyncAuthorization): boolean;
/** 验证授权是否允许同步指定类型 */
export declare function isTypeAllowed(auth: SyncAuthorization, type: SyncItemType): boolean;
/** 验证同步配置 */
export declare function validateSyncConfig(config: SyncConfig): SyncConfig;
/** 简单 RLE 压缩 (轻量级，不依赖外部库) */
export declare function compressData(data: Uint8Array): Uint8Array;
/** RLE 解压 */
export declare function decompressData(data: Uint8Array): Uint8Array;
/** 估算压缩率 */
export declare function estimateCompressionRatio(originalSize: number, compressedSize: number): number;
/** 计算本地与远程元数据的差异 */
export declare function computeSyncDiff(localMetas: SyncItemMeta[], remoteMetas: SyncItemMeta[], conflictStrategy: ConflictStrategy): SyncDiff;
/** 离线同步队列条目 */
export interface OfflineQueueEntry {
    id: string;
    itemMeta: SyncItemMeta;
    data: Uint8Array;
    direction: 'upload' | 'download';
    enqueuedAt: number;
    retries: number;
}
/** 离线同步队列 */
export declare class OfflineSyncQueue {
    private queue;
    private maxSize;
    constructor(maxSize?: number);
    /** 入队 */
    enqueue(itemMeta: SyncItemMeta, data: Uint8Array, direction: 'upload' | 'download'): void;
    /** 出队 */
    dequeue(): OfflineQueueEntry | null;
    /** 查看队首 */
    peek(): OfflineQueueEntry | null;
    /** 队列大小 */
    size(): number;
    /** 是否为空 */
    isEmpty(): boolean;
    /** 标记重试 */
    markRetry(entryId: string): boolean;
    /** 移除条目 */
    remove(entryId: string): boolean;
    /** 清空队列 */
    clear(): void;
    /** 序列化队列 */
    serialize(): string;
    /** 反序列化队列 */
    deserialize(json: string): boolean;
}
/**
 * 项目云同步管理器
 *
 * 管理项目的云端同步，支持差量同步、压缩传输、离线队列和隐私授权。
 * 遵循本地优先原则：所有数据默认存储在本地，云同步需用户明确授权。
 */
export declare class ProjectSyncManager {
    private config;
    private authorization;
    private status;
    private tasks;
    private eventHandlers;
    private offlineQueue;
    private autoSyncTimer;
    private localMetas;
    private sessionResults;
    constructor(config?: Partial<SyncConfig>);
    /** 请求用户授权 */
    requestAuthorization(authToken: string, allowedTypes: SyncItemType[], durationMs?: number, encryptionKey?: string): boolean;
    /** 撤销授权 */
    revokeAuthorization(): void;
    /** 获取授权状态 */
    getAuthorization(): SyncAuthorization;
    /** 获取隐私策略说明 */
    getPrivacyPolicy(): PrivacyPolicy;
    /** 获取配置 */
    getConfig(): SyncConfig;
    /** 更新配置 */
    updateConfig(patch: Partial<SyncConfig>): void;
    /** 获取同步状态 */
    getStatus(): SyncStatus;
    /** 获取所有任务 */
    getTasks(): SyncTask[];
    /** 获取历史结果 */
    getSessionResults(): SyncSessionResult[];
    /** 注册事件处理器 */
    onEvent(handler: SyncEventHandler): () => void;
    /** 注册本地元数据 */
    registerLocalItem(meta: SyncItemMeta): void;
    /** 计算同步差异 */
    computeDiff(remoteMetas: SyncItemMeta[]): SyncDiff;
    /** 准备上传数据（含压缩） */
    prepareUpload(item: SyncItem): {
        data: Uint8Array;
        meta: SyncItemMeta;
    };
    /** 处理下载数据（含解压） */
    processDownload(item: SyncItem): {
        data: Uint8Array;
        meta: SyncItemMeta;
    };
    /** 加入离线队列 */
    enqueueOffline(meta: SyncItemMeta, data: Uint8Array, direction: 'upload' | 'download'): void;
    /** 获取离线队列大小 */
    getOfflineQueueSize(): number;
    /** 开始自动同步 */
    startAutoSync(): void;
    /** 停止自动同步 */
    stopAutoSync(): void;
    /** 处理离线队列 */
    processOfflineQueue(): void;
    /** 标记任务完成 */
    completeTask(taskId: string): void;
    /** 标记任务失败 */
    failTask(taskId: string, error: string): void;
    /** 完成同步会话 */
    completeSession(result: SyncSessionResult): void;
    /** 销毁 */
    dispose(): void;
    private setStatus;
    private emit;
}
//# sourceMappingURL=project-sync.d.ts.map