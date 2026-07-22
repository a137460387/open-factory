/**
 * Sprint AR 模块测试
 *
 * 测试 WebGPU 渲染引擎、智能代理系统、增量渲染引擎、
 * Zen 专注模式、全局快捷键体系和个性化主题引擎
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// ==================== WebGPU 渲染引擎测试 ====================

describe('WebGPU Render Engine', () => {
  it('should create engine with default config', async () => {
    const { WebGPURenderEngine } = await import('../src/engine/webgpu-render-engine');
    const engine = new WebGPURenderEngine();
    expect(engine).toBeDefined();
    expect(engine.getStatus()).toBe('uninitialized');
  });

  it('should have correct default config', async () => {
    const { WebGPURenderEngine } = await import('../src/engine/webgpu-render-engine');
    const engine = new WebGPURenderEngine();
    const config = engine.getConfig();
    expect(config.maxCacheFrames).toBe(120);
    expect(config.maxCacheBytes).toBe(1024 * 1024 * 1024);
    expect(config.fpsTarget).toBe(60);
  });

  it('should detect WebGPU support', async () => {
    const { detectWebGPUSupport } = await import('../src/engine/webgpu-render-engine');
    const support = await detectWebGPUSupport();
    expect(support).toBeDefined();
    expect(typeof support.supported).toBe('boolean');
  });
});

// ==================== 智能代理系统测试 ====================

describe('Smart Proxy Manager', () => {
  it('should create manager with default config', async () => {
    const { SmartProxyManager } = await import('../src/engine/smart-proxy-manager');
    const manager = new SmartProxyManager();
    expect(manager).toBeDefined();
  });

  it('should detect device performance', async () => {
    const { detectDevicePerformance } = await import('../src/engine/smart-proxy-manager');
    const info = await detectDevicePerformance();
    expect(info).toBeDefined();
    expect(info.level).toBeDefined();
    expect(info.cpuCores).toBeGreaterThan(0);
  });

  it('should recommend proxy quality based on device', async () => {
    const { recommendProxyQuality } = await import('../src/engine/smart-proxy-manager');
    const quality = recommendProxyQuality({
      level: 'medium',
      cpuCores: 8,
      memoryGB: 16,
      gpuRenderer: 'test',
      maxTextureSize: 8192,
      supportsWebGPU: true,
      supportsWebGL2: true,
      estimatedVRAM: 4096,
      benchmarkScore: 60,
    });
    expect(quality).toBe('half');
  });
});

// ==================== 增量渲染引擎测试 ====================

describe('Incremental Render Engine', () => {
  it('should create engine with default config', async () => {
    const { IncrementalRenderEngine } = await import('../src/engine/incremental-render-engine');
    const engine = new IncrementalRenderEngine();
    expect(engine).toBeDefined();
  });

  it('should have correct default config', async () => {
    const { IncrementalRenderEngine } = await import('../src/engine/incremental-render-engine');
    const engine = new IncrementalRenderEngine();
    const config = engine.getConfig();
    expect(config.maxConcurrentRenders).toBe(4);
    expect(config.maxQueueLength).toBe(100);
    expect(config.renderCacheSizeMB).toBe(512);
  });

  it('should submit render request', async () => {
    const { IncrementalRenderEngine } = await import('../src/engine/incremental-render-engine');
    const engine = new IncrementalRenderEngine();
    const task = engine.submitRenderRequest(
      'frame',
      { x: 0, y: 0, width: 1920, height: 1080 },
      0,
      'normal'
    );
    expect(task).toBeDefined();
    expect(task.id).toBeDefined();
    expect(task.status).toBe('pending');
  });
});

// ==================== Zen 专注模式测试 ====================

describe('Zen Mode Manager', () => {
  it('should create manager with default config', async () => {
    const { ZenModeManager } = await import('../src/ui/zen-mode-manager');
    const manager = new ZenModeManager();
    expect(manager).toBeDefined();
    expect(manager.isActive()).toBe(false);
  });

  it('should have correct default config', async () => {
    const { ZenModeManager } = await import('../src/ui/zen-mode-manager');
    const manager = new ZenModeManager();
    const config = manager.getConfig();
    expect(config.enabled).toBe(true);
    expect(config.transitionDuration).toBe(300);
    expect(config.autoHideCursor).toBe(true);
  });

  it('should get retained elements', async () => {
    const { ZenModeManager } = await import('../src/ui/zen-mode-manager');
    const manager = new ZenModeManager();
    const elements = manager.getRetainedElements();
    expect(elements).toContain('preview');
    expect(elements).toContain('timeline');
  });

  it('should get presets', async () => {
    const { getAllZenModePresets } = await import('../src/ui/zen-mode-manager');
    const presets = getAllZenModePresets();
    expect(presets.length).toBeGreaterThan(0);
    expect(presets[0].id).toBeDefined();
    expect(presets[0].name).toBeDefined();
  });
});

// ==================== 全局快捷键体系测试 ====================

describe('Shortcut Manager', () => {
  it('should create manager with default config', async () => {
    const { ShortcutManager } = await import('../src/ui/shortcut-manager');
    const manager = new ShortcutManager();
    expect(manager).toBeDefined();
    expect(manager.isEnabled()).toBe(true);
  });

  it('should have correct default config', async () => {
    const { ShortcutManager } = await import('../src/ui/shortcut-manager');
    const manager = new ShortcutManager();
    const config = manager.getConfig();
    expect(config.activeSchemeId).toBe('premiere');
    expect(config.showTooltips).toBe(true);
  });

  it('should get active scheme', async () => {
    const { ShortcutManager } = await import('../src/ui/shortcut-manager');
    const manager = new ShortcutManager();
    const scheme = manager.getActiveScheme();
    expect(scheme).toBeDefined();
    expect(scheme.id).toBe('premiere');
    expect(scheme.shortcuts.length).toBeGreaterThan(0);
  });

  it('should get all schemes', async () => {
    const { ShortcutManager } = await import('../src/ui/shortcut-manager');
    const manager = new ShortcutManager();
    const schemes = manager.getAllSchemes();
    expect(schemes.length).toBe(3);
    expect(schemes.map(s => s.id)).toContain('premiere');
    expect(schemes.map(s => s.id)).toContain('final-cut');
    expect(schemes.map(s => s.id)).toContain('davinci-resolve');
  });

  it('should get shortcuts by category', async () => {
    const { ShortcutManager } = await import('../src/ui/shortcut-manager');
    const manager = new ShortcutManager();
    const categories = manager.getShortcutsByCategory();
    expect(categories.size).toBeGreaterThan(0);
    expect(categories.has('播放控制')).toBe(true);
    expect(categories.has('编辑')).toBe(true);
  });

  it('should search shortcuts', async () => {
    const { ShortcutManager } = await import('../src/ui/shortcut-manager');
    const manager = new ShortcutManager();
    const results = manager.searchShortcuts('播放');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should format shortcut keys', async () => {
    const { formatShortcutKeys } = await import('../src/ui/shortcut-manager');
    const formatted = formatShortcutKeys({
      id: 'test',
      action: 'play-pause',
      keys: ['Space'],
      modifiers: ['ctrl'],
      label: 'Test',
      description: 'Test',
      category: 'Test',
      enabled: true,
      customizable: true,
    });
    expect(formatted).toBe('Ctrl + Space');
  });
});

// ==================== 个性化主题引擎测试 ====================

describe('Theme Engine', () => {
  it('should create manager', async () => {
    const { ThemeManager } = await import('../src/ui/theme-engine');
    const manager = new ThemeManager();
    expect(manager).toBeDefined();
  });

  it('should get default dark theme', async () => {
    const { getDefaultDarkTheme } = await import('../src/ui/theme-engine');
    const theme = getDefaultDarkTheme();
    expect(theme).toBeDefined();
    expect(theme.id).toBe('default-dark');
    expect(theme.mode).toBe('dark');
  });

  it('should get default light theme', async () => {
    const { getDefaultLightTheme } = await import('../src/ui/theme-engine');
    const theme = getDefaultLightTheme();
    expect(theme).toBeDefined();
    expect(theme.id).toBe('default-light');
    expect(theme.mode).toBe('light');
  });

  it('should get all presets', async () => {
    const { getAllThemePresets } = await import('../src/ui/theme-engine');
    const presets = getAllThemePresets();
    expect(presets.length).toBeGreaterThan(0);
    expect(presets[0].id).toBeDefined();
    expect(presets[0].name).toBeDefined();
  });

  it('should generate CSS variables', async () => {
    const { generateThemeCSSVariables, getDefaultDarkTheme } = await import('../src/ui/theme-engine');
    const theme = getDefaultDarkTheme();
    const css = generateThemeCSSVariables(theme);
    expect(css).toContain(':root');
    expect(css).toContain('--color-primary');
    expect(css).toContain('--color-background');
  });
});
