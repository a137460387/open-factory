/**
 * AI PiP (picture-in-picture) smart avoidance.
 *
 * Given subject bounding boxes from the main video (e.g. from reframe AI),
 * evaluates 4 candidate corner positions for a PiP overlay and picks
 * the one with least overlap. Ties broken by rule-of-thirds composition.
 */
export type PipCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export interface PipPlacementSuggestion {
    recommendedCorner: PipCorner;
    /** Overlap reduction (percentage) compared to worst corner */
    overlapReduction: number;
    /** Confidence 0-1 */
    confidence: number;
}
export interface BoundingBox {
    x: number;
    y: number;
    w: number;
    h: number;
}
/**
 * Calculate the overlap area between a normalised bounding box and
 * a normalised rectangle, as a percentage of the bbox area.
 */
export declare function calculateBboxOverlap(bbox: BoundingBox, rect: {
    x: number;
    y: number;
    w: number;
    h: number;
}): number;
/**
 * For a single corner, compute the PiP rectangle position in normalised
 * coordinates, then calculate overlap with the subject bbox.
 */
export declare function evaluateCandidatePosition(subjectBbox: BoundingBox, canvasW: number, canvasH: number, pipW: number, pipH: number, corner: PipCorner, margin?: number): {
    overlap: number;
    thirdsScore: number;
};
/**
 * Suggest the best PiP corner position given subject bounding boxes
 * from multiple sampled frames.
 *
 * For each corner, computes average overlap across all sampled bboxes,
 * then picks the corner with lowest overlap. Ties broken by rule-of-thirds
 * proximity.
 */
export declare function suggestPipPlacement(subjectBboxes: BoundingBox[], canvasW: number, canvasH: number, pipW: number, pipH: number, margin?: number): PipPlacementSuggestion;
//# sourceMappingURL=pip-avoidance.d.ts.map