/**
 * WebRTC 连接优化模块
 *
 * P2P DataChannel 传输 CRDT 操作数据，支持 SDP 协商、ICE 交换、
 * TURN 中继、自动指数退避重连和连接统计监控。
 */

import { computeBackoffDelay } from './ws-transport';

// ==================== 类型定义 ====================

export type WebRTCConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed';

export interface ICECandidate {
  candidate: string;
  sdpMid: string;
  sdpMLineIndex: number;
}

export interface TURNConfig {
  urls: string;
  username: string;
  credential: string;
}

export interface WebRTCConnectionConfig {
  iceServers: RTCIceServer[];
  turnConfig: TURNConfig | null;
  reconnectEnabled: boolean;
  maxReconnectAttempts: number;
  initialReconnectDelayMs: number;
  maxReconnectDelayMs: number;
  dataChannelLabel: string;
}

export interface ConnectionStats {
  bytesSent: number;
  bytesReceived: number;
  roundTripTime: number;
  connectionState: WebRTCConnectionState;
  timestamp: number;
}

export type SignalingMessageType = 'offer' | 'answer' | 'ice-candidate';

export interface SignalingMessage {
  type: SignalingMessageType;
  senderId: string;
  receiverId: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: ICECandidate;
  timestamp: number;
}

export type ConnectionStateCallback = (state: WebRTCConnectionState, detail?: string) => void;
export type DataCallback = (data: string) => void;
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

function buildIceServers(base: RTCIceServer[], turn: TURNConfig | null): RTCIceServer[] {
  const servers = [...base];
  if (turn) {
    servers.push({ urls: turn.urls, username: turn.username, credential: turn.credential });
  }
  return servers;
}

// ==================== 工厂函数 ====================

/** 创建默认 TURN 配置 */
export function createDefaultTURNConfig(urls: string, username: string, credential: string): TURNConfig {
  return { urls, username, credential };
}

/** 创建默认 WebRTC 连接配置 */
export function createDefaultWebRTCConfig(overrides?: Partial<WebRTCConnectionConfig>): WebRTCConnectionConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

// ==================== WebRTCPeerConnection ====================

