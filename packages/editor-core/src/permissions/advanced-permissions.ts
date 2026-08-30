/**
 * 高级权限模块
 * 实现项目级别和文件夹级别的权限控制
 * 支持临时权限和审计日志
 * 与现有协作系统深度集成
 */

import { createId } from '../model';

// ==================== 类型定义 ====================

/** 权限级别 */
export type PermissionLevel = 'none' | 'read' | 'write' | 'admin' | 'owner';

/** 权限范围 */
export type PermissionScope = 'project' | 'folder' | 'file' | 'global';

/** 权限主体类型 */
export type PermissionSubjectType = 'user' | 'team' | 'role' | 'group';

/** 权限主体 */
export interface PermissionSubject {
  type: PermissionSubjectType;
  id: string;
  name: string;
}

/** 权限目标 */
export interface PermissionTarget {
  type: PermissionScope;
  id: string;
  name: string;
  parentId?: string;
}

/** 权限规则 */
export interface PermissionRule {
  id: string;
  subject: PermissionSubject;
  target: PermissionTarget;
  level: PermissionLevel;
  grantedBy: string;
  grantedAt: string;
  expiresAt?: string;
  conditions?: PermissionConditions;
  metadata: PermissionRuleMetadata;
}

/** 权限条件 */
export interface PermissionConditions {
  ipWhitelist?: string[];
  timeRange?: {
    start: string;
    end: string;
  };
  deviceRestrictions?: string[];
  requireMFA?: boolean;
  maxConcurrentSessions?: number;
}

/** 权限规则元数据 */
export interface PermissionRuleMetadata {
  description?: string;
  tags?: string[];
  priority: number;
  isTemporary: boolean;
  autoRevoke: boolean;
  lastEvaluatedAt?: string;
  evaluationCount: number;
}

/** 权限继承配置 */
export interface PermissionInheritance {
  enabled: boolean;
  mode: 'strict' | 'lenient' | 'override';
  inheritFromParent: boolean;
  propagateToChildren: boolean;
  overrideParent: boolean;
}

