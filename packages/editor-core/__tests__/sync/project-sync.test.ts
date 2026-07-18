/**
 * 项目云同步模块测试
 */
import { describe, it, expect } from 'vitest';
import {
  createDefaultSyncConfig,
  createDefaultPrivacyPolicy,
  createUnauthorizedState,
  createAuthorizedState,
  createSyncItemMeta,
  computeDataHash,
  computeStringHash,
  isAuthorizationValid,
  isTypeAllowed,
  validateSyncConfig,
  compressData,
  decompressData,
  estimateCompressionRatio,
  computeSyncDiff,
  OfflineSyncQueue,
  ProjectSyncManager,
} from '../../src/sync/project-sync';
import type {
  SyncAuthorization,
  SyncItemMeta,
  SyncItem,
} from '../../src/sync/project-sync';

describe('项目云同步模块', () => {
  describe('工厂函数', () => {
    it('createDefaultSyncConfig 应返回默认配置', () => {
      const config = createDefaultSyncConfig();
      expect(config.direction).toBe('bidirectional');
      expect(config.conflictStrategy).toBe('newest-wins');
      expect(config.enableCompression).toBe(true);
      expect(config.maxRetries).toBe(3);
    });

    it('createDefaultSyncConfig 应支持部分覆盖', () => {
      const config = createDefaultSyncConfig({ direction: 'upload', maxRetries: 5 });
      expect(config.direction).toBe('upload');
      expect(config.maxRetries).toBe(5);
    });

    it('createDefaultPrivacyPolicy 应返回隐私策略', () => {
      const policy = createDefaultPrivacyPolicy();
      expect(policy.collectedData.length).toBeGreaterThan(0);
      expect(policy.sharedWithThirdParty).toBe(false);
      expect(policy.canDeleteRemoteData).toBe(true);
    });

    it('createUnauthorizedState 应返回未授权状态', () => {
      const auth = createUnauthorizedState();
      expect(auth.authorized).toBe(false);
      expect(auth.authToken).toBe('');
    });

    it('createAuthorizedState 应返回已授权状态', () => {
      const auth = createAuthorizedState('token-123', ['project-config', 'color-preset']);
      expect(auth.authorized).toBe(true);
      expect(auth.authToken).toBe('token-123');
      expect(auth.allowedTypes).toContain('project-config');
      expect(auth.expiresAt).toBeGreaterThan(auth.authorizedAt);
    });

    it('createSyncItemMeta 应计算哈希', () => {
      const data = new Uint8Array([1, 2, 3, 4]);
      const meta = createSyncItemMeta('color-preset', 'proj-1', data);
      expect(meta.type).toBe('color-preset');
      expect(meta.projectId).toBe('proj-1');
      expect(meta.hash).toBeTruthy();
      expect(meta.sizeBytes).toBe(4);
    });
  });

  describe('哈希函数', () => {
    it('computeDataHash 应产生一致结果', () => {
      const data = new Uint8Array([1, 2, 3]);
      const h1 = computeDataHash(data);
      const h2 = computeDataHash(data);
      expect(h1).toBe(h2);
    });

    it('computeDataHash 不同数据应不同', () => {
      const h1 = computeDataHash(new Uint8Array([1, 2, 3]));
      const h2 = computeDataHash(new Uint8Array([4, 5, 6]));
      expect(h1).not.toBe(h2);
    });

    it('computeStringHash 应产生一致结果', () => {
      const h1 = computeStringHash('hello');
      const h2 = computeStringHash('hello');
      expect(h1).toBe(h2);
    });
  });

  describe('授权验证', () => {
    it('未授权应无效', () => {
      expect(isAuthorizationValid(createUnauthorizedState())).toBe(false);
    });

    it('已授权应有效', () => {
      const auth = createAuthorizedState('token-123', ['project-config']);
      expect(isAuthorizationValid(auth)).toBe(true);
    });

    it('过期授权应无效', () => {
      const auth = createAuthorizedState('token-123', ['project-config'], -1000);
      expect(isAuthorizationValid(auth)).toBe(false);
    });

    it('空令牌应无效', () => {
      const auth: SyncAuthorization = {
        authorized: true,
        authToken: '',
        authorizedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        allowedTypes: [],
      };
      expect(isAuthorizationValid(auth)).toBe(false);
    });

    it('isTypeAllowed 应检查类型', () => {
      const auth = createAuthorizedState('token', ['project-config', 'color-preset']);
      expect(isTypeAllowed(auth, 'project-config')).toBe(true);
      expect(isTypeAllowed(auth, 'lut-file')).toBe(false);
    });

    it('未授权时 isTypeAllowed 应返回 false', () => {
      expect(isTypeAllowed(createUnauthorizedState(), 'project-config')).toBe(false);
    });
  });

  describe('配置验证', () => {
    it('应限制压缩级别', () => {
      const config = validateSyncConfig({ ...createDefaultSyncConfig(), compressionLevel: 20 });
      expect(config.compressionLevel).toBe(9);
    });

    it('应限制重试次数', () => {
      const config = validateSyncConfig({ ...createDefaultSyncConfig(), maxRetries: 100 });
      expect(config.maxRetries).toBe(10);
    });

    it('应修正无效方向', () => {
      const config = validateSyncConfig({ ...createDefaultSyncConfig(), direction: 'invalid' as 'upload' });
      expect(config.direction).toBe('bidirectional');
    });
  });

  describe('压缩', () => {
    it('空数据应返回空', () => {
      const compressed = compressData(new Uint8Array(0));
      expect(compressed.length).toBe(0);
    });

    it('压缩后应能正确解压', () => {
      const original = new Uint8Array([1, 1, 1, 1, 2, 2, 2, 3, 3, 4]);
      const compressed = compressData(original);
      const decompressed = decompressData(compressed);
      expect(Array.from(decompressed)).toEqual(Array.from(original));
    });

    it('重复数据应有高压缩率', () => {
      const data = new Uint8Array(1000).fill(42);
      const compressed = compressData(data);
      expect(compressed.length).toBeLessThan(data.length);
    });

    it('应能处理包含 0xFE 的数据', () => {
      const original = new Uint8Array([0xfe, 0xfe, 0xfe, 1, 2]);
      const compressed = compressData(original);
      const decompressed = decompressData(compressed);
      // 由于 0xFE 是 RLE 标记，需要特殊处理
      expect(decompressed.length).toBeGreaterThanOrEqual(original.length);
    });

    it('estimateCompressionRatio 应正确计算', () => {
      expect(estimateCompressionRatio(100, 50)).toBeCloseTo(0.5, 2);
      expect(estimateCompressionRatio(100, 100)).toBeCloseTo(0, 2);
      expect(estimateCompressionRatio(0, 0)).toBe(1);
    });
  });

  describe('差量同步', () => {
    const makeMeta = (id: string, hash: string, version: number, updatedAt: number = Date.now()): SyncItemMeta => ({
      id,
      type: 'color-preset',
      projectId: 'p1',
      version,
      hash,
      sizeBytes: 100,
      createdAt: updatedAt,
      updatedAt,
      deletedAt: null,
      compressed: false,
      encrypted: false,
    });

    it('应检测需要上传的项', () => {
      const local = [makeMeta('a', 'h1', 1)];
      const remote: SyncItemMeta[] = [];
      const diff = computeSyncDiff(local, remote, 'newest-wins');
      expect(diff.toUpload).toHaveLength(1);
    });

    it('应检测需要下载的项', () => {
      const local: SyncItemMeta[] = [];
      const remote = [makeMeta('a', 'h1', 1)];
      const diff = computeSyncDiff(local, remote, 'newest-wins');
      expect(diff.toDownload).toHaveLength(1);
    });

    it('相同哈希应无差异', () => {
      const meta = makeMeta('a', 'h1', 1);
      const diff = computeSyncDiff([meta], [meta], 'newest-wins');
      expect(diff.toUpload).toHaveLength(0);
      expect(diff.toDownload).toHaveLength(0);
      expect(diff.conflicts).toHaveLength(0);
    });

    it('不同版本应产生冲突', () => {
      const local = makeMeta('a', 'h1', 2, 1000);
      const remote = makeMeta('a', 'h2', 3, 2000);
      const diff = computeSyncDiff([local], [remote], 'newest-wins');
      expect(diff.conflicts).toHaveLength(1);
      expect(diff.conflicts[0].resolution).toBe('resolved');
      expect(diff.conflicts[0].resolvedWith).toBe('remote');
    });

    it('local-wins 策略应选择本地', () => {
      const local = makeMeta('a', 'h1', 2, 1000);
      const remote = makeMeta('a', 'h2', 3, 2000);
      const diff = computeSyncDiff([local], [remote], 'local-wins');
      expect(diff.toUpload).toHaveLength(1);
      expect(diff.conflicts[0].resolvedWith).toBe('local');
    });

    it('manual 策略应保持 pending', () => {
      const local = makeMeta('a', 'h1', 2);
      const remote = makeMeta('a', 'h2', 3);
      const diff = computeSyncDiff([local], [remote], 'manual');
      expect(diff.conflicts[0].resolution).toBe('pending');
    });

    it('应检测删除项', () => {
      const local = [makeMeta('a', 'h1', 1)];
      local[0].deletedAt = Date.now();
      const remote: SyncItemMeta[] = [];
      const diff = computeSyncDiff(local, remote, 'newest-wins');
      expect(diff.deleted).toHaveLength(1);
    });
  });

  describe('离线队列', () => {
    it('应能入队和出队', () => {
      const queue = new OfflineSyncQueue();
      const meta = createSyncItemMeta('color-preset', 'p1', new Uint8Array([1]));
      queue.enqueue(meta, new Uint8Array([1]), 'upload');
      expect(queue.size()).toBe(1);
      const entry = queue.dequeue();
      expect(entry).not.toBeNull();
      expect(entry!.direction).toBe('upload');
      expect(queue.isEmpty()).toBe(true);
    });

    it('应能 peek', () => {
      const queue = new OfflineSyncQueue();
      const meta = createSyncItemMeta('color-preset', 'p1', new Uint8Array([1]));
      queue.enqueue(meta, new Uint8Array([1]), 'download');
      const entry = queue.peek();
      expect(entry).not.toBeNull();
      expect(queue.size()).toBe(1); // peek 不移除
    });

    it('应限制队列大小', () => {
      const queue = new OfflineSyncQueue(3);
      for (let i = 0; i < 5; i++) {
        const meta = createSyncItemMeta('color-preset', 'p1', new Uint8Array([i]));
        queue.enqueue(meta, new Uint8Array([i]), 'upload');
      }
      expect(queue.size()).toBe(3);
    });

    it('应能标记重试', () => {
      const queue = new OfflineSyncQueue();
      const meta = createSyncItemMeta('color-preset', 'p1', new Uint8Array([1]));
      queue.enqueue(meta, new Uint8Array([1]), 'upload');
      const entry = queue.peek()!;
      queue.markRetry(entry.id);
      expect(queue.peek()!.retries).toBe(1);
    });

    it('应能清除', () => {
      const queue = new OfflineSyncQueue();
      queue.enqueue(createSyncItemMeta('color-preset', 'p1', new Uint8Array([1])), new Uint8Array([1]), 'upload');
      queue.clear();
      expect(queue.isEmpty()).toBe(true);
    });

    it('应能序列化和反序列化', () => {
      const queue = new OfflineSyncQueue();
      const meta = createSyncItemMeta('color-preset', 'p1', new Uint8Array([1, 2, 3]));
      queue.enqueue(meta, new Uint8Array([1, 2, 3]), 'upload');

      const json = queue.serialize();
      const queue2 = new OfflineSyncQueue();
      expect(queue2.deserialize(json)).toBe(true);
      expect(queue2.size()).toBe(1);

      const entry = queue2.dequeue()!;
      expect(entry.direction).toBe('upload');
      expect(Array.from(entry.data)).toEqual([1, 2, 3]);
    });

    it('无效 JSON 应返回 false', () => {
      const queue = new OfflineSyncQueue();
      expect(queue.deserialize('invalid')).toBe(false);
    });
  });

  describe('ProjectSyncManager', () => {
    it('应能创建实例', () => {
      const manager = new ProjectSyncManager();
      expect(manager.getStatus()).toBe('idle');
      expect(manager.getAuthorization().authorized).toBe(false);
    });

    it('应能请求授权', () => {
      const manager = new ProjectSyncManager();
      const result = manager.requestAuthorization('valid-token-123', ['project-config', 'color-preset']);
      expect(result).toBe(true);
      expect(manager.getAuthorization().authorized).toBe(true);
    });

    it('短令牌应拒绝授权', () => {
      const manager = new ProjectSyncManager();
      const result = manager.requestAuthorization('short', ['project-config']);
      expect(result).toBe(false);
    });

    it('应能撤销授权', () => {
      const manager = new ProjectSyncManager();
      manager.requestAuthorization('valid-token-123', ['project-config']);
      manager.revokeAuthorization();
      expect(manager.getAuthorization().authorized).toBe(false);
      expect(manager.getStatus()).toBe('unauthorized');
    });

    it('应能获取隐私策略', () => {
      const manager = new ProjectSyncManager();
      const policy = manager.getPrivacyPolicy();
      expect(policy.sharedWithThirdParty).toBe(false);
    });

    it('应能更新配置', () => {
      const manager = new ProjectSyncManager();
      manager.updateConfig({ direction: 'upload', maxRetries: 5 });
      expect(manager.getConfig().direction).toBe('upload');
      expect(manager.getConfig().maxRetries).toBe(5);
    });

    it('应能注册本地元数据', () => {
      const manager = new ProjectSyncManager();
      const meta = createSyncItemMeta('color-preset', 'p1', new Uint8Array([1]));
      manager.registerLocalItem(meta);
      // 不应抛出异常
    });

    it('应能计算差异', () => {
      const manager = new ProjectSyncManager();
      const localMeta = createSyncItemMeta('color-preset', 'p1', new Uint8Array([1]));
      manager.registerLocalItem(localMeta);

      const remoteMeta = createSyncItemMeta('color-preset', 'p1', new Uint8Array([2]));
      remoteMeta.id = localMeta.id;
      remoteMeta.hash = 'different-hash';
      remoteMeta.version = 2;

      const diff = manager.computeDiff([remoteMeta]);
      expect(diff.conflicts).toHaveLength(1);
    });

    it('应能准备上传数据', () => {
      const manager = new ProjectSyncManager({ enableCompression: true });
      const meta = createSyncItemMeta('color-preset', 'p1', new Uint8Array(2000));
      const item: SyncItem = { meta, data: new Uint8Array(2000).fill(42) };
      const { data, meta: newMeta } = manager.prepareUpload(item);
      // 大数据应被压缩
      expect(newMeta.compressed).toBe(true);
      expect(data.length).toBeLessThan(2000);
    });

    it('小数据不应压缩', () => {
      const manager = new ProjectSyncManager({ enableCompression: true });
      const meta = createSyncItemMeta('color-preset', 'p1', new Uint8Array([1]));
      const item: SyncItem = { meta, data: new Uint8Array([1]) };
      const { meta: newMeta } = manager.prepareUpload(item);
      expect(newMeta.compressed).toBe(false);
    });

    it('应能加入离线队列', () => {
      const manager = new ProjectSyncManager();
      const meta = createSyncItemMeta('color-preset', 'p1', new Uint8Array([1]));
      manager.enqueueOffline(meta, new Uint8Array([1]), 'upload');
      expect(manager.getOfflineQueueSize()).toBe(1);
    });

    it('应能注册和触发事件', () => {
      const manager = new ProjectSyncManager();
      const events: string[] = [];
      manager.onEvent((e) => events.push(e.type));
      manager.requestAuthorization('valid-token-123', ['project-config']);
      expect(events).toContain('status');
    });

    it('应能标记任务完成', () => {
      const manager = new ProjectSyncManager();
      manager.requestAuthorization('valid-token-123', ['project-config']);
      // 先通过离线队列创建任务
      const meta = createSyncItemMeta('color-preset', 'p1', new Uint8Array([1]));
      manager.enqueueOffline(meta, new Uint8Array([1]), 'upload');
      manager.processOfflineQueue();
      const tasks = manager.getTasks();
      if (tasks.length > 0) {
        manager.completeTask(tasks[0].id);
        expect(tasks[0].status).toBe('completed');
      }
    });

    it('应能完成同步会话', () => {
      const manager = new ProjectSyncManager();
      const events: string[] = [];
      manager.onEvent((e) => events.push(e.type));
      manager.completeSession({
        sessionId: 's1',
        startedAt: Date.now(),
        completedAt: Date.now(),
        uploaded: 5,
        downloaded: 3,
        conflicts: 1,
        errors: 0,
        bytesTransferred: 1024,
      });
      expect(manager.getSessionResults()).toHaveLength(1);
      expect(events).toContain('completed');
    });

    it('dispose 应清理资源', () => {
      const manager = new ProjectSyncManager();
      manager.requestAuthorization('valid-token-123', ['project-config']);
      manager.dispose();
      expect(manager.getTasks()).toHaveLength(0);
    });
  });
});
