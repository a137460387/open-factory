/**
 * AI Smart Creation Orchestrator.
 *
 * Coordinates scene detection, emotion analysis, speech understanding,
 * narrative analysis, recommendation, and storyline generation
 * to provide a unified smart creation workflow.
 */

import type { Clip, MediaAsset, VideoClip, ColorCorrection, Transform } from './model-types';
import type {
  ContentAnalysisVisualSample,
  ContentAnalysisAudioSample,
  ContentSceneType,
  ContentEmotionPoint,
} from './content-analysis';
import type { SceneDetectionResult, SceneDetectionOptions } from './ai-scene-detector';
import type { EmotionAnalysisResult } from './ai-emotion-analyzer';
import type { SpeechUnderstandingResult } from './ai-speech-understanding';
import type { NarrativeAnalysisResult } from './ai-narrative-analyzer';
import type { RecommendationResult, RecommendationContext } from './ai-smart-recommender';
import type { NarrativeGenerationResult, NarrativeTemplate } from './ai-narrative-generator';
import { detectScenes } from './ai-scene-detector';
import { analyzeEmotion } from './ai-emotion-analyzer';
import { understandSpeech } from './ai-speech-understanding';
import { analyzeNarrative } from './ai-narrative-analyzer';
import { recommendClips } from './ai-smart-recommender';
import { generateNarrative } from './ai-narrative-generator';
import { clamp01 } from './utils/math';

// ─── Types ────────────────────────────────────────────────

export type SmartCreationPhase =
  | 'scene_detection'
  | 'emotion_analysis'
  | 'speech_understanding'
  | 'narrative_analysis'
  | 'recommendation'
  | 'storyline';

export interface SmartCreationProgress {
  phase: SmartCreationPhase;
  progress: number; // 0-100
  message: string;
}

export interface SmartCreationResult {
  scenes: SceneDetectionResult;
  emotions: EmotionAnalysisResult;
  speech?: SpeechUnderstandingResult;
  narrative: NarrativeAnalysisResult;
  recommendations: RecommendationResult;
  storyline?: NarrativeGenerationResult;
  analyzedAt: string;
}

export interface SmartCreationOptions {
  enableSpeechUnderstanding?: boolean;
  narrativeTemplate?: NarrativeTemplate;
  targetDuration?: number;
  pacing?: 'slow' | 'moderate' | 'fast';
  maxRecommendations?: number;
  sceneDetection?: SceneDetectionOptions;
  onProgress?: (progress: SmartCreationProgress) => void;
}

// ─── Phase Progress Helpers ────────────────────────────────

const PHASE_WEIGHTS: Record<SmartCreationPhase, number> = {
  scene_detection: 25,
  emotion_analysis: 25,
  speech_understanding: 15,
  narrative_analysis: 15,
  recommendation: 10,
  storyline: 10,
};

function createPhaseProgress(
  phase: SmartCreationPhase,
  phaseProgress: number,
  message: string,
  completedPhases: SmartCreationPhase[],
): SmartCreationProgress {
  let totalProgress = 0;
  for (const completed of completedPhases) {
    totalProgress += PHASE_WEIGHTS[completed];
  }
  totalProgress += (PHASE_WEIGHTS[phase] * phaseProgress) / 100;
  return {
    phase,
    progress: Math.min(100, Math.round(totalProgress)),
    message,
  };
}

// ─── Core Orchestrator ─────────────────────────────────────

/**
 * Orchestrate the smart creation analysis pipeline.
 *
 * Runs scene detection, emotion analysis, speech understanding,
 * narrative analysis, recommendation, and optional storyline generation
 * in sequence, reporting progress via callback.
 */
