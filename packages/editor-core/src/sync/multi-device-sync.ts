/**
 * 多设备同步模块
 * 实现设备间项目状态同步（WebSocket + 差量同步）
 * 支持离线编辑和自动同步
 * 实现同步冲突检测与解决
 */

import { createId } from '../model';

// ==================== 类型定义 ====================

/** 设备类型 */
export type DeviceType = 'desktop' | 'laptop' | 'tablet' | 'mobile' | 'unknown';

/** 设备状态 */
export type DeviceStatus = 'online' | 'offline' | 'syncing' | 'error';

/** 多设备同步状态 */
export type DeviceSyncStatus = 'idle' | 'syncing' | 'paused' | 'error' | 'conflict';

/** 冲突解决策略 */
export type ConflictResolution = 'local-wins' | 'remote-wins' | 'newest-wins' | 'manual' | 'merge';

/** 同步操作类型 */
export type SyncOperationType = 'create' | 'update' | 'delete' | 'move' | 'rename';

/** 设备信息 */
export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  platform: string;
  osVersion: string;
  appVersion: string;
  lastSeenAt: string;
  lastSyncAt?: string;
  status: DeviceStatus;
  metadata: DeviceMetadata;
}

/** 设备元数据 */
export interface DeviceMetadata {
  screenSize?: { width: number; height: number };
  capabilities: DeviceCapabilities;
  storageUsed: number;
  storageLimit: number;
  networkType?: 'wifi' | 'ethernet' | 'cellular' | 'unknown';
  batteryLevel?: number;
}

/** 设备能力 */
export interface DeviceCapabilities {
  canEdit: boolean;
  canExport: boolean;
  canRender: boolean;
  maxResolution: string;
  supportedFormats: string[];
}

/** 同步操作 */
export interface SyncOperation {
  id: string;
  type: SyncOperationType;
  entityType: 'project' | 'clip' | 'track' | 'effect' | 'settings';
  entityId: string;
  path: string;
  previousValue?: unknown;
  newValue: unknown;
  timestamp: string;
  deviceId: string;
  userId: string;
  version: number;
  checksum: string;
}

/** 同步变更集 */
export interface SyncChangeSet {
  id: string;
  deviceId: string;
  userId: string;
  operations: SyncOperation[];
  timestamp: string;
  baseVersion: number;
  targetVersion: number;
  checksum: string;
  compressed: boolean;
}

/** 多设备同步冲突 */
export interface DeviceSyncConflict {
  id: string;
  type: 'concurrent-edit' | 'version-mismatch' | 'structural-change' | 'data-corruption';
  localOperation: SyncOperation;
  remoteOperation: SyncOperation;
  entityType: string;
  entityId: string;
  detectedAt: string;
  resolution?: ConflictResolution;
  resolvedBy?: string;
  resolvedAt?: string;
}

/** 同步状态快照 */
export interface SyncSnapshot {
  version: number;
  timestamp: string;
  deviceId: string;
  checksum: string;
  data: unknown;
  metadata: SyncSnapshotMetadata;
}

/** 同步快照元数据 */
export interface SyncSnapshotMetadata {
  entityType: string;
  entityId: string;
  parentVersion: number;
  operations: number;
  size: number;
}

/** 离线队列项 */
export interface OfflineQueueItem {
  id: string;
  operation: SyncOperation;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: string;
  error?: string;
  status: 'pending' | 'retrying' | 'failed' | 'completed';
}

/** 同步配置 */
export interface DeviceSyncConfig {
  enabled: boolean;
  autoSync: boolean;
  syncIntervalMs: number;
  conflictResolution: ConflictResolution;
  maxOfflineQueueSize: number;
  maxRetries: number;
  retryDelayMs: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  bandwidthLimitKbps?: number;
  syncOnWifiOnly: boolean;
}

/** 同步事件 */
export type DeviceSyncEvent =
  | { type: 'device.connected'; device: Device }
  | { type: 'device.disconnected'; deviceId: string }
  | { type: 'sync.started'; changeSet: SyncChangeSet }
  | { type: 'sync.completed'; changeSet: SyncChangeSet }
  | { type: 'sync.failed'; error: string; changeSet?: SyncChangeSet }
  | { type: 'conflict.detected'; conflict: DeviceSyncConflict }
  | { type: 'conflict.resolved'; conflict: DeviceSyncConflict }
  | { type: 'offline.queue.updated'; queueSize: number }
  | { type: 'state.changed'; snapshot: SyncSnapshot };

