import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ZenModeManager,
  DEFAULT_ZEN_CONFIG,
  ZEN_MODE_PRESETS,
  createZenModeManager,
  getZenModePreset,
  getAllZenModePresets,
} from '../src/ui/zen-mode-manager';
import type { UIElementType } from '../src/ui/zen-mode-manager';

describe('ZenModeManager', () => {
  let manager: ZenModeManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new ZenModeManager();
  });

  afterEach(() => {
    vi.useRealTimers();
    manager.destroy();
  });

  describe('constructor', () => {
    it('initializes with default config', () => {
      const config = manager.getConfig();
      expect(config.backgroundColor).toBe('#000000');
      expect(config.retainedElements).toContain('preview');
      expect(config.retainedElements).toContain('timeline');
    });

    it('starts inactive', () => {
      expect(manager.isActive()).toBe(false);
      expect(manager.getState().status).toBe('inactive');
    });
  });

  describe('activate', () => {
    it('activates zen mode', () => {
      manager.activate();
      expect(manager.getState().status).toBe('activating');
      vi.advanceTimersByTime(300);
      expect(manager.isActive()).toBe(true);
    });

    it('hides non-retained elements', () => {
      manager.activate();
      expect(manager.isElementVisible('preview')).toBe(true);
      expect(manager.isElementVisible('timeline')).toBe(true);
      expect(manager.isElementVisible('menu-bar')).toBe(false);
      expect(manager.isElementVisible('toolbar')).toBe(false);
    });

    it('does nothing when already active', () => {
      manager.activate();
      vi.advanceTimersByTime(300);
      const listener = vi.fn();
      manager.onStateChange(listener);
      manager.activate();
      expect(listener).not.toHaveBeenCalled();
    });

    it('does nothing when activating', () => {
      manager.activate();
      const listener = vi.fn();
      manager.onStateChange(listener);
      manager.activate();
      // Second activate during 'activating' should be no-op
    });
  });

  describe('deactivate', () => {
    it('deactivates zen mode', () => {
      manager.activate();
      vi.advanceTimersByTime(300);
      manager.deactivate();
      expect(manager.getState().status).toBe('deactivating');
      vi.advanceTimersByTime(300);
      expect(manager.isActive()).toBe(false);
    });

    it('restores all elements', () => {
      manager.activate();
      vi.advanceTimersByTime(300);
      manager.deactivate();
      expect(manager.isElementVisible('menu-bar')).toBe(true);
      expect(manager.isElementVisible('toolbar')).toBe(true);
    });

    it('does nothing when inactive', () => {
      const listener = vi.fn();
      manager.onStateChange(listener);
      manager.deactivate();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('toggle', () => {
    it('activates when inactive', () => {
      manager.toggle();
      expect(manager.getState().status).toBe('activating');
    });

    it('deactivates when active', () => {
      manager.activate();
      vi.advanceTimersByTime(300);
      manager.toggle();
      expect(manager.getState().status).toBe('deactivating');
    });
  });

  describe('getElementOpacity', () => {
    it('returns 1 for visible elements', () => {
      expect(manager.getElementOpacity('preview')).toBe(1);
    });

    it('returns 0 for hidden elements after activate', () => {
      manager.activate();
      expect(manager.getElementOpacity('menu-bar')).toBe(0);
      expect(manager.getElementOpacity('preview')).toBe(1);
    });
  });

  describe('setElementVisibility', () => {
    it('updates element visibility', () => {
      manager.setElementVisibility('toolbar', false);
      expect(manager.isElementVisible('toolbar')).toBe(false);
    });

    it('updates opacity', () => {
      manager.setElementVisibility('toolbar', false);
      expect(manager.getElementOpacity('toolbar')).toBe(0);
    });
  });

  describe('addRetainedElement / removeRetainedElement', () => {
    it('adds retained element', () => {
      manager.addRetainedElement('toolbar');
      expect(manager.getRetainedElements()).toContain('toolbar');
    });

    it('does not duplicate retained element', () => {
      manager.addRetainedElement('preview');
      const elements = manager.getRetainedElements();
      expect(elements.filter(e => e === 'preview')).toHaveLength(1);
    });

    it('removes retained element', () => {
      manager.removeRetainedElement('preview');
      expect(manager.getRetainedElements()).not.toContain('preview');
    });

    it('updates visibility when active', () => {
      manager.activate();
      vi.advanceTimersByTime(300);
      manager.addRetainedElement('toolbar');
      expect(manager.isElementVisible('toolbar')).toBe(true);
      expect(manager.getState().activeElements).toContain('toolbar');
    });

    it('hides element when removing retained while active', () => {
      manager.activate();
      vi.advanceTimersByTime(300);
      manager.removeRetainedElement('preview');
      expect(manager.isElementVisible('preview')).toBe(false);
      expect(manager.getState().hiddenElements).toContain('preview');
    });
  });

  describe('recordActivity', () => {
    it('updates lastActivity', () => {
      const before = manager.getState().lastActivity;
      vi.advanceTimersByTime(100);
      manager.recordActivity();
      expect(manager.getState().lastActivity).toBeGreaterThan(before);
    });

    it('shows cursor and resets timeout when active', () => {
      manager.activate();
      vi.advanceTimersByTime(300);
      // Let cursor hide
      vi.advanceTimersByTime(3000);
      expect(manager.getState().cursorVisible).toBe(false);
      // Record activity should show cursor
      manager.recordActivity();
      expect(manager.getState().cursorVisible).toBe(true);
    });
  });

  describe('onStateChange', () => {
    it('notifies on activate', () => {
      const listener = vi.fn();
      manager.onStateChange(listener);
      manager.activate();
      expect(listener).toHaveBeenCalled();
    });

    it('unsubscribe stops notifications', () => {
      const listener = vi.fn();
      const unsubscribe = manager.onStateChange(listener);
      unsubscribe();
      manager.activate();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('updateConfig', () => {
    it('merges config', () => {
      manager.updateConfig({ backgroundColor: '#111' });
      expect(manager.getConfig().backgroundColor).toBe('#111');
    });
  });

  describe('getHiddenElements / getRetainedElements', () => {
    it('returns empty hidden when inactive', () => {
      expect(manager.getHiddenElements()).toEqual([]);
    });

    it('returns hidden elements when active', () => {
      manager.activate();
      const hidden = manager.getHiddenElements();
      expect(hidden.length).toBeGreaterThan(0);
      expect(hidden).not.toContain('preview');
      expect(hidden).not.toContain('timeline');
    });
  });

  describe('destroy', () => {
    it('clears state', () => {
      manager.destroy();
      expect(manager.getConfig()).toBeDefined();
    });
  });
});

describe('DEFAULT_ZEN_CONFIG', () => {
  it('has expected defaults', () => {
    expect(DEFAULT_ZEN_CONFIG.enabled).toBe(true);
    expect(DEFAULT_ZEN_CONFIG.retainedElements).toContain('preview');
    expect(DEFAULT_ZEN_CONFIG.exitShortcut).toBe('Escape');
  });
});

describe('ZEN_MODE_PRESETS', () => {
  it('has presets', () => {
    expect(ZEN_MODE_PRESETS.length).toBeGreaterThan(0);
  });

  it('each preset has id, name, config', () => {
    for (const preset of ZEN_MODE_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.config).toBeDefined();
    }
  });
});

describe('factory functions', () => {
  it('createZenModeManager returns instance', () => {
    expect(createZenModeManager()).toBeInstanceOf(ZenModeManager);
  });

  it('getZenModePreset returns preset by id', () => {
    const preset = getZenModePreset('minimal');
    expect(preset).toBeDefined();
    expect(preset!.name).toBe('最小化');
  });

  it('getZenModePreset returns undefined for unknown', () => {
    expect(getZenModePreset('nonexistent')).toBeUndefined();
  });

  it('getAllZenModePresets returns all', () => {
    expect(getAllZenModePresets().length).toBe(ZEN_MODE_PRESETS.length);
  });
});
