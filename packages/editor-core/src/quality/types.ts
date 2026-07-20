/**
 * Quality Inspector Types
 * Multi-dimensional quality detection framework for video/audio content
 */

/** Severity level for quality issues */
export type IssueSeverity = 'info' | 'warning' | 'error' | 'critical';

/** Category of quality issue */
export type IssueCategory = 'technical' | 'content' | 'compliance';

/** Technical defect types */
export type TechnicalDefectType =
  | 'black-frame'
  | 'color-bars'
  | 'audio-clipping'
  | 'static-frame'
  | 'resolution-mismatch'
  | 'frame-drop'
  | 'sync-drift'
  | 'corruption';

/** Content issue types */
export type ContentIssueType =
  | 'pacing-slow'
  | 'pacing-fast'
  | 'scene-discontinuity'
  | 'narrative-break'
  | 'repetitive-content'
  | 'low-engagement-potential';

/** Platform compliance targets */
export type PlatformTarget =
  | 'youtube-1080p'
  | 'youtube-4k'
  | 'tiktok-9-16'
  | 'instagram-reel'
  | 'twitter-video'
  | 'broadcast-pal'
  | 'broadcast-ntsc'
  | 'custom';

/** Time range in timeline */
export interface TimeRange {
  start: number;
  end: number;
}

/** Quality issue detected */
export interface QualityIssue {
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
  id: PlatformTarget;
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
  platform: PlatformTarget;
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
  issues: QualityIssue[];
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
  targetPlatform: PlatformTarget;
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
export const DEFAULT_INSPECTOR_CONFIG: InspectorConfig = {
  enableTechnicalDetection: true,
  enableContentAnalysis: true,
  enableComplianceCheck: true,
  targetPlatform: 'youtube-1080p',
  blackFrameThreshold: 0.05,
  staticFrameThreshold: 0.02,
  clippingThresholdDb: -1,
  silenceThresholdDb: -50,
  slowPacingRatio: 0.6,
  fastPacingRatio: 1.8,
  frameSampleInterval: 0.5,
  audioSampleInterval: 0.1,
};

/** Platform specifications */
export const PLATFORM_SPECS: Record<PlatformTarget, PlatformSpec> = {
  'youtube-1080p': {
    id: 'youtube-1080p',
    name: 'YouTube 1080p',
    width: 1920,
    height: 1080,
    aspectRatio: 16 / 9,
    maxDuration: 43200,
    frameRate: 30,
    audioSampleRate: 48000,
    audioChannels: 2,
    videoBitrate: 8000000,
  },
  'youtube-4k': {
    id: 'youtube-4k',
    name: 'YouTube 4K',
    width: 3840,
    height: 2160,
    aspectRatio: 16 / 9,
    maxDuration: 43200,
    frameRate: 30,
    audioSampleRate: 48000,
    audioChannels: 2,
    videoBitrate: 35000000,
  },
  'tiktok-9-16': {
    id: 'tiktok-9-16',
    name: 'TikTok 9:16',
    width: 1080,
    height: 1920,
    aspectRatio: 9 / 16,
    maxDuration: 600,
    minDuration: 3,
    frameRate: 30,
    audioSampleRate: 44100,
    audioChannels: 2,
    audioBitrate: 128000,
  },
  'instagram-reel': {
    id: 'instagram-reel',
    name: 'Instagram Reel',
    width: 1080,
    height: 1920,
    aspectRatio: 9 / 16,
    maxDuration: 90,
    minDuration: 3,
    frameRate: 30,
    audioSampleRate: 44100,
    audioChannels: 2,
  },
  'twitter-video': {
    id: 'twitter-video',
    name: 'Twitter Video',
    width: 1280,
    height: 720,
    aspectRatio: 16 / 9,
    maxDuration: 140,
    frameRate: 30,
    audioSampleRate: 44100,
    audioChannels: 2,
    videoBitrate: 5000000,
  },
  'broadcast-pal': {
    id: 'broadcast-pal',
    name: 'Broadcast PAL',
    width: 1920,
    height: 1080,
    aspectRatio: 16 / 9,
    maxDuration: Infinity,
    frameRate: 25,
    audioSampleRate: 48000,
    audioChannels: 2,
    audioBitrate: 384000,
  },
  'broadcast-ntsc': {
    id: 'broadcast-ntsc',
    name: 'Broadcast NTSC',
    width: 1920,
    height: 1080,
    aspectRatio: 16 / 9,
    maxDuration: Infinity,
    frameRate: 29.97,
    audioSampleRate: 48000,
    audioChannels: 2,
    audioBitrate: 384000,
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    width: 1920,
    height: 1080,
    aspectRatio: 16 / 9,
    maxDuration: Infinity,
    frameRate: 30,
    audioSampleRate: 48000,
    audioChannels: 2,
  },
};
