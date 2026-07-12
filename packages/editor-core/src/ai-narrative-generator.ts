/**
 * AI Narrative Generator.
 *
 * Generates story line suggestions based on video content analysis,
 * including scene sequences, emotion curves, and speech understanding.
 * Supports multiple narrative templates (documentary, vlog, tutorial, cinematic).
 */

import type { ContentSceneType } from './content-analysis';
import type { EmotionAnalysisResult, EmotionPoint } from './ai-emotion-analyzer';
import type { SpeechUnderstandingResult } from './ai-speech-understanding';

// ─── Types ────────────────────────────────────────────────

export type NarrativeTemplate = 'documentary' | 'vlog' | 'tutorial' | 'cinematic';
export type PacingType = 'slow' | 'moderate' | 'fast';

export interface NarrativeGenerationResult {
  storyline: StorylineSegment[];
  totalDuration: number;
  pacing: PacingType;
  template: NarrativeTemplate;
  generatedAt: string;
}

export interface StorylineSegment {
  id: string;
  sceneType: ContentSceneType;
  purpose: string;
  suggestedClips: string[];
  duration: number;
  emotionTarget: number;
  transitionType: 'cut' | 'fade' | 'dissolve' | 'wipe';
}

export interface NarrativeGenerationOptions {
  template?: NarrativeTemplate;
  targetDuration?: number;
  pacing?: PacingType;
}

/** Scene segment for narrative analysis */
export interface SceneSegment {
  start: number;
  end: number;
  sceneType: ContentSceneType;
  avgBrightness: number;
  avgMotion: number;
}

// ─── Template Definitions ──────────────────────────────────

interface NarrativeTemplateConfig {
  name: NarrativeTemplate;
  description: string;
  segments: TemplateSegment[];
}

interface TemplateSegment {
  purpose: string;
  sceneTypes: ContentSceneType[];
  emotionRange: [number, number]; // -1 to 1
  durationRatio: number; // 0-1, proportion of total duration
  transitionType: StorylineSegment['transitionType'];
}

const TEMPLATES: Record<NarrativeTemplate, NarrativeTemplateConfig> = {
  documentary: {
    name: 'documentary',
    description: '纪录片风格：开场引入、主体叙述、结尾总结',
    segments: [
      {
        purpose: '开场引入',
        sceneTypes: ['outdoor', 'indoor'],
        emotionRange: [0, 0.3],
        durationRatio: 0.15,
        transitionType: 'fade',
      },
      {
        purpose: '主体叙述',
        sceneTypes: ['indoor', 'outdoor', 'dialogue'],
        emotionRange: [0.2, 0.7],
        durationRatio: 0.5,
        transitionType: 'cut',
      },
      {
        purpose: '高潮展示',
        sceneTypes: ['action', 'outdoor'],
        emotionRange: [0.5, 1],
        durationRatio: 0.2,
        transitionType: 'dissolve',
      },
      {
        purpose: '结尾总结',
        sceneTypes: ['indoor', 'outdoor'],
        emotionRange: [0, 0.4],
        durationRatio: 0.15,
        transitionType: 'fade',
      },
    ],
  },
  vlog: {
    name: 'vlog',
    description: 'Vlog风格：轻松开场、日常记录、互动结尾',
    segments: [
      {
        purpose: '轻松开场',
        sceneTypes: ['close-up', 'indoor'],
        emotionRange: [0.3, 0.7],
        durationRatio: 0.1,
        transitionType: 'cut',
      },
      {
        purpose: '日常记录',
        sceneTypes: ['indoor', 'outdoor', 'dialogue'],
        emotionRange: [0.2, 0.8],
        durationRatio: 0.6,
        transitionType: 'cut',
      },
      {
        purpose: '精彩瞬间',
        sceneTypes: ['action', 'outdoor', 'close-up'],
        emotionRange: [0.6, 1],
        durationRatio: 0.2,
        transitionType: 'dissolve',
      },
      {
        purpose: '互动结尾',
        sceneTypes: ['close-up', 'dialogue'],
        emotionRange: [0.3, 0.6],
        durationRatio: 0.1,
        transitionType: 'fade',
      },
    ],
  },
  tutorial: {
    name: 'tutorial',
    description: '教程风格：目标说明、步骤演示、总结回顾',
    segments: [
      {
        purpose: '目标说明',
        sceneTypes: ['close-up', 'indoor'],
        emotionRange: [0, 0.3],
        durationRatio: 0.15,
        transitionType: 'fade',
      },
      {
        purpose: '步骤演示',
        sceneTypes: ['indoor', 'close-up'],
        emotionRange: [0.1, 0.5],
        durationRatio: 0.55,
        transitionType: 'cut',
      },
      {
        purpose: '重点强调',
        sceneTypes: ['close-up', 'indoor'],
        emotionRange: [0.3, 0.7],
        durationRatio: 0.15,
        transitionType: 'dissolve',
      },
      {
        purpose: '总结回顾',
        sceneTypes: ['indoor', 'close-up'],
        emotionRange: [0, 0.4],
        durationRatio: 0.15,
        transitionType: 'fade',
      },
    ],
  },
  cinematic: {
    name: 'cinematic',
    description: '电影风格：序幕、发展、高潮、结局',
    segments: [
      {
        purpose: '序幕',
        sceneTypes: ['outdoor', 'night'],
        emotionRange: [-0.2, 0.3],
        durationRatio: 0.15,
        transitionType: 'fade',
      },
      {
        purpose: '发展',
        sceneTypes: ['indoor', 'outdoor', 'dialogue'],
        emotionRange: [0, 0.6],
        durationRatio: 0.35,
        transitionType: 'dissolve',
      },
      {
        purpose: '高潮',
        sceneTypes: ['action', 'night', 'outdoor'],
        emotionRange: [0.6, 1],
        durationRatio: 0.3,
        transitionType: 'cut',
      },
      {
        purpose: '结局',
        sceneTypes: ['outdoor', 'indoor'],
        emotionRange: [-0.1, 0.4],
        durationRatio: 0.2,
        transitionType: 'fade',
      },
    ],
  },
};

