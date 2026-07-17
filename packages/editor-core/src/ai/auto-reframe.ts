/**
 * AI auto-reframe module with subject tracking and dynamic cropping.
 *
 * Intelligently tracks subjects in video frames and generates smooth
 * crop keyframes to adapt content for different target aspect ratios.
 * All functions are pure computation with no side effects.
 */

import type { TargetAspectRatio } from '../reframe';
import { getTargetAspectRatioValue } from '../reframe';

// --- Types ---

/** Bounding box for a detected subject or face. */
export interface SubjectBoundingBox {
  /** Left edge (0.0 ~ 1.0, normalized). */
  x: number;
  /** Top edge (0.0 ~ 1.0, normalized). */
  y: number;
  /** Width (0.0 ~ 1.0, normalized). */
  w: number;
  /** Height (0.0 ~ 1.0, normalized). */
  h: number;
}

/** A subject detected in a frame. */
export interface DetectedSubject {
  /** Unique subject ID for tracking across frames. */
  id: string;
  /** Bounding box (normalized coordinates). */
  bbox: SubjectBoundingBox;
  /** Detection confidence (0.0 ~ 1.0). */
  confidence: number;
  /** Subject type. */
  type: 'face' | 'person' | 'object' | 'text';
  /** Importance weight (0.0 ~ 1.0). Faces are typically highest. */
  importance: number;
}

/** A frame with detected subjects. */
export interface SubjectFrame {
  /** Timestamp in seconds. */
  time: number;
  /** Source video width in pixels. */
  sourceWidth: number;
  /** Source video height in pixels. */
  sourceHeight: number;
  /** Detected subjects in this frame. */
  subjects: DetectedSubject[];
}

/** A crop keyframe for the reframed output. */
export interface AutoReframeKeyframe {
  /** Time in seconds. */
  time: number;
  /** Crop X offset in pixels. */
  cropX: number;
  /** Crop Y offset in pixels. */
  cropY: number;
  /** Crop width in pixels. */
  cropW: number;
  /** Crop height in pixels. */
  cropH: number;
  /** Tracking confidence (0.0 ~ 1.0). */
  confidence: number;
  /** Primary subject ID being tracked. */
  primarySubjectId?: string;
}

/** Configuration for auto-reframe. */
export interface AutoReframeOptions {
  /** Target aspect ratio. */
  targetAspect: TargetAspectRatio;
  /** Padding around subject as fraction of crop (default 0.1). */
  padding?: number;
  /** Smoothing window size (default 5). */
  smoothingWindow?: number;
  /** Maximum crop speed in pixels/second (default 200). */
  maxCropSpeed?: number;
  /** Minimum crop width in pixels (default 320). */
  minCropWidth?: number;
  /** Minimum crop height in pixels (default 180). */
  minCropHeight?: number;
  /** Prefer faces over other subjects (default true). */
  preferFaces?: boolean;
  /** Subject importance threshold (default 0.3). */
  importanceThreshold?: number;
}

/** Result of auto-reframe analysis. */
export interface AutoReframeResult {
  /** Generated crop keyframes. */
  keyframes: AutoReframeKeyframe[];
  /** Primary subject tracking info. */
  trackingInfo: {
    /** ID of the primary subject. */
    primarySubjectId: string | null;
    /** Number of frames where subject was tracked. */
    trackedFrames: number;
    /** Total frames processed. */
    totalFrames: number;
    /** Tracking continuity score (0.0 ~ 1.0). */
    continuity: number;
  };
  /** Overall confidence (0.0 ~ 1.0). */
  confidence: number;
  /** FFmpeg crop filter expression. */
  ffmpegExpression?: string;
}

/** Subject tracking state. */
interface TrackingState {
  subjectId: string;
  lastPosition: SubjectBoundingBox;
  lastTime: number;
  framesTracked: number;
  totalConfidence: number;
}

// --- Core functions ---

/**
 * Generate auto-reframe keyframes from subject detection data.
 *
 * @param frames - Frames with detected subjects.
 * @param options - Reframe configuration.
 * @returns Reframe result with keyframes and tracking info.
 */
