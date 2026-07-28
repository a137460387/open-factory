/**
 * Local Semantic Extractor
 *
 * Extracts structured metadata from local media assets (video/audio)
 * without uploading any raw data. All processing happens locally.
 *
 * Pipeline:
 * 1. Key frame extraction (video → thumbnail frames)
 * 2. Low-res preview generation (for optional LLM upload)
 * 3. ASR transcription (audio → text segments)
 * 4. Visual scene description (local model)
 * 5. Aggregate into structured MaterialMetadata JSON
 *
 * Privacy: Raw video/audio streams NEVER leave the device.
 * Only text metadata and compressed low-res previews are uploadable.
 */
/** Single key frame extracted from video */
export interface KeyFrame {
    /** Timestamp in seconds */
    timeSec: number;
    /** Frame index in source video */
    frameIndex: number;
    /** Scene label from local classification */
    sceneLabel?: string;
    /** Dominant colors (hex strings) */
    dominantColors?: string[];
    /** Brightness level 0-1 */
    brightness?: number;
    /** Whether face detected */
    hasFace?: boolean;
    /** Compressed low-res preview (base64 JPEG, max 160x90) */
    lowResPreview?: string;
    /** Preview dimensions */
    previewWidth?: number;
    previewHeight?: number;
}
/** ASR segment from local speech recognition */
export interface ASRSegment {
    /** Start time in seconds */
    startSec: number;
    /** End time in seconds */
    endSec: number;
    /** Recognized text */
    text: string;
    /** Confidence 0-1 */
    confidence: number;
    /** Detected speaker ID */
    speakerId?: number;
    /** Detected language */
    language?: string;
    /** Detected emotion */
    emotion?: string;
}
/** Audio characteristics */
export interface AudioProfile {
    /** Average loudness (LUFS) */
    avgLoudness: number;
    /** Peak loudness (dB) */
    peakDb: number;
    /** Silence ratio 0-1 */
    silenceRatio: number;
    /** Music detection */
    hasMusic: boolean;
    /** Speech ratio 0-1 */
    speechRatio: number;
    /** Detected background noise level */
    noiseLevel: 'quiet' | 'moderate' | 'noisy';
}
/** Visual analysis summary */
export interface VisualProfile {
    /** Overall motion intensity 0-1 */
    motionIntensity: number;
    /** Dominant color palette */
    colorPalette: string[];
    /** Average brightness 0-1 */
    avgBrightness: number;
    /** Scene type distribution */
    sceneDistribution: Record<string, number>;
    /** Face count */
    faceCount: number;
    /** Text/graphics overlay detected */
    hasOverlay: boolean;
}
/**
 * Complete material metadata JSON schema.
 * This is the structured output of the local semantic extractor.
 * It is safe to upload to LLM (no raw media data).
 */
export interface MaterialMetadata {
    /** Schema version */
    version: '1.0';
    /** Source file info */
    source: {
        fileName: string;
        durationSec: number;
        width: number;
        height: number;
        fps: number;
        codec: string;
        fileSizeBytes: number;
    };
    /** Extraction timestamp */
    extractedAt: string;
    /** Key frames with scene info */
    keyFrames: KeyFrame[];
    /** ASR transcript segments */
    asrSegments: ASRSegment[];
    /** Full transcript as single text */
    transcriptText: string;
    /** Audio profile */
    audioProfile: AudioProfile;
    /** Visual profile */
    visualProfile: VisualProfile;
    /** Auto-generated tags */
    tags: string[];
    /** Content summary (may be empty before LLM enrichment) */
    summary?: string;
}
/** Configuration for semantic extraction */
export interface ExtractionConfig {
    /** Max number of key frames to extract (default 20) */
    maxKeyFrames?: number;
    /** Key frame extraction interval in seconds (0 = auto) */
    intervalSec?: number;
    /** Low-res preview max width (default 160) */
    previewMaxWidth?: number;
    /** Low-res preview max height (default 90) */
    previewMaxHeight?: number;
    /** JPEG quality for preview compression (1-100, default 30) */
    previewQuality?: number;
    /** Enable ASR transcription (default true) */
    enableASR?: boolean;
    /** ASR language hint */
    asrLanguage?: string;
    /** Enable visual analysis (default true) */
    enableVisualAnalysis?: boolean;
    /** Scene change detection threshold 0-1 (default 0.3) */
    sceneChangeThreshold?: number;
}
/** Extraction progress event */
export interface ExtractionProgressEvent {
    phase: 'keyframes' | 'preview' | 'asr' | 'visual' | 'aggregation';
    progress: number;
    message?: string;
}
export declare function createDefaultExtractionConfig(): Required<ExtractionConfig>;
export interface ExtractionValidationError {
    field: string;
    message: string;
}
export declare function validateExtractionConfig(config: ExtractionConfig): ExtractionValidationError[];
/**
 * Calculate optimal key frame timestamps based on video duration.
 * Uses scene-change-aware interval selection.
 */
export declare function calculateKeyFrameTimestamps(durationSec: number, config: Pick<Required<ExtractionConfig>, 'maxKeyFrames' | 'intervalSec'>): number[];
/**
 * Calculate preview dimensions maintaining aspect ratio.
 * Returns dimensions that fit within maxWidth x maxHeight.
 */
export declare function calculatePreviewDimensions(srcWidth: number, srcHeight: number, maxWidth: number, maxHeight: number): {
    width: number;
    height: number;
};
/**
 * Merge ASR segments that are close together.
 * Segments within mergeGapSec of each other are combined.
 */
export declare function mergeASRSegments(segments: ASRSegment[], mergeGapSec: number, maxDurationSec: number): ASRSegment[];
/**
 * Detect language from ASR text using character range heuristics.
 */
export declare function detectLanguageFromASR(text: string): string;
/**
 * Generate auto-tags from material metadata.
 * Extracts semantic tags from visual and audio analysis.
 */
export declare function generateAutoTags(visualProfile: VisualProfile, audioProfile: AudioProfile, asrSegments: ASRSegment[]): string[];
/**
 * Generate a text summary from ASR segments.
 * Concatenates all transcript text.
 */
export declare function buildTranscriptText(segments: ASRSegment[]): string;
/**
 * Estimate the upload size of material metadata in bytes.
 * Only counts text and optional low-res previews.
 */
export declare function estimateMetadataUploadSize(metadata: MaterialMetadata): number;
export interface ExtractionResult {
    metadata: MaterialMetadata;
    warnings: string[];
}
/**
 * Build MaterialMetadata from extracted components.
 * This is the aggregation step that combines all local analysis results.
 */
export declare function aggregateMetadata(source: MaterialMetadata['source'], keyFrames: KeyFrame[], asrSegments: ASRSegment[], audioProfile: AudioProfile, visualProfile: VisualProfile, config: Required<ExtractionConfig>): ExtractionResult;
/**
 * Privacy check: validate that metadata contains no raw media data.
 * Returns true if safe to upload.
 */
export declare function validateMetadataPrivacy(metadata: MaterialMetadata): {
    safe: boolean;
    violations: string[];
};
//# sourceMappingURL=semantic-extractor.d.ts.map