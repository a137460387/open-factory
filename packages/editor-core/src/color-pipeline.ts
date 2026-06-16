export type ProjectColorPipeline = 'sdr-srgb' | 'hdr-rec2020' | 'aces';

export type CameraIdtMatrixId = 'arri-logc3' | 'sony-slog3' | 'red-log3g10' | 'canon-log3';

export type CameraIdtMatrix = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number]
];

export type ColorPipelineExportColorSpace = 'srgb' | 'rec709' | 'dci-p3' | 'rec2020';

export const DEFAULT_PROJECT_COLOR_PIPELINE: ProjectColorPipeline = 'sdr-srgb';

export const PROJECT_COLOR_PIPELINES = ['sdr-srgb', 'hdr-rec2020', 'aces'] as const satisfies readonly ProjectColorPipeline[];

export const CAMERA_IDT_MATRICES = {
  'arri-logc3': [
    [0.638008, 0.214704, 0.097744],
    [0.291954, 0.823841, -0.115795],
    [0.002798, -0.067034, 1.153294]
  ],
  'sony-slog3': [
    [0.638788, 0.272351, 0.088861],
    [0.003915, 1.088079, -0.091994],
    [0.030528, -0.217302, 1.186774]
  ],
  'red-log3g10': [
    [0.659562, 0.256401, 0.084037],
    [0.197817, 1.02474, -0.222557],
    [0.011132, -0.132815, 1.121683]
  ],
  'canon-log3': [
    [0.634924, 0.234591, 0.130485],
    [0.276132, 0.823295, -0.099427],
    [-0.006082, -0.070431, 1.076513]
  ]
} as const satisfies Record<CameraIdtMatrixId, CameraIdtMatrix>;

export function normalizeProjectColorPipeline(value: unknown): ProjectColorPipeline {
  return PROJECT_COLOR_PIPELINES.includes(value as ProjectColorPipeline) ? (value as ProjectColorPipeline) : DEFAULT_PROJECT_COLOR_PIPELINE;
}

export function isAcesColorPipeline(value: unknown): boolean {
  return normalizeProjectColorPipeline(value) === 'aces';
}

export function buildProjectColorPipelineExportDefaults(pipeline: ProjectColorPipeline): {
  inputColorSpace: ColorPipelineExportColorSpace;
  outputColorSpace: ColorPipelineExportColorSpace;
  embedIccProfile: boolean;
} {
  if (pipeline === 'hdr-rec2020') {
    return { inputColorSpace: 'srgb', outputColorSpace: 'rec2020', embedIccProfile: true };
  }
  if (pipeline === 'aces') {
    return { inputColorSpace: 'rec2020', outputColorSpace: 'rec709', embedIccProfile: true };
  }
  return { inputColorSpace: 'srgb', outputColorSpace: 'srgb', embedIccProfile: true };
}

export function buildAcesOdtFilterChain(pipeline: ProjectColorPipeline, outputColorSpace: ColorPipelineExportColorSpace): string[] {
  if (pipeline !== 'aces') {
    return [];
  }
  const profile = getZscaleOutputProfile(outputColorSpace);
  return [
    'zscale=matrixin=bt709:transferin=linear:primariesin=bt709:matrix=bt709:transfer=linear:primaries=bt709:range=tv',
    `zscale=matrix=${profile.matrix}:transfer=${profile.transfer}:primaries=${profile.primaries}:range=tv`
  ];
}

export function applyHillAcesToneMap(rgb: readonly [number, number, number]): [number, number, number] {
  return [toneMapHillAcesChannel(rgb[0]), toneMapHillAcesChannel(rgb[1]), toneMapHillAcesChannel(rgb[2])];
}

export function toneMapHillAcesChannel(value: number): number {
  const color = Number.isFinite(value) ? Math.max(0, value) : 0;
  const numerator = color * (color + 0.0245786) - 0.000090537;
  const denominator = color * (0.983729 * color + 0.432951) + 0.238081;
  return clampUnit(denominator > 0 ? numerator / denominator : 0);
}

function getZscaleOutputProfile(colorSpace: ColorPipelineExportColorSpace): { matrix: string; transfer: string; primaries: string } {
  if (colorSpace === 'rec2020') {
    return { matrix: 'bt2020nc', transfer: 'bt2020-10', primaries: 'bt2020' };
  }
  if (colorSpace === 'dci-p3') {
    return { matrix: 'bt709', transfer: 'bt709', primaries: 'smpte432' };
  }
  if (colorSpace === 'rec709') {
    return { matrix: 'bt709', transfer: 'bt709', primaries: 'bt709' };
  }
  return { matrix: 'bt709', transfer: 'iec61966-2-1', primaries: 'bt709' };
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}
