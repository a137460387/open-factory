/**
 * WebSocket 协作传输层测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createDefaultWSTransportConfig,
  validateWSTransportConfig,
  buildCollabMessage,
  serializeCollabMessage,
  parseCollabMessage,
  isValidCollabMessageType,
  computeBackoffDelay,
  MockWSAdapter,
  CollabWSTransport,
} from '../../src/collaboration/ws-transport';
import type { CollabMessage, WSTransportConfig } from '../../src/collaboration/ws-transport';
import { createColorCollabOperation } from '../../src/collaboration/color-collaboration';

describe('WebSocket 协作传输层', () => {
  describe('配置', () => {
    it('createDefaultWSTransportConfig 应设置正确默认值', () => {
      const config = createDefaultWSTransportConfig('sess-1', 'user-1', 'Alice', 'editor');
      expect(config.sessionId).toBe('sess-1');
      expect(config.userId).toBe('user-1');
      expect(config.userName).toBe('Alice');
      expect(config.role).toBe('editor');
      expect(config.heartbeatIntervalMs).toBe(15000);
      expect(config.maxReconnectAttempts).toBe(10);
      expect(config.autoReconnect).toBe(true);
    });

    it('validateWSTransportConfig 应限制心跳间隔', () => {
      const config = validateWSTransportConfig({
        ...createDefaultWSTransportConfig('s', 'u', 'n'),
        heartbeatIntervalMs: 100,
      });
      expect(config.heartbeatIntervalMs).toBe(5000);
    });

    it('validateWSTransportConfig 应限制最大重连次数', () => {
      const config = validateWSTransportConfig({
        ...createDefaultWSTransportConfig('s', 'u', 'n'),
        maxReconnectAttempts: 500,
      });
      expect(config.maxReconnectAttempts).toBe(100);
    });

    it('validateWSTransportConfig 应拒绝空 serverUrl', () => {
      const config = validateWSTransportConfig({
        ...createDefaultWSTransportConfig('s', 'u', 'n'),
        serverUrl: '',
      });
      expect(config.serverUrl).toBe('ws://localhost:8765');
    });
  });

  describe('消息构建', () => {
    it('buildCollabMessage 应包含所有必要字段', () => {
      const msg = buildCollabMessage('operation', 'sess-1', 'user-1', { data: 'test' }, 42);
      expect(msg.type).toBe('operation');
      expect(msg.sessionId).toBe('sess-1');
      expect(msg.userId).toBe('user-1');
      expect(msg.payload).toEqual({ data: 'test' });
      expect(msg.sequenceId).toBe(42);
      expect(msg.timestamp).toBeGreaterThan(0);
    });
  });

  describe('消息序列化', () => {
    it('应能序列化和反序列化消息', () => {
      const msg = buildCollabMessage('join', 'sess-1', 'user-1', { name: 'Alice' }, 1);
      const json = serializeCollabMessage(msg);
      const parsed = parseCollabMessage(json);
      expect(parsed).not.toBeNull();
      expect(parsed!.type).toBe('join');
      expect(parsed!.sessionId).toBe('sess-1');
      expect(parsed!.userId).toBe('user-1');
      expect(parsed!.payload).toEqual({ name: 'Alice' });
    });

    it('无效 JSON 应返回 null', () => {
      expect(parseCollabMessage('invalid')).toBeNull();
    });

    it('缺少必要字段应返回 null', () => {
      expect(parseCollabMessage('{}')).toBeNull();
      expect(parseCollabMessage('{"type":"join"}')).toBeNull();
    });
  });

  describe('消息类型验证', () => {
    it('应接受所有有效类型', () => {
      const types = [
        'join', 'leave', 'operation', 'cursor-update', 'state-sync',
        'heartbeat', 'heartbeat-ack', 'comment', 'lock-request',
        'lock-grant', 'lock-release', 'error', 'snapshot-request', 'snapshot-response',
      ];
      for (const type of types) {
        expect(isValidCollabMessageType(type)).toBe(true);
      }
    });

    it('应拒绝无效类型', () => {
      expect(isValidCollabMessageType('invalid')).toBe(false);
      expect(isValidCollabMessageType('')).toBe(false);
    });
  });

  describe('指数退避', () => {
    it('应递增延迟', () => {
      const d0 = computeBackoffDelay(0, 1000, 30000);
      const d1 = computeBackoffDelay(1, 1000, 30000);
      const d2 = computeBackoffDelay(2, 1000, 30000);
      // 基础值递增（减去随机抖动后）
      expect(d0).toBeLessThan(d1 + 200);
      expect(d1).toBeLessThan(d2 + 200);
    });

    it('不应超过最大延迟', () => {
      const d = computeBackoffDelay(100, 1000, 30000);
      expect(d).toBeLessThan(31500); // max + 抖动
    });
  });

  describe('MockWSAdapter', () => {
    it('初始状态应为 CLOSED', () => {
      const adapter = new MockWSAdapter();
      expect(adapter.readyState).toBe(3);
    });

    it('connect 应触发 onOpen', async () => {
      const adapter = new MockWSAdapter();
      let opened = false;
      adapter.onOpen(() => { opened = true; });
      adapter.connect('ws://test');
      expect(adapter.readyState).toBe(0); // CONNECTING
      await new Promise((r) => setTimeout(r, 20));
      expect(opened).toBe(true);
      expect(adapter.readyState).toBe(1); // OPEN
    });

    it('send 应记录消息', async () => {
      const adapter = new MockWSAdapter();
      adapter.connect('ws://test');
      await new Promise((r) => setTimeout(r, 20));
      adapter.send('test-message');
      expect(adapter.getSentMessages()).toEqual(['test-message']);
    });

    it('模拟消息入站', async () => {
      const adapter = new MockWSAdapter();
      const received: string[] = [];
      adapter.onMessage((data) => received.push(data));
      adapter.connect('ws://test');
      await new Promise((r) => setTimeout(r, 20));
      adapter.simulateIncoming('server-message');
      expect(received).toEqual(['server-message']);
    });

    it('模拟连接关闭', async () => {
      const adapter = new MockWSAdapter();
      let closed = false;
      adapter.onClose(() => { closed = true; });
      adapter.connect('ws://test');
      await new Promise((r) => setTimeout(r, 20));
      adapter.simulateClose(1006, 'abnormal');
      expect(closed).toBe(true);
      expect(adapter.readyState).toBe(3);
    });

    it('close 应触发 onClose', async () => {
      const adapter = new MockWSAdapter();
      let closed = false;
      adapter.onClose(() => { closed = true; });
      adapter.connect('ws://test');
      await new Promise((r) => setTimeout(r, 20));
      adapter.close();
      expect(closed).toBe(true);
    });

    it('未连接时 send 不应发送', () => {
      const adapter = new MockWSAdapter();
      adapter.send('test');
      expect(adapter.getSentMessages()).toHaveLength(0);
    });

    it('连接前的消息应排队，连接后发送', async () => {
      const adapter = new MockWSAdapter();
      const received: string[] = [];
      adapter.onMessage((data) => received.push(data));
      // 连接前模拟入站
      adapter.simulateIncoming('queued-msg');
      adapter.connect('ws://test');
      await new Promise((r) => setTimeout(r, 20));
      expect(received).toEqual(['queued-msg']);
    });
  });

  describe('CollabWSTransport', () => {
    let adapter: MockWSAdapter;
    let transport: CollabWSTransport;

    beforeEach(() => {
      adapter = new MockWSAdapter();
      const config = createDefaultWSTransportConfig('sess-1', 'user-1', 'Alice');
      transport = new CollabWSTransport(config, adapter);
    });

    it('应能创建实例', () => {
      expect(transport.getState()).toBe('disconnected');
    });

    it('connect 应触发状态变更', async () => {
      const states: string[] = [];
      transport.onEvent((e) => {
        if (e.type === 'state-change') states.push(e.state);
      });
      transport.connect();
      await new Promise((r) => setTimeout(r, 30));
      expect(states).toContain('connecting');
      expect(states).toContain('connected');
    });

    it('连接后应发送 join 消息', async () => {
      transport.connect();
      await new Promise((r) => setTimeout(r, 30));
      const joinMsg = adapter.getSentMessages().map(parseCollabMessage).find((m) => m?.type === 'join');
      expect(joinMsg).not.toBeNull();
      expect(joinMsg!.userId).toBe('user-1');
    });

    it('disconnect 应设置 disconnected 状态', async () => {
      transport.connect();
      await new Promise((r) => setTimeout(r, 30));
      transport.disconnect();
      expect(transport.getState()).toBe('disconnected');
    });

    it('sendOperation 应通过 adapter 发送', async () => {
      transport.connect();
      await new Promise((r) => setTimeout(r, 30));
      const op = createColorCollabOperation('wheel-adjust', 'user-1', 'n1', 'lift.r', 0, 0.5, 0);
      transport.sendOperation(op);
      const opMsg = adapter.getSentMessages().map(parseCollabMessage).find((m) => m?.type === 'operation');
      expect(opMsg).not.toBeNull();
      expect((opMsg!.payload as { id: string }).id).toBe(op.id);
    });

    it('sendCursorUpdate 应发送光标位置', async () => {
      transport.connect();
      await new Promise((r) => setTimeout(r, 30));
      transport.sendCursorUpdate('node-1', 'lift.r');
      const cursorMsg = adapter.getSentMessages().map(parseCollabMessage).find((m) => m?.type === 'cursor-update');
      expect(cursorMsg).not.toBeNull();
      expect(cursorMsg!.payload).toEqual({ nodeId: 'node-1', parameter: 'lift.r' });
    });

    it('sendComment 应发送评论', async () => {
      transport.connect();
      await new Promise((r) => setTimeout(r, 30));
      transport.sendComment('node-1', '颜色偏暖');
      const commentMsg = adapter.getSentMessages().map(parseCollabMessage).find((m) => m?.type === 'comment');
      expect(commentMsg).not.toBeNull();
      expect(commentMsg!.payload).toEqual({ nodeId: 'node-1', text: '颜色偏暖' });
    });

    it('requestLock/releaseLock 应发送对应消息', async () => {
      transport.connect();
      await new Promise((r) => setTimeout(r, 30));
      transport.requestLock();
      transport.releaseLock();
      const msgs = adapter.getSentMessages().map(parseCollabMessage);
      expect(msgs.some((m) => m?.type === 'lock-request')).toBe(true);
      expect(msgs.some((m) => m?.type === 'lock-release')).toBe(true);
    });

    it('离线时操作应排队', () => {
      const op = createColorCollabOperation('wheel-adjust', 'user-1', 'n1', 'lift.r', 0, 0.5, 0);
      transport.sendOperation(op);
      expect(transport.getQueueSize()).toBe(1);
      // 没有通过 adapter 发送
      expect(adapter.getSentMessages()).toHaveLength(0);
    });

    it('连接后应刷新队列', async () => {
      const op = createColorCollabOperation('wheel-adjust', 'user-1', 'n1', 'lift.r', 0, 0.5, 0);
      transport.sendOperation(op);
      expect(transport.getQueueSize()).toBe(1);
      transport.connect();
      await new Promise((r) => setTimeout(r, 30));
      expect(transport.getQueueSize()).toBe(0);
      // join + operation
      const opMsgs = adapter.getSentMessages().map(parseCollabMessage).filter((m) => m?.type === 'operation');
      expect(opMsgs).toHaveLength(1);
    });

    it('收到 operation 消息应提交到管理器', async () => {
      transport.connect();
      await new Promise((r) => setTimeout(r, 30));
      // 模拟另一个用户的操作
      const remoteOp = createColorCollabOperation('slider-adjust', 'user-2', 'n2', 'temperature', 0, 10, 0);
      const opMsg = buildCollabMessage('operation', 'sess-1', 'user-2', remoteOp, 1);
      adapter.simulateIncoming(serializeCollabMessage(opMsg));
      // 操作应被记录
      const events: string[] = [];
      transport.onEvent((e) => {
        if (e.type === 'operation') events.push(e.operation.id);
      });
      // 再次模拟
      const remoteOp2 = createColorCollabOperation('slider-adjust', 'user-2', 'n2', 'contrast', 0, 20, 1);
      const opMsg2 = buildCollabMessage('operation', 'sess-1', 'user-2', remoteOp2, 2);
      adapter.simulateIncoming(serializeCollabMessage(opMsg2));
      expect(events).toContain(remoteOp2.id);
    });

    it('收到 join 消息应添加用户', async () => {
      transport.connect();
      await new Promise((r) => setTimeout(r, 30));
      const joinMsg = buildCollabMessage('join', 'sess-1', 'user-2', {
        user: { userId: 'user-2', userName: 'Bob', role: 'editor', color: '#f59e0b', isOnline: true, lastSeen: Date.now() },
      }, 1);
      adapter.simulateIncoming(serializeCollabMessage(joinMsg));
      const users = transport.getManager().getState().users;
      expect(users.some((u) => u.userId === 'user-2')).toBe(true);
    });

    it('收到 leave 消息应移除用户', async () => {
      transport.connect();
      await new Promise((r) => setTimeout(r, 30));
      // 先加入
      const joinMsg = buildCollabMessage('join', 'sess-1', 'user-2', {
        user: { userId: 'user-2', userName: 'Bob', role: 'editor', color: '#f59e0b', isOnline: true, lastSeen: Date.now() },
      }, 1);
      adapter.simulateIncoming(serializeCollabMessage(joinMsg));
      // 再离开
      const leaveMsg = buildCollabMessage('leave', 'sess-1', 'user-2', {}, 2);
      adapter.simulateIncoming(serializeCollabMessage(leaveMsg));
      expect(transport.getManager().getState().users.some((u) => u.userId === 'user-2')).toBe(false);
    });

    it('收到 heartbeat 应回复 heartbeat-ack', async () => {
      transport.connect();
      await new Promise((r) => setTimeout(r, 30));
      const heartbeat = buildCollabMessage('heartbeat', 'sess-1', 'server', {}, 1);
      adapter.simulateIncoming(serializeCollabMessage(heartbeat));
      const ackMsg = adapter.getSentMessages().map(parseCollabMessage).find((m) => m?.type === 'heartbeat-ack');
      expect(ackMsg).not.toBeNull();
    });

    it('收到 snapshot-request 应回复快照', async () => {
      transport.connect();
      await new Promise((r) => setTimeout(r, 30));
      const req = buildCollabMessage('snapshot-request', 'sess-1', 'user-2', {}, 1);
      adapter.simulateIncoming(serializeCollabMessage(req));
      const snapMsg = adapter.getSentMessages().map(parseCollabMessage).find((m) => m?.type === 'snapshot-response');
      expect(snapMsg).not.toBeNull();
      expect((snapMsg!.payload as { snapshot: string }).snapshot).toBeTruthy();
    });

    it('dispose 应清理资源', async () => {
      transport.connect();
      await new Promise((r) => setTimeout(r, 30));
      transport.dispose();
      expect(transport.getState()).toBe('disconnected');
    });

    it('事件处理器应能取消注册', async () => {
      const events: string[] = [];
      const unsub = transport.onEvent((e) => events.push(e.type));
      transport.connect();
      await new Promise((r) => setTimeout(r, 30));
      const countBeforeUnsub = events.length;
      unsub();
      transport.disconnect();
      await new Promise((r) => setTimeout(r, 30));
      // 取消注册后不应有新事件
      expect(events.length).toBe(countBeforeUnsub);
    });

    it('连接关闭后应触发重连', async () => {
      const events: string[] = [];
      transport.onEvent((e) => {
        if (e.type === 'state-change') events.push(e.state);
      });
      transport.connect();
      await new Promise((r) => setTimeout(r, 30));
      // 模拟异常关闭
      adapter.simulateClose(1006, 'abnormal');
      await new Promise((r) => setTimeout(r, 100));
      expect(events).toContain('reconnecting');
    });

    it('正常断开不应重连', async () => {
      const events: string[] = [];
      transport.onEvent((e) => {
        if (e.type === 'state-change') events.push(e.state);
      });
      transport.connect();
      await new Promise((r) => setTimeout(r, 30));
      adapter.simulateClose(1000, 'normal');
      await new Promise((r) => setTimeout(r, 100));
      expect(events).not.toContain('reconnecting');
    });
  });
});
