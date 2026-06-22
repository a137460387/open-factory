import { describe, expect, it } from 'vitest';
import {
  hasPermission,
  getRolePermissions,
  getRoleForUser,
  assignRole,
  removeUserRole,
  getDisabledActionsForRole,
  isActionAllowedForUI,
  buildPermissionSyncMessage,
  normalizeCollaborationPermissionConfig,
  COLLABORATION_ROLES
} from '../src';

describe('collaboration permissions', () => {
  const baseConfig = {
    ownerUserId: 'owner-1',
    roles: [],
    changeLog: []
  };

  it('owner has all permissions', () => {
    const perms = getRolePermissions('owner');
    expect(perms.size).toBe(8);
    expect(hasPermission('owner', 'edit-timeline')).toBe(true);
    expect(hasPermission('owner', 'delete-project')).toBe(true);
    expect(hasPermission('owner', 'manage-roles')).toBe(true);
    expect(hasPermission('owner', 'export-project')).toBe(true);
  });

  it('editor can edit timeline but not delete project or manage roles', () => {
    expect(hasPermission('editor', 'edit-timeline')).toBe(true);
    expect(hasPermission('editor', 'export-project')).toBe(true);
    expect(hasPermission('editor', 'add-comment')).toBe(true);
    expect(hasPermission('editor', 'add-annotation')).toBe(true);
    expect(hasPermission('editor', 'delete-project')).toBe(false);
    expect(hasPermission('editor', 'manage-roles')).toBe(false);
    expect(hasPermission('editor', 'modify-settings')).toBe(false);
  });

  it('commenter can only add comments and annotations', () => {
    expect(hasPermission('commenter', 'add-comment')).toBe(true);
    expect(hasPermission('commenter', 'add-annotation')).toBe(true);
    expect(hasPermission('commenter', 'view-project')).toBe(true);
    expect(hasPermission('commenter', 'edit-timeline')).toBe(false);
    expect(hasPermission('commenter', 'delete-project')).toBe(false);
    expect(hasPermission('commenter', 'export-project')).toBe(false);
    expect(hasPermission('commenter', 'manage-roles')).toBe(false);
  });

  it('viewer can only view project', () => {
    expect(hasPermission('viewer', 'view-project')).toBe(true);
    expect(hasPermission('viewer', 'edit-timeline')).toBe(false);
    expect(hasPermission('viewer', 'add-comment')).toBe(false);
    expect(hasPermission('viewer', 'add-annotation')).toBe(false);
    expect(hasPermission('viewer', 'delete-project')).toBe(false);
    expect(hasPermission('viewer', 'export-project')).toBe(false);
  });

  it('defines exactly 4 roles', () => {
    expect(COLLABORATION_ROLES).toEqual(['owner', 'editor', 'commenter', 'viewer']);
  });

  it('getRoleForUser returns owner for ownerUserId', () => {
    expect(getRoleForUser(baseConfig, 'owner-1')).toBe('owner');
  });

  it('getRoleForUser returns viewer for unknown user', () => {
    expect(getRoleForUser(baseConfig, 'unknown')).toBe('viewer');
  });

  it('getRoleForUser returns assigned role', () => {
    const config = {
      ...baseConfig,
      roles: [{ userId: 'u1', userName: 'Alice', role: 'editor' as const, assignedAt: '', assignedBy: 'owner-1' }]
    };
    expect(getRoleForUser(config, 'u1')).toBe('editor');
  });

  it('assignRole creates assignment and log entry', () => {
    const updated = assignRole(baseConfig, 'u1', 'Alice', 'editor', 'owner-1', 'Owner', '2026-01-01');
    expect(updated.roles).toHaveLength(1);
    expect(updated.roles[0].role).toBe('editor');
    expect(updated.changeLog).toHaveLength(1);
    expect(updated.changeLog[0].action).toBe('assigned');
    expect(updated.changeLog[0].newRole).toBe('editor');
    expect(updated.changeLog[0].previousRole).toBeNull();
  });

  it('assignRole records change action when role already assigned', () => {
    let config = assignRole(baseConfig, 'u1', 'Alice', 'editor', 'owner-1', 'Owner', '2026-01-01');
    config = assignRole(config, 'u1', 'Alice', 'commenter', 'owner-1', 'Owner', '2026-01-02');
    expect(config.roles).toHaveLength(1);
    expect(config.roles[0].role).toBe('commenter');
    expect(config.changeLog).toHaveLength(2);
    expect(config.changeLog[1].action).toBe('changed');
    expect(config.changeLog[1].previousRole).toBe('editor');
  });

  it('assignRole with viewer role removes explicit assignment', () => {
    let config = assignRole(baseConfig, 'u1', 'Alice', 'editor', 'owner-1', 'Owner', '2026-01-01');
    config = assignRole(config, 'u1', 'Alice', 'viewer', 'owner-1', 'Owner', '2026-01-02');
    expect(config.roles).toHaveLength(0);
    expect(getRoleForUser(config, 'u1')).toBe('viewer');
  });

  it('removeUserRole revokes assignment and logs', () => {
    let config = assignRole(baseConfig, 'u1', 'Alice', 'editor', 'owner-1', 'Owner', '2026-01-01');
    config = removeUserRole(config, 'u1', 'owner-1', 'Owner', '2026-01-02');
    expect(config.roles).toHaveLength(0);
    expect(config.changeLog[1].action).toBe('revoked');
  });

  it('removeUserRole cannot remove owner', () => {
    const config = removeUserRole(baseConfig, 'owner-1', 'u1', 'Alice');
    expect(config).toBe(baseConfig);
  });

  it('getDisabledActionsForRole returns actions not permitted for commenter', () => {
    const disabled = getDisabledActionsForRole('commenter');
    expect(disabled).toContain('edit-timeline');
    expect(disabled).toContain('delete-project');
    expect(disabled).toContain('export-project');
    expect(disabled).toContain('manage-roles');
    expect(disabled).not.toContain('add-comment');
    expect(disabled).not.toContain('view-project');
  });

  it('isActionAllowedForUI reflects permission correctly', () => {
    expect(isActionAllowedForUI('editor', 'edit-timeline')).toBe(true);
    expect(isActionAllowedForUI('commenter', 'edit-timeline')).toBe(false);
    expect(isActionAllowedForUI('viewer', 'add-comment')).toBe(false);
  });

  it('buildPermissionSyncMessage returns correct role and permissions', () => {
    const config = assignRole(baseConfig, 'u1', 'Alice', 'editor', 'owner-1', 'Owner');
    const msg = buildPermissionSyncMessage(config, 'u1');
    expect(msg.userId).toBe('u1');
    expect(msg.role).toBe('editor');
    expect(msg.permissions).toContain('edit-timeline');
    expect(msg.permissions).not.toContain('delete-project');
  });

  it('buildPermissionSyncMessage for owner', () => {
    const msg = buildPermissionSyncMessage(baseConfig, 'owner-1');
    expect(msg.role).toBe('owner');
    expect(msg.permissions).toContain('manage-roles');
  });

  it('normalizeCollaborationPermissionConfig handles undefined input', () => {
    const result = normalizeCollaborationPermissionConfig(undefined, 'owner-1');
    expect(result.ownerUserId).toBe('owner-1');
    expect(result.roles).toEqual([]);
    expect(result.changeLog).toEqual([]);
  });

  it('normalizeCollaborationPermissionConfig filters invalid roles', () => {
    const result = normalizeCollaborationPermissionConfig({
      roles: [
        { userId: 'u1', userName: 'Alice', role: 'editor', assignedAt: '2026-01-01', assignedBy: 'owner-1' },
        { userId: 'owner-1', userName: 'Owner', role: 'editor', assignedAt: '', assignedBy: '' },
        { userId: 'u2', userName: 'Bob', role: 'invalid' as any, assignedAt: '', assignedBy: '' }
      ]
    }, 'owner-1');
    expect(result.roles).toHaveLength(1);
    expect(result.roles[0].userId).toBe('u1');
  });
});
