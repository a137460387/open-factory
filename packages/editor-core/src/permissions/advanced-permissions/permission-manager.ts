/**
 * Advanced permission manager
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
  isPermissionExpired,
  isTemporaryPermissionValid,
  validatePermissionRule,
  appendAuditLog,
  findGroup,
  findGroupMemberIndex,
  isUserInGroup,
  countUserGroups,
  findGroupRuleIndex,
  ruleExists,
  createGroupRecord,
  auditGroupAction,
  filterAuditLogs,
  collectDirectRules,
  collectInheritedRules,
  collectGroupRules,
  buildEvaluationResult,
  importStateFromJson,
} from './utils';

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

  getState(): PermissionState {
    return { ...this.state, cache: new Map(this.state.cache) };
  }

  getConfig(): PermissionConfig {
    return { ...this.state.config };
  }

  updateConfig(config: Partial<PermissionConfig>): void {
    this.state.config = { ...this.state.config, ...config };
    this.clearCache();
    this.emit('config.updated', this.state.config);
  }

  // ==================== Rule Management ====================

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
      metadata: { priority: 0, isTemporary: !!rule.expiresAt, autoRevoke: !!rule.expiresAt, evaluationCount: 0 },
    };

    this.state.rules.push(newRule);
    this.clearCache();
    appendAuditLog(this.state, {
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

  removeRule(ruleId: string, operatorId: string, operatorName: string): boolean {
    const ruleIndex = this.state.rules.findIndex((r) => r.id === ruleId);
    if (ruleIndex === -1) return false;
    const rule = this.state.rules[ruleIndex];
    this.state.rules.splice(ruleIndex, 1);
    this.clearCache();
    appendAuditLog(this.state, {
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

  modifyRule(
    ruleId: string,
    updates: Partial<Pick<PermissionRule, 'level' | 'expiresAt' | 'conditions'>>,
    operatorId: string,
    operatorName: string,
  ): PermissionRule | null {
    const rule = this.state.rules.find((r) => r.id === ruleId);
    if (!rule) return null;
    const previousLevel = rule.level;
    if (updates.level) rule.level = updates.level;
    if (updates.expiresAt !== undefined) {
      rule.expiresAt = updates.expiresAt;
      rule.metadata.isTemporary = !!updates.expiresAt;
      rule.metadata.autoRevoke = !!updates.expiresAt;
    }
    if (updates.conditions) rule.conditions = updates.conditions;
    this.clearCache();
    appendAuditLog(this.state, {
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

  // ==================== Evaluation ====================

  evaluate(
    subject: PermissionSubject,
    target: PermissionTarget,
    requiredLevel: PermissionLevel,
  ): PermissionEvaluationResult {
    const cacheKey = `${subject.id}:${target.id}:${requiredLevel}`;
    const cached = this.state.cache.get(cacheKey);
    if (cached) return cached;

    const directRules = collectDirectRules(this.state.rules, subject, target);
    const inheritedRules = this.state.config.inheritance.enabled
      ? collectInheritedRules(this.state.rules, subject, target)
      : [];
    const groupRules = collectGroupRules(this.state, subject, target);
    const tempPermissions = this.state.temporaryPermissions.filter(
      (tp) => tp.subject.id === subject.id && tp.target.id === target.id && isTemporaryPermissionValid(tp),
    );

    const allRules = [...directRules, ...inheritedRules, ...groupRules];
    const validRules = allRules.filter((r) => !isPermissionExpired(r));
    const warnings = validRules.length < allRules.length ? ['部分规则已过期'] : [];

    validRules.sort((a, b) => b.metadata.priority - a.metadata.priority);

    const { result, effectiveLevel } = buildEvaluationResult(
      this.state.config,
      validRules,
      tempPermissions,
      requiredLevel,
    );
    result.warnings.push(...warnings);

    this.state.cache.set(cacheKey, result);

    if (this.state.config.auditEnabled) {
      appendAuditLog(this.state, {
        userId: subject.id,
        userName: subject.name,
        action: result.allowed ? 'permission.evaluated' : 'permission.denied',
        subject,
        target,
        newLevel: effectiveLevel,
        details: { requiredLevel, allowed: result.allowed, warnings: result.warnings },
      });
    }

    this.emit('permission.evaluated', result);
    return result;
  }

  // ==================== Group Management ====================

  createGroup(name: string, description: string, operatorId: string, operatorName: string): PermissionGroup {
    const group = createGroupRecord(operatorId);
    group.name = name;
    group.description = description;
    this.state.groups.push(group);
    auditGroupAction(this.state, 'group.created', operatorId, operatorName, group.id, name,
      { type: 'group', id: group.id, name }, { groupId: group.id });
    this.emit('group.created', group);
    return group;
  }

  updateGroup(
    groupId: string,
    updates: Partial<Pick<PermissionGroup, 'name' | 'description'>>,
    operatorId: string,
    operatorName: string,
  ): PermissionGroup | null {
    const group = findGroup(this.state, groupId);
    if (!group) return null;
    if (updates.name) group.name = updates.name;
    if (updates.description) group.description = updates.description;
    group.updatedAt = new Date().toISOString();
    auditGroupAction(this.state, 'group.updated', operatorId, operatorName, groupId, group.name,
      { type: 'group', id: groupId, name: group.name }, { updates });
    this.emit('group.updated', group);
    return group;
  }

  deleteGroup(groupId: string, operatorId: string, operatorName: string): boolean {
    const groupIndex = this.state.groups.findIndex((g) => g.id === groupId);
    if (groupIndex === -1) return false;
    const group = this.state.groups[groupIndex];
    this.state.groups.splice(groupIndex, 1);
    auditGroupAction(this.state, 'group.deleted', operatorId, operatorName, groupId, group.name,
      { type: 'group', id: groupId, name: group.name }, { groupId });
    this.emit('group.deleted', { groupId });
    return true;
  }

  addGroupMember(groupId: string, member: PermissionSubject, operatorId: string, operatorName: string): boolean {
    const group = findGroup(this.state, groupId);
    if (!group) return false;
    if (isUserInGroup(group, member)) return false;
    if (countUserGroups(this.state, member.id) >= this.state.config.maxGroupsPerUser) return false;
    group.members.push(member);
    group.updatedAt = new Date().toISOString();
    auditGroupAction(this.state, 'group.member_added', operatorId, operatorName, groupId, group.name,
      member, { groupId });
    this.emit('group.member_added', { groupId, member });
    return true;
  }

  removeGroupMember(
    groupId: string,
    memberId: string,
    memberType: PermissionSubjectType,
    operatorId: string,
    operatorName: string,
  ): boolean {
    const group = findGroup(this.state, groupId);
    if (!group) return false;
    const memberIndex = findGroupMemberIndex(group, memberId, memberType);
    if (memberIndex === -1) return false;
    const member = group.members[memberIndex];
    group.members.splice(memberIndex, 1);
    group.updatedAt = new Date().toISOString();
    auditGroupAction(this.state, 'group.member_removed', operatorId, operatorName, groupId, group.name,
      member, { groupId });
    this.emit('group.member_removed', { groupId, member });
    return true;
  }

  addGroupRule(groupId: string, ruleId: string, operatorId: string, operatorName: string): boolean {
    const group = findGroup(this.state, groupId);
    if (!group) return false;
    if (!ruleExists(this.state, ruleId)) return false;
    if (group.rules.includes(ruleId)) return false;
    group.rules.push(ruleId);
    group.updatedAt = new Date().toISOString();
    this.emit('group.rule_added', { groupId, ruleId });
    return true;
  }

  removeGroupRule(groupId: string, ruleId: string, operatorId: string, operatorName: string): boolean {
    const group = findGroup(this.state, groupId);
    if (!group) return false;
    const ruleIndex = findGroupRuleIndex(group, ruleId);
    if (ruleIndex === -1) return false;
    group.rules.splice(ruleIndex, 1);
    group.updatedAt = new Date().toISOString();
    this.emit('group.rule_removed', { groupId, ruleId });
    return true;
  }

  // ==================== Temporary Permissions ====================

  createTemporaryPermission(
    subject: PermissionSubject,
    target: PermissionTarget,
    level: PermissionLevel,
    durationHours: number,
    reason: string,
    grantedBy: string,
    grantedByName: string,
  ): TemporaryPermission | null {
    if (!this.state.config.enableTemporaryPermissions) return null;
    if (durationHours > this.state.config.maxTemporaryDurationHours) return null;

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
      setTimeout(() => {
        this.revokeTemporaryPermission(tempPermission.id, 'system', '系统');
      }, durationHours * 60 * 60 * 1000);
    }

    appendAuditLog(this.state, {
      userId: grantedBy,
      userName: grantedByName,
      action: 'permission.granted',
      subject,
      target,
      newLevel: level,
      details: { temporary: true, durationHours, reason, expiresAt: expiresAt.toISOString() },
    });
    this.emit('temporary_permission.created', tempPermission);
    return tempPermission;
  }

  revokeTemporaryPermission(permissionId: string, revokedBy: string, revokedByName: string): boolean {
    const permission = this.state.temporaryPermissions.find((tp) => tp.id === permissionId);
    if (!permission) return false;
    permission.revokedAt = new Date().toISOString();
    permission.revokedBy = revokedBy;
    appendAuditLog(this.state, {
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

  getUserPermissions(userId: string): PermissionRule[] {
    return this.state.rules.filter((r) => r.subject.id === userId);
  }

  getTargetPermissions(targetId: string): PermissionRule[] {
    return this.state.rules.filter((r) => r.target.id === targetId);
  }

  getUserGroups(userId: string): PermissionGroup[] {
    return this.state.groups.filter((g) => g.members.some((m) => m.id === userId));
  }

  getAuditLog(filters?: {
    userId?: string;
    action?: PermissionAuditAction;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): PermissionAuditLog[] {
    return filterAuditLogs(this.state.auditLog, filters);
  }

  // ==================== Cleanup ====================

  cleanupExpiredPermissions(): number {
    const before = this.state.temporaryPermissions.length;
    this.state.temporaryPermissions = this.state.temporaryPermissions.filter((tp) => isTemporaryPermissionValid(tp));
    const removed = before - this.state.temporaryPermissions.length;
    if (removed > 0) this.emit('temporary_permissions.cleaned', { removed });
    return removed;
  }

  cleanupAuditLog(): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.state.config.auditRetentionDays);
    const before = this.state.auditLog.length;
    this.state.auditLog = this.state.auditLog.filter((log) => new Date(log.timestamp) > cutoffDate);
    return before - this.state.auditLog.length;
  }

  clearCache(): void {
    this.state.cache.clear();
  }

  // ==================== State I/O ====================

  exportState(): string {
    return JSON.stringify({ ...this.state, cache: undefined }, null, 2);
  }

  importState(stateJson: string): boolean {
    const parsed = importStateFromJson(stateJson);
    if (!parsed) return false;
    this.state = parsed;
    return true;
  }

  // ==================== Events ====================

  on(event: string, handler: (data: unknown) => void): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  private emit(event: string, data: unknown): void {
    this.eventHandlers.get(event)?.forEach((handler) => handler(data));
  }

  dispose(): void {
    this.eventHandlers.clear();
    this.state.cache.clear();
  }
}
