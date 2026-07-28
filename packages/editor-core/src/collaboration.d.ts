import type { Project } from './model';
export type CollaborationRole = 'host' | 'client';
export type CollaborationPermission = 'read-only' | 'edit';
export type CollaborationOperationKind = 'timeline-command' | 'comment' | 'playhead' | 'project-sync';
export interface CollaborationOperation {
    id: string;
    userId: string;
    commandName: string;
    params: Record<string, unknown>;
    timestamp: number;
    kind: CollaborationOperationKind;
    clipId?: string;
    rebaseAfterOperationId?: string;
    rebased?: boolean;
}
export interface CollaborationUserPresence {
    userId: string;
    name: string;
    playheadTime: number;
    color?: string;
}
export interface CollaborationClipLock {
    clipId: string;
    userId: string;
    userName: string;
    updatedAt: number;
}
export interface CollaborationReconnectResult {
    project: Project;
    overwritten: boolean;
    hostUpdatedAt?: string;
}
export declare const COLLABORATION_USER_COLORS: string[];
export declare function rebaseCollaborationOperations(operations: CollaborationOperation[]): CollaborationOperation[];
export declare function canApplyCollaborationOperation(permission: CollaborationPermission, operation: Pick<CollaborationOperation, 'kind'>): boolean;
export declare function applyCollaborationReconnectState(clientProject: Project, hostProject: Project): CollaborationReconnectResult;
export declare function assignCollaborationUserColors(users: CollaborationUserPresence[]): CollaborationUserPresence[];
export declare function buildCollaborationClipLocks(operations: CollaborationOperation[], users: CollaborationUserPresence[], ttlMs: number, nowMs: number): CollaborationClipLock[];
export declare function serializeCollaborationOperation(operation: CollaborationOperation): string;
export declare function parseCollaborationOperation(value: string): CollaborationOperation | undefined;
//# sourceMappingURL=collaboration.d.ts.map