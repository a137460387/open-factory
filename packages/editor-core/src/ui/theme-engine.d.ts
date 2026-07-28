/**
 * 个性化主题引擎
 *
 * 核心功能：
 * 1. 界面主题颜色自定义
 * 2. 时间线样式自定义
 * 3. 布局自定义
 * 4. 主题预览和重置
 * 5. 主题导入/导出
 */
export type ThemeMode = 'light' | 'dark' | 'auto' | 'custom';
/** 颜色格式 */
export type ColorFormat = 'hex' | 'rgb' | 'hsl' | 'oklch';
/** 主题颜色 */
export interface ThemeColors {
    primary: string;
    secondary: string;
    accent: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    background: string;
    backgroundSecondary: string;
    backgroundTertiary: string;
    surface: string;
    surfaceVariant: string;
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    textDisabled: string;
    textInverse: string;
    border: string;
    borderLight: string;
    borderHeavy: string;
    hover: string;
    active: string;
    focus: string;
    selected: string;
    disabled: string;
    timeline: {
        background: string;
        track: string;
        clip: string;
        clipSelected: string;
        clipHover: string;
        playhead: string;
        marker: string;
        waveform: string;
        grid: string;
        ruler: string;
    };
    preview: {
        background: string;
        border: string;
        controls: string;
        progressBar: string;
        timecode: string;
    };
    media: {
        background: string;
        thumbnail: string;
        selected: string;
        hover: string;
        info: string;
    };
    effects: {
        background: string;
        category: string;
        effect: string;
        applied: string;
        disabled: string;
    };
}
/** 时间线样式 */
export interface TimelineStyle {
    trackHeight: number;
    trackSpacing: number;
    trackBorderWidth: number;
    trackBorderColor: string;
    clipBorderRadius: number;
    clipBorderWidth: number;
    clipShadowBlur: number;
    clipShadowColor: string;
    waveformHeight: number;
    waveformColor: string;
    waveformGradientStart: string;
    waveformGradientEnd: string;
    playheadWidth: number;
    playheadColor: string;
    playheadHandleSize: number;
    playheadHandleColor: string;
    markerSize: number;
    markerColor: string;
    markerBorderColor: string;
    gridLineWidth: number;
    gridLineColor: string;
    gridLineDash: number[];
    rulerHeight: number;
    rulerFontSize: number;
    rulerFontColor: string;
    rulerTickColor: string;
    zoomLevel: number;
    pixelsPerSecond: number;
}
/** 布局配置 */
export interface LayoutConfig {
    panels: {
        menuBar: {
            visible: boolean;
            height: number;
        };
        toolbar: {
            visible: boolean;
            height: number;
        };
        timeline: {
            visible: boolean;
            height: number;
            position: 'bottom' | 'top';
        };
        preview: {
            visible: boolean;
            width: number;
            position: 'left' | 'right';
        };
        mediaPanel: {
            visible: boolean;
            width: number;
            position: 'left' | 'right';
        };
        effectsPanel: {
            visible: boolean;
            width: number;
            position: 'left' | 'right';
        };
        propertiesPanel: {
            visible: boolean;
            width: number;
            position: 'left' | 'right';
        };
        statusBar: {
            visible: boolean;
            height: number;
        };
    };
    splitter: {
        width: number;
        color: string;
        hoverColor: string;
        activeColor: string;
    };
    breakpoints: {
        mobile: number;
        tablet: number;
        desktop: number;
        wide: number;
    };
    grid: {
        columns: number;
        gutter: number;
        margin: number;
    };
}
/** 字体配置 */
export interface FontConfig {
    families: {
        sans: string;
        serif: string;
        mono: string;
        display: string;
    };
    sizes: {
        xs: string;
        sm: string;
        base: string;
        lg: string;
        xl: string;
        '2xl': string;
        '3xl': string;
        '4xl': string;
    };
    weights: {
        light: number;
        normal: number;
        medium: number;
        semibold: number;
        bold: number;
    };
    lineHeights: {
        tight: number;
        normal: number;
        relaxed: number;
        loose: number;
    };
}
/** 动画配置 */
export interface AnimationConfig {
    durations: {
        instant: number;
        fast: number;
        normal: number;
        slow: number;
        slower: number;
    };
    easings: {
        linear: string;
        easeIn: string;
        easeOut: string;
        easeInOut: string;
        bounce: string;
        elastic: string;
    };
    enabled: boolean;
    reducedMotion: boolean;
}
/** 完整主题配置 */
export interface ThemeConfig {
    id: string;
    name: string;
    description: string;
    mode: ThemeMode;
    colors: ThemeColors;
    timeline: TimelineStyle;
    layout: LayoutConfig;
    fonts: FontConfig;
    animations: AnimationConfig;
    isDefault: boolean;
    createdAt: number;
    updatedAt: number;
}
/** 主题预设 */
export interface ThemePreset {
    id: string;
    name: string;
    description: string;
    preview: string;
    config: Partial<ThemeConfig>;
}
/** 主题统计 */
export interface ThemeStats {
    totalThemes: number;
    customThemes: number;
    activeTheme: string;
    lastModified: number;
}
/** 默认深色主题 */
export declare const DEFAULT_DARK_THEME: ThemeConfig;
/** 默认浅色主题 */
export declare const DEFAULT_LIGHT_THEME: ThemeConfig;
/** 主题预设列表 */
export declare const THEME_PRESETS: ThemePreset[];
/**
 * 主题管理器
 *
 * 管理主题的加载、切换和自定义
 */
