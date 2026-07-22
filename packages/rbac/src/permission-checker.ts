import type {
  Permission,
  Role,
  ResourcePermission,
  PermissionPolicy,
  ResourceType,
  Action,
} from './types.js';
import { BUILT_IN_PERMISSIONS, BUILT_IN_ROLES } from './types.js';

export class PermissionChecker {
  private permissions = new Map<string, Permission>();
  private roles = new Map<string, Role>();
  private resourcePermissions: ResourcePermission[] = [];
  private policies: PermissionPolicy[] = [];

  constructor() {
    // Register built-in permissions and roles
    for (const perm of BUILT_IN_PERMISSIONS) {
      this.permissions.set(perm.id, perm);
    }
    for (const role of BUILT_IN_ROLES) {
      this.roles.set(role.id, role);
    }
  }

  // Permission management
  addPermission(permission: Permission): void {
    this.permissions.set(permission.id, permission);
  }

  getPermission(id: string): Permission | undefined {
    return this.permissions.get(id);
  }

  listPermissions(): Permission[] {
    return Array.from(this.permissions.values());
  }

  // Role management
  addRole(role: Role): void {
    this.roles.set(role.id, role);
  }

  getRole(id: string): Role | undefined {
    return this.roles.get(id);
  }

  listRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  updateRole(id: string, updates: Partial<Role>): Role {
    const existing = this.roles.get(id);
    if (!existing) throw new Error(`Role not found: ${id}`);
    if (existing.isSystem && updates.permissions) {
      throw new Error('Cannot modify permissions of system role');
    }
    const updated = { ...existing, ...updates, updatedAt: Date.now() };
    this.roles.set(id, updated);
    return updated;
  }

  deleteRole(id: string): void {
    const role = this.roles.get(id);
    if (!role) throw new Error(`Role not found: ${id}`);
    if (role.isSystem) throw new Error('Cannot delete system role');
    this.roles.delete(id);
  }

  // Resource-level permissions
  grantResourcePermission(perm: ResourcePermission): void {
    // Remove existing permission for same user+resource
    this.resourcePermissions = this.resourcePermissions.filter(
      (rp) => !(rp.userId === perm.userId && rp.resourceId === perm.resourceId),
    );
    this.resourcePermissions.push(perm);
  }

  revokeResourcePermission(userId: string, resourceId: string): void {
    this.resourcePermissions = this.resourcePermissions.filter(
      (rp) => !(rp.userId === userId && rp.resourceId === resourceId),
    );
  }

  getUserResourcePermissions(userId: string): ResourcePermission[] {
    return this.resourcePermissions.filter((rp) => rp.userId === userId);
  }

  // Policy management
  addPolicy(policy: PermissionPolicy): void {
    this.policies.push(policy);
    this.policies.sort((a, b) => b.priority - a.priority);
  }

  removePolicy(policyId: string): void {
    this.policies = this.policies.filter((p) => p.id !== policyId);
  }

  // Core authorization check
  hasPermission(
    userId: string,
    userRoleIds: string[],
    permissionId: string,
    resourceContext?: { resourceId: string; resourceType: ResourceType },
  ): boolean {
    // Check policies first (deny takes precedence)
    for (const policy of this.policies) {
      if (policy.permissions.includes(permissionId)) {
        const matches = this.evaluateConditions(policy.conditions, {
          userId,
          permissionId,
          resourceContext,
        });
        if (matches && policy.effect === 'deny') return false;
      }
    }

    // Check role-based permissions
    for (const roleId of userRoleIds) {
      const role = this.roles.get(roleId);
      if (!role) continue;
      if (role.permissions.includes(permissionId)) {
        // If no resource context, role permission is sufficient
        if (!resourceContext) return true;

        // Check resource-level permission
        const resourcePerm = this.resourcePermissions.find(
          (rp) =>
            rp.userId === userId &&
            rp.resourceId === resourceContext.resourceId,
        );
        if (resourcePerm) {
          if (resourcePerm.expiresAt && resourcePerm.expiresAt < Date.now()) {
            continue;
          }
          const permRole = this.roles.get(resourcePerm.roleId);
          if (permRole?.permissions.includes(permissionId)) return true;
        }

        // Role has permission and no resource-specific restriction
        return true;
      }
    }

    return false;
  }

  // Convenience methods
  canCreate(userId: string, roleIds: string[], resourceType: ResourceType): boolean {
    return this.hasPermission(userId, roleIds, `${resourceType}:create`);
  }

  canRead(userId: string, roleIds: string[], resourceType: ResourceType, resourceId?: string): boolean {
    return this.hasPermission(userId, roleIds, `${resourceType}:read`, resourceId ? { resourceId, resourceType } : undefined);
  }

  canUpdate(userId: string, roleIds: string[], resourceType: ResourceType, resourceId?: string): boolean {
    return this.hasPermission(userId, roleIds, `${resourceType}:update`, resourceId ? { resourceId, resourceType } : undefined);
  }

  canDelete(userId: string, roleIds: string[], resourceType: ResourceType, resourceId?: string): boolean {
    return this.hasPermission(userId, roleIds, `${resourceType}:delete`, resourceId ? { resourceId, resourceType } : undefined);
  }

  private evaluateConditions(
    conditions: PermissionPolicy['conditions'],
    context: { userId: string; permissionId: string; resourceContext?: { resourceId: string; resourceType: ResourceType } },
  ): boolean {
    for (const cond of conditions) {
      const value = this.resolveField(cond.field, context);
      if (!this.evaluateCondition(value, cond.operator, cond.value)) return false;
    }
    return true;
  }

  private resolveField(field: string, context: Record<string, unknown>): unknown {
    const parts = field.split('.');
    let current: unknown = context;
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return current;
  }

  private evaluateCondition(value: unknown, operator: string, expected: unknown): boolean {
    switch (operator) {
      case 'eq': return value === expected;
      case 'neq': return value !== expected;
      case 'in': return Array.isArray(expected) && expected.includes(value);
      case 'not_in': return Array.isArray(expected) && !expected.includes(value);
      case 'gt': return typeof value === 'number' && typeof expected === 'number' && value > expected;
      case 'lt': return typeof value === 'number' && typeof expected === 'number' && value < expected;
      case 'contains': return typeof value === 'string' && typeof expected === 'string' && value.includes(expected);
      default: return false;
    }
  }
}
