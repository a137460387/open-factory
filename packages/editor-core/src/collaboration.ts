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

export function rebaseCollaborationOperations(operations: CollaborationOperation[]): CollaborationOperation[] {
  const latestByClipId = new Map<string, CollaborationOperation>();
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

export function canApplyCollaborationOperation(
  permission: CollaborationPermission,
  operation: Pick<CollaborationOperation, 'kind'>,
): boolean {
  if (permission === 'edit') {
    return true;
  }
  return operation.kind === 'comment' || operation.kind === 'playhead';
}

export function applyCollaborationReconnectState(
  clientProject: Project,
  hostProject: Project,
): CollaborationReconnectResult {
  return {
    project: hostProject,
    overwritten: clientProject.id !== hostProject.id || clientProject.updatedAt !== hostProject.updatedAt,
    hostUpdatedAt: hostProject.updatedAt,
  };
}

export function assignCollaborationUserColors(users: CollaborationUserPresence[]): CollaborationUserPresence[] {
  return users.map((user, index) => ({
    ...user,
    color:
      normalizeCollaborationColor(user.color) ?? COLLABORATION_USER_COLORS[index % COLLABORATION_USER_COLORS.length],
  }));
}

export function buildCollaborationClipLocks(
  operations: CollaborationOperation[],
  users: CollaborationUserPresence[],
  ttlMs: number,
  nowMs: number,
): CollaborationClipLock[] {
  const userById = new Map(users.map((user) => [user.userId, user]));
  const locksByClipId = new Map<string, CollaborationClipLock>();
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

export function serializeCollaborationOperation(operation: CollaborationOperation): string {
  return JSON.stringify(operation);
}

export function parseCollaborationOperation(value: string): CollaborationOperation | undefined {
  try {
    const parsed = JSON.parse(value) as Partial<CollaborationOperation>;
    if (!parsed.id || !parsed.userId || !parsed.commandName || !parsed.kind || typeof parsed.timestamp !== 'number') {
      return undefined;
    }
    const operation: CollaborationOperation = {
      id: parsed.id,
      userId: parsed.userId,
      commandName: parsed.commandName,
      params: parsed.params && typeof parsed.params === 'object' ? (parsed.params as Record<string, unknown>) : {},
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
  } catch {
    return undefined;
  }
}

function normalizeCollaborationColor(color: string | undefined): string | undefined {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(color?.trim() ?? '');
  return match ? `#${match[1].toLowerCase()}` : undefined;
}