export declare class ThemeManager {
    private themes;
    private activeTheme;
    private listeners;
    private storageKey;
    constructor();
    /**
     * 获取当前主题
     */
    getActiveTheme(): ThemeConfig;
    /**
     * 切换主题
     */
    switchTheme(themeId: string): boolean;
    /**
     * 创建自定义主题
     */
    createTheme(config: Partial<ThemeConfig>): ThemeConfig;
    /**
     * 更新主题
     */
    updateTheme(themeId: string, updates: Partial<ThemeConfig>): boolean;
    /**
     * 删除主题
     */
    deleteTheme(themeId: string): boolean;
    /**
     * 获取所有主题
     */
    getAllThemes(): ThemeConfig[];
    /**
     * 获取主题
     */
    getTheme(themeId: string): ThemeConfig | undefined;
    /**
     * 获取预设主题
     */
    getPresets(): ThemePreset[];
    /**
     * 应用预设
     */
    applyPreset(presetId: string): boolean;
    /**
     * 更新颜色
     */
    updateColor(path: string, value: string): void;
    /**
     * 更新时间线样式
     */
    updateTimelineStyle(updates: Partial<TimelineStyle>): void;
    /**
     * 更新布局
     */
    updateLayout(updates: Partial<LayoutConfig>): void;
    /**
     * 更新字体
     */
    updateFonts(updates: Partial<FontConfig>): void;
    /**
     * 更新动画
     */
    updateAnimations(updates: Partial<AnimationConfig>): void;
    /**
     * 重置为默认主题
     */
    resetToDefault(): void;
    /**
     * 重置主题为默认值
     */
    resetTheme(themeId: string): boolean;
    /**
     * 导出主题
     */
    exportTheme(themeId: string): string | null;
    /**
     * 导入主题
     */
    importTheme(themeJson: string): ThemeConfig | null;
    /**
     * 生成 CSS 变量
     */
    generateCSSVariables(theme?: ThemeConfig): string;
    /**
     * 应用主题到 DOM
     */
    private applyTheme;
    /**
     * 注册主题变更监听器
     */
    onThemeChange(listener: (theme: ThemeConfig) => void): () => void;
    /**
     * 通知监听器
     */
    private notifyListeners;
    /**
     * 保存自定义主题
     */
    private saveCustomThemes;
    /**
     * 加载自定义主题
     */
    private loadCustomThemes;
    /**
     * 保存活跃主题 ID
     */
    private saveActiveTheme;
    /**
     * 加载活跃主题
     */
    loadActiveTheme(): void;
    /**
     * 获取统计信息
     */
    getStats(): ThemeStats;
    /**
     * 销毁管理器
     */
    destroy(): void;
}
/**
 * 创建主题管理器实例
 */
export declare function createThemeManager(): ThemeManager;
/**
 * 获取默认深色主题
 */
export declare function getDefaultDarkTheme(): ThemeConfig;
/**
 * 获取默认浅色主题
 */
export declare function getDefaultLightTheme(): ThemeConfig;
/**
 * 获取所有预设主题
 */
export declare function getAllThemePresets(): ThemePreset[];
/**
 * 生成 CSS 变量字符串
 */
export declare function generateThemeCSSVariables(theme: ThemeConfig): string;
//# sourceMappingURL=theme-engine.d.ts.map