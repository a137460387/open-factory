/**
 * 全局快捷键体系
 *
 * 核心功能：
 * 1. 可自定义的快捷键映射
 * 2. 可视化快捷键编辑器
 * 3. 预设快捷键方案
 * 4. 快捷键冲突检测
 */

// ==================== 类型定义 ====================

/** 快捷键修饰键 */
export type ModifierKey = 'ctrl' | 'alt' | 'shift' | 'meta';

/** 快捷键动作类型 */
export type ShortcutActionType =
  | 'play-pause'
  | 'stop'
  | 'next-frame'
  | 'previous-frame'
  | 'next-clip'
  | 'previous-clip'
  | 'go-to-start'
  | 'go-to-end'
  | 'split-clip'
  | 'delete-clip'
  | 'undo'
  | 'redo'
  | 'copy'
  | 'paste'
  | 'cut'
  | 'select-all'
  | 'deselect-all'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-fit'
  | 'toggle-timeline'
  | 'toggle-preview'
  | 'toggle-media-panel'
  | 'toggle-effects-panel'
  | 'toggle-properties-panel'
  | 'toggle-zen-mode'
  | 'toggle-fullscreen'
  | 'export'
  | 'save'
  | 'save-as'
  | 'open'
  | 'new-project'
  | 'import-media'
  | 'render'
  | 'toggle-playback'
  | 'mark-in'
  | 'mark-out'
  | 'clear-marks'
  | 'add-marker'
  | 'toggle-mute'
  | 'toggle-solo'
  | 'volume-up'
  | 'volume-down'
  | 'toggle-loop'
  | 'snap-to-grid'
  | 'toggle-snapping'
  | 'nudge-left'
  | 'nudge-right'
  | 'slip-clip'
  | 'slide-clip'
  | 'ripple-delete'
  | 'toggle-track-lock'
  | 'toggle-track-visibility'
  | 'toggle-track-solo'
  | 'custom';

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
  context?: string; // e.g., 'timeline', 'preview', 'global'
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
export const DEFAULT_SHORTCUT_CONFIG: ShortcutConfig = {
  enabled: true,
  activeSchemeId: 'premiere',
  showTooltips: true,
  tooltipDelay: 500,
  enableKeyRepeat: true,
  keyRepeatDelay: 500,
  keyRepeatInterval: 50,
  enableConflictDetection: true,
  storageKey: 'open-factory-shortcuts',
};

// ==================== 预设方案 ====================

