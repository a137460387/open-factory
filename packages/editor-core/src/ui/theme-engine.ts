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

// ==================== 类型定义 ====================

/** 主题模式 */
export type ThemeMode = 'light' | 'dark' | 'auto' | 'custom';

/** 颜色格式 */
export type ColorFormat = 'hex' | 'rgb' | 'hsl' | 'oklch';

/** 主题颜色 */
export interface ThemeColors {
  // 基础颜色
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  info: string;

  // 背景颜色
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  surface: string;
  surfaceVariant: string;

  // 文本颜色
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textDisabled: string;
  textInverse: string;

  // 边框颜色
  border: string;
  borderLight: string;
  borderHeavy: string;

  // 交互颜色
  hover: string;
  active: string;
  focus: string;
  selected: string;
  disabled: string;

  // 特定组件颜色
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
  // 轨道样式
  trackHeight: number;
  trackSpacing: number;
  trackBorderWidth: number;
  trackBorderColor: string;

  // 片段样式
  clipBorderRadius: number;
  clipBorderWidth: number;
  clipShadowBlur: number;
  clipShadowColor: string;

  // 波形样式
  waveformHeight: number;
  waveformColor: string;
  waveformGradientStart: string;
  waveformGradientEnd: string;

  // 播放头样式
  playheadWidth: number;
  playheadColor: string;
  playheadHandleSize: number;
  playheadHandleColor: string;

  // 标记样式
  markerSize: number;
  markerColor: string;
  markerBorderColor: string;

  // 网格样式
  gridLineWidth: number;
  gridLineColor: string;
  gridLineDash: number[];

  // 标尺样式
  rulerHeight: number;
  rulerFontSize: number;
  rulerFontColor: string;
  rulerTickColor: string;

  // 缩放级别
  zoomLevel: number;
  pixelsPerSecond: number;
}

/** 布局配置 */
export interface LayoutConfig {
  // 面板布局
  panels: {
    menuBar: { visible: boolean; height: number };
    toolbar: { visible: boolean; height: number };
    timeline: { visible: boolean; height: number; position: 'bottom' | 'top' };
    preview: { visible: boolean; width: number; position: 'left' | 'right' };
    mediaPanel: { visible: boolean; width: number; position: 'left' | 'right' };
    effectsPanel: { visible: boolean; width: number; position: 'left' | 'right' };
    propertiesPanel: { visible: boolean; width: number; position: 'left' | 'right' };
    statusBar: { visible: boolean; height: number };
  };

  // 分割线样式
  splitter: {
    width: number;
    color: string;
    hoverColor: string;
    activeColor: string;
  };

  // 响应式断点
  breakpoints: {
    mobile: number;
    tablet: number;
    desktop: number;
    wide: number;
  };

  // 网格系统
  grid: {
    columns: number;
    gutter: number;
    margin: number;
  };
}

/** 字体配置 */
export interface FontConfig {
  // 字体家族
  families: {
    sans: string;
    serif: string;
    mono: string;
    display: string;
  };

  // 字体大小
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

  // 字体粗细
  weights: {
    light: number;
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
  };

  // 行高
  lineHeights: {
    tight: number;
    normal: number;
    relaxed: number;
    loose: number;
  };
}

/** 动画配置 */
export interface AnimationConfig {
  // 过渡时长
  durations: {
    instant: number;
    fast: number;
    normal: number;
    slow: number;
    slower: number;
  };

  // 缓动函数
  easings: {
    linear: string;
    easeIn: string;
    easeOut: string;
    easeInOut: string;
    bounce: string;
    elastic: string;
  };

  // 是否启用动画
  enabled: boolean;

  // 是否启用减少动画
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
  preview: string; // Preview image URL or base64
  config: Partial<ThemeConfig>;
}

/** 主题统计 */
export interface ThemeStats {
  totalThemes: number;
  customThemes: number;
  activeTheme: string;
  lastModified: number;
}

// ==================== 默认主题配置 ====================

