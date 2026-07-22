import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MultiDeviceSyncManager,
  MockWSAdapter,
  createSyncManager,
  createLocalDevice,
  calculateChecksum,
  canDevicePerformAction,
  compareVersions,
  detectOperationConflict,
  mergeOperations,
  compressChangeSet,
  validateChangeSet,
  serializeSyncState,
  parseSyncState,
  DEFAULT_SYNC_CONFIG,
  type Device,
  type SyncOperation,
  type SyncChangeSet,
} from '../../src/sync/multi-device-sync';

function createTestOperation(overrides: Partial<SyncOperation> = {}): SyncOperation {
  return {
    id: 'op1',
    type: 'update',
    entityType: 'project',
    entityId: 'proj1',
    path: 'name',
    newValue: 'test',
    timestamp: new Date().toISOString(),
    deviceId: 'd1',
    userId: 'u1',
    version: 1,
    checksum: 'test',
    ...overrides,
  };
}

function createTestChangeSet(overrides: Partial<SyncChangeSet> = {}): SyncChangeSet {
  const ops = overrides.operations ?? [createTestOperation()];
  return {
    id: 'cs1',
    deviceId: 'remote',
    userId: 'user2',
    operations: ops,
    timestamp: new Date().toISOString(),
    baseVersion: 0,
    targetVersion: ops.length,
    checksum: calculateChecksum(ops),
    compressed: false,
    ...overrides,
  };
}

describe('calculateChecksum', () => {
  it('should return consistent hash for same data', () => {
    const data = { name: 'test', value: 42 };
    expect(calculateChecksum(data)).toBe(calculateChecksum(data));
  });

  it('should return different hash for different data', () => {
    expect(calculateChecksum({ a: 1 })).not.toBe(calculateChecksum({ b: 2 }));
  });

  it('should handle empty data', () => {
    expect(calculateChecksum(null)).toBeTruthy();
    expect(calculateChecksum({})).toBeTruthy();
  });
});

describe('canDevicePerformAction', () => {
  const device = createLocalDevice('test', 'desktop', 'win', '10', '1.0');

  it('should check edit capability', () => {
    expect(canDevicePerformAction(device, 'edit')).toBe(true);
  });

  it('should check export capability', () => {
    expect(canDevicePerformAction(device, 'export')).toBe(true);
  });

  it('should check render capability', () => {
    expect(canDevicePerformAction(device, 'render')).toBe(true);
  });

  it('should return true for unknown actions', () => {
    expect(canDevicePerformAction(device, 'unknown')).toBe(true);
  });

  it('should return false when capability is disabled', () => {
    const limited: Device = {
      ...device,
      metadata: {
        ...device.metadata,
        capabilities: { ...device.metadata.capabilities, canEdit: false },
      },
    };
    expect(canDevicePerformAction(limited, 'edit')).toBe(false);
  });
});

describe('compareVersions', () => {
  it('should return -1 when v1 < v2', () => expect(compareVersions(1, 2)).toBe(-1));
  it('should return 1 when v1 > v2', () => expect(compareVersions(2, 1)).toBe(1));
  it('should return 0 when equal', () => expect(compareVersions(5, 5)).toBe(0));
});

describe('detectOperationConflict', () => {
  it('should detect same-path conflict', () => {
    const local = createTestOperation({ path: 'name' });
    const remote = createTestOperation({ id: 'op2', path: 'name', deviceId: 'd2' });
    expect(detectOperationConflict(local, remote)).toBe(true);
  });

  it('should detect delete as structural conflict', () => {
    const local = createTestOperation({ type: 'delete', path: 'a' });
    const remote = createTestOperation({ id: 'op2', path: 'b', deviceId: 'd2' });
    expect(detectOperationConflict(local, remote)).toBe(true);
  });

  it('should detect move as structural conflict', () => {
    const local = createTestOperation({ type: 'move', path: 'a' });
    const remote = createTestOperation({ id: 'op2', path: 'b', deviceId: 'd2' });
    expect(detectOperationConflict(local, remote)).toBe(true);
  });

  it('should not detect conflict for different entities', () => {
    const local = createTestOperation({ entityId: 'a' });
    const remote = createTestOperation({ id: 'op2', entityId: 'b', deviceId: 'd2' });
    expect(detectOperationConflict(local, remote)).toBe(false);
  });

  it('should not detect conflict for same entity different path non-structural', () => {
    const local = createTestOperation({ type: 'update', path: 'a' });
    const remote = createTestOperation({ id: 'op2', type: 'update', path: 'b', deviceId: 'd2' });
    expect(detectOperationConflict(local, remote)).toBe(false);
  });
});

