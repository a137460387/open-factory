/**
 * Team management type definitions and constants
 */

// ==================== Types ====================

/** Team role */
export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';

/** Team member status */
export type TeamMemberStatus = 'active' | 'invited' | 'suspended' | 'left';

/** Project share permission */
export type ProjectSharePermission = 'view' | 'edit' | 'admin';

/** Team info */
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

/** Team settings */
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

/** Team metadata */
export interface TeamMetadata {
  memberCount: number;
  projectCount: number;
  lastActivityAt: string;
  storageUsed: number;
  storageLimit: number;
}

/** Team member */
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

/** Team member permissions */
export interface TeamMemberPermissions {
  canCreateProjects: boolean;
  canInviteMembers: boolean;
  canManageRoles: boolean;
  canDeleteProjects: boolean;
  canExportProjects: boolean;
  canViewAuditLog: boolean;
}

/** Team invitation */
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

/** Team project share */
export interface TeamProjectShare {
  id: string;
  teamId: string;
  projectId: string;
  projectName: string;
  sharedBy: string;
  sharedAt: string;
  permissions: ProjectSharePermission;
  allowedMembers?: string[];
  metadata: ProjectShareMetadata;
}

/** Project share metadata */
export interface ProjectShareMetadata {
  lastAccessedAt?: string;
  accessCount: number;
  downloadCount: number;
  commentCount: number;
}

/** Team audit log */
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

/** Team audit action */
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

/** Team state snapshot */
export interface TeamState {
  team: Team;
  members: TeamMember[];
  invitations: TeamInvitation[];
  sharedProjects: TeamProjectShare[];
  auditLog: TeamAuditLog[];
}

/** Team operation result */
export interface TeamOperationResult {
  success: boolean;
  message: string;
  data?: unknown;
  error?: string;
}

// ==================== Constants ====================

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

/** Team role list */
export const TEAM_ROLES: TeamRole[] = ['owner', 'admin', 'member', 'viewer'];

/** Default team settings */
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

// ==================== Permission helpers ====================

/**
 * Get role permissions
 */
export function getTeamRolePermissions(role: TeamRole): TeamMemberPermissions {
  return { ...TEAM_ROLE_PERMISSIONS[role] };
}

/**
 * Check if member has a specific permission
 */
export function hasTeamPermission(member: TeamMember, permission: keyof TeamMemberPermissions): boolean {
  return member.permissions[permission];
}

/**
 * Check if role has a specific permission
 */
export function roleHasPermission(role: TeamRole, permission: keyof TeamMemberPermissions): boolean {
  return TEAM_ROLE_PERMISSIONS[role][permission];
}

/**
 * Validate whether a role change is allowed
 */
export function canChangeRole(currentRole: TeamRole, targetRole: TeamRole, operatorRole: TeamRole): boolean {
  if (currentRole === 'owner') return false;
  if (operatorRole !== 'owner' && operatorRole !== 'admin') return false;
  if (operatorRole === 'admin' && targetRole === 'owner') return false;
  if (operatorRole === 'admin' && currentRole === 'admin') return false;
  return true;
}

/**
 * Validate whether a member invitation is allowed
 */
export function canInviteMember(
  inviterRole: TeamRole,
  inviteeRole: TeamRole,
  currentMemberCount: number,
  maxMembers: number,
): TeamOperationResult {
  if (!roleHasPermission(inviterRole, 'canInviteMembers')) {
    return { success: false, message: '无权邀请成员', error: 'PERMISSION_DENIED' };
  }
  if (currentMemberCount >= maxMembers) {
    return { success: false, message: '团队成员已达到上限', error: 'MAX_MEMBERS_REACHED' };
  }
  if (inviterRole === 'admin' && inviteeRole === 'owner') {
    return { success: false, message: '管理员不能邀请所有者', error: 'INVALID_ROLE' };
  }
  return { success: true, message: '允许邀请' };
}
