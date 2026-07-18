/**
 * 协作调色模块测试
 */
import { describe, it, expect } from 'vitest';
import {
  createDefaultCollabSessionConfig,
  createEmptyCollabSessionState,
  createCollabUser,
  createColorCollabOperation,
  validateCollabOperation,
  validateCollabRole,
  detectConflict,
  transformOperation,
  transformOperations,
  addUserToSession,
  removeUserFromSession,
  updateUserPresence,
  applyOperation,
  applyOperations,
  lockSession,
  unlockSession,
  addComment,
  replyToComment,
  resolveComment,
  getCommentsForNode,
  undoLastOperation,
  serializeOperation,
  parseOperation,
  serializeSessionSnapshot,
  deserializeSessionSnapshot,
  ColorCollaborationManager,
} from '../../src/collaboration/color-collaboration';
import type { ColorCollabOperation, ColorCollabUser } from '../../src/collaboration/color-collaboration';

describe('协作调色模块', () => {
  const defaultConfig = createDefaultCollabSessionConfig('sess-1', 'proj-1', 'host-1');

  describe('工厂函数', () => {
    it('createDefaultCollabSessionConfig 应设置默认值', () => {
      const config = createDefaultCollabSessionConfig('s1', 'p1', 'h1');
      expect(config.sessionId).toBe('s1');
      expect(config.projectId).toBe('p1');
      expect(config.hostUserId).toBe('h1');
      expect(config.maxUsers).toBe(8);
      expect(config.conflictResolution).toBe('ot-rebase');
    });

    it('createEmptyCollabSessionState 应创建空状态', () => {
      const state = createEmptyCollabSessionState(defaultConfig);
      expect(state.users).toHaveLength(0);
      expect(state.version).toBe(0);
      expect(state.operations).toHaveLength(0);
      expect(state.comments).toHaveLength(0);
      expect(state.isLocked).toBe(false);
    });

    it('createCollabUser 应分配颜色', () => {
      const user = createCollabUser('u1', 'Alice', 'editor', 0);
      expect(user.userId).toBe('u1');
      expect(user.userName).toBe('Alice');
      expect(user.color).toBe('#38bdf8');
      expect(user.isOnline).toBe(true);
    });

    it('createColorCollabOperation 应递增版本', () => {
      const op = createColorCollabOperation('wheel-adjust', 'u1', 'node1', 'lift.r', 0, 0.5, 3);
      expect(op.version).toBe(4);
      expect(op.baseVersion).toBe(3);
      expect(op.targetNodeId).toBe('node1');
    });
  });

  describe('角色验证', () => {
    it('应接受有效角色', () => {
      expect(validateCollabRole('owner')).toBe(true);
      expect(validateCollabRole('editor')).toBe(true);
      expect(validateCollabRole('viewer')).toBe(true);
      expect(validateCollabRole('commenter')).toBe(true);
    });

    it('应拒绝无效角色', () => {
      expect(validateCollabRole('admin')).toBe(false);
      expect(validateCollabRole('')).toBe(false);
    });
  });

  describe('操作验证', () => {
    it('查看者不应能提交修改操作', () => {
      const user = createCollabUser('u1', 'Viewer', 'viewer');
      const op = createColorCollabOperation('wheel-adjust', 'u1', 'n1', 'lift.r', 0, 0.5, 0);
      const result = validateCollabOperation(op, user, 10);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('查看者');
    });

    it('编辑者应能提交修改操作', () => {
      const user = createCollabUser('u1', 'Editor', 'editor');
      const op = createColorCollabOperation('wheel-adjust', 'u1', 'n1', 'lift.r', 0, 0.5, 5);
      const result = validateCollabOperation(op, user, 10);
      expect(result.valid).toBe(true);
    });

    it('应拒绝超出当前版本的操作', () => {
      const user = createCollabUser('u1', 'Editor', 'editor');
      const op = createColorCollabOperation('wheel-adjust', 'u1', 'n1', 'lift.r', 0, 0.5, 20);
      const result = validateCollabOperation(op, user, 10);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('版本');
    });

    it('应拒绝 NaN 值', () => {
      const user = createCollabUser('u1', 'Editor', 'editor');
      const op = createColorCollabOperation('parameter-set', 'u1', 'n1', 'lift.r', 0, NaN, 0);
      const result = validateCollabOperation(op, user, 10);
      expect(result.valid).toBe(false);
    });
  });

  describe('冲突检测', () => {
    it('应检测同参数并发冲突', () => {
      const opA = createColorCollabOperation('wheel-adjust', 'u1', 'n1', 'lift.r', 0, 0.5, 5);
      const opB = createColorCollabOperation('wheel-adjust', 'u2', 'n1', 'lift.r', 0, 0.8, 5);
      const conflict = detectConflict(opA, opB);
      expect(conflict).not.toBeNull();
      expect(conflict!.conflictType).toBe('same-parameter');
    });

    it('应检测结构性冲突', () => {
      const opA = createColorCollabOperation('node-remove', 'u1', 'n1', '', null, null, 5);
      const opB = createColorCollabOperation('wheel-adjust', 'u2', 'n1', 'lift.r', 0, 0.5, 5);
      const conflict = detectConflict(opA, opB);
      expect(conflict).not.toBeNull();
      expect(conflict!.conflictType).toBe('structural');
    });

    it('不应误报不同参数的冲突', () => {
      const opA = createColorCollabOperation('wheel-adjust', 'u1', 'n1', 'lift.r', 0, 0.5, 5);
      const opB = createColorCollabOperation('wheel-adjust', 'u2', 'n1', 'gamma.g', 0, 0.3, 5);
      expect(detectConflict(opA, opB)).toBeNull();
    });

    it('不应误报不同节点的冲突', () => {
      const opA = createColorCollabOperation('wheel-adjust', 'u1', 'n1', 'lift.r', 0, 0.5, 5);
      const opB = createColorCollabOperation('wheel-adjust', 'u2', 'n2', 'lift.r', 0, 0.8, 5);
      expect(detectConflict(opA, opB)).toBeNull();
    });
  });

  describe('OT 变换', () => {
    it('不同节点的操作应直接通过', () => {
      const op = createColorCollabOperation('wheel-adjust', 'u1', 'n1', 'lift.r', 0, 0.5, 3);
      const against = createColorCollabOperation('wheel-adjust', 'u2', 'n2', 'gamma.g', 0, 0.3, 3);
      const result = transformOperation(op, against);
      expect(result.applied).toBe(true);
      expect(result.transformed.baseVersion).toBe(4);
    });

    it('同节点不同参数应通过', () => {
      const op = createColorCollabOperation('wheel-adjust', 'u1', 'n1', 'lift.r', 0, 0.5, 3);
      const against = createColorCollabOperation('wheel-adjust', 'u2', 'n1', 'gamma.g', 0, 0.3, 3);
      const result = transformOperation(op, against);
      expect(result.applied).toBe(true);
    });

    it('同参数冲突应使用时间戳解决', () => {
      const opA = createColorCollabOperation('wheel-adjust', 'u1', 'n1', 'lift.r', 0, 0.5, 5);
      opA.timestamp = 1000;
      const opB = createColorCollabOperation('wheel-adjust', 'u2', 'n1', 'lift.r', 0, 0.8, 5);
      opB.timestamp = 2000;

      const result = transformOperation(opA, opB);
      expect(result.conflicts).toHaveLength(1);
      // opA 时间戳更早，应被 opB 覆盖
      expect(result.applied).toBe(false);
    });

    it('批量变换应处理多个操作', () => {
      const pending = [
        createColorCollabOperation('wheel-adjust', 'u1', 'n1', 'lift.r', 0, 0.5, 3),
        createColorCollabOperation('slider-adjust', 'u1', 'n1', 'temperature', 0, 10, 3),
      ];
      const applied = [
        createColorCollabOperation('wheel-adjust', 'u2', 'n2', 'gain.b', 0, 0.2, 3),
      ];
      const result = transformOperations(pending, applied);
      expect(result.transformed).toHaveLength(2);
      expect(result.transformed[0].baseVersion).toBe(4);
    });
  });

  describe('会话管理', () => {
    it('应能添加用户', () => {
      let state = createEmptyCollabSessionState(defaultConfig);
      const user = createCollabUser('u1', 'Alice');
      const { state: newState, accepted } = addUserToSession(state, user);
      expect(accepted).toBe(true);
      expect(newState.users).toHaveLength(1);
    });

    it('不应超过最大用户数', () => {
      const config = createDefaultCollabSessionConfig('s1', 'p1', 'h1');
      config.maxUsers = 2;
      let state = createEmptyCollabSessionState(config);
      state = addUserToSession(state, createCollabUser('u1', 'A')).state;
      state = addUserToSession(state, createCollabUser('u2', 'B')).state;
      const { accepted } = addUserToSession(state, createCollabUser('u3', 'C'));
      expect(accepted).toBe(false);
    });

    it('不应添加重复用户', () => {
      let state = createEmptyCollabSessionState(defaultConfig);
      state = addUserToSession(state, createCollabUser('u1', 'A')).state;
      const { accepted } = addUserToSession(state, createCollabUser('u1', 'A'));
      expect(accepted).toBe(false);
    });

    it('应能移除用户', () => {
      let state = createEmptyCollabSessionState(defaultConfig);
      state = addUserToSession(state, createCollabUser('u1', 'A')).state;
      state = removeUserFromSession(state, 'u1');
      expect(state.users).toHaveLength(0);
    });

    it('应能更新用户在线状态', () => {
      let state = createEmptyCollabSessionState(defaultConfig);
      state = addUserToSession(state, createCollabUser('u1', 'A')).state;
      state = updateUserPresence(state, 'u1', false);
      expect(state.users[0].isOnline).toBe(false);
    });

    it('应能更新光标位置', () => {
      let state = createEmptyCollabSessionState(defaultConfig);
      state = addUserToSession(state, createCollabUser('u1', 'A')).state;
      state = updateUserPresence(state, 'u1', true, { nodeId: 'n1', parameter: 'lift.r' });
      expect(state.users[0].cursorPosition).toEqual({ nodeId: 'n1', parameter: 'lift.r' });
    });
  });

  describe('操作应用', () => {
    it('应能应用有效操作', () => {
      let state = createEmptyCollabSessionState(defaultConfig);
      state = addUserToSession(state, createCollabUser('u1', 'Editor', 'editor')).state;
      const op = createColorCollabOperation('wheel-adjust', 'u1', 'n1', 'lift.r', 0, 0.5, 0);
      const { state: newState, result } = applyOperation(state, op);
      expect(result.applied).toBe(true);
      expect(newState.version).toBe(1);
      expect(newState.operations).toHaveLength(1);
    });

    it('应拒绝未注册用户的操作', () => {
      const state = createEmptyCollabSessionState(defaultConfig);
      const op = createColorCollabOperation('wheel-adjust', 'unknown', 'n1', 'lift.r', 0, 0.5, 0);
      const { result } = applyOperation(state, op);
      expect(result.applied).toBe(false);
    });

    it('批量应用应递增版本', () => {
      let state = createEmptyCollabSessionState(defaultConfig);
      state = addUserToSession(state, createCollabUser('u1', 'Editor', 'editor')).state;
      const ops = [
        createColorCollabOperation('wheel-adjust', 'u1', 'n1', 'lift.r', 0, 0.5, 0),
        createColorCollabOperation('slider-adjust', 'u1', 'n2', 'temperature', 0, 10, 1),
      ];
      const { state: newState } = applyOperations(state, ops);
      expect(newState.version).toBe(2);
    });
  });

  describe('锁定', () => {
    it('应能锁定会话', () => {
      const state = createEmptyCollabSessionState(defaultConfig);
      const { state: locked, acquired } = lockSession(state, 'u1');
      expect(acquired).toBe(true);
      expect(locked.isLocked).toBe(true);
      expect(locked.lockedBy).toBe('u1');
    });

    it('不应允许其他人锁定已锁定的会话', () => {
      let state = createEmptyCollabSessionState(defaultConfig);
      state = lockSession(state, 'u1').state;
      const { acquired } = lockSession(state, 'u2');
      expect(acquired).toBe(false);
    });

    it('同一用户应能重新锁定', () => {
      let state = createEmptyCollabSessionState(defaultConfig);
      state = lockSession(state, 'u1').state;
      const { acquired } = lockSession(state, 'u1');
      expect(acquired).toBe(true);
    });

    it('应能解锁', () => {
      let state = createEmptyCollabSessionState(defaultConfig);
      state = lockSession(state, 'u1').state;
      state = unlockSession(state, 'u1');
      expect(state.isLocked).toBe(false);
    });

    it('非锁定者不应能解锁', () => {
      let state = createEmptyCollabSessionState(defaultConfig);
      state = lockSession(state, 'u1').state;
      const after = unlockSession(state, 'u2');
      expect(after.isLocked).toBe(true);
    });
  });

  describe('评论', () => {
    it('应能添加评论', () => {
      const state = createEmptyCollabSessionState(defaultConfig);
      const newState = addComment(state, 'u1', 'Alice', 'n1', '颜色偏暖');
      expect(newState.comments).toHaveLength(1);
      expect(newState.comments[0].text).toBe('颜色偏暖');
    });

    it('应能回复评论', () => {
      let state = createEmptyCollabSessionState(defaultConfig);
      state = addComment(state, 'u1', 'Alice', 'n1', '颜色偏暖');
      const commentId = state.comments[0].id;
      state = replyToComment(state, commentId, 'u2', 'Bob', '已调整');
      expect(state.comments[0].replies).toHaveLength(1);
    });

    it('应能解决评论', () => {
      let state = createEmptyCollabSessionState(defaultConfig);
      state = addComment(state, 'u1', 'Alice', 'n1', '颜色偏暖');
      const commentId = state.comments[0].id;
      state = resolveComment(state, commentId);
      expect(state.comments[0].resolved).toBe(true);
    });

    it('getCommentsForNode 应只返回未解决的评论', () => {
      let state = createEmptyCollabSessionState(defaultConfig);
      state = addComment(state, 'u1', 'Alice', 'n1', '评论1');
      state = addComment(state, 'u2', 'Bob', 'n1', '评论2');
      state = resolveComment(state, state.comments[0].id);
      const comments = getCommentsForNode(state, 'n1');
      expect(comments).toHaveLength(1);
      expect(comments[0].text).toBe('评论2');
    });
  });

  describe('撤销', () => {
    it('应能撤销最后操作', () => {
      let state = createEmptyCollabSessionState(defaultConfig);
      state = addUserToSession(state, createCollabUser('u1', 'Editor', 'editor')).state;
      const op = createColorCollabOperation('wheel-adjust', 'u1', 'n1', 'lift.r', 0, 0.5, 0);
      state = applyOperation(state, op).state;
      const { state: undone, undone: lastOp } = undoLastOperation(state, 'u1');
      expect(lastOp).not.toBeNull();
      expect(undone.version).toBe(2); // undo 也是操作
    });

    it('无操作时撤销应返回 null', () => {
      const state = createEmptyCollabSessionState(defaultConfig);
      const { undone } = undoLastOperation(state, 'u1');
      expect(undone).toBeNull();
    });
  });

  describe('序列化', () => {
    it('应能序列化和解析操作', () => {
      const op = createColorCollabOperation('wheel-adjust', 'u1', 'n1', 'lift.r', 0, 0.5, 3);
      const json = serializeOperation(op);
      const parsed = parseOperation(json);
      expect(parsed).not.toBeNull();
      expect(parsed!.id).toBe(op.id);
      expect(parsed!.type).toBe('wheel-adjust');
    });

    it('无效 JSON 应返回 null', () => {
      expect(parseOperation('invalid')).toBeNull();
    });

    it('缺少必要字段应返回 null', () => {
      expect(parseOperation('{}')).toBeNull();
      expect(parseOperation('{"id":"x","type":"wheel-adjust"}')).toBeNull();
    });

    it('应能序列化和反序列化会话快照', () => {
      let state = createEmptyCollabSessionState(defaultConfig);
      state = addUserToSession(state, createCollabUser('u1', 'Alice')).state;
      state = addComment(state, 'u1', 'Alice', 'n1', '测试评论');

      const json = serializeSessionSnapshot(state);
      const restored = deserializeSessionSnapshot(json);
      expect(restored).not.toBeNull();
      expect(restored!.users).toHaveLength(1);
      expect(restored!.comments).toHaveLength(1);
    });

    it('无效快照应返回 null', () => {
      expect(deserializeSessionSnapshot('invalid')).toBeNull();
      expect(deserializeSessionSnapshot('{}')).toBeNull();
    });
  });

  describe('ColorCollaborationManager', () => {
    it('应能创建实例', () => {
      const manager = new ColorCollaborationManager(defaultConfig);
      expect(manager.getState().version).toBe(0);
    });

    it('应能加入和离开用户', () => {
      const manager = new ColorCollaborationManager(defaultConfig);
      expect(manager.joinUser('u1', 'Alice')).toBe(true);
      expect(manager.getState().users).toHaveLength(1);
      manager.leaveUser('u1');
      expect(manager.getState().users).toHaveLength(0);
    });

    it('应能提交操作', () => {
      const manager = new ColorCollaborationManager(defaultConfig);
      manager.joinUser('u1', 'Editor', 'editor');
      const op = createColorCollabOperation('wheel-adjust', 'u1', 'n1', 'lift.r', 0, 0.5, 0);
      const result = manager.submitOperation(op);
      expect(result.applied).toBe(true);
      expect(manager.getState().version).toBe(1);
    });

    it('应能触发事件', () => {
      const manager = new ColorCollaborationManager(defaultConfig);
      const events: string[] = [];
      manager.onEvent((e) => events.push(e.type));
      manager.joinUser('u1', 'Alice');
      expect(events).toContain('user-joined');
    });

    it('应能添加评论', () => {
      const manager = new ColorCollaborationManager(defaultConfig);
      manager.joinUser('u1', 'Alice');
      manager.addComment('u1', 'Alice', 'n1', '颜色偏暖');
      expect(manager.getState().comments).toHaveLength(1);
    });

    it('应能锁定和解锁', () => {
      const manager = new ColorCollaborationManager(defaultConfig);
      expect(manager.lock('u1')).toBe(true);
      expect(manager.getState().isLocked).toBe(true);
      manager.unlock('u1');
      expect(manager.getState().isLocked).toBe(false);
    });

    it('应能导出和导入快照', () => {
      const manager = new ColorCollaborationManager(defaultConfig);
      manager.joinUser('u1', 'Alice');
      const snapshot = manager.exportSnapshot();
      const newManager = new ColorCollaborationManager(defaultConfig);
      expect(newManager.importSnapshot(snapshot)).toBe(true);
      expect(newManager.getState().users).toHaveLength(1);
    });

    it('应能撤销', () => {
      const manager = new ColorCollaborationManager(defaultConfig);
      manager.joinUser('u1', 'Editor', 'editor');
      const op = createColorCollabOperation('wheel-adjust', 'u1', 'n1', 'lift.r', 0, 0.5, 0);
      manager.submitOperation(op);
      const undone = manager.undo('u1');
      expect(undone).not.toBeNull();
    });

    it('dispose 应清理资源', () => {
      const manager = new ColorCollaborationManager(defaultConfig);
      manager.joinUser('u1', 'Alice');
      manager.dispose();
      // 不应抛出异常
    });
  });
});
