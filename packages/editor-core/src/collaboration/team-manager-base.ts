/**
 * TeamManagerBase - core state management and team operations
 */

import { createId } from '../model';
import type {
  Team,
  TeamSettings,
  TeamMember,
  TeamRole,
  TeamState,
  TeamOperationResult,
  TeamAuditLog,
} from './types';
import {
  DEFAULT_TEAM_SETTINGS,
  getTeamRolePermissions,
  hasTeamPermission,
} from './types';

/**
 * Base team manager with state management, team CRUD, and core infrastructure
 */
export class TeamManagerBase {
  protected state: TeamState;
  protected eventHandlers: Map<string, Set<(data: unknown) => void>> = new Map();

  constructor(initialState?: Partial<TeamState>) {
    this.state = {
      team: initialState?.team ?? this.createDefaultTeam(),
      members: initialState?.members ?? [],
      invitations: initialState?.invitations ?? [],
      sharedProjects: initialState?.sharedProjects ?? [],
      auditLog: initialState?.auditLog ?? [],
    };
  }

  /**
   * Create default team
   */
  private createDefaultTeam(): Team {
    const now = new Date().toISOString();
    return {
      id: createId('team'),
      name: '我的团队',
      description: '',
      createdAt: now,
      updatedAt: now,
      createdBy: '',
      settings: { ...DEFAULT_TEAM_SETTINGS },
      metadata: {
        memberCount: 0,
        projectCount: 0,
        lastActivityAt: now,
        storageUsed: 0,
        storageLimit: 1024 * 1024 * 1024,
      },
    };
  }

  /**
   * Get team state
   */
  getState(): TeamState {
    return { ...this.state };
  }

  /**
   * Get team info
   */
  getTeam(): Team {
    return { ...this.state.team };
  }

  /**
   * Get team member list
   */
  getMembers(): TeamMember[] {
    return [...this.state.members];
  }

  /**
   * Get specific member
   */
  getMember(userId: string): TeamMember | undefined {
    return this.state.members.find((m) => m.userId === userId);
  }

  /**
   * Create team
   */
  createTeam(
    name: string,
    description: string,
    creatorId: string,
    creatorName: string,
    settings?: Partial<TeamSettings>,
  ): TeamOperationResult {
    const now = new Date().toISOString();

    this.state.team = {
      ...this.state.team,
      id: createId('team'),
      name,
      description,
      createdAt: now,
      updatedAt: now,
      createdBy: creatorId,
      settings: { ...DEFAULT_TEAM_SETTINGS, ...settings },
    };

    this.addMember(creatorId, creatorName, 'owner', creatorId);

    this.addAuditLog({
      teamId: this.state.team.id,
      userId: creatorId,
      userName: creatorName,
      action: 'team.created',
      details: { name, description },
    });

    this.emit('team.created', this.state.team);

    return { success: true, message: '团队创建成功', data: this.state.team };
  }

  /**
   * Update team info
   */
  updateTeam(
    updates: Partial<Pick<Team, 'name' | 'description' | 'avatar'>>,
    operatorId: string,
    operatorName: string,
  ): TeamOperationResult {
    const operator = this.getMember(operatorId);
    if (!operator || !hasTeamPermission(operator, 'canManageRoles')) {
      return { success: false, message: '无权更新团队信息', error: 'PERMISSION_DENIED' };
    }

    const now = new Date().toISOString();
    this.state.team = {
      ...this.state.team,
      ...updates,
      updatedAt: now,
    };

    this.addAuditLog({
      teamId: this.state.team.id,
      userId: operatorId,
      userName: operatorName,
      action: 'team.updated',
      details: updates,
    });

    this.emit('team.updated', this.state.team);

    return { success: true, message: '团队信息已更新', data: this.state.team };
  }

  /**
   * Update team settings
   */
  updateSettings(settings: Partial<TeamSettings>, operatorId: string, operatorName: string): TeamOperationResult {
    const operator = this.getMember(operatorId);
    if (!operator || !hasTeamPermission(operator, 'canManageRoles')) {
      return { success: false, message: '无权更新团队设置', error: 'PERMISSION_DENIED' };
    }

    this.state.team = {
      ...this.state.team,
      settings: { ...this.state.team.settings, ...settings },
      updatedAt: new Date().toISOString(),
    };

    this.addAuditLog({
      teamId: this.state.team.id,
      userId: operatorId,
      userName: operatorName,
      action: 'settings.updated',
      details: settings,
    });

    this.emit('settings.updated', this.state.team.settings);

    return { success: true, message: '团队设置已更新', data: this.state.team.settings };
  }

  /**
   * Add member (called by subclass methods)
   */
  addMember(
    userId: string,
    userName: string,
    role: TeamRole,
    invitedBy?: string,
    userEmail?: string,
  ): TeamOperationResult {
    const existingMember = this.getMember(userId);
    if (existingMember) {
      return { success: false, message: '成员已存在', error: 'MEMBER_EXISTS' };
    }

    const now = new Date().toISOString();
    const member: TeamMember = {
      userId,
      userName,
      userEmail,
      role,
      status: 'active',
      joinedAt: now,
      invitedBy,
      lastActiveAt: now,
      permissions: getTeamRolePermissions(role),
    };

    this.state.members.push(member);
    this.state.team.metadata.memberCount = this.state.members.length;
    this.state.team.updatedAt = now;

    this.addAuditLog({
      teamId: this.state.team.id,
      userId: invitedBy ?? userId,
      userName: userName,
      action: 'member.joined',
      targetId: userId,
      targetType: 'member',
      details: { role, invitedBy },
    });

    this.emit('member.added', member);

    return { success: true, message: '成员已添加', data: member };
  }

  /**
   * Add audit log entry
   */
  protected addAuditLog(entry: Omit<TeamAuditLog, 'id' | 'timestamp'>): void {
    if (!this.state.team.settings.enableAuditLog) return;

    const log: TeamAuditLog = {
      ...entry,
      id: createId('audit'),
      timestamp: new Date().toISOString(),
    };

    this.state.auditLog.push(log);

    if (this.state.auditLog.length > 1000) {
      this.state.auditLog = this.state.auditLog.slice(-500);
    }
  }

  /**
   * Emit event
   */
  protected emit(event: string, data: unknown): void {
    this.eventHandlers.get(event)?.forEach((handler) => handler(data));
  }
}
