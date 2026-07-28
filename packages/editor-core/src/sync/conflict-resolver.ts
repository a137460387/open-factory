/**
 * Conflict resolution logic for multi-device sync
 */

import { createId } from '../model';
import type {
  ConflictResolution,
  DeviceSyncConflict,
  SyncChangeSet,
  SyncOperation,
} from './types';
import { detectOperationConflict, mergeOperations } from './utils';

/**
 * Detect conflicts between local unsynced operations and a remote changeset
 */
export function detectConflicts(
  localOperations: SyncOperation[],
  remoteChangeSet: SyncChangeSet,
): DeviceSyncConflict[] {
  const conflicts: DeviceSyncConflict[] = [];

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

  return conflicts;
}

/**
 * Resolve a single conflict with the given strategy
 * Returns the merged operation or null if manual resolution is required
 */
export function resolveOneConflict(
  conflict: DeviceSyncConflict,
  strategy: ConflictResolution,
  resolvedBy: string,
): SyncOperation | null {
  if (strategy === 'manual') {
    return null;
  }

  conflict.resolution = strategy;
  conflict.resolvedBy = resolvedBy;
  conflict.resolvedAt = new Date().toISOString();

  return mergeOperations(conflict.localOperation, conflict.remoteOperation, strategy);
}

/**
 * Get unsynced operations from change history
 */
export function getUnsyncedOperations(
  changeHistory: SyncChangeSet[],
  localDeviceId: string,
): SyncOperation[] {
  const lastSyncVersion = getLastSyncedVersion(changeHistory, localDeviceId);
  const operations: SyncOperation[] = [];

  for (const changeSet of changeHistory) {
    if (changeSet.baseVersion >= lastSyncVersion) {
      operations.push(...changeSet.operations);
    }
  }

  return operations;
}

/**
 * Get the last synced version from change history
 */
export function getLastSyncedVersion(
  changeHistory: SyncChangeSet[],
  localDeviceId: string,
): number {
  if (changeHistory.length === 0) {
    return 0;
  }

  const lastSynced = changeHistory
    .filter((cs) => cs.deviceId === localDeviceId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

  return lastSynced?.baseVersion ?? 0;
}