/** 默认深色主题 */
export const DEFAULT_DARK_THEME: ThemeConfig = {
  id: 'default-dark',
  name: '默认深色',
  description: '默认深色主题',
  mode: 'dark',
  isDefault: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  colors: {
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    accent: '#06b6d4',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',

    background: '#0f0f0f',
    backgroundSecondary: '#1a1a1a',
    backgroundTertiary: '#262626',
    surface: '#1e1e1e',
    surfaceVariant: '#2d2d2d',

    textPrimary: '#ffffff',
    textSecondary: '#a3a3a3',
    textTertiary: '#737373',
    textDisabled: '#525252',
    textInverse: '#0f0f0f',

    border: '#404040',
    borderLight: '#333333',
    borderHeavy: '#525252',

    hover: 'rgba(255, 255, 255, 0.08)',
    active: 'rgba(255, 255, 255, 0.12)',
    focus: 'rgba(59, 130, 246, 0.5)',
    selected: 'rgba(59, 130, 246, 0.2)',
    disabled: 'rgba(255, 255, 255, 0.3)',

    timeline: {
      background: '#141414',
      track: '#1e1e1e',
      clip: '#3b82f6',
      clipSelected: '#2563eb',
      clipHover: '#60a5fa',
      playhead: '#ef4444',
      marker: '#f59e0b',
      waveform: '#3b82f6',
      grid: '#262626',
      ruler: '#1e1e1e',
    },

    preview: {
      background: '#000000',
      border: '#333333',
      controls: '#ffffff',
      progressBar: '#3b82f6',
      timecode: '#ffffff',
    },

    media: {
      background: '#1e1e1e',
      thumbnail: '#2d2d2d',
      selected: '#3b82f6',
      hover: '#2d2d2d',
      info: '#a3a3a3',
    },

    effects: {
      background: '#1e1e1e',
      category: '#2d2d2d',
      effect: '#333333',
      applied: '#3b82f6',
      disabled: '#525252',
    },
  },

  timeline: {
    trackHeight: 60,
    trackSpacing: 2,
    trackBorderWidth: 1,
    trackBorderColor: '#333333',
    clipBorderRadius: 4,
    clipBorderWidth: 1,
    clipShadowBlur: 4,
    clipShadowColor: 'rgba(0, 0, 0, 0.3)',
    waveformHeight: 40,
    waveformColor: '#3b82f6',
    waveformGradientStart: '#3b82f6',
    waveformGradientEnd: '#2563eb',
    playheadWidth: 2,
    playheadColor: '#ef4444',
    playheadHandleSize: 12,
    playheadHandleColor: '#ef4444',
    markerSize: 8,
    markerColor: '#f59e0b',
    markerBorderColor: '#d97706',
    gridLineWidth: 1,
    gridLineColor: '#262626',
    gridLineDash: [4, 4],
    rulerHeight: 24,
    rulerFontSize: 10,
    rulerFontColor: '#a3a3a3',
    rulerTickColor: '#525252',
    zoomLevel: 1,
    pixelsPerSecond: 100,
  },

  layout: {
    panels: {
      menuBar: { visible: true, height: 32 },
      toolbar: { visible: true, height: 48 },
      timeline: { visible: true, height: 300, position: 'bottom' },
      preview: { visible: true, width: 400, position: 'left' },
      mediaPanel: { visible: true, width: 300, position: 'left' },
      effectsPanel: { visible: true, width: 300, position: 'right' },
      propertiesPanel: { visible: true, width: 300, position: 'right' },
      statusBar: { visible: true, height: 24 },
    },
    splitter: {
      width: 4,
      color: '#333333',
      hoverColor: '#3b82f6',
      activeColor: '#2563eb',
    },
    breakpoints: {
      mobile: 640,
      tablet: 768,
      desktop: 1024,
      wide: 1280,
    },
    grid: {
      columns: 12,
      gutter: 16,
      margin: 16,
    },
  },

  fonts: {
    families: {
      sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
      mono: 'JetBrains Mono, Fira Code, Consolas, monospace',
      display: 'Inter, sans-serif',
    },
    sizes: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    },
    weights: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeights: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
      loose: 2,
    },
  },

  animations: {
    durations: {
      instant: 0,
      fast: 150,
      normal: 300,
      slow: 500,
      slower: 1000,
    },
    easings: {
      linear: 'linear',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      elastic: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    },
    enabled: true,
    reducedMotion: false,
  },
};

