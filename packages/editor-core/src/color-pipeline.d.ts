export type ProjectColorPipeline = 'sdr-srgb' | 'hdr-rec2020' | 'aces';
export type CameraIdtMatrixId = 'arri-logc3' | 'sony-slog3' | 'red-log3g10' | 'canon-log3';
export type CameraIdtMatrix = readonly [
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number]
];
export type ColorPipelineExportColorSpace = 'srgb' | 'rec709' | 'dci-p3' | 'display-p3' | 'rec2020';
export declare const DEFAULT_PROJECT_COLOR_PIPELINE: ProjectColorPipeline;
export declare const PROJECT_COLOR_PIPELINES: readonly ["sdr-srgb", "hdr-rec2020", "aces"];
export declare const CAMERA_IDT_MATRICES: {
    readonly 'arri-logc3': readonly [readonly [0.638008, 0.214704, 0.097744], readonly [0.291954, 0.823841, -0.115795], readonly [0.002798, -0.067034, 1.153294]];
    readonly 'sony-slog3': readonly [readonly [0.638788, 0.272351, 0.088861], readonly [0.003915, 1.088079, -0.091994], readonly [0.030528, -0.217302, 1.186774]];
    readonly 'red-log3g10': readonly [readonly [0.659562, 0.256401, 0.084037], readonly [0.197817, 1.02474, -0.222557], readonly [0.011132, -0.132815, 1.121683]];
    readonly 'canon-log3': readonly [readonly [0.634924, 0.234591, 0.130485], readonly [0.276132, 0.823295, -0.099427], readonly [-0.006082, -0.070431, 1.076513]];
};
export declare function normalizeProjectColorPipeline(value: unknown): ProjectColorPipeline;
export declare function isAcesColorPipeline(value: unknown): boolean;
export declare function buildProjectColorPipelineExportDefaults(pipeline: ProjectColorPipeline): {
    inputColorSpace: ColorPipelineExportColorSpace;
    outputColorSpace: ColorPipelineExportColorSpace;
    embedIccProfile: boolean;
};
export declare function buildAcesOdtFilterChain(pipeline: ProjectColorPipeline, outputColorSpace: ColorPipelineExportColorSpace): string[];
export declare function applyHillAcesToneMap(rgb: readonly [number, number, number]): [number, number, number];
export declare function toneMapHillAcesChannel(value: number): number;
//# sourceMappingURL=color-pipeline.d.ts.map