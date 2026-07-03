import {
  applyCollaborationReconnectState,
  assignCollaborationUserColors,
  buildCollaborationClipLocks,
  canApplyCollaborationOperation,
  parseCollaborationOperation,
  serializeCollaborationOperation,
  type CollaborationClipLock,
  type CollaborationOperation,
  type CollaborationPermission,
  type CollaborationRole,
  type CollaborationUserPresence,
  type Command,
  type Project
} from '@open-factory/editor-core';
import { broadcastCollaborationMessage, listenCollaborationMessage, startCollaborationHost, stopCollaborationHost, type CollaborationHostRequest } from '../lib/tauri-bridge';
import { useCollaborationStore } from '../store/collaborationStore';
import { useEditorStore } from '../store/editorStore';

type CollaborationMessage =
  | { type: 'operation'; operation: CollaborationOperation }
  | { type: 'project-sync'; project: Project; timestamp: number }
  | { type: 'presence'; user: CollaborationUserPresence };

interface CollaborationControllerState {
  enabled: boolean;
  role: CollaborationRole;
  permission: CollaborationPermission;
  userId: string;
  users: CollaborationUserPresence[];
  locks: CollaborationClipLock[];
  operations: CollaborationOperation[];
  lastSyncAt?: number;
}

class LocalNetworkCollaborationController {
  private state: CollaborationControllerState = {
    enabled: false,
    role: 'host',
    permission: 'edit',
    userId: 'local-user',
    users: [],
    locks: [],
    operations: []
  };
  private unlisten?: () => void;
  private applyingRemote = false;

  getState(): CollaborationControllerState {
    return {
      ...this.state,
      users: [...this.state.users],
      locks: [...this.state.locks],
      operations: [...this.state.operations]
    };
  }

  async enableHost(request: CollaborationHostRequest & { userId?: string } = { port: 37822 }): Promise<void> {
    await startCollaborationHost(request);
    this.state = {
      ...this.state,
      enabled: true,
      role: 'host',
      permission: 'edit',
      userId: request.userId ?? this.state.userId
    };
    this.publishState();
    await this.ensureListening();
    await this.broadcastProjectSync();
  }

  async enableClient(input: { userId?: string; permission?: CollaborationPermission } = {}): Promise<void> {
    this.state = {
      ...this.state,
      enabled: true,
      role: 'client',
      permission: input.permission ?? 'edit',
      userId: input.userId ?? this.state.userId
    };
    this.publishState();
    await this.ensureListening();
  }

  async disable(): Promise<void> {
    this.state = { ...this.state, enabled: false, users: [], locks: [], operations: [] };
    this.publishState();
    this.unlisten?.();
    this.unlisten = undefined;
    await stopCollaborationHost();
  }

  async broadcastCommand(command: Command): Promise<void> {
    if (!this.state.enabled || this.applyingRemote) {
      return;
    }
    const operation = buildCollaborationOperationFromCommand(command, this.state.userId, useEditorStore.getState().project);
    if (!canApplyCollaborationOperation(this.state.permission, operation)) {
      return;
    }
    this.rememberOperation(operation);
    await broadcastCollaborationMessage(serializeCollaborationMessage({ type: 'operation', operation }));
  }

  async broadcastProjectSync(): Promise<void> {
    if (!this.state.enabled) {
      return;
    }
    await broadcastCollaborationMessage(
      serializeCollaborationMessage({
        type: 'project-sync',
        project: useEditorStore.getState().project,
        timestamp: Date.now()
      })
    );
  }