/** 默认浅色主题 */
export const DEFAULT_LIGHT_THEME: ThemeConfig = {
  id: 'default-light',
  name: '默认浅色',
  description: '默认浅色主题',
  mode: 'light',
  isDefault: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  colors: {
    primary: '#2563eb',
    secondary: '#7c3aed',
    accent: '#0891b2',
    success: '#16a34a',
    warning: '#d97706',
    error: '#dc2626',
    info: '#2563eb',

    background: '#ffffff',
    backgroundSecondary: '#f5f5f5',
    backgroundTertiary: '#e5e5e5',
    surface: '#ffffff',
    surfaceVariant: '#f5f5f5',

    textPrimary: '#171717',
    textSecondary: '#525252',
    textTertiary: '#737373',
    textDisabled: '#a3a3a3',
    textInverse: '#ffffff',

    border: '#e5e5e5',
    borderLight: '#f5f5f5',
    borderHeavy: '#d4d4d4',

    hover: 'rgba(0, 0, 0, 0.04)',
    active: 'rgba(0, 0, 0, 0.08)',
    focus: 'rgba(37, 99, 235, 0.5)',
    selected: 'rgba(37, 99, 235, 0.1)',
    disabled: 'rgba(0, 0, 0, 0.3)',

    timeline: {
      background: '#f5f5f5',
      track: '#ffffff',
      clip: '#2563eb',
      clipSelected: '#1d4ed8',
      clipHover: '#3b82f6',
      playhead: '#dc2626',
      marker: '#d97706',
      waveform: '#2563eb',
      grid: '#e5e5e5',
      ruler: '#f5f5f5',
    },

    preview: {
      background: '#000000',
      border: '#e5e5e5',
      controls: '#ffffff',
      progressBar: '#2563eb',
      timecode: '#ffffff',
    },

    media: {
      background: '#ffffff',
      thumbnail: '#f5f5f5',
      selected: '#2563eb',
      hover: '#f5f5f5',
      info: '#525252',
    },

    effects: {
      background: '#ffffff',
      category: '#f5f5f5',
      effect: '#e5e5e5',
      applied: '#2563eb',
      disabled: '#a3a3a3',
    },
  },

  timeline: {
    trackHeight: 60,
    trackSpacing: 2,
    trackBorderWidth: 1,
    trackBorderColor: '#e5e5e5',
    clipBorderRadius: 4,
    clipBorderWidth: 1,
    clipShadowBlur: 2,
    clipShadowColor: 'rgba(0, 0, 0, 0.1)',
    waveformHeight: 40,
    waveformColor: '#2563eb',
    waveformGradientStart: '#2563eb',
    waveformGradientEnd: '#1d4ed8',
    playheadWidth: 2,
    playheadColor: '#dc2626',
    playheadHandleSize: 12,
    playheadHandleColor: '#dc2626',
    markerSize: 8,
    markerColor: '#d97706',
    markerBorderColor: '#b45309',
    gridLineWidth: 1,
    gridLineColor: '#e5e5e5',
    gridLineDash: [4, 4],
    rulerHeight: 24,
    rulerFontSize: 10,
    rulerFontColor: '#525252',
    rulerTickColor: '#a3a3a3',
    zoomLevel: 1,
    pixelsPerSecond: 100,
  },

  layout: {
    panels: {
      menuBar: { visible: true, height: 32 },
      toolbar: { visible: true, height: 48 },
      timeline: { visible: true, height: 300, position: 'bottom' },
      preview: { visible: true, width: 400, position: 'left' },
      mediaPanel: { visible: true, width: 300, position: 'left' },
      effectsPanel: { visible: true, width: 300, position: 'right' },
      propertiesPanel: { visible: true, width: 300, position: 'right' },
      statusBar: { visible: true, height: 24 },
    },
    splitter: {
      width: 4,
      color: '#e5e5e5',
      hoverColor: '#2563eb',
      activeColor: '#1d4ed8',
    },
    breakpoints: {
      mobile: 640,
      tablet: 768,
      desktop: 1024,
      wide: 1280,
    },
    grid: {
      columns: 12,
      gutter: 16,
      margin: 16,
    },
  },

  fonts: {
    families: {
      sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
      mono: 'JetBrains Mono, Fira Code, Consolas, monospace',
      display: 'Inter, sans-serif',
    },
    sizes: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    },
    weights: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeights: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
      loose: 2,
    },
  },

  animations: {
    durations: {
      instant: 0,
      fast: 150,
      normal: 300,
      slow: 500,
      slower: 1000,
    },
    easings: {
      linear: 'linear',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      elastic: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    },
    enabled: true,
    reducedMotion: false,
  },
};

