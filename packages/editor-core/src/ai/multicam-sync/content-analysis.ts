/**
 * Content analysis and switch suggestion generation
 */

import type {
  AngleContentAnalysis,
  ContentAnalysis,
  ImageData,
  IntelligentSyncConfig,
  SwitchReason,
  SwitchSuggestion,
} from './types';

/**
 * Analyze content within a single time window
 */
export function analyzeWindowContent(
  angles: Array<{
    id: string;
    audioSamples?: Float32Array;
    audioSampleRate?: number;
    frame?: ImageData;
    prevFrame?: ImageData;
  }>,
  windowStart: number,
  windowEnd: number,
): ContentAnalysis {
  const angleAnalyses: AngleContentAnalysis[] = [];

  for (const angle of angles) {
    // Audio energy analysis
    let audioEnergy = 0;
    if (angle.audioSamples && angle.audioSampleRate) {
      const startIdx = Math.floor(windowStart * angle.audioSampleRate);
      const endIdx = Math.min(angle.audioSamples.length, Math.floor(windowEnd * angle.audioSampleRate));
      let sumSq = 0;
      let count = 0;
      for (let i = startIdx; i < endIdx; i++) {
        sumSq += angle.audioSamples[i] * angle.audioSamples[i];
        count++;
      }
      audioEnergy = count > 0 ? Math.sqrt(sumSq / count) : 0;
    }

    // Visual activity analysis
    let visualActivity = 0;
    let faceCount = 0;
    let sceneChangeScore = 0;

    if (angle.frame) {
      const { data, width, height } = angle.frame;

      // Simplified motion detection
      if (angle.prevFrame) {
        let motionSum = 0;
        let motionCount = 0;
        for (let i = 0; i < data.length; i += 16) {
          motionSum += Math.abs(data[i] - angle.prevFrame.data[i]);
          motionCount++;
        }
        visualActivity = motionCount > 0 ? Math.min(1, motionSum / motionCount / 64) : 0;
      }

      // Simplified face detection (skin-tone region based)
      faceCount = detectSimpleFaces(data, width, height);

      // Scene change (based on color histogram difference)
      if (angle.prevFrame) {
        sceneChangeScore = computeSceneChange(angle.prevFrame.data, data);
      }
    }

    // Overall score
    const overallScore = audioEnergy * 0.4 + visualActivity * 0.3 + (faceCount > 0 ? 0.2 : 0) + sceneChangeScore * 0.1;

    angleAnalyses.push({
      angleId: angle.id,
      audioEnergy,
      visualActivity,
      faceCount,
      sceneChangeScore,
      overallScore,
    });
  }

  // Select recommended angle
  const sorted = [...angleAnalyses].sort((a, b) => b.overallScore - a.overallScore);
  const recommended = sorted[0];
  if (!recommended) {
    return {
      windowStart,
      windowEnd,
      angles: angleAnalyses,
      recommendedAngleId: '',
      recommendationReason: 'content-variety',
    };
  }

  // Determine recommendation reason
  let reason: SwitchReason = 'content-variety';
  if (recommended.audioEnergy > 0.3) reason = 'active-speaker';
  else if (recommended.sceneChangeScore > 0.5) reason = 'scene-change';
  else if (recommended.visualActivity > 0.3) reason = 'motion-focus';
  else if (recommended.faceCount > 0) reason = 'composition';

  return {
    windowStart,
    windowEnd,
    angles: angleAnalyses,
    recommendedAngleId: recommended.angleId,
    recommendationReason: reason,
  };
}

/**
 * Simplified face detection (skin-tone region based)
 */
function detectSimpleFaces(data: Uint8ClampedArray, width: number, height: number): number {
  let skinPixels = 0;
  const totalPixels = width * height;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // YCbCr skin detection
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 128 - 0.169 * r - 0.331 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.419 * g - 0.081 * b;

    if (y > 80 && cb > 85 && cb < 135 && cr > 135 && cr < 180) {
      skinPixels++;
    }
  }

  const skinRatio = skinPixels / totalPixels;
  // Skin region > 5% may indicate a face
  return skinRatio > 0.05 ? Math.min(3, Math.floor(skinRatio * 20)) : 0;
}

/**
 * Compute scene change score
 */
function computeSceneChange(prevData: Uint8ClampedArray, currData: Uint8ClampedArray): number {
  let diffSum = 0;
  let count = 0;
  for (let i = 0; i < prevData.length; i += 16) {
    diffSum += Math.abs(prevData[i] - currData[i]);
    count++;
  }
  return count > 0 ? Math.min(1, diffSum / count / 128) : 0;
}

/**
 * Generate switch suggestion sequence.
 * Analyzes the entire video and generates optimal switch points.
 */
export function generateSwitchSuggestions(
  angles: Array<{
    id: string;
    audioSamples?: Float32Array;
    audioSampleRate?: number;
    frames?: ImageData[];
    fps: number;
  }>,
  duration: number,
  config: IntelligentSyncConfig,
): SwitchSuggestion[] {
  const suggestions: SwitchSuggestion[] = [];
  const windowSize = config.contentWindow;
  const windowCount = Math.ceil(duration / windowSize);
  let currentAngleId = angles[0]?.id ?? '';

  for (let w = 0; w < windowCount; w++) {
    const windowStart = w * windowSize;
    const windowEnd = Math.min(duration, windowStart + windowSize);

    // Prepare angle data
    const angleData = angles.map((angle) => {
      const frameIdx = Math.floor((windowStart + windowSize / 2) * angle.fps);
      const prevFrameIdx = Math.max(0, frameIdx - 1);
      return {
        id: angle.id,
        audioSamples: angle.audioSamples,
        audioSampleRate: angle.audioSampleRate,
        frame: angle.frames?.[frameIdx],
        prevFrame: angle.frames?.[prevFrameIdx],
      };
    });

    const analysis = analyzeWindowContent(angleData, windowStart, windowEnd);

    // If recommended angle differs from current and interval is sufficient
    if (analysis.recommendedAngleId !== currentAngleId) {
      const lastSuggestion = suggestions[suggestions.length - 1];
      const timeSinceLastSwitch = lastSuggestion ? windowStart - lastSuggestion.time : Infinity;

      if (timeSinceLastSwitch >= config.minSwitchInterval) {
        const recommended = analysis.angles.find((a) => a.angleId === analysis.recommendedAngleId);
        const confidence = recommended?.overallScore ?? 0.5;

        if (confidence >= config.confidenceThreshold) {
          suggestions.push({
            time: windowStart,
            targetAngleId: analysis.recommendedAngleId,
            currentAngleId,
            reason: analysis.recommendationReason,
            confidence,
            priority: Math.round(confidence * 10),
          });
          currentAngleId = analysis.recommendedAngleId;
        }
      }
    }
  }

  return suggestions;
}
