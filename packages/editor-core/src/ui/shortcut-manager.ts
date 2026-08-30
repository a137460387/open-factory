/**
 * 全局快捷键体系
 *
 * 核心功能：
 * 1. 可自定义的快捷键映射
 * 2. 可视化快捷键编辑器
 * 3. 预设快捷键方案
 * 4. 快捷键冲突检测
 */

import { logger } from '../utils/logger.js';
import type {
  ModifierKey,
  ShortcutActionType,
  ShortcutDefinition,
  ShortcutScheme,
  ShortcutConflict,
  ShortcutStats,
  ShortcutConfig,
} from './shortcut-types.js';
import { DEFAULT_SHORTCUT_CONFIG } from './shortcut-types.js';
import { ALL_SHORTCUT_SCHEMES, PREMIERE_SCHEME } from './shortcut-schemes.js';

// Re-export types and schemes for backward compatibility
export type {
  ModifierKey,
  ShortcutActionType,
  ShortcutDefinition,
  ShortcutScheme,
  ShortcutConflict,
  ShortcutStats,
  ShortcutConfig,
} from './shortcut-types.js';
export { DEFAULT_SHORTCUT_CONFIG } from './shortcut-types.js';
export { PREMIERE_SCHEME, FINAL_CUT_SCHEME, DAVINCI_RESOLVE_SCHEME, ALL_SHORTCUT_SCHEMES } from './shortcut-schemes.js';

// ==================== 快捷键管理器 ====================

export class ShortcutManager {
  private config: ShortcutConfig;
  private schemes: Map<string, ShortcutScheme> = new Map();
  private activeScheme: ShortcutScheme;
  private actionHandlers: Map<ShortcutActionType, (event: KeyboardEvent) => void> = new Map();
  private listeners: Set<(shortcuts: ShortcutDefinition[]) => void> = new Set();
  private keyStates: Map<string, boolean> = new Map();
  private keyRepeatTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(config?: Partial<ShortcutConfig>) {
    this.config = { ...DEFAULT_SHORTCUT_CONFIG, ...config };

    for (const scheme of ALL_SHORTCUT_SCHEMES) {
      this.schemes.set(scheme.id, scheme);
    }

    this.activeScheme = this.schemes.get(this.config.activeSchemeId) || PREMIERE_SCHEME;

    this.loadCustomShortcuts();
  }

  registerAction(action: ShortcutActionType, handler: (event: KeyboardEvent) => void): void {
    this.actionHandlers.set(action, handler);
  }

  unregisterAction(action: ShortcutActionType): void {
    this.actionHandlers.delete(action);
  }

  handleKeyEvent(event: KeyboardEvent): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const key = this.normalizeKey(event.key);
    const modifiers = this.getModifiers(event);

    const shortcut = this.findShortcut(key, modifiers);
    if (!shortcut || !shortcut.enabled) {
      return false;
    }

    if (shortcut.context && !this.isContextActive(shortcut.context)) {
      return false;
    }

    const handler = this.actionHandlers.get(shortcut.action);
    if (handler) {
      handler(event);
      event.preventDefault();
      event.stopPropagation();
      return true;
    }