// ─── Core Generator ────────────────────────────────────────

/**
 * Generate a narrative storyline based on content analysis results.
 *
 * Uses template-based generation with scene matching and emotion alignment.
 */
export function generateNarrative(
  analysisResults: {
    scenes: SceneSegment[];
    emotions: EmotionAnalysisResult;
    speech?: SpeechUnderstandingResult;
  },
  options: NarrativeGenerationOptions = {}
): NarrativeGenerationResult {
  const {
    template = 'documentary',
    targetDuration = estimateTotalDuration(analysisResults.scenes),
    pacing = 'moderate',
  } = options;

  const templateConfig = TEMPLATES[template];
  const storyline: StorylineSegment[] = [];

  let currentTime = 0;
  const pacingMultiplier = pacing === 'slow' ? 1.3 : pacing === 'fast' ? 0.7 : 1;

  for (let i = 0; i < templateConfig.segments.length; i++) {
    const seg = templateConfig.segments[i];
    const duration = targetDuration * seg.durationRatio * pacingMultiplier;

    // Find matching scenes for this segment
    const matchingScenes = findMatchingScenes(
      analysisResults.scenes,
      seg.sceneTypes,
      seg.emotionRange,
      currentTime,
      currentTime + duration
    );

    // Find clips that fit the emotion target
    const emotionTarget = (seg.emotionRange[0] + seg.emotionRange[1]) / 2;
    const suggestedClips = matchingScenes.map((s) => `scene-${s.start.toFixed(1)}`);

    storyline.push({
      id: `segment-${i}`,
      sceneType: seg.sceneTypes[0],
      purpose: seg.purpose,
      suggestedClips,
      duration: Math.round(duration * 10) / 10,
      emotionTarget: Math.round(emotionTarget * 100) / 100,
      transitionType: seg.transitionType,
    });

    currentTime += duration;
  }

  return {
    storyline,
    totalDuration: Math.round(currentTime * 10) / 10,
    pacing,
    template,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Helper Functions ──────────────────────────────────────

function estimateTotalDuration(scenes: SceneSegment[]): number {
  if (scenes.length === 0) return 60; // Default 60 seconds
  const lastScene = scenes[scenes.length - 1];
  return lastScene.end;
}

function findMatchingScenes(
  scenes: SceneSegment[],
  targetSceneTypes: ContentSceneType[],
  emotionRange: [number, number],
  startTime: number,
  endTime: number
): SceneSegment[] {
  return scenes.filter((scene) => {
    // Check time range overlap
    if (scene.end < startTime || scene.start > endTime) {
      return false;
    }

    // Check scene type match
    const typeMatch = targetSceneTypes.includes(scene.sceneType);

    // Check emotion range (approximate based on brightness and motion)
    const estimatedEmotion = estimateSceneEmotion(scene);
    const emotionMatch =
      estimatedEmotion >= emotionRange[0] && estimatedEmotion <= emotionRange[1];

    return typeMatch || emotionMatch;
  });
}

function estimateSceneEmotion(scene: SceneSegment): number {
  // Simple heuristic: bright + moderate motion = positive emotion
  const brightnessFactor = (scene.avgBrightness - 0.5) * 0.6;
  const motionFactor = scene.avgMotion > 0.5 ? 0.2 : -0.1;
  return Math.max(-1, Math.min(1, brightnessFactor + motionFactor));
}
