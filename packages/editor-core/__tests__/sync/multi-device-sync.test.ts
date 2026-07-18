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
  type Device,
  type SyncOperation,
  type SyncChangeSet,
} from '../../src/sync/multi-device-sync';

describe('MultiDeviceSyncManager', () => {
  let manager: MultiDeviceSyncManager;
  let mockAdapter: MockWSAdapter;
  let localDevice: Device;

  beforeEach(() => {
    localDevice = createLocalDevice('测试设备', 'desktop', 'Windows', '10.0', '1.0.0');
    mockAdapter = new MockWSAdapter();
    manager = createSyncManager(localDevice, {}, mockAdapter);
  });

  describe('设备管理', () => {
    it('应该正确初始化本地设备', () => {
      const state = manager.getState();
      expect(state.localDevice.name).toBe('测试设备');
      expect(state.localDevice.type).toBe('desktop');
    });

    it('应该成功注册远程设备', () => {
      const remoteDevice = createLocalDevice('远程设备', 'laptop', 'macOS', '12.0', '1.0.0');
      manager.registerDevice(remoteDevice);
      expect(manager.getState().remoteDevices).toHaveLength(1);
    });

    it('应该成功移除远程设备', () => {
      const remoteDevice = createLocalDevice('远程设备', 'laptop', 'macOS', '12.0', '1.0.0');
      manager.registerDevice(remoteDevice);
      manager.removeDevice(remoteDevice.id);
      expect(manager.getState().remoteDevices).toHaveLength(0);
    });
  });

  describe('变更集管理', () => {
    it('应该成功应用本地变更', () => {
      const operations: SyncOperation[] = [{
        id: 'op1', type: 'update', entityType: 'project', entityId: 'proj1',
        path: 'name', newValue: '新名称', timestamp: new Date().toISOString(),
        deviceId: localDevice.id, userId: 'user1', version: 1, checksum: 'test'
      }];
      manager.applyLocalChange(operations);
      expect(manager.getState().currentVersion).toBe(1);
    });
  });

  describe('冲突检测', () => {
    it('应该检测并发编辑冲突', () => {
      const localOps: SyncOperation[] = [{
        id: 'op1', type: 'update', entityType: 'project', entityId: 'proj1',
        path: 'name', newValue: '本地', timestamp: new Date().toISOString(),
        deviceId: localDevice.id, userId: 'user1', version: 1, checksum: 'test'
      }];
      manager.applyLocalChange(localOps);

      const remoteChangeSet: SyncChangeSet = {
        id: 'cs1', deviceId: 'remote', userId: 'user2',
        operations: [{
          id: 'op2', type: 'update', entityType: 'project', entityId: 'proj1',
          path: 'name', newValue: '远程', timestamp: new Date().toISOString(),
          deviceId: 'remote', userId: 'user2', version: 2, checksum: 'test'
        }],
        timestamp: new Date().toISOString(), baseVersion: 0, targetVersion: 2,
        checksum: 'test', compressed: false
      };

      const conflicts = manager.detectConflicts(remoteChangeSet);
      expect(conflicts).toHaveLength(1);
    });
  });

  describe('离线队列', () => {
    it('应该在离线时添加到队列', () => {
      manager.updateLocalDevice({ status: 'offline' });
      const operations: SyncOperation[] = [{
        id: 'op1', type: 'update', entityType: 'project', entityId: 'proj1',
        path: 'name', newValue: '新名称', timestamp: new Date().toISOString(),
        deviceId: localDevice.id, userId: 'user1', version: 1, checksum: 'test'
      }];
      manager.applyLocalChange(operations);
      expect(manager.getOfflineQueue()).toHaveLength(1);
    });
  });
});

describe('工具函数', () => {
  it('calculateChecksum应该计算一致的校验和', () => {
    const data = { name: 'test' };
    expect(calculateChecksum(data)).toBe(calculateChecksum(data));
  });

  it('compareVersions应该正确比较版本', () => {
    expect(compareVersions(1, 2)).toBe(-1);
    expect(compareVersions(2, 1)).toBe(1);
    expect(compareVersions(1, 1)).toBe(0);
  });

  it('detectOperationConflict应该检测同一路径的冲突', () => {
    const local: SyncOperation = {
      id: 'op1', type: 'update', entityType: 'project', entityId: 'proj1',
      path: 'name', newValue: '本地', timestamp: new Date().toISOString(),
      deviceId: 'd1', userId: 'u1', version: 1, checksum: 'test'
    };
    const remote: SyncOperation = {
      id: 'op2', type: 'update', entityType: 'project', entityId: 'proj1',
      path: 'name', newValue: '远程', timestamp: new Date().toISOString(),
      deviceId: 'd2', userId: 'u2', version: 2, checksum: 'test'
    };
    expect(detectOperationConflict(local, remote)).toBe(true);
  });

  it('mergeOperations应该使用正确的策略', () => {
    const local: SyncOperation = {
      id: 'op1', type: 'update', entityType: 'project', entityId: 'proj1',
      path: 'name', newValue: '本地', timestamp: new Date().toISOString(),
      deviceId: 'd1', userId: 'u1', version: 1, checksum: 'test'
    };
    const remote: SyncOperation = {
      id: 'op2', type: 'update', entityType: 'project', entityId: 'proj1',
      path: 'name', newValue: '远程', timestamp: new Date().toISOString(),
      deviceId: 'd2', userId: 'u2', version: 2, checksum: 'test'
    };
    const merged = mergeOperations(local, remote, 'local-wins');
    expect(merged.newValue).toBe('本地');
  });

  it('serializeSyncState和parseSyncState应该正确工作', () => {
    const device = createLocalDevice('测试', 'desktop', 'Windows', '10', '1.0');
    const manager = createSyncManager(device);
    const json = serializeSyncState(manager.getState());
    const parsed = parseSyncState(json);
    expect(parsed).toBeTruthy();
    expect(parsed!.localDevice.name).toBe('测试');
  });
});
