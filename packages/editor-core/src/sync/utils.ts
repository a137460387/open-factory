/**
 * Multi-device sync utility functions
 */

import type { ConflictResolution, SyncChangeSet, SyncOperation, Device } from './types';

/**
 * Calculate checksum
 */
export function calculateChecksum(data: unknown): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Check device capability
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
 * Compare versions
 */
export function compareVersions(v1: number, v2: number): -1 | 0 | 1 {
  if (v1 < v2) return -1;
  if (v1 > v2) return 1;
  return 0;
}

/**
 * Detect operation conflict
 */
export function detectOperationConflict(local: SyncOperation, remote: SyncOperation): boolean {
  if (local.entityId === remote.entityId && local.entityType === remote.entityType) {
    if (local.path === remote.path) {
      return true;
    }
    if (local.type === 'delete' || local.type === 'move' || remote.type === 'delete' || remote.type === 'move') {
      return true;
    }
  }
  return false;
}

/**
 * Merge operations based on conflict resolution strategy
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
      return {
        ...local,
        newValue: new Date(local.timestamp) > new Date(remote.timestamp) ? local.newValue : remote.newValue,
        version: Math.max(local.version, remote.version) + 1,
        checksum: calculateChecksum(
          new Date(local.timestamp) > new Date(remote.timestamp) ? local.newValue : remote.newValue,
        ),
      };
    default:
      return { ...local, version: Math.max(local.version, remote.version) + 1 };
  }
}

/**
 * Compress changeset by merging duplicate operations
 */
export function compressChangeSet(changeSet: SyncChangeSet): SyncChangeSet {
  const mergedOperations = new Map<string, SyncOperation>();

  for (const op of changeSet.operations) {
    const key = `${op.entityType}:${op.entityId}:${op.path}`;
    const existing = mergedOperations.get(key);

    if (existing) {
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
 * Validate changeset integrity
 */
export function validateChangeSet(changeSet: SyncChangeSet): boolean {
  const calculatedChecksum = calculateChecksum(changeSet.operations);
  if (calculatedChecksum !== changeSet.checksum) {
    return false;
  }

  if (changeSet.targetVersion !== changeSet.baseVersion + changeSet.operations.length) {
    return false;
  }

  for (let i = 1; i < changeSet.operations.length; i++) {
    if (new Date(changeSet.operations[i].timestamp) < new Date(changeSet.operations[i - 1].timestamp)) {
      return false;
    }
  }

  return true;
}
