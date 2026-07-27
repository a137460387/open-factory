export const COLLABORATION_USER_COLORS = [
    '#38bdf8',
    '#f59e0b',
    '#a78bfa',
    '#10b981',
    '#f43f5e',
    '#22c55e',
    '#6366f1',
    '#14b8a6',
];
export function rebaseCollaborationOperations(operations) {
    const latestByClipId = new Map();
    return [...operations]
        .sort((left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id))
        .map((operation) => {
        if (!operation.clipId || operation.kind !== 'timeline-command') {
            return { ...operation };
        }
        const previous = latestByClipId.get(operation.clipId);
        const rebased = previous
            ? {
                ...operation,
                rebaseAfterOperationId: previous.id,
                rebased: true,
            }
            : { ...operation, rebased: false };
        latestByClipId.set(operation.clipId, rebased);
        return rebased;
    });
}
export function canApplyCollaborationOperation(permission, operation) {
    if (permission === 'edit') {
        return true;
    }
    return operation.kind === 'comment' || operation.kind === 'playhead';
}
export function applyCollaborationReconnectState(clientProject, hostProject) {
    return {
        project: hostProject,
        overwritten: clientProject.id !== hostProject.id || clientProject.updatedAt !== hostProject.updatedAt,
        hostUpdatedAt: hostProject.updatedAt,
    };
}
export function assignCollaborationUserColors(users) {
    return users.map((user, index) => ({
        ...user,
        color: normalizeCollaborationColor(user.color) ?? COLLABORATION_USER_COLORS[index % COLLABORATION_USER_COLORS.length],
    }));
}
export function buildCollaborationClipLocks(operations, users, ttlMs, nowMs) {
    const userById = new Map(users.map((user) => [user.userId, user]));
    const locksByClipId = new Map();
    for (const operation of operations) {
        if (!operation.clipId || operation.kind !== 'timeline-command' || nowMs - operation.timestamp > ttlMs) {
            continue;
        }
        const user = userById.get(operation.userId);
        locksByClipId.set(operation.clipId, {
            clipId: operation.clipId,
            userId: operation.userId,
            userName: user?.name ?? operation.userId,
            updatedAt: operation.timestamp,
        });
    }
    return Array.from(locksByClipId.values()).sort((left, right) => left.clipId.localeCompare(right.clipId));
}
export function serializeCollaborationOperation(operation) {
    return JSON.stringify(operation);
}
export function parseCollaborationOperation(value) {
    try {
        const parsed = JSON.parse(value);
        if (!parsed.id || !parsed.userId || !parsed.commandName || !parsed.kind || typeof parsed.timestamp !== 'number') {
            return undefined;
        }
        const operation = {
            id: parsed.id,
            userId: parsed.userId,
            commandName: parsed.commandName,
            params: parsed.params && typeof parsed.params === 'object' ? parsed.params : {},
            timestamp: parsed.timestamp,
            kind: parsed.kind,
        };
        if (typeof parsed.clipId === 'string') {
            operation.clipId = parsed.clipId;
        }
        if (typeof parsed.rebaseAfterOperationId === 'string') {
            operation.rebaseAfterOperationId = parsed.rebaseAfterOperationId;
        }
        if (typeof parsed.rebased === 'boolean') {
            operation.rebased = parsed.rebased;
        }
        return operation;
    }
    catch {
        return undefined;
    }
}
function normalizeCollaborationColor(color) {
    const match = /^#?([0-9a-fA-F]{6})$/.exec(color?.trim() ?? '');
    return match ? `#${match[1].toLowerCase()}` : undefined;
}
//# sourceMappingURL=collaboration.js.map