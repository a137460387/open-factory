import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  recommendProxyQuality,
  ProxyFileManager,
  ProxySwitchManager,
  SmartProxyManager,
  createSmartProxyManager,
  DEFAULT_PROXY_CONFIG,
} from '../src/engine/smart-proxy-manager';
import type { DevicePerformanceInfo, ProxyFileInfo, ProxyQuality } from '../src/engine/smart-proxy-manager';

function makeDeviceInfo(overrides: Partial<DevicePerformanceInfo> = {}): DevicePerformanceInfo {
  return {
    level: 'medium',
    cpuCores: 8,
    memoryGB: 16,
    gpuRenderer: 'unknown',
    maxTextureSize: 4096,
    supportsWebGPU: false,
    supportsWebGL2: true,
    estimatedVRAM: 2048,
    benchmarkScore: 50,
    ...overrides,
  };
}

function makeProxy(overrides: Partial<ProxyFileInfo> = {}): ProxyFileInfo {
  return {
    id: 'proxy-1',
    originalMediaId: 'media-1',
    quality: 'half',
    width: 960,
    height: 540,
    fileSize: 1024 * 1024,
    filePath: '/proxies/media-1_half.mp4',
    status: 'ready',
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    useCount: 0,
    ...overrides,
  };
}

describe('recommendProxyQuality', () => {
  it('returns full for ultra', () => {
    expect(recommendProxyQuality(makeDeviceInfo({ level: 'ultra' }))).toBe('full');
  });

  it('returns three-quarter for high', () => {
    expect(recommendProxyQuality(makeDeviceInfo({ level: 'high' }))).toBe('three-quarter');
  });

  it('returns half for medium', () => {
    expect(recommendProxyQuality(makeDeviceInfo({ level: 'medium' }))).toBe('half');
  });

  it('returns quarter for low', () => {
    expect(recommendProxyQuality(makeDeviceInfo({ level: 'low' }))).toBe('quarter');
  });
});

