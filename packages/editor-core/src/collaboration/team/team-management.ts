/**
 * 团队管理模块
 * 提供团队创建、成员管理、角色权限（RBAC）和项目共享功能
 * 遵循本地优先原则，所有数据存储在本地
 */

import { createId } from '../../model';

// ==================== 类型定义 ====================

/** 团队角色 */
export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';

/** 团队成员状态 */
export type TeamMemberStatus = 'active' | 'invited' | 'suspended' | 'left';

/** 项目共享权限 */
export type ProjectSharePermission = 'view' | 'edit' | 'admin';

/** 团队信息 */
export interface Team {
  id: string;
  name: string;
  description: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  settings: TeamSettings;
  metadata: TeamMetadata;
}

/** 团队设置 */
export interface TeamSettings {
  allowMemberInvite: boolean;
  allowProjectCreation: boolean;
  defaultProjectPermission: ProjectSharePermission;
  maxMembers: number;
  maxProjects: number;
  requireApprovalForJoin: boolean;
  enableAuditLog: boolean;
  syncEnabled: boolean;
}

/** 团队元数据 */
export interface TeamMetadata {
  memberCount: number;
  projectCount: number;
  lastActivityAt: string;
  storageUsed: number;
  storageLimit: number;
}

/** 团队成员 */
export interface TeamMember {
  userId: string;
  userName: string;
  userEmail?: string;
  avatar?: string;
  role: TeamRole;
  status: TeamMemberStatus;
  joinedAt: string;
  invitedBy?: string;
  lastActiveAt: string;
  permissions: TeamMemberPermissions;
}

/** 团队成员权限 */
export interface TeamMemberPermissions {
  canCreateProjects: boolean;
  canInviteMembers: boolean;
  canManageRoles: boolean;
  canDeleteProjects: boolean;
  canExportProjects: boolean;
  canViewAuditLog: boolean;
}

/** 团队邀请 */
export interface TeamInvitation {
  id: string;
  teamId: string;
  email: string;
  role: TeamRole;
  invitedBy: string;
  invitedByName: string;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  message?: string;
}

/** 团队项目共享 */
export interface TeamProjectShare {
  id: string;
  teamId: string;
  projectId: string;
  projectName: string;
  sharedBy: string;
  sharedAt: string;
  permissions: ProjectSharePermission;
  allowedMembers?: string[]; // 空数组表示所有成员
  metadata: ProjectShareMetadata;
}

/** 项目共享元数据 */
export interface ProjectShareMetadata {
  lastAccessedAt?: string;
  accessCount: number;
  downloadCount: number;
  commentCount: number;
}

/** 团队活动日志 */
export interface TeamAuditLog {
  id: string;
  teamId: string;
  userId: string;
  userName: string;
  action: TeamAuditAction;
  targetId?: string;
  targetType?: 'member' | 'project' | 'settings' | 'invitation';
  details: Record<string, unknown>;
  timestamp: string;
  ipAddress?: string;
}

/** 团队审计动作 */
export type TeamAuditAction =
  | 'team.created'
  | 'team.updated'
  | 'member.invited'
  | 'member.joined'
  | 'member.left'
  | 'member.removed'
  | 'member.role_changed'
  | 'member.status_changed'
  | 'project.shared'
  | 'project.unshared'
  | 'project.permission_changed'
  | 'settings.updated'
  | 'invitation.sent'
  | 'invitation.accepted'
  | 'invitation.declined';

/** 团队状态快照 */
export interface TeamState {
  team: Team;
  members: TeamMember[];
  invitations: TeamInvitation[];
  sharedProjects: TeamProjectShare[];
  auditLog: TeamAuditLog[];
}

/** 团队操作结果 */
export interface TeamOperationResult {
  success: boolean;
  message: string;
  data?: unknown;
  error?: string;
}

// ==================== 角色权限矩阵 ====================

const TEAM_ROLE_PERMISSIONS: Record<TeamRole, TeamMemberPermissions> = {
  owner: {
    canCreateProjects: true,
    canInviteMembers: true,
    canManageRoles: true,
    canDeleteProjects: true,
    canExportProjects: true,
    canViewAuditLog: true,
  },
  admin: {
    canCreateProjects: true,
    canInviteMembers: true,
    canManageRoles: true,
    canDeleteProjects: true,
    canExportProjects: true,
    canViewAuditLog: true,
  },
  member: {
    canCreateProjects: true,
    canInviteMembers: false,
    canManageRoles: false,
    canDeleteProjects: false,
    canExportProjects: true,
    canViewAuditLog: false,
  },
  viewer: {
    canCreateProjects: false,
    canInviteMembers: false,
    canManageRoles: false,
    canDeleteProjects: false,
    canExportProjects: false,
    canViewAuditLog: false,
  },
};

