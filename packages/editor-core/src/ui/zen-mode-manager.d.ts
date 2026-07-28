/**
 * Zen 专注模式
 *
 * 核心功能：
 * 1. 一键隐藏所有非必要UI元素
 * 2. 支持自定义保留元素
 * 3. 自动调整背景色为深色
 * 4. 平滑过渡动画
 */
export type ZenModeStatus = 'inactive' | 'activating' | 'active' | 'deactivating';
/** UI 元素类型 */
export type UIElementType = 'menu-bar' | 'toolbar' | 'timeline' | 'preview' | 'media-panel' | 'effects-panel' | 'audio-panel' | 'color-panel' | 'text-panel' | 'transitions-panel' | 'export-panel' | 'status-bar' | 'navigator' | 'properties-panel' | 'history-panel' | 'bookmarks-panel' | 'notes-panel' | 'comments-panel' | 'collaboration-panel' | 'ai-panel' | 'shortcuts-panel' | 'settings-panel';
/** 元素可见性配置 */
export interface ElementVisibility {
    elementType: UIElementType;
    visible: boolean;
    opacity: number;
    transitionMs: number;
}
/** Zen 模式配置 */
export interface ZenModeConfig {
    /** 是否启用 Zen 模式 */
    enabled: boolean;
    /** 背景颜色 */
    backgroundColor: string;
    /** 背景透明度 */
    backgroundOpacity: number;
    /** 过渡动画时长（ms） */
    transitionDuration: number;
    /** 是否自动隐藏鼠标 */
    autoHideCursor: boolean;
    /** 鼠标隐藏延迟（ms） */
    cursorHideDelay: number;
    /** 是否显示退出提示 */
    showExitHint: boolean;
    /** 退出提示位置 */
    exitHintPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    /** 保留的UI元素 */
    retainedElements: UIElementType[];
    /** 是否启用快捷键 */
    enableShortcuts: boolean;
    /** 退出快捷键 */
    exitShortcut: string;
}
/** 默认配置 */
export declare const DEFAULT_ZEN_CONFIG: ZenModeConfig;
/** Zen 模式状态 */
export interface ZenModeState {
    status: ZenModeStatus;
    activeElements: UIElementType[];
    hiddenElements: UIElementType[];
    cursorVisible: boolean;
    cursorTimeout: ReturnType<typeof setTimeout> | null;
    lastActivity: number;
}
/**
 * Zen 模式管理器
 *
 * 管理 Zen 模式的状态和UI元素可见性
 */
export declare class ZenModeManager {
    private config;
    private state;
    private listeners;
    private elementVisibility;
    private cursorTimeout;
    constructor(config?: Partial<ZenModeConfig>);
    /**
     * 初始化元素可见性
     */
    private initializeElementVisibility;
    /**
     * 激活 Zen 模式
     */
    activate(): void;
    /**
     * 停用 Zen 模式
     */
    deactivate(): void;
    /**
     * 切换 Zen 模式
     */
    toggle(): void;
    /**
     * 更新配置
     */
    updateConfig(patch: Partial<ZenModeConfig>): void;
    /**
     * 获取当前状态
     */
    getState(): ZenModeState;
    /**
     * 获取当前配置
     */
    getConfig(): ZenModeConfig;
    /**
     * 检查元素是否可见
     */
    isElementVisible(element: UIElementType): boolean;
    /**
     * 获取元素透明度
     */
    getElementOpacity(element: UIElementType): number;
    /**
     * 设置元素可见性
     */
    setElementVisibility(element: UIElementType, visible: boolean): void;
    /**
     * 添加保留元素
     */
    addRetainedElement(element: UIElementType): void;
    /**
     * 移除保留元素
     */
    removeRetainedElement(element: UIElementType): void;
    /**
     * 记录用户活动
     */
    recordActivity(): void;
    /**
     * 设置光标自动隐藏
     */
    private setupCursorAutoHide;
    /**
     * 注册状态监听器
     */
    onStateChange(listener: (state: ZenModeState) => void): () => void;
    /**
     * 通知监听器
     */
    private notifyListeners;
    /**
     * 获取保留元素列表
     */
    getRetainedElements(): UIElementType[];
    /**
     * 获取隐藏元素列表
     */
    getHiddenElements(): UIElementType[];
    /**
     * 检查是否处于 Zen 模式
     */
    isActive(): boolean;
    /**
     * 销毁管理器
     */
    destroy(): void;
}
/** Zen 模式预设 */
export interface ZenModePreset {
    id: string;
    name: string;
    description: string;
    config: Partial<ZenModeConfig>;
}
/** 预设列表 */
export declare const ZEN_MODE_PRESETS: ZenModePreset[];
/**
 * 创建 Zen 模式管理器实例
 */
export declare function createZenModeManager(config?: Partial<ZenModeConfig>): ZenModeManager;
/**
 * 获取预设配置
 */
export declare function getZenModePreset(presetId: string): ZenModePreset | undefined;
/**
 * 获取所有预设
 */
export declare function getAllZenModePresets(): ZenModePreset[];
//# sourceMappingURL=zen-mode-manager.d.ts.map