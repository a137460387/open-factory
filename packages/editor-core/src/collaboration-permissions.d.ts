export type CollaborationPermissionRole = 'owner' | 'editor' | 'commenter' | 'viewer';
export interface CollaborationRoleAssignment {
    userId: string;
    userName: string;
    role: CollaborationPermissionRole;
    assignedAt: string;
    assignedBy: string;
}
export interface CollaborationPermissionChangeLogEntry {
    id: string;
    userId: string;
    userName: string;
    previousRole: CollaborationPermissionRole | null;
    newRole: CollaborationPermissionRole;
    changedBy: string;
    changedByName: string;
    timestamp: string;
    action: 'assigned' | 'revoked' | 'changed';
}
export interface CollaborationPermissionConfig {
    ownerUserId: string;
    roles: CollaborationRoleAssignment[];
    changeLog: CollaborationPermissionChangeLogEntry[];
}
export type PermissionAction = 'edit-timeline' | 'delete-project' | 'add-comment' | 'add-annotation' | 'view-project' | 'manage-roles' | 'export-project' | 'modify-settings';
export declare const COLLABORATION_ROLES: CollaborationPermissionRole[];
export declare function getRolePermissions(role: CollaborationPermissionRole): Set<PermissionAction>;
export declare function hasPermission(role: CollaborationPermissionRole, action: PermissionAction): boolean;
export declare function getRoleForUser(config: CollaborationPermissionConfig, userId: string): CollaborationPermissionRole;
export declare function assignRole(config: CollaborationPermissionConfig, userId: string, userName: string, role: CollaborationPermissionRole, changedBy: string, changedByName: string, now?: string): CollaborationPermissionConfig;
export declare function removeUserRole(config: CollaborationPermissionConfig, userId: string, changedBy: string, changedByName: string, now?: string): CollaborationPermissionConfig;
export declare function isActionAllowedForUI(role: CollaborationPermissionRole, action: PermissionAction): boolean;
export declare function getDisabledActionsForRole(role: CollaborationPermissionRole): PermissionAction[];
export declare function buildPermissionSyncMessage(config: CollaborationPermissionConfig, targetUserId: string): {
    userId: string;
    role: CollaborationPermissionRole;
    permissions: PermissionAction[];
};
export declare function normalizeCollaborationPermissionConfig(input: Partial<CollaborationPermissionConfig> | undefined, ownerUserId: string): CollaborationPermissionConfig;
//# sourceMappingURL=collaboration-permissions.d.ts.map