/**
 * Stutter & Filler Detection for Smart Rough Cut
 *
 * Detects speech disfluencies: repeated syllables, filler words,
 * prolonged pauses mid-sentence, and abrupt pitch breaks.
 * Pure functions, no side effects.
 */

import { round } from './time';

// ─── Types ──────────────────────────────────────────────

export type StutterType = 'repetition' | 'filler' | 'prolonged_pause' | 'pitch_break';

export interface StutterInterval {
  id: string;
  start: number;
  end: number;
  duration: number;
  type: StutterType;
  confidence: number;
  reason: string;
}

export interface StutterDetectionOptions {
  /** Minimum duration for a filler pause (seconds) */
  minFillerPauseDuration?: number;
  /** Minimum repetitions to count as stutter */
  minRepetitions?: number;
  /** Pitch variance threshold for pitch break detection */
  pitchBreakThreshold?: number;
  /** Minimum confidence to include */
  minConfidence?: number;
  /** Merge stutters within this gap (seconds) */
  mergeGap?: number;
}

export interface AudioFrameForStutter {
  time: number;
  duration: number;
  loudness: number;
  pitchHz?: number;
  zeroCrossingRate?: number;
  spectralCentroid?: number;
}

export interface WhisperSegmentForStutter {
  start: number;
  end: number;
  text: string;
}

// ─── Constants ──────────────────────────────────────────────

const DEFAULTS: Required<StutterDetectionOptions> = {
  minFillerPauseDuration: 0.4,
  minRepetitions: 2,
  pitchBreakThreshold: 120,
  minConfidence: 0.4,
  mergeGap: 0.15,
};

const FILLER_PATTERNS_ZH = /^(嗯|啊|呃|额|那个|这个|就是|然后|对吧|怎么说|就是说|然后的话)/;
const FILLER_PATTERNS_EN = /^(um|uh|er|ah|like|you know|so basically|I mean|right\?)/i;
const REPETITION_WINDOW = 2.0;

// ─── Public API ──────────────────────────────────────────────

export function detectStutters(
  frames: AudioFrameForStutter[],
  whisperSegments?: WhisperSegmentForStutter[],
  options?: StutterDetectionOptions,
): StutterInterval[] {
  const opts = { ...DEFAULTS, ...options };
  const stutters: StutterInterval[] = [];
  let idCounter = 0;

  // 1. Detect prolonged pauses mid-sentence
  stutters.push(...detectProlongedPauses(frames, opts, idCounter));
  idCounter += stutters.length;

  // 2. Detect pitch breaks
  stutters.push(...detectPitchBreaks(frames, opts, idCounter));
  idCounter += stutters.length;

  // 3. Detect filler words from whisper text
  if (whisperSegments) {
    stutters.push(...detectFillerWords(whisperSegments, opts, idCounter));
    idCounter += stutters.length;
  }

  // 4. Detect repetition patterns from whisper text
  if (whisperSegments) {
    stutters.push(...detectRepetitions(whisperSegments, opts, idCounter));
  }

  // Merge overlapping stutters and filter by confidence
  return mergeStutterIntervals(stutters, opts.mergeGap)
    .filter((s) => s.confidence >= opts.minConfidence)
    .sort((a, b) => a.start - b.start || b.confidence - a.confidence);
}

