/**
 * WebRTC 连接优化模块
 *
 * 功能：
 * 1. P2P DataChannel 传输 CRDT 操作数据
 * 2. SDP 协商（offer/answer）
 * 3. ICE 候选交换
 * 4. TURN 服务器中继支持
 * 5. 自动指数退避重连
 * 6. 连接统计监控
 */

import { computeBackoffDelay } from './ws-transport';

// ==================== 类型定义 ====================

/** WebRTC 连接状态 */
export type WebRTCConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed';

/** ICE 候选信息 */
export interface ICECandidate {
  candidate: string;
  sdpMid: string;
  sdpMLineIndex: number;
}

/** TURN 服务器配置 */
export interface TURNConfig {
  urls: string;
  username: string;
  credential: string;
}

/** WebRTC 连接配置 */
export interface WebRTCConnectionConfig {
  /** ICE 服务器列表 */
  iceServers: RTCIceServer[];
  /** TURN 服务器配置 */
  turnConfig: TURNConfig | null;
  /** 是否启用自动重连 */
  reconnectEnabled: boolean;
  /** 最大重连次数 */
  maxReconnectAttempts: number;
  /** 初始重连延迟 (ms) */
  initialReconnectDelayMs: number;
  /** 最大重连延迟 (ms) */
  maxReconnectDelayMs: number;
  /** DataChannel 标签 */
  dataChannelLabel: string;
}

/** 连接统计 */
export interface ConnectionStats {
  bytesSent: number;
  bytesReceived: number;
  roundTripTime: number;
  connectionState: WebRTCConnectionState;
  timestamp: number;
}

/** 信令消息类型 */
export type SignalingMessageType = 'offer' | 'answer' | 'ice-candidate';

/** 信令消息 */
export interface SignalingMessage {
  type: SignalingMessageType;
  senderId: string;
  receiverId: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: ICECandidate;
  timestamp: number;
}

/** 连接状态回调 */
export type ConnectionStateCallback = (state: WebRTCConnectionState, detail?: string) => void;

/** 数据接收回调 */
export type DataCallback = (data: string) => void;

/** 信令发送回调 */
export type SignalingSendCallback = (message: SignalingMessage) => void;

// ==================== 常量 ====================

const DEFAULT_CONFIG: WebRTCConnectionConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  turnConfig: null,
  reconnectEnabled: true,
  maxReconnectAttempts: 10,
  initialReconnectDelayMs: 1000,
  maxReconnectDelayMs: 30000,
  dataChannelLabel: 'crdt-operations',
};

// ==================== 工具函数 ====================

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 构建 ICE 服务器列表（含 TURN） */
function buildIceServers(baseServers: RTCIceServer[], turnConfig: TURNConfig | null): RTCIceServer[] {
  const servers = [...baseServers];
  if (turnConfig) {
    servers.push({
      urls: turnConfig.urls,
      username: turnConfig.username,
      credential: turnConfig.credential,
    });
  }
  return servers;
}

// ==================== 默认工厂函数 ====================

/** 创建默认 TURN 配置 */
export function createDefaultTURNConfig(
  urls: string,
  username: string,
  credential: string,
): TURNConfig {
  return { urls, username, credential };
}

/** 创建默认 WebRTC 连接配置 */
export function createDefaultWebRTCConfig(
  overrides?: Partial<WebRTCConnectionConfig>,
): WebRTCConnectionConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

// ==================== WebRTC Peer Connection ====================

/**
 * WebRTC 对等连接管理
 *
 * 封装 RTCPeerConnection，提供 SDP 协商、ICE 交换、
 * DataChannel 数据传输和自动重连。
 */
export class WebRTCPeerConnection {
  private config: WebRTCConnectionConfig;
  private peer: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private connectionState: WebRTCConnectionState = 'new';
  private stateCallbacks: Set<ConnectionStateCallback> = new Set();
  private dataCallbacks: Set<DataCallback> = new Set();
  private signalingCallback: SignalingSendCallback | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private statsInterval: ReturnType<typeof setInterval> | null = null;
  private lastStats: ConnectionStats | null = null;
  private disposed = false;
  private localPeerId: string;