/** 团队角色列表 */
export const TEAM_ROLES: TeamRole[] = ['owner', 'admin', 'member', 'viewer'];

/** 默认团队设置 */
export const DEFAULT_TEAM_SETTINGS: TeamSettings = {
  allowMemberInvite: true,
  allowProjectCreation: true,
  defaultProjectPermission: 'view',
  maxMembers: 50,
  maxProjects: 100,
  requireApprovalForJoin: false,
  enableAuditLog: true,
  syncEnabled: true,
};

// ==================== 工具函数 ====================

/**
 * 获取角色权限
 */
export function getTeamRolePermissions(role: TeamRole): TeamMemberPermissions {
  return { ...TEAM_ROLE_PERMISSIONS[role] };
}

/**
 * 检查成员是否有特定权限
 */
export function hasTeamPermission(member: TeamMember, permission: keyof TeamMemberPermissions): boolean {
  return member.permissions[permission];
}

/**
 * 检查角色是否有特定权限
 */
export function roleHasPermission(role: TeamRole, permission: keyof TeamMemberPermissions): boolean {
  return TEAM_ROLE_PERMISSIONS[role][permission];
}

/**
 * 验证角色变更是否允许
 */
export function canChangeRole(currentRole: TeamRole, targetRole: TeamRole, operatorRole: TeamRole): boolean {
  // 所有者不能被降级
  if (currentRole === 'owner') return false;

  // 只有所有者和管理员可以更改角色
  if (operatorRole !== 'owner' && operatorRole !== 'admin') return false;

  // 管理员不能将成员提升为所有者
  if (operatorRole === 'admin' && targetRole === 'owner') return false;

  // 管理员不能更改其他管理员的角色
  if (operatorRole === 'admin' && currentRole === 'admin') return false;

  return true;
}

/**
 * 验证成员邀请是否允许
 */
export function canInviteMember(
  inviterRole: TeamRole,
  inviteeRole: TeamRole,
  currentMemberCount: number,
  maxMembers: number,
): TeamOperationResult {
  // 检查邀请权限
  if (!roleHasPermission(inviterRole, 'canInviteMembers')) {
    return { success: false, message: '无权邀请成员', error: 'PERMISSION_DENIED' };
  }

  // 检查成员数量限制
  if (currentMemberCount >= maxMembers) {
    return { success: false, message: '团队成员已达到上限', error: 'MAX_MEMBERS_REACHED' };
  }

  // 管理员不能邀请所有者
  if (inviterRole === 'admin' && inviteeRole === 'owner') {
    return { success: false, message: '管理员不能邀请所有者', error: 'INVALID_ROLE' };
  }

  return { success: true, message: '允许邀请' };
}

// ==================== 团队管理器 ====================

/**
 * 团队管理器
 * 提供团队的完整生命周期管理
 */