export function buildRefinedCutIntervals(
  silenceRanges: Array<{ start: number; end: number; duration: number }>,
  stutterIntervals: StutterInterval[],
  totalDuration: number,
  options?: {
    paddingBefore?: number;
    paddingAfter?: number;
    minSegmentDuration?: number;
  },
): Array<{ start: number; end: number; duration: number }> {
  const paddingBefore = options?.paddingBefore ?? 0.05;
  const paddingAfter = options?.paddingAfter ?? 0.05;
  const minSegment = options?.minSegmentDuration ?? 0.2;

  // Combine all ranges to remove
  const removeRanges = [
    ...silenceRanges.map((r) => ({ start: r.start, end: r.end })),
    ...stutterIntervals.map((s) => ({ start: s.start, end: s.end })),
  ]
    .sort((a, b) => a.start - b.start)
    .reduce<Array<{ start: number; end: number }>>((merged, range) => {
      const prev = merged[merged.length - 1];
      if (prev && range.start <= prev.end + 0.05) {
        prev.end = Math.max(prev.end, range.end);
      } else {
        merged.push({ ...range });
      }
      return merged;
    }, []);

  // Invert: keep segments between removed ranges
  const keepSegments: Array<{ start: number; end: number; duration: number }> = [];
  let cursor = 0;

  for (const remove of removeRanges) {
    const segStart = cursor + paddingBefore;
    const segEnd = Math.max(0, remove.start - paddingAfter);
    if (segEnd - segStart >= minSegment) {
      keepSegments.push({
        start: round(Math.max(0, segStart)),
        end: round(segEnd),
        duration: round(segEnd - segStart),
      });
    }
    cursor = remove.end;
  }

  // Final segment after last removal
  const finalStart = cursor + paddingBefore;
  if (totalDuration - finalStart >= minSegment) {
    keepSegments.push({
      start: round(Math.max(0, finalStart)),
      end: round(totalDuration),
      duration: round(totalDuration - finalStart),
    });
  }

  return keepSegments;
}

export function estimateRefinedDuration(
  keepSegments: Array<{ duration: number }>,
): number {
  return round(keepSegments.reduce((sum, seg) => sum + seg.duration, 0));
}

// ─── Detection Algorithms ──────────────────────────────────

function detectProlongedPauses(
  frames: AudioFrameForStutter[],
  opts: Required<StutterDetectionOptions>,
  idOffset: number,
): StutterInterval[] {
  const sorted = normalizeFrames(frames);
  const results: StutterInterval[] = [];
  let pauseStart: number | undefined;

  for (let i = 0; i < sorted.length; i++) {
    const frame = sorted[i];
    const isQuiet = frame.loudness < 0.06;

    if (isQuiet && pauseStart === undefined) {
      pauseStart = frame.time;
    } else if (!isQuiet && pauseStart !== undefined) {
      const duration = round(frame.time - pauseStart);
      if (duration >= opts.minFillerPauseDuration) {
        results.push({
          id: `stutter-pause-${idOffset + results.length + 1}`,
          start: round(pauseStart),
          end: round(frame.time),
          duration,
          type: 'prolonged_pause',
          confidence: round(Math.min(1, duration / 2)),
          reason: `停顿 ${round(duration, 2)}s`,
        });
      }
      pauseStart = undefined;
    }
  }

  // Handle pause extending to end of frames
  if (pauseStart !== undefined && sorted.length > 0) {
    const lastFrame = sorted[sorted.length - 1];
    const endTime = round(lastFrame.time + lastFrame.duration);
    const duration = round(endTime - pauseStart);
    if (duration >= opts.minFillerPauseDuration) {
      results.push({
        id: `stutter-pause-${idOffset + results.length + 1}`,
        start: round(pauseStart),
        end: endTime,
        duration,
        type: 'prolonged_pause',
        confidence: round(Math.min(1, duration / 2)),
        reason: `停顿 ${round(duration, 2)}s`,
      });
    }
  }

  return results;
}

function detectPitchBreaks(
  frames: AudioFrameForStutter[],
  opts: Required<StutterDetectionOptions>,
  idOffset: number,
): StutterInterval[] {
  const sorted = normalizeFrames(frames).filter((f) => f.pitchHz !== undefined && f.pitchHz > 0);
  const results: StutterInterval[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const pitchDiff = Math.abs((curr.pitchHz ?? 0) - (prev.pitchHz ?? 0));

    if (pitchDiff >= opts.pitchBreakThreshold && curr.loudness > 0.1) {
      results.push({
        id: `stutter-pitch-${idOffset + results.length + 1}`,
        start: round(prev.time),
        end: round(curr.time + curr.duration),
        duration: round(curr.time + curr.duration - prev.time),
        type: 'pitch_break',
        confidence: round(Math.min(1, pitchDiff / (opts.pitchBreakThreshold * 2))),
        reason: `音高突变 ${round(pitchDiff)}Hz`,
      });
    }
  }
  return results;
}

