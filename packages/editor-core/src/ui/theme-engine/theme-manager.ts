/**
 * Theme manager - manages theme loading, switching, and customization
 */

import { logger } from '../../utils/logger.js';
import type {
  ThemeConfig,
  ThemePreset,
  ThemeStats,
  TimelineStyle,
  LayoutConfig,
  FontConfig,
  AnimationConfig,
} from './types.js';
import { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME } from './default-themes.js';
import { THEME_PRESETS } from './theme-presets.js';
import { generateCSSVariables } from './css-variables.js';

/**
 * Theme manager
 *
 * Manages theme loading, switching, and customization
 */
export class ThemeManager {
  private themes: Map<string, ThemeConfig> = new Map();
  private activeTheme: ThemeConfig;
  private listeners: Set<(theme: ThemeConfig) => void> = new Set();
  private storageKey: string = 'open-factory-themes';

  constructor() {
    // Load default themes
    this.themes.set(DEFAULT_DARK_THEME.id, DEFAULT_DARK_THEME);
    this.themes.set(DEFAULT_LIGHT_THEME.id, DEFAULT_LIGHT_THEME);

    // Load custom themes from storage
    this.loadCustomThemes();

    // Set active theme
    this.activeTheme = DEFAULT_DARK_THEME;
  }

  /**
   * Get current theme
   */
  getActiveTheme(): ThemeConfig {
    return this.activeTheme;
  }

  /**
   * Switch theme
   */
  switchTheme(themeId: string): boolean {
    const theme = this.themes.get(themeId);
    if (!theme) {
      return false;
    }

    this.activeTheme = theme;
    this.applyTheme(theme);
    this.saveActiveTheme(themeId);
    this.notifyListeners();

    return true;
  }