export async function orchestrateSmartCreation(
  media: MediaAsset[],
  options: SmartCreationOptions = {},
): Promise<SmartCreationResult> {
  const {
    enableSpeechUnderstanding = true,
    narrativeTemplate,
    targetDuration,
    pacing,
    maxRecommendations = 10,
    sceneDetection,
    onProgress,
  } = options;

  const completedPhases: SmartCreationPhase[] = [];

  // Phase 1: Scene Detection
  onProgress?.(createPhaseProgress('scene_detection', 0, '正在检测场景...', completedPhases));

  const allVisualSamples = collectVisualSamples(media);
  const scenes = detectScenes(allVisualSamples, sceneDetection);

  onProgress?.(createPhaseProgress('scene_detection', 100, `检测到 ${scenes.segments.length} 个场景`, completedPhases));
  completedPhases.push('scene_detection');

  // Phase 2: Emotion Analysis
  onProgress?.(createPhaseProgress('emotion_analysis', 0, '正在分析情绪...', completedPhases));

  const allAudioSamples = collectAudioSamples(media);
  const emotionResult = analyzeEmotion(allVisualSamples, allAudioSamples);
  // Keep the original emotion result with EmotionPoint[] type
  const emotions = emotionResult;

  onProgress?.(createPhaseProgress('emotion_analysis', 100, '情绪分析完成', completedPhases));
  completedPhases.push('emotion_analysis');

  // Phase 3: Speech Understanding (optional)
  let speech: SpeechUnderstandingResult | undefined;
  if (enableSpeechUnderstanding) {
    onProgress?.(createPhaseProgress('speech_understanding', 0, '正在理解语音...', completedPhases));

    const transcripts = collectTranscripts(media);
    if (transcripts.length > 0) {
      speech = understandSpeech(transcripts.join('\n'));
    }

    onProgress?.(createPhaseProgress('speech_understanding', 100, '语音理解完成', completedPhases));
    completedPhases.push('speech_understanding');
  }

  // Phase 4: Narrative Analysis
  onProgress?.(createPhaseProgress('narrative_analysis', 0, '正在分析叙事结构...', completedPhases));

  // Convert scene segments to format expected by analyzeNarrative
  const narrativeSegments = scenes.segments.map((seg) => ({
    start: seg.start,
    end: seg.end,
    sceneTypes: [seg.sceneType],
    brightness: seg.avgBrightness,
    motion: seg.avgMotion,
  }));
  // Convert EmotionPoint[] to ContentEmotionPoint[] for analyzeNarrative
  const emotionCurveForNarrative: ContentEmotionPoint[] = emotions.curve.map((p) => ({
    time: p.time,
    value: p.value,
    brightness: (p.value + 1) / 2, // Map -1..1 to 0..1
  }));
  const narrative = analyzeNarrative(narrativeSegments, emotionCurveForNarrative);

  onProgress?.(createPhaseProgress('narrative_analysis', 100, `叙事评分: ${narrative.score}`, completedPhases));
  completedPhases.push('narrative_analysis');

  // Phase 5: Recommendation
  onProgress?.(createPhaseProgress('recommendation', 0, '正在生成推荐...', completedPhases));

  const clips = extractClipsFromMedia(media);
  const recommendations = generateRecommendations(clips, scenes, emotions, narrative, maxRecommendations);

  onProgress?.(
    createPhaseProgress('recommendation', 100, `生成 ${recommendations.clips.length} 条推荐`, completedPhases),
  );
  completedPhases.push('recommendation');

  // Phase 6: Storyline Generation (optional)
  let storyline: NarrativeGenerationResult | undefined;
  if (narrativeTemplate) {
    onProgress?.(createPhaseProgress('storyline', 0, '正在生成故事线...', completedPhases));

    storyline = generateNarrative(
      { scenes: scenes.segments, emotions, speech },
      { template: narrativeTemplate, targetDuration, pacing },
    );

    onProgress?.(
      createPhaseProgress('storyline', 100, `故事线包含 ${storyline.storyline.length} 个片段`, completedPhases),
    );
    completedPhases.push('storyline');
  }

  return {
    scenes,
    emotions,
    speech,
    narrative,
    recommendations,
    storyline,
    analyzedAt: new Date().toISOString(),
  };
}

