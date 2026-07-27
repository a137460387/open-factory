export const ALL_QUICK_ACTIONS = [
    { id: 'mute', label: '静音', batchSupported: true, icon: 'VolumeX' },
    { id: 'solo', label: '独奏', batchSupported: false, icon: 'Volume2' },
    { id: 'volume', label: '音量', batchSupported: false, icon: 'SlidersHorizontal' },
    { id: 'aspect-ratio', label: '裁剪比例', batchSupported: true, icon: 'Crop' },
    { id: 'add-marker', label: '标记', batchSupported: false, icon: 'Bookmark' },
    { id: 'copy', label: '复制', batchSupported: true, icon: 'Copy' },
    { id: 'delete', label: '删除', batchSupported: true, icon: 'Trash2' },
    { id: 'split-here', label: '分割', batchSupported: false, icon: 'Scissors' },
    { id: 'inspector', label: '属性', batchSupported: false, icon: 'Sliders' },
];
export const DEFAULT_QUICK_ACTION_ORDER = [
    'mute',
    'solo',
    'volume',
    'aspect-ratio',
    'add-marker',
    'copy',
    'delete',
    'split-here',
];
export const MAX_QUICK_ACTIONS = 8;
export function normalizeQuickActionOrder(value) {
    if (!Array.isArray(value)) {
        return [...DEFAULT_QUICK_ACTION_ORDER];
    }
    const valid = value.filter((id) => ALL_QUICK_ACTIONS.some((action) => action.id === id));
    return valid.length > 0 ? valid.slice(0, MAX_QUICK_ACTIONS) : [...DEFAULT_QUICK_ACTION_ORDER];
}
export function getBatchSupportedActions(order) {
    return order.filter((id) => {
        const action = ALL_QUICK_ACTIONS.find((a) => a.id === id);
        return action?.batchSupported === true;
    });
}
export function calculateQuickActionPosition(clipRect, toolbarWidth, toolbarHeight, viewportWidth, viewportHeight) {
    const PADDING = 8;
    const center = clipRect.x + clipRect.width / 2;
    let x = center - toolbarWidth / 2;
    if (x < PADDING) {
        x = PADDING;
    }
    else if (x + toolbarWidth > viewportWidth - PADDING) {
        x = viewportWidth - PADDING - toolbarWidth;
    }
    const aboveY = clipRect.y - toolbarHeight - PADDING;
    const belowY = clipRect.y + clipRect.height + PADDING;
    if (aboveY >= PADDING) {
        return { x, y: aboveY, placement: 'above' };
    }
    return { x, y: belowY, placement: 'below' };
}
export function filterActionsForSelection(order, selectedCount) {
    if (selectedCount <= 1) {
        return order;
    }
    return getBatchSupportedActions(order);
}
export function serializeQuickActionOrder(order) {
    return JSON.stringify(order);
}
export function deserializeQuickActionOrder(json) {
    try {
        return normalizeQuickActionOrder(JSON.parse(json));
    }
    catch {
        return [...DEFAULT_QUICK_ACTION_ORDER];
    }
}
//# sourceMappingURL=quick-actions.js.map