function detectFillerWords(
  segments: WhisperSegmentForStutter[],
  opts: Required<StutterDetectionOptions>,
  idOffset: number,
): StutterInterval[] {
  const results: StutterInterval[] = [];

  for (const seg of segments) {
    const text = (seg.text ?? '').trim();
    if (!text) continue;

    const isFiller = FILLER_PATTERNS_ZH.test(text) || FILLER_PATTERNS_EN.test(text);
    if (!isFiller) continue;

    const duration = round(seg.end - seg.start);
    results.push({
      id: `stutter-filler-${idOffset + results.length + 1}`,
      start: round(Math.max(0, seg.start)),
      end: round(seg.end),
      duration,
      type: 'filler',
      confidence: round(Math.min(1, 0.7 + text.length * 0.02)),
      reason: `填充词「${text.slice(0, 10)}」`,
    });
  }
  return results;
}

function detectRepetitions(
  segments: WhisperSegmentForStutter[],
  opts: Required<StutterDetectionOptions>,
  idOffset: number,
): StutterInterval[] {
  const sorted = [...segments]
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start)
    .sort((a, b) => a.start - b.start);
  const results: StutterInterval[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const currentText = normalizeForComparison(current.text ?? '');
    if (!currentText || currentText.length < 2) continue;

    let repeatCount = 1;
    let lastEnd = current.end;

    for (let j = i + 1; j < sorted.length; j++) {
      const next = sorted[j];
      if (next.start - lastEnd > REPETITION_WINDOW) break;
      const nextText = normalizeForComparison(next.text ?? '');
      if (nextText === currentText) {
        repeatCount++;
        lastEnd = next.end;
      }
    }

    if (repeatCount >= opts.minRepetitions) {
      results.push({
        id: `stutter-repeat-${idOffset + results.length + 1}`,
        start: round(Math.max(0, current.start)),
        end: round(lastEnd),
        duration: round(lastEnd - current.start),
        type: 'repetition',
        confidence: round(Math.min(1, 0.6 + repeatCount * 0.1)),
        reason: `重复 ${repeatCount} 次「${currentText.slice(0, 8)}」`,
      });
    }
  }
  return results;
}

// ─── Helpers ──────────────────────────────────────────────

function mergeStutterIntervals(
  intervals: StutterInterval[],
  mergeGap: number,
): StutterInterval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: StutterInterval[] = [];

  for (const interval of sorted) {
    const prev = merged[merged.length - 1];
    if (prev && interval.start - prev.end <= mergeGap) {
      prev.end = Math.max(prev.end, interval.end);
      prev.duration = round(prev.end - prev.start);
      prev.confidence = Math.max(prev.confidence, interval.confidence);
      prev.reason = `${prev.reason} + ${interval.reason}`;
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}

function normalizeFrames(frames: AudioFrameForStutter[]): AudioFrameForStutter[] {
  return frames
    .filter((f) => Number.isFinite(f.time) && Number.isFinite(f.duration) && f.duration > 0)
    .map((f) => ({
      time: round(Math.max(0, f.time)),
      duration: round(Math.max(0.001, f.duration)),
      loudness: Math.max(0, f.loudness),
      ...(f.pitchHz !== undefined ? { pitchHz: f.pitchHz } : {}),
      ...(f.zeroCrossingRate !== undefined ? { zeroCrossingRate: f.zeroCrossingRate } : {}),
      ...(f.spectralCentroid !== undefined ? { spectralCentroid: f.spectralCentroid } : {}),
    }))
    .sort((a, b) => a.time - b.time);
}

function normalizeForComparison(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[，。！？、；：""''（）\[\]【】…—\-\s]+/gu, '')
    .replace(/[,.!?;:"'()\[\]…\-\s]+/g, '');
}
