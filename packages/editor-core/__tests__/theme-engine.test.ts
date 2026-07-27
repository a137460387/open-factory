import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ThemeManager,
  createThemeManager,
  getDefaultDarkTheme,
  getDefaultLightTheme,
  getAllThemePresets,
  generateThemeCSSVariables,
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  THEME_PRESETS,
} from '../src/ui/theme-engine';
import type { ThemeConfig } from '../src/ui/theme-engine';

// Mock localStorage
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { for (const k of Object.keys(store)) delete store[k]; }),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

describe('ThemeManager', () => {
  let manager: ThemeManager;

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    manager = new ThemeManager();
  });

  describe('constructor', () => {
    it('loads default themes', () => {
      const themes = manager.getAllThemes();
      expect(themes.length).toBeGreaterThanOrEqual(2);
    });

    it('sets dark theme as default active', () => {
      expect(manager.getActiveTheme().id).toBe(DEFAULT_DARK_THEME.id);
    });
  });

  describe('switchTheme', () => {
    it('switches to a valid theme', () => {
      expect(manager.switchTheme(DEFAULT_LIGHT_THEME.id)).toBe(true);
      expect(manager.getActiveTheme().id).toBe(DEFAULT_LIGHT_THEME.id);
    });

    it('returns false for unknown theme', () => {
      expect(manager.switchTheme('nonexistent')).toBe(false);
    });
  });

  describe('createTheme', () => {
    it('creates custom theme with defaults', () => {
      const theme = manager.createTheme({});
      expect(theme.id).toMatch(/^custom-/);
      expect(theme.isDefault).toBe(false);
      expect(manager.getTheme(theme.id)).toBeDefined();
    });

    it('creates theme with provided config', () => {
      const theme = manager.createTheme({ id: 'my-theme', name: 'My Theme', mode: 'light' });
      expect(theme.id).toBe('my-theme');
      expect(theme.name).toBe('My Theme');
      expect(theme.mode).toBe('light');
    });
  });

  describe('updateTheme', () => {
    it('updates custom theme', () => {
      const theme = manager.createTheme({ id: 'editable' });
      expect(manager.updateTheme('editable', { name: 'Updated' })).toBe(true);
      expect(manager.getTheme('editable')?.name).toBe('Updated');
    });

    it('returns false for default theme', () => {
      expect(manager.updateTheme(DEFAULT_DARK_THEME.id, { name: 'X' })).toBe(false);
    });

    it('returns false for unknown theme', () => {
      expect(manager.updateTheme('nonexistent', { name: 'X' })).toBe(false);
    });

    it('re-applies if updating active theme', () => {
      const theme = manager.createTheme({ id: 'active-custom' });
      manager.switchTheme('active-custom');
      const listener = vi.fn();
      manager.onThemeChange(listener);
      manager.updateTheme('active-custom', { name: 'Updated Active' });
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('deleteTheme', () => {
    it('deletes custom theme', () => {
      manager.createTheme({ id: 'to-delete' });
      expect(manager.deleteTheme('to-delete')).toBe(true);
      expect(manager.getTheme('to-delete')).toBeUndefined();
    });

    it('returns false for default theme', () => {
      expect(manager.deleteTheme(DEFAULT_DARK_THEME.id)).toBe(false);
    });

    it('returns false for unknown theme', () => {
      expect(manager.deleteTheme('nonexistent')).toBe(false);
    });

    it('switches to default when deleting active theme', () => {
      const theme = manager.createTheme({ id: 'active-del' });
      manager.switchTheme('active-del');
      manager.deleteTheme('active-del');
      expect(manager.getActiveTheme().id).toBe(DEFAULT_DARK_THEME.id);
    });
  });

  describe('getTheme / getAllThemes / getPresets', () => {
    it('getTheme returns theme by id', () => {
      expect(manager.getTheme(DEFAULT_DARK_THEME.id)).toBeDefined();
    });

    it('getTheme returns undefined for unknown', () => {
      expect(manager.getTheme('nonexistent')).toBeUndefined();
    });

    it('getAllThemes returns all', () => {
      expect(manager.getAllThemes().length).toBeGreaterThanOrEqual(2);
    });

    it('getPresets returns presets', () => {
      const presets = manager.getPresets();
      expect(presets.length).toBe(THEME_PRESETS.length);
    });
  });

  describe('applyPreset', () => {
    it('applies valid preset', () => {
      if (THEME_PRESETS.length > 0) {
        expect(manager.applyPreset(THEME_PRESETS[0].id)).toBe(true);
      }
    });

    it('returns false for unknown preset', () => {
      expect(manager.applyPreset('nonexistent')).toBe(false);
    });
  });

  describe('update methods', () => {
    it('updateColor modifies active theme', () => {
      manager.updateColor('primary', '#ff0000');
      expect(manager.getActiveTheme().colors.primary).toBe('#ff0000');
    });

    it('updateTimelineStyle modifies active theme', () => {
      manager.updateTimelineStyle({ clipHeight: 64 });
      expect(manager.getActiveTheme().timeline.clipHeight).toBe(64);
    });

    it('updateLayout modifies active theme', () => {
      manager.updateLayout({ sidebarWidth: 300 });
      expect(manager.getActiveTheme().layout.sidebarWidth).toBe(300);
    });

    it('updateFonts modifies active theme', () => {
      manager.updateFonts({ baseSize: 16 });
      expect(manager.getActiveTheme().fonts.baseSize).toBe(16);
    });

    it('updateAnimations modifies active theme', () => {
      manager.updateAnimations({ enabled: false });
      expect(manager.getActiveTheme().animations.enabled).toBe(false);
    });
  });

  describe('resetToDefault / resetTheme', () => {
    it('resetToDefault switches to dark', () => {
      manager.switchTheme(DEFAULT_LIGHT_THEME.id);
      manager.resetToDefault();
      expect(manager.getActiveTheme().id).toBe(DEFAULT_DARK_THEME.id);
    });

    it('resetTheme resets custom theme', () => {
      const theme = manager.createTheme({ id: 'resettable', mode: 'dark' });
      manager.updateTheme('resettable', { name: 'Changed' });
      expect(manager.resetTheme('resettable')).toBe(true);
    });

    it('resetTheme returns false for default', () => {
      expect(manager.resetTheme(DEFAULT_DARK_THEME.id)).toBe(false);
    });

    it('resetTheme returns false for unknown', () => {
      expect(manager.resetTheme('nonexistent')).toBe(false);
    });
  });

  describe('exportTheme / importTheme', () => {
    it('exports theme as JSON', () => {
      const json = manager.exportTheme(DEFAULT_DARK_THEME.id);
      expect(json).not.toBeNull();
      const parsed = JSON.parse(json!);
      expect(parsed.id).toBe(DEFAULT_DARK_THEME.id);
    });

    it('returns null for unknown theme', () => {
      expect(manager.exportTheme('nonexistent')).toBeNull();
    });

    it('imports valid theme JSON', () => {
      const json = JSON.stringify({
        id: 'imported',
        name: 'Imported',
        colors: DEFAULT_DARK_THEME.colors,
      });
      const theme = manager.importTheme(json);
      expect(theme).not.toBeNull();
      expect(theme!.name).toBe('Imported');
      expect(theme!.id).toMatch(/^imported-/);
    });

    it('returns null for invalid JSON', () => {
      expect(manager.importTheme('not json')).toBeNull();
    });

    it('returns null for missing required fields', () => {
      expect(manager.importTheme(JSON.stringify({ id: 'x' }))).toBeNull();
    });
  });

  describe('generateCSSVariables', () => {
    it('generates CSS for active theme', () => {
      const css = manager.generateCSSVariables();
      expect(css).toContain(':root');
      expect(css).toContain('--color-primary');
      expect(css).toContain('--font-sans');
    });

    it('generates CSS for specific theme', () => {
      const css = manager.generateCSSVariables(DEFAULT_LIGHT_THEME);
      expect(css).toContain(':root');
    });
  });

  describe('listeners', () => {
    it('notifies on theme switch', () => {
      const listener = vi.fn();
      const unsubscribe = manager.onThemeChange(listener);
      manager.switchTheme(DEFAULT_LIGHT_THEME.id);
      expect(listener).toHaveBeenCalledWith(manager.getActiveTheme());
      unsubscribe();
    });

    it('unsubscribe stops notifications', () => {
      const listener = vi.fn();
      const unsubscribe = manager.onThemeChange(listener);
      unsubscribe();
      manager.switchTheme(DEFAULT_LIGHT_THEME.id);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('returns correct stats', () => {
      const stats = manager.getStats();
      expect(stats.totalThemes).toBeGreaterThanOrEqual(2);
      expect(stats.activeTheme).toBe(DEFAULT_DARK_THEME.id);
    });
  });

  describe('destroy', () => {
    it('clears listeners and themes', () => {
      manager.destroy();
      // After destroy, manager should be empty
      expect(manager.getAllThemes()).toEqual([]);
    });
  });
});

describe('factory functions', () => {
  it('createThemeManager returns ThemeManager', () => {
    expect(createThemeManager()).toBeInstanceOf(ThemeManager);
  });

  it('getDefaultDarkTheme returns copy', () => {
    const theme = getDefaultDarkTheme();
    expect(theme.id).toBe(DEFAULT_DARK_THEME.id);
    expect(theme).not.toBe(DEFAULT_DARK_THEME);
  });

  it('getDefaultLightTheme returns copy', () => {
    const theme = getDefaultLightTheme();
    expect(theme.id).toBe(DEFAULT_LIGHT_THEME.id);
  });

  it('getAllThemePresets returns all', () => {
    expect(getAllThemePresets().length).toBe(THEME_PRESETS.length);
  });

  it('generateThemeCSSVariables generates CSS', () => {
    const css = generateThemeCSSVariables(DEFAULT_DARK_THEME);
    expect(css).toContain('--color-primary');
  });
});
