export type QuickActionId =
  | 'mute'
  | 'solo'
  | 'volume'
  | 'aspect-ratio'
  | 'add-marker'
  | 'copy'
  | 'delete'
  | 'split-here'
  | 'inspector';

export interface QuickActionDefinition {
  id: QuickActionId;
  label: string;
  batchSupported: boolean;
  icon: string;
}

export const ALL_QUICK_ACTIONS: QuickActionDefinition[] = [
  { id: 'mute', label: '静音', batchSupported: true, icon: 'VolumeX' },
  { id: 'solo', label: '独奏', batchSupported: false, icon: 'Volume2' },
  { id: 'volume', label: '音量', batchSupported: false, icon: 'SlidersHorizontal' },
  { id: 'aspect-ratio', label: '裁剪比例', batchSupported: true, icon: 'Crop' },
  { id: 'add-marker', label: '标记', batchSupported: false, icon: 'Bookmark' },
  { id: 'copy', label: '复制', batchSupported: true, icon: 'Copy' },
  { id: 'delete', label: '删除', batchSupported: true, icon: 'Trash2' },
  { id: 'split-here', label: '分割', batchSupported: false, icon: 'Scissors' },
  { id: 'inspector', label: '属性', batchSupported: false, icon: 'Sliders' }
];

export const DEFAULT_QUICK_ACTION_ORDER: QuickActionId[] = [
  'mute', 'solo', 'volume', 'aspect-ratio', 'add-marker', 'copy', 'delete', 'split-here'
];

export const MAX_QUICK_ACTIONS = 8;

export function normalizeQuickActionOrder(value: unknown): QuickActionId[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_QUICK_ACTION_ORDER];
  }
  const valid = value.filter((id): id is QuickActionId =>
    ALL_QUICK_ACTIONS.some((action) => action.id === id)
  );
  return valid.length > 0 ? valid.slice(0, MAX_QUICK_ACTIONS) : [...DEFAULT_QUICK_ACTION_ORDER];
}

export function getBatchSupportedActions(order: QuickActionId[]): QuickActionId[] {
  return order.filter((id) => {
    const action = ALL_QUICK_ACTIONS.find((a) => a.id === id);
    return action?.batchSupported === true;
  });
}

export interface QuickActionPosition {
  x: number;
  y: number;
  placement: 'above' | 'below';
}

export function calculateQuickActionPosition(
  clipRect: { x: number; y: number; width: number; height: number },
  toolbarWidth: number,
  toolbarHeight: number,
  viewportWidth: number,
  viewportHeight: number
): QuickActionPosition {
  const PADDING = 8;
  const center = clipRect.x + clipRect.width / 2;
  let x = center - toolbarWidth / 2;

  if (x < PADDING) {
    x = PADDING;
  } else if (x + toolbarWidth > viewportWidth - PADDING) {
    x = viewportWidth - PADDING - toolbarWidth;
  }

  const aboveY = clipRect.y - toolbarHeight - PADDING;
  const belowY = clipRect.y + clipRect.height + PADDING;

  if (aboveY >= PADDING) {
    return { x, y: aboveY, placement: 'above' };
  }
  return { x, y: belowY, placement: 'below' };
}

export function filterActionsForSelection(
  order: QuickActionId[],
  selectedCount: number
): QuickActionId[] {
  if (selectedCount <= 1) {
    return order;
  }
  return getBatchSupportedActions(order);
}

export function serializeQuickActionOrder(order: QuickActionId[]): string {
  return JSON.stringify(order);
}

export function deserializeQuickActionOrder(json: string): QuickActionId[] {
  try {
    return normalizeQuickActionOrder(JSON.parse(json));
  } catch {
    return [...DEFAULT_QUICK_ACTION_ORDER];
  }
}
