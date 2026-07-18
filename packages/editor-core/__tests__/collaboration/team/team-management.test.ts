import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TeamManager,
  createTeamManager,
  getTeamRolePermissions,
  hasTeamPermission,
  roleHasPermission,
  canChangeRole,
  canInviteMember,
  serializeTeamState,
  parseTeamState,
  restoreTeamManager,
  type Team,
  type TeamMember,
  type TeamRole,
  type TeamState,
} from '../../../src/collaboration/team/team-management';

describe('TeamManager', () => {
  let manager: TeamManager;

  beforeEach(() => {
    manager = createTeamManager();
  });

  describe('团队创建', () => {
    it('应该成功创建团队', () => {
      const result = manager.createTeam('测试团队', '这是一个测试团队', 'user1', '用户1');

      expect(result.success).toBe(true);
      expect(manager.getTeam().name).toBe('测试团队');
      expect(manager.getTeam().description).toBe('这是一个测试团队');
      expect(manager.getTeam().createdBy).toBe('user1');
    });

    it('创建团队后应该自动添加创建者为所有者', () => {
      manager.createTeam('测试团队', '', 'user1', '用户1');

      const members = manager.getMembers();
      expect(members).toHaveLength(1);
      expect(members[0].userId).toBe('user1');
      expect(members[0].role).toBe('owner');
      expect(members[0].status).toBe('active');
    });

    it('应该记录创建审计日志', () => {
      manager.createTeam('测试团队', '', 'user1', '用户1');

      const logs = manager.getAuditLog();
      // 创建团队时会记录 team.created 和 member.joined 两条日志
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs.some(l => l.action === 'team.created')).toBe(true);
      expect(logs.some(l => l.userId === 'user1')).toBe(true);
    });
  });

  describe('成员管理', () => {
    beforeEach(() => {
      manager.createTeam('测试团队', '', 'owner1', '所有者');
    });

    it('应该成功添加成员', () => {
      const result = manager.addMember('user1', '用户1', 'member', 'owner1');

      expect(result.success).toBe(true);
      expect(manager.getMembers()).toHaveLength(2);
      expect(manager.getMember('user1')?.role).toBe('member');
    });

    it('不能添加重复成员', () => {
      manager.addMember('user1', '用户1', 'member');
      const result = manager.addMember('user1', '用户1', 'member');

      expect(result.success).toBe(false);
      expect(result.error).toBe('MEMBER_EXISTS');
    });

    it('应该成功移除成员', () => {
      manager.addMember('user1', '用户1', 'member');
      const result = manager.removeMember('user1', 'owner1', '所有者');

      expect(result.success).toBe(true);
      expect(manager.getMembers()).toHaveLength(1);
      expect(manager.getMember('user1')).toBeUndefined();
    });

    it('不能移除所有者', () => {
      const result = manager.removeMember('owner1', 'owner1', '所有者');

      expect(result.success).toBe(false);
      expect(result.error).toBe('CANNOT_REMOVE_OWNER');
    });

    it('管理员不能移除其他管理员', () => {
      manager.addMember('admin1', '管理员1', 'admin');
      manager.addMember('admin2', '管理员2', 'admin');

      const result = manager.removeMember('admin2', 'admin1', '管理员1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('PERMISSION_DENIED');
    });

    it('应该成功更新成员角色', () => {
      manager.addMember('user1', '用户1', 'member');
      const result = manager.updateMemberRole('user1', 'admin', 'owner1', '所有者');

      expect(result.success).toBe(true);
      expect(manager.getMember('user1')?.role).toBe('admin');
    });

    it('不能更改所有者角色', () => {
      const result = manager.updateMemberRole('owner1', 'admin', 'owner1', '所有者');

      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_ROLE_CHANGE');
    });

    it('管理员不能将成员提升为所有者', () => {
      manager.addMember('admin1', '管理员1', 'admin');
      manager.addMember('user1', '用户1', 'member');

      const result = manager.updateMemberRole('user1', 'owner', 'admin1', '管理员1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_ROLE_CHANGE');
    });

    it('应该成功更新成员状态', () => {
      manager.addMember('user1', '用户1', 'member');
      const result = manager.updateMemberStatus('user1', 'suspended', 'owner1', '所有者');

      expect(result.success).toBe(true);
      expect(manager.getMember('user1')?.status).toBe('suspended');
    });

    it('不能更改所有者状态', () => {
      const result = manager.updateMemberStatus('owner1', 'suspended', 'owner1', '所有者');

      expect(result.success).toBe(false);
      expect(result.error).toBe('CANNOT_CHANGE_OWNER_STATUS');
    });
  });

  describe('邀请管理', () => {
    beforeEach(() => {
      manager.createTeam('测试团队', '', 'owner1', '所有者');
    });

    it('应该成功发送邀请', () => {
      const result = manager.sendInvitation('user@example.com', 'member', 'owner1', '所有者', '欢迎加入');

      expect(result.success).toBe(true);
      expect(manager.getPendingInvitations()).toHaveLength(1);
    });

    it('不能邀请重复的邮箱', () => {
      manager.sendInvitation('user@example.com', 'member', 'owner1', '所有者');
      const result = manager.sendInvitation('user@example.com', 'member', 'owner1', '所有者');

      expect(result.success).toBe(false);
      expect(result.error).toBe('INVITATION_EXISTS');
    });

    it('应该成功接受邀请', () => {
      manager.sendInvitation('user@example.com', 'member', 'owner1', '所有者');
      const invitation = manager.getPendingInvitations()[0];

      const result = manager.acceptInvitation(invitation.id, 'user1', '用户1');

      expect(result.success).toBe(true);
      expect(manager.getMembers()).toHaveLength(2);
      expect(manager.getMember('user1')?.role).toBe('member');
    });

    it('应该成功拒绝邀请', () => {
      manager.sendInvitation('user@example.com', 'member', 'owner1', '所有者');
      const invitation = manager.getPendingInvitations()[0];

      const result = manager.declineInvitation(invitation.id, 'user1', '用户1');

      expect(result.success).toBe(true);
      expect(manager.getPendingInvitations()).toHaveLength(0);
    });
  });

  describe('项目共享', () => {
    beforeEach(() => {
      manager.createTeam('测试团队', '', 'owner1', '所有者');
      manager.addMember('user1', '用户1', 'member');
    });

    it('应该成功共享项目', () => {
      const result = manager.shareProject(
        'proj1',
        '项目1',
        'edit',
        'owner1',
        '所有者',
      );

      expect(result.success).toBe(true);
      expect(manager.getSharedProjects()).toHaveLength(1);
    });

    it('不能重复共享项目', () => {
      manager.shareProject('proj1', '项目1', 'edit', 'owner1', '所有者');
      const result = manager.shareProject('proj1', '项目1', 'edit', 'owner1', '所有者');

      expect(result.success).toBe(false);
      expect(result.error).toBe('PROJECT_ALREADY_SHARED');
    });

    it('应该成功取消项目共享', () => {
      manager.shareProject('proj1', '项目1', 'edit', 'owner1', '所有者');
      const result = manager.unshareProject('proj1', 'owner1', '所有者');

      expect(result.success).toBe(true);
      expect(manager.getSharedProjects()).toHaveLength(0);
    });

    it('应该成功更新项目权限', () => {
      manager.shareProject('proj1', '项目1', 'view', 'owner1', '所有者');
      const result = manager.updateProjectPermission('proj1', 'edit', 'owner1', '所有者');

      expect(result.success).toBe(true);
      expect(manager.getSharedProjects()[0].permissions).toBe('edit');
    });

    it('成员应该能够访问共享项目', () => {
      manager.shareProject('proj1', '项目1', 'edit', 'owner1', '所有者');

      expect(manager.canAccessProject('user1', 'proj1')).toBe(true);
    });

    it('非成员不能访问共享项目', () => {
      manager.shareProject('proj1', '项目1', 'edit', 'owner1', '所有者');

      expect(manager.canAccessProject('user2', 'proj1')).toBe(false);
    });

    it('应该正确返回项目权限', () => {
      manager.shareProject('proj1', '项目1', 'edit', 'owner1', '所有者');

      expect(manager.getProjectPermission('user1', 'proj1')).toBe('edit');
      expect(manager.getProjectPermission('owner1', 'proj1')).toBe('admin');
    });
  });

  describe('团队设置', () => {
    beforeEach(() => {
      manager.createTeam('测试团队', '', 'owner1', '所有者');
    });

    it('应该成功更新团队信息', () => {
      const result = manager.updateTeam(
        { name: '新团队名称', description: '新描述' },
        'owner1',
        '所有者',
      );

      expect(result.success).toBe(true);
      expect(manager.getTeam().name).toBe('新团队名称');
      expect(manager.getTeam().description).toBe('新描述');
    });

    it('应该成功更新团队设置', () => {
      const result = manager.updateSettings(
        { maxMembers: 100, allowMemberInvite: false },
        'owner1',
        '所有者',
      );

      expect(result.success).toBe(true);
      expect(manager.getTeam().settings.maxMembers).toBe(100);
      expect(manager.getTeam().settings.allowMemberInvite).toBe(false);
    });
  });

  describe('审计日志', () => {
    beforeEach(() => {
      manager.createTeam('测试团队', '', 'owner1', '所有者');
    });

    it('应该记录所有操作', () => {
      manager.addMember('user1', '用户1', 'member');
      manager.updateMemberRole('user1', 'admin', 'owner1', '所有者');
      manager.shareProject('proj1', '项目1', 'edit', 'owner1', '所有者');

      const logs = manager.getAuditLog();
      expect(logs.length).toBeGreaterThanOrEqual(4);
    });

    it('应该按时间倒序返回日志', () => {
      manager.addMember('user1', '用户1', 'member');
      manager.addMember('user2', '用户2', 'member');

      const logs = manager.getAuditLog();
      expect(new Date(logs[0].timestamp).getTime()).toBeGreaterThanOrEqual(
        new Date(logs[1].timestamp).getTime(),
      );
    });

    it('应该支持限制返回数量', () => {
      manager.addMember('user1', '用户1', 'member');
      manager.addMember('user2', '用户2', 'member');
      manager.addMember('user3', '用户3', 'member');

      const logs = manager.getAuditLog(2);
      expect(logs).toHaveLength(2);
    });
  });

  describe('快照导出导入', () => {
    it('应该成功导出快照', () => {
      manager.createTeam('测试团队', '', 'owner1', '所有者');
      const snapshot = manager.exportSnapshot();

      expect(snapshot).toBeTruthy();
      expect(JSON.parse(snapshot).team.name).toBe('测试团队');
    });

    it('应该成功导入快照', () => {
      manager.createTeam('测试团队', '', 'owner1', '所有者');
      manager.addMember('user1', '用户1', 'member');

      const snapshot = manager.exportSnapshot();
      const newManager = createTeamManager();
      const result = newManager.importSnapshot(snapshot);

      expect(result.success).toBe(true);
      expect(newManager.getTeam().name).toBe('测试团队');
      expect(newManager.getMembers()).toHaveLength(2);
    });

    it('应该拒绝无效的快照', () => {
      const result = manager.importSnapshot('invalid json');

      expect(result.success).toBe(false);
      expect(result.error).toBe('PARSE_ERROR');
    });

    it('应该拒绝格式错误的快照', () => {
      const result = manager.importSnapshot(JSON.stringify({ invalid: true }));

      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_SNAPSHOT');
    });
  });

  describe('事件系统', () => {
    it('应该触发团队创建事件', () => {
      const handler = vi.fn();
      manager.on('team.created', handler);

      manager.createTeam('测试团队', '', 'owner1', '所有者');

      expect(handler).toHaveBeenCalledOnce();
    });

    it('应该触发成员添加事件', () => {
      manager.createTeam('测试团队', '', 'owner1', '所有者');

      const handler = vi.fn();
      manager.on('member.added', handler);

      manager.addMember('user1', '用户1', 'member');

      expect(handler).toHaveBeenCalledOnce();
    });

    it('应该能够取消事件监听', () => {
      const handler = vi.fn();
      const unsubscribe = manager.on('team.created', handler);

      unsubscribe();

      manager.createTeam('测试团队', '', 'owner1', '所有者');

      expect(handler).not.toHaveBeenCalled();
    });
  });
});

