/**
 * Type definitions for multicam sync module
 */

/**
 * Image data (RGBA flat array)
 */
export interface ImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Audio fingerprint features
 */
export interface AudioFingerprint {
  /** Angle ID */
  angleId: string;
  /** Fingerprint hash sequence (one hash per second) */
  hashes: Uint32Array;
  /** Fingerprint sample rate (hashes per second) */
  hashRate: number;
  /** Audio duration (seconds) */
  duration: number;
  /** Energy envelope */
  energyEnvelope: Float32Array;
}

/**
 * Visual features
 */
export interface VisualFeature {
  /** Angle ID */
  angleId: string;
  /** Frame index */
  frameIndex: number;
  /** Timestamp (seconds) */
  timestamp: number;
  /** Color histogram (RGB 16 bins each) */
  colorHistogram: Float32Array;
  /** Edge orientation histogram */
  edgeHistogram: Float32Array;
  /** Motion magnitude (0-1) */
  motionScore: number;
  /** Brightness (0-1) */
  brightness: number;
  /** Scene complexity (0-1) */
  complexity: number;
}

/**
 * Sync method
 */
export type SyncMethod = 'audio-fingerprint' | 'visual-feature' | 'hybrid' | 'timecode' | 'manual';

/**
 * Sync configuration
 */
export interface IntelligentSyncConfig {
  /** Sync method */
  method: SyncMethod;
  /** Audio fingerprint weight (hybrid mode) */
  audioWeight: number;
  /** Visual feature weight (hybrid mode) */
  visualWeight: number;
  /** Maximum allowed offset (seconds) */
  maxOffset: number;
  /** Confidence threshold (0-1) */
  confidenceThreshold: number;
  /** Enable drift detection */
  enableDriftDetection: boolean;
  /** Drift detection window (seconds) */
  driftWindow: number;
  /** Content analysis window (seconds) */
  contentWindow: number;
  /** Minimum switch interval (seconds) */
  minSwitchInterval: number;
}

/**
 * Sync result
 */
export interface IntelligentSyncResult {
  /** Offset per angle (seconds), relative to reference angle */
  offsets: Map<string, number>;
  /** Sync confidence (0-1) */
  confidence: number;
  /** Sync method used */
  usedMethod: SyncMethod;
  /** Sync quality per angle */
  angleQualities: Map<string, SyncQuality>;
  /** Drift information */
  drift: DriftInfo;
  /** Processing time (ms) */
  processingTimeMs: number;
}

/**
 * Sync quality
 */
export interface SyncQuality {
  /** Quality level */
  level: 'excellent' | 'good' | 'fair' | 'poor';
  /** Offset error (ms) */
  offsetErrorMs: number;
  /** Confidence (0-1) */
  confidence: number;
}

/**
 * Drift information
 */
export interface DriftInfo {
  /** Whether drift was detected */
  detected: boolean;
  /** Drift rate (ms/min) */
  rateMsPerMin: number;
  /** Drift direction */
  direction: 'ahead' | 'behind' | 'none';
  /** Predicted future offset (seconds) */
  predictedOffset?: number;
}

/**
 * Switch suggestion
 */
export interface SwitchSuggestion {
  /** Switch time (seconds) */
  time: number;
  /** Target angle ID */
  targetAngleId: string;
  /** Current angle ID */
  currentAngleId: string;
  /** Switch reason */
  reason: SwitchReason;
  /** Confidence (0-1) */
  confidence: number;
  /** Priority (1-10) */
  priority: number;
}

/**
 * Switch reason
 */
export type SwitchReason =
  | 'active-speaker'
  | 'scene-change'
  | 'motion-focus'
  | 'composition'
  | 'energy-peak'
  | 'content-variety'
  | 'manual-trigger';

/**
 * Content analysis result
 */
export interface ContentAnalysis {
  /** Window start (seconds) */
  windowStart: number;
  /** Window end (seconds) */
  windowEnd: number;
  /** Per-angle analysis */
  angles: AngleContentAnalysis[];
  /** Recommended active angle */
  recommendedAngleId: string;
  /** Recommendation reason */
  recommendationReason: SwitchReason;
}

/**
 * Single angle content analysis
 */
export interface AngleContentAnalysis {
  /** Angle ID */
  angleId: string;
  /** Audio energy (0-1) */
  audioEnergy: number;
  /** Visual activity (0-1) */
  visualActivity: number;
  /** Face count */
  faceCount: number;
  /** Scene change score (0-1) */
  sceneChangeScore: number;
  /** Overall score (0-1) */
  overallScore: number;
}

/**
 * Integration interface for v4.37.0 multicam system
 */
export interface MulticamSyncIntegration {
  /** Angle offset mapping */
  offsets: Record<string, number>;
  /** Switch point list */
  switchPoints: Array<{
    time: number;
    angleId: string;
    transition: 'cut' | 'dissolve';
  }>;
  /** Sync quality summary */
  qualitySummary: {
    overall: SyncQuality['level'];
    details: Array<{
      angleId: string;
      quality: SyncQuality;
    }>;
  };
}
