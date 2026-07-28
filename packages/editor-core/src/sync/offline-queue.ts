/**
 * Offline queue management for multi-device sync
 */

import { createId } from '../model';
import type { DeviceSyncConfig, OfflineQueueItem, SyncOperation } from './types';

/**
 * Create offline queue items from operations
 */
export function createOfflineQueueItems(
  operations: SyncOperation[],
  config: DeviceSyncConfig,
): OfflineQueueItem[] {
  const now = new Date().toISOString();
  return operations.map((op) => ({
    id: createId('oq'),
    operation: op,
    retryCount: 0,
    maxRetries: config.maxRetries,
    nextRetryAt: now,
    status: 'pending' as const,
  }));
}

/**
 * Enforce offline queue size limit
 */
export function enforceQueueLimit(
  queue: OfflineQueueItem[],
  maxQueueSize: number,
  newItems: OfflineQueueItem[],
): OfflineQueueItem[] {
  const result = [...queue, ...newItems];
  while (result.length > maxQueueSize) {
    result.shift();
  }
  return result;
}

/**
 * Get pending items that are ready for retry
 */
export function getPendingItems(queue: OfflineQueueItem[]): OfflineQueueItem[] {
  const now = new Date();
  return queue.filter(
    (item) => item.status === 'pending' && new Date(item.nextRetryAt) <= now,
  );
}

/**
 * Mark an item as completed
 */
export function markCompleted(item: OfflineQueueItem): void {
  item.status = 'completed';
}

/**
 * Mark an item with retry info after failure
 */
export function markRetry(
  item: OfflineQueueItem,
  error: unknown,
  retryDelayMs: number,
): void {
  item.retryCount++;
  item.error = error instanceof Error ? error.message : 'Sync failed';

  if (item.retryCount >= item.maxRetries) {
    item.status = 'failed';
  } else {
    item.status = 'retrying';
    item.nextRetryAt = new Date(
      Date.now() + retryDelayMs * Math.pow(2, item.retryCount),
    ).toISOString();
  }
}

/**
 * Remove completed items from queue
 */
export function removeCompleted(queue: OfflineQueueItem[]): OfflineQueueItem[] {
  return queue.filter((item) => item.status !== 'completed');
}
