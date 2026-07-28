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
import { DEFAULT_SHORTCUT_CONFIG } from './shortcut-types.js';
import { ALL_SHORTCUT_SCHEMES, PREMIERE_SCHEME } from './shortcut-schemes.js';
export { DEFAULT_SHORTCUT_CONFIG } from './shortcut-types.js';
export { PREMIERE_SCHEME, FINAL_CUT_SCHEME, DAVINCI_RESOLVE_SCHEME, ALL_SHORTCUT_SCHEMES } from './shortcut-schemes.js';
// ==================== 快捷键管理器 ====================
export class ShortcutManager {
    config;
    schemes = new Map();
    activeScheme;
    actionHandlers = new Map();
    listeners = new Set();
    keyStates = new Map();
    keyRepeatTimers = new Map();
    constructor(config) {
        this.config = { ...DEFAULT_SHORTCUT_CONFIG, ...config };
        for (const scheme of ALL_SHORTCUT_SCHEMES) {
            this.schemes.set(scheme.id, scheme);
        }
        this.activeScheme = this.schemes.get(this.config.activeSchemeId) || PREMIERE_SCHEME;
        this.loadCustomShortcuts();
    }
    registerAction(action, handler) {
        this.actionHandlers.set(action, handler);
    }
    unregisterAction(action) {
        this.actionHandlers.delete(action);
    }
    handleKeyEvent(event) {
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
    handleKeyDown(event) {
        const key = this.normalizeKey(event.key);
        this.keyStates.set(key, true);
        if (this.config.enableKeyRepeat) {
            this.startKeyRepeat(key, event);
        }
    }
    handleKeyUp(event) {
        const key = this.normalizeKey(event.key);
        this.keyStates.set(key, false);
        this.stopKeyRepeat(key);
    }
    findShortcut(key, modifiers) {
        return this.activeScheme.shortcuts.find(shortcut => {
            if (!shortcut.enabled)
                return false;
            if (!shortcut.keys.includes(key))
                return false;
            const requiredModifiers = shortcut.modifiers.sort();
            const currentModifiers = modifiers.sort();
            if (requiredModifiers.length !== currentModifiers.length)
                return false;
            return requiredModifiers.every((mod, index) => mod === currentModifiers[index]);
        });
    }
    getModifiers(event) {
        const modifiers = [];
        if (event.ctrlKey)
            modifiers.push('ctrl');
        if (event.altKey)
            modifiers.push('alt');
        if (event.shiftKey)
            modifiers.push('shift');
        if (event.metaKey)
            modifiers.push('meta');
        return modifiers;
    }
    normalizeKey(key) {
        const keyMap = {
            ' ': 'Space',
            'ArrowUp': 'ArrowUp',
            'ArrowDown': 'ArrowDown',
            'ArrowLeft': 'ArrowLeft',
            'ArrowRight': 'ArrowRight',
            'Escape': 'Escape',
            'Delete': 'Delete',
            'Backspace': 'Backspace',
            'Tab': 'Tab',
            'Enter': 'Enter',
            'Home': 'Home',
            'End': 'End',
            'PageUp': 'PageUp',
            'PageDown': 'PageDown',
            'Insert': 'Insert',
        };
        return keyMap[key] || key.toUpperCase();
    }
    isContextActive(_context) {
        return true;
    }
    startKeyRepeat(key, event) {
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
    stopKeyRepeat(key) {
        const timer = this.keyRepeatTimers.get(key);
        if (timer) {
            clearTimeout(timer);
            clearInterval(timer);
            this.keyRepeatTimers.delete(key);
        }
    }
    switchScheme(schemeId) {
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
    getActiveScheme() {
        return this.activeScheme;
    }
    getAllSchemes() {
        return Array.from(this.schemes.values());
    }
    updateShortcut(shortcutId, updates) {
        const shortcut = this.activeScheme.shortcuts.find(s => s.id === shortcutId);
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
    checkConflict(shortcutId, keys, modifiers) {
        for (const shortcut of this.activeScheme.shortcuts) {
            if (shortcut.id === shortcutId || !shortcut.enabled)
                continue;
            if (shortcut.keys.length !== keys.length)
                continue;
            const keysMatch = shortcut.keys.every((k, i) => k === keys[i]);
            const modifiersMatch = shortcut.modifiers.length === modifiers.length &&
                shortcut.modifiers.every((m, i) => m === modifiers[i]);
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
    getStats() {
        const shortcuts = this.activeScheme.shortcuts;
        return {
            totalShortcuts: shortcuts.length,
            enabledShortcuts: shortcuts.filter(s => s.enabled).length,
            disabledShortcuts: shortcuts.filter(s => !s.enabled).length,
            conflicts: 0,
            customShortcuts: shortcuts.filter(s => s.customizable).length,
        };
    }
    getShortcuts() {
        return [...this.activeScheme.shortcuts];
    }
    getShortcutsByCategory() {
        const categories = new Map();
        for (const shortcut of this.activeScheme.shortcuts) {
            const category = shortcut.category || '其他';
            if (!categories.has(category)) {
                categories.set(category, []);
            }
            categories.get(category).push(shortcut);
        }
        return categories;
    }
    searchShortcuts(query) {
        const lowerQuery = query.toLowerCase();
        return this.activeScheme.shortcuts.filter(shortcut => shortcut.label.toLowerCase().includes(lowerQuery) ||
            shortcut.description.toLowerCase().includes(lowerQuery) ||
            shortcut.action.toLowerCase().includes(lowerQuery));
    }
    resetToDefault() {
        const defaultScheme = ALL_SHORTCUT_SCHEMES.find(s => s.isDefault);
        if (defaultScheme) {
            this.activeScheme = { ...defaultScheme };
            this.config.activeSchemeId = defaultScheme.id;
            this.saveCustomShortcuts();
            this.notifyListeners();
        }
    }
    exportConfig() {
        return JSON.stringify({
            schemeId: this.activeScheme.id,
            shortcuts: this.activeScheme.shortcuts,
        }, null, 2);
    }
    importConfig(configJson) {
        try {
            const config = JSON.parse(configJson);
            if (config.schemeId && this.schemes.has(config.schemeId)) {
                this.switchScheme(config.schemeId);
            }
            if (config.shortcuts && Array.isArray(config.shortcuts)) {
                for (const importedShortcut of config.shortcuts) {
                    const existing = this.activeScheme.shortcuts.find(s => s.id === importedShortcut.id);
                    if (existing && existing.customizable) {
                        Object.assign(existing, importedShortcut);
                    }
                }
            }
            this.activeScheme.updatedAt = Date.now();
            this.saveCustomShortcuts();
            this.notifyListeners();
            return true;
        }
        catch {
            return false;
        }
    }
    onShortcutsChange(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    notifyListeners() {
        for (const listener of this.listeners) {
            try {
                listener(this.activeScheme.shortcuts);
            }
            catch (error) {
                logger.error('Shortcut listener error:', error);
            }
        }
    }
    saveCustomShortcuts() {
        try {
            localStorage.setItem(this.config.storageKey, this.exportConfig());
        }
        catch {
            // Storage not available
        }
    }
    loadCustomShortcuts() {
        try {
            const saved = localStorage.getItem(this.config.storageKey);
            if (saved) {
                this.importConfig(saved);
            }
        }
        catch {
            // Storage not available
        }
    }
    updateConfig(patch) {
        this.config = { ...this.config, ...patch };
    }
    getConfig() {
        return { ...this.config };
    }
    isEnabled() {
        return this.config.enabled;
    }
    setEnabled(enabled) {
        this.config.enabled = enabled;
    }
    destroy() {
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
export function createShortcutManager(config) {
    return new ShortcutManager(config);
}
export function getShortcutScheme(schemeId) {
    return ALL_SHORTCUT_SCHEMES.find(s => s.id === schemeId);
}
export function getAllShortcutSchemes() {
    return [...ALL_SHORTCUT_SCHEMES];
}
export function formatShortcutKeys(shortcut) {
    const parts = [];
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
//# sourceMappingURL=shortcut-manager.js.map