export function generateAutoReframe(
  frames: SubjectFrame[],
  options: AutoReframeOptions,
): AutoReframeResult {
  const {
    targetAspect,
    padding = 0.1,
    smoothingWindow = 5,
    maxCropSpeed = 200,
    minCropWidth = 320,
    minCropHeight = 180,
    preferFaces = true,
    importanceThreshold = 0.3,
  } = options;

  if (frames.length === 0) {
    return emptyResult();
  }

  const sorted = [...frames]
    .filter((f) => Number.isFinite(f.time))
    .sort((a, b) => a.time - b.time);

  // Normalize target aspect.
  if (targetAspect === 'source') {
    // No reframe needed for source aspect.
    return {
      keyframes: [],
      trackingInfo: {
        primarySubjectId: null,
        trackedFrames: 0,
        totalFrames: sorted.length,
        continuity: 1.0,
      },
      confidence: 1.0,
    };
  }

  const ratio = getTargetAspectRatioValue(targetAspect);

  // Step 1: Track primary subject across frames.
  const { primaryId, trackingStates } = trackPrimarySubject(sorted, preferFaces, importanceThreshold);

  // Step 2: Generate raw crop windows for each frame.
  const rawKeyframes: AutoReframeKeyframe[] = [];

  for (const frame of sorted) {
    const subject = selectSubjectForFrame(frame, primaryId, preferFaces, importanceThreshold);
    if (!subject) {
      // No subject found - use center crop.
      const crop = computeCenterCrop(frame.sourceWidth, frame.sourceHeight, ratio);
      rawKeyframes.push({
        time: frame.time,
        ...crop,
        confidence: 0.3,
      });
      continue;
    }

    const crop = subjectToCropWindow(
      subject.bbox,
      frame.sourceWidth,
      frame.sourceHeight,
      ratio,
      padding,
      minCropWidth,
      minCropHeight,
    );

    rawKeyframes.push({
      time: frame.time,
      cropX: crop.cropX,
      cropY: crop.cropY,
      cropW: crop.cropW,
      cropH: crop.cropH,
      confidence: subject.confidence,
      primarySubjectId: subject.id,
    });
  }

  // Step 3: Smooth keyframes.
  const smoothed = smoothAutoReframeKeyframes(rawKeyframes, smoothingWindow);

  // Step 4: Limit crop speed.
  const speedLimited = limitCropSpeed(smoothed, maxCropSpeed);

  // Step 5: Ensure even dimensions.
  const final = speedLimited.map((kf) => ({
    ...kf,
    cropX: Math.max(0, Math.round(kf.cropX)),
    cropY: Math.max(0, Math.round(kf.cropY)),
    cropW: makeEven(Math.max(minCropWidth, kf.cropW)),
    cropH: makeEven(Math.max(minCropHeight, kf.cropH)),
  }));

  // Compute tracking info.
  const tracking = trackingStates.get(primaryId ?? '');
  const trackedFrames = tracking?.framesTracked ?? 0;
  const continuity = sorted.length > 0 ? trackedFrames / sorted.length : 0;

  // Build FFmpeg expression.
  const ffmpegExpr = buildAutoReframeFFmpegExpression(final);

  return {
    keyframes: final,
    trackingInfo: {
      primarySubjectId: primaryId,
      trackedFrames,
      totalFrames: sorted.length,
      continuity: round(continuity),
    },
    confidence: round(average(final.map((kf) => kf.confidence))),
    ffmpegExpression: ffmpegExpr,
  };
}

/**
 * Interpolate a crop window at an arbitrary time from keyframes.
 *
 * @param keyframes - Sorted keyframes.
 * @param time - Target time in seconds.
 * @returns Interpolated crop window, or undefined if no keyframes.
 */