describe('角色权限', () => {
  it('应该返回正确的角色权限', () => {
    const ownerPerms = getTeamRolePermissions('owner');
    expect(ownerPerms.canCreateProjects).toBe(true);
    expect(ownerPerms.canManageRoles).toBe(true);
    expect(ownerPerms.canDeleteProjects).toBe(true);

    const viewerPerms = getTeamRolePermissions('viewer');
    expect(viewerPerms.canCreateProjects).toBe(false);
    expect(viewerPerms.canManageRoles).toBe(false);
    expect(viewerPerms.canDeleteProjects).toBe(false);
  });

  it('应该正确检查成员权限', () => {
    const member: TeamMember = {
      userId: 'user1',
      userName: '用户1',
      role: 'member',
      status: 'active',
      joinedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      permissions: getTeamRolePermissions('member'),
    };

    expect(hasTeamPermission(member, 'canCreateProjects')).toBe(true);
    expect(hasTeamPermission(member, 'canInviteMembers')).toBe(false);
    expect(hasTeamPermission(member, 'canManageRoles')).toBe(false);
  });

  it('应该正确检查角色权限', () => {
    expect(roleHasPermission('owner', 'canCreateProjects')).toBe(true);
    expect(roleHasPermission('viewer', 'canCreateProjects')).toBe(false);
  });

  it('应该正确验证角色变更', () => {
    expect(canChangeRole('member', 'admin', 'owner')).toBe(true);
    expect(canChangeRole('owner', 'admin', 'owner')).toBe(false);
    expect(canChangeRole('admin', 'owner', 'admin')).toBe(false);
  });

  it('应该正确验证成员邀请', () => {
    expect(canInviteMember('owner', 'member', 5, 10).success).toBe(true);
    expect(canInviteMember('viewer', 'member', 5, 10).success).toBe(false);
    expect(canInviteMember('owner', 'member', 10, 10).success).toBe(false);
  });
});

describe('序列化函数', () => {
  it('应该正确序列化和解析团队状态', () => {
    const manager = createTeamManager();
    manager.createTeam('测试团队', '', 'owner1', '所有者');

    const state = manager.getState();
    const json = serializeTeamState(state);
    const parsed = parseTeamState(json);

    expect(parsed).toBeTruthy();
    expect(parsed!.team.name).toBe('测试团队');
  });

  it('应该能够从快照恢复管理器', () => {
    const manager = createTeamManager();
    manager.createTeam('测试团队', '', 'owner1', '所有者');

    const snapshot = manager.exportSnapshot();
    const restored = restoreTeamManager(snapshot);

    expect(restored).toBeTruthy();
    expect(restored!.getTeam().name).toBe('测试团队');
  });

  it('应该返回null对于无效的JSON', () => {
    expect(parseTeamState('invalid')).toBeNull();
    expect(restoreTeamManager('invalid')).toBeNull();
  });
});
