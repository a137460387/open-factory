import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PROXY_CONFIG,
  recommendProxyQuality,
  ProxyFileManager,
  ProxySwitchManager,
  SmartProxyManager,
  createSmartProxyManager,
} from './smart-proxy-manager';

describe('DEFAULT_PROXY_CONFIG', () => {
  it('has expected structure', () => {
    expect(DEFAULT_PROXY_CONFIG).toBeDefined();
    expect(DEFAULT_PROXY_CONFIG.generation).toBeDefined();
    expect(DEFAULT_PROXY_CONFIG.switchStrategy).toBeDefined();
    expect(DEFAULT_PROXY_CONFIG.enabled).toBe(true);
  });
});

describe('recommendProxyQuality', () => {
  it('returns full for ultra', () => {
    expect(recommendProxyQuality({ level: 'ultra' })).toBe('full');
  });

  it('returns three-quarter for high', () => {
    expect(recommendProxyQuality({ level: 'high' })).toBe('three-quarter');
  });

  it('returns half for medium', () => {
    expect(recommendProxyQuality({ level: 'medium' })).toBe('half');
  });

  it('returns quarter for low', () => {
    expect(recommendProxyQuality({ level: 'low' })).toBe('quarter');
  });
});

describe('ProxyFileManager', () => {
  it('creates with default config', () => {
    const manager = new ProxyFileManager();
    expect(manager).toBeDefined();
  });

  it('creates with custom config', () => {
    const manager = new ProxyFileManager({ maxConcurrent: 2 });
    expect(manager).toBeDefined();
  });

  it('getProxy returns undefined for unknown id', () => {
    const manager = new ProxyFileManager();
    expect(manager.getProxy('unknown', 'half')).toBeUndefined();
  });

  it('getBestAvailableProxy returns undefined for unknown id', () => {
    const manager = new ProxyFileManager();
    expect(manager.getBestAvailableProxy('unknown', 'half')).toBeUndefined();
  });

  it('getStats returns empty stats initially', () => {
    const manager = new ProxyFileManager();
    const stats = manager.getStats();
    expect(stats.totalProxies).toBe(0);
    expect(stats.totalSizeMB).toBe(0);
  });

  it('clear does not throw', () => {
    const manager = new ProxyFileManager();
    expect(() => manager.clear()).not.toThrow();
  });
});

describe('ProxySwitchManager', () => {
  it('creates with default config', () => {
    const manager = new ProxySwitchManager();
    expect(manager).toBeDefined();
  });

  it('getCurrentQuality returns initial quality', () => {
    const manager = new ProxySwitchManager('half');
    expect(manager.getCurrentQuality()).toBe('half');
  });

  it('getAverageFrameTime returns 0 initially', () => {
    const manager = new ProxySwitchManager();
    expect(manager.getAverageFrameTime()).toBe(0);
  });

  it('recordFrameTime updates average', () => {
    const manager = new ProxySwitchManager();
    manager.recordFrameTime(16);
    manager.recordFrameTime(20);
    expect(manager.getAverageFrameTime()).toBe(18);
  });

  it('setCurrentQuality changes quality', () => {
    const manager = new ProxySwitchManager('half');
    manager.setCurrentQuality('quarter');
    expect(manager.getCurrentQuality()).toBe('quarter');
  });
});

describe('SmartProxyManager', () => {
  it('creates with default config', () => {
    const manager = new SmartProxyManager();
    expect(manager).toBeDefined();
  });

  it('creates with custom config', () => {
    const manager = new SmartProxyManager({
      generation: { maxConcurrent: 1 },
    });
    expect(manager).toBeDefined();
  });

  it('getCurrentQuality returns quality', () => {
    const manager = new SmartProxyManager();
    expect(manager.getCurrentQuality()).toBeDefined();
  });

  it('getBestProxy returns undefined when disabled', () => {
    const manager = new SmartProxyManager({ enabled: false });
    expect(manager.getBestProxy('media1')).toBeUndefined();
  });

  it('getBestProxy returns undefined for unknown media', () => {
    const manager = new SmartProxyManager();
    expect(manager.getBestProxy('unknown')).toBeUndefined();
  });

  it('destroy does not throw', () => {
    const manager = new SmartProxyManager();
    expect(() => manager.destroy()).not.toThrow();
  });
});

describe('createSmartProxyManager', () => {
  it('creates a SmartProxyManager', () => {
    const manager = createSmartProxyManager();
    expect(manager).toBeInstanceOf(SmartProxyManager);
  });

  it('creates with config', () => {
    const manager = createSmartProxyManager({ generation: { maxConcurrent: 2 } });
    expect(manager).toBeInstanceOf(SmartProxyManager);
  });
});
