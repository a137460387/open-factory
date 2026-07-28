export interface VfrFrameRateProbe {
    avgFrameRate?: string;
    realFrameRate?: string;
}
export declare function parseFrameRateRatio(value: string | undefined): number | undefined;
export declare function isVariableFrameRateProbe(probe: VfrFrameRateProbe, tolerance?: number): boolean;
export declare function getCfrTargetFrameRate(probe: VfrFrameRateProbe, fallback?: number): number;
export declare function buildCfrFpsFilter(frameRate: number): string;
export declare function normalizeFrameRate(frameRate: number): number;
export declare function isFrameRateMismatch(mediaFrameRate: number | undefined, projectFrameRate: number | undefined, tolerance?: number): boolean;
export declare function getProjectFrameRateConversionTarget(projectFrameRate: number | undefined, fallback?: number): number;
//# sourceMappingURL=vfr.d.ts.map