/**
 * TeamManager - extends TeamManagerB with project sharing, events, and factory functions
 */

import { createId } from '../model';
import type {
  TeamProjectShare,
  ProjectSharePermission,
  TeamAuditLog,
  TeamState,
  TeamOperationResult,
} from './types';
import { hasTeamPermission } from './types';
import { TeamManagerB } from './team-manager-members';

/**
 * Full team manager with project sharing, events, and snapshot support
 */
export class TeamManager extends TeamManagerB {
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
  getPendingInvitations() {
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