/** Premiere 风格方案 */
export const PREMIERE_SCHEME: ShortcutScheme = {
  id: 'premiere',
  name: 'Premiere Pro 风格',
  description: 'Adobe Premiere Pro 快捷键方案',
  isDefault: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  shortcuts: [
    {
      id: 'play-pause',
      action: 'play-pause',
      keys: ['Space'],
      modifiers: [],
      label: '播放/暂停',
      description: '切换播放状态',
      category: '播放控制',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'stop',
      action: 'stop',
      keys: ['Escape'],
      modifiers: [],
      label: '停止',
      description: '停止播放',
      category: '播放控制',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'next-frame',
      action: 'next-frame',
      keys: ['ArrowRight'],
      modifiers: [],
      label: '下一帧',
      description: '前进一帧',
      category: '播放控制',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'previous-frame',
      action: 'previous-frame',
      keys: ['ArrowLeft'],
      modifiers: [],
      label: '上一帧',
      description: '后退一帧',
      category: '播放控制',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'go-to-start',
      action: 'go-to-start',
      keys: ['Home'],
      modifiers: [],
      label: '跳到开头',
      description: '跳转到时间线开头',
      category: '播放控制',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'go-to-end',
      action: 'go-to-end',
      keys: ['End'],
      modifiers: [],
      label: '跳到结尾',
      description: '跳转到时间线结尾',
      category: '播放控制',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'split-clip',
      action: 'split-clip',
      keys: ['c'],
      modifiers: ['ctrl'],
      label: '分割片段',
      description: '在播放头位置分割片段',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'delete-clip',
      action: 'delete-clip',
      keys: ['Delete'],
      modifiers: [],
      label: '删除片段',
      description: '删除选中的片段',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'undo',
      action: 'undo',
      keys: ['z'],
      modifiers: ['ctrl'],
      label: '撤销',
      description: '撤销上一步操作',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'redo',
      action: 'redo',
      keys: ['z'],
      modifiers: ['ctrl', 'shift'],
      label: '重做',
      description: '重做上一步操作',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'copy',
      action: 'copy',
      keys: ['c'],
      modifiers: ['ctrl'],
      label: '复制',
      description: '复制选中内容',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'paste',
      action: 'paste',
      keys: ['v'],
      modifiers: ['ctrl'],
      label: '粘贴',
      description: '粘贴内容',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'cut',
      action: 'cut',
      keys: ['x'],
      modifiers: ['ctrl'],
      label: '剪切',
      description: '剪切选中内容',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'select-all',
      action: 'select-all',
      keys: ['a'],
      modifiers: ['ctrl'],
      label: '全选',
      description: '选择所有内容',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'zoom-in',
      action: 'zoom-in',
      keys: ['='],
      modifiers: ['ctrl'],
      label: '放大',
      description: '放大时间线',
      category: '视图',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'zoom-out',
      action: 'zoom-out',
      keys: ['-'],
      modifiers: ['ctrl'],
      label: '缩小',
      description: '缩小时间线',
      category: '视图',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'zoom-fit',
      action: 'zoom-fit',
      keys: ['0'],
      modifiers: ['ctrl'],
      label: '适应窗口',
      description: '时间线适应窗口大小',
      category: '视图',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'toggle-zen-mode',
      action: 'toggle-zen-mode',
      keys: ['F11'],
      modifiers: [],
      label: 'Zen 模式',
      description: '切换 Zen 专注模式',
      category: '视图',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'toggle-fullscreen',
      action: 'toggle-fullscreen',
      keys: ['F'],
      modifiers: ['ctrl'],
      label: '全屏',
      description: '切换全屏模式',
      category: '视图',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'export',
      action: 'export',
      keys: ['e'],
      modifiers: ['ctrl'],
      label: '导出',
      description: '导出项目',
      category: '文件',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'save',
      action: 'save',
      keys: ['s'],
      modifiers: ['ctrl'],
      label: '保存',
      description: '保存项目',
      category: '文件',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'save-as',
      action: 'save-as',
      keys: ['s'],
      modifiers: ['ctrl', 'shift'],
      label: '另存为',
      description: '项目另存为',
      category: '文件',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'open',
      action: 'open',
      keys: ['o'],
      modifiers: ['ctrl'],
      label: '打开',
      description: '打开项目',
      category: '文件',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'new-project',
      action: 'new-project',
      keys: ['n'],
      modifiers: ['ctrl'],
      label: '新建项目',
      description: '创建新项目',
      category: '文件',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'import-media',
      action: 'import-media',
      keys: ['i'],
      modifiers: ['ctrl'],
      label: '导入媒体',
      description: '导入媒体文件',
      category: '文件',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'mark-in',
      action: 'mark-in',
      keys: ['I'],
      modifiers: [],
      label: '入点',
      description: '设置入点',
      category: '标记',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'mark-out',
      action: 'mark-out',
      keys: ['O'],
      modifiers: [],
      label: '出点',
      description: '设置出点',
      category: '标记',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'clear-marks',
      action: 'clear-marks',
      keys: ['D'],
      modifiers: ['ctrl'],
      label: '清除标记',
      description: '清除入点和出点',
      category: '标记',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'add-marker',
      action: 'add-marker',
      keys: ['M'],
      modifiers: [],
      label: '添加标记',
      description: '在当前位置添加标记',
      category: '标记',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'toggle-mute',
      action: 'toggle-mute',
      keys: ['M'],
      modifiers: ['ctrl'],
      label: '静音',
      description: '切换静音状态',
      category: '音频',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'volume-up',
      action: 'volume-up',
      keys: [']'],
      modifiers: ['ctrl'],
      label: '增加音量',
      description: '增加音量',
      category: '音频',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'volume-down',
      action: 'volume-down',
      keys: ['['],
      modifiers: ['ctrl'],
      label: '降低音量',
      description: '降低音量',
      category: '音频',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'toggle-loop',
      action: 'toggle-loop',
      keys: ['L'],
      modifiers: ['ctrl'],
      label: '循环',
      description: '切换循环播放',
      category: '播放控制',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'toggle-snapping',
      action: 'toggle-snapping',
      keys: ['S'],
      modifiers: ['ctrl'],
      label: '吸附',
      description: '切换吸附功能',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'nudge-left',
      action: 'nudge-left',
      keys: [','],
      modifiers: ['ctrl'],
      label: '左微调',
      description: '向左微调片段',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'nudge-right',
      action: 'nudge-right',
      keys: ['.'],
      modifiers: ['ctrl'],
      label: '右微调',
      description: '向右微调片段',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
  ],
};

/** Final Cut Pro 风格方案 */
export const FINAL_CUT_SCHEME: ShortcutScheme = {
  id: 'final-cut',
  name: 'Final Cut Pro 风格',
  description: 'Apple Final Cut Pro 快捷键方案',
  isDefault: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  shortcuts: [
    {
      id: 'play-pause',
      action: 'play-pause',
      keys: ['Space'],
      modifiers: [],
      label: '播放/暂停',
      description: '切换播放状态',
      category: '播放控制',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'stop',
      action: 'stop',
      keys: ['Escape'],
      modifiers: [],
      label: '停止',
      description: '停止播放',
      category: '播放控制',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'next-frame',
      action: 'next-frame',
      keys: ['ArrowRight'],
      modifiers: [],
      label: '下一帧',
      description: '前进一帧',
      category: '播放控制',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'previous-frame',
      action: 'previous-frame',
      keys: ['ArrowLeft'],
      modifiers: [],
      label: '上一帧',
      description: '后退一帧',
      category: '播放控制',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'go-to-start',
      action: 'go-to-start',
      keys: ['Home'],
      modifiers: [],
      label: '跳到开头',
      description: '跳转到时间线开头',
      category: '播放控制',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'go-to-end',
      action: 'go-to-end',
      keys: ['End'],
      modifiers: [],
      label: '跳到结尾',
      description: '跳转到时间线结尾',
      category: '播放控制',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'split-clip',
      action: 'split-clip',
      keys: ['B'],
      modifiers: [],
      label: '分割片段',
      description: '在播放头位置分割片段',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'delete-clip',
      action: 'delete-clip',
      keys: ['Delete'],
      modifiers: [],
      label: '删除片段',
      description: '删除选中的片段',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'undo',
      action: 'undo',
      keys: ['z'],
      modifiers: ['meta'],
      label: '撤销',
      description: '撤销上一步操作',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'redo',
      action: 'redo',
      keys: ['z'],
      modifiers: ['meta', 'shift'],
      label: '重做',
      description: '重做上一步操作',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'copy',
      action: 'copy',
      keys: ['c'],
      modifiers: ['meta'],
      label: '复制',
      description: '复制选中内容',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'paste',
      action: 'paste',
      keys: ['v'],
      modifiers: ['meta'],
      label: '粘贴',
      description: '粘贴内容',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'cut',
      action: 'cut',
      keys: ['x'],
      modifiers: ['meta'],
      label: '剪切',
      description: '剪切选中内容',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'select-all',
      action: 'select-all',
      keys: ['a'],
      modifiers: ['meta'],
      label: '全选',
      description: '选择所有内容',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'zoom-in',
      action: 'zoom-in',
      keys: ['='],
      modifiers: ['meta'],
      label: '放大',
      description: '放大时间线',
      category: '视图',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'zoom-out',
      action: 'zoom-out',
      keys: ['-'],
      modifiers: ['meta'],
      label: '缩小',
      description: '缩小时间线',
      category: '视图',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'zoom-fit',
      action: 'zoom-fit',
      keys: ['0'],
      modifiers: ['meta'],
      label: '适应窗口',
      description: '时间线适应窗口大小',
      category: '视图',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'toggle-zen-mode',
      action: 'toggle-zen-mode',
      keys: ['F11'],
      modifiers: [],
      label: 'Zen 模式',
      description: '切换 Zen 专注模式',
      category: '视图',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'toggle-fullscreen',
      action: 'toggle-fullscreen',
      keys: ['F'],
      modifiers: ['meta'],
      label: '全屏',
      description: '切换全屏模式',
      category: '视图',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'export',
      action: 'export',
      keys: ['e'],
      modifiers: ['meta'],
      label: '导出',
      description: '导出项目',
      category: '文件',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'save',
      action: 'save',
      keys: ['s'],
      modifiers: ['meta'],
      label: '保存',
      description: '保存项目',
      category: '文件',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'save-as',
      action: 'save-as',
      keys: ['s'],
      modifiers: ['meta', 'shift'],
      label: '另存为',
      description: '项目另存为',
      category: '文件',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'open',
      action: 'open',
      keys: ['o'],
      modifiers: ['meta'],
      label: '打开',
      description: '打开项目',
      category: '文件',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'new-project',
      action: 'new-project',
      keys: ['n'],
      modifiers: ['meta'],
      label: '新建项目',
      description: '创建新项目',
      category: '文件',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'import-media',
      action: 'import-media',
      keys: ['i'],
      modifiers: ['meta'],
      label: '导入媒体',
      description: '导入媒体文件',
      category: '文件',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'mark-in',
      action: 'mark-in',
      keys: ['I'],
      modifiers: [],
      label: '入点',
      description: '设置入点',
      category: '标记',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'mark-out',
      action: 'mark-out',
      keys: ['O'],
      modifiers: [],
      label: '出点',
      description: '设置出点',
      category: '标记',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'clear-marks',
      action: 'clear-marks',
      keys: ['D'],
      modifiers: ['meta'],
      label: '清除标记',
      description: '清除入点和出点',
      category: '标记',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'add-marker',
      action: 'add-marker',
      keys: ['M'],
      modifiers: [],
      label: '添加标记',
      description: '在当前位置添加标记',
      category: '标记',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'toggle-mute',
      action: 'toggle-mute',
      keys: ['M'],
      modifiers: ['meta'],
      label: '静音',
      description: '切换静音状态',
      category: '音频',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'volume-up',
      action: 'volume-up',
      keys: [']'],
      modifiers: ['meta'],
      label: '增加音量',
      description: '增加音量',
      category: '音频',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'volume-down',
      action: 'volume-down',
      keys: ['['],
      modifiers: ['meta'],
      label: '降低音量',
      description: '降低音量',
      category: '音频',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'toggle-loop',
      action: 'toggle-loop',
      keys: ['L'],
      modifiers: ['meta'],
      label: '循环',
      description: '切换循环播放',
      category: '播放控制',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'toggle-snapping',
      action: 'toggle-snapping',
      keys: ['N'],
      modifiers: ['meta'],
      label: '吸附',
      description: '切换吸附功能',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'nudge-left',
      action: 'nudge-left',
      keys: [','],
      modifiers: ['meta'],
      label: '左微调',
      description: '向左微调片段',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'nudge-right',
      action: 'nudge-right',
      keys: ['.'],
      modifiers: ['meta'],
      label: '右微调',
      description: '向右微调片段',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
  ],
};

/** DaVinci Resolve 风格方案 */
export const DAVINCI_RESOLVE_SCHEME: ShortcutScheme = {
  id: 'davinci-resolve',
  name: 'DaVinci Resolve 风格',
  description: 'Blackmagic DaVinci Resolve 快捷键方案',
  isDefault: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  shortcuts: [
    {
      id: 'play-pause',
      action: 'play-pause',
      keys: ['Space'],
      modifiers: [],
      label: '播放/暂停',
      description: '切换播放状态',
      category: '播放控制',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'stop',
      action: 'stop',
      keys: ['Escape'],
      modifiers: [],
      label: '停止',
      description: '停止播放',
      category: '播放控制',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'next-frame',
      action: 'next-frame',
      keys: ['ArrowRight'],
      modifiers: [],
      label: '下一帧',
      description: '前进一帧',
      category: '播放控制',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'previous-frame',
      action: 'previous-frame',
      keys: ['ArrowLeft'],
      modifiers: [],
      label: '上一帧',
      description: '后退一帧',
      category: '播放控制',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'go-to-start',
      action: 'go-to-start',
      keys: ['Home'],
      modifiers: [],
      label: '跳到开头',
      description: '跳转到时间线开头',
      category: '播放控制',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'go-to-end',
      action: 'go-to-end',
      keys: ['End'],
      modifiers: [],
      label: '跳到结尾',
      description: '跳转到时间线结尾',
      category: '播放控制',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'split-clip',
      action: 'split-clip',
      keys: ['B'],
      modifiers: ['ctrl'],
      label: '分割片段',
      description: '在播放头位置分割片段',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'delete-clip',
      action: 'delete-clip',
      keys: ['Delete'],
      modifiers: [],
      label: '删除片段',
      description: '删除选中的片段',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'undo',
      action: 'undo',
      keys: ['z'],
      modifiers: ['ctrl'],
      label: '撤销',
      description: '撤销上一步操作',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'redo',
      action: 'redo',
      keys: ['z'],
      modifiers: ['ctrl', 'shift'],
      label: '重做',
      description: '重做上一步操作',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'copy',
      action: 'copy',
      keys: ['c'],
      modifiers: ['ctrl'],
      label: '复制',
      description: '复制选中内容',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'paste',
      action: 'paste',
      keys: ['v'],
      modifiers: ['ctrl'],
      label: '粘贴',
      description: '粘贴内容',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'cut',
      action: 'cut',
      keys: ['x'],
      modifiers: ['ctrl'],
      label: '剪切',
      description: '剪切选中内容',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'select-all',
      action: 'select-all',
      keys: ['a'],
      modifiers: ['ctrl'],
      label: '全选',
      description: '选择所有内容',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'zoom-in',
      action: 'zoom-in',
      keys: ['='],
      modifiers: ['ctrl'],
      label: '放大',
      description: '放大时间线',
      category: '视图',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'zoom-out',
      action: 'zoom-out',
      keys: ['-'],
      modifiers: ['ctrl'],
      label: '缩小',
      description: '缩小时间线',
      category: '视图',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'zoom-fit',
      action: 'zoom-fit',
      keys: ['0'],
      modifiers: ['ctrl'],
      label: '适应窗口',
      description: '时间线适应窗口大小',
      category: '视图',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'toggle-zen-mode',
      action: 'toggle-zen-mode',
      keys: ['F11'],
      modifiers: [],
      label: 'Zen 模式',
      description: '切换 Zen 专注模式',
      category: '视图',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'toggle-fullscreen',
      action: 'toggle-fullscreen',
      keys: ['F'],
      modifiers: ['ctrl'],
      label: '全屏',
      description: '切换全屏模式',
      category: '视图',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'export',
      action: 'export',
      keys: ['e'],
      modifiers: ['ctrl'],
      label: '导出',
      description: '导出项目',
      category: '文件',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'save',
      action: 'save',
      keys: ['s'],
      modifiers: ['ctrl'],
      label: '保存',
      description: '保存项目',
      category: '文件',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'save-as',
      action: 'save-as',
      keys: ['s'],
      modifiers: ['ctrl', 'shift'],
      label: '另存为',
      description: '项目另存为',
      category: '文件',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'open',
      action: 'open',
      keys: ['o'],
      modifiers: ['ctrl'],
      label: '打开',
      description: '打开项目',
      category: '文件',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'new-project',
      action: 'new-project',
      keys: ['n'],
      modifiers: ['ctrl'],
      label: '新建项目',
      description: '创建新项目',
      category: '文件',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'import-media',
      action: 'import-media',
      keys: ['i'],
      modifiers: ['ctrl'],
      label: '导入媒体',
      description: '导入媒体文件',
      category: '文件',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'mark-in',
      action: 'mark-in',
      keys: ['I'],
      modifiers: [],
      label: '入点',
      description: '设置入点',
      category: '标记',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'mark-out',
      action: 'mark-out',
      keys: ['O'],
      modifiers: [],
      label: '出点',
      description: '设置出点',
      category: '标记',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'clear-marks',
      action: 'clear-marks',
      keys: ['D'],
      modifiers: ['ctrl'],
      label: '清除标记',
      description: '清除入点和出点',
      category: '标记',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'add-marker',
      action: 'add-marker',
      keys: ['M'],
      modifiers: [],
      label: '添加标记',
      description: '在当前位置添加标记',
      category: '标记',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'toggle-mute',
      action: 'toggle-mute',
      keys: ['M'],
      modifiers: ['ctrl'],
      label: '静音',
      description: '切换静音状态',
      category: '音频',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'volume-up',
      action: 'volume-up',
      keys: [']'],
      modifiers: ['ctrl'],
      label: '增加音量',
      description: '增加音量',
      category: '音频',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'volume-down',
      action: 'volume-down',
      keys: ['['],
      modifiers: ['ctrl'],
      label: '降低音量',
      description: '降低音量',
      category: '音频',
      enabled: true,
      customizable: true,
      context: 'global',
    },
    {
      id: 'toggle-loop',
      action: 'toggle-loop',
      keys: ['L'],
      modifiers: ['ctrl'],
      label: '循环',
      description: '切换循环播放',
      category: '播放控制',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'toggle-snapping',
      action: 'toggle-snapping',
      keys: ['N'],
      modifiers: ['ctrl'],
      label: '吸附',
      description: '切换吸附功能',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'nudge-left',
      action: 'nudge-left',
      keys: [','],
      modifiers: ['ctrl'],
      label: '左微调',
      description: '向左微调片段',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
    {
      id: 'nudge-right',
      action: 'nudge-right',
      keys: ['.'],
      modifiers: ['ctrl'],
      label: '右微调',
      description: '向右微调片段',
      category: '编辑',
      enabled: true,
      customizable: true,
      context: 'timeline',
    },
  ],
};

/** 所有预设方案 */
export const ALL_SHORTCUT_SCHEMES: ShortcutScheme[] = [
  PREMIERE_SCHEME,
  FINAL_CUT_SCHEME,
  DAVINCI_RESOLVE_SCHEME,
];

// ==================== 快捷键管理器 ====================

/**
 * 快捷键管理器
 *
 * 管理快捷键映射、方案切换和冲突检测
 */
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

    // Load default schemes
    for (const scheme of ALL_SHORTCUT_SCHEMES) {
      this.schemes.set(scheme.id, scheme);
    }

    // Set active scheme
    this.activeScheme = this.schemes.get(this.config.activeSchemeId) || PREMIERE_SCHEME;

    // Load custom shortcuts from storage
    this.loadCustomShortcuts();
  }

  /**
   * 注册动作处理器
   */
  registerAction(action: ShortcutActionType, handler: (event: KeyboardEvent) => void): void {
    this.actionHandlers.set(action, handler);
  }

  /**
   * 注销动作处理器
   */
  unregisterAction(action: ShortcutActionType): void {
    this.actionHandlers.delete(action);
  }

  /**
   * 处理键盘事件
   */
  handleKeyEvent(event: KeyboardEvent): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const key = this.normalizeKey(event.key);
    const modifiers = this.getModifiers(event);

    // Find matching shortcut
    const shortcut = this.findShortcut(key, modifiers);
    if (!shortcut || !shortcut.enabled) {
      return false;
    }

    // Check context
    if (shortcut.context && !this.isContextActive(shortcut.context)) {
      return false;
    }

    // Execute action
    const handler = this.actionHandlers.get(shortcut.action);
    if (handler) {
      handler(event);
      event.preventDefault();
      event.stopPropagation();
      return true;
    }

    return false;
  }

  /**
   * 处理按键按下
   */
  handleKeyDown(event: KeyboardEvent): void {
    const key = this.normalizeKey(event.key);

    // Track key state
    this.keyStates.set(key, true);

    // Handle key repeat
    if (this.config.enableKeyRepeat) {
      this.startKeyRepeat(key, event);
    }
  }

  /**
   * 处理按键释放
   */
  handleKeyUp(event: KeyboardEvent): void {
    const key = this.normalizeKey(event.key);

    // Clear key state
    this.keyStates.set(key, false);

    // Stop key repeat
    this.stopKeyRepeat(key);
  }

  /**
   * 查找匹配的快捷键
   */
  private findShortcut(key: string, modifiers: ModifierKey[]): ShortcutDefinition | undefined {
    return this.activeScheme.shortcuts.find(shortcut => {
      if (!shortcut.enabled) return false;

      // Check key
      if (!shortcut.keys.includes(key)) return false;

      // Check modifiers
      const requiredModifiers = shortcut.modifiers.sort();
      const currentModifiers = modifiers.sort();

      if (requiredModifiers.length !== currentModifiers.length) return false;

      return requiredModifiers.every((mod, index) => mod === currentModifiers[index]);
    });
  }

  /**
   * 获取修饰键状态
   */
  private getModifiers(event: KeyboardEvent): ModifierKey[] {
    const modifiers: ModifierKey[] = [];

    if (event.ctrlKey) modifiers.push('ctrl');
    if (event.altKey) modifiers.push('alt');
    if (event.shiftKey) modifiers.push('shift');
    if (event.metaKey) modifiers.push('meta');

    return modifiers;
  }

  /**
   * 标准化按键名称
   */
  private normalizeKey(key: string): string {
    const keyMap: Record<string, string> = {
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

  /**
   * 检查上下文是否活跃
   */
  private isContextActive(context: string): boolean {
    // TODO: Implement context checking based on current UI state
    return true;
  }

  /**
   * 开始按键重复
   */
  private startKeyRepeat(key: string, event: KeyboardEvent): void {
    this.stopKeyRepeat(key);

    const timer = setTimeout(() => {
      const intervalTimer = setInterval(() => {
        if (!this.keyStates.get(key)) {
          clearInterval(intervalTimer);
          return;
        }

        // Simulate key repeat
        this.handleKeyEvent(event);
      }, this.config.keyRepeatInterval);

      this.keyRepeatTimers.set(key, intervalTimer);
    }, this.config.keyRepeatDelay);

    this.keyRepeatTimers.set(key, timer);
  }

  /**
   * 停止按键重复
   */
  private stopKeyRepeat(key: string): void {
    const timer = this.keyRepeatTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      clearInterval(timer);
      this.keyRepeatTimers.delete(key);
    }
  }

  /**
   * 切换方案
   */
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

  /**
   * 获取当前方案
   */
  getActiveScheme(): ShortcutScheme {
    return this.activeScheme;
  }

  /**
   * 获取所有方案
   */
  getAllSchemes(): ShortcutScheme[] {
    return Array.from(this.schemes.values());
  }

  /**
   * 更新快捷键
   */
  updateShortcut(shortcutId: string, updates: Partial<ShortcutDefinition>): boolean {
    const shortcut = this.activeScheme.shortcuts.find(s => s.id === shortcutId);
    if (!shortcut || !shortcut.customizable) {
      return false;
    }

    // Check for conflicts
    if (this.config.enableConflictDetection && updates.keys) {
      const conflict = this.checkConflict(shortcutId, updates.keys, updates.modifiers || shortcut.modifiers);
      if (conflict) {
        console.warn('Shortcut conflict detected:', conflict);
        return false;
      }
    }

    // Apply updates
    Object.assign(shortcut, updates);
    this.activeScheme.updatedAt = Date.now();
    this.saveCustomShortcuts();
    this.notifyListeners();

    return true;
  }

  /**
   * 检查冲突
   */
  checkConflict(
    shortcutId: string,
    keys: string[],
    modifiers: ModifierKey[]
  ): ShortcutConflict | null {
    for (const shortcut of this.activeScheme.shortcuts) {
      if (shortcut.id === shortcutId || !shortcut.enabled) continue;

      if (shortcut.keys.length !== keys.length) continue;

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

  /**
   * 获取快捷键统计
   */
  getStats(): ShortcutStats {
    const shortcuts = this.activeScheme.shortcuts;

    return {
      totalShortcuts: shortcuts.length,
      enabledShortcuts: shortcuts.filter(s => s.enabled).length,
      disabledShortcuts: shortcuts.filter(s => !s.enabled).length,
      conflicts: 0, // TODO: Count conflicts
      customShortcuts: shortcuts.filter(s => s.customizable).length,
    };
  }

  /**
   * 获取快捷键列表
   */
  getShortcuts(): ShortcutDefinition[] {
    return [...this.activeScheme.shortcuts];
  }

  /**
   * 获取分类的快捷键
   */
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

  /**
   * 搜索快捷键
   */
  searchShortcuts(query: string): ShortcutDefinition[] {
    const lowerQuery = query.toLowerCase();

    return this.activeScheme.shortcuts.filter(shortcut =>
      shortcut.label.toLowerCase().includes(lowerQuery) ||
      shortcut.description.toLowerCase().includes(lowerQuery) ||
      shortcut.action.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * 重置为默认方案
   */
  resetToDefault(): void {
    const defaultScheme = ALL_SHORTCUT_SCHEMES.find(s => s.isDefault);
    if (defaultScheme) {
      this.activeScheme = { ...defaultScheme };
      this.config.activeSchemeId = defaultScheme.id;
      this.saveCustomShortcuts();
      this.notifyListeners();
    }
  }

  /**
   * 导出快捷键配置
   */
  exportConfig(): string {
    return JSON.stringify({
      schemeId: this.activeScheme.id,
      shortcuts: this.activeScheme.shortcuts,
    }, null, 2);
  }

  /**
   * 导入快捷键配置
   */
  importConfig(configJson: string): boolean {
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
    } catch {
      return false;
    }
  }

  /**
   * 注册状态监听器
   */
  onShortcutsChange(listener: (shortcuts: ShortcutDefinition[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 通知监听器
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.activeScheme.shortcuts);
      } catch (error) {
        console.error('Shortcut listener error:', error);
      }
    }
  }

  /**
   * 保存自定义快捷键
   */
  private saveCustomShortcuts(): void {
    try {
      localStorage.setItem(this.config.storageKey, this.exportConfig());
    } catch {
      // Storage not available
    }
  }

  /**
   * 加载自定义快捷键
   */
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

  /**
   * 更新配置
   */
  updateConfig(patch: Partial<ShortcutConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  /**
   * 获取配置
   */
  getConfig(): ShortcutConfig {
    return { ...this.config };
  }

  /**
   * 检查快捷键是否启用
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * 启用/禁用快捷键
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    // Clear all timers
    for (const timer of this.keyRepeatTimers.values()) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    this.keyRepeatTimers.clear();

    // Clear states
    this.keyStates.clear();
    this.actionHandlers.clear();
    this.listeners.clear();
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建快捷键管理器实例
 */
export function createShortcutManager(config?: Partial<ShortcutConfig>): ShortcutManager {
  return new ShortcutManager(config);
}

/**
 * 获取预设方案
 */
export function getShortcutScheme(schemeId: string): ShortcutScheme | undefined {
  return ALL_SHORTCUT_SCHEMES.find(s => s.id === schemeId);
}

/**
 * 获取所有预设方案
 */
export function getAllShortcutSchemes(): ShortcutScheme[] {
  return [...ALL_SHORTCUT_SCHEMES];
}

/**
 * 格式化快捷键显示
 */
export function formatShortcutKeys(shortcut: ShortcutDefinition): string {
  const parts: string[] = [];

  // Add modifiers
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

  // Add keys
  for (const key of shortcut.keys) {
    parts.push(key);
  }

  return parts.join(' + ');
}
