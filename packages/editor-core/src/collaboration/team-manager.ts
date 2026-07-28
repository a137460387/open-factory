/**
 * TeamManager - extends TeamManagerBase with member, invitation, project, and event management
 */

import { createId } from '../model';
import type {
  Team,
  TeamMember,
  TeamRole,
  TeamMemberStatus,
  TeamInvitation,
  TeamProjectShare,
  ProjectSharePermission,
  TeamAuditLog,
  TeamState,
  TeamOperationResult,
} from './types';
import {
  getTeamRolePermissions,
  hasTeamPermission,
  canChangeRole,
  canInviteMember,
} from './types';
import { TeamManagerBase } from './team-manager-base';

/**
 * Full team manager with member management, invitations, project sharing, and events
 */
export class TeamManager extends TeamManagerBase {
  /**
   * Remove member
   */
  removeMember(userId: string, operatorId: string, operatorName: string): TeamOperationResult {
    const operator = this.getMember(operatorId);
    if (!operator || !hasTeamPermission(operator, 'canManageRoles')) {
      return { success: false, message: '无权移除成员', error: 'PERMISSION_DENIED' };
    }

    const targetMember = this.getMember(userId);
    if (!targetMember) {
      return { success: false, message: '成员不存在', error: 'MEMBER_NOT_FOUND' };
    }

    if (targetMember.role === 'owner') {
      return { success: false, message: '不能移除团队所有者', error: 'CANNOT_REMOVE_OWNER' };
    }

    if (operator.role === 'admin' && targetMember.role === 'admin') {
      return { success: false, message: '管理员不能移除其他管理员', error: 'PERMISSION_DENIED' };
    }

    this.state.members = this.state.members.filter((m) => m.userId !== userId);
    this.state.team.metadata.memberCount = this.state.members.length;
    this.state.team.updatedAt = new Date().toISOString();

    this.addAuditLog({
      teamId: this.state.team.id,
      userId: operatorId,
      userName: operatorName,
      action: 'member.removed',
      targetId: userId,
      targetType: 'member',
      details: { removedRole: targetMember.role },
    });

    this.emit('member.removed', { userId, member: targetMember });

    return { success: true, message: '成员已移除' };
  }

  /**
   * Update member role
   */
  updateMemberRole(userId: string, newRole: TeamRole, operatorId: string, operatorName: string): TeamOperationResult {
    const operator = this.getMember(operatorId);
    if (!operator) {
      return { success: false, message: '操作者不存在', error: 'OPERATOR_NOT_FOUND' };
    }

    const targetMember = this.getMember(userId);
    if (!targetMember) {
      return { success: false, message: '成员不存在', error: 'MEMBER_NOT_FOUND' };
    }

    if (!canChangeRole(targetMember.role, newRole, operator.role)) {
      return { success: false, message: '不允许的角色变更', error: 'INVALID_ROLE_CHANGE' };
    }

    const previousRole = targetMember.role;
    targetMember.role = newRole;
    targetMember.permissions = getTeamRolePermissions(newRole);

    this.state.team.updatedAt = new Date().toISOString();

    this.addAuditLog({
      teamId: this.state.team.id,
      userId: operatorId,
      userName: operatorName,
      action: 'member.role_changed',
      targetId: userId,
      targetType: 'member',
      details: { previousRole, newRole },
    });

    this.emit('member.role_changed', { userId, previousRole, newRole });

    return { success: true, message: '成员角色已更新', data: targetMember };
  }