/** 权限组 */
export interface PermissionGroup {
  id: string;
  name: string;
  description: string;
  members: PermissionSubject[];
  rules: string[]; // 规则ID列表
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/** 临时权限 */
export interface TemporaryPermission {
  id: string;
  ruleId: string;
  subject: PermissionSubject;
  target: PermissionTarget;
  level: PermissionLevel;
  grantedBy: string;
  grantedAt: string;
  expiresAt: string;
  reason: string;
  autoRevoke: boolean;
  revokedAt?: string;
  revokedBy?: string;
}

/** 权限审计日志 */
export interface PermissionAuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: PermissionAuditAction;
  subject: PermissionSubject;
  target: PermissionTarget;
  previousLevel?: PermissionLevel;
  newLevel?: PermissionLevel;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/** 权限审计动作 */
export type PermissionAuditAction =
  | 'permission.granted'
  | 'permission.revoked'
  | 'permission.modified'
  | 'permission.expired'
  | 'permission.evaluated'
  | 'permission.denied'
  | 'group.created'
  | 'group.updated'
  | 'group.deleted'
  | 'group.member_added'
  | 'group.member_removed'
  | 'inheritance.enabled'
  | 'inheritance.disabled'
  | 'inheritance.overridden';

/** 权限评估结果 */
export interface PermissionEvaluationResult {
  allowed: boolean;
  level: PermissionLevel;
  reason: string;
  matchedRules: PermissionRule[];
  effectivePermissions: PermissionLevel;
  warnings: string[];
}

/** 权限配置 */
export interface PermissionConfig {
  inheritance: PermissionInheritance;
  defaultLevel: PermissionLevel;
  requireExplicitDeny: boolean;
  auditEnabled: boolean;
  auditRetentionDays: number;
  maxRulesPerSubject: number;
  maxGroupsPerUser: number;
  enableTemporaryPermissions: boolean;
  maxTemporaryDurationHours: number;
}

/** 权限状态 */
export interface PermissionState {
  rules: PermissionRule[];
  groups: PermissionGroup[];
  temporaryPermissions: TemporaryPermission[];
  auditLog: PermissionAuditLog[];
  config: PermissionConfig;
  cache: Map<string, PermissionEvaluationResult>;
}

// ==================== 默认配置 ====================

export const DEFAULT_PERMISSION_CONFIG: PermissionConfig = {
  inheritance: {
    enabled: true,
    mode: 'lenient',
    inheritFromParent: true,
    propagateToChildren: true,
    overrideParent: false,
  },
  defaultLevel: 'none',
  requireExplicitDeny: false,
  auditEnabled: true,
  auditRetentionDays: 90,
  maxRulesPerSubject: 100,
  maxGroupsPerUser: 10,
  enableTemporaryPermissions: true,
  maxTemporaryDurationHours: 24 * 7, // 7天
};

/** 权限级别权重 */
export const PERMISSION_LEVEL_WEIGHTS: Record<PermissionLevel, number> = {
  none: 0,
  read: 1,
  write: 2,
  admin: 3,
  owner: 4,
};

/** 权限级别列表 */
export const PERMISSION_LEVELS: PermissionLevel[] = ['none', 'read', 'write', 'admin', 'owner'];

// ==================== 工具函数 ====================

/**
 * 比较权限级别
 */
export function comparePermissionLevels(a: PermissionLevel, b: PermissionLevel): number {
  return PERMISSION_LEVEL_WEIGHTS[a] - PERMISSION_LEVEL_WEIGHTS[b];
}

/**
 * 检查权限级别是否足够
 */
export function hasSufficientPermission(required: PermissionLevel, actual: PermissionLevel): boolean {
  return PERMISSION_LEVEL_WEIGHTS[actual] >= PERMISSION_LEVEL_WEIGHTS[required];
}

/**
 * 获取最高权限级别
 */
export function getHighestPermission(levels: PermissionLevel[]): PermissionLevel {
  if (levels.length === 0) return 'none';
  return levels.reduce((highest, current) =>
    PERMISSION_LEVEL_WEIGHTS[current] > PERMISSION_LEVEL_WEIGHTS[highest] ? current : highest,
  );
}

/**
 * 检查权限是否过期
 */
export function isPermissionExpired(rule: PermissionRule): boolean {
  if (!rule.expiresAt) return false;
  return new Date(rule.expiresAt) < new Date();
}

/**
 * 检查临时权限是否有效
 */
export function isTemporaryPermissionValid(permission: TemporaryPermission): boolean {
  if (permission.revokedAt) return false;
  return new Date(permission.expiresAt) > new Date();
}

/**
 * 计算权限继承
 */
export function calculateInheritedPermission(
  parentLevel: PermissionLevel,
  childLevel: PermissionLevel,
  config: PermissionInheritance,
): PermissionLevel {
  if (!config.enabled) return childLevel;

  switch (config.mode) {
    case 'strict':
      // 严格模式：取较低的权限
      return comparePermissionLevels(parentLevel, childLevel) < 0 ? parentLevel : childLevel;
    case 'lenient':
      // 宽松模式：取较高的权限
      return getHighestPermission([parentLevel, childLevel]);
    case 'override':
      // 覆盖模式：子权限覆盖父权限
      return childLevel !== 'none' ? childLevel : parentLevel;
    default:
      return childLevel;
  }
}

/**
 * 验证权限规则
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
 * 创建权限规则
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

// ==================== 权限管理器 ====================

/**
 * 高级权限管理器
 * 提供完整的权限控制功能
 */
export class AdvancedPermissionManager {
  private state: PermissionState;
  private eventHandlers: Map<string, Set<(data: unknown) => void>> = new Map();

  constructor(config?: Partial<PermissionConfig>) {
    this.state = {
      rules: [],
      groups: [],
      temporaryPermissions: [],
      auditLog: [],
      config: { ...DEFAULT_PERMISSION_CONFIG, ...config },
      cache: new Map(),
    };
  }

  /**
   * 获取权限状态
   */
  getState(): PermissionState {
    return {
      ...this.state,
      cache: new Map(this.state.cache),
    };
  }