/** 同步状态 */
export interface SyncState {
  localDevice: Device;
  remoteDevices: Device[];
  currentVersion: number;
  lastSyncAt?: string;
  syncStatus: DeviceSyncStatus;
  conflicts: DeviceSyncConflict[];
  offlineQueue: OfflineQueueItem[];
  snapshots: SyncSnapshot[];
  changeHistory: SyncChangeSet[];
}

// ==================== 默认配置 ====================

export const DEFAULT_SYNC_CONFIG: DeviceSyncConfig = {
  enabled: true,
  autoSync: true,
  syncIntervalMs: 30000, // 30秒
  conflictResolution: 'newest-wins',
  maxOfflineQueueSize: 1000,
  maxRetries: 3,
  retryDelayMs: 5000,
  compressionEnabled: true,
  encryptionEnabled: false,
  syncOnWifiOnly: false,
};

// ==================== 工具函数 ====================

/**
 * 计算校验和
 */
export function calculateChecksum(data: unknown): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为32位整数
  }
  return Math.abs(hash).toString(36);
}

/**
 * 检查设备能力
 */
export function canDevicePerformAction(device: Device, action: string): boolean {
  switch (action) {
    case 'edit':
      return device.metadata.capabilities.canEdit;
    case 'export':
      return device.metadata.capabilities.canExport;
    case 'render':
      return device.metadata.capabilities.canRender;
    default:
      return true;
  }
}

/**
 * 比较版本
 */
export function compareVersions(v1: number, v2: number): -1 | 0 | 1 {
  if (v1 < v2) return -1;
  if (v1 > v2) return 1;
  return 0;
}

/**
 * 检查操作是否冲突
 */
export function detectOperationConflict(
  local: SyncOperation,
  remote: SyncOperation,
): boolean {
  // 同一实体的并发编辑
  if (local.entityId === remote.entityId && local.entityType === remote.entityType) {
    // 同一路径的修改
    if (local.path === remote.path) {
      return true;
    }
    // 结构性变更（删除或移动）
    if (local.type === 'delete' || local.type === 'move' ||
        remote.type === 'delete' || remote.type === 'move') {
      return true;
    }
  }
  return false;
}

/**
 * 合并操作
 */
export function mergeOperations(
  local: SyncOperation,
  remote: SyncOperation,
  strategy: ConflictResolution,
): SyncOperation {
  switch (strategy) {
    case 'local-wins':
      return { ...local, version: Math.max(local.version, remote.version) + 1 };
    case 'remote-wins':
      return { ...remote, version: Math.max(local.version, remote.version) + 1 };
    case 'newest-wins':
      return new Date(local.timestamp) > new Date(remote.timestamp)
        ? { ...local, version: Math.max(local.version, remote.version) + 1 }
        : { ...remote, version: Math.max(local.version, remote.version) + 1 };
    case 'merge':
      // 简单的合并策略：使用最新的值
      return {
        ...local,
        newValue: new Date(local.timestamp) > new Date(remote.timestamp)
          ? local.newValue
          : remote.newValue,
        version: Math.max(local.version, remote.version) + 1,
        checksum: calculateChecksum(
          new Date(local.timestamp) > new Date(remote.timestamp)
            ? local.newValue
            : remote.newValue,
        ),
      };
    default:
      return { ...local, version: Math.max(local.version, remote.version) + 1 };
  }
}

/**
 * 压缩变更集
 */
export function compressChangeSet(changeSet: SyncChangeSet): SyncChangeSet {
  // 简单的压缩：合并对同一实体的多次操作
  const mergedOperations = new Map<string, SyncOperation>();

  for (const op of changeSet.operations) {
    const key = `${op.entityType}:${op.entityId}:${op.path}`;
    const existing = mergedOperations.get(key);

    if (existing) {
      // 保留最新的操作
      if (new Date(op.timestamp) > new Date(existing.timestamp)) {
        mergedOperations.set(key, {
          ...op,
          previousValue: existing.previousValue,
        });
      }
    } else {
      mergedOperations.set(key, op);
    }
  }

  return {
    ...changeSet,
    operations: Array.from(mergedOperations.values()),
    compressed: true,
  };
}

