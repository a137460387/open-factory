export type QuickActionId = 'mute' | 'solo' | 'volume' | 'aspect-ratio' | 'add-marker' | 'copy' | 'delete' | 'split-here' | 'inspector';
export interface QuickActionDefinition {
    id: QuickActionId;
    label: string;
    batchSupported: boolean;
    icon: string;
}
export declare const ALL_QUICK_ACTIONS: QuickActionDefinition[];
export declare const DEFAULT_QUICK_ACTION_ORDER: QuickActionId[];
export declare const MAX_QUICK_ACTIONS = 8;
export declare function normalizeQuickActionOrder(value: unknown): QuickActionId[];
export declare function getBatchSupportedActions(order: QuickActionId[]): QuickActionId[];
export interface QuickActionPosition {
    x: number;
    y: number;
    placement: 'above' | 'below';
}
export declare function calculateQuickActionPosition(clipRect: {
    x: number;
    y: number;
    width: number;
    height: number;
}, toolbarWidth: number, toolbarHeight: number, viewportWidth: number, viewportHeight: number): QuickActionPosition;
export declare function filterActionsForSelection(order: QuickActionId[], selectedCount: number): QuickActionId[];
export declare function serializeQuickActionOrder(order: QuickActionId[]): string;
export declare function deserializeQuickActionOrder(json: string): QuickActionId[];
//# sourceMappingURL=quick-actions.d.ts.map