  /**
   * Update member status
   */
  updateMemberStatus(
    userId: string,
    status: TeamMemberStatus,
    operatorId: string,
    operatorName: string,
  ): TeamOperationResult {
    const operator = this.getMember(operatorId);
    if (!operator || !hasTeamPermission(operator, 'canManageRoles')) {
      return { success: false, message: '无权更新成员状态', error: 'PERMISSION_DENIED' };
    }

    const targetMember = this.getMember(userId);
    if (!targetMember) {
      return { success: false, message: '成员不存在', error: 'MEMBER_NOT_FOUND' };
    }

    if (targetMember.role === 'owner') {
      return { success: false, message: '不能更改所有者状态', error: 'CANNOT_CHANGE_OWNER_STATUS' };
    }

    const previousStatus = targetMember.status;
    targetMember.status = status;
    this.state.team.updatedAt = new Date().toISOString();

    this.addAuditLog({
      teamId: this.state.team.id,
      userId: operatorId,
      userName: operatorName,
      action: 'member.status_changed',
      targetId: userId,
      targetType: 'member',
      details: { previousStatus, newStatus: status },
    });

    this.emit('member.status_changed', { userId, previousStatus, newStatus: status });

    return { success: true, message: '成员状态已更新', data: targetMember };
  }

  /**
   * Send invitation
   */
  sendInvitation(
    email: string,
    role: TeamRole,
    inviterId: string,
    inviterName: string,
    message?: string,
  ): TeamOperationResult {
    const inviter = this.getMember(inviterId);
    if (!inviter) {
      return { success: false, message: '邀请者不存在', error: 'INVITER_NOT_FOUND' };
    }

    const inviteCheck = canInviteMember(
      inviter.role,
      role,
      this.state.members.length,
      this.state.team.settings.maxMembers,
    );
    if (!inviteCheck.success) {
      return inviteCheck;
    }

    const existingInvitation = this.state.invitations.find((inv) => inv.email === email && inv.status === 'pending');
    if (existingInvitation) {
      return { success: false, message: '该邮箱已有待处理的邀请', error: 'INVITATION_EXISTS' };
    }

    const now = new Date().toISOString();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation: TeamInvitation = {
      id: createId('inv'),
      teamId: this.state.team.id,
      email,
      role,
      invitedBy: inviterId,
      invitedByName: inviterName,
      createdAt: now,
      expiresAt: expiresAt.toISOString(),
      status: 'pending',
      message,
    };

    this.state.invitations.push(invitation);

    this.addAuditLog({
      teamId: this.state.team.id,
      userId: inviterId,
      userName: inviterName,
      action: 'invitation.sent',
      targetId: invitation.id,
      targetType: 'invitation',
      details: { email, role },
    });

    this.emit('invitation.sent', invitation);

    return { success: true, message: '邀请已发送', data: invitation };
  }

  /**
   * Accept invitation
   */
  acceptInvitation(invitationId: string, userId: string, userName: string): TeamOperationResult {
    const invitation = this.state.invitations.find((inv) => inv.id === invitationId);
    if (!invitation) {
      return { success: false, message: '邀请不存在', error: 'INVITATION_NOT_FOUND' };
    }

    if (invitation.status !== 'pending') {
      return { success: false, message: '邀请已处理', error: 'INVITATION_ALREADY_PROCESSED' };
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      invitation.status = 'expired';
      return { success: false, message: '邀请已过期', error: 'INVITATION_EXPIRED' };
    }

    const addResult = this.addMember(userId, userName, invitation.role, invitation.invitedBy);
    if (!addResult.success) {
      return addResult;
    }

    invitation.status = 'accepted';

    this.addAuditLog({
      teamId: this.state.team.id,
      userId,
      userName,
      action: 'invitation.accepted',
      targetId: invitationId,
      targetType: 'invitation',
      details: { role: invitation.role },
    });

    this.emit('invitation.accepted', { invitation, member: addResult.data });

    return { success: true, message: '邀请已接受', data: addResult.data };
  }

  /**
   * Decline invitation
   */
  declineInvitation(invitationId: string, userId: string, userName: string): TeamOperationResult {
    const invitation = this.state.invitations.find((inv) => inv.id === invitationId);
    if (!invitation) {
      return { success: false, message: '邀请不存在', error: 'INVITATION_NOT_FOUND' };
    }

    if (invitation.status !== 'pending') {
      return { success: false, message: '邀请已处理', error: 'INVITATION_ALREADY_PROCESSED' };
    }

    invitation.status = 'declined';

    this.addAuditLog({
      teamId: this.state.team.id,
      userId,
      userName,
      action: 'invitation.declined',
      targetId: invitationId,
      targetType: 'invitation',
      details: { role: invitation.role },
    });

    this.emit('invitation.declined', invitation);

    return { success: true, message: '邀请已拒绝' };
  }