  receiveMessage(value: string): void {
    const message = parseCollaborationMessage(value);
    if (!message || !this.state.enabled) {
      return;
    }
    if (message.type === 'presence') {
      const users = assignCollaborationUserColors([...this.state.users.filter((user) => user.userId !== message.user.userId), message.user]);
      this.state = {
        ...this.state,
        users,
        locks: buildCollaborationClipLocks(this.state.operations, users, 10_000, Date.now())
      };
      this.publishState();
      return;
    }
    if (message.type === 'project-sync' && this.state.role === 'client') {
      this.applyingRemote = true;
      try {
        const result = applyCollaborationReconnectState(useEditorStore.getState().project, message.project);
        useEditorStore.getState().setProject(result.project, useEditorStore.getState().projectPath);
        this.state = { ...this.state, lastSyncAt: message.timestamp };
        this.publishState();
      } finally {
        this.applyingRemote = false;
      }
      return;
    }
    if (message.type !== 'operation') {
      return;
    }
    if (message.operation.userId === this.state.userId) {
      return;
    }
    this.rememberOperation(message.operation);
    const project = message.operation.params.project;
    if (project && typeof project === 'object') {
      this.applyingRemote = true;
      try {
        useEditorStore.getState().setProject(project as Project, useEditorStore.getState().projectPath);
      } finally {
        this.applyingRemote = false;
      }
    }
  }

  updatePresence(playheadTime: number, name: string, color?: string): void {
    if (!this.state.enabled) {
      return;
    }
    const user: CollaborationUserPresence = {
      userId: this.state.userId,
      name,
      playheadTime,
      color
    };
    this.state = {
      ...this.state,
      users: assignCollaborationUserColors([...this.state.users.filter((item) => item.userId !== user.userId), user])
    };
    this.state = {
      ...this.state,
      locks: buildCollaborationClipLocks(this.state.operations, this.state.users, 10_000, Date.now())
    };
    this.publishState();
    void broadcastCollaborationMessage(serializeCollaborationMessage({ type: 'presence', user }));
  }

  private rememberOperation(operation: CollaborationOperation): void {
    const operations = [...this.state.operations.filter((item) => item.id !== operation.id), operation].slice(-100);
    this.state = {
      ...this.state,
      operations,
      locks: buildCollaborationClipLocks(operations, this.state.users, 10_000, Date.now())
    };
    this.publishState();
  }

  private async ensureListening(): Promise<void> {
    if (this.unlisten) {
      return;
    }
    this.unlisten = await listenCollaborationMessage((message) => this.receiveMessage(message));
  }

  private publishState(): void {
    useCollaborationStore.getState().setControllerState(this.getState());
  }
}

export const collaborationController = new LocalNetworkCollaborationController();

function buildCollaborationOperationFromCommand(command: Command, userId: string, project: Project, timestamp = Date.now()): CollaborationOperation {
  const params = extractSerializableCommandParams(command);
  const clipId = typeof params.clipId === 'string' ? params.clipId : undefined;
  return {
    id: `operation-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    commandName: command.constructor.name || command.description,
    params: {
      ...params,
      project
    },
    timestamp,
    kind: command.description.toLowerCase().includes('collaboration note') ? 'comment' : 'timeline-command',
    clipId
  };
}

function extractSerializableCommandParams(command: Command): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(command as unknown as Record<string, unknown>)) {
    if (key === 'accessor' || key === 'before' || key === 'after' || typeof value === 'function') {
      continue;
    }
    if (isJsonSerializable(value)) {
      output[key] = value;
    }
  }
  return output;
}

function isJsonSerializable(value: unknown): boolean {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return false;
  }
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
}

function serializeCollaborationMessage(message: CollaborationMessage): string {
  if (message.type === 'operation') {
    return JSON.stringify({ ...message, operation: parseCollaborationOperation(serializeCollaborationOperation(message.operation)) ?? message.operation });
  }
  return JSON.stringify(message);
}

function parseCollaborationMessage(value: string): CollaborationMessage | undefined {
  try {
    const parsed = JSON.parse(value) as Partial<CollaborationMessage>;
    if (parsed.type === 'operation' && parsed.operation) {
      return { type: 'operation', operation: parsed.operation };
    }
    if (parsed.type === 'project-sync' && parsed.project && typeof parsed.timestamp === 'number') {
      return { type: 'project-sync', project: parsed.project, timestamp: parsed.timestamp };
    }
    if (parsed.type === 'presence' && parsed.user) {
      return { type: 'presence', user: parsed.user };
    }
    return undefined;
  } catch {
    return undefined;
  }
}
