import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  WebRTCPeerConnection,
  WebRTCSignalingChannel,
  createDefaultTURNConfig,
  createDefaultWebRTCConfig,
  type WebRTCConnectionState,
  type SignalingMessage,
  type ICECandidate,
} from './webrtc-connection';

// ─── Mocks ────────────────────────────────────────────────────────

function mockRTCPeerConnection() {
  const listeners: Record<string, Function[]> = {};
  const mock = {
    createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'offer-sdp' }),
    createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'answer-sdp' }),
    setLocalDescription: vi.fn().mockResolvedValue(undefined),
    setRemoteDescription: vi.fn().mockResolvedValue(undefined),
    addIceCandidate: vi.fn().mockResolvedValue(undefined),
    createDataChannel: vi.fn().mockReturnValue({
      readyState: 'open',
      send: vi.fn(),
      close: vi.fn(),
      onopen: null as any,
      onclose: null as any,
      onmessage: null as any,
      onerror: null as any,
    }),
    close: vi.fn(),
    getStats: vi.fn().mockResolvedValue(new Map()),
    onicecandidate: null as any,
    onconnectionstatechange: null as any,
    ondatachannel: null as any,
    connectionState: 'new',
    remoteDescription: null as any,
  };
  return mock;
}

function makeSignalingMessage(overrides: Partial<SignalingMessage> = {}): SignalingMessage {
  return {
    type: 'offer',
    senderId: 'remote-peer',
    receiverId: 'local-peer',
    sdp: { type: 'offer', sdp: 'test-sdp' },
    timestamp: Date.now(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────

describe('createDefaultTURNConfig', () => {
  it('creates config with provided values', () => {
    const config = createDefaultTURNConfig('turn:server.com', 'user1', 'pass123');
    expect(config).toEqual({ urls: 'turn:server.com', username: 'user1', credential: 'pass123' });
  });

  it('handles empty strings', () => {
    const config = createDefaultTURNConfig('', '', '');
    expect(config.urls).toBe('');
    expect(config.username).toBe('');
    expect(config.credential).toBe('');
  });

  it('returns a plain object', () => {
    const config = createDefaultTURNConfig('url', 'u', 'c');
    expect(typeof config).toBe('object');
    expect(Object.keys(config)).toHaveLength(3);
  });
});

describe('createDefaultWebRTCConfig', () => {
  it('returns default config without overrides', () => {
    const config = createDefaultWebRTCConfig();
    expect(config.iceServers).toBeDefined();
    expect(config.reconnectEnabled).toBe(true);
    expect(config.maxReconnectAttempts).toBe(10);
  });

  it('merges partial overrides', () => {
    const config = createDefaultWebRTCConfig({ maxReconnectAttempts: 5 });
    expect(config.maxReconnectAttempts).toBe(5);
    expect(config.reconnectEnabled).toBe(true);
  });

  it('allows overriding turn config', () => {
    const turn = createDefaultTURNConfig('turn:x', 'u', 'c');
    const config = createDefaultWebRTCConfig({ turnConfig: turn });
    expect(config.turnConfig).toEqual(turn);
  });
});

describe('WebRTCPeerConnection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('starts in new state', () => {
    const conn = new WebRTCPeerConnection({ localPeerId: 'peer-1' });
    expect(conn.getState()).toBe('new');
    expect(conn.isConnected()).toBe(false);
    expect(conn.getStats()).toBeNull();
  });

  it('registers and unregisters state callbacks', () => {
    const conn = new WebRTCPeerConnection({ localPeerId: 'peer-1' });
    const states: WebRTCConnectionState[] = [];
    const unsub = conn.onConnectionStateChange((s) => states.push(s));
    unsub();
    // no state changes after unsub
    expect(states).toHaveLength(0);
  });

  it('registers data callbacks', () => {
    const conn = new WebRTCPeerConnection({ localPeerId: 'peer-1' });
    const received: string[] = [];
    const unsub = conn.onData((d) => received.push(d));
    unsub();
    expect(received).toHaveLength(0);
  });

  it('throws when sending on disposed connection', () => {
    const conn = new WebRTCPeerConnection({ localPeerId: 'peer-1' });
    conn.dispose();
    expect(() => conn.send('test')).toThrow('disposed');
  });

  it('dispose is idempotent', () => {
    const conn = new WebRTCPeerConnection({ localPeerId: 'peer-1' });
    conn.dispose();
    expect(() => conn.dispose()).not.toThrow();
  });

  it('returns initial reconnect attempt as 0', () => {
    const conn = new WebRTCPeerConnection({ localPeerId: 'peer-1' });
    expect(conn.getReconnectAttempt()).toBe(0);
  });
});

describe('WebRTCSignalingChannel', () => {
  it('stores local peer id', () => {
    const channel = new WebRTCSignalingChannel('peer-1');
    expect(channel.getLocalPeerId()).toBe('peer-1');
  });

  it('tracks registered peer count', () => {
    const channel = new WebRTCSignalingChannel('peer-1');
    expect(channel.getPeerCount()).toBe(0);
    channel.registerPeer('peer-2', { onSignaling: vi.fn() } as any);
    expect(channel.getPeerCount()).toBe(1);
    channel.unregisterPeer('peer-2');
    expect(channel.getPeerCount()).toBe(0);
  });

  it('registers and unregisters message handlers', () => {
    const channel = new WebRTCSignalingChannel('peer-1');
    const messages: SignalingMessage[] = [];
    const unsub = channel.onMessage((msg) => messages.push(msg));
    unsub();
    expect(messages).toHaveLength(0);
  });

  it('dispatches offer messages to handlers', async () => {
    const channel = new WebRTCSignalingChannel('peer-1');
    const messages: SignalingMessage[] = [];
    channel.onMessage((msg) => messages.push(msg));
    const msg = makeSignalingMessage({ type: 'offer' });
    await channel.dispatch(msg);
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe('offer');
  });

  it('dispatches answer messages', async () => {
    const channel = new WebRTCSignalingChannel('peer-1');
    const messages: SignalingMessage[] = [];
    channel.onMessage((msg) => messages.push(msg));
    const msg = makeSignalingMessage({ type: 'answer' });
    await channel.dispatch(msg);
    expect(messages).toHaveLength(1);
  });

  it('dispatches ice-candidate messages', async () => {
    const channel = new WebRTCSignalingChannel('peer-1');
    const messages: SignalingMessage[] = [];
    channel.onMessage((msg) => messages.push(msg));
    const msg = makeSignalingMessage({
      type: 'ice-candidate',
      sdp: undefined,
      candidate: { candidate: 'candidate:1', sdpMid: '0', sdpMLineIndex: 0 },
    });
    await channel.dispatch(msg);
    expect(messages).toHaveLength(1);
  });

  it('dispose clears all state', () => {
    const channel = new WebRTCSignalingChannel('peer-1');
    channel.registerPeer('peer-2', { onSignaling: vi.fn() } as any);
    channel.dispose();
    expect(channel.getPeerCount()).toBe(0);
  });
});