describe('mergeOperations', () => {
  const local = createTestOperation({ newValue: 'local', version: 1, timestamp: '2025-01-01T00:00:00Z' });
  const remote = createTestOperation({ id: 'op2', newValue: 'remote', version: 2, timestamp: '2025-01-02T00:00:00Z', deviceId: 'd2' });

  it('local-wins should keep local value', () => {
    const merged = mergeOperations(local, remote, 'local-wins');
    expect(merged.newValue).toBe('local');
    expect(merged.version).toBe(3);
  });

  it('remote-wins should keep remote value', () => {
    const merged = mergeOperations(local, remote, 'remote-wins');
    expect(merged.newValue).toBe('remote');
    expect(merged.version).toBe(3);
  });

  it('newest-wins should pick newer timestamp', () => {
    const merged = mergeOperations(local, remote, 'newest-wins');
    expect(merged.newValue).toBe('remote');
  });

  it('merge should pick newer value', () => {
    const merged = mergeOperations(local, remote, 'merge');
    expect(merged.newValue).toBe('remote');
    expect(merged.version).toBe(3);
  });

  it('default strategy should work', () => {
    const merged = mergeOperations(local, remote, 'manual' as any);
    expect(merged.version).toBe(3);
  });
});

describe('compressChangeSet', () => {
  it('should merge duplicate entity operations', () => {
    const ops = [
      createTestOperation({ timestamp: '2025-01-01T00:00:00Z', newValue: 'old' }),
      createTestOperation({ id: 'op2', timestamp: '2025-01-02T00:00:00Z', newValue: 'new' }),
    ];
    const cs = createTestChangeSet({ operations: ops });
    const compressed = compressChangeSet(cs);
    expect(compressed.operations).toHaveLength(1);
    expect(compressed.compressed).toBe(true);
  });

  it('should keep different entity operations separate', () => {
    const ops = [
      createTestOperation({ entityId: 'a' }),
      createTestOperation({ id: 'op2', entityId: 'b', deviceId: 'd2' }),
    ];
    const cs = createTestChangeSet({ operations: ops });
    const compressed = compressChangeSet(cs);
    expect(compressed.operations).toHaveLength(2);
  });
});

describe('validateChangeSet', () => {
  it('should validate correct changeset', () => {
    const ops = [createTestOperation({ timestamp: '2025-01-01T00:00:00Z' })];
    const cs = createTestChangeSet({
      operations: ops,
      baseVersion: 0,
      targetVersion: 1,
      checksum: calculateChecksum(ops),
    });
    expect(validateChangeSet(cs)).toBe(true);
  });

  it('should reject wrong checksum', () => {
    const cs = createTestChangeSet({ checksum: 'wrong' });
    expect(validateChangeSet(cs)).toBe(false);
  });

  it('should reject wrong version count', () => {
    const ops = [createTestOperation()];
    const cs = createTestChangeSet({
      operations: ops,
      baseVersion: 0,
      targetVersion: 5,
      checksum: calculateChecksum(ops),
    });
    expect(validateChangeSet(cs)).toBe(false);
  });
});

