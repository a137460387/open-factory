import { type Clip, type ClipGroup, type ClipGroupColor, type ColorCorrection } from './model';
export declare const CLIP_GROUP_COLORS: readonly ClipGroupColor[];
export declare const CLIP_GROUP_COLOR_HEX: Record<ClipGroupColor, string>;
export declare const DEFAULT_CLIP_GROUP_COLOR: ClipGroupColor;
export declare const DEFAULT_CLIP_GROUP_NAME = "Group";
export interface ClipGroupInput {
    id?: string;
    name?: string;
    clipIds: string[];
    color?: ClipGroupColor | string;
}
export interface ClipGroupBatchPatch {
    volume?: number;
    speed?: number;
    colorCorrection?: Partial<ColorCorrection>;
}
type NormalizableClipGroup = Partial<Omit<ClipGroup, 'color'>> & {
    color?: ClipGroupColor | string;
};
export declare function normalizeClipGroups(groups: readonly NormalizableClipGroup[] | undefined, availableClipIds?: Iterable<string>): ClipGroup[];
export declare function createClipGroup(input: ClipGroupInput, availableClipIds?: Iterable<string>): ClipGroup;
export declare function findClipGroupForClip(groups: readonly ClipGroup[] | undefined, clipId: string): ClipGroup | undefined;
export declare function findCompleteClipGroup(groups: readonly ClipGroup[] | undefined, clipIds: readonly string[]): ClipGroup | undefined;
export declare function calculateClipGroupMoveStarts(clips: readonly Pick<Clip, 'id' | 'start'>[], clipIds: readonly string[], draggedClipId: string, newDraggedStart: number): Record<string, number>;
export declare function removeClipIdsFromGroups(groups: readonly ClipGroup[] | undefined, clipIds: Iterable<string>): ClipGroup[];
export {};
//# sourceMappingURL=clip-groups.d.ts.map