  constructor(config: Partial<WebRTCConnectionConfig> & { localPeerId: string }) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.localPeerId = config.localPeerId;
  }

  /** 获取当前连接状态 */
  getState(): WebRTCConnectionState {
    return this.connectionState;
  }

  /** 获取连接统计 */
  getStats(): ConnectionStats | null {
    return this.lastStats ? { ...this.lastStats } : null;
  }

  /** 获取重连次数 */
  getReconnectAttempt(): number {
    return this.reconnectAttempt;
  }

  /** 是否已连接 */
  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  // === 事件注册 ===

  /** 注册连接状态回调 */
  onConnectionStateChange(callback: ConnectionStateCallback): () => void {
    this.stateCallbacks.add(callback);
    return () => this.stateCallbacks.delete(callback);
  }

  /** 注册数据接收回调 */
  onData(callback: DataCallback): () => void {
    this.dataCallbacks.add(callback);
    return () => this.dataCallbacks.delete(callback);
  }

  /** 设置信令发送回调 */
  onSignaling(callback: SignalingSendCallback): void {
    this.signalingCallback = callback;
  }

  // === SDP 协商 ===

  /** 创建 Offer（发起方调用） */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    this.ensureNotDisposed();
    this.initPeerConnection();
    this.createDataChannel();

    const offer = await this.peer!.createOffer();
    await this.peer!.setLocalDescription(offer);

    this.setState('connecting');
    return offer;
  }

  /** 创建 Answer（接收方调用，需先 setRemoteDescription） */
  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    this.ensureNotDisposed();

    if (!this.peer || !this.peer.remoteDescription) {
      throw new Error('Must set remote description before creating answer');
    }

    const answer = await this.peer.createAnswer();
    await this.peer.setLocalDescription(answer);
    return answer;
  }

  /** 设置远端 SDP */
  async setRemoteDescription(sdp: RTCSessionDescriptionInit): Promise<void> {
    this.ensureNotDisposed();
    this.initPeerConnection();
    await this.peer!.setRemoteDescription(new RTCSessionDescription(sdp));
  }

  // === ICE 候选 ===

  /** 添加 ICE 候选 */
  async addICECandidate(candidate: ICECandidate): Promise<void> {
    this.ensureNotDisposed();
    if (!this.peer) {
      throw new Error('Peer connection not initialized');
    }
    await this.peer.addIceCandidate(new RTCIceCandidate({
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex,
    }));
  }

  // === 数据传输 ===

  /** 通过 DataChannel 发送数据 */
  send(data: string): void {
    this.ensureNotDisposed();
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('DataChannel is not open');
    }
    this.dataChannel.send(data);
  }

  // === 信令处理 ===

  /** 处理收到的信令消息 */
  async handleSignalingMessage(message: SignalingMessage): Promise<void> {
    switch (message.type) {
      case 'offer':
        if (message.sdp) {
          await this.setRemoteDescription(message.sdp);
          const answer = await this.createAnswer();
          this.sendSignaling({
            type: 'answer',
            senderId: this.localPeerId,
            receiverId: message.senderId,
            sdp: answer,
            timestamp: Date.now(),
          });
        }
        break;
      case 'answer':
        if (message.sdp) {
          await this.setRemoteDescription(message.sdp);
        }
        break;
      case 'ice-candidate':
        if (message.candidate) {
          await this.addICECandidate(message.candidate);
        }
        break;
    }
  }

  // === 销毁 ===

  /** 清理资源 */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.clearReconnectTimer();
    this.stopStatsMonitor();
    this.closeDataChannel();
    this.closePeerConnection();
    this.stateCallbacks.clear();
    this.dataCallbacks.clear();
    this.signalingCallback = null;
  }

  // === 内部方法 ===

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('WebRTCPeerConnection has been disposed');
    }
  }

  private setState(state: WebRTCConnectionState, detail?: string): void {
    this.connectionState = state;
    for (const cb of this.stateCallbacks) {
      try {
        cb(state, detail);
      } catch {
        /* ignore callback errors */
      }
    }
  }

  private initPeerConnection(): void {
    if (this.peer) return;

    const iceServers = buildIceServers(this.config.iceServers, this.config.turnConfig);
    this.peer = new RTCPeerConnection({ iceServers });

    this.peer.onicecandidate = (event) => {
      if (event.candidate && this.signalingCallback) {
        this.sendSignaling({
          type: 'ice-candidate',
          senderId: this.localPeerId,
          receiverId: '',
          candidate: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid ?? '',
            sdpMLineIndex: event.candidate.sdpMLineIndex ?? 0,
          },
          timestamp: Date.now(),
        });
      }
    };

    this.peer.onconnectionstatechange = () => {
      const state = this.peer?.connectionState;
      if (state === 'connected') {
        this.reconnectAttempt = 0;
        this.setState('connected');
        this.startStatsMonitor();
      } else if (state === 'disconnected') {
        this.setState('disconnected', 'Peer disconnected');
        this.tryReconnect();
      } else if (state === 'failed') {
        this.setState('failed', 'Connection failed');
        this.tryReconnect();
      } else if (state === 'connecting') {
        this.setState('connecting');
      }
    };

    this.peer.ondatachannel = (event) => {
      this.setupDataChannel(event.channel);
    };
  }

  private createDataChannel(): void {
    if (!this.peer || this.dataChannel) return;
    const channel = this.peer.createDataChannel(this.config.dataChannelLabel, {
      ordered: true,
    });
    this.setupDataChannel(channel);
  }

  private setupDataChannel(channel: RTCDataChannel): void {
    this.dataChannel = channel;

    channel.onopen = () => {
      this.setState('connected');
    };

    channel.onclose = () => {
      this.setState('disconnected', 'DataChannel closed');
    };

    channel.onmessage = (event) => {
      if (typeof event.data === 'string') {
        for (const cb of this.dataCallbacks) {
          try {
            cb(event.data);
          } catch {
            /* ignore callback errors */
          }
        }
      }
    };

    channel.onerror = (event) => {
      this.setState('disconnected', `DataChannel error: ${event}`);
    };
  }

  private closeDataChannel(): void {
    if (this.dataChannel) {
      this.dataChannel.onopen = null;
      this.dataChannel.onclose = null;
      this.dataChannel.onmessage = null;
      this.dataChannel.onerror = null;
      this.dataChannel.close();
      this.dataChannel = null;
    }
  }

  private closePeerConnection(): void {
    if (this.peer) {
      this.peer.onicecandidate = null;
      this.peer.onconnectionstatechange = null;
      this.peer.ondatachannel = null;
      this.peer.close();
      this.peer = null;
    }
  }

  private sendSignaling(message: SignalingMessage): void {
    try {
      this.signalingCallback?.(message);
    } catch {
      /* ignore signaling send errors */
    }
  }

  // === 重连 ===

  private tryReconnect(): void {
    if (!this.config.reconnectEnabled) return;
    if (this.reconnectAttempt >= this.config.maxReconnectAttempts) {
      this.setState('failed', `Reconnect failed after ${this.config.maxReconnectAttempts} attempts`);
      return;
    }

    const delay = computeBackoffDelay(
      this.reconnectAttempt,
      this.config.initialReconnectDelayMs,
      this.config.maxReconnectDelayMs,
    );
    this.reconnectAttempt++;

    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      if (this.disposed) return;
      this.closeDataChannel();
      this.closePeerConnection();
      this.setState('connecting', `Reconnect attempt ${this.reconnectAttempt}`);
      this.createOffer().catch(() => {
        this.setState('disconnected', 'Reconnect offer failed');
      });
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // === 统计 ===

  private startStatsMonitor(): void {
    this.stopStatsMonitor();
    this.statsInterval = setInterval(async () => {
      if (!this.peer) return;
      try {
        const stats = await this.peer.getStats();
        let bytesSent = 0;
        let bytesReceived = 0;
        let roundTripTime = 0;

        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            bytesSent = report.bytesSent ?? 0;
            bytesReceived = report.bytesReceived ?? 0;
            roundTripTime = report.currentRoundTripTime ?? 0;
          }
        });

        this.lastStats = {
          bytesSent,
          bytesReceived,
          roundTripTime,
          connectionState: this.connectionState,
          timestamp: Date.now(),
        };
      } catch {
        /* stats not available */
      }
    }, 5000);
  }

  private stopStatsMonitor(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }
}

