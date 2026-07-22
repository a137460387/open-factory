import { clamp } from '../math-utils';

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

// ==================== 类型定义 ====================

/** 同步状态 */
export type SyncStatus = 'idle' | 'syncing' | 'paused' | 'error' | 'unauthorized';

/** 同步项目类型 */
export type SyncItemType =
  'project-config' | 'color-preset' | 'lut-file' | 'media-proxy' | 'collaboration-state' | 'user-preferences';

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
  progress: number; // 0-1
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
export type SyncEvent =
  | { type: 'status'; status: SyncStatus; detail?: string }
  | { type: 'progress'; task: SyncTask }
  | { type: 'conflict'; conflict: SyncConflict }
  | { type: 'completed'; result: SyncSessionResult }
  | { type: 'error'; error: string };

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

// ==================== 常量 ====================

const DEFAULT_SYNC_CONFIG: SyncConfig = {
  serverUrl: '',
  direction: 'bidirectional',
  conflictStrategy: 'newest-wins',
  enableCompression: true,
  compressionLevel: 6,
  enableEncryption: false,
  autoSyncIntervalMs: 0,
  maxRetries: 3,
  retryDelayMs: 2000,
  maxConcurrentTransfers: 3,
  maxProxySizeBytes: 50 * 1024 * 1024, // 50MB
};

const DEFAULT_PRIVACY_POLICY: PrivacyPolicy = {
  collectedData: ['项目配置（不含原始媒体文件）', '调色预设和 LUT 参数', '协作会话元数据', '用户偏好设置'],
  dataPurpose: ['跨设备同步项目设置', '团队协作调色', '备份与恢复'],
  retentionDays: 90,
  sharedWithThirdParty: false,
  canDeleteRemoteData: true,
  lastUpdated: '2026-07-18',
};

// ==================== 工具函数 ====================

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 简单哈希 (FNV-1a) */
export function computeDataHash(data: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    hash ^= data[i];
    hash = (hash * 0x01000193) | 0;
  }
  return Math.abs(hash).toString(36);
}

/** 简单字符串哈希 */
export function computeStringHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

// ==================== 默认工厂函数 ====================

/** 创建默认同步配置 */
export function createDefaultSyncConfig(partial?: Partial<SyncConfig>): SyncConfig {
  return { ...DEFAULT_SYNC_CONFIG, ...partial };
}

/** 创建默认隐私策略 */
export function createDefaultPrivacyPolicy(): PrivacyPolicy {
  return { ...DEFAULT_PRIVACY_POLICY };
}

/** 创建授权对象（未授权状态） */
export function createUnauthorizedState(): SyncAuthorization {
  return {
    authorized: false,
    authToken: '',
    authorizedAt: 0,
    expiresAt: 0,
    allowedTypes: [],
  };
}

/** 创建已授权对象 */
export function createAuthorizedState(
  authToken: string,
  allowedTypes: SyncItemType[],
  durationMs: number = 24 * 60 * 60 * 1000,
  encryptionKey?: string,
): SyncAuthorization {
  const now = Date.now();
  return {
    authorized: true,
    authToken,
    authorizedAt: now,
    expiresAt: now + durationMs,
    allowedTypes,
    encryptionKey,
  };
}

/** 创建同步项元数据 */
export function createSyncItemMeta(
  type: SyncItemType,
  projectId: string,
  data: Uint8Array,
  version: number = 1,
): SyncItemMeta {
  return {
    id: generateId('sync'),
    type,
    projectId,
    version,
    hash: computeDataHash(data),
    sizeBytes: data.length,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
    compressed: false,
    encrypted: false,
  };
}

// ==================== 验证函数 ====================

/** 验证授权是否有效 */
export function isAuthorizationValid(auth: SyncAuthorization): boolean {
  if (!auth.authorized) return false;
  if (auth.expiresAt <= Date.now()) return false;
  if (!auth.authToken) return false;
  return true;
}

/** 验证授权是否允许同步指定类型 */
export function isTypeAllowed(auth: SyncAuthorization, type: SyncItemType): boolean {
  if (!isAuthorizationValid(auth)) return false;
  return auth.allowedTypes.includes(type);
}

