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
import {
  calculateChecksum,
  compressChangeSet,
  detectOperationConflict,
  mergeOperations,
  validateChangeSet,
} from './utils';

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

  /**
   * Get sync state
   */
  getState(): SyncState {
    return { ...this.state };
  }

  /**
   * Get config
   */
  getConfig(): DeviceSyncConfig {
    return { ...this.config };
  }

  /**
   * Update config
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
   * Register remote device
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
   * Remove remote device
   */
  removeDevice(deviceId: string): void {
    this.state.remoteDevices = this.state.remoteDevices.filter((d) => d.id !== deviceId);
    this.emit('device.disconnected', deviceId);
  }

  /**
   * Update device status
   */
  updateDeviceStatus(deviceId: string, status: DeviceStatus): void {
    const device = this.state.remoteDevices.find((d) => d.id === deviceId);
    if (device) {
      device.status = status;
      device.lastSeenAt = new Date().toISOString();
    }
  }

  /**
   * Create changeset
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
   * Apply local change
   */
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

  /**
   * Apply remote change
   */
  applyRemoteChange(changeSet: SyncChangeSet): boolean {
    if (!validateChangeSet(changeSet)) {
      this.emit('sync.failed', { error: 'Changeset validation failed', changeSet });
      return false;
    }

    const conflicts = this.detectConflicts(changeSet);
    if (conflicts.length > 0) {
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

  /**
   * Detect conflicts
   */
  detectConflicts(remoteChangeSet: SyncChangeSet): DeviceSyncConflict[] {
    const conflicts: DeviceSyncConflict[] = [];
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
   * Resolve conflicts
   */
  resolveConflicts(conflicts: DeviceSyncConflict[]): boolean {
    for (const conflict of conflicts) {
      const resolution = this.config.conflictResolution;

      if (resolution === 'manual') {
        return false;
      }

      conflict.resolution = resolution;
      conflict.resolvedBy = 'system';
      conflict.resolvedAt = new Date().toISOString();

      const merged = mergeOperations(conflict.localOperation, conflict.remoteOperation, resolution);
      this.applyMergedOperation(merged);

      this.emit('conflict.resolved', conflict);
    }

    this.state.conflicts = this.state.conflicts.filter((c) => !c.resolution);

    return true;
  }

  /**
   * Manually resolve conflict
   */
  resolveConflictManually(conflictId: string, resolution: ConflictResolution, userId: string): boolean {
    const conflict = this.state.conflicts.find((c) => c.id === conflictId);
    if (!conflict) {
      return false;
    }

    conflict.resolution = resolution;
    conflict.resolvedBy = userId;
    conflict.resolvedAt = new Date().toISOString();

    const merged = mergeOperations(conflict.localOperation, conflict.remoteOperation, resolution);
    this.applyMergedOperation(merged);

    this.state.conflicts = this.state.conflicts.filter((c) => c.id !== conflictId);

    this.emit('conflict.resolved', conflict);

    return true;
  }

  /**
   * Apply merged operation
   */
  private applyMergedOperation(operation: SyncOperation): void {
    this.state.currentVersion = Math.max(this.state.currentVersion, operation.version);
    const changeSet = this.createChangeSet([operation]);
    this.state.changeHistory.push(changeSet);
  }

  /**
   * Get unsynced operations
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
   * Get last synced version
   */
  private getLastSyncedVersion(): number {
    if (this.state.changeHistory.length === 0) {
      return 0;
    }

    const lastSynced = this.state.changeHistory
      .filter((cs) => cs.deviceId === this.state.localDevice.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

    return lastSynced?.baseVersion ?? 0;
  }

  /**
   * Sync to remote
   */
  private async syncToRemote(changeSet: SyncChangeSet): Promise<void> {
    if (!this.wsAdapter) {
      return;
    }

    this.state.syncStatus = 'syncing';
    this.emit('sync.started', changeSet);

    try {
      const compressed = this.config.compressionEnabled ? compressChangeSet(changeSet) : changeSet;

      await this.wsAdapter.send({
        type: 'sync',
        payload: compressed,
      });

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

  /**
   * Add to offline queue
   */
  private addToOfflineQueue(operations: SyncOperation[]): void {
    const now = new Date().toISOString();

    for (const op of operations) {
      if (this.state.offlineQueue.length >= this.config.maxOfflineQueueSize) {
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
   * Process offline queue
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
      (item) => item.status === 'pending' && new Date(item.nextRetryAt) <= now,
    );

    for (const item of pendingItems) {
      try {
        const changeSet = this.createChangeSet([item.operation]);
        await this.syncToRemote(changeSet);
        item.status = 'completed';
      } catch (error) {
        item.retryCount++;
        item.error = error instanceof Error ? error.message : 'Sync failed';

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

    this.state.offlineQueue = this.state.offlineQueue.filter((item) => item.status !== 'completed');
    this.state.syncStatus = 'idle';
    this.emit('offline.queue.updated', this.state.offlineQueue.length);
  }

  /**
   * Create snapshot
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

    if (this.state.snapshots.length > 100) {
      this.state.snapshots = this.state.snapshots.slice(-50);
    }
  }

  /**
   * Get latest snapshot
   */
  getLatestSnapshot(): SyncSnapshot | undefined {
    return this.state.snapshots[this.state.snapshots.length - 1];
  }

  /**
   * Get conflicts
   */
  getConflicts(): DeviceSyncConflict[] {
    return [...this.state.conflicts];
  }

  /**
   * Get offline queue
   */
  getOfflineQueue(): OfflineQueueItem[] {
    return [...this.state.offlineQueue];
  }

  /**
   * Start auto sync
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
   * Stop auto sync
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
  }

  /**
   * Manually trigger sync
   */
  async triggerSync(): Promise<void> {
    if (this.state.syncStatus === 'syncing') {
      return;
    }

    await this.processOfflineQueue();
  }

  /**
   * Pause sync
   */
  pauseSync(): void {
    this.state.syncStatus = 'paused';
    this.stopAutoSync();
  }

  /**
   * Resume sync
   */
  resumeSync(): void {
    this.state.syncStatus = 'idle';
    if (this.config.autoSync) {
      this.startAutoSync();
    }
  }

  /**
   * Update local device info
   */
  updateLocalDevice(updates: Partial<Device>): void {
    this.state.localDevice = {
      ...this.state.localDevice,
      ...updates,
      lastSeenAt: new Date().toISOString(),
    };
  }

  /**
   * Check if sync is needed
   */
  needsSync(): boolean {
    return this.state.offlineQueue.length > 0 || this.state.conflicts.length > 0 || this.state.syncStatus === 'error';
  }

  /**
   * Get sync stats
   */
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

  /**
   * Export state
   */
  exportState(): string {
    return JSON.stringify(this.state, null, 2);
  }

  /**
   * Import state
   */
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

  /**
   * Register event handler
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
   * Emit event
   */
  private emit(event: string, data: unknown): void {
    this.eventHandlers.get(event)?.forEach((handler) => handler(data));
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.stopAutoSync();
    this.eventHandlers.clear();
    this.wsAdapter?.close();
  }
}
