export type ExportColorSpace = 'srgb' | 'rec709' | 'dci-p3' | 'display-p3' | 'rec2020';
export type ProjectWorkingColorSpace = ExportColorSpace;

export interface ExportColorManagementSettings {
  inputColorSpace: ExportColorSpace;
  outputColorSpace: ExportColorSpace;
  embedIccProfile: boolean;
}

export interface MediaColorProfile {
  sourceColorSpace: ExportColorSpace;
  label: string;
  colorSpace?: string;
  colorPrimaries?: string;
  colorTransfer?: string;
  autoConvertToWorkingSpace?: boolean;
}

export interface FfmpegColorSpaceProfile {
  space: string;
  matrix: string;
  primaries: string;
  trc: string;
  transfer: string;
}

export const EXPORT_COLOR_SPACES: ExportColorSpace[] = ['srgb', 'rec709', 'rec2020', 'dci-p3', 'display-p3'];

export const DEFAULT_EXPORT_COLOR_MANAGEMENT: ExportColorManagementSettings = {
  inputColorSpace: 'srgb',
  outputColorSpace: 'srgb',
  embedIccProfile: true
};

export const DEFAULT_PROJECT_WORKING_COLOR_SPACE: ProjectWorkingColorSpace = 'srgb';

export const EXPORT_ICC_PROFILE_BASE64 = {
  srgb: 'AAAAoAAAAAAAAAAAbW50clJHQiBYWVogAAAAAAAAAAAAAAAAYWNzcAAAAAAAAAAAT0ZBQwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABvcGVuLWZhY3Rvcnktc3JnYi12MQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
  'dci-p3': 'AAAAoAAAAAAAAAAAbW50clJHQiBYWVogAAAAAAAAAAAAAAAAYWNzcAAAAAAAAAAAT0ZBQwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABvcGVuLWZhY3RvcnktZGNpcDMtdjEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
  'display-p3': 'AAAAoAAAAAAAAAAAbW50clJHQiBYWVogAAAAAAAAAAAAAAAAYWNzcAAAAAAAAAAAT0ZBQwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABvcGVuLWZhY3RvcnktZGlzcGxheXAzLXYxAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
  rec2020: 'AAAAoAAAAAAAAAAAbW50clJHQiBYWVogAAAAAAAAAAAAAAAAYWNzcAAAAAAAAAAAT0ZBQwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABvcGVuLWZhY3RvcnktcmVjMjAyMC12MQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=='
} as const satisfies Record<'srgb' | 'dci-p3' | 'display-p3' | 'rec2020', string>;

export function normalizeExportColorSpace(value: unknown, fallback: ExportColorSpace = 'srgb'): ExportColorSpace {
  return value === 'srgb' || value === 'rec709' || value === 'dci-p3' || value === 'display-p3' || value === 'rec2020' ? value : fallback;
}

export function normalizeProjectWorkingColorSpace(value: unknown, fallback: ProjectWorkingColorSpace = DEFAULT_PROJECT_WORKING_COLOR_SPACE): ProjectWorkingColorSpace {
  return normalizeExportColorSpace(value, fallback);
}

export function normalizeExportColorManagement(value: Partial<ExportColorManagementSettings> | undefined): ExportColorManagementSettings {
  return {
    inputColorSpace: normalizeExportColorSpace(value?.inputColorSpace, DEFAULT_EXPORT_COLOR_MANAGEMENT.inputColorSpace),
    outputColorSpace: normalizeExportColorSpace(value?.outputColorSpace, DEFAULT_EXPORT_COLOR_MANAGEMENT.outputColorSpace),
    embedIccProfile: value?.embedIccProfile !== false
  };
}

export function isDefaultExportColorManagement(value: Partial<ExportColorManagementSettings> | undefined): boolean {
  const normalized = normalizeExportColorManagement(value);
  return (
    normalized.inputColorSpace === DEFAULT_EXPORT_COLOR_MANAGEMENT.inputColorSpace &&
    normalized.outputColorSpace === DEFAULT_EXPORT_COLOR_MANAGEMENT.outputColorSpace &&
    normalized.embedIccProfile === DEFAULT_EXPORT_COLOR_MANAGEMENT.embedIccProfile
  );
}

export function getExportIccProfileBase64(colorSpace: ExportColorSpace): string {
  if (colorSpace === 'dci-p3' || colorSpace === 'display-p3' || colorSpace === 'rec2020') {
    return EXPORT_ICC_PROFILE_BASE64[colorSpace];
  }
  return EXPORT_ICC_PROFILE_BASE64.srgb;
}