/** 验证同步配置 */
export function validateSyncConfig(config: SyncConfig): SyncConfig {
  return {
    serverUrl: typeof config.serverUrl === 'string' ? config.serverUrl : '',
    direction: ['upload', 'download', 'bidirectional'].includes(config.direction) ? config.direction : 'bidirectional',
    conflictStrategy: ['local-wins', 'remote-wins', 'newest-wins', 'manual', 'merge'].includes(config.conflictStrategy)
      ? config.conflictStrategy
      : 'newest-wins',
    enableCompression: !!config.enableCompression,
    compressionLevel: clamp(config.compressionLevel, 1, 9),
    enableEncryption: !!config.enableEncryption,
    autoSyncIntervalMs: Math.max(0, config.autoSyncIntervalMs),
    maxRetries: clamp(config.maxRetries, 0, 10),
    retryDelayMs: clamp(config.retryDelayMs, 500, 30000),
    maxConcurrentTransfers: clamp(config.maxConcurrentTransfers, 1, 10),
    maxProxySizeBytes: Math.max(0, config.maxProxySizeBytes),
  };
}

// ==================== 压缩 ====================

/** 简单 RLE 压缩 (轻量级，不依赖外部库) */
export function compressData(data: Uint8Array): Uint8Array {
  if (data.length === 0) return data;

  const output: number[] = [];
  let i = 0;

  while (i < data.length) {
    const val = data[i];
    let runLength = 1;

    while (i + runLength < data.length && data[i + runLength] === val && runLength < 255) {
      runLength++;
    }

    if (runLength >= 3) {
      // RLE 编码: [0xFE, runLength, value]
      output.push(0xfe, runLength, val);
      i += runLength;
    } else {
      // 字面量
      for (let j = 0; j < runLength; j++) {
        if (val === 0xfe) {
          output.push(0xfe, 1, 0xfe); // 转义
        } else {
          output.push(val);
        }
        i++;
      }
    }
  }

  return new Uint8Array(output);
}

/** RLE 解压 */
export function decompressData(data: Uint8Array): Uint8Array {
  if (data.length === 0) return data;

  const output: number[] = [];
  let i = 0;

  while (i < data.length) {
    if (data[i] === 0xfe && i + 2 < data.length) {
      const runLength = data[i + 1];
      const value = data[i + 2];
      for (let j = 0; j < runLength; j++) {
        output.push(value);
      }
      i += 3;
    } else {
      output.push(data[i]);
      i++;
    }
  }

  return new Uint8Array(output);
}

/** 估算压缩率 */
export function estimateCompressionRatio(originalSize: number, compressedSize: number): number {
  if (originalSize === 0) return 1;
  return Math.round((1 - compressedSize / originalSize) * 100) / 100;
}

// ==================== 差量同步 ====================

/** 计算本地与远程元数据的差异 */
export function computeSyncDiff(
  localMetas: SyncItemMeta[],
  remoteMetas: SyncItemMeta[],
  conflictStrategy: ConflictStrategy,
): SyncDiff {
  const localMap = new Map(localMetas.map((m) => [m.id, m]));
  const remoteMap = new Map(remoteMetas.map((m) => [m.id, m]));

  const toUpload: SyncItemMeta[] = [];
  const toDownload: SyncItemMeta[] = [];
  const conflicts: SyncConflict[] = [];
  const deleted: SyncItemMeta[] = [];

  // 检查本地有、远程没有的 → 上传
  for (const [id, local] of localMap) {
    if (!remoteMap.has(id)) {
      if (local.deletedAt) {
        deleted.push(local);
      } else {
        toUpload.push(local);
      }
    }
  }

  // 检查远程有、本地没有的 → 下载
  for (const [id, remote] of remoteMap) {
    if (!localMap.has(id)) {
      if (remote.deletedAt) {
        deleted.push(remote);
      } else {
        toDownload.push(remote);
      }
    }
  }

  // 检查两边都有的 → 比较版本
  for (const [id, local] of localMap) {
    const remote = remoteMap.get(id);
    if (!remote) continue;

    if (local.hash === remote.hash) continue; // 无变化

    // 冲突：两边都有修改
    if (local.version !== remote.version) {
      const conflict: SyncConflict = {
        itemId: id,
        type: local.type,
        localMeta: local,
        remoteMeta: remote,
        resolution: 'pending',
        resolvedWith: null,
      };

      switch (conflictStrategy) {
        case 'local-wins':
          conflict.resolution = 'resolved';
          conflict.resolvedWith = 'local';
          toUpload.push(local);
          break;
        case 'remote-wins':
          conflict.resolution = 'resolved';
          conflict.resolvedWith = 'remote';
          toDownload.push(remote);
          break;
        case 'newest-wins':
          conflict.resolution = 'resolved';
          if (local.updatedAt >= remote.updatedAt) {
            conflict.resolvedWith = 'local';
            toUpload.push(local);
          } else {
            conflict.resolvedWith = 'remote';
            toDownload.push(remote);
          }
          break;
        case 'merge':
          conflict.resolution = 'resolved';
          conflict.resolvedWith = 'merged';
          // 合并策略：取最新版本号，数据由调用者处理
          break;
        case 'manual':
        default:
          // 保持 pending，由用户决定
          break;
      }

      conflicts.push(conflict);
    }
  }

  return { toUpload, toDownload, conflicts, deleted };
}