describe('MultiDeviceSyncManager', () => {
  let manager: MultiDeviceSyncManager;
  let mockAdapter: MockWSAdapter;
  let localDevice: Device;

  beforeEach(() => {
    localDevice = createLocalDevice('test', 'desktop', 'win', '10', '1.0');
    mockAdapter = new MockWSAdapter();
    manager = createSyncManager(localDevice, {}, mockAdapter);
  });

  it('should return config', () => {
    const config = manager.getConfig();
    expect(config.enabled).toBe(true);
    expect(config.autoSync).toBe(true);
  });

  it('should update config', () => {
    manager.updateConfig({ autoSync: false });
    expect(manager.getConfig().autoSync).toBe(false);
  });

  it('should register and update existing device', () => {
    const device = createLocalDevice('remote', 'laptop', 'mac', '12', '1.0');
    manager.registerDevice(device);
    expect(manager.getState().remoteDevices).toHaveLength(1);
    manager.registerDevice({ ...device, name: 'updated' });
    expect(manager.getState().remoteDevices).toHaveLength(1);
    expect(manager.getState().remoteDevices[0].name).toBe('updated');
  });

  it('should update device status', () => {
    const device = createLocalDevice('remote', 'laptop', 'mac', '12', '1.0');
    manager.registerDevice(device);
    manager.updateDeviceStatus(device.id, 'offline');
    expect(manager.getState().remoteDevices[0].status).toBe('offline');
  });

  it('should ignore status update for unknown device', () => {
    manager.updateDeviceStatus('unknown', 'offline');
    // should not throw
  });

  it('should apply local change and sync when online', () => {
    mockAdapter.connect();
    const ops = [createTestOperation()];
    manager.applyLocalChange(ops);
    expect(manager.getState().currentVersion).toBe(1);
    expect(mockAdapter.getSentMessages()).toHaveLength(1);
  });

  it('should apply local change and queue when offline', () => {
    manager.updateLocalDevice({ status: 'offline' });
    const ops = [createTestOperation()];
    manager.applyLocalChange(ops);
    expect(manager.getOfflineQueue()).toHaveLength(1);
  });

  it('should apply remote change successfully', () => {
    const ops = [createTestOperation({ timestamp: '2025-01-01T00:00:00Z' })];
    const cs = createTestChangeSet({
      operations: ops,
      baseVersion: 0,
      targetVersion: 1,
      checksum: calculateChecksum(ops),
    });
    expect(manager.applyRemoteChange(cs)).toBe(true);
    expect(manager.getState().currentVersion).toBe(1);
    expect(manager.getState().lastSyncAt).toBeTruthy();
  });

  it('should reject invalid remote changeset', () => {
    const cs = createTestChangeSet({ checksum: 'bad' });
    expect(manager.applyRemoteChange(cs)).toBe(false);
  });

  it('should resolve conflicts automatically', () => {
    const localOps = [createTestOperation({ path: 'name', newValue: 'local' })];
    manager.applyLocalChange(localOps);

    const remoteOps = [createTestOperation({ id: 'op2', path: 'name', newValue: 'remote', deviceId: 'remote', timestamp: '2025-01-02T00:00:00Z' })];
    const cs = createTestChangeSet({
      operations: remoteOps,
      baseVersion: 0,
      targetVersion: 1,
      checksum: calculateChecksum(remoteOps),
    });

    // newest-wins should auto-resolve
    const result = manager.applyRemoteChange(cs);
    expect(result).toBe(true);
  });

  it('should handle manual conflict resolution', () => {
    manager.updateConfig({ conflictResolution: 'manual' });
    const localOps = [createTestOperation({ path: 'name', newValue: 'local' })];
    manager.applyLocalChange(localOps);

    const remoteOps = [createTestOperation({ id: 'op2', path: 'name', newValue: 'remote', deviceId: 'remote' })];
    const cs = createTestChangeSet({
      operations: remoteOps,
      baseVersion: 0,
      targetVersion: 1,
      checksum: calculateChecksum(remoteOps),
    });

    const result = manager.applyRemoteChange(cs);
    expect(result).toBe(false);
  });

  it('should resolve conflict manually', () => {
    manager.updateConfig({ conflictResolution: 'manual' });
    const localOps = [createTestOperation({ path: 'name', newValue: 'local' })];
    manager.applyLocalChange(localOps);

    const remoteOps = [createTestOperation({ id: 'op2', path: 'name', newValue: 'remote', deviceId: 'remote' })];
    const cs = createTestChangeSet({
      operations: remoteOps,
      baseVersion: 0,
      targetVersion: 1,
      checksum: calculateChecksum(remoteOps),
    });
    manager.applyRemoteChange(cs);

    const conflicts = manager.getConflicts();
    expect(conflicts.length).toBeGreaterThan(0);

    const resolved = manager.resolveConflictManually(conflicts[0].id, 'local-wins', 'user1');
    expect(resolved).toBe(true);
    expect(manager.getConflicts()).toHaveLength(0);
  });

  it('should return false for unknown conflict id', () => {
    expect(manager.resolveConflictManually('unknown', 'local-wins', 'user1')).toBe(false);
  });

  it('should process offline queue when online', async () => {
    manager.updateLocalDevice({ status: 'offline' });
    manager.applyLocalChange([createTestOperation()]);
    expect(manager.getOfflineQueue()).toHaveLength(1);

    mockAdapter.connect();
    manager.updateLocalDevice({ status: 'online' });
    await manager.processOfflineQueue();
    expect(manager.getOfflineQueue()).toHaveLength(0);
  });

  it('should not process queue when offline', async () => {
    manager.updateLocalDevice({ status: 'offline' });
    manager.applyLocalChange([createTestOperation()]);
    await manager.processOfflineQueue();
    expect(manager.getOfflineQueue()).toHaveLength(1);
  });

  it('should trigger sync', async () => {
    mockAdapter.connect();
    await manager.triggerSync();
    // should not throw
  });

  it('should not trigger sync when already syncing', async () => {
    mockAdapter.connect();
    // First sync
    manager.applyLocalChange([createTestOperation()]);
    // Second trigger while syncing should be no-op
    await manager.triggerSync();
  });

  it('should pause and resume sync', () => {
    manager.pauseSync();
    expect(manager.getState().syncStatus).toBe('paused');
    manager.resumeSync();
    expect(manager.getState().syncStatus).toBe('idle');
  });

  it('should report needsSync correctly', () => {
    expect(manager.needsSync()).toBe(false);
    manager.updateLocalDevice({ status: 'offline' });
    manager.applyLocalChange([createTestOperation()]);
    expect(manager.needsSync()).toBe(true);
  });

  it('should return stats', () => {
    manager.applyLocalChange([createTestOperation()]);
    const stats = manager.getStats();
    expect(stats.totalOperations).toBe(1);
    expect(stats.currentVersion).toBe(1);
    expect(stats.remoteDevices).toBe(0);
  });

  it('should export and import state', () => {
    manager.applyLocalChange([createTestOperation()]);
    const json = manager.exportState();
    const newManager = createSyncManager(localDevice);
    expect(newManager.importState(json)).toBe(true);
    expect(newManager.getState().currentVersion).toBe(1);
  });

  it('should reject invalid import', () => {
    expect(manager.importState('not json')).toBe(false);
    expect(manager.importState('{}')).toBe(false);
  });

  it('should emit events', () => {
    const handler = vi.fn();
    manager.on('device.connected', handler);
    const device = createLocalDevice('remote', 'laptop', 'mac', '12', '1.0');
    manager.registerDevice(device);
    expect(handler).toHaveBeenCalled();
  });

  it('should unsubscribe event handler', () => {
    const handler = vi.fn();
    const unsub = manager.on('device.connected', handler);
    unsub();
    manager.registerDevice(createLocalDevice('remote', 'laptop', 'mac', '12', '1.0'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('should dispose resources', () => {
    manager.startAutoSync();
    manager.dispose();
    // should not throw
  });

  it('should handle sync error with ws adapter', async () => {
    mockAdapter.connect();
    const failingAdapter: WSAdapter = {
      send: vi.fn().mockRejectedValue(new Error('network error')),
      close: vi.fn(),
      onMessage: vi.fn(),
      onOpen: vi.fn(),
      onClose: vi.fn(),
      onError: vi.fn(),
    };
    const mgr = createSyncManager(localDevice, {}, failingAdapter);
    mgr.applyLocalChange([createTestOperation()]);
    // The error should be handled internally
  });

  it('should respect maxOfflineQueueSize', () => {
    const mgr = createSyncManager(localDevice, { maxOfflineQueueSize: 2 });
    mgr.updateLocalDevice({ status: 'offline' });
    mgr.applyLocalChange([createTestOperation({ id: 'op1' })]);
    mgr.applyLocalChange([createTestOperation({ id: 'op2' })]);
    mgr.applyLocalChange([createTestOperation({ id: 'op3' })]);
    expect(mgr.getOfflineQueue()).toHaveLength(2);
  });

  it('should get latest snapshot', () => {
    manager.applyLocalChange([createTestOperation()]);
    const snapshot = manager.getLatestSnapshot();
    expect(snapshot).toBeTruthy();
    expect(snapshot!.version).toBe(1);
  });

  it('should limit snapshots to 100', () => {
    for (let i = 0; i < 105; i++) {
      manager.applyLocalChange([createTestOperation({ id: `op${i}` })]);
    }
    expect(manager.getState().snapshots.length).toBeLessThanOrEqual(100);
  });
});

describe('createLocalDevice', () => {
  it('should create device with correct fields', () => {
    const device = createLocalDevice('MyPC', 'desktop', 'Windows', '11', '2.0');
    expect(device.name).toBe('MyPC');
    expect(device.type).toBe('desktop');
    expect(device.platform).toBe('Windows');
    expect(device.status).toBe('online');
    expect(device.metadata.capabilities.canEdit).toBe(true);
    expect(device.metadata.capabilities.maxResolution).toBe('4K');
  });
});

describe('parseSyncState', () => {
  it('should parse valid JSON', () => {
    const state = { localDevice: createLocalDevice('t', 'desktop', 'w', '10', '1'), remoteDevices: [], currentVersion: 0, syncStatus: 'idle', conflicts: [], offlineQueue: [], snapshots: [], changeHistory: [] };
    const parsed = parseSyncState(JSON.stringify(state));
    expect(parsed).toBeTruthy();
  });

  it('should return null for invalid JSON', () => {
    expect(parseSyncState('not json')).toBeNull();
  });
});

describe('DEFAULT_SYNC_CONFIG', () => {
  it('should have sensible defaults', () => {
    expect(DEFAULT_SYNC_CONFIG.enabled).toBe(true);
    expect(DEFAULT_SYNC_CONFIG.autoSync).toBe(true);
    expect(DEFAULT_SYNC_CONFIG.conflictResolution).toBe('newest-wins');
    expect(DEFAULT_SYNC_CONFIG.maxRetries).toBe(3);
  });
});
