/**
 * Multi-device sync manager
 */

import { createId } from '../model';
import type {
  Device,
  DeviceStatus,
  DeviceSyncConfig,
  DeviceSyncConflict,
  ConflictResolution,
  OfflineQueueItem,
  SyncChangeSet,
  SyncSnapshot,
  SyncState,
  SyncStats,
  SyncOperation,
  WSAdapter,
} from './types';
import { DEFAULT_SYNC_CONFIG } from './types';
import { calculateChecksum, compressChangeSet, validateChangeSet } from './utils';
import {
  detectConflicts,
  resolveOneConflict,
  getUnsyncedOperations,
} from './conflict-resolver';
import {
  createOfflineQueueItems,
  enforceQueueLimit,
  getPendingItems,
  markCompleted,
  markRetry,
  removeCompleted,
} from './offline-queue';

/**
 * Multi-device sync manager
 * Provides complete project state synchronization across devices
 */
export class MultiDeviceSyncManager {
  private state: SyncState;
  private config: DeviceSyncConfig;
  private eventHandlers: Map<string, Set<(data: unknown) => void>> = new Map();
  private syncTimer?: ReturnType<typeof setInterval>;
  private wsAdapter?: WSAdapter;

  constructor(localDevice: Device, config?: Partial<DeviceSyncConfig>, wsAdapter?: WSAdapter) {
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

  getState(): SyncState {
    return { ...this.state };
  }

  getConfig(): DeviceSyncConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<DeviceSyncConfig>): void {
    this.config = { ...this.config, ...config };
    if (this.config.autoSync && !this.syncTimer) {
      this.startAutoSync();
    } else if (!this.config.autoSync && this.syncTimer) {
      this.stopAutoSync();
    }
  }

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

  removeDevice(deviceId: string): void {
    this.state.remoteDevices = this.state.remoteDevices.filter((d) => d.id !== deviceId);
    this.emit('device.disconnected', deviceId);
  }

  updateDeviceStatus(deviceId: string, status: DeviceStatus): void {
    const device = this.state.remoteDevices.find((d) => d.id === deviceId);
    if (device) {
      device.status = status;
      device.lastSeenAt = new Date().toISOString();
    }
  }

  createChangeSet(operations: SyncOperation[]): SyncChangeSet {
    return {
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
  }

  applyLocalChange(operations: SyncOperation[]): SyncChangeSet {
    const changeSet = this.createChangeSet(operations);
    this.state.currentVersion = changeSet.targetVersion;
    this.state.changeHistory.push(changeSet);
    this.createSnapshot(changeSet);

    if (this.state.localDevice.status === 'online' && this.config.autoSync) {
      this.syncToRemote(changeSet);
    } else {
      this.addToOfflineQueue(operations);
    }

    this.emit('state.changed', this.getLatestSnapshot());
    return changeSet;
  }

  applyRemoteChange(changeSet: SyncChangeSet): boolean {
    if (!validateChangeSet(changeSet)) {
      this.emit('sync.failed', { error: 'Changeset validation failed', changeSet });
      return false;
    }

    const localOps = getUnsyncedOperations(this.state.changeHistory, this.state.localDevice.id);
    const conflicts = detectConflicts(localOps, changeSet);

    if (conflicts.length > 0) {
      if (this.config.conflictResolution === 'manual') {
        // Store conflicts for manual resolution
        this.state.conflicts.push(...conflicts);
        this.emit('conflict.detected', conflicts[0]);
        return false;
      }
      const resolved = this.resolveConflicts(conflicts);
      if (!resolved) {
        this.emit('sync.failed', { error: 'Conflict resolution failed', changeSet });
        return false;
      }
    }

    this.state.currentVersion = changeSet.targetVersion;
    this.state.changeHistory.push(changeSet);
    this.state.lastSyncAt = new Date().toISOString();
    this.createSnapshot(changeSet);

    this.emit('sync.completed', changeSet);
    this.emit('state.changed', this.getLatestSnapshot());
    return true;
  }

  detectConflicts(remoteChangeSet: SyncChangeSet): DeviceSyncConflict[] {
    const localOps = getUnsyncedOperations(this.state.changeHistory, this.state.localDevice.id);
    const conflicts = detectConflicts(localOps, remoteChangeSet);

    if (conflicts.length > 0) {
      this.state.conflicts.push(...conflicts);
      this.emit('conflict.detected', conflicts[0]);
    }

    return conflicts;
  }

  resolveConflicts(conflicts: DeviceSyncConflict[]): boolean {
    for (const conflict of conflicts) {
      const merged = resolveOneConflict(conflict, this.config.conflictResolution, 'system');
      if (!merged) {
        return false;
      }
      this.applyMergedOperation(merged);
      this.emit('conflict.resolved', conflict);
    }
    this.state.conflicts = this.state.conflicts.filter((c) => !c.resolution);
    return true;
  }

  resolveConflictManually(conflictId: string, resolution: ConflictResolution, userId: string): boolean {
    const conflict = this.state.conflicts.find((c) => c.id === conflictId);
    if (!conflict) {
      return false;
    }

    const merged = resolveOneConflict(conflict, resolution, userId);
    if (!merged) {
      return false;
    }

    this.applyMergedOperation(merged);
    this.state.conflicts = this.state.conflicts.filter((c) => c.id !== conflictId);
    this.emit('conflict.resolved', conflict);
    return true;
  }

  async processOfflineQueue(): Promise<void> {
    if (this.state.offlineQueue.length === 0 || this.state.localDevice.status !== 'online') {
      return;
    }

    this.state.syncStatus = 'syncing';
    const pendingItems = getPendingItems(this.state.offlineQueue);

    for (const item of pendingItems) {
      try {
        const changeSet = this.createChangeSet([item.operation]);
        await this.syncToRemote(changeSet);
        markCompleted(item);
      } catch (error) {
        markRetry(item, error, this.config.retryDelayMs);
      }
    }

    this.state.offlineQueue = removeCompleted(this.state.offlineQueue);
    this.state.syncStatus = 'idle';
    this.emit('offline.queue.updated', this.state.offlineQueue.length);
  }

  getLatestSnapshot(): SyncSnapshot | undefined {
    return this.state.snapshots[this.state.snapshots.length - 1];
  }

  getConflicts(): DeviceSyncConflict[] {
    return [...this.state.conflicts];
  }

  getOfflineQueue(): OfflineQueueItem[] {
    return [...this.state.offlineQueue];
  }

  startAutoSync(): void {
    if (this.syncTimer) return;
    this.syncTimer = setInterval(() => this.processOfflineQueue(), this.config.syncIntervalMs);
  }

  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
  }

