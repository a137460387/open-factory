import type { Transform } from './model';
export type SplitLayoutPresetId = 'side-by-side' | 'stacked' | 'quad' | 'three-columns' | 'main-side';
export interface SplitLayoutCell {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface SplitLayoutDefinition {
    id: string;
    name: string;
    cells: SplitLayoutCell[];
}
export interface SplitLayoutClipSource {
    clipId: string;
    sourceWidth?: number;
    sourceHeight?: number;
}
export interface SplitLayoutTransform {
    clipId: string;
    cell: SplitLayoutCell;
    transform: Transform;
}
export declare const BUILT_IN_SPLIT_LAYOUTS: Record<SplitLayoutPresetId, SplitLayoutDefinition>;
export declare const SPLIT_LAYOUT_PRESET_IDS: SplitLayoutPresetId[];
export declare function getSplitLayoutDefinition(layoutId: SplitLayoutPresetId | string, customLayouts?: SplitLayoutDefinition[]): SplitLayoutDefinition | undefined;
export declare function calculateSplitLayoutTransforms(input: {
    layout: SplitLayoutDefinition;
    clips: SplitLayoutClipSource[];
    canvasWidth: number;
    canvasHeight: number;
}): SplitLayoutTransform[];
export declare function createMainSideSplitLayout(id: string, name: string, mainRatio: number): SplitLayoutDefinition;
export declare function normalizeSplitLayoutDefinition(layout: unknown, fallbackId?: string): SplitLayoutDefinition | undefined;
export declare function normalizeSplitLayoutCells(cells: unknown): SplitLayoutCell[];
//# sourceMappingURL=split-layout.d.ts.map