/**
 * WebRTC 对等连接管理
 *
 * 封装 RTCPeerConnection，提供 SDP 协商、ICE 交换、
 * DataChannel 数据传输和自动指数退避重连。
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

  getState(): WebRTCConnectionState { return this.connectionState; }
  getStats(): ConnectionStats | null { return this.lastStats ? { ...this.lastStats } : null; }
  getReconnectAttempt(): number { return this.reconnectAttempt; }
  isConnected(): boolean { return this.connectionState === 'connected'; }

  onConnectionStateChange(callback: ConnectionStateCallback): () => void {
    this.stateCallbacks.add(callback);
    return () => this.stateCallbacks.delete(callback);
  }

  onData(callback: DataCallback): () => void {
    this.dataCallbacks.add(callback);
    return () => this.dataCallbacks.delete(callback);
  }

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
    if (!this.peer?.remoteDescription) {
      throw new Error('Must set remote description before creating answer');
    }
    const answer = await this.peer.createAnswer();
    await this.peer.setLocalDescription(answer);
    return answer;
  }

  async setRemoteDescription(sdp: RTCSessionDescriptionInit): Promise<void> {
    this.ensureNotDisposed();
    this.initPeerConnection();
    await this.peer!.setRemoteDescription(new RTCSessionDescription(sdp));
  }

  async addICECandidate(candidate: ICECandidate): Promise<void> {
    this.ensureNotDisposed();
    if (!this.peer) throw new Error('Peer connection not initialized');
    await this.peer.addIceCandidate(new RTCIceCandidate({
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex,
    }));
  }

  /** 通过 DataChannel 发送数据 */
  send(data: string): void {
    this.ensureNotDisposed();
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('DataChannel is not open');
    }
    this.dataChannel.send(data);
  }

  /** 处理收到的信令消息 */
  async handleSignalingMessage(message: SignalingMessage): Promise<void> {
    switch (message.type) {
      case 'offer':
        if (message.sdp) {
          await this.setRemoteDescription(message.sdp);
          const answer = await this.createAnswer();
          this.emitSignaling({ type: 'answer', senderId: this.localPeerId, receiverId: message.senderId, sdp: answer, timestamp: Date.now() });
        }
        break;
      case 'answer':
        if (message.sdp) await this.setRemoteDescription(message.sdp);
        break;
      case 'ice-candidate':
        if (message.candidate) await this.addICECandidate(message.candidate);
        break;
    }
  }

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

  // === 内部 ===

  private ensureNotDisposed(): void {
    if (this.disposed) throw new Error('WebRTCPeerConnection has been disposed');
  }

  private setState(state: WebRTCConnectionState, detail?: string): void {
    this.connectionState = state;
    for (const cb of this.stateCallbacks) {
      try { cb(state, detail); } catch { /* ignore */ }
    }
  }

  private emitSignaling(message: SignalingMessage): void {
    try { this.signalingCallback?.(message); } catch { /* ignore */ }
  }

  private initPeerConnection(): void {
    if (this.peer) return;
    const iceServers = buildIceServers(this.config.iceServers, this.config.turnConfig);
    this.peer = new RTCPeerConnection({ iceServers });

    this.peer.onicecandidate = (event) => {
      if (event.candidate && this.signalingCallback) {
        this.emitSignaling({
          type: 'ice-candidate',
          senderId: this.localPeerId,
          receiverId: '',
          candidate: { candidate: event.candidate.candidate, sdpMid: event.candidate.sdpMid ?? '', sdpMLineIndex: event.candidate.sdpMLineIndex ?? 0 },
          timestamp: Date.now(),
        });
      }
    };

    this.peer.onconnectionstatechange = () => {
      const s = this.peer?.connectionState;
      if (s === 'connected') { this.reconnectAttempt = 0; this.setState('connected'); this.startStatsMonitor(); }
      else if (s === 'disconnected') { this.setState('disconnected', 'Peer disconnected'); this.tryReconnect(); }
      else if (s === 'failed') { this.setState('failed', 'Connection failed'); this.tryReconnect(); }
      else if (s === 'connecting') { this.setState('connecting'); }
    };

    this.peer.ondatachannel = (event) => this.setupDataChannel(event.channel);
  }

  private createDataChannel(): void {
    if (!this.peer || this.dataChannel) return;
    this.setupDataChannel(this.peer.createDataChannel(this.config.dataChannelLabel, { ordered: true }));
  }

  private setupDataChannel(channel: RTCDataChannel): void {
    this.dataChannel = channel;
    channel.onopen = () => this.setState('connected');
    channel.onclose = () => this.setState('disconnected', 'DataChannel closed');
    channel.onmessage = (event) => {
      if (typeof event.data === 'string') {
        for (const cb of this.dataCallbacks) {
          try { cb(event.data); } catch { /* ignore */ }
        }
      }
    };
    channel.onerror = () => this.setState('disconnected', 'DataChannel error');
  }

  private closeDataChannel(): void {
    if (!this.dataChannel) return;
    this.dataChannel.onopen = null;
    this.dataChannel.onclose = null;
    this.dataChannel.onmessage = null;
    this.dataChannel.onerror = null;
    this.dataChannel.close();
    this.dataChannel = null;
  }

  private closePeerConnection(): void {
    if (!this.peer) return;
    this.peer.onicecandidate = null;
    this.peer.onconnectionstatechange = null;
    this.peer.ondatachannel = null;
    this.peer.close();
    this.peer = null;
  }

  // === 重连（指数退避，与 ws-transport 的 computeBackoffDelay 模式一致） ===

  private tryReconnect(): void {
    if (!this.config.reconnectEnabled) return;
    if (this.reconnectAttempt >= this.config.maxReconnectAttempts) {
      this.setState('failed', `Reconnect failed after ${this.config.maxReconnectAttempts} attempts`);
      return;
    }
    const delay = computeBackoffDelay(this.reconnectAttempt, this.config.initialReconnectDelayMs, this.config.maxReconnectDelayMs);
    this.reconnectAttempt++;
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      if (this.disposed) return;
      this.closeDataChannel();
      this.closePeerConnection();
      this.setState('connecting', `Reconnect attempt ${this.reconnectAttempt}`);
      this.createOffer().catch(() => this.setState('disconnected', 'Reconnect offer failed'));
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
  }

  // === 统计 ===

  private startStatsMonitor(): void {
    this.stopStatsMonitor();
    this.statsInterval = setInterval(async () => {
      if (!this.peer) return;
      try {
        const stats = await this.peer.getStats();
        let bytesSent = 0, bytesReceived = 0, roundTripTime = 0;
        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            bytesSent = report.bytesSent ?? 0;
            bytesReceived = report.bytesReceived ?? 0;
            roundTripTime = report.currentRoundTripTime ?? 0;
          }
        });
        this.lastStats = { bytesSent, bytesReceived, roundTripTime, connectionState: this.connectionState, timestamp: Date.now() };
      } catch { /* stats not available */ }
    }, 5000);
  }

  private stopStatsMonitor(): void {
    if (this.statsInterval) { clearInterval(this.statsInterval); this.statsInterval = null; }
  }
}

