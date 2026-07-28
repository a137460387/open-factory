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
  enabled: boolean;
  activeSchemeId: string;
  showTooltips: boolean;
  tooltipDelay: number;
  enableKeyRepeat: boolean;
  keyRepeatDelay: number;
  keyRepeatInterval: number;
  enableConflictDetection: boolean;
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
