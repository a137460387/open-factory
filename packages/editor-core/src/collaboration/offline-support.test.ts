import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  OfflineOperationQueue,
  OfflineSyncManager,
  MemoryStorageAdapter,
  createOfflineSupport,
  type OfflineOperation,
  type CrdtOperation,
  type NetworkStatusProvider,
  type CollabWSTransportLike,
  type SyncBatchResult,
} from './offline-support';

// ─── Helpers ──────────────────────────────────────────────────────

function makeCrdtOp(overrides: Partial<CrdtOperation> = {}): CrdtOperation {
  return {
    type: 'update',
    targetId: 'clip-1',
    data: { name: 'test' },
    vectorClock: new Map([['u1', 1]]),
    userId: 'u1',
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeTransport(): CollabWSTransportLike {
  return { sendCrdtOperation: vi.fn() };
}

function makeNetwork(online = true): NetworkStatusProvider {
  const handlers = { online: [] as Function[], offline: [] as Function[] };
  return {
    get isOnline() { return online; },
    onOnline: (h: Function) => handlers.online.push(h),
    onOffline: (h: Function) => handlers.offline.push(h),
    dispose: vi.fn(),
  };
}

// ─── MemoryStorageAdapter ─────────────────────────────────────────

describe('MemoryStorageAdapter', () => {
  it('saves and loads operations', async () => {
    const adapter = new MemoryStorageAdapter();
    const ops: OfflineOperation[] = [
      { id: 'op-1', operation: makeCrdtOp(), timestamp: 100, synced: false },
    ];
    await adapter.save(ops);
    const loaded = await adapter.load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('op-1');
  });

  it('clear removes all data', async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.save([{ id: 'op-1', operation: makeCrdtOp(), timestamp: 100, synced: false }]);
    await adapter.clear();
    const loaded = await adapter.load();
    expect(loaded).toHaveLength(0);
  });

  it('load returns copy, not reference', async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.save([{ id: 'op-1', operation: makeCrdtOp(), timestamp: 100, synced: false }]);
    const a = await adapter.load();
    const b = await adapter.load();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

// ─── OfflineOperationQueue ────────────────────────────────────────

describe('OfflineOperationQueue', () => {
  it('enqueues and dequeues operations', async () => {
    const queue = new OfflineOperationQueue();
    const entry = await queue.enqueue(makeCrdtOp());
    expect(entry.synced).toBe(false);
    const dequeued = await queue.dequeue();
    expect(dequeued?.id).toBe(entry.id);
  });

  it('dequeue returns undefined when empty', async () => {
    const queue = new OfflineOperationQueue();
    expect(await queue.dequeue()).toBeUndefined();
  });

  it('markSynced returns true for existing op', async () => {
    const queue = new OfflineOperationQueue();
    const entry = await queue.enqueue(makeCrdtOp());
    expect(await queue.markSynced(entry.id)).toBe(true);
    const pending = await queue.getPending();
    expect(pending).toHaveLength(0);
  });

  it('markSynced returns false for unknown id', async () => {
    const queue = new OfflineOperationQueue();
    expect(await queue.markSynced('nonexistent')).toBe(false);
  });

  it('getStats reports counts', async () => {
    const queue = new OfflineOperationQueue();
    await queue.enqueue(makeCrdtOp());
    const entry2 = await queue.enqueue(makeCrdtOp());
    await queue.markSynced(entry2.id);
    const stats = await queue.getStats();
    expect(stats.pendingCount).toBe(1);
    expect(stats.syncedCount).toBe(1);
  });

  it('clear removes all operations', async () => {
    const queue = new OfflineOperationQueue();
    await queue.enqueue(makeCrdtOp());
    await queue.clear();
    const stats = await queue.getStats();
    expect(stats.pendingCount).toBe(0);
  });
});

// ─── OfflineSyncManager ───────────────────────────────────────────

describe('OfflineSyncManager', () => {
  it('syncs pending operations to transport', async () => {
    const transport = makeTransport();
    const queue = new OfflineOperationQueue();
    const network = makeNetwork(true);
    await queue.enqueue(makeCrdtOp());

    const manager = new OfflineSyncManager(transport, queue, network);
    const result = await manager.sync();
    expect(result.syncedIds).toHaveLength(1);
    expect(transport.sendCrdtOperation).toHaveBeenCalledTimes(1);
    manager.dispose();
  });

  it('does not sync when offline', async () => {
    const transport = makeTransport();
    const network = makeNetwork(false);
    const manager = new OfflineSyncManager(transport, new OfflineOperationQueue(), network);
    expect(manager.isOffline()).toBe(true);

    const result = await manager.sync();
    expect(result.syncedIds).toHaveLength(0);
    manager.dispose();
  });

  it('goOnline triggers sync', async () => {
    const transport = makeTransport();
    const queue = new OfflineOperationQueue();
    const network = makeNetwork(false);
    await queue.enqueue(makeCrdtOp());

    const manager = new OfflineSyncManager(transport, queue, network);
    await manager.goOnline();
    expect(manager.isOffline()).toBe(false);
    expect(transport.sendCrdtOperation).toHaveBeenCalled();
    manager.dispose();
  });

  it('goOffline prevents sync', async () => {
    const transport = makeTransport();
    const manager = new OfflineSyncManager(transport, new OfflineOperationQueue(), makeNetwork(true));
    manager.goOffline();
    expect(manager.isOffline()).toBe(true);
    const result = await manager.sync();
    expect(result.syncedIds).toHaveLength(0);
    manager.dispose();
  });

  it('emits sync complete callback', async () => {
    const transport = makeTransport();
    const queue = new OfflineOperationQueue();
    await queue.enqueue(makeCrdtOp());

    const manager = new OfflineSyncManager(transport, queue, makeNetwork(true));
    let received: SyncBatchResult | null = null;
    manager.onSyncComplete((r) => { received = r; });
    await manager.sync();
    expect(received).not.toBeNull();
    expect(received!.syncedIds).toHaveLength(1);
    manager.dispose();
  });

  it('getSyncState transitions through states', async () => {
    const manager = new OfflineSyncManager(makeTransport(), new OfflineOperationQueue(), makeNetwork(true));
    expect(manager.getSyncState()).toBe('synced');
    manager.goOffline();
    expect(manager.getSyncState()).toBe('pending');
    manager.dispose();
  });
});

// ─── createOfflineSupport ─────────────────────────────────────────

describe('createOfflineSupport', () => {
  it('returns queue, manager, and dispose', () => {
    const transport = makeTransport();
    const result = createOfflineSupport(transport, { network: makeNetwork(true) });
    expect(result.queue).toBeDefined();
    expect(result.manager).toBeDefined();
    expect(typeof result.dispose).toBe('function');
    result.dispose();
  });

  it('dispose cleans up manager', () => {
    const transport = makeTransport();
    const result = createOfflineSupport(transport, { network: makeNetwork(true) });
    result.dispose();
    expect(result.manager.getSyncState()).toBe('synced');
  });

  it('accepts custom storage adapter', async () => {
    const transport = makeTransport();
    const storage = new MemoryStorageAdapter();
    const result = createOfflineSupport(transport, { storage, network: makeNetwork(true) });
    await result.queue.enqueue(makeCrdtOp());
    const stats = await result.queue.getStats();
    expect(stats.pendingCount).toBe(1);
    result.dispose();
  });
});