describe('ProxyFileManager', () => {
  let manager: ProxyFileManager;

  beforeEach(() => {
    manager = new ProxyFileManager();
  });

  describe('getProxy', () => {
    it('returns undefined for unknown proxy', () => {
      expect(manager.getProxy('media-1', 'half')).toBeUndefined();
    });
  });

  describe('registerProxy / getProxy', () => {
    it('registers and retrieves proxy', () => {
      const proxy = makeProxy();
      manager.registerProxy(proxy);
      expect(manager.getProxy('media-1', 'half')).toBe(proxy);
    });
  });

  describe('updateProxyStatus', () => {
    it('updates status of registered proxy', () => {
      manager.registerProxy(makeProxy({ status: 'generating' }));
      manager.updateProxyStatus('media-1', 'half', 'ready');
      expect(manager.getProxy('media-1', 'half')?.status).toBe('ready');
    });

    it('does nothing for unknown proxy', () => {
      manager.updateProxyStatus('unknown', 'half', 'ready');
      // should not throw
    });
  });

  describe('getBestAvailableProxy', () => {
    it('returns preferred quality when ready', () => {
      manager.registerProxy(makeProxy({ quality: 'half', status: 'ready' }));
      const result = manager.getBestAvailableProxy('media-1', 'half');
      expect(result?.quality).toBe('half');
    });

    it('falls back to lower quality', () => {
      manager.registerProxy(makeProxy({ quality: 'quarter', status: 'ready' }));
      const result = manager.getBestAvailableProxy('media-1', 'half');
      expect(result?.quality).toBe('quarter');
    });

    it('returns undefined when no ready proxy exists', () => {
      manager.registerProxy(makeProxy({ quality: 'half', status: 'generating' }));
      expect(manager.getBestAvailableProxy('media-1', 'half')).toBeUndefined();
    });

    it('skips error status proxies', () => {
      manager.registerProxy(makeProxy({ quality: 'half', status: 'error' }));
      manager.registerProxy(makeProxy({ id: 'p2', quality: 'quarter', status: 'ready' }));
      const result = manager.getBestAvailableProxy('media-1', 'half');
      expect(result?.quality).toBe('quarter');
    });

    it('increments useCount and updates lastUsedAt', () => {
      manager.registerProxy(makeProxy({ quality: 'half', status: 'ready', useCount: 0 }));
      const before = Date.now();
      const result = manager.getBestAvailableProxy('media-1', 'half');
      expect(result!.useCount).toBe(1);
      expect(result!.lastUsedAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe('generateProxy', () => {
    it('generates proxy with correct dimensions', async () => {
      const generateFn = vi.fn().mockResolvedValue('/proxies/output.mp4');
      const proxy = await manager.generateProxy('media-1', 'half', 1920, 1080, generateFn);
      expect(proxy.width).toBe(960);
      expect(proxy.height).toBe(540);
      expect(proxy.status).toBe('ready');
      expect(generateFn).toHaveBeenCalledWith('media-1', 960, 540);
    });

    it('ensures even dimensions', async () => {
      const generateFn = vi.fn().mockResolvedValue('/proxies/output.mp4');
      const proxy = await manager.generateProxy('media-1', 'quarter', 1001, 501, generateFn);
      expect(proxy.width % 2).toBe(0);
      expect(proxy.height % 2).toBe(0);
    });

    it('returns existing ready proxy without regenerating', async () => {
      manager.registerProxy(makeProxy({ quality: 'half', status: 'ready' }));
      const generateFn = vi.fn();
      const result = await manager.generateProxy('media-1', 'half', 1920, 1080, generateFn);
      expect(generateFn).not.toHaveBeenCalled();
      expect(result.status).toBe('ready');
    });

    it('sets error status on generation failure', async () => {
      const generateFn = vi.fn().mockRejectedValue(new Error('fail'));
      await expect(manager.generateProxy('media-1', 'half', 1920, 1080, generateFn)).rejects.toThrow('fail');
      expect(manager.getProxy('media-1', 'half')?.status).toBe('error');
    });

    it('calculates correct dimensions for all quality levels', async () => {
      const generateFn = vi.fn().mockResolvedValue('/proxies/output.mp4');
      const quarter = await manager.generateProxy('m', 'quarter', 1920, 1080, generateFn);
      expect(quarter.width).toBe(480);
      expect(quarter.height).toBe(270);

      const threeQ = await manager.generateProxy('m2', 'three-quarter', 1920, 1080, generateFn);
      expect(threeQ.width).toBe(1440);
      expect(threeQ.height).toBe(810);

      const full = await manager.generateProxy('m3', 'full', 1920, 1080, generateFn);
      expect(full.width).toBe(1920);
      expect(full.height).toBe(1080);
    });
  });

  describe('getStats', () => {
    it('returns zero for empty', () => {
      const stats = manager.getStats();
      expect(stats.totalProxies).toBe(0);
      expect(stats.totalSizeMB).toBe(0);
    });

    it('counts all proxies', () => {
      manager.registerProxy(makeProxy({ status: 'ready', fileSize: 2 * 1024 * 1024 }));
      manager.registerProxy(makeProxy({ id: 'p2', quality: 'quarter', status: 'generating', fileSize: 0 }));
      const stats = manager.getStats();
      expect(stats.totalProxies).toBe(2);
      expect(stats.totalSizeMB).toBe(2);
    });
  });

  describe('clear', () => {
    it('clears all proxies', () => {
      manager.registerProxy(makeProxy());
      manager.clear();
      expect(manager.getProxy('media-1', 'half')).toBeUndefined();
      expect(manager.getStats().totalProxies).toBe(0);
    });
  });
});

describe('ProxySwitchManager', () => {
  let manager: ProxySwitchManager;

  beforeEach(() => {
    manager = new ProxySwitchManager('half', { enableAdaptive: true, switchDelay: 2, sampleWindowSize: 20 });
  });

  describe('constructor', () => {
    it('sets initial quality', () => {
      expect(manager.getCurrentQuality()).toBe('half');
    });
  });

  describe('getAverageFrameTime', () => {
    it('returns 0 when no samples', () => {
      expect(manager.getAverageFrameTime()).toBe(0);
    });

    it('calculates average', () => {
      manager.recordFrameTime(10);
      manager.recordFrameTime(20);
      // With adaptive enabled and switchDelay=2, need to check if switch happened
      // But with only 2 samples and window requiring 10, no switch should happen
      expect(manager.getAverageFrameTime()).toBe(15);
    });
  });

  describe('setCurrentQuality', () => {
    it('sets quality', () => {
      manager.setCurrentQuality('full');
      expect(manager.getCurrentQuality()).toBe('full');
    });
  });

  describe('getSwitchHistory', () => {
    it('starts empty', () => {
      expect(manager.getSwitchHistory()).toEqual([]);
    });
  });

  describe('getAverageSwitchLatency', () => {
    it('returns 0 with no history', () => {
      expect(manager.getAverageSwitchLatency()).toBe(0);
    });
  });

  describe('resetStats', () => {
    it('resets all stats', () => {
      manager.recordFrameTime(16);
      manager.resetStats();
      expect(manager.getAverageFrameTime()).toBe(0);
      expect(manager.getSwitchHistory()).toEqual([]);
    });
  });

  describe('adaptive switching', () => {
    it('downgrades quality when frame time is consistently high', () => {
      // Need 10+ samples (minimum), then switchDelay consecutive high samples
      for (let i = 0; i < 15; i++) {
        manager.recordFrameTime(50); // well above switchThresholdMs (20)
      }
      // With switchDelay=2, should have downgraded
      expect(manager.getCurrentQuality()).not.toBe('half');
    });

    it('does not switch when adaptive is disabled', () => {
      const nonAdaptive = new ProxySwitchManager('half', { enableAdaptive: false });
      for (let i = 0; i < 20; i++) {
        nonAdaptive.recordFrameTime(50);
      }
      expect(nonAdaptive.getCurrentQuality()).toBe('half');
    });
  });
});

describe('SmartProxyManager', () => {
  let manager: SmartProxyManager;

  beforeEach(() => {
    manager = new SmartProxyManager({ smartSwitch: true, enabled: true });
  });

  describe('getCurrentQuality', () => {
    it('returns config quality when smartSwitch is off', () => {
      const m = new SmartProxyManager({ smartSwitch: false, generation: { ...DEFAULT_PROXY_CONFIG.generation, quality: 'quarter' } });
      expect(m.getCurrentQuality()).toBe('quarter');
    });

    it('returns switch manager quality when smartSwitch is on', () => {
      expect(manager.getCurrentQuality()).toBeDefined();
    });
  });

  describe('getBestProxy', () => {
    it('returns undefined when disabled', () => {
      const m = new SmartProxyManager({ enabled: false });
      expect(m.getBestProxy('media-1')).toBeUndefined();
    });

    it('returns undefined when no proxy available', () => {
      expect(manager.getBestProxy('media-1')).toBeUndefined();
    });
  });

  describe('generateProxy', () => {
    it('delegates to file manager', async () => {
      const fn = vi.fn().mockResolvedValue('/proxies/test.mp4');
      const proxy = await manager.generateProxy('media-1', 'half', 1920, 1080, fn);
      expect(proxy.status).toBe('ready');
    });
  });

  describe('recordFramePerformance', () => {
    it('records when smartSwitch enabled', () => {
      manager.recordFramePerformance(16);
      // should not throw
    });

    it('does nothing when smartSwitch disabled', () => {
      const m = new SmartProxyManager({ smartSwitch: false });
      m.recordFramePerformance(16);
    });
  });

  describe('getPerformanceStats', () => {
    it('returns stats', () => {
      const stats = manager.getPerformanceStats();
      expect(stats.currentQuality).toBeDefined();
      expect(stats.totalProxies).toBe(0);
      expect(stats.totalSizeMB).toBe(0);
    });
  });

  describe('getDeviceInfo', () => {
    it('returns null before initialization', () => {
      expect(manager.getDeviceInfo()).toBeNull();
    });
  });

  describe('updateConfig', () => {
    it('merges config', () => {
      manager.updateConfig({ enabled: false });
      expect(manager.getBestProxy('any')).toBeUndefined();
    });
  });

  describe('clear / destroy', () => {
    it('clear resets proxies and stats', () => {
      manager.clear();
      expect(manager.getPerformanceStats().totalProxies).toBe(0);
    });

    it('destroy resets everything', () => {
      manager.destroy();
      expect(manager.getDeviceInfo()).toBeNull();
    });
  });
});

describe('factory functions', () => {
  it('createSmartProxyManager returns instance', () => {
    expect(createSmartProxyManager()).toBeInstanceOf(SmartProxyManager);
  });
});

describe('DEFAULT_PROXY_CONFIG', () => {
  it('has expected defaults', () => {
    expect(DEFAULT_PROXY_CONFIG.generation.quality).toBe('half');
    expect(DEFAULT_PROXY_CONFIG.switchStrategy.enableAdaptive).toBe(true);
    expect(DEFAULT_PROXY_CONFIG.enabled).toBe(true);
    expect(DEFAULT_PROXY_CONFIG.smartSwitch).toBe(true);
  });
});
