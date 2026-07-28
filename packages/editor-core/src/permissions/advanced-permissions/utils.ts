/**
 * Permission utility functions
 */

import {
  type PermissionLevel,
  type PermissionRule,
  type PermissionInheritance,
  type PermissionSubject,
  type PermissionTarget,
  type PermissionConditions,
  type TemporaryPermission,
  PERMISSION_LEVEL_WEIGHTS,
  PERMISSION_LEVELS,
  createId,
} from './types';

/**
 * Compare permission levels
 */
export function comparePermissionLevels(a: PermissionLevel, b: PermissionLevel): number {
  return PERMISSION_LEVEL_WEIGHTS[a] - PERMISSION_LEVEL_WEIGHTS[b];
}

/**
 * Check if permission level is sufficient
 */
export function hasSufficientPermission(required: PermissionLevel, actual: PermissionLevel): boolean {
  return PERMISSION_LEVEL_WEIGHTS[actual] >= PERMISSION_LEVEL_WEIGHTS[required];
}

/**
 * Get the highest permission level
 */
export function getHighestPermission(levels: PermissionLevel[]): PermissionLevel {
  if (levels.length === 0) return 'none';
  return levels.reduce((highest, current) =>
    PERMISSION_LEVEL_WEIGHTS[current] > PERMISSION_LEVEL_WEIGHTS[highest] ? current : highest,
  );
}

/**
 * Check if permission rule is expired
 */
export function isPermissionExpired(rule: PermissionRule): boolean {
  if (!rule.expiresAt) return false;
  return new Date(rule.expiresAt) < new Date();
}

/**
 * Check if temporary permission is valid
 */
export function isTemporaryPermissionValid(permission: TemporaryPermission): boolean {
  if (permission.revokedAt) return false;
  return new Date(permission.expiresAt) > new Date();
}

/**
 * Calculate inherited permission
 */
export function calculateInheritedPermission(
  parentLevel: PermissionLevel,
  childLevel: PermissionLevel,
  config: PermissionInheritance,
): PermissionLevel {
  if (!config.enabled) return childLevel;

  switch (config.mode) {
    case 'strict':
      return comparePermissionLevels(parentLevel, childLevel) < 0 ? parentLevel : childLevel;
    case 'lenient':
      return getHighestPermission([parentLevel, childLevel]);
    case 'override':
      return childLevel !== 'none' ? childLevel : parentLevel;
    default:
      return childLevel;
  }
}

/**
 * Validate a permission rule
 */
export function validatePermissionRule(rule: Partial<PermissionRule>): string[] {
  const errors: string[] = [];

  if (!rule.subject) {
    errors.push('缺少权限主体');
  } else {
    if (!rule.subject.id) errors.push('缺少主体ID');
    if (!rule.subject.type) errors.push('缺少主体类型');
  }

  if (!rule.target) {
    errors.push('缺少权限目标');
  } else {
    if (!rule.target.id) errors.push('缺少目标ID');
    if (!rule.target.type) errors.push('缺少目标类型');
  }

  if (!rule.level || !PERMISSION_LEVELS.includes(rule.level)) {
    errors.push('无效的权限级别');
  }

  if (rule.expiresAt && new Date(rule.expiresAt) <= new Date()) {
    errors.push('过期时间必须在未来');
  }

  return errors;
}

/**
 * Create a permission rule
 */
export function createPermissionRule(
  subject: PermissionSubject,
  target: PermissionTarget,
  level: PermissionLevel,
  grantedBy: string,
  options?: {
    expiresAt?: string;
    conditions?: PermissionConditions;
    description?: string;
    tags?: string[];
    priority?: number;
  },
): PermissionRule {
  const now = new Date().toISOString();
  return {
    id: createId('perm'),
    subject,
    target,
    level,
    grantedBy,
    grantedAt: now,
    expiresAt: options?.expiresAt,
    conditions: options?.conditions,
    metadata: {
      description: options?.description,
      tags: options?.tags,
      priority: options?.priority ?? 0,
      isTemporary: !!options?.expiresAt,
      autoRevoke: !!options?.expiresAt,
      evaluationCount: 0,
    },
  };
}
