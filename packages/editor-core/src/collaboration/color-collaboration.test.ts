/**
 * color-collaboration.ts 单元测试
 * 覆盖会话管理、OT 冲突检测/变换、权限验证、评论系统、序列化等核心逻辑
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
  type ColorCollabOperation,
  type ColorCollabUser,
  type ColorCollabSessionState,
} from './color-collaboration';

describe('color-collaboration', () => {
  const makeUser = (id: string, role: 'owner' | 'editor' | 'viewer' | 'commenter' = 'editor'): ColorCollabUser =>
    createCollabUser(id, `User ${id}`, role);

  const makeSession = (userIds: string[] = ['u1', 'u2']): ColorCollabSessionState => {
    const config = createDefaultCollabSessionConfig('sess1', 'proj1', userIds[0]);
    let state = createEmptyCollabSessionState(config);
    for (const id of userIds) {
      const result = addUserToSession(state, makeUser(id));
      state = result.state;
    }
    return state;
  };

  const makeOp = (
    userId: string,
    nodeId = 'node1',
    param = 'lift.r',
    prev = 0,
    next = 1,
    baseVersion = 0,
  ): ColorCollabOperation =>
    createColorCollabOperation('wheel-adjust', userId, nodeId, param, prev, next, baseVersion);

  // ─── 工厂函数 ───────────────────────────────────────────────────────
  describe('createDefaultCollabSessionConfig', () => {
    it('创建默认配置', () => {
      const config = createDefaultCollabSessionConfig('s1', 'p1', 'u1');
      expect(config.sessionId).toBe('s1');
      expect(config.projectId).toBe('p1');
      expect(config.hostUserId).toBe('u1');
      expect(config.maxUsers).toBe(8);
    });
  });

  describe('createCollabUser', () => {
    it('创建默认用户', () => {
      const user = createCollabUser('u1', 'Alice');
      expect(user.userId).toBe('u1');
      expect(user.userName).toBe('Alice');
      expect(user.role).toBe('editor');
      expect(user.isOnline).toBe(true);
    });

    it('使用指定角色和颜色索引', () => {
      const user = createCollabUser('u2', 'Bob', 'viewer', 3);
      expect(user.role).toBe('viewer');
      expect(user.color).toBeDefined();
    });
  });

  describe('createColorCollabOperation', () => {
    it('创建操作并自动递增版本', () => {
      const op = createColorCollabOperation('wheel-adjust', 'u1', 'n1', 'lift.r', 0, 1, 5);
      expect(op.version).toBe(6);
      expect(op.baseVersion).toBe(5);
      expect(op.type).toBe('wheel-adjust');
    });
  });

  // ─── 验证 ───────────────────────────────────────────────────────────
  describe('validateCollabRole', () => {
    it('有效角色返回 true', () => {
      expect(validateCollabRole('owner')).toBe(true);
      expect(validateCollabRole('editor')).toBe(true);
      expect(validateCollabRole('viewer')).toBe(true);
      expect(validateCollabRole('commenter')).toBe(true);
    });

    it('无效角色返回 false', () => {
      expect(validateCollabRole('admin')).toBe(false);
      expect(validateCollabRole('')).toBe(false);
    });
  });

  describe('validateCollabOperation', () => {
    it('编辑者有效操作通过验证', () => {
      const user = makeUser('u1', 'editor');
      const op = makeOp('u1');
      expect(validateCollabOperation(op, user, 5).valid).toBe(true);
    });

    it('查看者被拒绝', () => {
      const user = makeUser('u1', 'viewer');
      const op = makeOp('u1');
      expect(validateCollabOperation(op, user, 5).valid).toBe(false);
    });

    it('基础版本超过当前版本被拒绝', () => {
      const user = makeUser('u1', 'editor');
      const op = makeOp('u1', 'n1', 'p', 0, 1, 10);
      expect(validateCollabOperation(op, user, 5).valid).toBe(false);
    });

    it('NaN 值被拒绝', () => {
      const user = makeUser('u1', 'editor');
      const op = makeOp('u1', 'n1', 'p', 0, NaN, 0);
      expect(validateCollabOperation(op, user, 5).valid).toBe(false);
    });

    it('Infinity 值被拒绝', () => {
      const user = makeUser('u1', 'editor');
      const op = makeOp('u1', 'n1', 'p', 0, Infinity, 0);
      expect(validateCollabOperation(op, user, 5).valid).toBe(false);
    });
  });

  // ─── OT 冲突检测 ────────────────────────────────────────────────────
  describe('detectConflict', () => {
    it('同节点同参数同版本不同用户检测为冲突', () => {
      const opA = makeOp('u1', 'n1', 'lift.r', 0, 1, 0);
      opA.timestamp = 100;
      const opB = makeOp('u2', 'n1', 'lift.r', 0, 2, 0);
      opB.timestamp = 200;
      const conflict = detectConflict(opA, opB);
      expect(conflict).not.toBeNull();
      expect(conflict!.conflictType).toBe('same-parameter');
    });

    it('同用户同参数不检测为冲突', () => {
      const opA = makeOp('u1', 'n1', 'lift.r', 0, 1, 0);
      const opB = makeOp('u1', 'n1', 'lift.r', 0, 2, 0);
      expect(detectConflict(opA, opB)).toBeNull();
    });

    it('不同节点不检测为冲突', () => {
      const opA = makeOp('u1', 'n1', 'lift.r', 0, 1, 0);
      const opB = makeOp('u2', 'n2', 'lift.r', 0, 2, 0);
      expect(detectConflict(opA, opB)).toBeNull();
    });

    it('node-remove 操作检测为结构性冲突', () => {
      const opA = createColorCollabOperation('node-remove', 'u1', 'n1', '', null, null, 0);
      const opB = makeOp('u2', 'n1', 'lift.r', 0, 1, 0);
      const conflict = detectConflict(opA, opB);
      expect(conflict).not.toBeNull();
      expect(conflict!.conflictType).toBe('structural');
    });
  });

  // ─── OT 变换 ────────────────────────────────────────────────────────
  describe('transformOperation', () => {
    it('不同节点操作互不影响', () => {
      const op = makeOp('u1', 'n1', 'lift.r', 0, 1, 0);
      const against = makeOp('u2', 'n2', 'lift.r', 0, 2, 0);
      const result = transformOperation(op, against);
      expect(result.applied).toBe(true);
      expect(result.transformed.baseVersion).toBe(1);
    });

    it('同节点不同参数互不影响', () => {
      const op = makeOp('u1', 'n1', 'lift.r', 0, 1, 0);
      const against = makeOp('u2', 'n1', 'gamma.g', 0, 2, 0);
      const result = transformOperation(op, against);
      expect(result.applied).toBe(true);
    });

    it('同参数冲突使用时间戳决定胜负', () => {
      const op = makeOp('u1', 'n1', 'lift.r', 0, 1, 0);
      op.timestamp = 200;
      const against = makeOp('u2', 'n1', 'lift.r', 0, 2, 0);
      against.timestamp = 100;
      const result = transformOperation(op, against);
      expect(result.applied).toBe(true);
      expect(result.conflicts.length).toBeGreaterThan(0);
    });

    it('较旧的操作被拒绝', () => {
      const op = makeOp('u1', 'n1', 'lift.r', 0, 1, 0);
      op.timestamp = 100;
      const against = makeOp('u2', 'n1', 'lift.r', 0, 2, 0);
      against.timestamp = 200;
      const result = transformOperation(op, against);
      expect(result.applied).toBe(false);
    });
  });

  describe('transformOperations', () => {
    it('批量变换多个待处理操作', () => {
      const pending = [makeOp('u1', 'n1', 'lift.r', 0, 1, 0), makeOp('u1', 'n1', 'gamma.g', 0, 1, 0)];
      const applied = [makeOp('u2', 'n1', 'lift.r', 0, 2, 0)];
      const result = transformOperations(pending, applied);
      expect(result.transformed).toHaveLength(2);
    });
  });

  // ─── 会话管理 ───────────────────────────────────────────────────────
  describe('addUserToSession', () => {
    it('成功添加用户', () => {
      const state = makeSession([]);
      const result = addUserToSession(state, makeUser('u1'));
      expect(result.accepted).toBe(true);
      expect(result.state.users).toHaveLength(1);
    });

    it('重复用户被拒绝', () => {
      const state = makeSession(['u1']);
      const result = addUserToSession(state, makeUser('u1'));
      expect(result.accepted).toBe(false);
    });

    it('超过最大用户数被拒绝', () => {
      const config = createDefaultCollabSessionConfig('s1', 'p1', 'u0');
      config.maxUsers = 2;
      let state = createEmptyCollabSessionState(config);
      state = addUserToSession(state, makeUser('u1')).state;
      state = addUserToSession(state, makeUser('u2')).state;
      const result = addUserToSession(state, makeUser('u3'));
      expect(result.accepted).toBe(false);
    });
  });

  describe('removeUserFromSession', () => {
    it('移除用户', () => {
      const state = makeSession(['u1', 'u2']);
      const result = removeUserFromSession(state, 'u1');
      expect(result.users).toHaveLength(1);
      expect(result.users[0].userId).toBe('u2');
    });
  });

  describe('updateUserPresence', () => {
    it('更新在线状态和光标位置', () => {
      const state = makeSession(['u1']);
      const result = updateUserPresence(state, 'u1', true, { nodeId: 'n1', parameter: 'lift.r' });
      expect(result.users[0].cursorPosition).toEqual({ nodeId: 'n1', parameter: 'lift.r' });
    });
  });

  // ─── 操作应用 ───────────────────────────────────────────────────────
  describe('applyOperation', () => {
    it('成功应用操作', () => {
      const state = makeSession(['u1']);
      const op = makeOp('u1');
      const { state: newState, result } = applyOperation(state, op);
      expect(result.applied).toBe(true);
      expect(newState.version).toBe(1);
    });

    it('未知用户操作被拒绝', () => {
      const state = makeSession(['u1']);
      const op = makeOp('unknown');
      const { result } = applyOperation(state, op);
      expect(result.applied).toBe(false);
    });

    it('查看者操作被拒绝', () => {
      const state = makeSession([]);
      const viewerState = addUserToSession(state, makeUser('v1', 'viewer')).state;
      const op = makeOp('v1');
      const { result } = applyOperation(viewerState, op);
      expect(result.applied).toBe(false);
    });
  });

  describe('applyOperations', () => {
    it('批量应用操作', () => {
      const state = makeSession(['u1']);
      const ops = [makeOp('u1', 'n1', 'lift.r', 0, 1, 0), makeOp('u1', 'n1', 'gamma.g', 0, 1, 1)];
      const { state: newState, results } = applyOperations(state, ops);
      expect(results).toHaveLength(2);
      expect(newState.version).toBe(2);
    });
  });

  // ─── 锁定 ──────────────────────────────────────────────────────────
  describe('lockSession / unlockSession', () => {
    it('获取锁定', () => {
      const state = makeSession(['u1']);
      const { state: locked, acquired } = lockSession(state, 'u1');
      expect(acquired).toBe(true);
      expect(locked.isLocked).toBe(true);
      expect(locked.lockedBy).toBe('u1');
    });

    it('其他人无法获取已锁定的会话', () => {
      const state = makeSession(['u1', 'u2']);
      const { state: locked } = lockSession(state, 'u1');
      const { acquired } = lockSession(locked, 'u2');
      expect(acquired).toBe(false);
    });

    it('锁定者可以重复锁定', () => {
      const state = makeSession(['u1']);
      const { state: locked } = lockSession(state, 'u1');
      const { acquired } = lockSession(locked, 'u1');
      expect(acquired).toBe(true);
    });

    it('解锁会话', () => {
      const state = makeSession(['u1']);
      const { state: locked } = lockSession(state, 'u1');
      const unlocked = unlockSession(locked, 'u1');
      expect(unlocked.isLocked).toBe(false);
      expect(unlocked.lockedBy).toBeNull();
    });

    it('非锁定者无法解锁', () => {
      const state = makeSession(['u1', 'u2']);
      const { state: locked } = lockSession(state, 'u1');
      const result = unlockSession(locked, 'u2');
      expect(result.isLocked).toBe(true);
    });
  });

  // ─── 评论系统 ───────────────────────────────────────────────────────
  describe('评论系统', () => {
    it('添加评论', () => {
      const state = makeSession(['u1']);
      const result = addComment(state, 'u1', 'Alice', 'n1', '颜色偏暖');
      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].text).toBe('颜色偏暖');
    });

    it('禁用评论时不添加', () => {
      const config = createDefaultCollabSessionConfig('s1', 'p1', 'u1');
      config.enableComments = false;
      const state = createEmptyCollabSessionState(config);
      const result = addComment(state, 'u1', 'Alice', 'n1', 'test');
      expect(result.comments).toHaveLength(0);
    });

    it('回复评论', () => {
      const state = makeSession(['u1']);
      const withComment = addComment(state, 'u1', 'Alice', 'n1', '颜色偏暖');
      const commentId = withComment.comments[0].id;
      const result = replyToComment(withComment, commentId, 'u2', 'Bob', '同意');
      expect(result.comments[0].replies).toHaveLength(1);
    });

    it('解决评论', () => {
      const state = makeSession(['u1']);
      const withComment = addComment(state, 'u1', 'Alice', 'n1', '颜色偏暖');
      const commentId = withComment.comments[0].id;
      const result = resolveComment(withComment, commentId);
      expect(result.comments[0].resolved).toBe(true);
    });

    it('获取节点评论（不含已解决）', () => {
      let state = makeSession(['u1']);
      state = addComment(state, 'u1', 'Alice', 'n1', 'comment1');
      state = addComment(state, 'u1', 'Alice', 'n1', 'comment2');
      state = resolveComment(state, state.comments[0].id);
      const comments = getCommentsForNode(state, 'n1');
      expect(comments).toHaveLength(1);
    });
  });

  // ─── 撤销 ──────────────────────────────────────────────────────────
  describe('undoLastOperation', () => {
    it('撤销最后操作', () => {
      let state = makeSession(['u1']);
      const op = makeOp('u1', 'n1', 'lift.r', 0, 1, 0);
      state = applyOperation(state, op).state;
      const { state: undone, undone: lastOp } = undoLastOperation(state, 'u1');
      expect(lastOp).not.toBeNull();
      expect(undone.version).toBe(2);
    });

    it('无操作时返回 null', () => {
      const state = makeSession(['u1']);
      const { undone } = undoLastOperation(state, 'u1');
      expect(undone).toBeNull();
    });
  });

  // ─── 序列化 ─────────────────────────────────────────────────────────
  describe('序列化', () => {
    it('操作序列化/反序列化往返', () => {
      const op = makeOp('u1');
      const json = serializeOperation(op);
      const parsed = parseOperation(json);
      expect(parsed).not.toBeNull();
      expect(parsed!.id).toBe(op.id);
    });

    it('无效 JSON 返回 null', () => {
      expect(parseOperation('not json')).toBeNull();
    });

    it('缺少必要字段返回 null', () => {
      expect(parseOperation(JSON.stringify({ id: 'x' }))).toBeNull();
    });

    it('会话快照序列化/反序列化往返', () => {
      const state = makeSession(['u1', 'u2']);
      const json = serializeSessionSnapshot(state);
      const restored = deserializeSessionSnapshot(json);
      expect(restored).not.toBeNull();
      expect(restored!.version).toBe(state.version);
      expect(restored!.users).toHaveLength(2);
    });

    it('无效快照返回 null', () => {
      expect(deserializeSessionSnapshot('not json')).toBeNull();
      expect(deserializeSessionSnapshot(JSON.stringify({}))).toBeNull();
    });
  });

  // ─── ColorCollaborationManager ──────────────────────────────────────
  describe('ColorCollaborationManager', () => {
    it('创建管理器并加入用户', () => {
      const config = createDefaultCollabSessionConfig('s1', 'p1', 'u1');
      const manager = new ColorCollaborationManager(config);
      expect(manager.joinUser('u1', 'Alice')).toBe(true);
      expect(manager.getState().users).toHaveLength(1);
    });

    it('用户离开', () => {
      const config = createDefaultCollabSessionConfig('s1', 'p1', 'u1');
      const manager = new ColorCollaborationManager(config);
      manager.joinUser('u1', 'Alice');
      manager.leaveUser('u1');
      expect(manager.getState().users).toHaveLength(0);
    });

    it('提交操作', () => {
      const config = createDefaultCollabSessionConfig('s1', 'p1', 'u1');
      const manager = new ColorCollaborationManager(config);
      manager.joinUser('u1', 'Alice');
      const op = makeOp('u1');
      const result = manager.submitOperation(op);
      expect(result.applied).toBe(true);
    });

    it('添加评论', () => {
      const config = createDefaultCollabSessionConfig('s1', 'p1', 'u1');
      const manager = new ColorCollaborationManager(config);
      manager.addComment('u1', 'Alice', 'n1', 'test');
      expect(manager.getState().comments).toHaveLength(1);
    });

    it('撤销操作', () => {
      const config = createDefaultCollabSessionConfig('s1', 'p1', 'u1');
      const manager = new ColorCollaborationManager(config);
      manager.joinUser('u1', 'Alice');
      manager.submitOperation(makeOp('u1'));
      const undone = manager.undo('u1');
      expect(undone).not.toBeNull();
    });

    it('锁定/解锁', () => {
      const config = createDefaultCollabSessionConfig('s1', 'p1', 'u1');
      const manager = new ColorCollaborationManager(config);
      expect(manager.lock('u1')).toBe(true);
      manager.unlock('u1');
      expect(manager.getState().isLocked).toBe(false);
    });

    it('导出/导入快照', () => {
      const config = createDefaultCollabSessionConfig('s1', 'p1', 'u1');
      const manager = new ColorCollaborationManager(config);
      manager.joinUser('u1', 'Alice');
      const snapshot = manager.exportSnapshot();
      const newManager = new ColorCollaborationManager(config);
      expect(newManager.importSnapshot(snapshot)).toBe(true);
      expect(newManager.getState().users).toHaveLength(1);
    });

    it('事件订阅/取消', () => {
      const config = createDefaultCollabSessionConfig('s1', 'p1', 'u1');
      const manager = new ColorCollaborationManager(config);
      const events: unknown[] = [];
      const unsub = manager.onEvent((e) => events.push(e));
      manager.joinUser('u1', 'Alice');
      expect(events.length).toBeGreaterThan(0);
      unsub();
    });

    it('销毁后清理资源', () => {
      const config = createDefaultCollabSessionConfig('s1', 'p1', 'u1');
      const manager = new ColorCollaborationManager(config);
      manager.dispose();
      // 不应抛出异常
    });
  });
});
