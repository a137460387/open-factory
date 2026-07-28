// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubGlobal('__DEV_PERF_MONITOR__', true);

import {
  trackRender,
  getRenderCounts,
  resetRenderCounts,
  logStoreSubscription,
  getSubscriptionLog,
  clearSubscriptionLog,
} from './usePerfMonitor';

describe('usePerfMonitor - render tracking', () => {
  beforeEach(() => {
    resetRenderCounts();
  });

  it('trackRender increments count for named component', () => {
    const count1 = trackRender('TestComponent');
    expect(count1).toBe(1);
    const count2 = trackRender('TestComponent');
    expect(count2).toBe(2);
    const count3 = trackRender('TestComponent');
    expect(count3).toBe(3);
  });

  it('trackRender tracks different components independently', () => {
    trackRender('CompA');
    trackRender('CompA');
    trackRender('CompB');
    const counts = getRenderCounts();
    expect(counts.get('CompA')).toBe(2);
    expect(counts.get('CompB')).toBe(1);
  });

  it('resetRenderCounts clears all counts', () => {
    trackRender('CompA');
    trackRender('CompB');
    resetRenderCounts();
    const counts = getRenderCounts();
    expect(counts.size).toBe(0);
  });

  it('trackRender returns 0 when __DEV_PERF_MONITOR__ is false', () => {
    vi.stubGlobal('__DEV_PERF_MONITOR__', false);
    const count = trackRender('OffTest');
    expect(count).toBe(0);
    vi.stubGlobal('__DEV_PERF_MONITOR__', true);
  });
});

describe('usePerfMonitor - store subscriptions', () => {
  beforeEach(() => {
    clearSubscriptionLog();
  });

  it('logStoreSubscription records events', () => {
    logStoreSubscription('editorStore', 'selectedClipId');
    logStoreSubscription('editorUIStore', 'showTimeline');
    const log = getSubscriptionLog();
    expect(log).toHaveLength(2);
    expect(log[0].store).toBe('editorStore');
    expect(log[0].field).toBe('selectedClipId');
    expect(log[1].store).toBe('editorUIStore');
  });

  it('clearSubscriptionLog empties the log', () => {
    logStoreSubscription('editorStore', 'dirty');
    clearSubscriptionLog();
    expect(getSubscriptionLog()).toHaveLength(0);
  });

  it('subscription log caps at 200 entries', () => {
    for (let i = 0; i < 250; i++) {
      logStoreSubscription('store', `field${i}`);
    }
    const log = getSubscriptionLog();
    expect(log.length).toBeLessThanOrEqual(200);
    expect(log[log.length - 1].field).toBe('field249');
  });

  it('logStoreSubscription no-op when __DEV_PERF_MONITOR__ is false', () => {
    clearSubscriptionLog();
    vi.stubGlobal('__DEV_PERF_MONITOR__', false);
    logStoreSubscription('store', 'field');
    expect(getSubscriptionLog()).toHaveLength(0);
    vi.stubGlobal('__DEV_PERF_MONITOR__', true);
  });
});
