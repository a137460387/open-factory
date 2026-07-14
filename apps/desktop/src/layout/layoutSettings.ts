const TIMELINE_MIN_HEIGHT_PX = 120;
const TIMELINE_DEFAULT_HEIGHT_PX = 260;
const TIMELINE_MAX_VIEWPORT_RATIO = 0.6;
const INSPECTOR_AUTO_COLLAPSE_WIDTH_PX = 1200;
const WORKSPACE_LEFT_PANEL_MIN_WIDTH_PX = 48;
const WORKSPACE_LEFT_PANEL_DEFAULT_WIDTH_PX = 280;
const WORKSPACE_LEFT_PANEL_MAX_WIDTH_PX = 420;
const WORKSPACE_RIGHT_PANEL_MIN_WIDTH_PX = 48;
const WORKSPACE_RIGHT_PANEL_DEFAULT_WIDTH_PX = 360;
const WORKSPACE_RIGHT_PANEL_MAX_WIDTH_PX = 560;
const WORKSPACE_MIXER_MIN_HEIGHT_PX = 160;
const WORKSPACE_MIXER_DEFAULT_HEIGHT_PX = 220;
const WORKSPACE_MIXER_MAX_HEIGHT_PX = 420;

export type BuiltInWorkspaceLayoutId = 'standard-editing' | 'color-grading' | 'audio-editing';
export type WorkspaceLayoutId = BuiltInWorkspaceLayoutId | string;
type WorkspacePreviewPosition = 'center' | 'left' | 'right';

interface WorkspacePanelVisibility {
  mediaLibrary: boolean;
  inspector: boolean;
  audioMixer: boolean;
  colorScopes: boolean;
  history: boolean;
  bookmarks: boolean;
}

export interface WorkspaceLayoutDefinition {
  id: WorkspaceLayoutId;
  name: string;
  builtIn?: boolean;
  shortcutSlot?: number;
  panels: WorkspacePanelVisibility;
  leftPanelWidthPx: number;
  rightPanelWidthPx: number;
  mixerHeightPx: number;
  timelineHeightPx: number;
  previewPosition: WorkspacePreviewPosition;
}

export interface EditorLayoutSettings {
  timelineHeightPx: number;
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  activeWorkspaceLayoutId: WorkspaceLayoutId;
  panels: WorkspacePanelVisibility;
  leftPanelWidthPx: number;
  rightPanelWidthPx: number;
  mixerHeightPx: number;
  previewPosition: WorkspacePreviewPosition;
  customWorkspaceLayouts: WorkspaceLayoutDefinition[];
}

export interface EffectivePanelState {
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  rightPanelAutoCollapsed: boolean;
  rightPrimaryPanelVisible: boolean;
  audioMixerVisible: boolean;
}

const DEFAULT_WORKSPACE_PANEL_VISIBILITY: WorkspacePanelVisibility = {
  mediaLibrary: true,
  inspector: true,
  audioMixer: true,
  colorScopes: false,
  history: false,
  bookmarks: true,
};

export const BUILT_IN_WORKSPACE_LAYOUTS: Record<BuiltInWorkspaceLayoutId, WorkspaceLayoutDefinition> = {
  'standard-editing': {
    id: 'standard-editing',
    name: '标准剪辑',
    builtIn: true,
    shortcutSlot: 1,
    panels: { ...DEFAULT_WORKSPACE_PANEL_VISIBILITY },
    leftPanelWidthPx: WORKSPACE_LEFT_PANEL_DEFAULT_WIDTH_PX,
    rightPanelWidthPx: WORKSPACE_RIGHT_PANEL_DEFAULT_WIDTH_PX,
    mixerHeightPx: WORKSPACE_MIXER_DEFAULT_HEIGHT_PX,
    timelineHeightPx: TIMELINE_DEFAULT_HEIGHT_PX,
    previewPosition: 'center',
  },
  'color-grading': {
    id: 'color-grading',
    name: '调色模式',
    builtIn: true,
    shortcutSlot: 2,
    panels: {
      mediaLibrary: false,
      inspector: true,
      audioMixer: false,
      colorScopes: true,
      history: false,
      bookmarks: false,
    },
    leftPanelWidthPx: WORKSPACE_LEFT_PANEL_MIN_WIDTH_PX,
    rightPanelWidthPx: 420,
    mixerHeightPx: WORKSPACE_MIXER_MIN_HEIGHT_PX,
    timelineHeightPx: 220,
    previewPosition: 'center',
  },
  'audio-editing': {
    id: 'audio-editing',
    name: '音频模式',
    builtIn: true,
    shortcutSlot: 3,
    panels: {
      mediaLibrary: true,
      inspector: false,
      audioMixer: true,
      colorScopes: false,
      history: false,
      bookmarks: true,
    },
    leftPanelWidthPx: 240,
    rightPanelWidthPx: 460,
    mixerHeightPx: 360,
    timelineHeightPx: 340,
    previewPosition: 'center',
  },
};