  /**
   * Share project
   */
  shareProject(
    projectId: string,
    projectName: string,
    permissions: ProjectSharePermission,
    sharerId: string,
    sharerName: string,
    allowedMembers?: string[],
  ): TeamOperationResult {
    const sharer = this.getMember(sharerId);
    if (!sharer || !hasTeamPermission(sharer, 'canCreateProjects')) {
      return { success: false, message: '无权共享项目', error: 'PERMISSION_DENIED' };
    }

    const existingShare = this.state.sharedProjects.find(
      (share) => share.projectId === projectId && share.teamId === this.state.team.id,
    );
    if (existingShare) {
      return { success: false, message: '项目已共享', error: 'PROJECT_ALREADY_SHARED' };
    }

    const now = new Date().toISOString();
    const share: TeamProjectShare = {
      id: createId('share'),
      teamId: this.state.team.id,
      projectId,
      projectName,
      sharedBy: sharerId,
      sharedAt: now,
      permissions,
      allowedMembers,
      metadata: {
        accessCount: 0,
        downloadCount: 0,
        commentCount: 0,
      },
    };

    this.state.sharedProjects.push(share);
    this.state.team.metadata.projectCount = this.state.sharedProjects.length;

    this.addAuditLog({
      teamId: this.state.team.id,
      userId: sharerId,
      userName: sharerName,
      action: 'project.shared',
      targetId: projectId,
      targetType: 'project',
      details: { projectName, permissions, allowedMembers },
    });

    this.emit('project.shared', share);

    return { success: true, message: '项目已共享', data: share };
  }

  /**
   * Unshare project
   */
  unshareProject(projectId: string, operatorId: string, operatorName: string): TeamOperationResult {
    const operator = this.getMember(operatorId);
    if (!operator) {
      return { success: false, message: '操作者不存在', error: 'OPERATOR_NOT_FOUND' };
    }

    const shareIndex = this.state.sharedProjects.findIndex(
      (share) => share.projectId === projectId && share.teamId === this.state.team.id,
    );
    if (shareIndex === -1) {
      return { success: false, message: '项目未共享', error: 'PROJECT_NOT_SHARED' };
    }

    const share = this.state.sharedProjects[shareIndex];

    if (share.sharedBy !== operatorId && !hasTeamPermission(operator, 'canManageRoles')) {
      return { success: false, message: '无权取消共享', error: 'PERMISSION_DENIED' };
    }

    this.state.sharedProjects.splice(shareIndex, 1);
    this.state.team.metadata.projectCount = this.state.sharedProjects.length;

    this.addAuditLog({
      teamId: this.state.team.id,
      userId: operatorId,
      userName: operatorName,
      action: 'project.unshared',
      targetId: projectId,
      targetType: 'project',
      details: { projectName: share.projectName },
    });

    this.emit('project.unshared', { projectId, share });

    return { success: true, message: '项目共享已取消' };
  }

  /**
   * Update project share permission
   */
  updateProjectPermission(
    projectId: string,
    permissions: ProjectSharePermission,
    operatorId: string,
    operatorName: string,
  ): TeamOperationResult {
    const operator = this.getMember(operatorId);
    if (!operator || !hasTeamPermission(operator, 'canManageRoles')) {
      return { success: false, message: '无权更新项目权限', error: 'PERMISSION_DENIED' };
    }

    const share = this.state.sharedProjects.find((s) => s.projectId === projectId && s.teamId === this.state.team.id);
    if (!share) {
      return { success: false, message: '项目未共享', error: 'PROJECT_NOT_SHARED' };
    }

    const previousPermissions = share.permissions;
    share.permissions = permissions;

    this.addAuditLog({
      teamId: this.state.team.id,
      userId: operatorId,
      userName: operatorName,
      action: 'project.permission_changed',
      targetId: projectId,
      targetType: 'project',
      details: { previousPermissions, newPermissions: permissions },
    });

    this.emit('project.permission_changed', { projectId, previousPermissions, newPermissions: permissions });

    return { success: true, message: '项目权限已更新', data: share };
  }

