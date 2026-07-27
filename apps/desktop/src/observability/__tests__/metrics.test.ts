import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetricsCollector } from '../metrics';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector(true, []);
  });

  it('recordMetric sends to all transports', () => {
    const transport = { send: vi.fn() };
    collector.addTransport(transport);
    collector.recordMetric('test.counter', 1, 'counter', { env: 'test' });
    expect(transport.send).toHaveBeenCalledTimes(1);
    expect(transport.send.mock.calls[0][0]).toMatchObject({
      name: 'test.counter',
      type: 'counter',
      value: 1,
      tags: { env: 'test' },
    });
  });

  it('recordMetric does nothing when disabled', () => {
    const disabled = new MetricsCollector(false, []);
    const transport = { send: vi.fn() };
    disabled.addTransport(transport);
    disabled.recordMetric('no', 1);
    expect(transport.send).not.toHaveBeenCalled();
  });

  it('increment records counter with value 1', () => {
    const transport = { send: vi.fn() };
    collector.addTransport(transport);
    collector.increment('clicks', { button: 'submit' });
    expect(transport.send.mock.calls[0][0]).toMatchObject({
      name: 'clicks',
      type: 'counter',
      value: 1,
      tags: { button: 'submit' },
    });
  });

  it('gauge records gauge metric', () => {
    const transport = { send: vi.fn() };
    collector.addTransport(transport);
    collector.gauge('memory.used', 512);
    expect(transport.send.mock.calls[0][0]).toMatchObject({
      name: 'memory.used',
      type: 'gauge',
      value: 512,
    });
  });

  it('histogram records histogram metric', () => {
    const transport = { send: vi.fn() };
    collector.addTransport(transport);
    collector.histogram('request.duration', 150);
    expect(transport.send.mock.calls[0][0]).toMatchObject({
      name: 'request.duration',
      type: 'histogram',
      value: 150,
    });
  });

  it('includes ISO timestamp in entries', () => {
    const transport = { send: vi.fn() };
    collector.addTransport(transport);
    collector.recordMetric('ts', 1);
    const ts = transport.send.mock.calls[0][0].timestamp;
    expect(ts).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it('default type is counter', () => {
    const transport = { send: vi.fn() };
    collector.addTransport(transport);
    collector.recordMetric('default', 5);
    expect(transport.send.mock.calls[0][0].type).toBe('counter');
  });

  it('getBufferedMetrics returns and clears buffer', () => {
    collector.increment('a');
    collector.increment('b');
    const buffered = collector.getBufferedMetrics();
    expect(buffered).toHaveLength(2);
    expect(buffered[0].name).toBe('a');
    expect(buffered[1].name).toBe('b');
    // buffer cleared
    expect(collector.getBufferedMetrics()).toHaveLength(0);
  });
});