// ==================== 离线队列 ====================

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
export class OfflineSyncQueue {
  private queue: OfflineQueueEntry[] = [];
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  /** 入队 */
  enqueue(itemMeta: SyncItemMeta, data: Uint8Array, direction: 'upload' | 'download'): void {
    if (this.queue.length >= this.maxSize) {
      this.queue.shift(); // 淘汰最旧的
    }
    this.queue.push({
      id: generateId('offline'),
      itemMeta,
      data: new Uint8Array(data),
      direction,
      enqueuedAt: Date.now(),
      retries: 0,
    });
  }

  /** 出队 */
  dequeue(): OfflineQueueEntry | null {
    return this.queue.shift() ?? null;
  }

  /** 查看队首 */
  peek(): OfflineQueueEntry | null {
    return this.queue[0] ?? null;
  }

  /** 队列大小 */
  size(): number {
    return this.queue.length;
  }

  /** 是否为空 */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /** 标记重试 */
  markRetry(entryId: string): boolean {
    const entry = this.queue.find((e) => e.id === entryId);
    if (!entry) return false;
    entry.retries++;
    return true;
  }

  /** 移除条目 */
  remove(entryId: string): boolean {
    const idx = this.queue.findIndex((e) => e.id === entryId);
    if (idx < 0) return false;
    this.queue.splice(idx, 1);
    return true;
  }

  /** 清空队列 */
  clear(): void {
    this.queue = [];
  }

  /** 序列化队列 */
  serialize(): string {
    return JSON.stringify(
      this.queue.map((e) => ({
        ...e,
        data: Array.from(e.data),
      })),
    );
  }

  /** 反序列化队列 */
  deserialize(json: string): boolean {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) return false;
      this.queue = parsed.map((e: Record<string, unknown>) => ({
        ...e,
        data: new Uint8Array(e.data as number[]),
      })) as OfflineQueueEntry[];
      return true;
    } catch {
      return false;
    }
  }
}

// ==================== 同步管理器 ====================

/**
 * 项目云同步管理器
 *
 * 管理项目的云端同步，支持差量同步、压缩传输、离线队列和隐私授权。
 * 遵循本地优先原则：所有数据默认存储在本地，云同步需用户明确授权。
 */
export class ProjectSyncManager {
  private config: SyncConfig;
  private authorization: SyncAuthorization;
  private status: SyncStatus = 'idle';
  private tasks: Map<string, SyncTask> = new Map();
  private eventHandlers: Set<SyncEventHandler> = new Set();
  private offlineQueue: OfflineSyncQueue;
  private autoSyncTimer: ReturnType<typeof setInterval> | null = null;
  private localMetas: Map<string, SyncItemMeta> = new Map();
  private sessionResults: SyncSessionResult[] = [];

  constructor(config?: Partial<SyncConfig>) {
    this.config = validateSyncConfig({ ...DEFAULT_SYNC_CONFIG, ...config });
    this.authorization = createUnauthorizedState();
    this.offlineQueue = new OfflineSyncQueue();
  }

  // === 授权管理 ===

  /** 请求用户授权 */
  requestAuthorization(
    authToken: string,
    allowedTypes: SyncItemType[],
    durationMs?: number,
    encryptionKey?: string,
  ): boolean {
    // 验证令牌格式
    if (!authToken || authToken.length < 8) {
      this.emit({ type: 'error', error: '授权令牌无效' });
      return false;
    }

    this.authorization = createAuthorizedState(authToken, allowedTypes, durationMs, encryptionKey);
    this.setStatus('idle', '授权成功');
    return true;
  }

  /** 撤销授权 */
  revokeAuthorization(): void {
    this.authorization = createUnauthorizedState();
    this.setStatus('unauthorized', '授权已撤销');
    this.stopAutoSync();
  }

  /** 获取授权状态 */
  getAuthorization(): SyncAuthorization {
    return { ...this.authorization };
  }

  /** 获取隐私策略说明 */
  getPrivacyPolicy(): PrivacyPolicy {
    return createDefaultPrivacyPolicy();
  }

  // === 配置 ===

  /** 获取配置 */
  getConfig(): SyncConfig {
    return { ...this.config };
  }

  /** 更新配置 */
  updateConfig(patch: Partial<SyncConfig>): void {
    this.config = validateSyncConfig({ ...this.config, ...patch });
  }

  // === 状态 ===

  /** 获取同步状态 */
  getStatus(): SyncStatus {
    return this.status;
  }

