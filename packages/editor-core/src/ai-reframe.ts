import { round } from './time';
import type { TargetAspectRatio } from './reframe';
import { getTargetAspectRatioValue, normalizeTargetAspectRatio } from './reframe';

export const DEFAULT_REFrame_SAMPLE_INTERVAL = 2;
export const DEFAULT_SMOOTHING_WINDOW = 3;

export interface ReframeKeyframe {
  time: number;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
}

export interface ReframeBoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ReframeAIFrame {
  time: number;
  faceBox: ReframeBoundingBox | null;
  subjectBox: ReframeBoundingBox;
}

export interface ReframeAIResult {
  frames: ReframeAIFrame[];
}

export interface ClipAIReframe {
  targetAspect: string;
  keyframes: ReframeKeyframe[];
  confidence: number;
  generatedAt: number;
}

export function computeSampleTimes(
  clipDuration: number,
  interval = DEFAULT_REFrame_SAMPLE_INTERVAL,
  sceneCuts?: readonly number[],
): number[] {
  const duration = Math.max(0, Number.isFinite(clipDuration) ? clipDuration : 0);
  if (duration <= 0) {
    return [];
  }
  const step = Math.max(0.1, interval);
  const times: number[] = [];
  if (sceneCuts && sceneCuts.length > 0) {
    const merged = new Set<number>();
    merged.add(0);
    for (const cut of sceneCuts) {
      if (Number.isFinite(cut) && cut > 0 && cut < duration) {
        merged.add(round(cut));
      }
    }
    for (let t = 0; t < duration; t += step) {
      merged.add(round(Math.min(t, duration)));
    }
    merged.add(round(duration));
    return Array.from(merged).sort((a, b) => a - b);
  }
  for (let t = 0; t < duration; t += step) {
    times.push(round(t));
  }
  if (times[times.length - 1] !== round(duration)) {
    times.push(round(duration));
  }
  return times;
}

export function bboxToCropWindow(
  bbox: ReframeBoundingBox,
  sourceWidth: number,
  sourceHeight: number,
  targetAspect: Exclude<TargetAspectRatio, 'source'>,
): { cropX: number; cropY: number; cropW: number; cropH: number } {
  const ratio = getTargetAspectRatioValue(targetAspect);
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
  const centerX = bbox.x + bbox.w / 2;
  const centerY = bbox.y + bbox.h / 2;
  let cropX = Math.round(centerX - cropW / 2);
  let cropY = Math.round(centerY - cropH / 2);
  cropX = Math.max(0, Math.min(cropX, safeWidth - cropW));
  cropY = Math.max(0, Math.min(cropY, safeHeight - cropH));
  return { cropX, cropY, cropW, cropH };
}

export function generateReframeKeyframes(
  aiFrames: ReframeAIFrame[],
  sourceWidth: number,
  sourceHeight: number,
  targetAspect: TargetAspectRatio,
): ReframeKeyframe[] {
  const normalizedAspect = normalizeTargetAspectRatio(targetAspect);
  if (normalizedAspect === 'source') {
    return [];
  }
  const validAspect: Exclude<TargetAspectRatio, 'source'> = normalizedAspect;
  const keyframes: ReframeKeyframe[] = [];
  for (const frame of aiFrames) {
    const bbox = frame.faceBox ?? frame.subjectBox;
    const crop = bboxToCropWindow(bbox, sourceWidth, sourceHeight, validAspect);
    keyframes.push({ time: frame.time, ...crop });
  }
  return keyframes;
}

export function smoothKeyframes(
  keyframes: readonly ReframeKeyframe[],
  windowSize = DEFAULT_SMOOTHING_WINDOW,
): ReframeKeyframe[] {
  if (keyframes.length <= 1 || windowSize <= 1) {
    return keyframes.map((kf) => ({ ...kf }));
  }
  const half = Math.floor(windowSize / 2);
  return keyframes.map((kf, index) => {
    const start = Math.max(0, index - half);
    const end = Math.min(keyframes.length, index + half + 1);
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (let i = start; i < end; i++) {
      sumX += keyframes[i].cropX;
      sumY += keyframes[i].cropY;
      count++;
    }
    return {
      time: kf.time,
      cropX: round(sumX / count),
      cropY: round(sumY / count),
      cropW: kf.cropW,
      cropH: kf.cropH,
    };
  });
}

export function interpolateReframeAtTime(
  keyframes: readonly ReframeKeyframe[],
  time: number,
): ReframeKeyframe | undefined {
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
        cropW: a.cropW,
        cropH: a.cropH,
      };
    }
  }
  return { ...keyframes[0] };
}

export function buildReframeCropFFmpegExpression(keyframes: readonly ReframeKeyframe[]): string | undefined {
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
  const xExpr = buildSegmentExpression(sorted, 'cropX');
  const yExpr = buildSegmentExpression(sorted, 'cropY');
  return `crop=${w}:${h}:${xExpr}:${yExpr}`;
}

function buildSegmentExpression(keyframes: readonly ReframeKeyframe[], field: 'cropX' | 'cropY'): string {
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

export function computeReframeConfidence(aiFrames: readonly ReframeAIFrame[]): number {
  if (aiFrames.length === 0) {
    return 0;
  }
  let faceCount = 0;
  let totalArea = 0;
  for (const frame of aiFrames) {
    if (frame.faceBox) {
      faceCount++;
    }
    totalArea += frame.subjectBox.w * frame.subjectBox.h;
  }
  const faceRatio = faceCount / aiFrames.length;
  const averageArea = totalArea / aiFrames.length;
  const areaScore = Math.min(1, averageArea * 4);
  return round(faceRatio * 0.6 + areaScore * 0.4);
}

function makeEven(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}
