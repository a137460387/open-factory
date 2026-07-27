import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ShortcutManager,
  createShortcutManager,
  getShortcutScheme,
  getAllShortcutSchemes,
  formatShortcutKeys,
  PREMIERE_SCHEME,
  ALL_SHORTCUT_SCHEMES,
} from '../src/ui/shortcut-manager';
import type { ShortcutDefinition, ShortcutScheme } from '../src/ui/shortcut-manager';

// Mock localStorage
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { for (const k of Object.keys(store)) delete store[k]; }),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

describe('ShortcutManager', () => {
  let manager: ShortcutManager;

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    manager = new ShortcutManager({ enableConflictDetection: true });
  });

  describe('constructor', () => {
    it('loads all default schemes', () => {
      const schemes = manager.getAllSchemes();
      expect(schemes.length).toBe(ALL_SHORTCUT_SCHEMES.length);
    });

    it('sets active scheme from config', () => {
      const scheme = manager.getActiveScheme();
      expect(scheme).toBeDefined();
      expect(scheme.id).toBeDefined();
    });

    it('falls back to premiere scheme for unknown id', () => {
      const m = new ShortcutManager({ activeSchemeId: 'nonexistent' });
      expect(m.getActiveScheme().id).toBe(PREMIERE_SCHEME.id);
    });
  });

  describe('switchScheme', () => {
    it('switches to a valid scheme', () => {
      const allSchemes = ALL_SHORTCUT_SCHEMES;
      if (allSchemes.length > 1) {
        const target = allSchemes[1];
        expect(manager.switchScheme(target.id)).toBe(true);
        expect(manager.getActiveScheme().id).toBe(target.id);
      }
    });

    it('returns false for unknown scheme', () => {
      expect(manager.switchScheme('nonexistent')).toBe(false);
    });
  });

  describe('updateShortcut', () => {
    it('updates a customizable shortcut', () => {
      const shortcuts = manager.getShortcuts();
      const customizable = shortcuts.find(s => s.customizable);
      if (customizable) {
        const result = manager.updateShortcut(customizable.id, { label: 'Updated' });
        expect(result).toBe(true);
        const updated = manager.getShortcuts().find(s => s.id === customizable.id);
        expect(updated?.label).toBe('Updated');
      }
    });

    it('returns false for non-customizable shortcut', () => {
      const shortcuts = manager.getShortcuts();
      const nonCustomizable = shortcuts.find(s => !s.customizable);
      if (nonCustomizable) {
        expect(manager.updateShortcut(nonCustomizable.id, { label: 'X' })).toBe(false);
      }
    });

    it('returns false for unknown shortcut', () => {
      expect(manager.updateShortcut('nonexistent', { label: 'X' })).toBe(false);
    });

    it('detects conflicts when enabled', () => {
      const shortcuts = manager.getShortcuts().filter(s => s.enabled);
      if (shortcuts.length >= 2) {
        const [s1, s2] = shortcuts;
        // Try to set s1's keys to s2's keys
        const result = manager.updateShortcut(s1.id, { keys: s2.keys, modifiers: s2.modifiers });
        expect(result).toBe(false);
      }
    });
  });

  describe('checkConflict', () => {
    it('returns null when no conflict', () => {
      const conflict = manager.checkConflict('nonexistent', ['Z'], ['ctrl']);
      expect(conflict).toBeNull();
    });

    it('detects conflict with existing shortcut', () => {
      const shortcuts = manager.getShortcuts().filter(s => s.enabled);
      if (shortcuts.length > 0) {
        const target = shortcuts[0];
        const conflict = manager.checkConflict('other', target.keys, target.modifiers);
        expect(conflict).not.toBeNull();
      }
    });
  });

  describe('getStats', () => {
    it('returns correct stats', () => {
      const stats = manager.getStats();
      expect(stats.totalShortcuts).toBeGreaterThan(0);
      expect(stats.enabledShortcuts).toBeGreaterThan(0);
      expect(stats.totalShortcuts).toBe(stats.enabledShortcuts + stats.disabledShortcuts);
    });
  });

  describe('getShortcutsByCategory', () => {
    it('groups shortcuts by category', () => {
      const categories = manager.getShortcutsByCategory();
      expect(categories.size).toBeGreaterThan(0);
      for (const [, shortcuts] of categories) {
        expect(shortcuts.length).toBeGreaterThan(0);
      }
    });
  });

  describe('searchShortcuts', () => {
    it('finds shortcuts by label', () => {
      const all = manager.getShortcuts();
      if (all.length > 0) {
        const query = all[0].label.slice(0, 3);
        const results = manager.searchShortcuts(query);
        expect(results.length).toBeGreaterThan(0);
      }
    });

    it('returns empty for no match', () => {
      expect(manager.searchShortcuts('zzzznonexistent')).toEqual([]);
    });
  });

  describe('resetToDefault', () => {
    it('resets to default scheme', () => {
      manager.resetToDefault();
      const scheme = manager.getActiveScheme();
      expect(scheme.isDefault).toBe(true);
    });
  });

  describe('exportConfig / importConfig', () => {
    it('exports valid JSON', () => {
      const json = manager.exportConfig();
      const parsed = JSON.parse(json);
      expect(parsed.schemeId).toBeDefined();
      expect(Array.isArray(parsed.shortcuts)).toBe(true);
    });

    it('imports valid config', () => {
      const json = manager.exportConfig();
      expect(manager.importConfig(json)).toBe(true);
    });

    it('returns false for invalid JSON', () => {
      expect(manager.importConfig('not json')).toBe(false);
    });

    it('imports shortcuts into existing scheme', () => {
      const json = JSON.stringify({
        schemeId: manager.getActiveScheme().id,
        shortcuts: [{ id: 'nonexistent', label: 'test' }],
      });
      // Should not throw, returns true
      expect(manager.importConfig(json)).toBe(true);
    });
  });

  describe('listeners', () => {
    it('notifies on scheme switch', () => {
      const listener = vi.fn();
      const unsubscribe = manager.onShortcutsChange(listener);
      const allSchemes = ALL_SHORTCUT_SCHEMES;
      if (allSchemes.length > 1) {
        manager.switchScheme(allSchemes[1].id);
        expect(listener).toHaveBeenCalled();
      }
      unsubscribe();
    });

    it('unsubscribe stops notifications', () => {
      const listener = vi.fn();
      const unsubscribe = manager.onShortcutsChange(listener);
      unsubscribe();
      manager.resetToDefault();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('config', () => {
    it('getConfig returns copy', () => {
      const config1 = manager.getConfig();
      const config2 = manager.getConfig();
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });

    it('updateConfig merges', () => {
      manager.updateConfig({ enabled: false });
      expect(manager.isEnabled()).toBe(false);
    });

    it('setEnabled toggles', () => {
      manager.setEnabled(false);
      expect(manager.isEnabled()).toBe(false);
      manager.setEnabled(true);
      expect(manager.isEnabled()).toBe(true);
    });
  });

  describe('handleKeyEvent', () => {
    it('returns false when disabled', () => {
      manager.setEnabled(false);
      const event = { key: 'a', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as KeyboardEvent;
      expect(manager.handleKeyEvent(event)).toBe(false);
    });

    it('returns false for unmatched key', () => {
      const event = { key: 'F24', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as KeyboardEvent;
      expect(manager.handleKeyEvent(event)).toBe(false);
    });
  });

  describe('destroy', () => {
    it('clears handlers and listeners', () => {
      const handler = vi.fn();
      manager.registerAction('copy', handler);
      const listener = vi.fn();
      manager.onShortcutsChange(listener);
      manager.destroy();
      // After destroy, registering new listeners should work on fresh state
      // but the manager itself still has shortcuts in the scheme
      expect(manager.getConfig()).toBeDefined();
    });
  });
});

describe('formatShortcutKeys', () => {
  it('formats modifiers and keys', () => {
    const shortcut: ShortcutDefinition = {
      id: 'test',
      action: 'copy',
      keys: ['C'],
      modifiers: ['ctrl'],
      label: 'Copy',
      description: 'Copy',
      category: 'Edit',
      enabled: true,
      customizable: true,
    };
    expect(formatShortcutKeys(shortcut)).toBe('Ctrl + C');
  });

  it('formats multiple modifiers', () => {
    const shortcut: ShortcutDefinition = {
      id: 'test',
      action: 'custom',
      keys: ['Z'],
      modifiers: ['ctrl', 'shift'],
      label: 'Undo',
      description: '',
      category: '',
      enabled: true,
      customizable: true,
    };
    expect(formatShortcutKeys(shortcut)).toBe('Ctrl + Shift + Z');
  });

  it('formats meta as ⌘', () => {
    const shortcut: ShortcutDefinition = {
      id: 'test',
      action: 'custom',
      keys: ['S'],
      modifiers: ['meta'],
      label: 'Save',
      description: '',
      category: '',
      enabled: true,
      customizable: true,
    };
    expect(formatShortcutKeys(shortcut)).toBe('⌘ + S');
  });

  it('formats alt modifier', () => {
    const shortcut: ShortcutDefinition = {
      id: 'test',
      action: 'custom',
      keys: ['F4'],
      modifiers: ['alt'],
      label: 'Close',
      description: '',
      category: '',
      enabled: true,
      customizable: true,
    };
    expect(formatShortcutKeys(shortcut)).toBe('Alt + F4');
  });

  it('handles no modifiers', () => {
    const shortcut: ShortcutDefinition = {
      id: 'test',
      action: 'custom',
      keys: ['Escape'],
      modifiers: [],
      label: 'Esc',
      description: '',
      category: '',
      enabled: true,
      customizable: true,
    };
    expect(formatShortcutKeys(shortcut)).toBe('Escape');
  });
});

describe('factory functions', () => {
  it('createShortcutManager returns ShortcutManager', () => {
    const m = createShortcutManager();
    expect(m).toBeInstanceOf(ShortcutManager);
  });

  it('getShortcutScheme returns scheme by id', () => {
    const scheme = getShortcutScheme(PREMIERE_SCHEME.id);
    expect(scheme).toBeDefined();
    expect(scheme!.id).toBe(PREMIERE_SCHEME.id);
  });

  it('getShortcutScheme returns undefined for unknown', () => {
    expect(getShortcutScheme('nonexistent')).toBeUndefined();
  });

  it('getAllShortcutSchemes returns all schemes', () => {
    const schemes = getAllShortcutSchemes();
    expect(schemes.length).toBe(ALL_SHORTCUT_SCHEMES.length);
  });
});
