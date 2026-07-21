/**
 * Offline Editing Support
 *
 * Provides an operation queue with local persistence and a sync manager
 * that handles online/offline transitions, batched sync, and conflict
 * resolution for the collaborative video editor.
 */

import type { CrdtOperation } from './crdt-integration';

// ─── Types ──────────────────────────────────────────────────────────

/** A queued offline operation awaiting sync. */
export interface OfflineOperation {
  /** Unique identifier for this queued operation. */
  id: string;
  /** The CRDT operation to be synced. */
  operation: CrdtOperation;
  /** Timestamp when the operation was enqueued. */
  timestamp: number;
  /** Whether this operation has been successfully synced to the server. */
  synced: boolean;
}

/** Current synchronisation state of the offline manager. */
export type SyncState = 'synced' | 'syncing' | 'pending' | 'conflict';

/** Statistics about the offline operation queue. */
export interface OfflineQueueStats {
  /** Number of operations waiting to be synced. */
  pendingCount: number;
  /** Number of operations that have been synced. */
  syncedCount: number;
  /** Number of operations that failed to sync. */
  failedCount: number;
  /** Timestamp of the last successful sync, or null if never synced. */
  lastSyncAt: number | null;
}

/** Result of a batch sync attempt. */
export interface SyncBatchResult {
  /** IDs of operations that were successfully synced. */
  syncedIds: string[];
  /** Operations that conflicted with remote state. */
  conflicts: OfflineOperation[];
  /** Whether any errors occurred during sync. */
  hasErrors: boolean;
}

/** Callback for sync completion events. */
export type SyncCompleteCallback = (result: SyncBatchResult) => void;

/** Callback for conflict detection events. */
export type ConflictCallback = (operations: OfflineOperation[]) => void;

/**
 * Abstract persistence adapter for the offline queue.
 *
 * Implementations can use IndexedDB, localStorage, or any other
 * storage backend. The default in-memory adapter is suitable for tests.
 */
export interface OfflineStorageAdapter {
  /** Persist all operations, replacing existing data. */
  save(operations: OfflineOperation[]): Promise<void>;
  /** Load all persisted operations. */
  load(): Promise<OfflineOperation[]>;
  /** Remove all persisted data. */
  clear(): Promise<void>;
}

/**
 * Abstract network status provider.
 *
 * Allows swapping the real browser `navigator.onLine` / event listeners
 * with a mock for testing.
 */
export interface NetworkStatusProvider {
  /** Whether the network is currently available. */
  readonly isOnline: boolean;
  /** Register a callback for online events. */
  onOnline(handler: () => void): void;
  /** Register a callback for offline events. */
  onOffline(handler: () => void): void;
  /** Remove all registered listeners. */
  dispose(): void;
}

/** Conflict resolution strategy for the UI layer. */
export interface ConflictResolutionUI {
  /** Operations currently in conflict. */
  conflictOperations: OfflineOperation[];
  /** Accept the local version and overwrite remote. */
  resolveWithLocal(): void;
  /** Accept the remote version and discard local. */
  resolveWithRemote(): void;
  /** Merge local and remote into a combined result. */
  resolveWithMerge(): void;
}

/** Configuration for the offline sync manager. */
export interface OfflineSyncConfig {
  /** Maximum operations per sync batch. @default 50 */
  batchMaxSize: number;
  /** Interval in ms between automatic sync attempts. @default 30000 */
  autoSyncIntervalMs: number;
}

const DEFAULT_SYNC_CONFIG: OfflineSyncConfig = {
  batchMaxSize: 50,
  autoSyncIntervalMs: 30_000,
};

// ─── In-Memory Storage Adapter (default / test) ─────────────────────

/**
 * In-memory storage adapter. Data does not survive page reloads.
 * Suitable for unit tests and environments without IndexedDB.
 */
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

// ─── Browser Network Status Provider ────────────────────────────────

/**
 * Network status provider backed by `navigator.onLine` and the
 * browser `online`/`offline` events.
 */
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
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      return navigator.onLine;
    }
    return true;
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

// ─── Mock Network Provider (test) ───────────────────────────────────

