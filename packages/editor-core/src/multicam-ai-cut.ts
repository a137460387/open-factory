/**
 * AI multi-camera best-shot switching recommendation.
 *
 * Local feature extraction: for each 1-second window compute per-angle
 *   audio RMS (active-speaker proxy) and frame-diff motion amplitude.
 * The features are sent to an AI provider as a compact JSON payload
 *   (no raw video), and the response is parsed into cut suggestions.
 * A local post-processing step enforces a minimum 1.5 s gap between
 *   consecutive cuts (merging too-close suggestions, keeping the one
 *   with higher confidence).
 */

import { round } from './time';

// -- Public types ------------------------------------------------

export interface MulticamAngleFeature {
  angleId: string;
  audioRMS: number;
  motionScore: number;
}

export interface MulticamWindowFeature {
  time: number;
  angles: MulticamAngleFeature[];
}

export interface MulticamFeaturePayload {
  windows: MulticamWindowFeature[];
}

export interface MulticamCutSuggestion {
  time: number;
  angleId: string;
  confidence: number;
  reason: string;
}

export interface MulticamAiCutResponse {
  cuts: Array<{ time: number; angleId: string; reason?: string; confidence?: number }>;
}

// -- Audio RMS calculation ---------------------------------------

/**
 * Calculate RMS (root-mean-square) of a PCM sample buffer.
 * Returns a value in [0, 1] assuming samples are normalised.
 */
export function calculateAudioRMS(samples: ArrayLike<number>): number {
  const len = samples.length;
  if (len === 0) return 0;
  let sumSq = 0;
  for (let i = 0; i < len; i += 1) {
    const v = samples[i];
    sumSq += v * v;
  }
  return round(Math.sqrt(sumSq / len));
}

// -- Motion score (simple block-matching) -------------------------

function computeBlockNCC(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  imgW: number,
  imgH: number,
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  bW: number,
  bH: number,
): number {
  let sumA = 0;
  let sumB = 0;
  let count = 0;
  for (let y = 0; y < bH; y += 1) {
    for (let x = 0; x < bW; x += 1) {
      const ax = ox + x;
      const ay = oy + y;
      const bx = ax + dx;
      const by = ay + dy;
      if (ax < 0 || ax >= imgW || ay < 0 || ay >= imgH) continue;
      if (bx < 0 || bx >= imgW || by < 0 || by >= imgH) continue;
      sumA += a[ay * imgW + ax];
      sumB += b[by * imgW + bx];
      count += 1;
    }
  }
  if (count === 0) return 0;
  const meanA = sumA / count;
  const meanB = sumB / count;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let y = 0; y < bH; y += 1) {
    for (let x = 0; x < bW; x += 1) {
      const ax = ox + x;
      const ay = oy + y;
      const bx = ax + dx;
      const by = ay + dy;
      if (ax < 0 || ax >= imgW || ay < 0 || ay >= imgH) continue;
      if (bx < 0 || bx >= imgW || by < 0 || by >= imgH) continue;
      const dA = a[ay * imgW + ax] - meanA;
      const dB = b[by * imgW + bx] - meanB;
      dot += dA * dB;
      normA += dA * dA;
      normB += dB * dB;
    }
  }
  const denom = Math.sqrt(normA * normB);
  return denom > 0 ? dot / denom : 0;
}

function findBestMatch(
  prev: ArrayLike<number>,
  curr: ArrayLike<number>,
  imgW: number,
  imgH: number,
  bx: number,
  by: number,
  bW: number,
  bH: number,
  radius: number,
): { dx: number; dy: number; ncc: number } {
  let bestDx = 0;
  let bestDy = 0;
  let bestNcc = -Infinity;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const ncc = computeBlockNCC(prev, curr, imgW, imgH, bx, by, dx, dy, bW, bH);
      if (ncc > bestNcc) {
        bestNcc = ncc;
        bestDx = dx;
        bestDy = dy;
      }
    }
  }
  return { dx: bestDx, dy: bestDy, ncc: bestNcc };
}

