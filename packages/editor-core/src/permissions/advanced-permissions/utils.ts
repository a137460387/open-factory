/**
 * Permission utility functions and helper operations
 */

import {
  type PermissionLevel,
  type PermissionRule,
  type PermissionInheritance,
  type PermissionSubject,
  type PermissionTarget,
  type PermissionConditions,
  type PermissionGroup,
  type PermissionSubjectType,
  type TemporaryPermission,
  type PermissionAuditLog,
  type PermissionAuditAction,
  type PermissionEvaluationResult,
  type PermissionState,
  PERMISSION_LEVEL_WEIGHTS,
  PERMISSION_LEVELS,
  createId,
} from './types';

// ==================== Core Utilities ====================

export function comparePermissionLevels(a: PermissionLevel, b: PermissionLevel): number {
  return PERMISSION_LEVEL_WEIGHTS[a] - PERMISSION_LEVEL_WEIGHTS[b];
}

export function hasSufficientPermission(required: PermissionLevel, actual: PermissionLevel): boolean {
  return PERMISSION_LEVEL_WEIGHTS[actual] >= PERMISSION_LEVEL_WEIGHTS[required];
}

export function getHighestPermission(levels: PermissionLevel[]): PermissionLevel {
  if (levels.length === 0) return 'none';
  return levels.reduce((highest, current) =>
    PERMISSION_LEVEL_WEIGHTS[current] > PERMISSION_LEVEL_WEIGHTS[highest] ? current : highest,
  );
}

export function isPermissionExpired(rule: PermissionRule): boolean {
  if (!rule.expiresAt) return false;
  return new Date(rule.expiresAt) < new Date();
}

export function isTemporaryPermissionValid(permission: TemporaryPermission): boolean {
  if (permission.revokedAt) return false;
  return new Date(permission.expiresAt) > new Date();
}

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

export type AddRuleValidationError =
  | { kind: 'validation'; errors: string[] }
  | { kind: 'limit_exceeded' }
  | { kind: 'temporary_disabled' }
  | { kind: 'duration_exceeded'; maxHours: number };

export function validateNewRuleConstraints(
  rule: Omit<PermissionRule, 'id' | 'metadata'>,
  existingRules: PermissionRule[],
  config: { maxRulesPerSubject: number; enableTemporaryPermissions: boolean; maxTemporaryDurationHours: number },
): AddRuleValidationError | null {
  const errors = validatePermissionRule(rule);
  if (errors.length > 0) return { kind: 'validation', errors };

  const subjectRules = existingRules.filter(
    (r) => r.subject.id === rule.subject.id && r.subject.type === rule.subject.type,
  );
  if (subjectRules.length >= config.maxRulesPerSubject) return { kind: 'limit_exceeded' };

  if (rule.expiresAt && !config.enableTemporaryPermissions) return { kind: 'temporary_disabled' };

  if (rule.expiresAt) {
    const durationHours =
      (new Date(rule.expiresAt).getTime() - new Date(rule.grantedAt).getTime()) / (1000 * 60 * 60);
    if (durationHours > config.maxTemporaryDurationHours) {
      return { kind: 'duration_exceeded', maxHours: config.maxTemporaryDurationHours };
    }
  }

  return null;
}

// ==================== Audit Helper ====================

export function buildAuditLogEntry(entry: Omit<PermissionAuditLog, 'id' | 'timestamp'>): PermissionAuditLog {
  return {
    ...entry,
    id: createId('audit'),
    timestamp: new Date().toISOString(),
  };
}

export function appendAuditLog(state: PermissionState, entry: Omit<PermissionAuditLog, 'id' | 'timestamp'>): void {
  if (!state.config.auditEnabled) return;
  state.auditLog.push(buildAuditLogEntry(entry));
  if (state.auditLog.length > 10000) {
    state.auditLog = state.auditLog.slice(-5000);
  }
}

// ==================== Group Helpers ====================

export function findGroup(state: PermissionState, groupId: string): PermissionGroup | undefined {
  return state.groups.find((g) => g.id === groupId);
}

export function findGroupMemberIndex(group: PermissionGroup, memberId: string, memberType: PermissionSubjectType): number {
  return group.members.findIndex((m) => m.id === memberId && m.type === memberType);
}

export function isUserInGroup(group: PermissionGroup, member: PermissionSubject): boolean {
  return group.members.some((m) => m.id === member.id && m.type === member.type);
}

export function countUserGroups(state: PermissionState, memberId: string): number {
  return state.groups.filter((g) => g.members.some((m) => m.id === memberId)).length;
}

export function findGroupRuleIndex(group: PermissionGroup, ruleId: string): number {
  return group.rules.indexOf(ruleId);
}

export function ruleExists(state: PermissionState, ruleId: string): boolean {
  return state.rules.some((r) => r.id === ruleId);
}