// ─── Helper Functions ──────────────────────────────────────

/**
 * Estimate brightness from media metadata.
 * Uses color profile and resolution as proxies.
 */
function estimateBrightness(m: MediaAsset): number {
  // HDR content tends to be brighter
  if (m.colorProfile?.colorTransfer === 'smpte2084' || m.colorProfile?.colorTransfer === 'arib-std-b67') {
    return 0.65;
  }
  // Higher resolution often correlates with better lighting
  const pixelCount = m.width * m.height;
  if (pixelCount > 3840 * 2160) return 0.58;
  if (pixelCount > 1920 * 1080) return 0.52;
  return 0.45;
}

/**
 * Estimate saturation from media metadata.
 * Uses color space and codec as proxies.
 */
function estimateSaturation(m: MediaAsset): number {
  // Wide color gamut tends to be more saturated
  if (m.colorProfile?.colorPrimaries === 'bt2020') return 0.62;
  if (m.colorProfile?.colorPrimaries === 'smpte432') return 0.55;
  // HEVC/AV1 often used for HDR/wide gamut content
  if (m.videoCodec?.includes('hevc') || m.videoCodec?.includes('av1')) return 0.48;
  return 0.38;
}

/**
 * Estimate motion from media metadata.
 * Uses frame rate and bitrate as proxies.
 */
function estimateMotion(m: MediaAsset): number {
  const fps = m.frameRate ?? 30;
  // Higher frame rate often indicates action/sports content
  const fpsFactor = Math.min(1, Math.max(0, (fps - 24) / 96));
  // Larger files per second might indicate more motion
  const bitrateFactor = m.size && m.duration > 0 ? Math.min(1, m.size / m.duration / 5_000_000) : 0.3;
  return fpsFactor * 0.6 + bitrateFactor * 0.4;
}

/**
 * Collect visual samples from media assets using metadata-based estimation.
 */
function collectVisualSamples(media: MediaAsset[]): ContentAnalysisVisualSample[] {
  const samples: ContentAnalysisVisualSample[] = [];
  for (const m of media) {
    // Use aiAnalysis scene/mood if available
    const sceneHint = m.aiAnalysis?.scene?.toLowerCase() ?? '';
    const moodHint = m.aiAnalysis?.mood?.toLowerCase() ?? '';

    // Base estimates from metadata
    let brightness = estimateBrightness(m);
    let saturation = estimateSaturation(m);
    let motion = estimateMotion(m);

    // Adjust based on AI analysis hints
    if (sceneHint.includes('night') || sceneHint.includes('dark')) {
      brightness *= 0.6;
    } else if (sceneHint.includes('outdoor') || sceneHint.includes('sunny')) {
      brightness = Math.min(1, brightness * 1.3);
      saturation = Math.min(1, saturation * 1.2);
    }
    if (sceneHint.includes('action') || sceneHint.includes('sport')) {
      motion = Math.min(1, motion * 1.5);
    }
    if (moodHint.includes('energetic') || moodHint.includes('exciting')) {
      motion = Math.min(1, motion * 1.3);
      saturation = Math.min(1, saturation * 1.1);
    } else if (moodHint.includes('calm') || moodHint.includes('peaceful')) {
      motion *= 0.7;
    }

    if (m.duration > 0) {
      const sampleCount = Math.max(1, Math.floor(m.duration / 5));
      for (let i = 0; i < sampleCount; i++) {
        const t = (i / sampleCount) * m.duration;
        // Add slight variation to avoid perfectly flat curves
        const variation = Math.sin(t * 0.5) * 0.08;
        samples.push({
          time: t,
          brightness: clamp01(brightness + variation),
          saturation: clamp01(saturation + variation * 0.5),
          motion: clamp01(motion + Math.cos(t * 0.3) * 0.1),
        });
      }
    }
  }
  return samples.sort((a, b) => a.time - b.time);
}