/**
 * 验证变更集完整性
 */
export function validateChangeSet(changeSet: SyncChangeSet): boolean {
  // 验证校验和
  const calculatedChecksum = calculateChecksum(changeSet.operations);
  if (calculatedChecksum !== changeSet.checksum) {
    return false;
  }

  // 验证版本连续性
  if (changeSet.targetVersion !== changeSet.baseVersion + changeSet.operations.length) {
    return false;
  }

  // 验证时间戳顺序
  for (let i = 1; i < changeSet.operations.length; i++) {
    if (new Date(changeSet.operations[i].timestamp) < new Date(changeSet.operations[i - 1].timestamp)) {
      return false;
    }
  }

  return true;
}

// ==================== 同步管理器 ====================

/**
 * 多设备同步管理器
 * 提供设备间项目状态同步的完整功能
 */
export class MultiDeviceSyncManager {
  private state: SyncState;
  private config: DeviceSyncConfig;
  private eventHandlers: Map<string, Set<(data: unknown) => void>> = new Map();
  private syncTimer?: ReturnType<typeof setInterval>;
  private wsAdapter?: WSAdapter;

  constructor(
    localDevice: Device,
    config?: Partial<DeviceSyncConfig>,
    wsAdapter?: WSAdapter,
  ) {
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
    this.wsAdapter = wsAdapter;

    this.state = {
      localDevice,
      remoteDevices: [],
      currentVersion: 0,
      syncStatus: 'idle',
      conflicts: [],
      offlineQueue: [],
      snapshots: [],
      changeHistory: [],
    };
  }

  /**
   * 获取同步状态
   */
  getState(): SyncState {
    return { ...this.state };
  }