/**
 * Simple block-matching motion estimation between two luminance frames.
 * Frames are represented as flat arrays of normalised luminance [0,1]
 * with dimensions width x height.
 *
 * The image is divided into a gridSize x gridSize grid of blocks. For each block the
 * function searches a small neighbourhood (+-searchRadius pixels) in
 * the next frame using normalised cross-correlation (NCC) and picks
 * the displacement with the highest NCC score.
 *
 * Returns the mean displacement magnitude across all blocks.
 */
export function estimateFrameMotion(
  prevFrame: ArrayLike<number>,
  currFrame: ArrayLike<number>,
  width: number,
  height: number,
  gridSize = 4,
  searchRadius = 4,
): number {
  if (width < gridSize || height < gridSize) return 0;
  const blockW = Math.floor(width / gridSize);
  const blockH = Math.floor(height / gridSize);
  if (blockW < 2 || blockH < 2) return 0;
  let totalDisp = 0;
  let blockCount = 0;
  for (let gy = 0; gy < gridSize; gy += 1) {
    for (let gx = 0; gx < gridSize; gx += 1) {
      const bx = gx * blockW;
      const by = gy * blockH;
      const best = findBestMatch(prevFrame, currFrame, width, height, bx, by, blockW, blockH, searchRadius);
      totalDisp += Math.sqrt(best.dx * best.dx + best.dy * best.dy);
      blockCount += 1;
    }
  }
  return blockCount > 0 ? round(totalDisp / blockCount) : 0;
}

// -- Windowed feature extraction ---------------------------------

export interface AngleAudioSamples {
  angleId: string;
  samples: number[];
  sampleRate: number;
}

export interface AngleMotionFrames {
  angleId: string;
  frames: number[][];
  width: number;
  height: number;
}

/**
 * Build the feature payload to be sent to the AI provider.
 * windowSeconds divides the duration into non-overlapping windows.
 * For each window, per-angle audio RMS and motion amplitude are computed.
 */
export function buildMulticamFeaturePayload(
  duration: number,
  windowSeconds: number,
  audioData: AngleAudioSamples[],
  motionData: AngleMotionFrames[],
): MulticamFeaturePayload {
  const ws = Math.max(0.1, windowSeconds);
  const windowCount = Math.max(1, Math.ceil(duration / ws));
  const windows: MulticamWindowFeature[] = [];
  for (let wi = 0; wi < windowCount; wi += 1) {
    const wStart = wi * ws;
    const wEnd = Math.min(duration, wStart + ws);
    const time = round(wStart);
    const angles: MulticamAngleFeature[] = [];
    const allAngleIds = new Set([...audioData.map((a) => a.angleId), ...motionData.map((m) => m.angleId)]);
    for (const angleId of allAngleIds) {
      const audio = audioData.find((a) => a.angleId === angleId);
      const motion = motionData.find((m) => m.angleId === angleId);
      const audioRMS = computeWindowRMS(audio, wStart, wEnd);
      const motionScore = computeWindowMotion(motion, wStart, wEnd);
      angles.push({ angleId, audioRMS, motionScore });
    }
    windows.push({ time, angles });
  }
  return { windows };
}

function computeWindowRMS(audio: AngleAudioSamples | undefined, wStart: number, wEnd: number): number {
  if (!audio || audio.samples.length === 0) return 0;
  const rate = Math.max(1, audio.sampleRate);
  const startIdx = Math.floor(wStart * rate);
  const endIdx = Math.min(audio.samples.length, Math.ceil(wEnd * rate));
  if (endIdx <= startIdx) return 0;
  let sumSq = 0;
  let count = 0;
  for (let i = startIdx; i < endIdx; i += 1) {
    const v = audio.samples[i];
    sumSq += v * v;
    count += 1;
  }
  return count > 0 ? round(Math.sqrt(sumSq / count)) : 0;
}

