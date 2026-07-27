import { createId } from './model';
const ROLE_PERMISSIONS = {
    owner: new Set([
        'edit-timeline',
        'delete-project',
        'add-comment',
        'add-annotation',
        'view-project',
        'manage-roles',
        'export-project',
        'modify-settings',
    ]),
    editor: new Set(['edit-timeline', 'add-comment', 'add-annotation', 'view-project', 'export-project']),
    commenter: new Set(['add-comment', 'add-annotation', 'view-project']),
    viewer: new Set(['view-project']),
};
export const COLLABORATION_ROLES = ['owner', 'editor', 'commenter', 'viewer'];
export function getRolePermissions(role) {
    return new Set(ROLE_PERMISSIONS[role] ?? []);
}
export function hasPermission(role, action) {
    return ROLE_PERMISSIONS[role]?.has(action) ?? false;
}
export function getRoleForUser(config, userId) {
    if (config.ownerUserId === userId)
        return 'owner';
    const assignment = config.roles.find((r) => r.userId === userId);
    return assignment?.role ?? 'viewer';
}
export function assignRole(config, userId, userName, role, changedBy, changedByName, now) {
    const timestamp = now ?? new Date().toISOString();
    const previousRole = getRoleForUser(config, userId);
    if (previousRole === role)
        return config;
    const assignment = {
        userId,
        userName,
        role,
        assignedAt: timestamp,
        assignedBy: changedBy,
    };
    const logEntry = {
        id: createId('perm-log'),
        userId,
        userName,
        previousRole: previousRole === 'viewer' && !config.roles.find((r) => r.userId === userId) ? null : previousRole,
        newRole: role,
        changedBy,
        changedByName,
        timestamp,
        action: config.roles.find((r) => r.userId === userId) ? 'changed' : 'assigned',
    };
    return {
        ...config,
        roles: [...config.roles.filter((r) => r.userId !== userId), ...(role === 'viewer' ? [] : [assignment])],
        changeLog: [...config.changeLog, logEntry],
    };
}
export function removeUserRole(config, userId, changedBy, changedByName, now) {
    const timestamp = now ?? new Date().toISOString();
    const previousRole = getRoleForUser(config, userId);
    if (config.ownerUserId === userId)
        return config;
    const logEntry = {
        id: createId('perm-log'),
        userId,
        userName: config.roles.find((r) => r.userId === userId)?.userName ?? userId,
        previousRole,
        newRole: 'viewer',
        changedBy,
        changedByName,
        timestamp,
        action: 'revoked',
    };
    return {
        ...config,
        roles: config.roles.filter((r) => r.userId !== userId),
        changeLog: [...config.changeLog, logEntry],
    };
}
export function isActionAllowedForUI(role, action) {
    return hasPermission(role, action);
}
export function getDisabledActionsForRole(role) {
    const allActions = [
        'edit-timeline',
        'delete-project',
        'add-comment',
        'add-annotation',
        'view-project',
        'manage-roles',
        'export-project',
        'modify-settings',
    ];
    return allActions.filter((action) => !hasPermission(role, action));
}
export function buildPermissionSyncMessage(config, targetUserId) {
    const role = getRoleForUser(config, targetUserId);
    return {
        userId: targetUserId,
        role,
        permissions: Array.from(getRolePermissions(role)),
    };
}
export function normalizeCollaborationPermissionConfig(input, ownerUserId) {
    return {
        ownerUserId,
        roles: Array.isArray(input?.roles)
            ? input.roles
                .filter((r) => r && typeof r.userId === 'string' && COLLABORATION_ROLES.includes(r.role))
                .filter((r) => r.userId !== ownerUserId)
                .map((r) => ({
                userId: r.userId,
                userName: typeof r.userName === 'string' ? r.userName : r.userId,
                role: r.role,
                assignedAt: typeof r.assignedAt === 'string' ? r.assignedAt : new Date().toISOString(),
                assignedBy: typeof r.assignedBy === 'string' ? r.assignedBy : ownerUserId,
            }))
            : [],
        changeLog: Array.isArray(input?.changeLog)
            ? input.changeLog
                .filter((e) => e && typeof e.id === 'string' && typeof e.userId === 'string')
                .map((e) => ({
                id: e.id,
                userId: e.userId,
                userName: typeof e.userName === 'string' ? e.userName : e.userId,
                previousRole: COLLABORATION_ROLES.includes(e.previousRole)
                    ? e.previousRole
                    : null,
                newRole: COLLABORATION_ROLES.includes(e.newRole)
                    ? e.newRole
                    : 'viewer',
                changedBy: typeof e.changedBy === 'string' ? e.changedBy : ownerUserId,
                changedByName: typeof e.changedByName === 'string' ? e.changedByName : (e.changedBy ?? ownerUserId),
                timestamp: typeof e.timestamp === 'string' ? e.timestamp : new Date().toISOString(),
                action: e.action === 'assigned' || e.action === 'revoked' || e.action === 'changed' ? e.action : 'assigned',
            }))
            : [],
    };
}
//# sourceMappingURL=collaboration-permissions.js.map