// ==================== WebRTCSignalingChannel ====================

/**
 * WebRTC 信令通道
 *
 * 基于消息传递的信令通道，负责 SDP 和 ICE 候选的转发。
 * 可对接 WebSocket、HTTP 或其他传输层。
 */
export class WebRTCSignalingChannel {
  private peerConnections: Map<string, WebRTCPeerConnection> = new Map();
  private sendCallback: ((message: SignalingMessage) => void) | null = null;
  private messageHandlers: Set<(message: SignalingMessage) => void> = new Set();
  private localPeerId: string;

  constructor(localPeerId: string) {
    this.localPeerId = localPeerId;
  }

  getLocalPeerId(): string { return this.localPeerId; }
  getPeerCount(): number { return this.peerConnections.size; }

  /** 注册底层发送回调 */
  onSend(callback: (message: SignalingMessage) => void): void {
    this.sendCallback = callback;
  }

  /** 注册消息处理器 */
  onMessage(handler: (message: SignalingMessage) => void): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  registerPeer(peerId: string, connection: WebRTCPeerConnection): void {
    this.peerConnections.set(peerId, connection);
    connection.onSignaling((msg) => this.send({ ...msg, receiverId: peerId }));
  }

  unregisterPeer(peerId: string): void {
    this.peerConnections.delete(peerId);
  }

  async handleOffer(message: SignalingMessage): Promise<void> {
    await this.peerConnections.get(message.senderId)?.handleSignalingMessage(message);
    this.notifyHandlers(message);
  }

  async handleAnswer(message: SignalingMessage): Promise<void> {
    await this.peerConnections.get(message.senderId)?.handleSignalingMessage(message);
    this.notifyHandlers(message);
  }

  async handleICECandidate(message: SignalingMessage): Promise<void> {
    await this.peerConnections.get(message.senderId)?.handleSignalingMessage(message);
    this.notifyHandlers(message);
  }

  /** 分发收到的信令消息 */
  async dispatch(message: SignalingMessage): Promise<void> {
    switch (message.type) {
      case 'offer': await this.handleOffer(message); break;
      case 'answer': await this.handleAnswer(message); break;
      case 'ice-candidate': await this.handleICECandidate(message); break;
    }
  }

  dispose(): void {
    this.peerConnections.clear();
    this.messageHandlers.clear();
    this.sendCallback = null;
  }

  private send(message: SignalingMessage): void {
    try { this.sendCallback?.(message); } catch { /* ignore */ }
  }

  private notifyHandlers(message: SignalingMessage): void {
    for (const handler of this.messageHandlers) {
      try { handler(message); } catch { /* ignore */ }
    }
  }
}
