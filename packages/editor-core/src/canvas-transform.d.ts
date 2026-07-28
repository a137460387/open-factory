import { type Transform } from './model';
export type CanvasTransformHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export interface CanvasSize {
    width: number;
    height: number;
}
export interface CanvasViewport extends CanvasSize {
    left: number;
    top: number;
    canvasWidth: number;
    canvasHeight: number;
}
export interface CanvasPoint {
    x: number;
    y: number;
}
export interface ClipTransformBox {
    center: CanvasPoint;
    width: number;
    height: number;
    rotation: number;
    corners: Record<'nw' | 'ne' | 'se' | 'sw', CanvasPoint>;
    handles: Record<CanvasTransformHandle, CanvasPoint>;
    rotationHandle: CanvasPoint;
    anchor: CanvasPoint;
}
export interface ClipTransformBoxInput {
    transform: Partial<Transform>;
    sourceWidth: number;
    sourceHeight: number;
    canvasWidth: number;
    canvasHeight: number;
}
export interface ResizeClipTransformInput extends ClipTransformBoxInput {
    handle: CanvasTransformHandle;
    currentPoint: CanvasPoint;
    keepAspectRatio?: boolean;
    fromCenter?: boolean;
}
export interface RotateClipTransformInput extends Pick<ClipTransformBoxInput, 'transform' | 'canvasWidth' | 'canvasHeight'> {
    currentPoint: CanvasPoint;
}
export declare function screenPointToCanvasPoint(point: CanvasPoint, viewport: CanvasViewport): CanvasPoint;
export declare function canvasPointToNormalizedPoint(point: CanvasPoint, canvas: CanvasSize): CanvasPoint;
export declare function normalizedPointToCanvasPoint(point: CanvasPoint, canvas: CanvasSize): CanvasPoint;
export declare function screenDeltaToCanvasDelta(delta: CanvasPoint, viewport: Pick<CanvasViewport, 'width' | 'height' | 'canvasWidth' | 'canvasHeight'>): CanvasPoint;
export declare function moveTransformByCanvasDelta(transform: Partial<Transform>, delta: CanvasPoint): Transform;
export declare function buildClipTransformBox(input: ClipTransformBoxInput): ClipTransformBox;
export declare function hitTestClipTransformBox(point: CanvasPoint, box: Pick<ClipTransformBox, 'center' | 'width' | 'height' | 'rotation'>): boolean;
export declare function resizeClipTransform(input: ResizeClipTransformInput): Transform;
export declare function rotateClipTransform(input: RotateClipTransformInput): Transform;
export declare function normalizeCanvasRotation(rotation: number): number;
//# sourceMappingURL=canvas-transform.d.ts.map