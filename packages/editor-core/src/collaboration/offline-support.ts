/**
 * Offline Editing Support
 *
 * Operation queue with local persistence and sync manager for
 * online/offline transitions, batched sync, and conflict resolution.
 */

import type { CrdtOperation } from './crdt-integration';

// ─── Types ──────────────────────────────────────────────────────────

/** A queued offline operation awaiting sync. */
export interface OfflineOperation {
  id: string;
  operation: CrdtOperation;
  timestamp: number;
  synced: boolean;
}

/** Current synchronisation state. */
export type SyncState = 'synced' | 'syncing' | 'pending' | 'conflict';

/** Queue statistics. */
export interface OfflineQueueStats {
  pendingCount: number;
  syncedCount: number;
  failedCount: number;
  lastSyncAt: number | null;
}

/** Result of a batch sync attempt. */
export interface SyncBatchResult {
  syncedIds: string[];
  conflicts: OfflineOperation[];
  hasErrors: boolean;
}

export type SyncCompleteCallback = (result: SyncBatchResult) => void;
export type ConflictCallback = (operations: OfflineOperation[]) => void;

/** Abstract persistence adapter (IndexedDB, localStorage, etc.). */
export interface OfflineStorageAdapter {
  save(operations: OfflineOperation[]): Promise<void>;
  load(): Promise<OfflineOperation[]>;
  clear(): Promise<void>;
}

/** Abstract network status provider. Swap with a mock for tests. */
export interface NetworkStatusProvider {
  readonly isOnline: boolean;
  onOnline(handler: () => void): void;
  onOffline(handler: () => void): void;
  dispose(): void;
}

/** Conflict resolution strategy for the UI layer. */
export interface ConflictResolutionUI {
  conflictOperations: OfflineOperation[];
  resolveWithLocal(): void;
  resolveWithRemote(): void;
  resolveWithMerge(): void;
}

/** Sync manager configuration. */
export interface OfflineSyncConfig {
  /** Max operations per sync batch. @default 50 */
  batchMaxSize: number;
  /** Auto-sync interval in ms. @default 30000 */
  autoSyncIntervalMs: number;
}

const DEFAULT_SYNC_CONFIG: OfflineSyncConfig = {
  batchMaxSize: 50,
  autoSyncIntervalMs: 30_000,
};

// ─── Adapters ───────────────────────────────────────────────────────

/** In-memory storage. Does not survive page reloads. */
export class MemoryStorageAdapter implements OfflineStorageAdapter {
  private data: OfflineOperation[] = [];

  async save(operations: OfflineOperation[]): Promise<void> {
    this.data = [...operations];
  }

  async load(): Promise<OfflineOperation[]> {
    return [...this.data];
  }

  async clear(): Promise<void> {
    this.data = [];
  }
}

/** Browser-backed network provider using `navigator.onLine` events. */
export class BrowserNetworkProvider implements NetworkStatusProvider {
  private onlineHandlers: Set<() => void> = new Set();
  private offlineHandlers: Set<() => void> = new Set();
  private boundOnline: () => void;
  private boundOffline: () => void;

  constructor() {
    this.boundOnline = () => {
      for (const h of this.onlineHandlers) h();
    };
    this.boundOffline = () => {
      for (const h of this.offlineHandlers) h();
    };
    if (typeof globalThis.addEventListener === 'function') {
      globalThis.addEventListener('online', this.boundOnline);
      globalThis.addEventListener('offline', this.boundOffline);
    }
  }

  get isOnline(): boolean {
    return typeof navigator !== 'undefined' && 'onLine' in navigator
      ? navigator.onLine
      : true;
  }

  onOnline(handler: () => void): void {
    this.onlineHandlers.add(handler);
  }

  onOffline(handler: () => void): void {
    this.offlineHandlers.add(handler);
  }

  dispose(): void {
    if (typeof globalThis.removeEventListener === 'function') {
      globalThis.removeEventListener('online', this.boundOnline);
      globalThis.removeEventListener('offline', this.boundOffline);
    }
    this.onlineHandlers.clear();
    this.offlineHandlers.clear();
  }
}

// ─── Utilities ──────────────────────────────────────────────────────

