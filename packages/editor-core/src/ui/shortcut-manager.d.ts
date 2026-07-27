/**
 * 全局快捷键体系
 *
 * 核心功能：
 * 1. 可自定义的快捷键映射
 * 2. 可视化快捷键编辑器
 * 3. 预设快捷键方案
 * 4. 快捷键冲突检测
 */
/** 快捷键修饰键 */
export type ModifierKey = 'ctrl' | 'alt' | 'shift' | 'meta';
/** 快捷键动作类型 */
export type ShortcutActionType = 'play-pause' | 'stop' | 'next-frame' | 'previous-frame' | 'next-clip' | 'previous-clip' | 'go-to-start' | 'go-to-end' | 'split-clip' | 'delete-clip' | 'undo' | 'redo' | 'copy' | 'paste' | 'cut' | 'select-all' | 'deselect-all' | 'zoom-in' | 'zoom-out' | 'zoom-fit' | 'toggle-timeline' | 'toggle-preview' | 'toggle-media-panel' | 'toggle-effects-panel' | 'toggle-properties-panel' | 'toggle-zen-mode' | 'toggle-fullscreen' | 'export' | 'save' | 'save-as' | 'open' | 'new-project' | 'import-media' | 'render' | 'toggle-playback' | 'mark-in' | 'mark-out' | 'clear-marks' | 'add-marker' | 'toggle-mute' | 'toggle-solo' | 'volume-up' | 'volume-down' | 'toggle-loop' | 'snap-to-grid' | 'toggle-snapping' | 'nudge-left' | 'nudge-right' | 'slip-clip' | 'slide-clip' | 'ripple-delete' | 'toggle-track-lock' | 'toggle-track-visibility' | 'toggle-track-solo' | 'custom';
/** 快捷键定义 */
export interface ShortcutDefinition {
    id: string;
    action: ShortcutActionType;
    keys: string[];
    modifiers: ModifierKey[];
    label: string;
    description: string;
    category: string;
    enabled: boolean;
    customizable: boolean;
    context?: string;
}
/** 快捷键方案 */
export interface ShortcutScheme {
    id: string;
    name: string;
    description: string;
    shortcuts: ShortcutDefinition[];
    isDefault: boolean;
    createdAt: number;
    updatedAt: number;
}
/** 快捷键冲突 */
export interface ShortcutConflict {
    shortcut1: ShortcutDefinition;
    shortcut2: ShortcutDefinition;
    context: string;
}
/** 快捷键统计 */
export interface ShortcutStats {
    totalShortcuts: number;
    enabledShortcuts: number;
    disabledShortcuts: number;
    conflicts: number;
    customShortcuts: number;
}
/** 快捷键配置 */
export interface ShortcutConfig {
    /** 是否启用快捷键 */
    enabled: boolean;
    /** 当前方案ID */
    activeSchemeId: string;
    /** 是否启用快捷键提示 */
    showTooltips: boolean;
    /** 快捷键提示延迟（ms） */
    tooltipDelay: number;
    /** 是否启用按键重复 */
    enableKeyRepeat: boolean;
    /** 按键重复延迟（ms） */
    keyRepeatDelay: number;
    /** 按键重复间隔（ms） */
    keyRepeatInterval: number;
    /** 是否启用冲突检测 */
    enableConflictDetection: boolean;
    /** 自定义快捷键存储键 */
    storageKey: string;
}
/** 默认配置 */
export declare const DEFAULT_SHORTCUT_CONFIG: ShortcutConfig;
/** Premiere 风格方案 */
export declare const PREMIERE_SCHEME: ShortcutScheme;
/** Final Cut Pro 风格方案 */
export declare const FINAL_CUT_SCHEME: ShortcutScheme;
/** DaVinci Resolve 风格方案 */
export declare const DAVINCI_RESOLVE_SCHEME: ShortcutScheme;
/** 所有预设方案 */
export declare const ALL_SHORTCUT_SCHEMES: ShortcutScheme[];
/**
 * 快捷键管理器
 *
 * 管理快捷键映射、方案切换和冲突检测
 */
