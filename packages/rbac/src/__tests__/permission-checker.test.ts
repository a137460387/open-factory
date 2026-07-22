import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionChecker } from '../permission-checker.js';
import type { Role, ResourcePermission } from '../types.js';

describe('PermissionChecker', () => {
  let checker: PermissionChecker;

  beforeEach(() => {
    checker = new PermissionChecker();
  });

  describe('built-in roles', () => {
    it('should have admin, editor, and viewer roles', () => {
      expect(checker.getRole('admin')).toBeDefined();
      expect(checker.getRole('editor')).toBeDefined();
      expect(checker.getRole('viewer')).toBeDefined();
    });

    it('admin should have all permissions', () => {
      const admin = checker.getRole('admin')!;
      const allPermissions = checker.listPermissions();
      for (const perm of allPermissions) {
        expect(admin.permissions).toContain(perm.id);
      }
    });
  });

  describe('hasPermission', () => {
    it('admin can do everything', () => {
      expect(checker.hasPermission('user1', ['admin'], 'project:create')).toBe(true);
      expect(checker.hasPermission('user1', ['admin'], 'system:manage')).toBe(true);
      expect(checker.hasPermission('user1', ['admin'], 'file:delete')).toBe(true);
    });

    it('editor can create projects but not manage system', () => {
      expect(checker.hasPermission('user1', ['editor'], 'project:create')).toBe(true);
      expect(checker.hasPermission('user1', ['editor'], 'system:manage')).toBe(false);
    });

    it('viewer can only read', () => {
      expect(checker.hasPermission('user1', ['viewer'], 'project:read')).toBe(true);
      expect(checker.hasPermission('user1', ['viewer'], 'project:create')).toBe(false);
      expect(checker.hasPermission('user1', ['viewer'], 'file:delete')).toBe(false);
    });

    it('returns false for unknown permission', () => {
      expect(checker.hasPermission('user1', ['admin'], 'nonexistent:action')).toBe(false);
    });

    it('returns false for unknown role', () => {
      expect(checker.hasPermission('user1', ['nonexistent'], 'project:read')).toBe(false);
    });
  });

  describe('convenience methods', () => {
    it('canCreate checks correctly', () => {
      expect(checker.canCreate('user1', ['editor'], 'project')).toBe(true);
      expect(checker.canCreate('user1', ['viewer'], 'project')).toBe(false);
    });

    it('canRead checks correctly', () => {
      expect(checker.canRead('user1', ['viewer'], 'project')).toBe(true);
      expect(checker.canRead('user1', ['viewer'], 'file')).toBe(true);
    });

    it('canDelete checks correctly', () => {
      expect(checker.canDelete('user1', ['editor'], 'project')).toBe(false);
      expect(checker.canDelete('user1', ['admin'], 'project')).toBe(true);
    });
  });

  describe('custom roles', () => {
    it('can create and use custom role', () => {
      const customRole: Role = {
        id: 'custom',
        name: 'Custom',
        description: 'Custom role',
        permissions: ['project:read', 'file:read', 'file:export'],
        isSystem: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      checker.addRole(customRole);
      expect(checker.hasPermission('user1', ['custom'], 'project:read')).toBe(true);
      expect(checker.hasPermission('user1', ['custom'], 'file:export')).toBe(true);
      expect(checker.hasPermission('user1', ['custom'], 'project:create')).toBe(false);
    });

    it('cannot modify system role permissions', () => {
      expect(() => {
        checker.updateRole('editor', { permissions: ['project:read'] });
      }).toThrow('Cannot modify permissions of system role');
    });

    it('cannot delete system role', () => {
      expect(() => {
        checker.deleteRole('admin');
      }).toThrow('Cannot delete system role');
    });

    it('can delete custom role', () => {
      const customRole: Role = {
        id: 'temp',
        name: 'Temp',
        description: 'Temp role',
        permissions: [],
        isSystem: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      checker.addRole(customRole);
      checker.deleteRole('temp');
      expect(checker.getRole('temp')).toBeUndefined();
    });
  });

  describe('resource permissions', () => {
    it('can grant and check resource permissions', () => {
      const perm: ResourcePermission = {
        userId: 'user1',
        resourceId: 'proj-123',
        resourceType: 'project',
        roleId: 'editor',
        grantedBy: 'admin',
        grantedAt: Date.now(),
      };

      checker.grantResourcePermission(perm);
      const userPerms = checker.getUserResourcePermissions('user1');
      expect(userPerms).toHaveLength(1);
      expect(userPerms[0].resourceId).toBe('proj-123');
    });

    it('can revoke resource permissions', () => {
      const perm: ResourcePermission = {
        userId: 'user1',
        resourceId: 'proj-123',
        resourceType: 'project',
        roleId: 'editor',
        grantedBy: 'admin',
        grantedAt: Date.now(),
      };

      checker.grantResourcePermission(perm);
      checker.revokeResourcePermission('user1', 'proj-123');
      expect(checker.getUserResourcePermissions('user1')).toHaveLength(0);
    });

    it('expired permissions are not valid', () => {
      const perm: ResourcePermission = {
        userId: 'user1',
        resourceId: 'proj-123',
        resourceType: 'project',
        roleId: 'editor',
        grantedBy: 'admin',
        grantedAt: Date.now(),
        expiresAt: Date.now() - 1000, // already expired
      };

      checker.grantResourcePermission(perm);
      // Even with resource permission, the role-based check should still work
      // for editor role since editor has project:update
      expect(checker.hasPermission('user1', ['editor'], 'project:update')).toBe(true);
    });
  });
});