export const BUILT_IN_WORKSPACE_LAYOUT_IDS: BuiltInWorkspaceLayoutId[] = [
  'standard-editing',
  'color-grading',
  'audio-editing',
];

export const DEFAULT_EDITOR_LAYOUT_SETTINGS: EditorLayoutSettings = {
  ...workspaceLayoutToSettings(BUILT_IN_WORKSPACE_LAYOUTS['standard-editing']),
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,
  customWorkspaceLayouts: [],
};

export function clampTimelineHeight(heightPx: number, viewportHeightPx: number): number {
  const maxHeight = Math.max(TIMELINE_MIN_HEIGHT_PX, Math.floor(viewportHeightPx * TIMELINE_MAX_VIEWPORT_RATIO));
  const height = Number.isFinite(heightPx) ? heightPx : TIMELINE_DEFAULT_HEIGHT_PX;
  return Math.min(maxHeight, Math.max(TIMELINE_MIN_HEIGHT_PX, Math.round(height)));
}

function clampWorkspacePanelWidth(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function normalizeStoredLayoutSettings(input: unknown): EditorLayoutSettings | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }
  const value = input as Partial<Record<keyof EditorLayoutSettings, unknown>>;
  const customWorkspaceLayouts = normalizeCustomWorkspaceLayouts(value.customWorkspaceLayouts);
  const activeWorkspaceLayoutId = normalizeWorkspaceLayoutId(value.activeWorkspaceLayoutId);
  const builtIn =
    activeWorkspaceLayoutId && isBuiltInWorkspaceLayoutId(activeWorkspaceLayoutId)
      ? BUILT_IN_WORKSPACE_LAYOUTS[activeWorkspaceLayoutId]
      : undefined;
  const base = builtIn ?? BUILT_IN_WORKSPACE_LAYOUTS['standard-editing'];
  const panels = normalizeWorkspacePanelVisibility(value.panels, base.panels);
  return {
    timelineHeightPx: normalizeStoredTimelineHeight(value.timelineHeightPx),
    leftPanelCollapsed: value.leftPanelCollapsed === true,
    rightPanelCollapsed: value.rightPanelCollapsed === true,
    activeWorkspaceLayoutId: activeWorkspaceLayoutId ?? base.id,
    panels,
    leftPanelWidthPx: clampWorkspacePanelWidth(
      value.leftPanelWidthPx,
      WORKSPACE_LEFT_PANEL_MIN_WIDTH_PX,
      WORKSPACE_LEFT_PANEL_MAX_WIDTH_PX,
      base.leftPanelWidthPx,
    ),
    rightPanelWidthPx: clampWorkspacePanelWidth(
      value.rightPanelWidthPx,
      WORKSPACE_RIGHT_PANEL_MIN_WIDTH_PX,
      WORKSPACE_RIGHT_PANEL_MAX_WIDTH_PX,
      base.rightPanelWidthPx,
    ),
    mixerHeightPx: clampWorkspacePanelWidth(
      value.mixerHeightPx,
      WORKSPACE_MIXER_MIN_HEIGHT_PX,
      WORKSPACE_MIXER_MAX_HEIGHT_PX,
      base.mixerHeightPx,
    ),
    previewPosition: normalizePreviewPosition(value.previewPosition, base.previewPosition),
    customWorkspaceLayouts,
  };
}

export function getEffectivePanelState(settings: EditorLayoutSettings, viewportWidthPx: number): EffectivePanelState {
  const rightPanelAutoCollapsed = viewportWidthPx > 0 && viewportWidthPx < INSPECTOR_AUTO_COLLAPSE_WIDTH_PX;
  const rightPrimaryPanelVisible = settings.panels.inspector || settings.panels.history;
  const audioMixerVisible = settings.panels.audioMixer;
  return {
    leftPanelCollapsed: settings.leftPanelCollapsed || !settings.panels.mediaLibrary,
    rightPanelCollapsed:
      settings.rightPanelCollapsed || rightPanelAutoCollapsed || (!rightPrimaryPanelVisible && !audioMixerVisible),
    rightPanelAutoCollapsed,
    rightPrimaryPanelVisible,
    audioMixerVisible,
  };
}