/** 主题预设列表 */
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'dark-blue',
    name: '深蓝',
    description: '专业深蓝色主题',
    preview: '',
    config: {
      colors: {
        ...DEFAULT_DARK_THEME.colors,
        primary: '#1e40af',
        secondary: '#5b21b6',
        accent: '#0e7490',
        timeline: {
          ...DEFAULT_DARK_THEME.colors.timeline,
          background: '#0c1425',
          track: '#1e293b',
          clip: '#1e40af',
          clipSelected: '#1e3a8a',
          clipHover: '#3b82f6',
        },
      },
    },
  },
  {
    id: 'dark-purple',
    name: '暗紫',
    description: '创意暗紫色主题',
    preview: '',
    config: {
      colors: {
        ...DEFAULT_DARK_THEME.colors,
        primary: '#7c3aed',
        secondary: '#a855f7',
        accent: '#c084fc',
        timeline: {
          ...DEFAULT_DARK_THEME.colors.timeline,
          background: '#0f0520',
          track: '#1e1033',
          clip: '#7c3aed',
          clipSelected: '#6d28d9',
          clipHover: '#8b5cf6',
        },
      },
    },
  },
  {
    id: 'light-minimal',
    name: '极简浅色',
    description: '简洁明亮的浅色主题',
    preview: '',
    config: {
      ...DEFAULT_LIGHT_THEME,
      id: 'light-minimal',
      name: '极简浅色',
    },
  },
  {
    id: 'amoled-dark',
    name: 'AMOLED 黑',
    description: '纯黑 AMOLED 主题',
    preview: '',
    config: {
      colors: {
        ...DEFAULT_DARK_THEME.colors,
        background: '#000000',
        backgroundSecondary: '#0a0a0a',
        backgroundTertiary: '#141414',
        surface: '#0a0a0a',
        surfaceVariant: '#141414',
        timeline: {
          ...DEFAULT_DARK_THEME.colors.timeline,
          background: '#000000',
          track: '#0a0a0a',
        },
      },
    },
  },
];

// ==================== 主题管理器 ====================

