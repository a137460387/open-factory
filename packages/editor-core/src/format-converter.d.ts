export type MediaCategory = 'video' | 'audio' | 'image';
export type ConversionDirection = 'video-to-video' | 'video-to-audio' | 'video-to-image-sequence' | 'audio-to-audio' | 'image-to-image';
export interface CodecInfo {
    name: string;
    type: 'encoder' | 'decoder';
    mediaCategory: MediaCategory;
    formats: string[];
}
export interface ConversionPath {
    sourceFormat: string;
    targetFormat: string;
    direction: ConversionDirection;
    intermediateFormat?: string;
    supported: boolean;
    hint?: string;
}
export interface ConversionPreset {
    id: string;
    name: string;
    description: string;
    sourceCategory: MediaCategory[];
    targetFormat: string;
    /** FFmpeg output arguments appended after -i */
    outputArgs: string[];
}
export interface FormatConversionTask {
    id: string;
    sourcePath: string;
    sourceFormat: string;
    targetFormat: string;
    presetId?: string;
    intermediateFormat?: string;
    outputPath: string;
    outputArgs: string[];
    status: 'pending' | 'running' | 'success' | 'error';
    progress: number;
    error?: string;
}
export declare const IMAGE_FORMATS: string[];
export declare const VIDEO_FORMATS: string[];
export declare const AUDIO_FORMATS: string[];
export declare const IMAGE_SEQUENCE_FORMATS: string[];
export declare function detectMediaCategory(format: string): MediaCategory | undefined;
export declare function resolveConversionDirection(sourceCategory: MediaCategory, targetFormat: string): ConversionDirection | undefined;
export declare function resolveIntermediateFormat(sourceFormat: string, targetFormat: string): string | undefined;
/** Build the full conversion path, inserting intermediate format if needed. */
export declare function buildConversionPath(sourceFormat: string, targetFormat: string, availableCodecs?: CodecInfo[]): ConversionPath;
/** Build conversion matrix from available codecs. */
export declare function generateConversionMatrix(codecs: CodecInfo[]): Map<string, ConversionPath[]>;
export declare const BUILTIN_CONVERSION_PRESETS: ConversionPreset[];
/** Build a batch of conversion tasks from source files and a chosen preset. */
export declare function buildBatchConversionTasks(sourceFiles: Array<{
    path: string;
    format: string;
}>, preset: ConversionPreset, outputDir: string, idPrefix?: string): FormatConversionTask[];
export declare function normalizeConversionPreset(input: Partial<ConversionPreset> | undefined): ConversionPreset | undefined;
//# sourceMappingURL=format-converter.d.ts.map