  /**
   * 获取配置
   */
  getConfig(): DeviceSyncConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<DeviceSyncConfig>): void {
    this.config = { ...this.config, ...config };

    if (this.config.autoSync && !this.syncTimer) {
      this.startAutoSync();
    } else if (!this.config.autoSync && this.syncTimer) {
      this.stopAutoSync();
    }
  }

  /**
   * 注册远程设备
   */
  registerDevice(device: Device): void {
    const existingIndex = this.state.remoteDevices.findIndex((d) => d.id === device.id);

    if (existingIndex >= 0) {
      this.state.remoteDevices[existingIndex] = {
        ...device,
        lastSeenAt: new Date().toISOString(),
      };
    } else {
      this.state.remoteDevices.push({
        ...device,
        lastSeenAt: new Date().toISOString(),
      });
    }

    this.emit('device.connected', device);
  }

  /**
   * 移除远程设备
   */
  removeDevice(deviceId: string): void {
    this.state.remoteDevices = this.state.remoteDevices.filter((d) => d.id !== deviceId);
    this.emit('device.disconnected', deviceId);
  }

  /**
   * 更新设备状态
   */
  updateDeviceStatus(deviceId: string, status: DeviceStatus): void {
    const device = this.state.remoteDevices.find((d) => d.id === deviceId);
    if (device) {
      device.status = status;
      device.lastSeenAt = new Date().toISOString();
    }
  }

  /**
   * 创建变更集
   */
  createChangeSet(operations: SyncOperation[]): SyncChangeSet {
    const changeSet: SyncChangeSet = {
      id: createId('cs'),
      deviceId: this.state.localDevice.id,
      userId: operations[0]?.userId ?? '',
      operations,
      timestamp: new Date().toISOString(),
      baseVersion: this.state.currentVersion,
      targetVersion: this.state.currentVersion + operations.length,
      checksum: calculateChecksum(operations),
      compressed: false,
    };

    return changeSet;
  }

  /**
   * 应用本地变更
   */
  applyLocalChange(operations: SyncOperation[]): SyncChangeSet {
    const changeSet = this.createChangeSet(operations);

    // 更新版本
    this.state.currentVersion = changeSet.targetVersion;

    // 保存到历史
    this.state.changeHistory.push(changeSet);

    // 创建快照
    this.createSnapshot(changeSet);

    // 如果在线，立即同步
    if (this.state.localDevice.status === 'online' && this.config.autoSync) {
      this.syncToRemote(changeSet);
    } else {
      // 添加到离线队列
      this.addToOfflineQueue(operations);
    }

    this.emit('state.changed', this.getLatestSnapshot());

    return changeSet;
  }

  /**
   * 应用远程变更
   */
  applyRemoteChange(changeSet: SyncChangeSet): boolean {
    // 验证变更集
    if (!validateChangeSet(changeSet)) {
      this.emit('sync.failed', { error: '变更集验证失败', changeSet });
      return false;
    }

    // 检测冲突
    const conflicts = this.detectConflicts(changeSet);
    if (conflicts.length > 0) {
      // 解决冲突
      const resolved = this.resolveConflicts(conflicts);
      if (!resolved) {
        this.emit('sync.failed', { error: '冲突解决失败', changeSet });
        return false;
      }
    }

    // 应用变更
    this.state.currentVersion = changeSet.targetVersion;
    this.state.changeHistory.push(changeSet);
    this.state.lastSyncAt = new Date().toISOString();

    // 创建快照
    this.createSnapshot(changeSet);

    this.emit('sync.completed', changeSet);
    this.emit('state.changed', this.getLatestSnapshot());

    return true;
  }

  /**
   * 检测冲突
   */
  detectConflicts(remoteChangeSet: SyncChangeSet): DeviceSyncConflict[] {
    const conflicts: DeviceSyncConflict[] = [];

    // 获取本地未同步的操作
    const localOperations = this.getUnsyncedOperations();

    for (const remoteOp of remoteChangeSet.operations) {
      for (const localOp of localOperations) {
        if (detectOperationConflict(localOp, remoteOp)) {
          const conflict: DeviceSyncConflict = {
            id: createId('conflict'),
            type: 'concurrent-edit',
            localOperation: localOp,
            remoteOperation: remoteOp,
            entityType: remoteOp.entityType,
            entityId: remoteOp.entityId,
            detectedAt: new Date().toISOString(),
          };
          conflicts.push(conflict);
        }
      }
    }

    if (conflicts.length > 0) {
      this.state.conflicts.push(...conflicts);
      this.emit('conflict.detected', conflicts[0]);
    }

    return conflicts;
  }

  /**
   * 解决冲突
   */
  resolveConflicts(conflicts: DeviceSyncConflict[]): boolean {
    for (const conflict of conflicts) {
      const resolution = this.config.conflictResolution;

      if (resolution === 'manual') {
        // 需要用户手动解决
        return false;
      }

      // 自动解决
      conflict.resolution = resolution;
      conflict.resolvedBy = 'system';
      conflict.resolvedAt = new Date().toISOString();

      // 合并操作
      const merged = mergeOperations(
        conflict.localOperation,
        conflict.remoteOperation,
        resolution,
      );

      // 应用合并后的操作
      this.applyMergedOperation(merged);

      this.emit('conflict.resolved', conflict);
    }

    // 清除已解决的冲突
    this.state.conflicts = this.state.conflicts.filter((c) => !c.resolution);

    return true;
  }

  /**
   * 手动解决冲突
   */
  resolveConflictManually(
    conflictId: string,
    resolution: ConflictResolution,
    userId: string,
  ): boolean {
    const conflict = this.state.conflicts.find((c) => c.id === conflictId);
    if (!conflict) {
      return false;
    }

    conflict.resolution = resolution;
    conflict.resolvedBy = userId;
    conflict.resolvedAt = new Date().toISOString();

    // 合并操作
    const merged = mergeOperations(
      conflict.localOperation,
      conflict.remoteOperation,
      resolution,
    );

    // 应用合并后的操作
    this.applyMergedOperation(merged);

    // 从冲突列表中移除
    this.state.conflicts = this.state.conflicts.filter((c) => c.id !== conflictId);

    this.emit('conflict.resolved', conflict);

    return true;
  }

  /**
   * 应用合并后的操作
   */
  private applyMergedOperation(operation: SyncOperation): void {
    // 更新版本
    this.state.currentVersion = Math.max(this.state.currentVersion, operation.version);

    // 添加到历史
    const changeSet = this.createChangeSet([operation]);
    this.state.changeHistory.push(changeSet);
  }

  /**
   * 获取未同步的操作
   */
  private getUnsyncedOperations(): SyncOperation[] {
    const lastSyncVersion = this.getLastSyncedVersion();
    const operations: SyncOperation[] = [];

    for (const changeSet of this.state.changeHistory) {
      if (changeSet.baseVersion >= lastSyncVersion) {
        operations.push(...changeSet.operations);
      }
    }

    return operations;
  }

  /**
   * 获取最后同步的版本
   */
  private getLastSyncedVersion(): number {
    if (this.state.changeHistory.length === 0) {
      return 0;
    }

    // 找到最后一个同步到远程的变更集
    const lastSynced = this.state.changeHistory
      .filter((cs) => cs.deviceId === this.state.localDevice.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

    return lastSynced?.baseVersion ?? 0;
  }

  /**
   * 同步到远程
   */
  private async syncToRemote(changeSet: SyncChangeSet): Promise<void> {
    if (!this.wsAdapter) {
      return;
    }

    this.state.syncStatus = 'syncing';
    this.emit('sync.started', changeSet);

    try {
      // 压缩变更集
      const compressed = this.config.compressionEnabled
        ? compressChangeSet(changeSet)
        : changeSet;

      // 发送到远程
      await this.wsAdapter.send({
        type: 'sync',
        payload: compressed,
      });

      this.state.syncStatus = 'idle';
      this.state.lastSyncAt = new Date().toISOString();

      // 更新设备同步时间
      this.state.localDevice.lastSyncAt = this.state.lastSyncAt;

    } catch (error) {
      this.state.syncStatus = 'error';
      this.emit('sync.failed', {
        error: error instanceof Error ? error.message : '同步失败',
        changeSet,
      });

      // 添加到离线队列
      this.addToOfflineQueue(changeSet.operations);
    }
  }

  /**
   * 添加到离线队列
   */
  private addToOfflineQueue(operations: SyncOperation[]): void {
    const now = new Date().toISOString();

    for (const op of operations) {
      // 检查队列大小限制
      if (this.state.offlineQueue.length >= this.config.maxOfflineQueueSize) {
        // 移除最旧的项
        this.state.offlineQueue.shift();
      }

      this.state.offlineQueue.push({
        id: createId('oq'),
        operation: op,
        retryCount: 0,
        maxRetries: this.config.maxRetries,
        nextRetryAt: now,
        status: 'pending',
      });
    }

    this.emit('offline.queue.updated', this.state.offlineQueue.length);
  }

  /**
   * 处理离线队列
   */
  async processOfflineQueue(): Promise<void> {
    if (this.state.offlineQueue.length === 0) {
      return;
    }

    if (this.state.localDevice.status !== 'online') {
      return;
    }

    this.state.syncStatus = 'syncing';

    const now = new Date();
    const pendingItems = this.state.offlineQueue.filter(
      (item) =>
        item.status === 'pending' &&
        new Date(item.nextRetryAt) <= now,
    );

    for (const item of pendingItems) {
      try {
        const changeSet = this.createChangeSet([item.operation]);
        await this.syncToRemote(changeSet);

        // 标记为完成
        item.status = 'completed';
      } catch (error) {
        item.retryCount++;
        item.error = error instanceof Error ? error.message : '同步失败';

        if (item.retryCount >= item.maxRetries) {
          item.status = 'failed';
        } else {
          item.status = 'retrying';
          item.nextRetryAt = new Date(
            now.getTime() + this.config.retryDelayMs * Math.pow(2, item.retryCount),
          ).toISOString();
        }
      }
    }

    // 清除已完成的项
    this.state.offlineQueue = this.state.offlineQueue.filter(
      (item) => item.status !== 'completed',
    );

    this.state.syncStatus = 'idle';
    this.emit('offline.queue.updated', this.state.offlineQueue.length);
  }

  /**
   * 创建快照
   */
  private createSnapshot(changeSet: SyncChangeSet): void {
    const snapshot: SyncSnapshot = {
      version: this.state.currentVersion,
      timestamp: new Date().toISOString(),
      deviceId: this.state.localDevice.id,
      checksum: calculateChecksum(changeSet.operations),
      data: changeSet.operations,
      metadata: {
        entityType: 'project',
        entityId: 'current',
        parentVersion: changeSet.baseVersion,
        operations: changeSet.operations.length,
        size: JSON.stringify(changeSet.operations).length,
      },
    };

    this.state.snapshots.push(snapshot);

    // 限制快照数量
    if (this.state.snapshots.length > 100) {
      this.state.snapshots = this.state.snapshots.slice(-50);
    }
  }

  /**
   * 获取最新快照
   */
  getLatestSnapshot(): SyncSnapshot | undefined {
    return this.state.snapshots[this.state.snapshots.length - 1];
  }

  /**
   * 获取冲突列表
   */
  getConflicts(): DeviceSyncConflict[] {
    return [...this.state.conflicts];
  }

  /**
   * 获取离线队列
   */
  getOfflineQueue(): OfflineQueueItem[] {
    return [...this.state.offlineQueue];
  }

  /**
   * 启动自动同步
   */
  startAutoSync(): void {
    if (this.syncTimer) {
      return;
    }

    this.syncTimer = setInterval(() => {
      this.processOfflineQueue();
    }, this.config.syncIntervalMs);
  }

  /**
   * 停止自动同步
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
  }

  /**
   * 手动触发同步
   */
  async triggerSync(): Promise<void> {
    if (this.state.syncStatus === 'syncing') {
      return;
    }

    await this.processOfflineQueue();
  }

  /**
   * 暂停同步
   */
  pauseSync(): void {
    this.state.syncStatus = 'paused';
    this.stopAutoSync();
  }

  /**
   * 恢复同步
   */
  resumeSync(): void {
    this.state.syncStatus = 'idle';
    if (this.config.autoSync) {
      this.startAutoSync();
    }
  }

  /**
   * 更新本地设备信息
   */
  updateLocalDevice(updates: Partial<Device>): void {
    this.state.localDevice = {
      ...this.state.localDevice,
      ...updates,
      lastSeenAt: new Date().toISOString(),
    };
  }

  /**
   * 检查是否需要同步
   */
  needsSync(): boolean {
    return (
      this.state.offlineQueue.length > 0 ||
      this.state.conflicts.length > 0 ||
      this.state.syncStatus === 'error'
    );
  }

  /**
   * 获取同步统计信息
   */
  getStats(): SyncStats {
    return {
      totalOperations: this.state.changeHistory.reduce(
        (sum, cs) => sum + cs.operations.length,
        0,
      ),
      totalConflicts: this.state.conflicts.length,
      offlineQueueSize: this.state.offlineQueue.length,
      lastSyncAt: this.state.lastSyncAt,
      currentVersion: this.state.currentVersion,
      remoteDevices: this.state.remoteDevices.length,
    };
  }

  /**
   * 导出状态
   */
  exportState(): string {
    return JSON.stringify(this.state, null, 2);
  }

  /**
   * 导入状态
   */
  importState(stateJson: string): boolean {
    try {
      const parsed = JSON.parse(stateJson) as SyncState;

      // 验证基本结构
      if (!parsed.localDevice || !Array.isArray(parsed.remoteDevices)) {
        return false;
      }

      this.state = parsed;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 注册事件处理器
   */
  on(event: string, handler: (data: unknown) => void): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);

    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  /**
   * 触发事件
   */
  private emit(event: string, data: unknown): void {
    this.eventHandlers.get(event)?.forEach((handler) => handler(data));
  }

  /**
   * 释放资源
   */
  dispose(): void {
    this.stopAutoSync();
    this.eventHandlers.clear();
    this.wsAdapter?.close();
  }
}

// ==================== WebSocket 适配器接口 ====================

/**
 * WebSocket 适配器接口
 * 用于抽象 WebSocket 实现，便于测试
 */
export interface WSAdapter {
  send(message: { type: string; payload: unknown }): Promise<void>;
  close(): void;
  onMessage(handler: (message: { type: string; payload: unknown }) => void): void;
  onOpen(handler: () => void): void;
  onClose(handler: () => void): void;
  onError(handler: (error: Error) => void): void;
}

/**
 * 浏览器 WebSocket 适配器
 */
export class BrowserWSAdapter implements WSAdapter {
  private ws: WebSocket | null = null;
  private messageHandlers: Set<(message: { type: string; payload: unknown }) => void> = new Set();
  private openHandlers: Set<() => void> = new Set();
  private closeHandlers: Set<() => void> = new Set();
  private errorHandlers: Set<(error: Error) => void> = new Set();

  constructor(private url: string) {}

  async send(message: { type: string; payload: unknown }): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    this.ws.send(JSON.stringify(message));
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  connect(): void {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.openHandlers.forEach((handler) => handler());
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.messageHandlers.forEach((handler) => handler(message));
      } catch (error) {
        this.errorHandlers.forEach((handler) =>
          handler(error instanceof Error ? error : new Error('Failed to parse message')),
        );
      }
    };

    this.ws.onclose = () => {
      this.closeHandlers.forEach((handler) => handler());
    };

    this.ws.onerror = (event) => {
      this.errorHandlers.forEach((handler) =>
        handler(new Error(`WebSocket error: ${event}`)),
      );
    };
  }

  onMessage(handler: (message: { type: string; payload: unknown }) => void): void {
    this.messageHandlers.add(handler);
  }

  onOpen(handler: () => void): void {
    this.openHandlers.add(handler);
  }

  onClose(handler: () => void): void {
    this.closeHandlers.add(handler);
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandlers.add(handler);
  }
}