  /** 获取所有任务 */
  getTasks(): SyncTask[] {
    return Array.from(this.tasks.values());
  }

  /** 获取历史结果 */
  getSessionResults(): SyncSessionResult[] {
    return [...this.sessionResults];
  }

  // === 事件 ===

  /** 注册事件处理器 */
  onEvent(handler: SyncEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  // === 同步操作 ===

  /** 注册本地元数据 */
  registerLocalItem(meta: SyncItemMeta): void {
    this.localMetas.set(meta.id, meta);
  }

  /** 计算同步差异 */
  computeDiff(remoteMetas: SyncItemMeta[]): SyncDiff {
    return computeSyncDiff(Array.from(this.localMetas.values()), remoteMetas, this.config.conflictStrategy);
  }

  /** 准备上传数据（含压缩） */
  prepareUpload(item: SyncItem): { data: Uint8Array; meta: SyncItemMeta } {
    let data = item.data;
    let meta = { ...item.meta };

    if (this.config.enableCompression && data.length > 1024) {
      const compressed = compressData(data);
      if (compressed.length < data.length) {
        data = compressed;
        meta = { ...meta, compressed: true };
      }
    }

    meta.updatedAt = Date.now();
    return { data, meta };
  }

  /** 处理下载数据（含解压） */
  processDownload(item: SyncItem): { data: Uint8Array; meta: SyncItemMeta } {
    let data = item.data;
    const meta = { ...item.meta };

    if (meta.compressed) {
      data = decompressData(data);
    }

    return { data, meta };
  }

  /** 加入离线队列 */
  enqueueOffline(meta: SyncItemMeta, data: Uint8Array, direction: 'upload' | 'download'): void {
    this.offlineQueue.enqueue(meta, data, direction);
  }

  /** 获取离线队列大小 */
  getOfflineQueueSize(): number {
    return this.offlineQueue.size();
  }

  /** 开始自动同步 */
  startAutoSync(): void {
    this.stopAutoSync();
    if (this.config.autoSyncIntervalMs <= 0) return;
    if (!isAuthorizationValid(this.authorization)) return;

    this.autoSyncTimer = setInterval(() => {
      this.processOfflineQueue();
    }, this.config.autoSyncIntervalMs);
  }

  /** 停止自动同步 */
  stopAutoSync(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
  }

  /** 处理离线队列 */
  processOfflineQueue(): void {
    if (!isAuthorizationValid(this.authorization)) {
      this.setStatus('unauthorized', '未授权，无法同步');
      return;
    }

    if (this.status === 'syncing') return;

    this.setStatus('syncing', '处理离线队列');
    let processed = 0;

    while (!this.offlineQueue.isEmpty() && processed < this.config.maxConcurrentTransfers) {
      const entry = this.offlineQueue.dequeue();
      if (!entry) break;

      if (entry.retries >= this.config.maxRetries) {
        this.emit({ type: 'error', error: `同步失败，已达最大重试次数: ${entry.itemMeta.id}` });
        continue;
      }

      // 实际传输由调用者通过网络层完成
      // 这里标记任务状态
      const task: SyncTask = {
        id: generateId('task'),
        itemMeta: entry.itemMeta,
        direction: entry.direction,
        status: 'in-progress',
        progress: 0,
        startedAt: Date.now(),
        completedAt: null,
        error: null,
        retries: entry.retries,
      };
      this.tasks.set(task.id, task);
      this.emit({ type: 'progress', task });
      processed++;
    }

    if (processed === 0) {
      this.setStatus('idle', '队列为空');
    }
  }

  /** 标记任务完成 */
  completeTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.status = 'completed';
    task.progress = 1;
    task.completedAt = Date.now();
    this.emit({ type: 'progress', task });
  }

  /** 标记任务失败 */
  failTask(taskId: string, error: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.status = 'failed';
    task.error = error;
    task.completedAt = Date.now();
    this.emit({ type: 'error', error });
  }

  /** 完成同步会话 */
  completeSession(result: SyncSessionResult): void {
    this.sessionResults.push(result);
    this.setStatus('idle', `同步完成: 上传 ${result.uploaded}, 下载 ${result.downloaded}`);
    this.emit({ type: 'completed', result });
  }

  /** 销毁 */
  dispose(): void {
    this.stopAutoSync();
    this.tasks.clear();
    this.eventHandlers.clear();
    this.offlineQueue.clear();
    this.localMetas.clear();
  }

  // === 内部 ===

  private setStatus(status: SyncStatus, detail?: string): void {
    this.status = status;
    this.emit({ type: 'status', status, detail });
  }

  private emit(event: SyncEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        /* 忽略回调异常 */
      }
    }
  }
}
