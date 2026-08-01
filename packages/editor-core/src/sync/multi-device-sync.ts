/**
 * Multi-device sync module
 * Provides project state synchronization across devices (WebSocket + differential sync)
 * Supports offline editing and automatic sync
 * Implements sync conflict detection and resolution
 */

// Re-export all types
export type {
  DeviceType,
  DeviceStatus,
  DeviceSyncStatus,
  ConflictResolution,
  SyncOperationType,
  Device,
  DeviceMetadata,
  DeviceCapabilities,
  SyncOperation,
  SyncChangeSet,
  DeviceSyncConflict,
  SyncSnapshot,
  SyncSnapshotMetadata,
  OfflineQueueItem,
  DeviceSyncConfig,
  DeviceSyncEvent,
  SyncState,
  SyncStats,
  WSAdapter,
} from './types';

// Re-export constants and factory functions
export { DEFAULT_SYNC_CONFIG, createLocalDevice } from './types';

// Re-export utility functions
export {
  calculateChecksum,
  canDevicePerformAction,
  compareVersions,
  detectOperationConflict,
  mergeOperations,
  compressChangeSet,
  validateChangeSet,
} from './utils';

// Re-export sync manager
export { MultiDeviceSyncManager } from './sync-manager';

// Re-export WebSocket adapters
export { BrowserWSAdapter, MockWSAdapter } from './ws-adapter';

import { MultiDeviceSyncManager } from './sync-manager';
import type { Device, DeviceSyncConfig, WSAdapter } from './types';

/**
 * Create sync manager
 */
export function createSyncManager(
  localDevice: Device,
  config?: Partial<DeviceSyncConfig>,
  wsAdapter?: WSAdapter,
): MultiDeviceSyncManager {
  return new MultiDeviceSyncManager(localDevice, config, wsAdapter);
}

/**
 * Serialize sync state
 */
export function serializeSyncState(state: import('./types').SyncState): string {
  return JSON.stringify(state);
}

/**
 * Parse sync state
 */
export function parseSyncState(json: string): import('./types').SyncState | null {
  try {
    return JSON.parse(json) as import('./types').SyncState;
  } catch {
    return null;
  }
}
