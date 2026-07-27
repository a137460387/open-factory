import type { Transform } from './model';
export type PiPLayoutPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
export interface PiPLayoutDimensions {
    canvasWidth: number;
    canvasHeight: number;
    sourceWidth: number;
    sourceHeight: number;
    scale?: number;
    margin?: number;
}
export interface PiPLayoutInput extends PiPLayoutDimensions {
    position: PiPLayoutPosition;
}
export declare const DEFAULT_PIP_SCALE = 0.25;
export declare const DEFAULT_PIP_MARGIN = 32;
export declare function calculatePiPTransform(input: PiPLayoutInput): Transform;
export declare function createFullFrameTransform(): Transform;
//# sourceMappingURL=pip-layout.d.ts.map