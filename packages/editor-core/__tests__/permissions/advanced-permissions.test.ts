import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AdvancedPermissionManager,
  createPermissionManager,
  comparePermissionLevels,
  hasSufficientPermission,
  getHighestPermission,
  isPermissionExpired,
  isTemporaryPermissionValid,
  calculateInheritedPermission,
  validatePermissionRule,
  createPermissionRule,
  serializePermissionState,
  parsePermissionState,
  restorePermissionManager,
  type PermissionLevel,
  type PermissionSubject,
  type PermissionTarget,
  type PermissionRule,
} from '../../src/permissions/advanced-permissions';

describe('AdvancedPermissionManager', () => {
  let manager: AdvancedPermissionManager;
  let user: PermissionSubject;
  let target: PermissionTarget;

  beforeEach(() => {
    manager = createPermissionManager();
    user = { type: 'user', id: 'user1', name: '用户1' };
    target = { type: 'project', id: 'proj1', name: '项目1' };
  });

  describe('权限规则管理', () => {
    it('应该成功添加权限规则', () => {
      const rule = manager.addRule(
        {
          subject: user,
          target,
          level: 'write',
          grantedBy: 'admin',
          grantedAt: new Date().toISOString(),
        },
        'admin',
        '管理员',
      );

      expect(rule).toBeTruthy();
      expect(rule!.level).toBe('write');
      expect(manager.getState().rules).toHaveLength(1);
    });

    it('应该成功移除权限规则', () => {
      const rule = manager.addRule(
        {
          subject: user,
          target,
          level: 'write',
          grantedBy: 'admin',
          grantedAt: new Date().toISOString(),
        },
        'admin',
        '管理员',
      );

      const result = manager.removeRule(rule!.id, 'admin', '管理员');

      expect(result).toBe(true);
      expect(manager.getState().rules).toHaveLength(0);
    });

    it('应该成功修改权限规则', () => {
      const rule = manager.addRule(
        {
          subject: user,
          target,
          level: 'read',
          grantedBy: 'admin',
          grantedAt: new Date().toISOString(),
        },
        'admin',
        '管理员',
      );

      const modified = manager.modifyRule(
        rule!.id,
        { level: 'write' },
        'admin',
        '管理员',
      );

      expect(modified).toBeTruthy();
      expect(modified!.level).toBe('write');
    });

    it('应该拒绝无效的权限规则', () => {
      const rule = manager.addRule(
        {
          subject: { type: 'user', id: '', name: '' },
          target,
          level: 'write',
          grantedBy: 'admin',
          grantedAt: new Date().toISOString(),
        },
        'admin',
        '管理员',
      );

      expect(rule).toBeNull();
    });
  });

  describe('权限评估', () => {
    it('应该允许有足够权限的操作', () => {
      manager.addRule(
        {
          subject: user,
          target,
          level: 'write',
          grantedBy: 'admin',
          grantedAt: new Date().toISOString(),
        },
        'admin',
        '管理员',
      );

      const result = manager.evaluate(user, target, 'read');

      expect(result.allowed).toBe(true);
      expect(result.level).toBe('write');
    });

    it('应该拒绝权限不足的操作', () => {
      manager.addRule(
        {
          subject: user,
          target,
          level: 'read',
          grantedBy: 'admin',
          grantedAt: new Date().toISOString(),
        },
        'admin',
        '管理员',
      );

      const result = manager.evaluate(user, target, 'write');

      expect(result.allowed).toBe(false);
    });

    it('应该使用默认权限级别', () => {
      manager.updateConfig({ defaultLevel: 'read' });

      const result = manager.evaluate(user, target, 'read');

      expect(result.allowed).toBe(true);
    });

    it('应该使用最高权限级别', () => {
      manager.addRule(
        {
          subject: user,
          target,
          level: 'read',
          grantedBy: 'admin',
          grantedAt: new Date().toISOString(),
        },
        'admin',
        '管理员',
      );

      manager.addRule(
        {
          subject: user,
          target,
          level: 'write',
          grantedBy: 'admin',
          grantedAt: new Date().toISOString(),
        },
        'admin',
        '管理员',
      );

      const result = manager.evaluate(user, target, 'write');

      expect(result.allowed).toBe(true);
      expect(result.level).toBe('write');
    });

    it('应该缓存评估结果', () => {
      manager.addRule(
        {
          subject: user,
          target,
          level: 'write',
          grantedBy: 'admin',
          grantedAt: new Date().toISOString(),
        },
        'admin',
        '管理员',
      );

      const result1 = manager.evaluate(user, target, 'read');
      const result2 = manager.evaluate(user, target, 'read');

      expect(result1).toBe(result2);
    });
  });

  describe('权限组管理', () => {
    it('应该成功创建权限组', () => {
      const group = manager.createGroup('编辑组', '项目编辑人员', 'admin', '管理员');

      expect(group).toBeTruthy();
      expect(group.name).toBe('编辑组');
      expect(manager.getState().groups).toHaveLength(1);
    });

    it('应该成功添加组成员', () => {
      const group = manager.createGroup('编辑组', '', 'admin', '管理员');
      const result = manager.addGroupMember(group.id, user, 'admin', '管理员');

      expect(result).toBe(true);
      expect(manager.getState().groups[0].members).toHaveLength(1);
    });

    it('应该成功移除组成员', () => {
      const group = manager.createGroup('编辑组', '', 'admin', '管理员');
      manager.addGroupMember(group.id, user, 'admin', '管理员');

      const result = manager.removeGroupMember(group.id, user.id, user.type, 'admin', '管理员');

      expect(result).toBe(true);
      expect(manager.getState().groups[0].members).toHaveLength(0);
    });

    it('应该成功删除权限组', () => {
      const group = manager.createGroup('编辑组', '', 'admin', '管理员');

      const result = manager.deleteGroup(group.id, 'admin', '管理员');

      expect(result).toBe(true);
      expect(manager.getState().groups).toHaveLength(0);
    });

    it('应该通过组规则评估权限', () => {
      const group = manager.createGroup('编辑组', '', 'admin', '管理员');
      manager.addGroupMember(group.id, user, 'admin', '管理员');

      const rule = manager.addRule(
        {
          subject: { type: 'group', id: group.id, name: group.name },
          target,
          level: 'write',
          grantedBy: 'admin',
          grantedAt: new Date().toISOString(),
        },
        'admin',
        '管理员',
      );

      manager.addGroupRule(group.id, rule!.id, 'admin', '管理员');

      const result = manager.evaluate(user, target, 'write');

      expect(result.allowed).toBe(true);
    });
  });

  describe('临时权限', () => {
    it('应该成功创建临时权限', () => {
      const tempPerm = manager.createTemporaryPermission(
        user,
        target,
        'write',
        24,
        '临时编辑需求',
        'admin',
        '管理员',
      );

      expect(tempPerm).toBeTruthy();
      expect(manager.getState().temporaryPermissions).toHaveLength(1);
    });

    it('应该成功撤销临时权限', () => {
      const tempPerm = manager.createTemporaryPermission(
        user,
        target,
        'write',
        24,
        '临时编辑需求',
        'admin',
        '管理员',
      );

      const result = manager.revokeTemporaryPermission(tempPerm!.id, 'admin', '管理员');

      expect(result).toBe(true);
      expect(manager.getState().temporaryPermissions[0].revokedAt).toBeTruthy();
    });

    it('应该拒绝超过最大时长的临时权限', () => {
      manager.updateConfig({ maxTemporaryDurationHours: 24 });

      const tempPerm = manager.createTemporaryPermission(
        user,
        target,
        'write',
        48,
        '需求',
        'admin',
        '管理员',
      );

      expect(tempPerm).toBeNull();
    });

    it('应该在禁用时拒绝临时权限', () => {
      manager.updateConfig({ enableTemporaryPermissions: false });

      const tempPerm = manager.createTemporaryPermission(
        user,
        target,
        'write',
        24,
        '需求',
        'admin',
        '管理员',
      );

      expect(tempPerm).toBeNull();
    });
  });

  describe('审计日志', () => {
    it('应该记录权限操作', () => {
      manager.addRule(
        {
          subject: user,
          target,
          level: 'write',
          grantedBy: 'admin',
          grantedAt: new Date().toISOString(),
        },
        'admin',
        '管理员',
      );

      const logs = manager.getAuditLog();
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('permission.granted');
    });

    it('应该支持过滤审计日志', () => {
      manager.addRule(
        {
          subject: user,
          target,
          level: 'write',
          grantedBy: 'admin',
          grantedAt: new Date().toISOString(),
        },
        'admin',
        '管理员',
      );

      manager.addRule(
        {
          subject: { type: 'user', id: 'user2', name: '用户2' },
          target,
          level: 'read',
          grantedBy: 'admin',
          grantedAt: new Date().toISOString(),
        },
        'admin2',
        '管理员2',
      );

      // 使用操作者ID进行过滤
      const logs = manager.getAuditLog({ userId: 'admin' });
      expect(logs).toHaveLength(1);
    });

    it('应该限制返回数量', () => {
      for (let i = 0; i < 5; i++) {
        manager.addRule(
          {
            subject: { type: 'user', id: `user${i}`, name: `用户${i}` },
            target,
            level: 'read',
            grantedBy: 'admin',
            grantedAt: new Date().toISOString(),
          },
          'admin',
          '管理员',
        );
      }

      const logs = manager.getAuditLog({ limit: 3 });
      expect(logs).toHaveLength(3);
    });
  });

  describe('配置管理', () => {
    it('应该成功更新配置', () => {
      manager.updateConfig({
        defaultLevel: 'read',
        auditEnabled: false,
      });

      const config = manager.getConfig();
      expect(config.defaultLevel).toBe('read');
      expect(config.auditEnabled).toBe(false);
    });

    it('应该清除缓存当配置更新', () => {
      manager.addRule(
        {
          subject: user,
          target,
          level: 'write',
          grantedBy: 'admin',
          grantedAt: new Date().toISOString(),
        },
        'admin',
        '管理员',
      );

      // 评估以填充缓存
      manager.evaluate(user, target, 'read');

      // 更新配置应该清除缓存
      manager.updateConfig({ defaultLevel: 'admin' });

      // 重新评估应该使用新配置
      const result = manager.evaluate(user, target, 'write');
      expect(result.allowed).toBe(true);
    });
  });

  describe('状态导出导入', () => {
    it('应该成功导出状态', () => {
      manager.addRule(
        {
          subject: user,
          target,
          level: 'write',
          grantedBy: 'admin',
          grantedAt: new Date().toISOString(),
        },
        'admin',
        '管理员',
      );

      const exported = manager.exportState();

      expect(exported).toBeTruthy();
      expect(JSON.parse(exported).rules).toHaveLength(1);
    });

    it('应该成功导入状态', () => {
      manager.addRule(
        {
          subject: user,
          target,
          level: 'write',
          grantedBy: 'admin',
          grantedAt: new Date().toISOString(),
        },
        'admin',
        '管理员',
      );

      const exported = manager.exportState();

      const newManager = createPermissionManager();
      const result = newManager.importState(exported);

      expect(result).toBe(true);
      expect(newManager.getState().rules).toHaveLength(1);
    });

    it('应该拒绝无效的状态', () => {
      const result = manager.importState('invalid json');

      expect(result).toBe(false);
    });

    it('应该能够从状态恢复管理器', () => {
      manager.addRule(
        {
          subject: user,
          target,
          level: 'write',
          grantedBy: 'admin',
          grantedAt: new Date().toISOString(),
        },
        'admin',
        '管理员',
      );

      const exported = manager.exportState();
      const restored = restorePermissionManager(exported);

      expect(restored).toBeTruthy();
      expect(restored!.getState().rules).toHaveLength(1);
    });
  });

  describe('事件系统', () => {
    it('应该触发规则添加事件', () => {
      const handler = vi.fn();
      manager.on('rule.added', handler);

      manager.addRule(
        {
          subject: user,
          target,
          level: 'write',
          grantedBy: 'admin',
          grantedAt: new Date().toISOString(),
        },
        'admin',
        '管理员',
      );

      expect(handler).toHaveBeenCalledOnce();
    });

    it('应该触发规则移除事件', () => {
      const rule = manager.addRule(
        {
          subject: user,
          target,
          level: 'write',
          grantedBy: 'admin',
          grantedAt: new Date().toISOString(),
        },
        'admin',
        '管理员',
      );

      const handler = vi.fn();
      manager.on('rule.removed', handler);

      manager.removeRule(rule!.id, 'admin', '管理员');

      expect(handler).toHaveBeenCalledOnce();
    });

    it('应该触发权限评估事件', () => {
      const handler = vi.fn();
      manager.on('permission.evaluated', handler);

      manager.evaluate(user, target, 'read');

      expect(handler).toHaveBeenCalledOnce();
    });

    it('应该能够取消事件监听', () => {
      const handler = vi.fn();
      const unsubscribe = manager.on('rule.added', handler);

      unsubscribe();

      manager.addRule(
        {
          subject: user,
          target,
          level: 'write',
          grantedBy: 'admin',
          grantedAt: new Date().toISOString(),
        },
        'admin',
        '管理员',
      );

      expect(handler).not.toHaveBeenCalled();
    });
  });
});