/**
 * 主题管理器
 *
 * 管理主题的加载、切换和自定义
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
   * 获取当前主题
   */
  getActiveTheme(): ThemeConfig {
    return this.activeTheme;
  }

  /**
   * 切换主题
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
   * 创建自定义主题
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
   * 更新主题
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
   * 删除主题
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
   * 获取所有主题
   */
  getAllThemes(): ThemeConfig[] {
    return Array.from(this.themes.values());
  }

  /**
   * 获取主题
   */
  getTheme(themeId: string): ThemeConfig | undefined {
    return this.themes.get(themeId);
  }

  /**
   * 获取预设主题
   */
  getPresets(): ThemePreset[] {
    return [...THEME_PRESETS];
  }

  /**
   * 应用预设
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
   * 更新颜色
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
   * 更新时间线样式
   */
  updateTimelineStyle(updates: Partial<TimelineStyle>): void {
    Object.assign(this.activeTheme.timeline, updates);
    this.activeTheme.updatedAt = Date.now();
    this.applyTheme(this.activeTheme);
    this.notifyListeners();
  }

  /**
   * 更新布局
   */
  updateLayout(updates: Partial<LayoutConfig>): void {
    Object.assign(this.activeTheme.layout, updates);
    this.activeTheme.updatedAt = Date.now();
    this.applyTheme(this.activeTheme);
    this.notifyListeners();
  }

  /**
   * 更新字体
   */
  updateFonts(updates: Partial<FontConfig>): void {
    Object.assign(this.activeTheme.fonts, updates);
    this.activeTheme.updatedAt = Date.now();
    this.applyTheme(this.activeTheme);
    this.notifyListeners();
  }

  /**
   * 更新动画
   */
  updateAnimations(updates: Partial<AnimationConfig>): void {
    Object.assign(this.activeTheme.animations, updates);
    this.activeTheme.updatedAt = Date.now();
    this.applyTheme(this.activeTheme);
    this.notifyListeners();
  }

  /**
   * 重置为默认主题
   */
  resetToDefault(): void {
    this.switchTheme(DEFAULT_DARK_THEME.id);
  }

  /**
   * 重置主题为默认值
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
   * 导出主题
   */
  exportTheme(themeId: string): string | null {
    const theme = this.themes.get(themeId);
    if (!theme) {
      return null;
    }

    return JSON.stringify(theme, null, 2);
  }

  /**
   * 导入主题
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
   * 生成 CSS 变量
   */
  generateCSSVariables(theme?: ThemeConfig): string {
    const t = theme || this.activeTheme;
    const vars: string[] = [];

    // Colors
    vars.push(`--color-primary: ${t.colors.primary};`);
    vars.push(`--color-secondary: ${t.colors.secondary};`);
    vars.push(`--color-accent: ${t.colors.accent};`);
    vars.push(`--color-success: ${t.colors.success};`);
    vars.push(`--color-warning: ${t.colors.warning};`);
    vars.push(`--color-error: ${t.colors.error};`);
    vars.push(`--color-info: ${t.colors.info};`);

    vars.push(`--color-background: ${t.colors.background};`);
    vars.push(`--color-background-secondary: ${t.colors.backgroundSecondary};`);
    vars.push(`--color-background-tertiary: ${t.colors.backgroundTertiary};`);
    vars.push(`--color-surface: ${t.colors.surface};`);
    vars.push(`--color-surface-variant: ${t.colors.surfaceVariant};`);

    vars.push(`--color-text-primary: ${t.colors.textPrimary};`);
    vars.push(`--color-text-secondary: ${t.colors.textSecondary};`);
    vars.push(`--color-text-tertiary: ${t.colors.textTertiary};`);
    vars.push(`--color-text-disabled: ${t.colors.textDisabled};`);
    vars.push(`--color-text-inverse: ${t.colors.textInverse};`);

    vars.push(`--color-border: ${t.colors.border};`);
    vars.push(`--color-border-light: ${t.colors.borderLight};`);
    vars.push(`--color-border-heavy: ${t.colors.borderHeavy};`);

    // Timeline
    vars.push(`--timeline-background: ${t.colors.timeline.background};`);
    vars.push(`--timeline-track: ${t.colors.timeline.track};`);
    vars.push(`--timeline-clip: ${t.colors.timeline.clip};`);
    vars.push(`--timeline-clip-selected: ${t.colors.timeline.clipSelected};`);
    vars.push(`--timeline-clip-hover: ${t.colors.timeline.clipHover};`);
    vars.push(`--timeline-playhead: ${t.colors.timeline.playhead};`);
    vars.push(`--timeline-marker: ${t.colors.timeline.marker};`);
    vars.push(`--timeline-waveform: ${t.colors.timeline.waveform};`);
    vars.push(`--timeline-grid: ${t.colors.timeline.grid};`);
    vars.push(`--timeline-ruler: ${t.colors.timeline.ruler};`);

    // Fonts
    vars.push(`--font-sans: ${t.fonts.families.sans};`);
    vars.push(`--font-serif: ${t.fonts.families.serif};`);
    vars.push(`--font-mono: ${t.fonts.families.mono};`);
    vars.push(`--font-display: ${t.fonts.families.display};`);

    // Animations
    vars.push(`--duration-instant: ${t.animations.durations.instant}ms;`);
    vars.push(`--duration-fast: ${t.animations.durations.fast}ms;`);
    vars.push(`--duration-normal: ${t.animations.durations.normal}ms;`);
    vars.push(`--duration-slow: ${t.animations.durations.slow}ms;`);
    vars.push(`--duration-slower: ${t.animations.durations.slower}ms;`);

    vars.push(`--ease-linear: ${t.animations.easings.linear};`);
    vars.push(`--ease-in: ${t.animations.easings.easeIn};`);
    vars.push(`--ease-out: ${t.animations.easings.easeOut};`);
    vars.push(`--ease-in-out: ${t.animations.easings.easeInOut};`);

    return `:root {\n  ${vars.join('\n  ')}\n}`;
  }

  /**
   * 应用主题到 DOM
   */
  private applyTheme(theme: ThemeConfig): void {
    if (typeof document === 'undefined') {
      return;
    }

    const css = this.generateCSSVariables(theme);
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
   * 注册主题变更监听器
   */
  onThemeChange(listener: (theme: ThemeConfig) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 通知监听器
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.activeTheme);
      } catch (error) {
        console.error('Theme listener error:', error);
      }
    }
  }

  /**
   * 保存自定义主题
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
   * 加载自定义主题
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
   * 保存活跃主题 ID
   */
  private saveActiveTheme(themeId: string): void {
    try {
      localStorage.setItem(`${this.storageKey}-active`, themeId);
    } catch {
      // Storage not available
    }
  }

  /**
   * 加载活跃主题
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
   * 获取统计信息
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
   * 销毁管理器
   */
  destroy(): void {
    this.listeners.clear();
    this.themes.clear();
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建主题管理器实例
 */
export function createThemeManager(): ThemeManager {
  return new ThemeManager();
}

/**
 * 获取默认深色主题
 */
export function getDefaultDarkTheme(): ThemeConfig {
  return { ...DEFAULT_DARK_THEME };
}

/**
 * 获取默认浅色主题
 */
export function getDefaultLightTheme(): ThemeConfig {
  return { ...DEFAULT_LIGHT_THEME };
}

/**
 * 获取所有预设主题
 */
export function getAllThemePresets(): ThemePreset[] {
  return [...THEME_PRESETS];
}

/**
 * 生成 CSS 变量字符串
 */
export function generateThemeCSSVariables(theme: ThemeConfig): string {
  const manager = new ThemeManager();
  return manager.generateCSSVariables(theme);
}