export function interpolateAutoReframeAtTime(
  keyframes: AutoReframeKeyframe[],
  time: number,
): AutoReframeKeyframe | undefined {
  if (keyframes.length === 0) {
    return undefined;
  }
  if (keyframes.length === 1) {
    return { ...keyframes[0] };
  }

  if (time <= keyframes[0].time) {
    return { ...keyframes[0] };
  }
  if (time >= keyframes[keyframes.length - 1].time) {
    return { ...keyframes[keyframes.length - 1] };
  }

  // Binary search for surrounding keyframes.
  let left = 0;
  let right = keyframes.length - 2;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (keyframes[mid + 1].time < time) {
      left = mid + 1;
    } else if (keyframes[mid].time > time) {
      right = mid - 1;
    } else {
      const a = keyframes[mid];
      const b = keyframes[mid + 1];
      const span = b.time - a.time;
      const t = span > 0 ? (time - a.time) / span : 0;

      return {
        time,
        cropX: round(a.cropX + (b.cropX - a.cropX) * t),
        cropY: round(a.cropY + (b.cropY - a.cropY) * t),
        cropW: Math.round(a.cropW + (b.cropW - a.cropW) * t),
        cropH: Math.round(a.cropH + (b.cropH - a.cropH) * t),
        confidence: round(a.confidence + (b.confidence - a.confidence) * t),
        primarySubjectId: t < 0.5 ? a.primarySubjectId : b.primarySubjectId,
      };
    }
  }

  return { ...keyframes[0] };
}

/**
 * Compute multiple aspect ratio crops for the same frame data.
 * Useful for batch export to different platforms.
 *
 * @param frames - Subject frames.
 * @param aspects - Target aspect ratios.
 * @param options - Common options (excluding targetAspect).
 * @returns Map of aspect ratio to reframe result.
 */
export function multiAspectReframe(
  frames: SubjectFrame[],
  aspects: TargetAspectRatio[],
  options: Omit<AutoReframeOptions, 'targetAspect'>,
): Map<TargetAspectRatio, AutoReframeResult> {
  const results = new Map<TargetAspectRatio, AutoReframeResult>();

  for (const aspect of aspects) {
    results.set(aspect, generateAutoReframe(frames, { ...options, targetAspect: aspect }));
  }

  return results;
}

/**
 * Validate that crop windows stay within source bounds.
 *
 * @param keyframes - Keyframes to validate.
 * @param sourceWidth - Source video width.
 * @param sourceHeight - Source video height.
 * @returns Validation issues.
 */
export function validateReframeKeyframes(
  keyframes: AutoReframeKeyframe[],
  sourceWidth: number,
  sourceHeight: number,
): Array<{ index: number; issue: string }> {
  const issues: Array<{ index: number; issue: string }> = [];

  for (let i = 0; i < keyframes.length; i++) {
    const kf = keyframes[i];

    if (kf.cropX < 0) {
      issues.push({ index: i, issue: `cropX (${kf.cropX}) is negative` });
    }
    if (kf.cropY < 0) {
      issues.push({ index: i, issue: `cropY (${kf.cropY}) is negative` });
    }
    if (kf.cropX + kf.cropW > sourceWidth) {
      issues.push({ index: i, issue: `crop extends beyond source width (${kf.cropX}+${kf.cropW} > ${sourceWidth})` });
    }
    if (kf.cropY + kf.cropH > sourceHeight) {
      issues.push({ index: i, issue: `crop extends beyond source height (${kf.cropY}+${kf.cropH} > ${sourceHeight})` });
    }
    if (kf.cropW % 2 !== 0) {
      issues.push({ index: i, issue: `cropW (${kf.cropW}) is not even` });
    }
    if (kf.cropH % 2 !== 0) {
      issues.push({ index: i, issue: `cropH (${kf.cropH}) is not even` });
    }
  }

  return issues;
}

// --- Internal helpers ---