describe('工具函数', () => {
  describe('comparePermissionLevels', () => {
    it('应该正确比较权限级别', () => {
      expect(comparePermissionLevels('none', 'read')).toBeLessThan(0);
      expect(comparePermissionLevels('read', 'write')).toBeLessThan(0);
      expect(comparePermissionLevels('write', 'admin')).toBeLessThan(0);
      expect(comparePermissionLevels('admin', 'owner')).toBeLessThan(0);
      expect(comparePermissionLevels('read', 'read')).toBe(0);
      expect(comparePermissionLevels('write', 'read')).toBeGreaterThan(0);
    });
  });

  describe('hasSufficientPermission', () => {
    it('应该检查权限是否足够', () => {
      expect(hasSufficientPermission('read', 'write')).toBe(true);
      expect(hasSufficientPermission('write', 'read')).toBe(false);
      expect(hasSufficientPermission('read', 'read')).toBe(true);
    });
  });

  describe('getHighestPermission', () => {
    it('应该返回最高权限级别', () => {
      expect(getHighestPermission(['read', 'write', 'admin'])).toBe('admin');
      expect(getHighestPermission(['none', 'read'])).toBe('read');
      expect(getHighestPermission([])).toBe('none');
    });
  });

  describe('isPermissionExpired', () => {
    it('应该检查权限是否过期', () => {
      const expiredRule: PermissionRule = {
        id: 'test',
        subject: { type: 'user', id: 'user1', name: '用户1' },
        target: { type: 'project', id: 'proj1', name: '项目1' },
        level: 'read',
        grantedBy: 'admin',
        grantedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() - 1000).toISOString(),
        metadata: {
          priority: 0,
          isTemporary: true,
          autoRevoke: true,
          evaluationCount: 0,
        },
      };

      expect(isPermissionExpired(expiredRule)).toBe(true);
    });

    it('应该处理无过期时间的规则', () => {
      const rule: PermissionRule = {
        id: 'test',
        subject: { type: 'user', id: 'user1', name: '用户1' },
        target: { type: 'project', id: 'proj1', name: '项目1' },
        level: 'read',
        grantedBy: 'admin',
        grantedAt: new Date().toISOString(),
        metadata: {
          priority: 0,
          isTemporary: false,
          autoRevoke: false,
          evaluationCount: 0,
        },
      };

      expect(isPermissionExpired(rule)).toBe(false);
    });
  });

  describe('calculateInheritedPermission', () => {
    it('应该在严格模式下取较低权限', () => {
      const config = { enabled: true, mode: 'strict' as const, inheritFromParent: true, propagateToChildren: true, overrideParent: false };
      expect(calculateInheritedPermission('write', 'read', config)).toBe('read');
    });

    it('应该在宽松模式下取较高权限', () => {
      const config = { enabled: true, mode: 'lenient' as const, inheritFromParent: true, propagateToChildren: true, overrideParent: false };
      expect(calculateInheritedPermission('read', 'write', config)).toBe('write');
    });

    it('应该在覆盖模式下使用子权限', () => {
      const config = { enabled: true, mode: 'override' as const, inheritFromParent: true, propagateToChildren: true, overrideParent: false };
      expect(calculateInheritedPermission('read', 'write', config)).toBe('write');
    });

    it('应该在禁用时返回子权限', () => {
      const config = { enabled: false, mode: 'lenient' as const, inheritFromParent: true, propagateToChildren: true, overrideParent: false };
      expect(calculateInheritedPermission('write', 'read', config)).toBe('read');
    });
  });

  describe('validatePermissionRule', () => {
    it('应该验证有效的规则', () => {
      const rule = {
        subject: { type: 'user' as const, id: 'user1', name: '用户1' },
        target: { type: 'project' as const, id: 'proj1', name: '项目1' },
        level: 'read' as PermissionLevel,
        grantedBy: 'admin',
        grantedAt: new Date().toISOString(),
      };

      expect(validatePermissionRule(rule)).toHaveLength(0);
    });

    it('应该拒绝无效的规则', () => {
      const rule = {
        subject: { type: 'user' as const, id: '', name: '' },
        target: { type: 'project' as const, id: '', name: '' },
        level: 'invalid' as PermissionLevel,
      };

      const errors = validatePermissionRule(rule);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('createPermissionRule', () => {
    it('应该创建权限规则', () => {
      const rule = createPermissionRule(
        { type: 'user', id: 'user1', name: '用户1' },
        { type: 'project', id: 'proj1', name: '项目1' },
        'read',
        'admin',
      );

      expect(rule).toBeTruthy();
      expect(rule.level).toBe('read');
      expect(rule.metadata.isTemporary).toBe(false);
    });

    it('应该创建临时权限规则', () => {
      const rule = createPermissionRule(
        { type: 'user', id: 'user1', name: '用户1' },
        { type: 'project', id: 'proj1', name: '项目1' },
        'read',
        'admin',
        { expiresAt: new Date(Date.now() + 3600000).toISOString() },
      );

      expect(rule.metadata.isTemporary).toBe(true);
    });
  });

  describe('序列化函数', () => {
    it('应该正确序列化和解析权限状态', () => {
      const manager = createPermissionManager();
      manager.addRule(
        {
          subject: { type: 'user', id: 'user1', name: '用户1' },
          target: { type: 'project', id: 'proj1', name: '项目1' },
          level: 'read',
          grantedBy: 'admin',
          grantedAt: new Date().toISOString(),
        },
        'admin',
        '管理员',
      );

      const state = manager.getState();
      const json = serializePermissionState(state);
      const parsed = parsePermissionState(json);

      expect(parsed).toBeTruthy();
      expect(parsed!.rules).toHaveLength(1);
    });

    it('应该返回null对于无效的JSON', () => {
      expect(parsePermissionState('invalid')).toBeNull();
    });
  });
});