  /**
   * Get pending invitations
   */
  getPendingInvitations(): TeamInvitation[] {
    return this.state.invitations.filter((inv) => inv.status === 'pending');
  }

  /**
   * Get shared projects
   */
  getSharedProjects(): TeamProjectShare[] {
    return [...this.state.sharedProjects];
  }

  /**
   * Get audit log
   */
  getAuditLog(limit?: number): TeamAuditLog[] {
    const logs = [...this.state.auditLog].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    return limit ? logs.slice(0, limit) : logs;
  }

  /**
   * Check if member can access shared project
   */
  canAccessProject(userId: string, projectId: string): boolean {
    const member = this.getMember(userId);
    if (!member || member.status !== 'active') return false;

    const share = this.state.sharedProjects.find((s) => s.projectId === projectId && s.teamId === this.state.team.id);
    if (!share) return false;

    if (share.allowedMembers && share.allowedMembers.length > 0) {
      return share.allowedMembers.includes(userId);
    }

    return true;
  }

  /**
   * Get project permission for user
   */
  getProjectPermission(userId: string, projectId: string): ProjectSharePermission | null {
    const member = this.getMember(userId);
    if (!member || member.status !== 'active') return null;

    const share = this.state.sharedProjects.find((s) => s.projectId === projectId && s.teamId === this.state.team.id);
    if (!share) return null;

    if (share.allowedMembers && share.allowedMembers.length > 0) {
      if (!share.allowedMembers.includes(userId)) return null;
    }

    if (member.role === 'owner' || member.role === 'admin') {
      return 'admin';
    }

    return share.permissions;
  }

  /**
   * Update member last active time
   */
  updateMemberActivity(userId: string): void {
    const member = this.getMember(userId);
    if (member) {
      member.lastActiveAt = new Date().toISOString();
      this.state.team.metadata.lastActivityAt = member.lastActiveAt;
    }
  }

  /**
   * Export team state snapshot
   */
  exportSnapshot(): string {
    return JSON.stringify(this.state, null, 2);
  }

  /**
   * Import team state snapshot
   */
  importSnapshot(snapshot: string): TeamOperationResult {
    try {
      const parsed = JSON.parse(snapshot) as TeamState;

      if (!parsed.team || !Array.isArray(parsed.members)) {
        return { success: false, message: '无效的快照格式', error: 'INVALID_SNAPSHOT' };
      }

      this.state = parsed;
      this.emit('snapshot.imported', this.state);

      return { success: true, message: '快照导入成功' };
    } catch {
      return { success: false, message: '快照解析失败', error: 'PARSE_ERROR' };
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
   * Dispose resources
   */
  dispose(): void {
    this.eventHandlers.clear();
  }
}

// ==================== Factory functions ====================

/**
 * Create team manager
 */
export function createTeamManager(initialState?: Partial<TeamState>): TeamManager {
  return new TeamManager(initialState);
}

/**
 * Restore team manager from snapshot
 */
export function restoreTeamManager(snapshot: string): TeamManager | null {
  try {
    const state = JSON.parse(snapshot) as TeamState;
    return new TeamManager(state);
  } catch {
    return null;
  }
}

// ==================== Serialization functions ====================

/**
 * Serialize team state
 */
export function serializeTeamState(state: TeamState): string {
  return JSON.stringify(state);
}

/**
 * Parse team state
 */
export function parseTeamState(json: string): TeamState | null {
  try {
    return JSON.parse(json) as TeamState;
  } catch {
    return null;
  }
}