    return false;
  }

  handleKeyDown(event: KeyboardEvent): void {
    const key = this.normalizeKey(event.key);
    this.keyStates.set(key, true);

    if (this.config.enableKeyRepeat) {
      this.startKeyRepeat(key, event);
    }
  }

  handleKeyUp(event: KeyboardEvent): void {
    const key = this.normalizeKey(event.key);
    this.keyStates.set(key, false);
    this.stopKeyRepeat(key);
  }

  private findShortcut(key: string, modifiers: ModifierKey[]): ShortcutDefinition | undefined {
    return this.activeScheme.shortcuts.find((shortcut) => {
      if (!shortcut.enabled) return false;
      if (!shortcut.keys.includes(key)) return false;

      const requiredModifiers = shortcut.modifiers.sort();
      const currentModifiers = modifiers.sort();

      if (requiredModifiers.length !== currentModifiers.length) return false;

      return requiredModifiers.every((mod, index) => mod === currentModifiers[index]);
    });
  }

  private getModifiers(event: KeyboardEvent): ModifierKey[] {
    const modifiers: ModifierKey[] = [];
    if (event.ctrlKey) modifiers.push('ctrl');
    if (event.altKey) modifiers.push('alt');
    if (event.shiftKey) modifiers.push('shift');
    if (event.metaKey) modifiers.push('meta');
    return modifiers;
  }

  private normalizeKey(key: string): string {
    const keyMap: Record<string, string> = {
      ' ': 'Space',
      ArrowUp: 'ArrowUp',
      ArrowDown: 'ArrowDown',
      ArrowLeft: 'ArrowLeft',
      ArrowRight: 'ArrowRight',
      Escape: 'Escape',
      Delete: 'Delete',
      Backspace: 'Backspace',
      Tab: 'Tab',
      Enter: 'Enter',
      Home: 'Home',
      End: 'End',
      PageUp: 'PageUp',
      PageDown: 'PageDown',
      Insert: 'Insert',
    };
    return keyMap[key] || key.toUpperCase();
  }

  private isContextActive(_context: string): boolean {
    return true;
  }

  private startKeyRepeat(key: string, event: KeyboardEvent): void {
    this.stopKeyRepeat(key);

    const timer = setTimeout(() => {
      const intervalTimer = setInterval(() => {
        if (!this.keyStates.get(key)) {
          clearInterval(intervalTimer);
          return;
        }
        this.handleKeyEvent(event);
      }, this.config.keyRepeatInterval);

      this.keyRepeatTimers.set(key, intervalTimer);
    }, this.config.keyRepeatDelay);

    this.keyRepeatTimers.set(key, timer);
  }

  private stopKeyRepeat(key: string): void {
    const timer = this.keyRepeatTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      clearInterval(timer);
      this.keyRepeatTimers.delete(key);
    }
  }

  switchScheme(schemeId: string): boolean {
    const scheme = this.schemes.get(schemeId);
    if (!scheme) {
      return false;
    }

    this.activeScheme = scheme;
    this.config.activeSchemeId = schemeId;
    this.saveCustomShortcuts();
    this.notifyListeners();

    return true;
  }

  getActiveScheme(): ShortcutScheme {
    return this.activeScheme;
  }

  getAllSchemes(): ShortcutScheme[] {
    return Array.from(this.schemes.values());
  }

  updateShortcut(shortcutId: string, updates: Partial<ShortcutDefinition>): boolean {
    const shortcut = this.activeScheme.shortcuts.find((s) => s.id === shortcutId);
    if (!shortcut || !shortcut.customizable) {
      return false;
    }

    if (this.config.enableConflictDetection && updates.keys) {
      const conflict = this.checkConflict(shortcutId, updates.keys, updates.modifiers || shortcut.modifiers);
      if (conflict) {
        logger.warn('Shortcut conflict detected:', conflict);
        return false;
      }
    }

    Object.assign(shortcut, updates);
    this.activeScheme.updatedAt = Date.now();
    this.saveCustomShortcuts();
    this.notifyListeners();

    return true;
  }

  checkConflict(shortcutId: string, keys: string[], modifiers: ModifierKey[]): ShortcutConflict | null {
    for (const shortcut of this.activeScheme.shortcuts) {
      if (shortcut.id === shortcutId || !shortcut.enabled) continue;

      if (shortcut.keys.length !== keys.length) continue;

      const keysMatch = shortcut.keys.every((k, i) => k === keys[i]);
      const modifiersMatch =
        shortcut.modifiers.length === modifiers.length && shortcut.modifiers.every((m, i) => m === modifiers[i]);

      if (keysMatch && modifiersMatch) {
        return {
          shortcut1: shortcut,
          shortcut2: { ...shortcut, keys, modifiers },
          context: shortcut.context || 'global',
        };
      }
    }

    return null;
  }

  getStats(): ShortcutStats {
    const shortcuts = this.activeScheme.shortcuts;

    return {
      totalShortcuts: shortcuts.length,
      enabledShortcuts: shortcuts.filter((s) => s.enabled).length,
      disabledShortcuts: shortcuts.filter((s) => !s.enabled).length,
      conflicts: 0,
      customShortcuts: shortcuts.filter((s) => s.customizable).length,
    };
  }

  getShortcuts(): ShortcutDefinition[] {
    return [...this.activeScheme.shortcuts];
  }

  getShortcutsByCategory(): Map<string, ShortcutDefinition[]> {
    const categories = new Map<string, ShortcutDefinition[]>();

    for (const shortcut of this.activeScheme.shortcuts) {
      const category = shortcut.category || '其他';
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(shortcut);
    }

    return categories;
  }

  searchShortcuts(query: string): ShortcutDefinition[] {
    const lowerQuery = query.toLowerCase();

    return this.activeScheme.shortcuts.filter(
      (shortcut) =>
        shortcut.label.toLowerCase().includes(lowerQuery) ||
        shortcut.description.toLowerCase().includes(lowerQuery) ||
        shortcut.action.toLowerCase().includes(lowerQuery),
    );
  }

  resetToDefault(): void {
    const defaultScheme = ALL_SHORTCUT_SCHEMES.find((s) => s.isDefault);
    if (defaultScheme) {
      this.activeScheme = { ...defaultScheme };
      this.config.activeSchemeId = defaultScheme.id;
      this.saveCustomShortcuts();
      this.notifyListeners();
    }
  }

  exportConfig(): string {
    return JSON.stringify(
      {
        schemeId: this.activeScheme.id,
        shortcuts: this.activeScheme.shortcuts,
      },
      null,
      2,
    );
  }

  importConfig(configJson: string): boolean {
    try {
      const config = JSON.parse(configJson);

      if (config.schemeId && this.schemes.has(config.schemeId)) {
        this.switchScheme(config.schemeId);
      }

      if (config.shortcuts && Array.isArray(config.shortcuts)) {
        for (const importedShortcut of config.shortcuts) {
          const existing = this.activeScheme.shortcuts.find((s) => s.id === importedShortcut.id);
          if (existing && existing.customizable) {
            Object.assign(existing, importedShortcut);
          }
        }
      }

      this.activeScheme.updatedAt = Date.now();
      this.saveCustomShortcuts();
      this.notifyListeners();

      return true;
    } catch {
      return false;
    }
  }

  onShortcutsChange(listener: (shortcuts: ShortcutDefinition[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.activeScheme.shortcuts);
      } catch (error) {
        logger.error('Shortcut listener error:', error);
      }
    }
  }

  private saveCustomShortcuts(): void {
    try {
      localStorage.setItem(this.config.storageKey, this.exportConfig());
    } catch {
      // Storage not available
    }
  }

  private loadCustomShortcuts(): void {
    try {
      const saved = localStorage.getItem(this.config.storageKey);
      if (saved) {
        this.importConfig(saved);
      }
    } catch {
      // Storage not available
    }
  }

  updateConfig(patch: Partial<ShortcutConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  getConfig(): ShortcutConfig {
    return { ...this.config };
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  destroy(): void {
    for (const timer of this.keyRepeatTimers.values()) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    this.keyRepeatTimers.clear();

    this.keyStates.clear();
    this.actionHandlers.clear();
    this.listeners.clear();
  }
}

// ==================== 工厂函数 ====================

export function createShortcutManager(config?: Partial<ShortcutConfig>): ShortcutManager {
  return new ShortcutManager(config);
}

export function getShortcutScheme(schemeId: string): ShortcutScheme | undefined {
  return ALL_SHORTCUT_SCHEMES.find((s) => s.id === schemeId);
}

export function getAllShortcutSchemes(): ShortcutScheme[] {
  return [...ALL_SHORTCUT_SCHEMES];
}

export function formatShortcutKeys(shortcut: ShortcutDefinition): string {
  const parts: string[] = [];

  for (const mod of shortcut.modifiers) {
    switch (mod) {
      case 'ctrl':
        parts.push('Ctrl');
        break;
      case 'alt':
        parts.push('Alt');
        break;
      case 'shift':
        parts.push('Shift');
        break;
      case 'meta':
        parts.push('⌘');
        break;
    }
  }

  for (const key of shortcut.keys) {
    parts.push(key);
  }

  return parts.join(' + ');
}
