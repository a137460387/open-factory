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
export declare const EXPORT_COLOR_SPACES: ExportColorSpace[];
export declare const DEFAULT_EXPORT_COLOR_MANAGEMENT: ExportColorManagementSettings;
export declare const DEFAULT_PROJECT_WORKING_COLOR_SPACE: ProjectWorkingColorSpace;
export declare const EXPORT_ICC_PROFILE_BASE64: {
    readonly srgb: "AAAAoAAAAAAAAAAAbW50clJHQiBYWVogAAAAAAAAAAAAAAAAYWNzcAAAAAAAAAAAT0ZBQwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABvcGVuLWZhY3Rvcnktc3JnYi12MQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";
    readonly 'dci-p3': "AAAAoAAAAAAAAAAAbW50clJHQiBYWVogAAAAAAAAAAAAAAAAYWNzcAAAAAAAAAAAT0ZBQwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABvcGVuLWZhY3RvcnktZGNpcDMtdjEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";
    readonly 'display-p3': "AAAAoAAAAAAAAAAAbW50clJHQiBYWVogAAAAAAAAAAAAAAAAYWNzcAAAAAAAAAAAT0ZBQwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABvcGVuLWZhY3RvcnktZGlzcGxheXAzLXYxAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";
    readonly rec2020: "AAAAoAAAAAAAAAAAbW50clJHQiBYWVogAAAAAAAAAAAAAAAAYWNzcAAAAAAAAAAAT0ZBQwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABvcGVuLWZhY3RvcnktcmVjMjAyMC12MQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";
};
export declare function normalizeExportColorSpace(value: unknown, fallback?: ExportColorSpace): ExportColorSpace;
export declare function normalizeProjectWorkingColorSpace(value: unknown, fallback?: ProjectWorkingColorSpace): ProjectWorkingColorSpace;
export declare function normalizeExportColorManagement(value: Partial<ExportColorManagementSettings> | undefined): ExportColorManagementSettings;
export declare function isDefaultExportColorManagement(value: Partial<ExportColorManagementSettings> | undefined): boolean;
export declare function getExportIccProfileBase64(colorSpace: ExportColorSpace): string;
export declare function getFfmpegColorSpaceProfile(colorSpace: ExportColorSpace): FfmpegColorSpaceProfile;
export declare function buildZscaleColorConversionFilter(inputColorSpace: ExportColorSpace, outputColorSpace: ExportColorSpace): string | undefined;
export declare function buildExportColorTagArgs(colorSpace: ExportColorSpace): string[];
export declare function buildIccMetadataArgs(colorSpace: ExportColorSpace): string[];
export declare function parseFfprobeColorProfile(input: {
    colorSpace?: unknown;
    colorPrimaries?: unknown;
    colorTransfer?: unknown;
    colorTrc?: unknown;
}): MediaColorProfile | undefined;
export declare function getColorSpaceDisplayName(colorSpace: ExportColorSpace): string;
//# sourceMappingURL=color-management.d.ts.map