export function getFfmpegColorSpaceProfile(colorSpace: ExportColorSpace): FfmpegColorSpaceProfile {
  if (colorSpace === 'rec2020') {
    return { space: 'bt2020nc', matrix: 'bt2020nc', primaries: 'bt2020', trc: 'bt2020-10', transfer: 'bt2020-10' };
  }
  if (colorSpace === 'dci-p3') {
    return { space: 'bt709', matrix: 'bt709', primaries: 'smpte432', trc: 'bt709', transfer: 'bt709' };
  }
  if (colorSpace === 'display-p3') {
    return { space: 'bt709', matrix: 'bt709', primaries: 'smpte432', trc: 'iec61966-2-1', transfer: 'iec61966-2-1' };
  }
  if (colorSpace === 'rec709') {
    return { space: 'bt709', matrix: 'bt709', primaries: 'bt709', trc: 'bt709', transfer: 'bt709' };
  }
  return { space: 'bt709', matrix: 'bt709', primaries: 'bt709', trc: 'iec61966-2-1', transfer: 'iec61966-2-1' };
}

export function buildZscaleColorConversionFilter(inputColorSpace: ExportColorSpace, outputColorSpace: ExportColorSpace): string | undefined {
  if (inputColorSpace === outputColorSpace) {
    return undefined;
  }
  const input = getFfmpegColorSpaceProfile(inputColorSpace);
  const output = getFfmpegColorSpaceProfile(outputColorSpace);
  const args = [
    `matrixin=${input.matrix}`,
    `transferin=${input.transfer}`,
    `primariesin=${input.primaries}`,
    `matrix=${output.matrix}`,
    `transfer=${output.transfer}`,
    `primaries=${output.primaries}`,
    'range=tv'
  ];
  return `zscale=${args.join(':')}`;
}

export function buildExportColorTagArgs(colorSpace: ExportColorSpace): string[] {
  const profile = getFfmpegColorSpaceProfile(colorSpace);
  return ['-color_primaries', profile.primaries, '-color_trc', profile.trc, '-colorspace', profile.space];
}

export function buildIccMetadataArgs(colorSpace: ExportColorSpace): string[] {
  return ['-metadata:s:v:0', `icc_profile=${getExportIccProfileBase64(colorSpace)}`];
}

export function parseFfprobeColorProfile(input: { colorSpace?: unknown; colorPrimaries?: unknown; colorTransfer?: unknown; colorTrc?: unknown }): MediaColorProfile | undefined {
  const colorSpace = normalizeProbeField(input.colorSpace);
  const colorPrimaries = normalizeProbeField(input.colorPrimaries);
  const colorTransfer = normalizeProbeField(input.colorTransfer ?? input.colorTrc);
  const detected = inferColorSpaceFromProbeFields(colorSpace, colorPrimaries, colorTransfer);
  if (!detected) {
    return undefined;
  }
  return {
    sourceColorSpace: detected,
    label: getColorSpaceDisplayName(detected),
    ...(colorSpace ? { colorSpace } : {}),
    ...(colorPrimaries ? { colorPrimaries } : {}),
    ...(colorTransfer ? { colorTransfer } : {})
  };
}

export function getColorSpaceDisplayName(colorSpace: ExportColorSpace): string {
  if (colorSpace === 'rec709') {
    return 'Rec.709';
  }
  if (colorSpace === 'rec2020') {
    return 'Rec.2020';
  }
  if (colorSpace === 'dci-p3') {
    return 'DCI-P3';
  }
  if (colorSpace === 'display-p3') {
    return 'Display P3';
  }
  return 'sRGB';
}

function normalizeProbeField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : undefined;
}

function inferColorSpaceFromProbeFields(colorSpace?: string, colorPrimaries?: string, colorTransfer?: string): ExportColorSpace | undefined {
  const combined = [colorSpace, colorPrimaries, colorTransfer].filter(Boolean).join(' ');
  if (!combined) {
    return undefined;
  }
  if (combined.includes('2020')) {
    return 'rec2020';
  }
  if (combined.includes('display-p3')) {
    return 'display-p3';
  }
  if (colorPrimaries === 'smpte432' || colorPrimaries === 'smpte431') {
    return colorTransfer === 'iec61966-2-1' ? 'display-p3' : 'dci-p3';
  }
  if (colorTransfer === 'iec61966-2-1' || colorSpace === 'rgb') {
    return 'srgb';
  }
  if (colorPrimaries === 'bt709' || colorSpace === 'bt709' || colorTransfer === 'bt709') {
    return 'rec709';
  }
  return undefined;
}