export declare class ShortcutManager {
    private config;
    private schemes;
    private activeScheme;
    private actionHandlers;
    private listeners;
    private keyStates;
    private keyRepeatTimers;
    constructor(config?: Partial<ShortcutConfig>);
    /**
     * 注册动作处理器
     */
    registerAction(action: ShortcutActionType, handler: (event: KeyboardEvent) => void): void;
    /**
     * 注销动作处理器
     */
    unregisterAction(action: ShortcutActionType): void;
    /**
     * 处理键盘事件
     */
    handleKeyEvent(event: KeyboardEvent): boolean;
    /**
     * 处理按键按下
     */
    handleKeyDown(event: KeyboardEvent): void;
    /**
     * 处理按键释放
     */
    handleKeyUp(event: KeyboardEvent): void;
    /**
     * 查找匹配的快捷键
     */
    private findShortcut;
    /**
     * 获取修饰键状态
     */
    private getModifiers;
    /**
     * 标准化按键名称
     */
    private normalizeKey;
    /**
     * 检查上下文是否活跃
     */
    private isContextActive;
    /**
     * 开始按键重复
     */
    private startKeyRepeat;
    /**
     * 停止按键重复
     */
    private stopKeyRepeat;
    /**
     * 切换方案
     */
    switchScheme(schemeId: string): boolean;
    /**
     * 获取当前方案
     */
    getActiveScheme(): ShortcutScheme;
    /**
     * 获取所有方案
     */
    getAllSchemes(): ShortcutScheme[];
    /**
     * 更新快捷键
     */
    updateShortcut(shortcutId: string, updates: Partial<ShortcutDefinition>): boolean;
    /**
     * 检查冲突
     */
    checkConflict(shortcutId: string, keys: string[], modifiers: ModifierKey[]): ShortcutConflict | null;
    /**
     * 获取快捷键统计
     */
    getStats(): ShortcutStats;
    /**
     * 获取快捷键列表
     */
    getShortcuts(): ShortcutDefinition[];
    /**
     * 获取分类的快捷键
     */
    getShortcutsByCategory(): Map<string, ShortcutDefinition[]>;
    /**
     * 搜索快捷键
     */
    searchShortcuts(query: string): ShortcutDefinition[];
    /**
     * 重置为默认方案
     */
    resetToDefault(): void;
    /**
     * 导出快捷键配置
     */
    exportConfig(): string;
    /**
     * 导入快捷键配置
     */
    importConfig(configJson: string): boolean;
    /**
     * 注册状态监听器
     */
    onShortcutsChange(listener: (shortcuts: ShortcutDefinition[]) => void): () => void;
    /**
     * 通知监听器
     */
    private notifyListeners;
    /**
     * 保存自定义快捷键
     */
    private saveCustomShortcuts;
    /**
     * 加载自定义快捷键
     */
    private loadCustomShortcuts;
    /**
     * 更新配置
     */
    updateConfig(patch: Partial<ShortcutConfig>): void;
    /**
     * 获取配置
     */
    getConfig(): ShortcutConfig;
    /**
     * 检查快捷键是否启用
     */
    isEnabled(): boolean;
    /**
     * 启用/禁用快捷键
     */
    setEnabled(enabled: boolean): void;
    /**
     * 销毁管理器
     */
    destroy(): void;
}
/**
 * 创建快捷键管理器实例
 */
export declare function createShortcutManager(config?: Partial<ShortcutConfig>): ShortcutManager;
/**
 * 获取预设方案
 */
export declare function getShortcutScheme(schemeId: string): ShortcutScheme | undefined;
/**
 * 获取所有预设方案
 */
export declare function getAllShortcutSchemes(): ShortcutScheme[];
/**
 * 格式化快捷键显示
 */
export declare function formatShortcutKeys(shortcut: ShortcutDefinition): string;
//# sourceMappingURL=shortcut-manager.d.ts.map