export function createGroupRecord(operatorId: string): PermissionGroup {
  const now = new Date().toISOString();
  return {
    id: createId('group'),
    name: '',
    description: '',
    members: [],
    rules: [],
    createdAt: now,
    updatedAt: now,
    createdBy: operatorId,
  };
}

export function auditGroupAction(
  state: PermissionState,
  action: PermissionAuditAction,
  operatorId: string,
  operatorName: string,
  groupId: string,
  groupName: string,
  subject: PermissionSubject,
  details: Record<string, unknown>,
): void {
  appendAuditLog(state, {
    userId: operatorId,
    userName: operatorName,
    action,
    subject,
    target: { type: 'global', id: groupId, name: groupName },
    details,
  });
}

// ==================== Query Helpers ====================

export function filterAuditLogs(
  logs: PermissionAuditLog[],
  filters?: {
    userId?: string;
    action?: PermissionAuditAction;
    startDate?: string;
    endDate?: string;
    limit?: number;
  },
): PermissionAuditLog[] {
  let result = [...logs];
  if (filters?.userId) result = result.filter((l) => l.userId === filters.userId);
  if (filters?.action) result = result.filter((l) => l.action === filters.action);
  if (filters?.startDate) result = result.filter((l) => new Date(l.timestamp) >= new Date(filters.startDate!));
  if (filters?.endDate) result = result.filter((l) => new Date(l.timestamp) <= new Date(filters.endDate!));
  result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  if (filters?.limit) result = result.slice(0, filters.limit);
  return result;
}

// ==================== Evaluation Helpers ====================

export function collectDirectRules(
  rules: PermissionRule[],
  subject: PermissionSubject,
  target: PermissionTarget,
): PermissionRule[] {
  return rules.filter(
    (r) =>
      r.subject.id === subject.id &&
      r.subject.type === subject.type &&
      r.target.id === target.id &&
      r.target.type === target.type,
  );
}

export function collectInheritedRules(rules: PermissionRule[], subject: PermissionSubject, target: PermissionTarget): PermissionRule[] {
  const collected: PermissionRule[] = [];
  const collectParentRules = (currentTarget: PermissionTarget) => {
    if (!currentTarget.parentId) return;
    const parentRules = rules.filter(
      (r) => r.subject.id === subject.id && r.target.id === currentTarget.parentId,
    );
    collected.push(...parentRules);
    const parentTarget = rules.find((r) => r.target.id === currentTarget.parentId)?.target;
    if (parentTarget) collectParentRules(parentTarget);
  };
  collectParentRules(target);
  return collected;
}

export function collectGroupRules(
  state: PermissionState,
  subject: PermissionSubject,
  target: PermissionTarget,
): PermissionRule[] {
  const rules: PermissionRule[] = [];
  const userGroups = state.groups.filter((g) =>
    g.members.some((m) => m.id === subject.id && m.type === subject.type),
  );
  for (const group of userGroups) {
    for (const ruleId of group.rules) {
      const rule = state.rules.find((r) => r.id === ruleId);
      if (rule && rule.target.id === target.id) {
        rules.push(rule);
      }
    }
  }
  return rules;
}

export function buildEvaluationResult(
  config: { defaultLevel: PermissionLevel },
  validRules: PermissionRule[],
  tempPermissions: TemporaryPermission[],
  requiredLevel: PermissionLevel,
): { result: PermissionEvaluationResult; effectiveLevel: PermissionLevel } {
  const warnings: string[] = [];
  const matchedRules: PermissionRule[] = [];
  let effectiveLevel: PermissionLevel = config.defaultLevel;

  for (const rule of validRules) {
    matchedRules.push(rule);
    rule.metadata.evaluationCount++;
    rule.metadata.lastEvaluatedAt = new Date().toISOString();
    if (comparePermissionLevels(rule.level, effectiveLevel) > 0) {
      effectiveLevel = rule.level;
    }
  }

  for (const tempPerm of tempPermissions) {
    if (comparePermissionLevels(tempPerm.level, effectiveLevel) > 0) {
      effectiveLevel = tempPerm.level;
      warnings.push('使用临时权限');
    }
  }

  const allowed = hasSufficientPermission(requiredLevel, effectiveLevel);
  return {
    result: {
      allowed,
      level: effectiveLevel,
      reason: allowed ? '权限足够' : '权限不足',
      matchedRules,
      effectivePermissions: effectiveLevel,
      warnings,
    },
    effectiveLevel,
  };
}

// ==================== Serialization Helpers ====================

export function serializeState(state: PermissionState): string {
  return JSON.stringify({ ...state, cache: undefined });
}

export function parseState(json: string): PermissionState | null {
  try {
    return JSON.parse(json) as PermissionState;
  } catch {
    return null;
  }
}

export function importStateFromJson(json: string): PermissionState | null {
  try {
    const parsed = JSON.parse(json);
    if (!parsed.rules || !Array.isArray(parsed.rules)) return null;
    return { ...parsed, cache: new Map() };
  } catch {
    return null;
  }
}
