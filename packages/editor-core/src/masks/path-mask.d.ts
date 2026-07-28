import type { PathPoint, PathPointHandle } from '../model-types-primitives';
export interface TriangulatedPathMask {
    vertices: number[];
    indices: number[];
}
export declare function isPathMaskClosed(points: PathPoint[] | undefined, epsilon?: number): boolean;
export declare function normalizePathPoints(points: PathPoint[] | undefined): PathPoint[];
export declare function closePathPoints(points: PathPoint[] | undefined): PathPoint[];
export declare function samplePathPoints(points: PathPoint[] | undefined, segmentsPerCurve?: number): PathPointHandle[];
export declare function triangulatePathMask(points: PathPoint[] | undefined): TriangulatedPathMask;
export declare function pathPointsToSvgPath(points: PathPoint[] | undefined, width?: number, height?: number): string;
//# sourceMappingURL=path-mask.d.ts.map