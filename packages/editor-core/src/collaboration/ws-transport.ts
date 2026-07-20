/**
 * WebSocket 协作传输层
 *
 * 功能：
 * 1. WebSocket 连接管理（连接/断开/重连）
 * 2. 消息序列化/反序列化
 * 3. 心跳保活机制
 * 4. 自动指数退避重连
 * 5. 与 ColorCollaborationManager 集成
 */

import type {
  ColorCollabOperation,
  ColorCollabUser,
  ColorCollabEvent,
  ColorCollabSessionConfig,
  ColorCollabSessionState,
  ColorCollabRole,
} from './color-collaboration';
import {
  ColorCollaborationManager,
  createDefaultCollabSessionConfig,
  createCollabUser,
  serializeOperation,
  parseOperation,
  serializeSessionSnapshot,
  deserializeSessionSnapshot,
} from './color-collaboration';

// ==================== 类型定义 ====================

/** WebSocket 连接状态 */
export type WSConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

/** 协作消息类型 */
export type CollabMessageType =
  | 'join'
  | 'leave'
  | 'operation'
  | 'cursor-update'
  | 'state-sync'
  | 'heartbeat'
  | 'heartbeat-ack'
  | 'comment'
  | 'lock-request'
  | 'lock-grant'
  | 'lock-release'
  | 'error'
  | 'snapshot-request'
  | 'snapshot-response';

/** 协作消息 */
export interface CollabMessage {
  type: CollabMessageType;
  sessionId: string;
  userId: string;
  timestamp: number;
  payload: unknown;
  sequenceId: number;
}

/** 连接配置 */
export interface WSTransportConfig {
  /** WebSocket 服务器 URL */
  serverUrl: string;
  /** 会话 ID */
  sessionId: string;
  /** 用户 ID */
  userId: string;
  /** 用户名 */
  userName: string;
  /** 用户角色 */
  role: ColorCollabRole;
  /** 心跳间隔 (ms) */
  heartbeatIntervalMs: number;
  /** 心跳超时 (ms) */
  heartbeatTimeoutMs: number;
  /** 最大重连次数 */
  maxReconnectAttempts: number;
  /** 初始重连延迟 (ms) */
  initialReconnectDelayMs: number;
  /** 最大重连延迟 (ms) */
  maxReconnectDelayMs: number;
  /** 消息队列最大长度 */
  maxQueueSize: number;
  /** 是否自动重连 */
  autoReconnect: boolean;
}

/** 连接状态变更回调 */
export type WSConnectionStateCallback = (state: WSConnectionState, detail?: string) => void;

/** 消息回调 */
export type WSMessageCallback = (message: CollabMessage) => void;

/** 传输层事件 */
export type WSTransportEvent =
  | { type: 'state-change'; state: WSConnectionState; detail?: string }
  | { type: 'message'; message: CollabMessage }
  | { type: 'error'; error: string }
  | { type: 'user-joined'; user: ColorCollabUser }
  | { type: 'user-left'; userId: string }
  | { type: 'operation'; operation: ColorCollabOperation }
  | { type: 'reconnect-attempt'; attempt: number; maxAttempts: number }
  | { type: 'connected'; sessionId: string }
  | { type: 'disconnected'; reason: string };

/** 事件处理器 */
export type WSTransportEventHandler = (event: WSTransportEvent) => void;

/** WebSocket 接口抽象（便于测试和平台适配） */
export interface WSAdapter {
  connect(url: string): void;
  close(): void;
  send(data: string): void;
  onOpen(handler: () => void): void;
  onClose(handler: (code: number, reason: string) => void): void;
  onMessage(handler: (data: string) => void): void;
  onError(handler: (error: unknown) => void): void;
  readonly readyState: number;
}

/** 消息队列条目 */
interface QueuedMessage {
  message: CollabMessage;
  enqueuedAt: number;
  retries: number;
}

// ==================== 常量 ====================

const DEFAULT_WS_CONFIG: WSTransportConfig = {
  serverUrl: 'ws://localhost:8765',
  sessionId: '',
  userId: '',
  userName: '',
  role: 'editor',
  heartbeatIntervalMs: 15000,
  heartbeatTimeoutMs: 5000,
  maxReconnectAttempts: 10,
  initialReconnectDelayMs: 1000,
  maxReconnectDelayMs: 30000,
  maxQueueSize: 200,
  autoReconnect: true,
};