/**
 * Mock WebSocket 适配器（用于测试）
 */
export class MockWSAdapter implements WSAdapter {
  private messageHandlers: Set<(message: { type: string; payload: unknown }) => void> = new Set();
  private openHandlers: Set<() => void> = new Set();
  private closeHandlers: Set<() => void> = new Set();
  private errorHandlers: Set<(error: Error) => void> = new Set();
  private sentMessages: Array<{ type: string; payload: unknown }> = [];
  private connected = false;

  async send(message: { type: string; payload: unknown }): Promise<void> {
    if (!this.connected) {
      throw new Error('WebSocket is not connected');
    }
    this.sentMessages.push(message);
  }

  close(): void {
    this.connected = false;
    this.closeHandlers.forEach((handler) => handler());
  }

  connect(): void {
    this.connected = true;
    this.openHandlers.forEach((handler) => handler());
  }

  simulateIncoming(message: { type: string; payload: unknown }): void {
    this.messageHandlers.forEach((handler) => handler(message));
  }

  simulateError(error: Error): void {
    this.errorHandlers.forEach((handler) => handler(error));
  }

  getSentMessages(): Array<{ type: string; payload: unknown }> {
    return [...this.sentMessages];
  }

  isConnected(): boolean {
    return this.connected;
  }

  onMessage(handler: (message: { type: string; payload: unknown }) => void): void {
    this.messageHandlers.add(handler);
  }

