export interface SelectionRect {
    left: number;
    top: number;
    right: number;
    bottom: number;
}
export declare function normalizeSelectionRect(rect: SelectionRect): SelectionRect;
export declare function rectsIntersect(leftRect: SelectionRect, rightRect: SelectionRect): boolean;
//# sourceMappingURL=timeline-selection.d.ts.map