  /**
   * 获取配置
   */
  getConfig(): PermissionConfig {
    return { ...this.state.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<PermissionConfig>): void {
    this.state.config = { ...this.state.config, ...config };
    this.clearCache();
    this.emit('config.updated', this.state.config);
  }

  /**
   * 添加权限规则
   */
  addRule(
    rule: Omit<PermissionRule, 'id' | 'metadata'>,
    operatorId: string,
    operatorName: string,
  ): PermissionRule | null {
    // 验证规则
    const errors = validatePermissionRule(rule);
    if (errors.length > 0) {
      this.emit('rule.validation_failed', { rule, errors });
      return null;
    }

    // 检查是否超过限制
    const subjectRules = this.state.rules.filter(
      (r) => r.subject.id === rule.subject.id && r.subject.type === rule.subject.type,
    );
    if (subjectRules.length >= this.state.config.maxRulesPerSubject) {
      this.emit('rule.limit_exceeded', { subject: rule.subject });
      return null;
    }

    // 检查临时权限配置
    if (rule.expiresAt && !this.state.config.enableTemporaryPermissions) {
      this.emit('rule.temporary_disabled', { rule });
      return null;
    }

    // 检查临时权限时长限制
    if (rule.expiresAt) {
      const durationHours =
        (new Date(rule.expiresAt).getTime() - new Date(rule.grantedAt).getTime()) / (1000 * 60 * 60);
      if (durationHours > this.state.config.maxTemporaryDurationHours) {
        this.emit('rule.duration_exceeded', { rule, maxHours: this.state.config.maxTemporaryDurationHours });
        return null;
      }
    }

    const newRule: PermissionRule = {
      ...rule,
      id: createId('perm'),
      metadata: {
        priority: 0,
        isTemporary: !!rule.expiresAt,
        autoRevoke: !!rule.expiresAt,
        evaluationCount: 0,
      },
    };

    this.state.rules.push(newRule);
    this.clearCache();

    // 记录审计日志
    this.addAuditLog({
      userId: operatorId,
      userName: operatorName,
      action: 'permission.granted',
      subject: rule.subject,
      target: rule.target,
      newLevel: rule.level,
      details: { ruleId: newRule.id, expiresAt: rule.expiresAt },
    });

    this.emit('rule.added', newRule);

    return newRule;
  }

  /**
   * 移除权限规则
   */
  removeRule(ruleId: string, operatorId: string, operatorName: string): boolean {
    const ruleIndex = this.state.rules.findIndex((r) => r.id === ruleId);
    if (ruleIndex === -1) {
      return false;
    }

    const rule = this.state.rules[ruleIndex];
    this.state.rules.splice(ruleIndex, 1);
    this.clearCache();

    // 记录审计日志
    this.addAuditLog({
      userId: operatorId,
      userName: operatorName,
      action: 'permission.revoked',
      subject: rule.subject,
      target: rule.target,
      previousLevel: rule.level,
      details: { ruleId },
    });

    this.emit('rule.removed', rule);

    return true;
  }

  /**
   * 修改权限规则
   */
  modifyRule(
    ruleId: string,
    updates: Partial<Pick<PermissionRule, 'level' | 'expiresAt' | 'conditions'>>,
    operatorId: string,
    operatorName: string,
  ): PermissionRule | null {
    const rule = this.state.rules.find((r) => r.id === ruleId);
    if (!rule) {
      return null;
    }

    const previousLevel = rule.level;

    if (updates.level) rule.level = updates.level;
    if (updates.expiresAt !== undefined) {
      rule.expiresAt = updates.expiresAt;
      rule.metadata.isTemporary = !!updates.expiresAt;
      rule.metadata.autoRevoke = !!updates.expiresAt;
    }
    if (updates.conditions) rule.conditions = updates.conditions;

    this.clearCache();

    // 记录审计日志
    this.addAuditLog({
      userId: operatorId,
      userName: operatorName,
      action: 'permission.modified',
      subject: rule.subject,
      target: rule.target,
      previousLevel,
      newLevel: rule.level,
      details: { ruleId, updates },
    });

    this.emit('rule.modified', rule);

    return rule;
  }

  /**
   * 评估权限
   */
  evaluate(
    subject: PermissionSubject,
    target: PermissionTarget,
    requiredLevel: PermissionLevel,
  ): PermissionEvaluationResult {
    // 检查缓存
    const cacheKey = `${subject.id}:${target.id}:${requiredLevel}`;
    const cached = this.state.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const warnings: string[] = [];
    const matchedRules: PermissionRule[] = [];

    // 获取直接规则
    const directRules = this.state.rules.filter(
      (r) =>
        r.subject.id === subject.id &&
        r.subject.type === subject.type &&
        r.target.id === target.id &&
        r.target.type === target.type,
    );

    // 获取继承规则
    const inheritedRules = this.state.config.inheritance.enabled ? this.getInheritedRules(subject, target) : [];

    // 获取组规则
    const groupRules = this.getGroupRules(subject, target);

    // 获取临时权限
    const tempPermissions = this.state.temporaryPermissions.filter(
      (tp) => tp.subject.id === subject.id && tp.target.id === target.id && isTemporaryPermissionValid(tp),
    );

    // 合并所有规则
    const allRules = [...directRules, ...inheritedRules, ...groupRules];

    // 过滤过期规则
    const validRules = allRules.filter((r) => !isPermissionExpired(r));
    if (validRules.length < allRules.length) {
      warnings.push('部分规则已过期');
    }

    // 按优先级排序
    validRules.sort((a, b) => b.metadata.priority - a.metadata.priority);

    // 计算最终权限
    let effectiveLevel: PermissionLevel = this.state.config.defaultLevel;

    for (const rule of validRules) {
      matchedRules.push(rule);
      rule.metadata.evaluationCount++;
      rule.metadata.lastEvaluatedAt = new Date().toISOString();

      if (comparePermissionLevels(rule.level, effectiveLevel) > 0) {
        effectiveLevel = rule.level;
      }
    }

    // 应用临时权限
    for (const tempPerm of tempPermissions) {
      if (comparePermissionLevels(tempPerm.level, effectiveLevel) > 0) {
        effectiveLevel = tempPerm.level;
        warnings.push('使用临时权限');
      }
    }

    const allowed = hasSufficientPermission(requiredLevel, effectiveLevel);

    const result: PermissionEvaluationResult = {
      allowed,
      level: effectiveLevel,
      reason: allowed ? '权限足够' : '权限不足',
      matchedRules,
      effectivePermissions: effectiveLevel,
      warnings,
    };

    // 缓存结果
    this.state.cache.set(cacheKey, result);

    // 记录审计日志
    if (this.state.config.auditEnabled) {
      this.addAuditLog({
        userId: subject.id,
        userName: subject.name,
        action: allowed ? 'permission.evaluated' : 'permission.denied',
        subject,
        target,
        newLevel: effectiveLevel,
        details: { requiredLevel, allowed, warnings },
      });
    }

    this.emit('permission.evaluated', result);

    return result;
  }

  /**
   * 获取继承规则
   */
  private getInheritedRules(subject: PermissionSubject, target: PermissionTarget): PermissionRule[] {
    if (!this.state.config.inheritance.inheritFromParent) {
      return [];
    }

    const rules: PermissionRule[] = [];

    // 递归获取父级规则
    const collectParentRules = (currentTarget: PermissionTarget) => {
      if (!currentTarget.parentId) return;

      const parentRules = this.state.rules.filter(
        (r) => r.subject.id === subject.id && r.target.id === currentTarget.parentId,
      );

      rules.push(...parentRules);

      // 继续向上查找
      const parentTarget = this.state.rules.find((r) => r.target.id === currentTarget.parentId)?.target;
      if (parentTarget) {
        collectParentRules(parentTarget);
      }
    };

    collectParentRules(target);

    return rules;
  }

  /**
   * 获取组规则
   */
  private getGroupRules(subject: PermissionSubject, target: PermissionTarget): PermissionRule[] {
    const rules: PermissionRule[] = [];

    // 查找用户所属的组
    const userGroups = this.state.groups.filter((g) =>
      g.members.some((m) => m.id === subject.id && m.type === subject.type),
    );

    // 获取组的规则
    for (const group of userGroups) {
      for (const ruleId of group.rules) {
        const rule = this.state.rules.find((r) => r.id === ruleId);
        if (rule && rule.target.id === target.id) {
          rules.push(rule);
        }
      }
    }

    return rules;
  }

  /**
   * 创建权限组
   */
  createGroup(name: string, description: string, operatorId: string, operatorName: string): PermissionGroup {
    const group: PermissionGroup = {
      id: createId('group'),
      name,
      description,
      members: [],
      rules: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: operatorId,
    };

    this.state.groups.push(group);

    this.addAuditLog({
      userId: operatorId,
      userName: operatorName,
      action: 'group.created',
      subject: { type: 'group', id: group.id, name },
      target: { type: 'global', id: 'all', name: '全局' },
      details: { groupId: group.id },
    });

    this.emit('group.created', group);

    return group;
  }

  /**
   * 更新权限组
   */
  updateGroup(
    groupId: string,
    updates: Partial<Pick<PermissionGroup, 'name' | 'description'>>,
    operatorId: string,
    operatorName: string,
  ): PermissionGroup | null {
    const group = this.state.groups.find((g) => g.id === groupId);
    if (!group) return null;

    if (updates.name) group.name = updates.name;
    if (updates.description) group.description = updates.description;
    group.updatedAt = new Date().toISOString();

    this.addAuditLog({
      userId: operatorId,
      userName: operatorName,
      action: 'group.updated',
      subject: { type: 'group', id: groupId, name: group.name },
      target: { type: 'global', id: 'all', name: '全局' },
      details: { updates },
    });

    this.emit('group.updated', group);

    return group;
  }

  /**
   * 删除权限组
   */
  deleteGroup(groupId: string, operatorId: string, operatorName: string): boolean {
    const groupIndex = this.state.groups.findIndex((g) => g.id === groupId);
    if (groupIndex === -1) return false;

    const group = this.state.groups[groupIndex];
    this.state.groups.splice(groupIndex, 1);

    this.addAuditLog({
      userId: operatorId,
      userName: operatorName,
      action: 'group.deleted',
      subject: { type: 'group', id: groupId, name: group.name },
      target: { type: 'global', id: 'all', name: '全局' },
      details: { groupId },
    });

    this.emit('group.deleted', { groupId });

    return true;
  }

  /**
   * 添加组成员
   */
  addGroupMember(groupId: string, member: PermissionSubject, operatorId: string, operatorName: string): boolean {
    const group = this.state.groups.find((g) => g.id === groupId);
    if (!group) return false;

    // 检查是否已在组中
    if (group.members.some((m) => m.id === member.id && m.type === member.type)) {
      return false;
    }

    // 检查用户组数限制
    const userGroups = this.state.groups.filter((g) => g.members.some((m) => m.id === member.id));
    if (userGroups.length >= this.state.config.maxGroupsPerUser) {
      return false;
    }

    group.members.push(member);
    group.updatedAt = new Date().toISOString();

    this.addAuditLog({
      userId: operatorId,
      userName: operatorName,
      action: 'group.member_added',
      subject: member,
      target: { type: 'global', id: groupId, name: group.name },
      details: { groupId },
    });

    this.emit('group.member_added', { groupId, member });

    return true;
  }

  /**
   * 移除组成员
   */
  removeGroupMember(
    groupId: string,
    memberId: string,
    memberType: PermissionSubjectType,
    operatorId: string,
    operatorName: string,
  ): boolean {
    const group = this.state.groups.find((g) => g.id === groupId);
    if (!group) return false;

    const memberIndex = group.members.findIndex((m) => m.id === memberId && m.type === memberType);
    if (memberIndex === -1) return false;

    const member = group.members[memberIndex];
    group.members.splice(memberIndex, 1);
    group.updatedAt = new Date().toISOString();

    this.addAuditLog({
      userId: operatorId,
      userName: operatorName,
      action: 'group.member_removed',
      subject: member,
      target: { type: 'global', id: groupId, name: group.name },
      details: { groupId },
    });

    this.emit('group.member_removed', { groupId, member });

    return true;
  }

  /**
   * 添加组规则
   */
  addGroupRule(groupId: string, ruleId: string, operatorId: string, operatorName: string): boolean {
    const group = this.state.groups.find((g) => g.id === groupId);
    if (!group) return false;

    // 检查规则是否存在
    if (!this.state.rules.some((r) => r.id === ruleId)) {
      return false;
    }

    // 检查是否已添加
    if (group.rules.includes(ruleId)) {
      return false;
    }

    group.rules.push(ruleId);
    group.updatedAt = new Date().toISOString();

    this.emit('group.rule_added', { groupId, ruleId });

    return true;
  }

  /**
   * 移除组规则
   */
  removeGroupRule(groupId: string, ruleId: string, operatorId: string, operatorName: string): boolean {
    const group = this.state.groups.find((g) => g.id === groupId);
    if (!group) return false;

    const ruleIndex = group.rules.indexOf(ruleId);
    if (ruleIndex === -1) return false;

    group.rules.splice(ruleIndex, 1);
    group.updatedAt = new Date().toISOString();

    this.emit('group.rule_removed', { groupId, ruleId });

    return true;
  }

  /**
   * 创建临时权限
   */
  createTemporaryPermission(
    subject: PermissionSubject,
    target: PermissionTarget,
    level: PermissionLevel,
    durationHours: number,
    reason: string,
    grantedBy: string,
    grantedByName: string,
  ): TemporaryPermission | null {
    if (!this.state.config.enableTemporaryPermissions) {
      return null;
    }

    if (durationHours > this.state.config.maxTemporaryDurationHours) {
      return null;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

    const tempPermission: TemporaryPermission = {
      id: createId('temp-perm'),
      ruleId: createId('perm'),
      subject,
      target,
      level,
      grantedBy,
      grantedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      reason,
      autoRevoke: true,
    };

    this.state.temporaryPermissions.push(tempPermission);

    // 设置自动撤销
    if (tempPermission.autoRevoke) {
      setTimeout(
        () => {
          this.revokeTemporaryPermission(tempPermission.id, 'system', '系统');
        },
        durationHours * 60 * 60 * 1000,
      );
    }

    this.addAuditLog({
      userId: grantedBy,
      userName: grantedByName,
      action: 'permission.granted',
      subject,
      target,
      newLevel: level,
      details: {
        temporary: true,
        durationHours,
        reason,
        expiresAt: expiresAt.toISOString(),
      },
    });

    this.emit('temporary_permission.created', tempPermission);

    return tempPermission;
  }

  /**
   * 撤销临时权限
   */
  revokeTemporaryPermission(permissionId: string, revokedBy: string, revokedByName: string): boolean {
    const permission = this.state.temporaryPermissions.find((tp) => tp.id === permissionId);
    if (!permission) return false;

    permission.revokedAt = new Date().toISOString();
    permission.revokedBy = revokedBy;

    this.addAuditLog({
      userId: revokedBy,
      userName: revokedByName,
      action: 'permission.revoked',
      subject: permission.subject,
      target: permission.target,
      previousLevel: permission.level,
      details: { temporary: true, permissionId },
    });

    this.emit('temporary_permission.revoked', permission);

    return true;
  }

  /**
   * 获取用户的权限
   */
  getUserPermissions(userId: string): PermissionRule[] {
    return this.state.rules.filter((r) => r.subject.id === userId);
  }

  /**
   * 获取目标的权限
   */
  getTargetPermissions(targetId: string): PermissionRule[] {
    return this.state.rules.filter((r) => r.target.id === targetId);
  }

  /**
   * 获取用户的组
   */
  getUserGroups(userId: string): PermissionGroup[] {
    return this.state.groups.filter((g) => g.members.some((m) => m.id === userId));
  }

  /**
   * 获取审计日志
   */
  getAuditLog(filters?: {
    userId?: string;
    action?: PermissionAuditAction;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): PermissionAuditLog[] {
    let logs = [...this.state.auditLog];

    if (filters?.userId) {
      logs = logs.filter((l) => l.userId === filters.userId);
    }
    if (filters?.action) {
      logs = logs.filter((l) => l.action === filters.action);
    }
    if (filters?.startDate) {
      logs = logs.filter((l) => new Date(l.timestamp) >= new Date(filters.startDate!));
    }
    if (filters?.endDate) {
      logs = logs.filter((l) => new Date(l.timestamp) <= new Date(filters.endDate!));
    }

    // 按时间倒序
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (filters?.limit) {
      logs = logs.slice(0, filters.limit);
    }

    return logs;
  }

  /**
   * 清除过期的临时权限
   */
  cleanupExpiredPermissions(): number {
    const now = new Date();
    const before = this.state.temporaryPermissions.length;

    this.state.temporaryPermissions = this.state.temporaryPermissions.filter((tp) => isTemporaryPermissionValid(tp));

    const removed = before - this.state.temporaryPermissions.length;

    if (removed > 0) {
      this.emit('temporary_permissions.cleaned', { removed });
    }

    return removed;
  }

  /**
   * 清除审计日志
   */
  cleanupAuditLog(): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.state.config.auditRetentionDays);

    const before = this.state.auditLog.length;

    this.state.auditLog = this.state.auditLog.filter((log) => new Date(log.timestamp) > cutoffDate);

    return before - this.state.auditLog.length;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.state.cache.clear();
  }

  /**
   * 记录审计日志
   */
  private addAuditLog(entry: Omit<PermissionAuditLog, 'id' | 'timestamp'>): void {
    if (!this.state.config.auditEnabled) return;

    const log: PermissionAuditLog = {
      ...entry,
      id: createId('audit'),
      timestamp: new Date().toISOString(),
    };

    this.state.auditLog.push(log);

    // 限制日志数量
    if (this.state.auditLog.length > 10000) {
      this.state.auditLog = this.state.auditLog.slice(-5000);
    }
  }

  /**
   * 导出状态
   */
  exportState(): string {
    return JSON.stringify(
      {
        ...this.state,
        cache: undefined,
      },
      null,
      2,
    );
  }

  /**
   * 导入状态
   */
  importState(stateJson: string): boolean {
    try {
      const parsed = JSON.parse(stateJson);

      if (!parsed.rules || !Array.isArray(parsed.rules)) {
        return false;
      }

      this.state = {
        ...parsed,
        cache: new Map(),
      };

      return true;
    } catch {
      return false;
    }
  }

  /**
   * 注册事件处理器
   */
  on(event: string, handler: (data: unknown) => void): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);

    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  /**
   * 触发事件
   */
  private emit(event: string, data: unknown): void {
    this.eventHandlers.get(event)?.forEach((handler) => handler(data));
  }

  /**
   * 释放资源
   */
  dispose(): void {
    this.eventHandlers.clear();
    this.state.cache.clear();
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建权限管理器
 */
export function createPermissionManager(config?: Partial<PermissionConfig>): AdvancedPermissionManager {
  return new AdvancedPermissionManager(config);
}

/**
 * 从状态恢复权限管理器
 */
export function restorePermissionManager(stateJson: string): AdvancedPermissionManager | null {
  try {
    const manager = new AdvancedPermissionManager();
    if (manager.importState(stateJson)) {
      return manager;
    }
    return null;
  } catch {
    return null;
  }
}

// ==================== 序列化函数 ====================

/**
 * 序列化权限状态
 */
export function serializePermissionState(state: PermissionState): string {
  return JSON.stringify({
    ...state,
    cache: undefined,
  });
}

/**
 * 解析权限状态
 */
export function parsePermissionState(json: string): PermissionState | null {
  try {
    return JSON.parse(json) as PermissionState;
  } catch {
    return null;
  }
}
