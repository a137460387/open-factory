/**
 * TeamManagerB - member management, invitations, and member operations
 */

import { createId } from '../model';
import type {
  TeamMember,
  TeamRole,
  TeamMemberStatus,
  TeamInvitation,
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
 * Extended team manager with member and invitation management
 */
export class TeamManagerB extends TeamManagerBase {
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
   * Update member last active time
   */
  updateMemberActivity(userId: string): void {
    const member = this.getMember(userId);
    if (member) {
      member.lastActiveAt = new Date().toISOString();
      this.state.team.metadata.lastActivityAt = member.lastActiveAt;
    }
  }
}