/**
 * Controllable network provider for testing.
 * Call `simulateOnline()` / `simulateOffline()` to drive state.
 */
export class MockNetworkProvider implements NetworkStatusProvider {
  private _isOnline = true;
  private onlineHandlers: Set<() => void> = new Set();
  private offlineHandlers: Set<() => void> = new Set();

  get isOnline(): boolean {
    return this._isOnline;
  }

  onOnline(handler: () => void): void {
    this.onlineHandlers.add(handler);
  }

  onOffline(handler: () => void): void {
    this.offlineHandlers.add(handler);
  }

  simulateOnline(): void {
    this._isOnline = true;
    for (const h of this.onlineHandlers) h();
  }

  simulateOffline(): void {
    this._isOnline = false;
    for (const h of this.offlineHandlers) h();
  }

  dispose(): void {
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
 * Operations are enqueued while offline and dequeued after successful
 * sync. The queue delegates persistence to an `OfflineStorageAdapter`.
 */
export class OfflineOperationQueue {
  private operations: OfflineOperation[] = [];
  private storage: OfflineStorageAdapter;
  private loaded = false;

  constructor(storage?: OfflineStorageAdapter) {
    this.storage = storage ?? new MemoryStorageAdapter();
  }

  /**
   * Enqueue a CRDT operation for later sync.
   * @param operation - The operation to enqueue.
   * @returns The generated `OfflineOperation` with id and timestamp.
   */
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

  /**
   * Remove and return the oldest pending (unsynced) operation.
   * @returns The dequeued operation, or `undefined` if the queue is empty.
   */
  async dequeue(): Promise<OfflineOperation | undefined> {
    await this.ensureLoaded();
    const idx = this.operations.findIndex((op) => !op.synced);
    if (idx === -1) return undefined;
    const [removed] = this.operations.splice(idx, 1);
    this.operations = [...this.operations];
    await this.persist();
    return removed;
  }

  /**
   * Mark a specific operation as synced.
   * @param id - The operation id to mark.
   * @returns `true` if the operation was found and updated.
   */
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

  /**
   * Return all pending (unsynced) operations in FIFO order.
   */
  async getPending(): Promise<OfflineOperation[]> {
    await this.ensureLoaded();
    return this.operations.filter((op) => !op.synced);
  }

  /**
   * Return queue statistics.
   */
  async getStats(): Promise<OfflineQueueStats> {
    await this.ensureLoaded();
    const pendingCount = this.operations.filter((op) => !op.synced).length;
    const syncedCount = this.operations.filter((op) => op.synced).length;
    const lastSynced = this.operations
      .filter((op) => op.synced)
      .reduce<number | null>((max, op) => (max === null || op.timestamp > max ? op.timestamp : max), null);
    return {
      pendingCount,
      syncedCount,
      failedCount: 0,
      lastSyncAt: lastSynced,
    };
  }

  /**
   * Remove all operations from the queue and clear persistent storage.
   */
  async clear(): Promise<void> {
    this.operations = [];
    await this.storage.clear();
  }

  /** @internal Ensure persisted data has been loaded. */
  private async ensureLoaded(): Promise<void> {
    if (!this.loaded) {
      this.operations = await this.storage.load();
      this.loaded = true;
    }
  }

  /** @internal Persist current state to storage. */
  private async persist(): Promise<void> {
    await this.storage.save(this.operations);
  }
}

// ─── OfflineSyncManager ─────────────────────────────────────────────

/**
 * Manages online/offline transitions and synchronises the offline
 * operation queue with the server in configurable batches.
 *
 * Uses a `NetworkStatusProvider` for browser connectivity detection
 * and delegates queue persistence to `OfflineOperationQueue`.
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

  /**
   * Enter offline mode. Operations will be queued locally.
   */
  goOffline(): void {
    if (this.disposed) return;
    this.offline = true;
    this.syncState = 'pending';
  }

  /**
   * Resume online mode and trigger an immediate sync attempt.
   */
  async goOnline(): Promise<void> {
    if (this.disposed) return;
    this.offline = false;
    await this.sync();
  }

  /**
   * Execute a sync cycle: send pending operations to the server
   * in batches of up to `batchMaxSize`.
   *
   * @returns The result of the sync attempt.
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

  /**
   * Whether the manager is currently in offline mode.
   */
  isOffline(): boolean {
    return this.offline;
  }

  /**
   * Get the current synchronisation state.
   */
  getSyncState(): SyncState {
    return this.syncState;
  }

  /**
   * Register a callback invoked after each sync cycle completes.
   * @returns Unsubscribe function.
   */
  onSyncComplete(callback: SyncCompleteCallback): () => void {
    this.syncCompleteCallbacks.add(callback);
    return () => this.syncCompleteCallbacks.delete(callback);
  }

  /**
   * Register a callback invoked when conflicts are detected.
   * @returns Unsubscribe function.
   */
  onConflict(callback: ConflictCallback): () => void {
    this.conflictCallbacks.add(callback);
    return () => this.conflictCallbacks.delete(callback);
  }

  /**
   * Clean up all resources: timers, network listeners, queue.
   */
  dispose(): void {
    this.disposed = true;
    this.stopAutoSync();
    this.network.dispose();
    this.syncCompleteCallbacks.clear();
    this.conflictCallbacks.clear();
  }

  // ─── Internals ──────────────────────────────────────────────────

  private handleOnline(): void {
    if (!this.disposed && this.offline) {
      void this.goOnline();
    }
  }

  private handleOffline(): void {
    if (!this.disposed) {
      this.goOffline();
    }
  }

  private startAutoSync(): void {
    this.stopAutoSync();
    this.autoSyncTimer = setInterval(() => {
      if (!this.offline && !this.disposed) {
        void this.sync();
      }
    }, this.config.autoSyncIntervalMs);
  }

  private stopAutoSync(): void {
    if (this.autoSyncTimer !== null) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
  }

  /**
   * Send a batch of operations via the transport layer.
   * Each operation is sent individually; synced IDs are collected
   * based on successful sends. Conflicts are detected when the
   * transport reports a mismatch.
   */
  private async sendBatch(batch: OfflineOperation[]): Promise<SyncBatchResult> {
    const syncedIds: string[] = [];
    const conflicts: OfflineOperation[] = [];
    let hasErrors = false;

    for (const op of batch) {
      try {
        const accepted = this.sendOperation(op.operation);
        if (accepted) {
          syncedIds.push(op.id);
        } else {
          conflicts.push(op);
        }
      } catch {
        hasErrors = true;
      }
    }

    return { syncedIds, conflicts, hasErrors };
  }

  /**
   * Send a single operation through the transport.
   * Returns `true` if the transport accepted it, `false` on conflict.
   */
  private sendOperation(operation: CrdtOperation): boolean {
    if (operation.type === 'awareness') {
      // Awareness operations are ephemeral; skip during sync.
      return true;
    }
    try {
      this.transport.sendCrdtOperation(operation);
      return true;
    } catch {
      return false;
    }
  }

  private emitSyncComplete(result: SyncBatchResult): void {
    for (const cb of this.syncCompleteCallbacks) {
      try {
        cb(result);
      } catch {
        /* ignore callback errors */
      }
    }
  }

  private emitConflict(operations: OfflineOperation[]): void {
    for (const cb of this.conflictCallbacks) {
      try {
        cb(operations);
      } catch {
        /* ignore callback errors */
      }
    }
  }
}

/**
 * Minimal transport interface used by OfflineSyncManager.
 * Decouples from the full `CollabWSTransport` to simplify testing.
 */
export interface CollabWSTransportLike {
  /** Send a CRDT operation to the server. */
  sendCrdtOperation(operation: CrdtOperation): void;
}

// ─── Factory ────────────────────────────────────────────────────────

/**
 * Create a fully wired offline support stack with sensible defaults.
 *
 * @param transport - The transport used to send operations to the server.
 * @param options - Optional overrides for storage, network, and config.
 * @returns An object containing the queue, manager, and a dispose helper.
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
  return {
    queue,
    manager,
    dispose: () => manager.dispose(),
  };
}