// ==================== 信令通道 ====================

/**
 * WebRTC 信令通道
 *
 * 基于消息传递的信令通道，负责 SDP 和 ICE 候选的转发。
 * 可对接 WebSocket、HTTP 或其他传输层。
 */
export class WebRTCSignalingChannel {
  private peerConnections: Map<string, WebRTCPeerConnection> = new Map();
  private sendCallback: ((message: SignalingMessage) => void) | null = null;
  private localPeerId: string;
  private messageHandlers: Set<(message: SignalingMessage) => void> = new Set();

  constructor(localPeerId: string) {
    this.localPeerId = localPeerId;
  }

  /** 获取本地 Peer ID */
  getLocalPeerId(): string {
    return this.localPeerId;
  }

  /** 获取已注册的 Peer 数量 */
  getPeerCount(): number {
    return this.peerConnections.size;
  }

  /** 注册底层发送回调（对接实际传输层） */
  onSend(callback: (message: SignalingMessage) => void): void {
    this.sendCallback = callback;
  }

  /** 注册消息处理器 */
  onMessage(handler: (message: SignalingMessage) => void): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /** 注册 Peer 连接 */
  registerPeer(peerId: string, connection: WebRTCPeerConnection): void {
    this.peerConnections.set(peerId, connection);
    connection.onSignaling((msg) => this.sendMessage({ ...msg, receiverId: peerId }));
  }

