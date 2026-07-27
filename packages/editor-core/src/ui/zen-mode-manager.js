/**
 * Zen 专注模式
 *
 * 核心功能：
 * 1. 一键隐藏所有非必要UI元素
 * 2. 支持自定义保留元素
 * 3. 自动调整背景色为深色
 * 4. 平滑过渡动画
 */
import { logger } from '../utils/logger.js';
/** 默认配置 */
export const DEFAULT_ZEN_CONFIG = {
    enabled: true,
    backgroundColor: '#000000',
    backgroundOpacity: 0.95,
    transitionDuration: 300,
    autoHideCursor: true,
    cursorHideDelay: 3000,
    showExitHint: true,
    exitHintPosition: 'bottom-right',
    retainedElements: ['preview', 'timeline'],
    enableShortcuts: true,
    exitShortcut: 'Escape',
};
// ==================== Zen 模式管理器 ====================
/**
 * Zen 模式管理器
 *
 * 管理 Zen 模式的状态和UI元素可见性
 */
export class ZenModeManager {
    config;
    state;
    listeners = new Set();
    elementVisibility = new Map();
    cursorTimeout = null;
    constructor(config) {
        this.config = { ...DEFAULT_ZEN_CONFIG, ...config };
        this.state = {
            status: 'inactive',
            activeElements: [],
            hiddenElements: [],
            cursorVisible: true,
            cursorTimeout: null,
            lastActivity: Date.now(),
        };
        // Initialize element visibility
        this.initializeElementVisibility();
    }
    /**
     * 初始化元素可见性
     */
    initializeElementVisibility() {
        const allElements = [
            'menu-bar', 'toolbar', 'timeline', 'preview', 'media-panel',
            'effects-panel', 'audio-panel', 'color-panel', 'text-panel',
            'transitions-panel', 'export-panel', 'status-bar', 'navigator',
            'properties-panel', 'history-panel', 'bookmarks-panel', 'notes-panel',
            'comments-panel', 'collaboration-panel', 'ai-panel', 'shortcuts-panel',
            'settings-panel',
        ];
        for (const element of allElements) {
            this.elementVisibility.set(element, {
                elementType: element,
                visible: true,
                opacity: 1,
                transitionMs: this.config.transitionDuration,
            });
        }
    }
    /**
     * 激活 Zen 模式
     */
    activate() {
        if (this.state.status === 'active' || this.state.status === 'activating') {
            return;
        }
        this.state.status = 'activating';
        this.state.activeElements = [...this.config.retainedElements];
        this.state.hiddenElements = [];
        // Update element visibility
        for (const [element, visibility] of this.elementVisibility) {
            const retained = this.config.retainedElements.includes(element);
            visibility.visible = retained;
            visibility.opacity = retained ? 1 : 0;
            if (!retained) {
                this.state.hiddenElements.push(element);
            }
        }
        // Setup cursor auto-hide
        if (this.config.autoHideCursor) {
            this.setupCursorAutoHide();
        }
        // Notify listeners
        this.notifyListeners();
        // Simulate transition completion
        setTimeout(() => {
            this.state.status = 'active';
            this.notifyListeners();
        }, this.config.transitionDuration);
    }
    /**
     * 停用 Zen 模式
     */
    deactivate() {
        if (this.state.status === 'inactive' || this.state.status === 'deactivating') {
            return;
        }
        this.state.status = 'deactivating';
        // Restore element visibility
        for (const [, visibility] of this.elementVisibility) {
            visibility.visible = true;
            visibility.opacity = 1;
        }
        // Clear cursor timeout
        if (this.cursorTimeout) {
            clearTimeout(this.cursorTimeout);
            this.cursorTimeout = null;
        }
        // Show cursor
        this.state.cursorVisible = true;
        // Notify listeners
        this.notifyListeners();
        // Simulate transition completion
        setTimeout(() => {
            this.state.status = 'inactive';
            this.state.activeElements = [];
            this.state.hiddenElements = [];
            this.notifyListeners();
        }, this.config.transitionDuration);
    }
    /**
     * 切换 Zen 模式
     */
    toggle() {
        if (this.state.status === 'active') {
            this.deactivate();
        }
        else {
            this.activate();
        }
    }
    /**
     * 更新配置
     */
    updateConfig(patch) {
        this.config = { ...this.config, ...patch };
        // Re-apply if active
        if (this.state.status === 'active') {
            this.deactivate();
            setTimeout(() => this.activate(), 100);
        }
    }
    /**
     * 获取当前状态
     */
    getState() {
        return { ...this.state };
    }
    /**
     * 获取当前配置
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * 检查元素是否可见
     */
    isElementVisible(element) {
        const visibility = this.elementVisibility.get(element);
        return visibility ? visibility.visible : true;
    }
    /**
     * 获取元素透明度
     */
    getElementOpacity(element) {
        const visibility = this.elementVisibility.get(element);
        return visibility ? visibility.opacity : 1;
    }
    /**
     * 设置元素可见性
     */
    setElementVisibility(element, visible) {
        const visibility = this.elementVisibility.get(element);
        if (visibility) {
            visibility.visible = visible;
            visibility.opacity = visible ? 1 : 0;
            this.notifyListeners();
        }
    }
    /**
     * 添加保留元素
     */
    addRetainedElement(element) {
        if (!this.config.retainedElements.includes(element)) {
            this.config.retainedElements.push(element);
            // Update visibility if active
            if (this.state.status === 'active') {
                this.setElementVisibility(element, true);
                this.state.activeElements.push(element);
                this.state.hiddenElements = this.state.hiddenElements.filter(e => e !== element);
            }
        }
    }
    /**
     * 移除保留元素
     */
    removeRetainedElement(element) {
        this.config.retainedElements = this.config.retainedElements.filter(e => e !== element);
        // Update visibility if active
        if (this.state.status === 'active') {
            this.setElementVisibility(element, false);
            this.state.activeElements = this.state.activeElements.filter(e => e !== element);
            if (!this.state.hiddenElements.includes(element)) {
                this.state.hiddenElements.push(element);
            }
        }
    }
    /**
     * 记录用户活动
     */
    recordActivity() {
        this.state.lastActivity = Date.now();
        // Reset cursor timeout
        if (this.config.autoHideCursor && this.state.status === 'active') {
            this.state.cursorVisible = true;
            this.setupCursorAutoHide();
            this.notifyListeners();
        }
    }
    /**
     * 设置光标自动隐藏
     */
    setupCursorAutoHide() {
        if (this.cursorTimeout) {
            clearTimeout(this.cursorTimeout);
        }
        this.cursorTimeout = setTimeout(() => {
            this.state.cursorVisible = false;
            this.notifyListeners();
        }, this.config.cursorHideDelay);
    }
    /**
     * 注册状态监听器
     */
    onStateChange(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    /**
     * 通知监听器
     */
    notifyListeners() {
        for (const listener of this.listeners) {
            try {
                listener(this.state);
            }
            catch (error) {
                logger.error('Zen mode listener error:', error);
            }
        }
    }
    /**
     * 获取保留元素列表
     */
    getRetainedElements() {
        return [...this.config.retainedElements];
    }
    /**
     * 获取隐藏元素列表
     */
    getHiddenElements() {
        return [...this.state.hiddenElements];
    }
    /**
     * 检查是否处于 Zen 模式
     */
    isActive() {
        return this.state.status === 'active';
    }
    /**
     * 销毁管理器
     */
    destroy() {
        if (this.cursorTimeout) {
            clearTimeout(this.cursorTimeout);
        }
        this.listeners.clear();
        this.elementVisibility.clear();
    }
}
/** 预设列表 */
export const ZEN_MODE_PRESETS = [
    {
        id: 'minimal',
        name: '最小化',
        description: '仅保留预览窗口',
        config: {
            retainedElements: ['preview'],
            backgroundColor: '#000000',
            backgroundOpacity: 0.98,
            autoHideCursor: true,
            cursorHideDelay: 2000,
        },
    },
    {
        id: 'editing',
        name: '编辑模式',
        description: '保留预览和时间线',
        config: {
            retainedElements: ['preview', 'timeline'],
            backgroundColor: '#1a1a1a',
            backgroundOpacity: 0.95,
            autoHideCursor: true,
            cursorHideDelay: 3000,
        },
    },
    {
        id: 'review',
        name: '审阅模式',
        description: '保留预览和属性面板',
        config: {
            retainedElements: ['preview', 'properties-panel'],
            backgroundColor: '#0d0d0d',
            backgroundOpacity: 0.96,
            autoHideCursor: false,
        },
    },
    {
        id: 'presentation',
        name: '演示模式',
        description: '全屏预览，无UI元素',
        config: {
            retainedElements: [],
            backgroundColor: '#000000',
            backgroundOpacity: 1.0,
            autoHideCursor: true,
            cursorHideDelay: 1000,
            showExitHint: true,
            exitHintPosition: 'center',
        },
    },
    {
        id: 'custom',
        name: '自定义',
        description: '自定义保留元素',
        config: {
            retainedElements: ['preview', 'timeline', 'properties-panel'],
            backgroundColor: '#111111',
            backgroundOpacity: 0.94,
            autoHideCursor: true,
            cursorHideDelay: 4000,
        },
    },
];
// ==================== 工厂函数 ====================
/**
 * 创建 Zen 模式管理器实例
 */
export function createZenModeManager(config) {
    return new ZenModeManager(config);
}
/**
 * 获取预设配置
 */
export function getZenModePreset(presetId) {
    return ZEN_MODE_PRESETS.find(p => p.id === presetId);
}
/**
 * 获取所有预设
 */
export function getAllZenModePresets() {
    return [...ZEN_MODE_PRESETS];
}
//# sourceMappingURL=zen-mode-manager.js.map