/**
 * Multi-device sync type definitions
 */

import { createId } from '../model';

// ==================== Type Definitions ====================

/** Device type */
export type DeviceType = 'desktop' | 'laptop' | 'tablet' | 'mobile' | 'unknown';

/** Device status */
export type DeviceStatus = 'online' | 'offline' | 'syncing' | 'error';

/** Multi-device sync status */
export type DeviceSyncStatus = 'idle' | 'syncing' | 'paused' | 'error' | 'conflict';

/** Conflict resolution strategy */
export type ConflictResolution = 'local-wins' | 'remote-wins' | 'newest-wins' | 'manual' | 'merge';

/** Sync operation type */
export type SyncOperationType = 'create' | 'update' | 'delete' | 'move' | 'rename';

/** Device info */
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

/** Device metadata */
export interface DeviceMetadata {
  screenSize?: { width: number; height: number };
  capabilities: DeviceCapabilities;
  storageUsed: number;
  storageLimit: number;
  networkType?: 'wifi' | 'ethernet' | 'cellular' | 'unknown';
  batteryLevel?: number;
}

/** Device capabilities */
export interface DeviceCapabilities {
  canEdit: boolean;
  canExport: boolean;
  canRender: boolean;
  maxResolution: string;
  supportedFormats: string[];
}

/** Sync operation */
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

/** Sync changeset */
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

/** Multi-device sync conflict */
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

/** Sync snapshot */
export interface SyncSnapshot {
  version: number;
  timestamp: string;
  deviceId: string;
  checksum: string;
  data: unknown;
  metadata: SyncSnapshotMetadata;
}

/** Sync snapshot metadata */
export interface SyncSnapshotMetadata {
  entityType: string;
  entityId: string;
  parentVersion: number;
  operations: number;
  size: number;
}

/** Offline queue item */
export interface OfflineQueueItem {
  id: string;
  operation: SyncOperation;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: string;
  error?: string;
  status: 'pending' | 'retrying' | 'failed' | 'completed';
}

/** Sync config */
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

/** Sync event */
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

/** Sync state */
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

/** Sync stats */
export interface SyncStats {
  totalOperations: number;
  totalConflicts: number;
  offlineQueueSize: number;
  lastSyncAt?: string;
  currentVersion: number;
  remoteDevices: number;
}

/** WebSocket adapter interface */
export interface WSAdapter {
  send(message: { type: string; payload: unknown }): Promise<void>;
  close(): void;
  onMessage(handler: (message: { type: string; payload: unknown }) => void): void;
  onOpen(handler: () => void): void;
  onClose(handler: () => void): void;
  onError(handler: (error: Error) => void): void;
}

// ==================== Default Config ====================

export const DEFAULT_SYNC_CONFIG: DeviceSyncConfig = {
  enabled: true,
  autoSync: true,
  syncIntervalMs: 30000,
  conflictResolution: 'newest-wins',
  maxOfflineQueueSize: 1000,
  maxRetries: 3,
  retryDelayMs: 5000,
  compressionEnabled: true,
  encryptionEnabled: false,
  syncOnWifiOnly: false,
};

// ==================== Factory Functions ====================

/**
 * Create local device info
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
      storageLimit: 1024 * 1024 * 1024 * 100,
    },
  };
}
