/**
 * Conflict Resolution Strategy Module
 *
 * Provides vector clock comparison, conflict detection, and resolution
 * strategies for collaborative timeline editing.
 *
 * Design: pure functions for stateless operations + ConflictResolver class
 * for stateful tracking and batch resolution.
 */

import type {
  SharedTrack,
  SharedClip,
  SharedTransition,
  CrdtOperation,
} from './crdt-integration';

// ─── Types ─────────────────────────────────────────────────────────

/** Vector clock: maps each userId to its logical timestamp. */
export type VectorClock = Map<string, number>;

/** Timeline operation targeting a track, clip, or transition. */
export interface TimelineOperation {
  type: 'add' | 'update' | 'delete' | 'move';
  target: 'track' | 'clip' | 'transition';
  data: Partial<SharedTrack> | Partial<SharedClip> | Partial<SharedTransition> & { id: string };
  timestamp: number;
  userId: string;
  vectorClock: VectorClock;
}

/** Comparison result between two vector clocks. */
export type ClockOrdering = 'before' | 'after' | 'concurrent';

/** Resolution strategy for a conflict. */
export type ConflictResolution =
  | 'last-writer-wins'
  | 'first-writer-wins'
  | 'merge'
  | 'manual';

/** A recorded conflict with its resolution. */
export interface ConflictRecord {
  operations: TimelineOperation[];
  resolution: ConflictResolution;
  resolvedBy: string;
}

// ─── Vector Clock Utilities ────────────────────────────────────────

/**
 * Create an empty vector clock.
 * @returns A new empty VectorClock instance.
 */
export function createVectorClock(): VectorClock {
  return new Map();
}

/**
 * Increment the logical timestamp for a given userId.
 * Returns a new Map (immutable).
 * @param clock - The current vector clock.
 * @param userId - The user whose timestamp to increment.
 * @returns A new VectorClock with the incremented entry.
 */
export function incrementClock(clock: VectorClock, userId: string): VectorClock {
  const next = new Map(clock);
  next.set(userId, (clock.get(userId) ?? 0) + 1);
  return next;
}

/**
 * Compare two vector clocks and determine their causal ordering.
 *
 * - 'before': a happened before b (all a <= b, at least one strict)
 * - 'after': a happened after b (all a >= b, at least one strict)
 * - 'concurrent': a and b are causally independent
 *
 * @param a - First vector clock.
 * @param b - Second vector clock.
 * @returns The causal ordering between a and b.
 */
export function compareVectorClocks(a: VectorClock, b: VectorClock): ClockOrdering {
  const allKeys = new Set([...a.keys(), ...b.keys()]);
  let aHasStrict = false;
  let bHasStrict = false;

  for (const key of allKeys) {
    const va = a.get(key) ?? 0;
    const vb = b.get(key) ?? 0;
    if (va < vb) bHasStrict = true;
    if (va > vb) aHasStrict = true;
    if (aHasStrict && bHasStrict) return 'concurrent';
  }

  if (aHasStrict) return 'after';
  if (bHasStrict) return 'before';
  return 'after'; // equal clocks -> treat as 'after' (same origin)
}

// ─── Conflict Detection ────────────────────────────────────────────

/**
 * Check whether two operations target the same entity.
 * @param opA - First operation.
 * @param opB - Second operation.
 * @returns True if both operations affect the same target entity.
 */
function isSameTarget(opA: TimelineOperation, opB: TimelineOperation): boolean {
  if (opA.target !== opB.target) return false;
  return (opA.data as { id: string }).id === (opB.data as { id: string }).id;
}

/**
 * Detect whether two operations conflict.
 *
 * Two operations conflict when:
 * 1. They are causally concurrent (neither happened-before the other), AND
 * 2. They target the same entity, AND
 * 3. At least one is a mutating operation (update/delete/move on the same entity),
 *    or both are add operations on the same id (duplicate add).
 *
 * @param opA - First operation.
 * @param opB - Second operation.
 * @returns True if the two operations conflict.
 */
export function detectConflict(opA: TimelineOperation, opB: TimelineOperation): boolean {
  const ordering = compareVectorClocks(opA.vectorClock, opB.vectorClock);
  if (ordering !== 'concurrent') return false;
  if (!isSameTarget(opA, opB)) return false;

  // Concurrent ops on the same target = conflict
  // Exception: two adds with different ids never conflict (handled by isSameTarget)
  if (opA.type === 'add' && opB.type === 'add') {
    // Duplicate add of same id is a conflict
    return (opA.data as { id: string }).id === (opB.data as { id: string }).id;
  }

  return true;
}