export class TeamManager {
  private state: TeamState;
  private eventHandlers: Map<string, Set<(data: unknown) => void>> = new Map();

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
   * 创建默认团队
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
        storageLimit: 1024 * 1024 * 1024, // 1GB
      },
    };
  }

  /**
   * 获取团队状态
   */
  getState(): TeamState {
    return { ...this.state };
  }

  /**
   * 获取团队信息
   */
  getTeam(): Team {
    return { ...this.state.team };
  }

  /**
   * 获取团队成员列表
   */
  getMembers(): TeamMember[] {
    return [...this.state.members];
  }

  /**
   * 获取特定成员
   */
  getMember(userId: string): TeamMember | undefined {
    return this.state.members.find((m) => m.userId === userId);
  }

  /**
   * 创建团队
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

    // 添加创建者为所有者
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
   * 更新团队信息
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
   * 更新团队设置
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
   * 添加成员
   */
  addMember(
    userId: string,
    userName: string,
    role: TeamRole,
    invitedBy?: string,
    userEmail?: string,
  ): TeamOperationResult {
    // 检查成员是否已存在
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
   * 移除成员
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

    // 不能移除所有者
    if (targetMember.role === 'owner') {
      return { success: false, message: '不能移除团队所有者', error: 'CANNOT_REMOVE_OWNER' };
    }

    // 管理员不能移除其他管理员
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
   * 更新成员角色
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

    // 验证角色变更是否允许
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
   * 更新成员状态
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

    // 不能更改所有者状态
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
   * 发送邀请
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

    // 验证邀请权限
    const inviteCheck = canInviteMember(
      inviter.role,
      role,
      this.state.members.length,
      this.state.team.settings.maxMembers,
    );
    if (!inviteCheck.success) {
      return inviteCheck;
    }

    // 检查是否已有待处理的邀请
    const existingInvitation = this.state.invitations.find((inv) => inv.email === email && inv.status === 'pending');
    if (existingInvitation) {
      return { success: false, message: '该邮箱已有待处理的邀请', error: 'INVITATION_EXISTS' };
    }

    const now = new Date().toISOString();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7天有效期

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
   * 接受邀请
   */
  acceptInvitation(invitationId: string, userId: string, userName: string): TeamOperationResult {
    const invitation = this.state.invitations.find((inv) => inv.id === invitationId);
    if (!invitation) {
      return { success: false, message: '邀请不存在', error: 'INVITATION_NOT_FOUND' };
    }

    if (invitation.status !== 'pending') {
      return { success: false, message: '邀请已处理', error: 'INVITATION_ALREADY_PROCESSED' };
    }

    // 检查是否过期
    if (new Date(invitation.expiresAt) < new Date()) {
      invitation.status = 'expired';
      return { success: false, message: '邀请已过期', error: 'INVITATION_EXPIRED' };
    }

    // 添加成员
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
   * 拒绝邀请
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
   * 共享项目
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

    // 检查是否已共享
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
   * 取消项目共享
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

    // 检查权限：只有共享者或管理员可以取消共享
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
   * 更新项目共享权限
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
   * 获取待处理的邀请
   */
  getPendingInvitations(): TeamInvitation[] {
    return this.state.invitations.filter((inv) => inv.status === 'pending');
  }

  /**
   * 获取团队共享的项目
   */
  getSharedProjects(): TeamProjectShare[] {
    return [...this.state.sharedProjects];
  }

  /**
   * 获取审计日志
   */
  getAuditLog(limit?: number): TeamAuditLog[] {
    const logs = [...this.state.auditLog].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    return limit ? logs.slice(0, limit) : logs;
  }

  /**
   * 检查成员是否可以访问共享项目
   */
  canAccessProject(userId: string, projectId: string): boolean {
    const member = this.getMember(userId);
    if (!member || member.status !== 'active') return false;

    const share = this.state.sharedProjects.find((s) => s.projectId === projectId && s.teamId === this.state.team.id);
    if (!share) return false;

    // 检查成员是否在允许列表中
    if (share.allowedMembers && share.allowedMembers.length > 0) {
      return share.allowedMembers.includes(userId);
    }

    return true;
  }

  /**
   * 获取项目权限
   */
  getProjectPermission(userId: string, projectId: string): ProjectSharePermission | null {
    const member = this.getMember(userId);
    if (!member || member.status !== 'active') return null;

    const share = this.state.sharedProjects.find((s) => s.projectId === projectId && s.teamId === this.state.team.id);
    if (!share) return null;

    // 检查成员是否在允许列表中
    if (share.allowedMembers && share.allowedMembers.length > 0) {
      if (!share.allowedMembers.includes(userId)) return null;
    }

    // 根据成员角色和项目权限返回最终权限
    if (member.role === 'owner' || member.role === 'admin') {
      return 'admin';
    }

    return share.permissions;
  }

  /**
   * 记录审计日志
   */
  private addAuditLog(entry: Omit<TeamAuditLog, 'id' | 'timestamp'>): void {
    if (!this.state.team.settings.enableAuditLog) return;

    const log: TeamAuditLog = {
      ...entry,
      id: createId('audit'),
      timestamp: new Date().toISOString(),
    };

    this.state.auditLog.push(log);

    // 限制审计日志数量
    if (this.state.auditLog.length > 1000) {
      this.state.auditLog = this.state.auditLog.slice(-500);
    }
  }

  /**
   * 更新成员最后活跃时间
   */
  updateMemberActivity(userId: string): void {
    const member = this.getMember(userId);
    if (member) {
      member.lastActiveAt = new Date().toISOString();
      this.state.team.metadata.lastActivityAt = member.lastActiveAt;
    }
  }

  /**
   * 导出团队状态快照
   */
  exportSnapshot(): string {
    return JSON.stringify(this.state, null, 2);
  }

  /**
   * 导入团队状态快照
   */
  importSnapshot(snapshot: string): TeamOperationResult {
    try {
      const parsed = JSON.parse(snapshot) as TeamState;

      // 验证基本结构
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
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建团队管理器
 */
export function createTeamManager(initialState?: Partial<TeamState>): TeamManager {
  return new TeamManager(initialState);
}

/**
 * 从快照恢复团队管理器
 */
export function restoreTeamManager(snapshot: string): TeamManager | null {
  try {
    const state = JSON.parse(snapshot) as TeamState;
    return new TeamManager(state);
  } catch {
    return null;
  }
}

// ==================== 序列化函数 ====================

/**
 * 序列化团队状态
 */
export function serializeTeamState(state: TeamState): string {
  return JSON.stringify(state);
}

/**
 * 解析团队状态
 */
export function parseTeamState(json: string): TeamState | null {
  try {
    return JSON.parse(json) as TeamState;
  } catch {
    return null;
  }
}