function trackPrimarySubject(
  frames: SubjectFrame[],
  preferFaces: boolean,
  importanceThreshold: number,
): { primaryId: string | null; trackingStates: Map<string, TrackingState> } {
  const trackingStates = new Map<string, TrackingState>();
  let bestSubjectId: string | null = null;
  let bestScore = 0;

  for (const frame of frames) {
    for (const subject of frame.subjects) {
      if (subject.importance < importanceThreshold) {
        continue;
      }

      let state = trackingStates.get(subject.id);
      if (!state) {
        state = {
          subjectId: subject.id,
          lastPosition: subject.bbox,
          lastTime: frame.time,
          framesTracked: 0,
          totalConfidence: 0,
        };
        trackingStates.set(subject.id, state);
      }

      state.framesTracked++;
      state.totalConfidence += subject.confidence;
      state.lastPosition = subject.bbox;
      state.lastTime = frame.time;
    }
  }

  // Find the best subject by tracking duration and confidence.
  for (const [id, state] of trackingStates) {
    const avgConfidence = state.totalConfidence / state.framesTracked;
    const durationScore = state.framesTracked / frames.length;
    // Prefer faces by boosting their score.
    const subject = frames
      .flatMap((f) => f.subjects)
      .find((s) => s.id === id);
    const faceBonus = preferFaces && subject?.type === 'face' ? 0.2 : 0;
    const score = durationScore * 0.5 + avgConfidence * 0.3 + faceBonus + subject!.importance * 0.2;

    if (score > bestScore) {
      bestScore = score;
      bestSubjectId = id;
    }
  }

  return { primaryId: bestSubjectId, trackingStates };
}

function selectSubjectForFrame(
  frame: SubjectFrame,
  primaryId: string | null,
  preferFaces: boolean,
  importanceThreshold: number,
): DetectedSubject | null {
  const eligible = frame.subjects.filter((s) => s.importance >= importanceThreshold);
  if (eligible.length === 0) {
    return null;
  }

  // Prefer the tracked primary subject.
  if (primaryId) {
    const primary = eligible.find((s) => s.id === primaryId);
    if (primary) {
      return primary;
    }
  }

  // Fallback: prefer faces, then highest importance.
  if (preferFaces) {
    const face = eligible.find((s) => s.type === 'face');
    if (face) {
      return face;
    }
  }

  return eligible.reduce((best, s) => (s.importance > best.importance ? s : best));
}

function subjectToCropWindow(
  bbox: SubjectBoundingBox,
  sourceWidth: number,
  sourceHeight: number,
  ratio: number,
  padding: number,
  minCropWidth: number,
  minCropHeight: number,
): { cropX: number; cropY: number; cropW: number; cropH: number } {
  const safeWidth = Math.max(1, sourceWidth);
  const safeHeight = Math.max(1, sourceHeight);

  // Compute crop dimensions for target aspect ratio.
  let cropW: number;
  let cropH: number;

  if (ratio >= 1) {
    cropW = safeWidth;
    cropH = Math.round(safeWidth / ratio);
    if (cropH > safeHeight) {
      cropH = safeHeight;
      cropW = Math.round(safeHeight * ratio);
    }
  } else {
    cropH = safeHeight;
    cropW = Math.round(safeHeight * ratio);
    if (cropW > safeWidth) {
      cropW = safeWidth;
      cropH = Math.round(safeWidth / ratio);
    }
  }

  cropW = Math.max(minCropWidth, makeEven(Math.min(cropW, safeWidth)));
  cropH = Math.max(minCropHeight, makeEven(Math.min(cropH, safeHeight)));

  // Center crop on subject.
  const subjectCenterX = (bbox.x + bbox.w / 2) * safeWidth;
  const subjectCenterY = (bbox.y + bbox.h / 2) * safeHeight;

  // Apply padding offset.
  const paddedCropW = cropW * (1 + padding);
  const paddedCropH = cropH * (1 + padding);

  let cropX = Math.round(subjectCenterX - cropW / 2);
  let cropY = Math.round(subjectCenterY - cropH / 2);

  // Clamp to bounds.
  cropX = Math.max(0, Math.min(cropX, safeWidth - cropW));
  cropY = Math.max(0, Math.min(cropY, safeHeight - cropH));

  return { cropX, cropY, cropW, cropH };
}

