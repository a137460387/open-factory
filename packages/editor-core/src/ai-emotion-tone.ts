/**
 * AI scene emotional tone tagging.
 *
 * Analyzes video clip middle frames to detect emotional tone.
 * Supports batch mode with concurrency ≤3 and interruptible processing.
 */

/** 最小化 Project 引用，避免循环依赖 */
interface ProjectLike {
  timeline: {
    tracks: Array<{
      clips: Array<{
        type: string;
        emotionAnalysis?: EmotionAnalysis;
        [key: string]: unknown;
      }>;
    }>;
  };
}

/** 最小化 VideoClip 引用 */
interface VideoClipLike {
  id: string;
  type: 'video';
  emotionAnalysis?: EmotionAnalysis;
  [key: string]: unknown;
}

// --- Types ---

export type EmotionTone = 'energetic' | 'calm' | 'tense' | 'happy' | 'sad' | 'neutral';

export interface EmotionAnalysis {
  emotionTone: EmotionTone;
  intensity: number; // 0.0 ~ 1.0
  reason: string;
  analyzedAt: string;
}

export interface EmotionToneAIResponse {
  emotionTone: EmotionTone;
  intensity: number;
  reason: string;
}

/** Mapping of emotion tone to UI color for timeline display */
export const EMOTION_COLORS: Record<EmotionTone, string> = {
  energetic: '#f97316', // orange
  calm: '#3b82f6', // blue
  tense: '#ef4444', // red
  happy: '#eab308', // yellow
  sad: '#a855f7', // purple
  neutral: '#6b7280', // gray
};

export const VALID_EMOTION_TONES: readonly EmotionTone[] = ['energetic', 'calm', 'tense', 'happy', 'sad', 'neutral'];

// --- Core functions ---

/**
 * Build an AI prompt for emotion tone analysis of a clip.
 */
export function buildEmotionTonePrompt(sceneTag?: string): string {
  const lines = [
    '你是一个视频情感分析助手。请分析以下视频帧的情感基调。',
    sceneTag ? `场景标签: ${sceneTag}` : '',
    '',
    '返回严格JSON格式:',
    '{',
    '  "emotionTone": "energetic"|"calm"|"tense"|"happy"|"sad"|"neutral",',
    '  "intensity": 0.0~1.0,',
    '  "reason": "简短原因"',
    '}',
  ].filter(Boolean);
  return lines.join('\n');
}

/**
 * Parse AI emotion tone response JSON.
 * Returns null if invalid.
 */
export function parseEmotionToneResponse(json: string): EmotionToneAIResponse | null {
  try {
    const obj = JSON.parse(json);
    if (typeof obj !== 'object' || obj === null) return null;
    if (typeof obj.emotionTone !== 'string') return null;
    if (!VALID_EMOTION_TONES.includes(obj.emotionTone as EmotionTone)) return null;
    if (typeof obj.intensity !== 'number' || obj.intensity < 0 || obj.intensity > 1) return null;
    if (typeof obj.reason !== 'string') return null;
    return {
      emotionTone: obj.emotionTone as EmotionTone,
      intensity: obj.intensity,
      reason: obj.reason,
    };
  } catch {
    return null;
  }
}

/**
 * Get all video clips from a project that need emotion analysis.
 * Returns clips that don't have emotionAnalysis yet.
 */
export function getClipsNeedingEmotionAnalysis(project: ProjectLike): VideoClipLike[] {
  const result: VideoClipLike[] = [];
  for (const track of project.timeline.tracks) {
    for (const clip of track.clips) {
      if (clip.type !== 'video') continue;
      const vc = clip as VideoClipLike;
      if (!vc.emotionAnalysis) {
        result.push(vc);
      }
    }
  }
  return result;
}

/**
 * Batch analyze emotion tones with concurrency control.
 *
 * @param clips - Clips to analyze
 * @param analyzeFn - Async function that analyzes a single clip and returns EmotionAnalysis
 * @param maxConcurrency - Maximum concurrent requests (default 3)
 * @param signal - AbortSignal for cancellation
 * @returns Map of clipId → EmotionAnalysis for completed analyses
 */
export async function batchAnalyzeEmotionTones(
  clips: VideoClipLike[],
  analyzeFn: (clip: VideoClipLike) => Promise<EmotionAnalysis | null>,
  maxConcurrency = 3,
  signal?: AbortSignal,
): Promise<Map<string, EmotionAnalysis>> {
  const results = new Map<string, EmotionAnalysis>();
  let index = 0;

  const worker = async () => {
    while (index < clips.length) {
      if (signal?.aborted) break;
      const currentIndex = index++;
      const clip = clips[currentIndex];
      try {
        const result = await analyzeFn(clip);
        if (result) {
          results.set(clip.id, result);
        }
      } catch {
        // Skip failed analyses, continue with remaining
      }
    }
  };

  const workers = Array.from({ length: Math.min(maxConcurrency, clips.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