  async triggerSync(): Promise<void> {
    if (this.state.syncStatus !== 'syncing') {
      await this.processOfflineQueue();
    }
  }

  pauseSync(): void {
    this.state.syncStatus = 'paused';
    this.stopAutoSync();
  }

  resumeSync(): void {
    this.state.syncStatus = 'idle';
    if (this.config.autoSync) {
      this.startAutoSync();
    }
  }

  updateLocalDevice(updates: Partial<Device>): void {
    this.state.localDevice = {
      ...this.state.localDevice,
      ...updates,
      lastSeenAt: new Date().toISOString(),
    };
  }

  needsSync(): boolean {
    return this.state.offlineQueue.length > 0 || this.state.conflicts.length > 0 || this.state.syncStatus === 'error';
  }

  getStats(): SyncStats {
    return {
      totalOperations: this.state.changeHistory.reduce((sum, cs) => sum + cs.operations.length, 0),
      totalConflicts: this.state.conflicts.length,
      offlineQueueSize: this.state.offlineQueue.length,
      lastSyncAt: this.state.lastSyncAt,
      currentVersion: this.state.currentVersion,
      remoteDevices: this.state.remoteDevices.length,
    };
  }

  exportState(): string {
    return JSON.stringify(this.state, null, 2);
  }

  importState(stateJson: string): boolean {
    try {
      const parsed = JSON.parse(stateJson) as SyncState;
      if (!parsed.localDevice || !Array.isArray(parsed.remoteDevices)) {
        return false;
      }
      this.state = parsed;
      return true;
    } catch {
      return false;
    }
  }

  on(event: string, handler: (data: unknown) => void): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
    return () => { this.eventHandlers.get(event)?.delete(handler); };
  }

  dispose(): void {
    this.stopAutoSync();
    this.eventHandlers.clear();
    this.wsAdapter?.close();
  }

  private applyMergedOperation(operation: SyncOperation): void {
    this.state.currentVersion = Math.max(this.state.currentVersion, operation.version);
    const changeSet = this.createChangeSet([operation]);
    this.state.changeHistory.push(changeSet);
  }

  private addToOfflineQueue(operations: SyncOperation[]): void {
    const newItems = createOfflineQueueItems(operations, this.config);
    this.state.offlineQueue = enforceQueueLimit(this.state.offlineQueue, this.config.maxOfflineQueueSize, newItems);
    this.emit('offline.queue.updated', this.state.offlineQueue.length);
  }

  private async syncToRemote(changeSet: SyncChangeSet): Promise<void> {
    if (!this.wsAdapter) return;

    this.state.syncStatus = 'syncing';
    this.emit('sync.started', changeSet);

    try {
      const compressed = this.config.compressionEnabled ? compressChangeSet(changeSet) : changeSet;
      await this.wsAdapter.send({ type: 'sync', payload: compressed });
      this.state.syncStatus = 'idle';
      this.state.lastSyncAt = new Date().toISOString();
      this.state.localDevice.lastSyncAt = this.state.lastSyncAt;
    } catch (error) {
      this.state.syncStatus = 'error';
      this.emit('sync.failed', {
        error: error instanceof Error ? error.message : 'Sync failed',
        changeSet,
      });
      this.addToOfflineQueue(changeSet.operations);
    }
  }

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
    if (this.state.snapshots.length > 100) {
      this.state.snapshots = this.state.snapshots.slice(-50);
    }
  }

  private emit(event: string, data: unknown): void {
    this.eventHandlers.get(event)?.forEach((handler) => handler(data));
  }
}