function generateOfflineId(): string {
  return `off-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ─── OfflineOperationQueue ──────────────────────────────────────────

/**
 * Persistent queue of offline operations.
 *
 * Operations are enqueued while offline and removed after successful
 * sync. Delegates persistence to an `OfflineStorageAdapter`.
 */
export class OfflineOperationQueue {
  private operations: OfflineOperation[] = [];
  private storage: OfflineStorageAdapter;
  private loaded = false;

  constructor(storage?: OfflineStorageAdapter) {
    this.storage = storage ?? new MemoryStorageAdapter();
  }

  /** Enqueue a CRDT operation for later sync. */
  async enqueue(operation: CrdtOperation): Promise<OfflineOperation> {
    await this.ensureLoaded();
    const entry: OfflineOperation = {
      id: generateOfflineId(),
      operation,
      timestamp: Date.now(),
      synced: false,
    };
    this.operations = [...this.operations, entry];
    await this.persist();
    return entry;
  }

  /** Remove and return the oldest unsynced operation. */
  async dequeue(): Promise<OfflineOperation | undefined> {
    await this.ensureLoaded();
    const idx = this.operations.findIndex((op) => !op.synced);
    if (idx === -1) return undefined;
    const [removed] = this.operations.splice(idx, 1);
    this.operations = [...this.operations];
    await this.persist();
    return removed;
  }

  /** Mark an operation as synced. Returns true if found. */
  async markSynced(id: string): Promise<boolean> {
    await this.ensureLoaded();
    const idx = this.operations.findIndex((op) => op.id === id);
    if (idx === -1) return false;
    this.operations = this.operations.map((op, i) =>
      i === idx ? { ...op, synced: true } : op,
    );
    await this.persist();
    return true;
  }

  /** Return all unsynced operations in FIFO order. */
  async getPending(): Promise<OfflineOperation[]> {
    await this.ensureLoaded();
    return this.operations.filter((op) => !op.synced);
  }

  /** Return queue statistics. */
  async getStats(): Promise<OfflineQueueStats> {
    await this.ensureLoaded();
    const pendingCount = this.operations.filter((op) => !op.synced).length;
    const syncedCount = this.operations.filter((op) => op.synced).length;
    const lastSynced = this.operations
      .filter((op) => op.synced)
      .reduce<number | null>(
        (max, op) => (max === null || op.timestamp > max ? op.timestamp : max),
        null,
      );
    return { pendingCount, syncedCount, failedCount: 0, lastSyncAt: lastSynced };
  }

  /** Remove all operations and clear persistent storage. */
  async clear(): Promise<void> {
    this.operations = [];
    await this.storage.clear();
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.loaded) {
      this.operations = await this.storage.load();
      this.loaded = true;
    }
  }

  private async persist(): Promise<void> {
    await this.storage.save(this.operations);
  }
}

// ─── OfflineSyncManager ─────────────────────────────────────────────

/**
 * Minimal transport interface for sending CRDT operations.
 * Decouples from the full `CollabWSTransport` for easier testing.
 */
export interface CollabWSTransportLike {
  sendCrdtOperation(operation: CrdtOperation): void;
}

/**
 * Manages online/offline transitions and synchronises the offline
 * queue with the server in batches of up to `batchMaxSize`.
 */
export class OfflineSyncManager {
  private queue: OfflineOperationQueue;
  private network: NetworkStatusProvider;
  private config: OfflineSyncConfig;
  private offline = false;
  private syncState: SyncState = 'synced';
  private syncCompleteCallbacks: Set<SyncCompleteCallback> = new Set();
  private conflictCallbacks: Set<ConflictCallback> = new Set();
  private autoSyncTimer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;

  constructor(
    private transport: CollabWSTransportLike,
    queue?: OfflineOperationQueue,
    network?: NetworkStatusProvider,
    config?: Partial<OfflineSyncConfig>,
  ) {
    this.queue = queue ?? new OfflineOperationQueue();
    this.network = network ?? new BrowserNetworkProvider();
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };

    this.network.onOnline(() => this.handleOnline());
    this.network.onOffline(() => this.handleOffline());

    if (!this.network.isOnline) {
      this.offline = true;
      this.syncState = 'pending';
    }

    this.startAutoSync();
  }

  /** Enter offline mode. Operations will be queued locally. */
  goOffline(): void {
    if (this.disposed) return;
    this.offline = true;
    this.syncState = 'pending';
  }

  /** Resume online mode and trigger an immediate sync. */
  async goOnline(): Promise<void> {
    if (this.disposed) return;
    this.offline = false;
    await this.sync();
  }

  /**
   * Execute a sync cycle: batch-send pending operations to the server.
   * Each batch contains at most `batchMaxSize` operations.
   */
  async sync(): Promise<SyncBatchResult> {
    if (this.disposed || this.offline) {
      return { syncedIds: [], conflicts: [], hasErrors: false };
    }

    this.syncState = 'syncing';
    const pending = await this.queue.getPending();
    if (pending.length === 0) {
      this.syncState = 'synced';
      return { syncedIds: [], conflicts: [], hasErrors: false };
    }

    const allSyncedIds: string[] = [];
    const allConflicts: OfflineOperation[] = [];
    let hasErrors = false;

    for (let i = 0; i < pending.length; i += this.config.batchMaxSize) {
      const batch = pending.slice(i, i + this.config.batchMaxSize);
      const result = await this.sendBatch(batch);
      for (const id of result.syncedIds) {
        await this.queue.markSynced(id);
      }
      allSyncedIds.push(...result.syncedIds);
      allConflicts.push(...result.conflicts);
      if (result.hasErrors) hasErrors = true;
    }

    const batchResult: SyncBatchResult = {
      syncedIds: allSyncedIds,
      conflicts: allConflicts,
      hasErrors,
    };

    if (allConflicts.length > 0) {
      this.syncState = 'conflict';
      this.emitConflict(allConflicts);
    } else if (hasErrors) {
      this.syncState = 'pending';
    } else {
      this.syncState = 'synced';
    }

    this.emitSyncComplete(batchResult);
    return batchResult;
  }

  /** Whether the manager is in offline mode. */
  isOffline(): boolean {
    return this.offline;
  }

  /** Current synchronisation state. */
  getSyncState(): SyncState {
    return this.syncState;
  }

  /** Register a sync-complete callback. Returns unsubscribe fn. */
  onSyncComplete(callback: SyncCompleteCallback): () => void {
    this.syncCompleteCallbacks.add(callback);
    return () => this.syncCompleteCallbacks.delete(callback);
  }

  /** Register a conflict callback. Returns unsubscribe fn. */
  onConflict(callback: ConflictCallback): () => void {
    this.conflictCallbacks.add(callback);
    return () => this.conflictCallbacks.delete(callback);
  }

  /** Clean up timers, listeners, and internal state. */
  dispose(): void {
    this.disposed = true;
    this.stopAutoSync();
    this.network.dispose();
    this.syncCompleteCallbacks.clear();
    this.conflictCallbacks.clear();
  }

  // ─── Internals ──────────────────────────────────────────────────

  private handleOnline(): void {
    if (!this.disposed && this.offline) void this.goOnline();
  }

  private handleOffline(): void {
    if (!this.disposed) this.goOffline();
  }

  private startAutoSync(): void {
    this.stopAutoSync();
    this.autoSyncTimer = setInterval(() => {
      if (!this.offline && !this.disposed) void this.sync();
    }, this.config.autoSyncIntervalMs);
  }

  private stopAutoSync(): void {
    if (this.autoSyncTimer !== null) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
  }

  private async sendBatch(batch: OfflineOperation[]): Promise<SyncBatchResult> {
    const syncedIds: string[] = [];
    const conflicts: OfflineOperation[] = [];
    let hasErrors = false;

    for (const op of batch) {
      try {
        const accepted = this.sendOne(op.operation);
        if (accepted) syncedIds.push(op.id);
        else conflicts.push(op);
      } catch {
        hasErrors = true;
      }
    }

    return { syncedIds, conflicts, hasErrors };
  }

  private sendOne(operation: CrdtOperation): boolean {
    if (operation.type === 'awareness') return true;
    try {
      this.transport.sendCrdtOperation(operation);
      return true;
    } catch {
      return false;
    }
  }

  private emitSyncComplete(result: SyncBatchResult): void {
    for (const cb of this.syncCompleteCallbacks) {
      try { cb(result); } catch { /* ignore */ }
    }
  }

  private emitConflict(operations: OfflineOperation[]): void {
    for (const cb of this.conflictCallbacks) {
      try { cb(operations); } catch { /* ignore */ }
    }
  }
}

// ─── Factory ────────────────────────────────────────────────────────

/**
 * Create a fully wired offline support stack with sensible defaults.
 *
 * @param transport - Transport for sending operations to the server.
 * @param options - Optional overrides for storage, network, and config.
 */
export function createOfflineSupport(
  transport: CollabWSTransportLike,
  options?: {
    storage?: OfflineStorageAdapter;
    network?: NetworkStatusProvider;
    config?: Partial<OfflineSyncConfig>;
  },
): {
  queue: OfflineOperationQueue;
  manager: OfflineSyncManager;
  dispose: () => void;
} {
  const queue = new OfflineOperationQueue(options?.storage);
  const manager = new OfflineSyncManager(
    transport,
    queue,
    options?.network,
    options?.config,
  );
  return { queue, manager, dispose: () => manager.dispose() };
}
