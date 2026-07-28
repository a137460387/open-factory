/**
 * Advanced permission manager
 * Provides complete permission control functionality
 */

import {
  type PermissionLevel,
  type PermissionSubject,
  type PermissionSubjectType,
  type PermissionTarget,
  type PermissionRule,
  type PermissionGroup,
  type PermissionAuditAction,
  type PermissionAuditLog,
  type PermissionEvaluationResult,
  type PermissionConfig,
  type PermissionState,
  type TemporaryPermission,
  DEFAULT_PERMISSION_CONFIG,
  createId,
} from './types';

import {
  comparePermissionLevels,
  hasSufficientPermission,
  isPermissionExpired,
  isTemporaryPermissionValid,
  validatePermissionRule,
} from './utils';

/**
 * Advanced permission manager
 * Provides complete permission control functionality
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
   * Get permission state
   */
  getState(): PermissionState {
    return {
      ...this.state,
      cache: new Map(this.state.cache),
    };
  }

  /**
   * Get config
   */
  getConfig(): PermissionConfig {
    return { ...this.state.config };
  }

  /**
   * Update config
   */
  updateConfig(config: Partial<PermissionConfig>): void {
    this.state.config = { ...this.state.config, ...config };
    this.clearCache();
    this.emit('config.updated', this.state.config);
  }

  /**
   * Add permission rule
   */
  addRule(
    rule: Omit<PermissionRule, 'id' | 'metadata'>,
    operatorId: string,
    operatorName: string,
  ): PermissionRule | null {
    const errors = validatePermissionRule(rule);
    if (errors.length > 0) {
      this.emit('rule.validation_failed', { rule, errors });
      return null;
    }

    const subjectRules = this.state.rules.filter(
      (r) => r.subject.id === rule.subject.id && r.subject.type === rule.subject.type,
    );
    if (subjectRules.length >= this.state.config.maxRulesPerSubject) {
      this.emit('rule.limit_exceeded', { subject: rule.subject });
      return null;
    }

    if (rule.expiresAt && !this.state.config.enableTemporaryPermissions) {
      this.emit('rule.temporary_disabled', { rule });
      return null;
    }

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
   * Remove permission rule
   */
  removeRule(ruleId: string, operatorId: string, operatorName: string): boolean {
    const ruleIndex = this.state.rules.findIndex((r) => r.id === ruleId);
    if (ruleIndex === -1) {
      return false;
    }

    const rule = this.state.rules[ruleIndex];
    this.state.rules.splice(ruleIndex, 1);
    this.clearCache();

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
   * Modify permission rule
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
   * Evaluate permission
   */
  evaluate(
    subject: PermissionSubject,
    target: PermissionTarget,
    requiredLevel: PermissionLevel,
  ): PermissionEvaluationResult {
    const cacheKey = `${subject.id}:${target.id}:${requiredLevel}`;
    const cached = this.state.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const warnings: string[] = [];
    const matchedRules: PermissionRule[] = [];

    const directRules = this.state.rules.filter(
      (r) =>
        r.subject.id === subject.id &&
        r.subject.type === subject.type &&
        r.target.id === target.id &&
        r.target.type === target.type,
    );

    const inheritedRules = this.state.config.inheritance.enabled ? this.getInheritedRules(subject, target) : [];

    const groupRules = this.getGroupRules(subject, target);

    const tempPermissions = this.state.temporaryPermissions.filter(
      (tp) => tp.subject.id === subject.id && tp.target.id === target.id && isTemporaryPermissionValid(tp),
    );

    const allRules = [...directRules, ...inheritedRules, ...groupRules];

    const validRules = allRules.filter((r) => !isPermissionExpired(r));
    if (validRules.length < allRules.length) {
      warnings.push('部分规则已过期');
    }

    validRules.sort((a, b) => b.metadata.priority - a.metadata.priority);

    let effectiveLevel: PermissionLevel = this.state.config.defaultLevel;

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

    const result: PermissionEvaluationResult = {
      allowed,
      level: effectiveLevel,
      reason: allowed ? '权限足够' : '权限不足',
      matchedRules,
      effectivePermissions: effectiveLevel,
      warnings,
    };

    this.state.cache.set(cacheKey, result);

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
   * Get inherited rules
   */
  private getInheritedRules(subject: PermissionSubject, target: PermissionTarget): PermissionRule[] {
    if (!this.state.config.inheritance.inheritFromParent) {
      return [];
    }

    const rules: PermissionRule[] = [];

    const collectParentRules = (currentTarget: PermissionTarget) => {
      if (!currentTarget.parentId) return;

      const parentRules = this.state.rules.filter(
        (r) => r.subject.id === subject.id && r.target.id === currentTarget.parentId,
      );

      rules.push(...parentRules);

      const parentTarget = this.state.rules.find((r) => r.target.id === currentTarget.parentId)?.target;
      if (parentTarget) {
        collectParentRules(parentTarget);
      }
    };

    collectParentRules(target);

    return rules;
  }

  /**
   * Get group rules
   */
  private getGroupRules(subject: PermissionSubject, target: PermissionTarget): PermissionRule[] {
    const rules: PermissionRule[] = [];

    const userGroups = this.state.groups.filter((g) =>
      g.members.some((m) => m.id === subject.id && m.type === subject.type),
    );

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

  // ==================== Group Management ====================

  /**
   * Create permission group
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
   * Update permission group
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
   * Delete permission group
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
   * Add group member
   */
  addGroupMember(groupId: string, member: PermissionSubject, operatorId: string, operatorName: string): boolean {
    const group = this.state.groups.find((g) => g.id === groupId);
    if (!group) return false;

    if (group.members.some((m) => m.id === member.id && m.type === member.type)) {
      return false;
    }

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
   * Remove group member
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
   * Add group rule
   */
  addGroupRule(groupId: string, ruleId: string, operatorId: string, operatorName: string): boolean {
    const group = this.state.groups.find((g) => g.id === groupId);
    if (!group) return false;

    if (!this.state.rules.some((r) => r.id === ruleId)) {
      return false;
    }

    if (group.rules.includes(ruleId)) {
      return false;
    }

    group.rules.push(ruleId);
    group.updatedAt = new Date().toISOString();

    this.emit('group.rule_added', { groupId, ruleId });

    return true;
  }

  /**
   * Remove group rule
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

  // ==================== Temporary Permissions ====================

  /**
   * Create temporary permission
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
   * Revoke temporary permission
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

  // ==================== Queries ====================

  /**
   * Get user permissions
   */
  getUserPermissions(userId: string): PermissionRule[] {
    return this.state.rules.filter((r) => r.subject.id === userId);
  }

  /**
   * Get target permissions
   */
  getTargetPermissions(targetId: string): PermissionRule[] {
    return this.state.rules.filter((r) => r.target.id === targetId);
  }

  /**
   * Get user groups
   */
  getUserGroups(userId: string): PermissionGroup[] {
    return this.state.groups.filter((g) => g.members.some((m) => m.id === userId));
  }

  /**
   * Get audit log
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

    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (filters?.limit) {
      logs = logs.slice(0, filters.limit);
    }

    return logs;
  }

  // ==================== Cleanup ====================

  /**
   * Cleanup expired temporary permissions
   */
  cleanupExpiredPermissions(): number {
    const before = this.state.temporaryPermissions.length;

    this.state.temporaryPermissions = this.state.temporaryPermissions.filter((tp) => isTemporaryPermissionValid(tp));

    const removed = before - this.state.temporaryPermissions.length;

    if (removed > 0) {
      this.emit('temporary_permissions.cleaned', { removed });
    }

    return removed;
  }

  /**
   * Cleanup audit log
   */
  cleanupAuditLog(): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.state.config.auditRetentionDays);

    const before = this.state.auditLog.length;

    this.state.auditLog = this.state.auditLog.filter((log) => new Date(log.timestamp) > cutoffDate);

    return before - this.state.auditLog.length;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.state.cache.clear();
  }

  // ==================== Internal ====================

  /**
   * Add audit log entry
   */
  private addAuditLog(entry: Omit<PermissionAuditLog, 'id' | 'timestamp'>): void {
    if (!this.state.config.auditEnabled) return;

    const log: PermissionAuditLog = {
      ...entry,
      id: createId('audit'),
      timestamp: new Date().toISOString(),
    };

    this.state.auditLog.push(log);

    if (this.state.auditLog.length > 10000) {
      this.state.auditLog = this.state.auditLog.slice(-5000);
    }
  }

  /**
   * Export state
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
   * Import state
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
   * Register event handler
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
   * Emit event
   */
  private emit(event: string, data: unknown): void {
    this.eventHandlers.get(event)?.forEach((handler) => handler(data));
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.eventHandlers.clear();
    this.state.cache.clear();
  }
}