function computeWindowMotion(motion: AngleMotionFrames | undefined, wStart: number, wEnd: number): number {
  if (!motion || motion.frames.length === 0) return 0;
  const startFrame = Math.floor(wStart);
  const endFrame = Math.min(motion.frames.length, Math.ceil(wEnd));
  if (endFrame - startFrame < 2) return 0;
  let totalMotion = 0;
  let pairCount = 0;
  for (let fi = startFrame; fi < endFrame - 1; fi += 1) {
    totalMotion += estimateFrameMotion(motion.frames[fi], motion.frames[fi + 1], motion.width, motion.height);
    pairCount += 1;
  }
  return pairCount > 0 ? round(totalMotion / pairCount) : 0;
}

// -- Build AI request prompts ------------------------------------

export function buildMulticamCutSystemPrompt(): string {
  return [
    '你是一个专业视频剪辑助手。用户会给你多机位视频在不同时间窗口下各角度的音频电平（RMS）和运动幅度数据。',
    '请根据以下原则推荐镜头切换时机：',
    '1. 优先选择音频 RMS 最高的角度（活跃说话人）。',
    '2. 当多个角度 RMS 接近时，优先选择运动幅度较低的角度（画面更稳定）。',
    '3. 在动作场面时，可以选择运动幅度较高的角度以增强动感。',
    '4. 切换应自然流畅，避免过于频繁。',
    '',
    '返回 JSON 格式：{"cuts": [{"time": 秒, "angleId": "角度ID", "reason": "原因", "confidence": 0~1}]}',
    '只返回 JSON，不要其他内容。',
  ].join('\n');
}

export function buildMulticamCutUserPrompt(payload: MulticamFeaturePayload): string {
  return JSON.stringify(payload);
}

// -- Parse AI response -------------------------------------------

export function parseMulticamCutResponse(json: unknown): MulticamCutSuggestion[] {
  if (!json || typeof json !== 'object') return [];
  const obj = json as Record<string, unknown>;
  if (!Array.isArray(obj.cuts)) return [];
  return obj.cuts
    .filter(
      (item): item is Record<string, unknown> =>
        item != null &&
        typeof item === 'object' &&
        typeof (item as Record<string, unknown>).time === 'number' &&
        typeof (item as Record<string, unknown>).angleId === 'string',
    )
    .map((item) => ({
      time: round(Math.max(0, (item as { time: number }).time)),
      angleId: ((item as { angleId: string }).angleId || '').trim(),
      confidence: clampConfidence((item as { confidence?: unknown }).confidence),
      reason:
        typeof (item as { reason?: unknown }).reason === 'string'
          ? ((item as { reason: string }).reason || '').trim().slice(0, 200)
          : '',
    }))
    .filter((item) => item.angleId.length > 0)
    .sort((a, b) => a.time - b.time);
}

function clampConfidence(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return round(Math.min(1, Math.max(0, value)));
  }
  return 0.5;
}

// -- Minimum switch interval enforcement --------------------------

export const DEFAULT_MIN_SWITCH_INTERVAL = 1.5;

/**
 * Enforce a minimum time gap between consecutive cut suggestions.
 * When two suggestions are closer than minInterval, the one with
 * lower confidence is dropped. Ties are broken by keeping the earlier
 * suggestion.
 */
export function enforceMinimumSwitchInterval(
  suggestions: MulticamCutSuggestion[],
  minInterval: number = DEFAULT_MIN_SWITCH_INTERVAL,
): MulticamCutSuggestion[] {
  if (suggestions.length <= 1) return [...suggestions];
  const sorted = [...suggestions].sort((a, b) => a.time - b.time || b.confidence - a.confidence);
  const result: MulticamCutSuggestion[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = result[result.length - 1];
    const curr = sorted[i];
    const gap = curr.time - prev.time;
    if (gap < minInterval) {
      if (curr.confidence > prev.confidence) {
        result[result.length - 1] = curr;
      }
    } else {
      result.push(curr);
    }
  }
  return result;
}

// -- Validate suggestions against available angles ----------------

export function validateCutAngles(
  suggestions: MulticamCutSuggestion[],
  validAngleIds: string[],
): MulticamCutSuggestion[] {
  const valid = new Set(validAngleIds);
  return suggestions.filter((s) => valid.has(s.angleId));
}