function workspaceLayoutToSettings(
  layout: WorkspaceLayoutDefinition,
): Omit<EditorLayoutSettings, 'leftPanelCollapsed' | 'rightPanelCollapsed' | 'customWorkspaceLayouts'> {
  const normalized =
    normalizeWorkspaceLayoutDefinition(layout, layout.id) ?? BUILT_IN_WORKSPACE_LAYOUTS['standard-editing'];
  return {
    timelineHeightPx: normalized.timelineHeightPx,
    activeWorkspaceLayoutId: normalized.id,
    panels: normalized.panels,
    leftPanelWidthPx: normalized.leftPanelWidthPx,
    rightPanelWidthPx: normalized.rightPanelWidthPx,
    mixerHeightPx: normalized.mixerHeightPx,
    previewPosition: normalized.previewPosition,
  };
}

export function applyWorkspaceLayout(
  settings: EditorLayoutSettings,
  layout: WorkspaceLayoutDefinition,
): EditorLayoutSettings {
  return {
    ...settings,
    ...workspaceLayoutToSettings(layout),
    leftPanelCollapsed: !layout.panels.mediaLibrary,
    rightPanelCollapsed: !(layout.panels.inspector || layout.panels.history || layout.panels.audioMixer),
  };
}

export function createCustomWorkspaceLayout(
  name: string,
  settings: EditorLayoutSettings,
  existingLayouts: WorkspaceLayoutDefinition[] = settings.customWorkspaceLayouts,
): WorkspaceLayoutDefinition {
  const safeName = name.trim() || '自定义布局';
  const usedIds = new Set([...BUILT_IN_WORKSPACE_LAYOUT_IDS, ...existingLayouts.map((layout) => layout.id)]);
  const id = uniqueWorkspaceLayoutId(safeName, usedIds);
  const usedSlots = new Set(
    existingLayouts.map((layout) => layout.shortcutSlot).filter((slot): slot is number => typeof slot === 'number'),
  );
  const shortcutSlot = [4, 5, 6, 7, 8, 9].find((slot) => !usedSlots.has(slot));
  return {
    id,
    name: safeName,
    builtIn: false,
    shortcutSlot,
    panels: { ...settings.panels },
    leftPanelWidthPx: settings.leftPanelWidthPx,
    rightPanelWidthPx: settings.rightPanelWidthPx,
    mixerHeightPx: settings.mixerHeightPx,
    timelineHeightPx: settings.timelineHeightPx,
    previewPosition: settings.previewPosition,
  };
}

function normalizeWorkspaceLayoutDefinition(
  input: unknown,
  fallbackId = 'custom-workspace',
): WorkspaceLayoutDefinition | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }
  const value = input as Partial<Record<keyof WorkspaceLayoutDefinition, unknown>>;
  const fallback = BUILT_IN_WORKSPACE_LAYOUTS['standard-editing'];
  const id = normalizeWorkspaceLayoutId(value.id) ?? fallbackId;
  const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim().slice(0, 48) : fallback.name;
  const panels = normalizeWorkspacePanelVisibility(value.panels, fallback.panels);
  return {
    id,
    name,
    builtIn: value.builtIn === true,
    shortcutSlot: normalizeShortcutSlot(value.shortcutSlot),
    panels,
    leftPanelWidthPx: clampWorkspacePanelWidth(
      value.leftPanelWidthPx,
      WORKSPACE_LEFT_PANEL_MIN_WIDTH_PX,
      WORKSPACE_LEFT_PANEL_MAX_WIDTH_PX,
      fallback.leftPanelWidthPx,
    ),
    rightPanelWidthPx: clampWorkspacePanelWidth(
      value.rightPanelWidthPx,
      WORKSPACE_RIGHT_PANEL_MIN_WIDTH_PX,
      WORKSPACE_RIGHT_PANEL_MAX_WIDTH_PX,
      fallback.rightPanelWidthPx,
    ),
    mixerHeightPx: clampWorkspacePanelWidth(
      value.mixerHeightPx,
      WORKSPACE_MIXER_MIN_HEIGHT_PX,
      WORKSPACE_MIXER_MAX_HEIGHT_PX,
      fallback.mixerHeightPx,
    ),
    timelineHeightPx: normalizeStoredTimelineHeight(value.timelineHeightPx),
    previewPosition: normalizePreviewPosition(value.previewPosition, fallback.previewPosition),
  };
}

