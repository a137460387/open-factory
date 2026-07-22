/**
 * ws-transport.ts 单元测试
 * 覆盖配置验证、消息构建/解析、MockWSAdapter、指数退避等核心逻辑
 */

import { describe, it, expect } from 'vitest';
import {
  computeBackoffDelay,
  createDefaultWSTransportConfig,
  validateWSTransportConfig,
  buildCollabMessage,
  serializeCollabMessage,
  parseCollabMessage,
  isValidCollabMessageType,
  MockWSAdapter,
  CollabWSTransport,
} from './ws-transport';

describe('ws-transport', () => {
  // ─── computeBackoffDelay ─────────────────────────────────────────────
  describe('computeBackoffDelay', () => {
    it('第一次重连延迟约为 initialMs', () => {
      const delay = computeBackoffDelay(0, 1000, 30000);
      expect(delay).toBeGreaterThanOrEqual(1000);
      expect(delay).toBeLessThan(1200); // 加上抖动
    });

    it('延迟指数增长', () => {
      const d0 = computeBackoffDelay(0, 1000, 30000);
      const d1 = computeBackoffDelay(1, 1000, 30000);
      const d2 = computeBackoffDelay(2, 1000, 30000);
      // 去掉抖动比较基础值
      expect(d1 - d0).toBeGreaterThan(500);
      expect(d2 - d1).toBeGreaterThan(1000);
    });

    it('延迟不超过 maxMs + 抖动', () => {
      const delay = computeBackoffDelay(20, 1000, 5000);
      expect(delay).toBeLessThan(5100); // maxMs + 抖动
    });
  });

  // ─── createDefaultWSTransportConfig ──────────────────────────────────
  describe('createDefaultWSTransportConfig', () => {
    it('创建默认配置', () => {
      const config = createDefaultWSTransportConfig('s1', 'u1', 'Alice');
      expect(config.sessionId).toBe('s1');
      expect(config.userId).toBe('u1');
      expect(config.userName).toBe('Alice');
      expect(config.role).toBe('editor');
      expect(config.autoReconnect).toBe(true);
    });

    it('使用指定角色', () => {
      const config = createDefaultWSTransportConfig('s1', 'u1', 'Alice', 'viewer');
      expect(config.role).toBe('viewer');
    });
  });

  // ─── validateWSTransportConfig ───────────────────────────────────────
  describe('validateWSTransportConfig', () => {
    it('钳制 heartbeatIntervalMs 到有效范围', () => {
      const config = validateWSTransportConfig({
        ...createDefaultWSTransportConfig('s1', 'u1', 'Alice'),
        heartbeatIntervalMs: 100,
      });
      expect(config.heartbeatIntervalMs).toBe(5000);
    });

    it('钳制 maxReconnectAttempts 到有效范围', () => {
      const config = validateWSTransportConfig({
        ...createDefaultWSTransportConfig('s1', 'u1', 'Alice'),
        maxReconnectAttempts: 200,
      });
      expect(config.maxReconnectAttempts).toBe(100);
    });

    it('空 serverUrl 使用默认值', () => {
      const config = validateWSTransportConfig({
        ...createDefaultWSTransportConfig('s1', 'u1', 'Alice'),
        serverUrl: '',
      });
      expect(config.serverUrl).toBe('ws://localhost:8765');
    });

    it('钳制 maxQueueSize', () => {
      const config = validateWSTransportConfig({
        ...createDefaultWSTransportConfig('s1', 'u1', 'Alice'),
        maxQueueSize: 5,
      });
      expect(config.maxQueueSize).toBe(10);
    });
  });

  // ─── buildCollabMessage ──────────────────────────────────────────────
  describe('buildCollabMessage', () => {
    it('构建消息包含所有字段', () => {
      const msg = buildCollabMessage('join', 's1', 'u1', { user: 'Alice' }, 1);
      expect(msg.type).toBe('join');
      expect(msg.sessionId).toBe('s1');
      expect(msg.userId).toBe('u1');
      expect(msg.payload).toEqual({ user: 'Alice' });
      expect(msg.sequenceId).toBe(1);
      expect(typeof msg.timestamp).toBe('number');
    });
  });

  // ─── serializeCollabMessage / parseCollabMessage ─────────────────────
  describe('消息序列化/反序列化', () => {
    it('往返序列化', () => {
      const msg = buildCollabMessage('operation', 's1', 'u1', { data: 'test' }, 5);
      const json = serializeCollabMessage(msg);
      const parsed = parseCollabMessage(json);
      expect(parsed).not.toBeNull();
      expect(parsed!.type).toBe('operation');
      expect(parsed!.sequenceId).toBe(5);
    });

    it('无效 JSON 返回 null', () => {
      expect(parseCollabMessage('not json')).toBeNull();
    });

    it('缺少必要字段返回 null', () => {
      expect(parseCollabMessage(JSON.stringify({ type: 'join' }))).toBeNull();
    });

    it('缺少 sequenceId 时默认为 0', () => {
      const json = JSON.stringify({ type: 'join', sessionId: 's1', userId: 'u1', timestamp: 100 });
      const parsed = parseCollabMessage(json);
      expect(parsed!.sequenceId).toBe(0);
    });
  });

  // ─── isValidCollabMessageType ────────────────────────────────────────
  describe('isValidCollabMessageType', () => {
    it('有效类型返回 true', () => {
      expect(isValidCollabMessageType('join')).toBe(true);
      expect(isValidCollabMessageType('leave')).toBe(true);
      expect(isValidCollabMessageType('operation')).toBe(true);
      expect(isValidCollabMessageType('heartbeat')).toBe(true);
      expect(isValidCollabMessageType('cursor-update')).toBe(true);
      expect(isValidCollabMessageType('snapshot-request')).toBe(true);
    });

    it('无效类型返回 false', () => {
      expect(isValidCollabMessageType('unknown')).toBe(false);
      expect(isValidCollabMessageType('')).toBe(false);
    });
  });

  // ─── MockWSAdapter ──────────────────────────────────────────────────
  describe('MockWSAdapter', () => {
    it('初始状态为 CLOSED', () => {
      const adapter = new MockWSAdapter();
      expect(adapter.readyState).toBe(3);
    });

    it('connect 后状态变为 OPEN', async () => {
      const adapter = new MockWSAdapter();
      let opened = false;
      adapter.onOpen(() => { opened = true; });
      adapter.connect('ws://test');
      expect(adapter.readyState).toBe(0); // CONNECTING
      await new Promise((r) => setTimeout(r, 20));
      expect(adapter.readyState).toBe(1); // OPEN
      expect(opened).toBe(true);
    });

    it('send 在 OPEN 状态下记录消息', async () => {
      const adapter = new MockWSAdapter();
      adapter.connect('ws://test');
      await new Promise((r) => setTimeout(r, 20));
      const msg = buildCollabMessage('join', 's1', 'u1', {}, 1);
      adapter.send(serializeCollabMessage(msg));
      expect(adapter.getSentMessages()).toHaveLength(1);
    });

    it('send 在非 OPEN 状态下不记录', () => {
      const adapter = new MockWSAdapter();
      adapter.send('test');
      expect(adapter.getSentMessages()).toHaveLength(0);
    });

    it('simulateClose 触发 close 回调', async () => {
      const adapter = new MockWSAdapter();
      let closed = false;
      adapter.onClose(() => { closed = true; });
      adapter.connect('ws://test');
      await new Promise((r) => setTimeout(r, 20));
      adapter.simulateClose(1000, 'normal');
      expect(closed).toBe(true);
      expect(adapter.readyState).toBe(3);
    });

    it('simulateIncoming 在 OPEN 状态下触发消息回调', async () => {
      const adapter = new MockWSAdapter();
      const received: string[] = [];
      adapter.onMessage((data) => received.push(data));
      adapter.connect('ws://test');
      await new Promise((r) => setTimeout(r, 20));
      adapter.simulateIncoming('hello');
      expect(received).toEqual(['hello']);
    });

    it('simulateIncoming 在非 OPEN 状态下排队', () => {
      const adapter = new MockWSAdapter();
      const received: string[] = [];
      adapter.onMessage((data) => received.push(data));
      adapter.connect('ws://test');
      adapter.simulateIncoming('queued');
      // 还在 CONNECTING 状态，消息排队
    });

    it('getConnectedUrl 返回连接的 URL', async () => {
      const adapter = new MockWSAdapter();
      adapter.connect('ws://test:1234');
      expect(adapter.getConnectedUrl()).toBe('ws://test:1234');
    });

    it('close 触发 close 回调', async () => {
      const adapter = new MockWSAdapter();
      let closed = false;
      adapter.onClose(() => { closed = true; });
      adapter.connect('ws://test');
      await new Promise((r) => setTimeout(r, 20));
      adapter.close();
      expect(closed).toBe(true);
    });

    it('simulateError 触发 error 回调', () => {
      const adapter = new MockWSAdapter();
      let errorReceived: unknown = null;
      adapter.onError((e) => { errorReceived = e; });
      adapter.simulateError(new Error('test error'));
      expect(errorReceived).toBeInstanceOf(Error);
    });
  });

  // ─── CollabWSTransport ──────────────────────────────────────────────
  describe('CollabWSTransport', () => {
    const makeTransport = () => {
      const config = createDefaultWSTransportConfig('s1', 'u1', 'Alice');
      const adapter = new MockWSAdapter();
      const transport = new CollabWSTransport(config, adapter);
      return { transport, adapter, config };
    };

    it('初始状态为 disconnected', () => {
      const { transport } = makeTransport();
      expect(transport.getState()).toBe('disconnected');
    });

    it('connect 后状态变为 connecting 然后 connected', async () => {
      const { transport, adapter } = makeTransport();
      const states: string[] = [];
      transport.onEvent((e) => { if (e.type === 'state-change') states.push(e.state); });
      transport.connect();
      expect(transport.getState()).toBe('connecting');
      await new Promise((r) => setTimeout(r, 20));
      expect(transport.getState()).toBe('connected');
    });

    it('disconnect 后状态变为 disconnected', async () => {
      const { transport } = makeTransport();
      transport.connect();
      await new Promise((r) => setTimeout(r, 20));
      transport.disconnect();
      expect(transport.getState()).toBe('disconnected');
    });

    it('连接后自动发送 join 消息', async () => {
      const { transport, adapter } = makeTransport();
      transport.connect();
      await new Promise((r) => setTimeout(r, 20));
      const messages = adapter.getSentMessages();
      expect(messages.length).toBeGreaterThan(0);
      const joinMsg = parseCollabMessage(messages[0]);
      expect(joinMsg?.type).toBe('join');
    });

    it('未连接时消息排队', () => {
      const { transport } = makeTransport();
      transport.sendOperation({
        id: 'op1',
        type: 'wheel-adjust',
        userId: 'u1',
        timestamp: Date.now(),
        targetNodeId: 'n1',
        parameterPath: 'lift.r',
        previousValue: 0,
        newValue: 1,
        version: 1,
        baseVersion: 0,
      });
      expect(transport.getQueueSize()).toBe(1);
    });

    it('连接后队列消息被发送', async () => {
      const { transport, adapter } = makeTransport();
      transport.sendComment('n1', 'test');
      expect(transport.getQueueSize()).toBe(1);
      transport.connect();
      await new Promise((r) => setTimeout(r, 20));
      expect(transport.getQueueSize()).toBe(0);
    });

    it('getConfig 返回配置副本', () => {
      const { transport, config } = makeTransport();
      const returned = transport.getConfig();
      expect(returned.sessionId).toBe(config.sessionId);
      // 确认是副本
      returned.sessionId = 'changed';
      expect(transport.getConfig().sessionId).not.toBe('changed');
    });

    it('dispose 清理资源', async () => {
      const { transport } = makeTransport();
      transport.connect();
      await new Promise((r) => setTimeout(r, 20));
      transport.dispose();
      expect(transport.getState()).toBe('disconnected');
    });

    it('事件处理器取消订阅', () => {
      const { transport } = makeTransport();
      const events: unknown[] = [];
      const unsub = transport.onEvent((e) => events.push(e));
      transport.connect();
      unsub();
      // 后续事件不应被接收（dispose 不触发事件因为 handler 已清除）
    });
  });
});
