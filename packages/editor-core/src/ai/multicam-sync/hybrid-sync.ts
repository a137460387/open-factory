/**
 * Hybrid sync: combines audio fingerprint and visual feature sync
 */

import type {
  AudioFingerprint,
  DriftInfo,
  IntelligentSyncConfig,
  IntelligentSyncResult,
  SyncQuality,
  VisualFeature,
} from './types';
import { syncByAudioFingerprint } from './audio-fingerprint';
import { syncByVisualFeature } from './visual-sync';

/**
 * Hybrid sync: combines audio fingerprint and visual features
 */
export function intelligentSync(
  angles: Array<{
    id: string;
    audioFingerprint?: AudioFingerprint;
    visualFeatures?: VisualFeature[];
    fps: number;
  }>,
  config: IntelligentSyncConfig,
): IntelligentSyncResult {
  const startTime = performance.now();
  const offsets = new Map<string, number>();
  const angleQualities = new Map<string, SyncQuality>();

  if (angles.length === 0) {
    return {
      offsets,
      confidence: 0,
      usedMethod: config.method,
      angleQualities,
      drift: { detected: false, rateMsPerMin: 0, direction: 'none' },
      processingTimeMs: performance.now() - startTime,
    };
  }

  // Reference angle (first one)
  const reference = angles[0];
  offsets.set(reference.id, 0);

  if (angles.length === 1) {
    angleQualities.set(reference.id, {
      level: 'excellent',
      offsetErrorMs: 0,
      confidence: 1,
    });
    return {
      offsets,
      confidence: 1,
      usedMethod: config.method,
      angleQualities,
      drift: { detected: false, rateMsPerMin: 0, direction: 'none' },
      processingTimeMs: performance.now() - startTime,
    };
  }

  let totalConfidence = 1; // reference angle confidence is 1

  for (let i = 1; i < angles.length; i++) {
    const candidate = angles[i];
    let offset = 0;
    let confidence = 0;

    if (config.method === 'audio-fingerprint' || config.method === 'hybrid') {
      if (reference.audioFingerprint && candidate.audioFingerprint) {
        const audioResult = syncByAudioFingerprint(reference.audioFingerprint, candidate.audioFingerprint);
        if (config.method === 'audio-fingerprint') {
          offset = audioResult.offset;
          confidence = audioResult.confidence;
        } else {
          // Hybrid: store audio offset
          offset = audioResult.offset * config.audioWeight;
          confidence = audioResult.confidence * config.audioWeight;
        }
      }
    }

    if (config.method === 'visual-feature' || config.method === 'hybrid') {
      if (reference.visualFeatures && candidate.visualFeatures) {
        const visualResult = syncByVisualFeature(reference.visualFeatures, candidate.visualFeatures, candidate.fps);
        if (config.method === 'visual-feature') {
          offset = visualResult.offset;
          confidence = visualResult.confidence;
        } else {
          // Hybrid: weighted merge
          offset += visualResult.offset * config.visualWeight;
          confidence += visualResult.confidence * config.visualWeight;
        }
      }
    }

    // Clamp to max offset
    offset = Math.max(-config.maxOffset, Math.min(config.maxOffset, offset));

    offsets.set(candidate.id, offset);
    totalConfidence += confidence;

    // Compute sync quality
    const offsetMs = Math.abs(offset * 1000);
    let level: SyncQuality['level'];
    if (offsetMs < 10) level = 'excellent';
    else if (offsetMs < 30) level = 'good';
    else if (offsetMs < 100) level = 'fair';
    else level = 'poor';

    angleQualities.set(candidate.id, {
      level,
      offsetErrorMs: offsetMs,
      confidence,
    });
  }

  const avgConfidence = totalConfidence / angles.length;

  // Drift detection
  const drift = config.enableDriftDetection
    ? detectDriftFromOffsets(angles, offsets)
    : { detected: false, rateMsPerMin: 0, direction: 'none' as const };

  return {
    offsets,
    confidence: avgConfidence,
    usedMethod: config.method,
    angleQualities,
    drift,
    processingTimeMs: performance.now() - startTime,
  };
}

/**
 * Detect drift from offset values
 */
function detectDriftFromOffsets(angles: Array<{ id: string }>, offsets: Map<string, number>): DriftInfo {
  if (angles.length < 2) {
    return { detected: false, rateMsPerMin: 0, direction: 'none' };
  }

  // Simplified: use offsets as drift indicator
  const offsetValues = Array.from(offsets.values());
  const maxOffset = Math.max(...offsetValues.map(Math.abs));

  // If offset exceeds 50ms/min threshold, consider drift detected
  const driftThreshold = 0.05; // 50ms
  const detected = maxOffset > driftThreshold;

  return {
    detected,
    rateMsPerMin: detected ? maxOffset * 1000 : 0,
    direction: detected ? (offsetValues[1] > 0 ? 'ahead' : 'behind') : 'none',
    predictedOffset: detected ? maxOffset * 1.1 : undefined,
  };
}
