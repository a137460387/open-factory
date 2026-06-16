export type ExportColorSpace = 'srgb' | 'rec709' | 'dci-p3' | 'rec2020';

export interface ExportColorManagementSettings {
  inputColorSpace: ExportColorSpace;
  outputColorSpace: ExportColorSpace;
  embedIccProfile: boolean;
}

export const EXPORT_COLOR_SPACES: ExportColorSpace[] = ['srgb', 'rec709', 'dci-p3', 'rec2020'];

export const DEFAULT_EXPORT_COLOR_MANAGEMENT: ExportColorManagementSettings = {
  inputColorSpace: 'srgb',
  outputColorSpace: 'srgb',
  embedIccProfile: true
};

export const EXPORT_ICC_PROFILE_BASE64 = {
  srgb: 'AAAAoAAAAAAAAAAAbW50clJHQiBYWVogAAAAAAAAAAAAAAAAYWNzcAAAAAAAAAAAT0ZBQwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABvcGVuLWZhY3Rvcnktc3JnYi12MQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
  'dci-p3': 'AAAAoAAAAAAAAAAAbW50clJHQiBYWVogAAAAAAAAAAAAAAAAYWNzcAAAAAAAAAAAT0ZBQwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABvcGVuLWZhY3RvcnktZGNpcDMtdjEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
  rec2020: 'AAAAoAAAAAAAAAAAbW50clJHQiBYWVogAAAAAAAAAAAAAAAAYWNzcAAAAAAAAAAAT0ZBQwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABvcGVuLWZhY3RvcnktcmVjMjAyMC12MQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=='
} as const satisfies Record<'srgb' | 'dci-p3' | 'rec2020', string>;

export function normalizeExportColorSpace(value: unknown, fallback: ExportColorSpace = 'srgb'): ExportColorSpace {
  return value === 'srgb' || value === 'rec709' || value === 'dci-p3' || value === 'rec2020' ? value : fallback;
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
  if (colorSpace === 'dci-p3' || colorSpace === 'rec2020') {
    return EXPORT_ICC_PROFILE_BASE64[colorSpace];
  }
  return EXPORT_ICC_PROFILE_BASE64.srgb;
}