// ─── Conflict Resolution ───────────────────────────────────────────

/**
 * Sort operations by physical timestamp ascending.
 * @param ops - Operations to sort.
 * @returns A new sorted array (does not mutate input).
 */
function sortByTimestamp(ops: TimelineOperation[]): TimelineOperation[] {
  return [...ops].sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Resolve a set of conflicting operations using the given strategy.
 *
 * Strategy behaviors:
 * - **last-writer-wins**: The operation with the latest physical timestamp wins.
 * - **first-writer-wins**: The operation with the earliest physical timestamp wins.
 * - **merge**: For add operations (set semantics), all are kept (add-wins).
 *   For scalar updates, merges properties from all operations with last-writer-wins
 *   for overlapping keys.
 * - **manual**: Returns all operations unchanged, deferring resolution to the user.
 *
 * @param operations - The conflicting operations (must not be empty).
 * @param strategy - The resolution strategy to apply.
 * @returns The winning operation(s) after resolution.
 */
export function resolveConflict(
  operations: TimelineOperation[],
  strategy: ConflictResolution,
): TimelineOperation[] {
  if (operations.length === 0) return [];
  if (operations.length === 1) return operations;

  switch (strategy) {
    case 'last-writer-wins': {
      const sorted = sortByTimestamp(operations);
      return [sorted[sorted.length - 1]];
    }

    case 'first-writer-wins': {
      const sorted = sortByTimestamp(operations);
      return [sorted[0]];
    }

    case 'merge': {
      return mergeOperations(operations);
    }

    case 'manual':
      return operations;
  }
}

/**
 * Merge multiple operations on the same target.
 *
 * - Add operations: all are kept (add-wins / set union).
 * - Update operations: properties are merged, with later timestamps overriding
 *   earlier ones for scalar fields.
 * - Delete operations: the latest delete wins.
 * - Mixed types: delete takes precedence over update; add takes precedence over delete
 *   if the add has a later timestamp.
 *
 * @param operations - Operations to merge (same target assumed).
 * @returns Merged operation(s).
 */
function mergeOperations(operations: TimelineOperation[]): TimelineOperation[] {
  const sorted = sortByTimestamp(operations);

  const hasDelete = sorted.some((op) => op.type === 'delete');
  const hasAdd = sorted.some((op) => op.type === 'add');

  // Pure add-wins: if any add exists, keep all adds
  if (sorted.every((op) => op.type === 'add')) {
    return sorted;
  }

  // Mixed: delete vs others
  if (hasDelete) {
    const latestDelete = [...sorted].reverse().find((op) => op.type === 'delete');
    const latestNonDelete = [...sorted].reverse().find((op) => op.type !== 'delete');

    if (!latestDelete) return sorted;
    if (!latestNonDelete) return [latestDelete];

    // Later action wins
    return latestDelete.timestamp >= latestNonDelete.timestamp
      ? [latestDelete]
      : [latestNonDelete];
  }

  // Update-only merge: combine scalar properties, latest wins per key
  if (sorted.every((op) => op.type === 'update' || op.type === 'move')) {
    let merged: Record<string, unknown> = {};
    for (const op of sorted) {
      merged = { ...merged, ...op.data };
    }
    return [{ ...sorted[sorted.length - 1], data: merged as TimelineOperation['data'] }];
  }

  // Fallback: last-writer-wins
  return [sorted[sorted.length - 1]];
}

// ─── Batch Processing ──────────────────────────────────────────────

/**
 * Batch operations into time-windowed groups using a sliding window.
 *
 * Operations whose timestamps fall within `windowMs` of the first operation
 * in the current batch are grouped together. When a gap larger than `windowMs`
 * is encountered, the current batch is closed and a new one starts.
 *
 * @param operations - Operations to batch (should be pre-sorted by timestamp).
 * @param windowMs - The time window in milliseconds.
 * @returns An array of operation batches.
 */
export function batchOperations(
  operations: TimelineOperation[],
  windowMs: number,
): TimelineOperation[][] {
  if (operations.length === 0) return [];

  const sorted = sortByTimestamp(operations);
  const batches: TimelineOperation[][] = [];
  let currentBatch: TimelineOperation[] = [sorted[0]];
  let windowStart = sorted[0].timestamp;

  for (let i = 1; i < sorted.length; i++) {
    const op = sorted[i];
    if (op.timestamp - windowStart <= windowMs) {
      currentBatch.push(op);
    } else {
      batches.push(currentBatch);
      currentBatch = [op];
      windowStart = op.timestamp;
    }
  }

  batches.push(currentBatch);
  return batches;
}

// ─── Conflict Resolver Class ───────────────────────────────────────

/**
 * Stateful conflict resolver that tracks operations, detects conflicts,
 * and maintains a resolution history.
 *
 * Usage:
 * ```ts
 * const resolver = new ConflictResolver('last-writer-wins');
 * resolver.track(opA);
 * resolver.track(opB);
 * const resolved = resolver.resolve();
 * ```
 */
export class ConflictResolver {
  private pendingOps: TimelineOperation[] = [];
  private history: ConflictRecord[] = [];
  private readonly defaultStrategy: ConflictResolution;

  constructor(defaultStrategy: ConflictResolution = 'last-writer-wins') {
    this.defaultStrategy = defaultStrategy;
  }

  /**
   * Track a new operation. Queues it for conflict detection on the next resolve() call.
   * @param operation - The timeline operation to track.
   */
  track(operation: TimelineOperation): void {
    this.pendingOps.push(operation);
  }

  /**
   * Detect and resolve all pending conflicts.
   *
   * Groups pending operations by target entity, detects conflicts within each group,
   * resolves them using the configured strategy, and records the results in history.
   *
   * @param strategy - Optional override for the default resolution strategy.
   * @returns All resolved operations (winners from each conflict group).
   */
  resolve(strategy?: ConflictResolution): TimelineOperation[] {
    const activeStrategy = strategy ?? this.defaultStrategy;
    const groups = groupByTarget(this.pendingOps);
    const resolvedOps: TimelineOperation[] = [];

    for (const groupOps of groups.values()) {
      if (groupOps.length === 1) {
        resolvedOps.push(groupOps[0]);
        continue;
      }

      // Find conflicting pairs within the group
      const conflicting = findConflictingSet(groupOps);
      if (conflicting.length <= 1) {
        resolvedOps.push(...conflicting);
        continue;
      }

      const winners = resolveConflict(conflicting, activeStrategy);
      this.history.push({
        operations: conflicting,
        resolution: activeStrategy,
        resolvedBy: winners.length === 1 ? winners[0].userId : 'merge',
      });
      resolvedOps.push(...winners);
    }

    this.pendingOps = [];
    return resolvedOps;
  }

  /**
   * Get the full conflict resolution history.
   * @returns A readonly array of conflict records.
   */
  getHistory(): readonly ConflictRecord[] {
    return this.history;
  }

  /**
   * Get the number of pending operations awaiting resolution.
   * @returns Count of pending operations.
   */
  getPendingCount(): number {
    return this.pendingOps.length;
  }

  /**
   * Clear all pending operations and resolution history.
   */
  reset(): void {
    this.pendingOps = [];
    this.history = [];
  }
}

// ─── Internal Helpers ──────────────────────────────────────────────

/**
 * Group operations by their target entity id.
 * @param ops - Operations to group.
 * @returns Map from entity id to its operations.
 */
function groupByTarget(ops: TimelineOperation[]): Map<string, TimelineOperation[]> {
  const groups = new Map<string, TimelineOperation[]>();
  for (const op of ops) {
    const entityId = (op.data as { id: string }).id;
    const existing = groups.get(entityId);
    if (existing) {
      existing.push(op);
    } else {
      groups.set(entityId, [op]);
    }
  }
  return groups;
}

/**
 * From a group of operations on the same target, find all that participate
 * in at least one conflict. If no conflicts exist, returns the full group.
 *
 * @param ops - Operations on the same target.
 * @returns The conflicting subset, or all ops if no conflicts detected.
 */
function findConflictingSet(ops: TimelineOperation[]): TimelineOperation[] {
  const conflicting = new Set<TimelineOperation>();

  for (let i = 0; i < ops.length; i++) {
    for (let j = i + 1; j < ops.length; j++) {
      if (detectConflict(ops[i], ops[j])) {
        conflicting.add(ops[i]);
        conflicting.add(ops[j]);
      }
    }
  }

  // If no conflicts found, return all ops (they may still need ordering)
  return conflicting.size > 0 ? [...conflicting] : ops;
}
