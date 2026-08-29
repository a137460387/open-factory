import {
  applyCollaborationReconnectState,
  assignCollaborationUserColors,
  buildCollaborationClipLocks,
  canApplyCollaborationOperation,
  isCollaborationProjectPayload,
  parseCollaborationOperation,
  serializeCollaborationOperation,
  type CollaborationClipLock,
  type CollaborationOperation,
  type CollaborationPermission,
  type CollaborationRole,
  type CollaborationUserPresence,
  type Command,
  type Project,
} from '@open-factory/editor-core';
import {
  broadcastCollaborationMessage,
  listenCollaborationMessage,
  startCollaborationHost,
  stopCollaborationHost,
  type CollaborationHostRequest,
} from '../lib/tauri-bridge';
import { useCollaborationStore } from '../store/collaborationStore';
import { useEditorStore } from '../store/editorStore';

type CollaborationMessage =
  | { type: 'operation'; operation: CollaborationOperation }
  | { type: 'project-sync'; project: Project; timestamp: number }
  | { type: 'presence'; user: CollaborationUserPresence }
  | { type: 'session-lock'; userId: string };

interface CollaborationControllerState {
  enabled: boolean;
  role: CollaborationRole;
  permission: CollaborationPermission;
  userId: string;
  sessionId?: string;
  /** host 会话认证 token（后端自动生成或用户配置），客户端入会时需提供 */
  authToken?: string;
  sessionLockedBy?: string;
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
    operations: [],
  };
  private unlisten?: () => void;
  private applyingRemote = false;

  getState(): CollaborationControllerState {
    return {
      ...this.state,
      users: [...this.state.users],
      locks: [...this.state.locks],
      operations: [...this.state.operations],
    };
  }

  async enableHost(request: CollaborationHostRequest & { userId?: string } = { port: 37822 }): Promise<void> {
    const hostState = await startCollaborationHost(request);
    this.state = {
      ...this.state,
      enabled: true,
      role: 'host',
      permission: 'edit',
      userId: request.userId ?? this.state.userId,
      // 会话 ID 仅内存态：host 会话建立即视为"已创建会话"（对应面板 collab-session-id）。
      sessionId: this.state.sessionId ?? `collab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      // 记录后端生效的认证 token（用户配置或自动生成），供面板展示与客户端入会使用。
      authToken: hostState.authToken ?? this.state.authToken,
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
      userId: input.userId ?? this.state.userId,
    };
    this.publishState();
    await this.ensureListening();
  }

  async disable(): Promise<void> {
    this.state = {
      ...this.state,
      enabled: false,
      sessionId: undefined,
      authToken: undefined,
      sessionLockedBy: undefined,
      users: [],
      locks: [],
      operations: [],
    };
    this.publishState();
    this.unlisten?.();
    this.unlisten = undefined;
    await stopCollaborationHost();
  }

  /** 面板"创建会话"入口：确保 host 会话已建立（含 sessionId 生成）。 */
  async createSession(request: CollaborationHostRequest & { userId?: string } = { port: 37822 }): Promise<void> {
    if (this.state.enabled && this.state.sessionId) {
      return;
    }
    await this.enableHost(request);
  }

  /** 注入远端用户 presence（e2e 模拟"新用户加入"；真实场景由 presence 消息驱动 receiveMessage）。 */
  addRemoteUser(user: CollaborationUserPresence): void {
    if (!this.state.enabled) {
      return;
    }
    const users = assignCollaborationUserColors([
      ...this.state.users.filter((item) => item.userId !== user.userId),
      user,
    ]);
    this.state = {
      ...this.state,
      users,
      locks: buildCollaborationClipLocks(this.state.operations, users, 10_000, Date.now()),
    };
    this.publishState();
  }

  /** 设置本机角色：viewer → permission 'read-only'（调色面板据此进入只读态）。 */
  setLocalRole(role: 'editor' | 'viewer'): void {
    this.state = {
      ...this.state,
      permission: role === 'viewer' ? 'read-only' : 'edit',
    };
    this.publishState();
  }

  /** 会话锁定：记录锁定者 userId（仅面板展示，不拦截编辑命令广播）。 */
  lockSession(userId: string): void {
    this.state = { ...this.state, sessionLockedBy: userId };
    this.publishState();
    if (this.state.enabled) {
      void broadcastCollaborationMessage(serializeCollaborationMessage({ type: 'session-lock', userId }));
    }
  }

  /** 发布评论：kind='comment' 的 operation，本地记入 operations 并广播。 */
  async broadcastComment(text: string): Promise<void> {
    if (!this.state.enabled) {
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    const timestamp = Date.now();
    const operation: CollaborationOperation = {
      id: `operation-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
      userId: this.state.userId,
      commandName: 'collaboration-comment',
      params: { text: trimmed },
      timestamp,
      kind: 'comment',
    };
    this.rememberOperation(operation);
    await broadcastCollaborationMessage(serializeCollaborationMessage({ type: 'operation', operation }));
  }

  /** 本机已发送的 operations（userId === 本机），供 e2e 断言同步发送情况。 */
  getSentOperations(): CollaborationOperation[] {
    return this.state.operations.filter((operation) => operation.userId === this.state.userId);
  }

  async broadcastCommand(command: Command): Promise<void> {
    if (!this.state.enabled || this.applyingRemote) {
      return;
    }
    const operation = buildCollaborationOperationFromCommand(
      command,
      this.state.userId,
      useEditorStore.getState().project,
    );
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
        timestamp: Date.now(),
      }),
    );
  }

  receiveMessage(value: string): void {
    const message = parseCollaborationMessage(value);
    if (!message || !this.state.enabled) {
      return;
    }
    if (message.type === 'presence') {
      const users = assignCollaborationUserColors([
        ...this.state.users.filter((user) => user.userId !== message.user.userId),
        message.user,
      ]);
      this.state = {
        ...this.state,
        users,
        locks: buildCollaborationClipLocks(this.state.operations, users, 10_000, Date.now()),
      };
      this.publishState();
      return;
    }
    if (message.type === 'session-lock') {
      // 会话锁仅面板展示（collab-lock-status），不拦截编辑命令广播。
      this.state = { ...this.state, sessionLockedBy: message.userId };
      this.publishState();
      return;
    }
    if (message.type === 'project-sync' && this.state.role === 'client') {
      // 远端载荷结构守卫：拒绝缺少 Project 必要字段的 project-sync 消息。
      if (!isCollaborationProjectPayload(message.project)) {
        return;
      }
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
    // 远端载荷结构守卫：operation 携带的 project 必须通过校验才能替换本地状态。
    if (isCollaborationProjectPayload(project)) {
      this.applyingRemote = true;
      try {
        useEditorStore.getState().setProject(project, useEditorStore.getState().projectPath);
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
      color,
    };
    this.state = {
      ...this.state,
      users: assignCollaborationUserColors([...this.state.users.filter((item) => item.userId !== user.userId), user]),
    };
    this.state = {
      ...this.state,
      locks: buildCollaborationClipLocks(this.state.operations, this.state.users, 10_000, Date.now()),
    };
    this.publishState();
    void broadcastCollaborationMessage(serializeCollaborationMessage({ type: 'presence', user }));
  }

  private rememberOperation(operation: CollaborationOperation): void {
    const operations = [...this.state.operations.filter((item) => item.id !== operation.id), operation].slice(-100);
    this.state = {
      ...this.state,
      operations,
      locks: buildCollaborationClipLocks(operations, this.state.users, 10_000, Date.now()),
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

function buildCollaborationOperationFromCommand(
  command: Command,
  userId: string,
  project: Project,
  timestamp = Date.now(),
): CollaborationOperation {
  const params = extractSerializableCommandParams(command);
  const clipId = typeof params.clipId === 'string' ? params.clipId : undefined;
  return {
    id: `operation-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    commandName: command.constructor.name || command.description,
    params: {
      ...params,
      project,
    },
    timestamp,
    kind: command.description.toLowerCase().includes('collaboration note') ? 'comment' : 'timeline-command',
    clipId,
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
    return JSON.stringify({
      ...message,
      operation: parseCollaborationOperation(serializeCollaborationOperation(message.operation)) ?? message.operation,
    });
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
    if (parsed.type === 'session-lock' && typeof parsed.userId === 'string') {
      return { type: 'session-lock', userId: parsed.userId };
    }
    return undefined;
  } catch {
    return undefined;
  }
}
