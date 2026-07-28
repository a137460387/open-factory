/**
 * Quality Inspector Types
 * Multi-dimensional quality detection framework for video/audio content
 */
/** Severity level for quality issues */
export type IssueSeverity = 'info' | 'warning' | 'error' | 'critical';
/** Category of quality issue */
export type IssueCategory = 'technical' | 'content' | 'compliance';
/** Technical defect types */
export type TechnicalDefectType = 'black-frame' | 'color-bars' | 'audio-clipping' | 'static-frame' | 'resolution-mismatch' | 'frame-drop' | 'sync-drift' | 'corruption';
/** Content issue types */
export type ContentIssueType = 'pacing-slow' | 'pacing-fast' | 'scene-discontinuity' | 'narrative-break' | 'repetitive-content' | 'low-engagement-potential';
/** Platform compliance targets */
export type QualityPlatformTarget = 'youtube-1080p' | 'youtube-4k' | 'tiktok-9-16' | 'instagram-reel' | 'twitter-video' | 'broadcast-pal' | 'broadcast-ntsc' | 'custom';
/** Time range in timeline */
export interface TimeRange {
    start: number;
    end: number;
}
/** Quality issue detected */
export interface InspectorQualityIssue {
    id: string;
    category: IssueCategory;
    type: TechnicalDefectType | ContentIssueType | string;
    severity: IssueSeverity;
    timeRange?: TimeRange;
    trackId?: string;
    clipId?: string;
    description: string;
    suggestion: string;
    autoFixable: boolean;
}
/** Platform compliance specification */
export interface PlatformSpec {
    id: QualityPlatformTarget;
    name: string;
    width: number;
    height: number;
    aspectRatio: number;
    maxDuration: number;
    minDuration?: number;
    maxFileSize?: number;
    frameRate: number;
    audioSampleRate: number;
    audioChannels: number;
    audioBitrate?: number;
    videoBitrate?: number;
    codec?: string;
}
/** Frame analysis result */
export interface FrameAnalysis {
    timestamp: number;
    isBlack: boolean;
    isStatic: boolean;
    isColorBars: boolean;
    brightness: number;
    contrast: number;
    motionScore: number;
}
/** Audio analysis result */
export interface AudioAnalysis {
    timestamp: number;
    rmsDb: number;
    peakDb: number;
    isClipping: boolean;
    isSilent: boolean;
    isDistorted: boolean;
    spectralCentroid: number;
}
/** Pacing analysis segment */
export interface PacingSegment {
    timeRange: TimeRange;
    cutsPerMinute: number;
    classification: 'slow' | 'normal' | 'fast';
}
/** Scene transition analysis */
export interface SceneTransition {
    time: number;
    type: 'cut' | 'fade' | 'dissolve' | 'wipe' | 'other';
    confidence: number;
    isDiscontinuous: boolean;
}
/** Compliance check result */
export interface ComplianceResult {
    platform: QualityPlatformTarget;
    passed: boolean;
    violations: ComplianceViolation[];
}
/** Compliance violation */
export interface ComplianceViolation {
    parameter: string;
    expected: string | number;
    actual: string | number;
    severity: IssueSeverity;
}
/** Quality inspection report */
export interface QualityReport {
    id: string;
    timestamp: number;
    duration: number;
    overallScore: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    issues: InspectorQualityIssue[];
    frameAnalyses: FrameAnalysis[];
    audioAnalyses: AudioAnalysis[];
    pacingSegments: PacingSegment[];
    sceneTransitions: SceneTransition[];
    complianceResults: ComplianceResult[];
    summary: QualitySummary;
}
/** Quality summary statistics */
export interface QualitySummary {
    totalIssues: number;
    criticalIssues: number;
    errorIssues: number;
    warningIssues: number;
    infoIssues: number;
    technicalScore: number;
    contentScore: number;
    complianceScore: number;
    autoFixableCount: number;
}
/** Inspector configuration */
export interface InspectorConfig {
    /** Enable technical defect detection */
    enableTechnicalDetection: boolean;
    /** Enable content analysis */
    enableContentAnalysis: boolean;
    /** Enable compliance checking */
    enableComplianceCheck: boolean;
    /** Target platform for compliance */
    targetPlatform: QualityPlatformTarget;
    /** Custom platform spec (when targetPlatform is 'custom') */
    customPlatformSpec?: Partial<PlatformSpec>;
    /** Black frame threshold (0-1) */
    blackFrameThreshold: number;
    /** Static frame threshold (motion score) */
    staticFrameThreshold: number;
    /** Audio clipping threshold (dB) */
    clippingThresholdDb: number;
    /** Audio silence threshold (dB) */
    silenceThresholdDb: number;
    /** Slow pacing threshold (CPM ratio) */
    slowPacingRatio: number;
    /** Fast pacing threshold (CPM ratio) */
    fastPacingRatio: number;
    /** Sampling interval for frame analysis (seconds) */
    frameSampleInterval: number;
    /** Sampling interval for audio analysis (seconds) */
    audioSampleInterval: number;
}
/** Default inspector configuration */
export declare const DEFAULT_INSPECTOR_CONFIG: InspectorConfig;
/** Platform specifications */
export declare const PLATFORM_SPECS: Record<QualityPlatformTarget, PlatformSpec>;
//# sourceMappingURL=types.d.ts.map