  onOpen(handler: () => void): void {
    this.openHandlers.add(handler);
  }

  onClose(handler: () => void): void {
    this.closeHandlers.add(handler);
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandlers.add(handler);
  }
}

// ==================== 工厂函数 ====================

/** 同步统计信息 */
export interface SyncStats {
  totalOperations: number;
  totalConflicts: number;
  offlineQueueSize: number;
  lastSyncAt?: string;
  currentVersion: number;
  remoteDevices: number;
}

/**
 * 创建同步管理器
 */
export function createSyncManager(
  localDevice: Device,
  config?: Partial<DeviceSyncConfig>,
  wsAdapter?: WSAdapter,
): MultiDeviceSyncManager {
  return new MultiDeviceSyncManager(localDevice, config, wsAdapter);
}

/**
 * 创建本地设备信息
 */
export function createLocalDevice(
  name: string,
  type: DeviceType,
  platform: string,
  osVersion: string,
  appVersion: string,
): Device {
  return {
    id: createId('device'),
    name,
    type,
    platform,
    osVersion,
    appVersion,
    lastSeenAt: new Date().toISOString(),
    status: 'online',
    metadata: {
      capabilities: {
        canEdit: true,
        canExport: true,
        canRender: true,
        maxResolution: '4K',
        supportedFormats: ['mp4', 'mov', 'avi', 'mkv'],
      },
      storageUsed: 0,
      storageLimit: 1024 * 1024 * 1024 * 100, // 100GB
    },
  };
}

// ==================== 序列化函数 ====================

/**
 * 序列化同步状态
 */
export function serializeSyncState(state: SyncState): string {
  return JSON.stringify(state);
}

/**
 * 解析同步状态
 */
export function parseSyncState(json: string): SyncState | null {
  try {
    return JSON.parse(json) as SyncState;
  } catch {
    return null;
  }
}