  /**
   * Create custom theme
   */
  createTheme(config: Partial<ThemeConfig>): ThemeConfig {
    const theme: ThemeConfig = {
      id: config.id || `custom-${Date.now()}`,
      name: config.name || '自定义主题',
      description: config.description || '',
      mode: config.mode || 'dark',
      colors: config.colors || { ...DEFAULT_DARK_THEME.colors },
      timeline: config.timeline || { ...DEFAULT_DARK_THEME.timeline },
      layout: config.layout || { ...DEFAULT_DARK_THEME.layout },
      fonts: config.fonts || { ...DEFAULT_DARK_THEME.fonts },
      animations: config.animations || { ...DEFAULT_DARK_THEME.animations },
      isDefault: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.themes.set(theme.id, theme);
    this.saveCustomThemes();

    return theme;
  }

  /**
   * Update theme
   */
  updateTheme(themeId: string, updates: Partial<ThemeConfig>): boolean {
    const theme = this.themes.get(themeId);
    if (!theme || theme.isDefault) {
      return false;
    }

    Object.assign(theme, updates, { updatedAt: Date.now() });
    this.saveCustomThemes();

    // If updating active theme, re-apply
    if (this.activeTheme.id === themeId) {
      this.activeTheme = theme;
      this.applyTheme(theme);
      this.notifyListeners();
    }

    return true;
  }

  /**
   * Delete theme
   */
  deleteTheme(themeId: string): boolean {
    const theme = this.themes.get(themeId);
    if (!theme || theme.isDefault) {
      return false;
    }

    this.themes.delete(themeId);
    this.saveCustomThemes();

    // If deleting active theme, switch to default
    if (this.activeTheme.id === themeId) {
      this.switchTheme(DEFAULT_DARK_THEME.id);
    }

    return true;
  }

  /**
   * Get all themes
   */
  getAllThemes(): ThemeConfig[] {
    return Array.from(this.themes.values());
  }

  /**
   * Get theme by ID
   */
  getTheme(themeId: string): ThemeConfig | undefined {
    return this.themes.get(themeId);
  }

  /**
   * Get presets
   */
  getPresets(): ThemePreset[] {
    return [...THEME_PRESETS];
  }

  /**
   * Apply preset
   */
  applyPreset(presetId: string): boolean {
    const preset = THEME_PRESETS.find(p => p.id === presetId);
    if (!preset) {
      return false;
    }

    const theme = this.createTheme({
      ...preset.config,
      id: presetId,
      name: preset.name,
      description: preset.description,
    });

    return this.switchTheme(theme.id);
  }

  /**
   * Update color by path
   */
  updateColor(path: string, value: string): void {
    const parts = path.split('.');
    let target: any = this.activeTheme.colors;

    for (let i = 0; i < parts.length - 1; i++) {
      target = target[parts[i]];
    }

    target[parts[parts.length - 1]] = value;
    this.activeTheme.updatedAt = Date.now();
    this.applyTheme(this.activeTheme);
    this.notifyListeners();
  }

  /**
   * Update timeline style
   */
  updateTimelineStyle(updates: Partial<TimelineStyle>): void {
    Object.assign(this.activeTheme.timeline, updates);
    this.activeTheme.updatedAt = Date.now();
    this.applyTheme(this.activeTheme);
    this.notifyListeners();
  }

  /**
   * Update layout
   */
  updateLayout(updates: Partial<LayoutConfig>): void {
    Object.assign(this.activeTheme.layout, updates);
    this.activeTheme.updatedAt = Date.now();
    this.applyTheme(this.activeTheme);
    this.notifyListeners();
  }

  /**
   * Update fonts
   */
  updateFonts(updates: Partial<FontConfig>): void {
    Object.assign(this.activeTheme.fonts, updates);
    this.activeTheme.updatedAt = Date.now();
    this.applyTheme(this.activeTheme);
    this.notifyListeners();
  }

  /**
   * Update animations
   */
  updateAnimations(updates: Partial<AnimationConfig>): void {
    Object.assign(this.activeTheme.animations, updates);
    this.activeTheme.updatedAt = Date.now();
    this.applyTheme(this.activeTheme);
    this.notifyListeners();
  }

  /**
   * Reset to default theme
   */
  resetToDefault(): void {
    this.switchTheme(DEFAULT_DARK_THEME.id);
  }

  /**
   * Reset theme to defaults
   */
  resetTheme(themeId: string): boolean {
    const theme = this.themes.get(themeId);
    if (!theme || theme.isDefault) {
      return false;
    }

    // Find matching default theme
    const defaultTheme = theme.mode === 'light' ? DEFAULT_LIGHT_THEME : DEFAULT_DARK_THEME;
    Object.assign(theme, defaultTheme, {
      id: theme.id,
      name: theme.name,
      description: theme.description,
      isDefault: false,
      createdAt: theme.createdAt,
      updatedAt: Date.now(),
    });

    this.saveCustomThemes();

    if (this.activeTheme.id === themeId) {
      this.activeTheme = theme;
      this.applyTheme(theme);
      this.notifyListeners();
    }

    return true;
  }

  /**
   * Export theme as JSON
   */
  exportTheme(themeId: string): string | null {
    const theme = this.themes.get(themeId);
    if (!theme) {
      return null;
    }

    return JSON.stringify(theme, null, 2);
  }

  /**
   * Import theme from JSON
   */
  importTheme(themeJson: string): ThemeConfig | null {
    try {
      const theme = JSON.parse(themeJson) as ThemeConfig;

      // Validate theme structure
      if (!theme.id || !theme.name || !theme.colors) {
        return null;
      }

      // Generate new ID to avoid conflicts
      theme.id = `imported-${Date.now()}`;
      theme.isDefault = false;
      theme.createdAt = Date.now();
      theme.updatedAt = Date.now();

      this.themes.set(theme.id, theme);
      this.saveCustomThemes();

      return theme;
    } catch {
      return null;
    }
  }

  /**
   * Generate CSS variables
   */
  generateCSSVariables(theme?: ThemeConfig): string {
    return generateCSSVariables(theme || this.activeTheme);
  }

  /**
   * Apply theme to DOM
   */
  private applyTheme(theme: ThemeConfig): void {
    if (typeof document === 'undefined') {
      return;
    }

    const css = generateCSSVariables(theme);
    let styleEl = document.getElementById('theme-variables');

    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'theme-variables';
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = css;

    // Apply theme mode class to body
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${theme.mode}`);
  }

  /**
   * Register theme change listener
   */
  onThemeChange(listener: (theme: ThemeConfig) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify listeners
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.activeTheme);
      } catch (error) {
        logger.error('Theme listener error:', error);
      }
    }
  }

  /**
   * Save custom themes to storage
   */
  private saveCustomThemes(): void {
    try {
      const customThemes = Array.from(this.themes.values()).filter(t => !t.isDefault);
      localStorage.setItem(this.storageKey, JSON.stringify(customThemes));
    } catch {
      // Storage not available
    }
  }

  /**
   * Load custom themes from storage
   */
  private loadCustomThemes(): void {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const themes = JSON.parse(saved) as ThemeConfig[];
        for (const theme of themes) {
          this.themes.set(theme.id, theme);
        }
      }
    } catch {
      // Storage not available
    }
  }

  /**
   * Save active theme ID
   */
  private saveActiveTheme(themeId: string): void {
    try {
      localStorage.setItem(`${this.storageKey}-active`, themeId);
    } catch {
      // Storage not available
    }
  }

  /**
   * Load active theme
   */
  loadActiveTheme(): void {
    try {
      const themeId = localStorage.getItem(`${this.storageKey}-active`);
      if (themeId) {
        this.switchTheme(themeId);
      }
    } catch {
      // Storage not available
    }
  }

  /**
   * Get stats
   */
  getStats(): ThemeStats {
    const themes = Array.from(this.themes.values());

    return {
      totalThemes: themes.length,
      customThemes: themes.filter(t => !t.isDefault).length,
      activeTheme: this.activeTheme.id,
      lastModified: this.activeTheme.updatedAt,
    };
  }

  /**
   * Destroy manager
   */
  destroy(): void {
    this.listeners.clear();
    this.themes.clear();
  }
}