  /** 注销 Peer 连接 */
  unregisterPeer(peerId: string): void {
    this.peerConnections.delete(peerId);
  }

  /** 处理收到的 Offer */
  async handleOffer(message: SignalingMessage): Promise<void> {
    const connection = this.peerConnections.get(message.senderId);
    if (connection) {
      await connection.handleSignalingMessage(message);
    }
    this.notifyHandlers(message);
  }

  /** 处理收到的 Answer */
  async handleAnswer(message: SignalingMessage): Promise<void> {
    const connection = this.peerConnections.get(message.senderId);
    if (connection) {
      await connection.handleSignalingMessage(message);
    }
    this.notifyHandlers(message);
  }

  /** 处理收到的 ICE 候选 */
  async handleICECandidate(message: SignalingMessage): Promise<void> {
    const connection = this.peerConnections.get(message.senderId);
    if (connection) {
      await connection.handleSignalingMessage(message);
    }
    this.notifyHandlers(message);
  }

  /** 分发收到的信令消息 */
  async dispatch(message: SignalingMessage): Promise<void> {
    switch (message.type) {
      case 'offer':
        await this.handleOffer(message);
        break;
      case 'answer':
        await this.handleAnswer(message);
        break;
      case 'ice-candidate':
        await this.handleICECandidate(message);
        break;
    }
  }

  /** 清理 */
  dispose(): void {
    this.peerConnections.clear();
    this.messageHandlers.clear();
    this.sendCallback = null;
  }

  private sendMessage(message: SignalingMessage): void {
    try {
      this.sendCallback?.(message);
    } catch {
      /* ignore send errors */
    }
  }

  private notifyHandlers(message: SignalingMessage): void {
    for (const handler of this.messageHandlers) {
      try {
        handler(message);
      } catch {
        /* ignore handler errors */
      }
    }
  }
}