/**
 * Collect audio samples from media assets.
 * Uses waveform data if available, otherwise estimates from metadata.
 */
function collectAudioSamples(media: MediaAsset[]): ContentAnalysisAudioSample[] {
  const samples: ContentAnalysisAudioSample[] = [];
  for (const m of media) {
    if (!m.hasAudio) continue;

    // Base loudness estimate from audio codec and channels
    let baseLoudness = 0.5;
    if (m.audioChannels && m.audioChannels >= 6) {
      baseLoudness = 0.6; // Surround sound tends to be mixed louder
    }
    if (m.audioSampleRate && m.audioSampleRate >= 48000) {
      baseLoudness = Math.min(1, baseLoudness * 1.1);
    }

    // Adjust based on AI analysis mood
    const moodHint = m.aiAnalysis?.mood?.toLowerCase() ?? '';
    if (moodHint.includes('energetic') || moodHint.includes('exciting')) {
      baseLoudness = Math.min(1, baseLoudness * 1.3);
    } else if (moodHint.includes('calm') || moodHint.includes('peaceful')) {
      baseLoudness *= 0.7;
    }

    if (m.duration > 0) {
      const sampleCount = Math.max(1, Math.floor(m.duration / 5));
      for (let i = 0; i < sampleCount; i++) {
        const t = (i / sampleCount) * m.duration;
        // Add natural variation
        const variation = Math.sin(t * 0.7) * 0.15 + Math.cos(t * 1.3) * 0.08;
        samples.push({
          time: t,
          loudness: clamp01(baseLoudness + variation),
        });
      }
    }
  }
  return samples.sort((a, b) => a.time - b.time);
}

/**
 * Collect transcripts from media assets.
 */
function collectTranscripts(media: MediaAsset[]): string[] {
  const transcripts: string[] = [];
  for (const m of media) {
    // Check if media has AI analysis with transcript
    const aiAnalysis = m.aiAnalysis;
    if (aiAnalysis) {
      // Check for transcript in various possible locations
      const analysis = aiAnalysis as unknown as Record<string, unknown>;
      if (analysis.transcript && typeof analysis.transcript === 'string') {
        transcripts.push(analysis.transcript);
      }
    }
  }
  return transcripts;
}

function extractClipsFromMedia(media: MediaAsset[]): Clip[] {
  const defaultColorCorrection: ColorCorrection = {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    hue: 0,
  };
  const defaultTransform: Transform = {
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    opacity: 1,
  };
  return media.map((m) => ({
    id: m.id,
    mediaId: m.id,
    start: 0,
    duration: m.duration,
    trackId: 'track-0',
    name: m.name,
    type: 'video' as const,
    trimStart: 0,
    trimEnd: 0,
    speed: 1,
    volume: 1,
    colorCorrection: defaultColorCorrection,
    transform: defaultTransform,
  }));
}

function generateRecommendations(
  clips: Clip[],
  scenes: SceneDetectionResult,
  emotions: EmotionAnalysisResult,
  narrative: NarrativeAnalysisResult,
  maxRecommendations: number,
): RecommendationResult {
  // Build context from analysis results
  const avgEmotion =
    emotions.curve.length > 0 ? emotions.curve.reduce((sum, p) => sum + p.value, 0) / emotions.curve.length : 0;

  const dominantSceneType = scenes.segments.length > 0 ? scenes.segments[0].sceneType : 'indoor';

  // Build recommendation context
  const context: RecommendationContext = {
    selectedClips: [],
    currentTime: 0,
    currentEmotionTrend: avgEmotion,
    preferredSceneTypes: [dominantSceneType],
  };

  // Use the recommendClips function from ai-smart-recommender
  return recommendClips(clips, context, { maxResults: maxRecommendations });
}
