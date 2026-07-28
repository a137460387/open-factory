/**
 * 全局快捷键体系
 *
 * 核心功能：
 * 1. 可自定义的快捷键映射
 * 2. 可视化快捷键编辑器
 * 3. 预设快捷键方案
 * 4. 快捷键冲突检测
 */
import type { ModifierKey, ShortcutActionType, ShortcutDefinition, ShortcutScheme, ShortcutConflict, ShortcutStats, ShortcutConfig } from './shortcut-types.js';
export type { ModifierKey, ShortcutActionType, ShortcutDefinition, ShortcutScheme, ShortcutConflict, ShortcutStats, ShortcutConfig } from './shortcut-types.js';
export { DEFAULT_SHORTCUT_CONFIG } from './shortcut-types.js';
export { PREMIERE_SCHEME, FINAL_CUT_SCHEME, DAVINCI_RESOLVE_SCHEME, ALL_SHORTCUT_SCHEMES } from './shortcut-schemes.js';
export declare class ShortcutManager {
    private config;
    private schemes;
    private activeScheme;
    private actionHandlers;
    private listeners;
    private keyStates;
    private keyRepeatTimers;
    constructor(config?: Partial<ShortcutConfig>);
    registerAction(action: ShortcutActionType, handler: (event: KeyboardEvent) => void): void;
    unregisterAction(action: ShortcutActionType): void;
    handleKeyEvent(event: KeyboardEvent): boolean;
    handleKeyDown(event: KeyboardEvent): void;
    handleKeyUp(event: KeyboardEvent): void;
    private findShortcut;
    private getModifiers;
    private normalizeKey;
    private isContextActive;
    private startKeyRepeat;
    private stopKeyRepeat;
    switchScheme(schemeId: string): boolean;
    getActiveScheme(): ShortcutScheme;
    getAllSchemes(): ShortcutScheme[];
    updateShortcut(shortcutId: string, updates: Partial<ShortcutDefinition>): boolean;
    checkConflict(shortcutId: string, keys: string[], modifiers: ModifierKey[]): ShortcutConflict | null;
    getStats(): ShortcutStats;
    getShortcuts(): ShortcutDefinition[];
    getShortcutsByCategory(): Map<string, ShortcutDefinition[]>;
    searchShortcuts(query: string): ShortcutDefinition[];
    resetToDefault(): void;
    exportConfig(): string;
    importConfig(configJson: string): boolean;
    onShortcutsChange(listener: (shortcuts: ShortcutDefinition[]) => void): () => void;
    private notifyListeners;
    private saveCustomShortcuts;
    private loadCustomShortcuts;
    updateConfig(patch: Partial<ShortcutConfig>): void;
    getConfig(): ShortcutConfig;
    isEnabled(): boolean;
    setEnabled(enabled: boolean): void;
    destroy(): void;
}
export declare function createShortcutManager(config?: Partial<ShortcutConfig>): ShortcutManager;
export declare function getShortcutScheme(schemeId: string): ShortcutScheme | undefined;
export declare function getAllShortcutSchemes(): ShortcutScheme[];
export declare function formatShortcutKeys(shortcut: ShortcutDefinition): string;
//# sourceMappingURL=shortcut-manager.d.ts.map