function computeCenterCrop(
  sourceWidth: number,
  sourceHeight: number,
  ratio: number,
): { cropX: number; cropY: number; cropW: number; cropH: number } {
  const safeWidth = Math.max(1, sourceWidth);
  const safeHeight = Math.max(1, sourceHeight);

  let cropW: number;
  let cropH: number;

  if (ratio >= 1) {
    cropW = safeWidth;
    cropH = Math.round(safeWidth / ratio);
    if (cropH > safeHeight) {
      cropH = safeHeight;
      cropW = Math.round(safeHeight * ratio);
    }
  } else {
    cropH = safeHeight;
    cropW = Math.round(safeHeight * ratio);
    if (cropW > safeWidth) {
      cropW = safeWidth;
      cropH = Math.round(safeWidth / ratio);
    }
  }

  cropW = makeEven(Math.min(cropW, safeWidth));
  cropH = makeEven(Math.min(cropH, safeHeight));

  return {
    cropX: Math.round((safeWidth - cropW) / 2),
    cropY: Math.round((safeHeight - cropH) / 2),
    cropW,
    cropH,
  };
}

function smoothAutoReframeKeyframes(
  keyframes: AutoReframeKeyframe[],
  windowSize: number,
): AutoReframeKeyframe[] {
  if (keyframes.length <= 1 || windowSize <= 1) {
    return keyframes.map((kf) => ({ ...kf }));
  }

  const half = Math.floor(windowSize / 2);
  return keyframes.map((kf, index) => {
    const start = Math.max(0, index - half);
    const end = Math.min(keyframes.length, index + half + 1);
    let sumX = 0;
    let sumY = 0;
    let sumConf = 0;
    let count = 0;

    for (let i = start; i < end; i++) {
      sumX += keyframes[i].cropX;
      sumY += keyframes[i].cropY;
      sumConf += keyframes[i].confidence;
      count++;
    }

    return {
      time: kf.time,
      cropX: round(sumX / count),
      cropY: round(sumY / count),
      cropW: kf.cropW,
      cropH: kf.cropH,
      confidence: round(sumConf / count),
      primarySubjectId: kf.primarySubjectId,
    };
  });
}

function limitCropSpeed(
  keyframes: AutoReframeKeyframe[],
  maxSpeed: number,
): AutoReframeKeyframe[] {
  if (keyframes.length <= 1) {
    return keyframes;
  }

  const result: AutoReframeKeyframe[] = [keyframes[0]];

  for (let i = 1; i < keyframes.length; i++) {
    const prev = result[result.length - 1];
    const curr = keyframes[i];
    const dt = curr.time - prev.time;

    if (dt <= 0) {
      result.push({ ...curr });
      continue;
    }

    const dx = curr.cropX - prev.cropX;
    const dy = curr.cropY - prev.cropY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const speed = distance / dt;

    if (speed <= maxSpeed) {
      result.push({ ...curr });
    } else {
      // Limit speed by interpolating position.
      const factor = maxSpeed / speed;
      result.push({
        ...curr,
        cropX: round(prev.cropX + dx * factor),
        cropY: round(prev.cropY + dy * factor),
      });
    }
  }

  return result;
}

function buildAutoReframeFFmpegExpression(
  keyframes: AutoReframeKeyframe[],
): string | undefined {
  if (keyframes.length === 0) {
    return undefined;
  }

  if (keyframes.length === 1) {
    const kf = keyframes[0];
    return `crop=${kf.cropW}:${kf.cropH}:${kf.cropX}:${kf.cropY}`;
  }

  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  const w = sorted[0].cropW;
  const h = sorted[0].cropH;

  const xExpr = buildSegmentExpr(sorted, 'cropX');
  const yExpr = buildSegmentExpr(sorted, 'cropY');

  return `crop=${w}:${h}:${xExpr}:${yExpr}`;
}

function buildSegmentExpr(
  keyframes: AutoReframeKeyframe[],
  field: 'cropX' | 'cropY',
): string {
  if (keyframes.length === 1) {
    return String(keyframes[0][field]);
  }

  let expr = String(keyframes[keyframes.length - 1][field]);
  for (let i = keyframes.length - 2; i >= 0; i--) {
    const threshold = keyframes[i + 1].time;
    const value = keyframes[i][field];
    expr = `if(lt(t\\,${threshold})\\,${value}\\,${expr})`;
  }

  return expr;
}

function emptyResult(): AutoReframeResult {
  return {
    keyframes: [],
    trackingInfo: {
      primarySubjectId: null,
      trackedFrames: 0,
      totalFrames: 0,
      continuity: 0,
    },
    confidence: 0,
  };
}

function makeEven(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}