// ==================== 工具函数 ====================

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clampValue(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** 计算指数退避延迟 */
export function computeBackoffDelay(attempt: number, initialMs: number, maxMs: number): number {
  const delay = initialMs * 2 ** attempt;
  return Math.min(delay, maxMs) + Math.random() * 1000 * 0.1; // 添加抖动
}

// ==================== 默认工厂函数 ====================

/** 创建默认传输配置 */
export function createDefaultWSTransportConfig(
  sessionId: string,
  userId: string,
  userName: string,
  role: ColorCollabRole = 'editor',
): WSTransportConfig {
  return { ...DEFAULT_WS_CONFIG, sessionId, userId, userName, role };
}

/** 验证传输配置 */
export function validateWSTransportConfig(config: WSTransportConfig): WSTransportConfig {
  return {
    serverUrl:
      typeof config.serverUrl === 'string' && config.serverUrl ? config.serverUrl : DEFAULT_WS_CONFIG.serverUrl,
    sessionId: config.sessionId,
    userId: config.userId,
    userName: config.userName,
    role: config.role,
    heartbeatIntervalMs: clampValue(config.heartbeatIntervalMs, 5000, 60000),
    heartbeatTimeoutMs: clampValue(config.heartbeatTimeoutMs, 2000, 30000),
    maxReconnectAttempts: clampValue(config.maxReconnectAttempts, 0, 100),
    initialReconnectDelayMs: clampValue(config.initialReconnectDelayMs, 500, 10000),
    maxReconnectDelayMs: clampValue(config.maxReconnectDelayMs, 5000, 120000),
    maxQueueSize: clampValue(config.maxQueueSize, 10, 1000),
    autoReconnect: !!config.autoReconnect,
  };
}

// ==================== 消息构建 ====================

/** 构建协作消息 */
export function buildCollabMessage(
  type: CollabMessageType,
  sessionId: string,
  userId: string,
  payload: unknown,
  sequenceId: number,
): CollabMessage {
  return {
    type,
    sessionId,
    userId,
    timestamp: Date.now(),
    payload,
    sequenceId,
  };
}

/** 序列化消息为 JSON */
export function serializeCollabMessage(message: CollabMessage): string {
  return JSON.stringify(message);
}

/** 从 JSON 解析消息 */
export function parseCollabMessage(json: string): CollabMessage | null {
  try {
    const parsed = JSON.parse(json) as Partial<CollabMessage>;
    if (!parsed.type || !parsed.sessionId || !parsed.userId || typeof parsed.timestamp !== 'number') {
      return null;
    }
    return {
      type: parsed.type as CollabMessageType,
      sessionId: parsed.sessionId,
      userId: parsed.userId,
      timestamp: parsed.timestamp,
      payload: parsed.payload,
      sequenceId: typeof parsed.sequenceId === 'number' ? parsed.sequenceId : 0,
    };
  } catch {
    return null;
  }
}

/** 验证消息类型 */
export function isValidCollabMessageType(type: string): type is CollabMessageType {
  const validTypes: CollabMessageType[] = [
    'join',
    'leave',
    'operation',
    'cursor-update',
    'state-sync',
    'heartbeat',
    'heartbeat-ack',
    'comment',
    'lock-request',
    'lock-grant',
    'lock-release',
    'error',
    'snapshot-request',
    'snapshot-response',
  ];
  return validTypes.includes(type as CollabMessageType);
}

// ==================== 浏览器 WebSocket 适配器 ====================

/**
 * 浏览器 WebSocket 适配器
 *
 * 封装原生 WebSocket API，提供统一接口。
 * @internal
 */
export class BrowserWSAdapter implements WSAdapter {
  private ws: WebSocket | null = null;
  private openHandler: (() => void) | null = null;
  private closeHandler: ((code: number, reason: string) => void) | null = null;
  private messageHandler: ((data: string) => void) | null = null;
  private errorHandler: ((error: unknown) => void) | null = null;

  get readyState(): number {
    return this.ws?.readyState ?? 3; // CLOSED
  }

  connect(url: string): void {
    this.ws = new WebSocket(url);
    this.ws.onopen = () => this.openHandler?.();
    this.ws.onclose = (e) => this.closeHandler?.(e.code, e.reason);
    this.ws.onmessage = (e) => {
      if (typeof e.data === 'string') {
        this.messageHandler?.(e.data);
      }
    };
    this.ws.onerror = (e) => this.errorHandler?.(e);
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }

  send(data: string): void {
    if (this.ws?.readyState === 1) {
      // OPEN
      this.ws.send(data);
    }
  }

  onOpen(handler: () => void): void {
    this.openHandler = handler;
  }

  onClose(handler: (code: number, reason: string) => void): void {
    this.closeHandler = handler;
  }

  onMessage(handler: (data: string) => void): void {
    this.messageHandler = handler;
  }

  onError(handler: (error: unknown) => void): void {
    this.errorHandler = handler;
  }
}

// ==================== 模拟 WebSocket 适配器（测试用） ====================

/**
 * 模拟 WebSocket 适配器
 *
 * 用于单元测试和 E2E 测试，无需真实 WebSocket 服务器。
 */
export class MockWSAdapter implements WSAdapter {
  private _readyState = 3; // CLOSED
  private openHandler: (() => void) | null = null;
  private closeHandler: ((code: number, reason: string) => void) | null = null;
  private messageHandler: ((data: string) => void) | null = null;
  private errorHandler: ((error: unknown) => void) | null = null;
  private sentMessages: string[] = [];
  private connectedUrl: string | null = null;

  /** 模拟的服务端消息入队 */
  private pendingIncoming: string[] = [];

  get readyState(): number {
    return this._readyState;
  }

  getSentMessages(): string[] {
    return [...this.sentMessages];
  }

  getLastSentMessage(): CollabMessage | null {
    if (this.sentMessages.length === 0) return null;
    return parseCollabMessage(this.sentMessages[this.sentMessages.length - 1]);
  }

  getConnectedUrl(): string | null {
    return this.connectedUrl;
  }

  connect(url: string): void {
    this.connectedUrl = url;
    this._readyState = 0; // CONNECTING
    // 模拟异步连接成功
    setTimeout(() => {
      this._readyState = 1; // OPEN
      this.openHandler?.();
      // 发送排队的消息
      for (const msg of this.pendingIncoming) {
        this.messageHandler?.(msg);
      }
      this.pendingIncoming = [];
    }, 10);
  }

  /** 模拟服务端发送消息 */
  simulateIncoming(data: string): void {
    if (this._readyState === 1) {
      this.messageHandler?.(data);
    } else {
      this.pendingIncoming.push(data);
    }
  }

  /** 模拟连接关闭 */
  simulateClose(code: number = 1000, reason: string = 'normal'): void {
    this._readyState = 3; // CLOSED
    this.closeHandler?.(code, reason);
  }

  /** 模拟连接错误 */
  simulateError(error: unknown): void {
    this.errorHandler?.(error);
  }

  close(): void {
    this._readyState = 3;
    this.closeHandler?.(1000, 'client close');
  }

  send(data: string): void {
    if (this._readyState === 1) {
      this.sentMessages.push(data);
    }
  }

  onOpen(handler: () => void): void {
    this.openHandler = handler;
  }

  onClose(handler: (code: number, reason: string) => void): void {
    this.closeHandler = handler;
  }

  onMessage(handler: (data: string) => void): void {
    this.messageHandler = handler;
  }

  onError(handler: (error: unknown) => void): void {
    this.errorHandler = handler;
  }
}

// ==================== 协作传输管理器 ====================

/**
 * WebSocket 协作传输管理器
 *
 * 管理 WebSocket 连接，将底层消息与 ColorCollaborationManager 集成。
 * 提供自动重连、心跳保活、消息队列和事件分发。
 */
export class CollabWSTransport {
  private config: WSTransportConfig;
  private adapter: WSAdapter;
  private manager: ColorCollaborationManager;
  private state: WSConnectionState = 'disconnected';
  private eventHandlers: Set<WSTransportEventHandler> = new Set();
  private sequenceId = 0;
  private messageQueue: QueuedMessage[] = [];
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private lastHeartbeatAck = 0;
  private disposed = false;

  constructor(config: WSTransportConfig, adapter?: WSAdapter) {
    this.config = validateWSTransportConfig(config);
    this.adapter = adapter ?? new BrowserWSAdapter();
    this.manager = new ColorCollaborationManager(createDefaultCollabSessionConfig(config.sessionId, '', config.userId));
    this.setupAdapterHandlers();
  }

  /** 获取当前连接状态 */
  getState(): WSConnectionState {
    return this.state;
  }

  /** 获取内部协作管理器 */
  getManager(): ColorCollaborationManager {
    return this.manager;
  }

  /** 获取配置 */
  getConfig(): WSTransportConfig {
    return { ...this.config };
  }

  /** 获取重连次数 */
  getReconnectAttempt(): number {
    return this.reconnectAttempt;
  }

  /** 获取消息队列长度 */
  getQueueSize(): number {
    return this.messageQueue.length;
  }

  // === 事件 ===

  /** 注册事件处理器 */
  onEvent(handler: WSTransportEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  // === 连接管理 ===

  /** 连接到服务器 */
  connect(): void {
    if (this.disposed) return;
    if (this.state === 'connected' || this.state === 'connecting') return;

    this.setState('connecting');
    this.adapter.connect(`${this.config.serverUrl}?session=${this.config.sessionId}&user=${this.config.userId}`);
  }

  /** 断开连接 */
  disconnect(): void {
    this.stopHeartbeat();
    this.clearReconnectTimer();
    this.reconnectAttempt = 0;
    this.adapter.close();
    this.setState('disconnected', '用户主动断开');
  }

  // === 消息发送 ===

  /** 发送操作 */
  sendOperation(operation: ColorCollabOperation): void {
    const msg = buildCollabMessage('operation', this.config.sessionId, this.config.userId, operation, this.nextSeq());
    this.enqueueOrSend(msg);
  }

  /** 发送光标更新 */
  sendCursorUpdate(nodeId: string, parameter: string): void {
    const msg = buildCollabMessage(
      'cursor-update',
      this.config.sessionId,
      this.config.userId,
      { nodeId, parameter },
      this.nextSeq(),
    );
    this.enqueueOrSend(msg);
  }

  /** 发送评论 */
  sendComment(nodeId: string, text: string): void {
    const msg = buildCollabMessage(
      'comment',
      this.config.sessionId,
      this.config.userId,
      { nodeId, text },
      this.nextSeq(),
    );
    this.enqueueOrSend(msg);
  }

  /** 请求锁定 */
  requestLock(): void {
    const msg = buildCollabMessage('lock-request', this.config.sessionId, this.config.userId, {}, this.nextSeq());
    this.enqueueOrSend(msg);
  }

  /** 释放锁定 */
  releaseLock(): void {
    const msg = buildCollabMessage('lock-release', this.config.sessionId, this.config.userId, {}, this.nextSeq());
    this.enqueueOrSend(msg);
  }

  /** 请求状态快照 */
  requestSnapshot(): void {
    const msg = buildCollabMessage('snapshot-request', this.config.sessionId, this.config.userId, {}, this.nextSeq());
    this.enqueueOrSend(msg);
  }

  /** 发送状态快照 */
  sendSnapshot(snapshot: string): void {
    const msg = buildCollabMessage(
      'snapshot-response',
      this.config.sessionId,
      this.config.userId,
      { snapshot },
      this.nextSeq(),
    );
    this.enqueueOrSend(msg);
  }

  /** 发送加入消息 */
  sendJoin(): void {
    const user = createCollabUser(this.config.userId, this.config.userName, this.config.role);
    const msg = buildCollabMessage('join', this.config.sessionId, this.config.userId, { user }, this.nextSeq());
    this.enqueueOrSend(msg);
  }

  /** 发送离开消息 */
  sendLeave(): void {
    const msg = buildCollabMessage('leave', this.config.sessionId, this.config.userId, {}, this.nextSeq());
    this.enqueueOrSend(msg);
  }

  // === 销毁 ===

  /** 销毁传输层 */
  dispose(): void {
    this.disposed = true;
    this.disconnect();
    this.manager.dispose();
    this.eventHandlers.clear();
    this.messageQueue = [];
  }

  // === 内部方法 ===

  private nextSeq(): number {
    return ++this.sequenceId;
  }

  private setState(state: WSConnectionState, detail?: string): void {
    this.state = state;
    this.emit({ type: 'state-change', state, detail });
  }

  private emit(event: WSTransportEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        /* 忽略回调异常 */
      }
    }
  }

  private enqueueOrSend(message: CollabMessage): void {
    if (this.state === 'connected') {
      this.adapter.send(serializeCollabMessage(message));
    } else {
      if (this.messageQueue.length < this.config.maxQueueSize) {
        this.messageQueue.push({ message, enqueuedAt: Date.now(), retries: 0 });
      }
    }
  }

  private flushQueue(): void {
    while (this.messageQueue.length > 0 && this.state === 'connected') {
      const entry = this.messageQueue.shift();
      if (entry) {
        this.adapter.send(serializeCollabMessage(entry.message));
      }
    }
  }

  private setupAdapterHandlers(): void {
    this.adapter.onOpen(() => {
      this.reconnectAttempt = 0;
      this.setState('connected');
      this.startHeartbeat();
      this.sendJoin();
      this.flushQueue();
      this.emit({ type: 'connected', sessionId: this.config.sessionId });
    });

    this.adapter.onClose((code, reason) => {
      this.stopHeartbeat();
      this.setState('disconnected', `连接关闭: ${code} ${reason}`);
      this.emit({ type: 'disconnected', reason: `${code} ${reason}` });
      if (this.config.autoReconnect && code !== 1000) {
        this.scheduleReconnect();
      }
    });

    this.adapter.onMessage((data) => {
      const message = parseCollabMessage(data);
      if (!message) return;
      this.handleMessage(message);
    });

    this.adapter.onError((error) => {
      const msg = error instanceof Error ? error.message : String(error);
      this.emit({ type: 'error', error: msg });
    });
  }

  private handleMessage(message: CollabMessage): void {
    this.emit({ type: 'message', message });

    switch (message.type) {
      case 'operation': {
        const op = message.payload as ColorCollabOperation;
        if (op) {
          this.manager.submitOperation(op);
          this.emit({ type: 'operation', operation: op });
        }
        break;
      }
      case 'join': {
        const payload = message.payload as { user?: ColorCollabUser };
        if (payload?.user) {
          this.manager.joinUser(payload.user.userId, payload.user.userName, payload.user.role);
          this.emit({ type: 'user-joined', user: payload.user });
        }
        break;
      }
      case 'leave': {
        this.manager.leaveUser(message.userId);
        this.emit({ type: 'user-left', userId: message.userId });
        break;
      }
      case 'heartbeat': {
        // 回复心跳
        const ack = buildCollabMessage('heartbeat-ack', this.config.sessionId, this.config.userId, {}, this.nextSeq());
        this.adapter.send(serializeCollabMessage(ack));
        break;
      }
      case 'heartbeat-ack': {
        this.lastHeartbeatAck = Date.now();
        if (this.heartbeatTimeoutTimer) {
          clearTimeout(this.heartbeatTimeoutTimer);
          this.heartbeatTimeoutTimer = null;
        }
        break;
      }
      case 'snapshot-request': {
        const snapshot = this.manager.exportSnapshot();
        this.sendSnapshot(snapshot);
        break;
      }
      case 'snapshot-response': {
        const payload = message.payload as { snapshot?: string };
        if (payload?.snapshot) {
          this.manager.importSnapshot(payload.snapshot);
        }
        break;
      }
      case 'lock-grant':
      case 'lock-release':
      case 'cursor-update':
      case 'comment':
      case 'error':
        // 这些消息类型由上层 UI 处理
        break;
    }
  }

  // === 心跳 ===

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.state !== 'connected') return;
      const heartbeat = buildCollabMessage('heartbeat', this.config.sessionId, this.config.userId, {}, this.nextSeq());
      this.adapter.send(serializeCollabMessage(heartbeat));

      // 设置超时检测
      this.heartbeatTimeoutTimer = setTimeout(() => {
        // 心跳超时，断开重连
        this.adapter.close();
      }, this.config.heartbeatTimeoutMs);
    }, this.config.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  // === 重连 ===

  private scheduleReconnect(): void {
    if (this.reconnectAttempt >= this.config.maxReconnectAttempts) {
      this.setState('failed', `重连失败，已达最大次数 ${this.config.maxReconnectAttempts}`);
      return;
    }

    this.setState('reconnecting');
    const delay = computeBackoffDelay(
      this.reconnectAttempt,
      this.config.initialReconnectDelayMs,
      this.config.maxReconnectDelayMs,
    );
    this.reconnectAttempt++;

    this.emit({
      type: 'reconnect-attempt',
      attempt: this.reconnectAttempt,
      maxAttempts: this.config.maxReconnectAttempts,
    });

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