function normalizeCustomWorkspaceLayouts(layouts: unknown): WorkspaceLayoutDefinition[] {
  if (!Array.isArray(layouts)) {
    return [];
  }
  const usedIds = new Set<string>();
  const usedSlots = new Set<number>();
  return layouts.flatMap((layout, index): WorkspaceLayoutDefinition[] => {
    const normalized = normalizeWorkspaceLayoutDefinition(layout, `custom-workspace-${index + 1}`);
    if (!normalized || isBuiltInWorkspaceLayoutId(normalized.id) || usedIds.has(normalized.id)) {
      return [];
    }
    usedIds.add(normalized.id);
    const slot = normalized.shortcutSlot;
    normalized.builtIn = false;
    if (slot && (slot < 4 || slot > 9 || usedSlots.has(slot))) {
      normalized.shortcutSlot = undefined;
    }
    if (normalized.shortcutSlot) {
      usedSlots.add(normalized.shortcutSlot);
    }
    return [normalized];
  });
}

export function resolveWorkspaceLayoutShortcut(
  event: { key: string; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean },
  customLayouts: WorkspaceLayoutDefinition[],
): WorkspaceLayoutId | undefined {
  if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.altKey) {
    return undefined;
  }
  const slot = Number.parseInt(event.key, 10);
  if (!Number.isInteger(slot) || slot < 1 || slot > 9) {
    return undefined;
  }
  const builtIn = BUILT_IN_WORKSPACE_LAYOUT_IDS.find((id) => BUILT_IN_WORKSPACE_LAYOUTS[id].shortcutSlot === slot);
  if (builtIn) {
    return builtIn;
  }
  return customLayouts.find((layout) => layout.shortcutSlot === slot)?.id;
}

export function getWorkspaceLayoutById(
  settings: EditorLayoutSettings,
  id: WorkspaceLayoutId,
): WorkspaceLayoutDefinition | undefined {
  if (isBuiltInWorkspaceLayoutId(id)) {
    return BUILT_IN_WORKSPACE_LAYOUTS[id];
  }
  return settings.customWorkspaceLayouts.find((layout) => layout.id === id);
}

function normalizeStoredTimelineHeight(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return TIMELINE_DEFAULT_HEIGHT_PX;
  }
  return Math.max(TIMELINE_MIN_HEIGHT_PX, Math.round(value));
}

function normalizeWorkspacePanelVisibility(
  input: unknown,
  fallback: WorkspacePanelVisibility,
): WorkspacePanelVisibility {
  if (!input || typeof input !== 'object') {
    return { ...fallback };
  }
  const value = input as Partial<Record<keyof WorkspacePanelVisibility, unknown>>;
  return {
    mediaLibrary: typeof value.mediaLibrary === 'boolean' ? value.mediaLibrary : fallback.mediaLibrary,
    inspector: typeof value.inspector === 'boolean' ? value.inspector : fallback.inspector,
    audioMixer: typeof value.audioMixer === 'boolean' ? value.audioMixer : fallback.audioMixer,
    colorScopes: typeof value.colorScopes === 'boolean' ? value.colorScopes : fallback.colorScopes,
    history: typeof value.history === 'boolean' ? value.history : fallback.history,
    bookmarks: typeof value.bookmarks === 'boolean' ? value.bookmarks : fallback.bookmarks,
  };
}

function normalizeWorkspaceLayoutId(value: unknown): WorkspaceLayoutId | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const id = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return id || undefined;
}

function normalizePreviewPosition(value: unknown, fallback: WorkspacePreviewPosition): WorkspacePreviewPosition {
  return value === 'left' || value === 'right' || value === 'center' ? value : fallback;
}

function normalizeShortcutSlot(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 9) {
    return undefined;
  }
  return value;
}

function isBuiltInWorkspaceLayoutId(id: string): id is BuiltInWorkspaceLayoutId {
  return BUILT_IN_WORKSPACE_LAYOUT_IDS.includes(id as BuiltInWorkspaceLayoutId);
}

function uniqueWorkspaceLayoutId(name: string, usedIds: Set<string>): string {
  const base = normalizeWorkspaceLayoutId(name) ?? 'custom-workspace';
  let candidate = base;
  let index = 2;
  while (usedIds.has(candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }
  return candidate;
}
