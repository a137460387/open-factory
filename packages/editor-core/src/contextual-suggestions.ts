/**
 * Contextual Suggestions Engine
 *
 * Analyzes the current timeline state and media content to generate
 * context-aware operation suggestions displayed as smart bubbles.
 *
 * Suggestion categories:
 * - Editing suggestions (transitions, cuts, pacing)
 * - Content suggestions (B-roll, effects, color)
 * - Technical suggestions (resolution, audio levels)
 * - Creative suggestions (style, mood, rhythm)
 */

import { round } from './time';
import type { Timeline, Clip, MediaAsset } from './model-types';

// ==================== Types ====================

export type SuggestionCategory = 'editing' | 'content' | 'technical' | 'creative';
export type SuggestionPriority = 'high' | 'medium' | 'low';

export interface ContextualSuggestion {
  /** Unique suggestion ID */
  id: string;
  /** Category */
  category: SuggestionCategory;
  /** Priority */
  priority: SuggestionPriority;
  /** Display title */
  title: string;
  /** Detailed description */
  description: string;
  /** Icon hint for UI */
  icon: string;
  /** Action type to execute */
  actionType: string;
  /** Action parameters */
  actionParams: Record<string, unknown>;
  /** Confidence 0-1 */
  confidence: number;
  /** Time relevance (seconds, -1 if not time-specific) */
  timeRelevance: number;
  /** Expiry timestamp (ms since epoch) */
  expiresAt: number;
}

export interface TimelineContext {
  /** Current playback time */
  currentTime: number;
  /** Selected clip IDs */
  selectedClipIds: string[];
  /** Zoom level */
  zoomLevel: number;
  /** Is playing */
  isPlaying: boolean;
  /** Active track ID */
  activeTrackId?: string;
  /** Recent actions (last N) */
  recentActions: string[];
}

export interface SuggestionConfig {
  /** Maximum suggestions to show */
  maxSuggestions: number;
  /** Minimum confidence threshold */
  minConfidence: number;
  /** Enable creative suggestions */
  enableCreative: boolean;
  /** Enable technical suggestions */
  enableTechnical: boolean;
  /** Suggestion expiry (ms) */
  expiryMs: number;
  /** Debounce interval (ms) */
  debounceMs: number;
}

export const DEFAULT_SUGGESTION_CONFIG: SuggestionConfig = {
  maxSuggestions: 5,
  minConfidence: 0.4,
  enableCreative: true,
  enableTechnical: true,
  expiryMs: 30000,
  debounceMs: 500,
};

// ==================== Analysis Functions ====================

/**
 * Detect if a transition would improve the cut between two clips.
 */
export function suggestTransition(
  prevClip: Clip | null,
  nextClip: Clip | null,
  currentTime: number,
): ContextualSuggestion | null {
  if (!prevClip || !nextClip) return null;

  const gap = nextClip.start - (prevClip.start + prevClip.duration);
  if (Math.abs(gap) > 0.5) return null; // Not adjacent

  // Check scene similarity via content analysis
  const prevScene = prevClip.contentAnalysis?.primarySceneType;
  const nextScene = nextClip.contentAnalysis?.primarySceneType;
  const sameScene = prevScene && nextScene && prevScene === nextScene;

  if (!sameScene) {
    return {
      id: `transition-${prevClip.id}-${nextClip.id}`,
      category: 'editing',
      priority: 'medium',
      title: '建议添加转场',
      description: '两个不同场景之间可以添加转场效果使过渡更平滑',
      icon: 'transition',
      actionType: 'add-transition',
      actionParams: { clipAId: prevClip.id, clipBId: nextClip.id, suggestedType: 'cross-dissolve' },
      confidence: 0.7,
      timeRelevance: round(currentTime),
      expiresAt: Date.now() + 30000,
    };
  }

  return null;
}

/**
 * Detect pacing issues (too fast or too slow).
 */
export function suggestPacingFix(
  timeline: Timeline,
  currentTime: number,
): ContextualSuggestion | null {
  if (timeline.tracks.length === 0) return null;

  const allClips = timeline.tracks.flatMap((t) => t.clips).sort((a, b) => a.start - b.start);
  if (allClips.length < 3) return null;

  // Find clips near current time
  const nearbyClips = allClips.filter(
    (c) => c.start >= currentTime - 15 && c.start <= currentTime + 15,
  );

  if (nearbyClips.length < 2) return null;

  // Calculate local CPM
  const windowStart = Math.max(0, currentTime - 15);
  const windowEnd = currentTime + 15;
  const cutsInRange = nearbyClips.filter(
    (c) => c.start >= windowStart && c.start < windowEnd,
  ).length;
  const localCpm = (cutsInRange / 30) * 60;

  if (localCpm > 40) {
    return {
      id: `pacing-fast-${Math.round(currentTime)}`,
      category: 'editing',
      priority: 'medium',
      title: '当前节奏偏快',
      description: `当前区域剪辑频率 ${Math.round(localCpm)} CPM，考虑延长片段时长或减少剪辑点`,
      icon: 'pacing-slow',
      actionType: 'suggest-pacing',
      actionParams: { region: 'current', cpm: round(localCpm), suggestion: 'slow-down' },
      confidence: 0.65,
      timeRelevance: round(currentTime),
      expiresAt: Date.now() + 30000,
    };
  }

  if (localCpm < 5) {
    return {
      id: `pacing-slow-${Math.round(currentTime)}`,
      category: 'editing',
      priority: 'low',
      title: '当前节奏偏慢',
      description: `当前区域剪辑频率 ${Math.round(localCpm)} CPM，考虑添加剪辑点或B-roll`,
      icon: 'pacing-fast',
      actionType: 'suggest-pacing',
      actionParams: { region: 'current', cpm: round(localCpm), suggestion: 'speed-up' },
      confidence: 0.6,
      timeRelevance: round(currentTime),
      expiresAt: Date.now() + 30000,
    };
  }

  return null;
}

/**
 * Suggest audio level adjustments based on analysis.
 */
export function suggestAudioFix(
  timeline: Timeline,
  currentTime: number,
): ContextualSuggestion | null {
  const audioClips = timeline.tracks
    .filter((t) => t.type === 'audio' || t.type === 'video')
    .flatMap((t) => t.clips)
    .filter((c): c is Extract<Clip, { type: 'audio' | 'video' }> =>
      c.type === 'audio' || c.type === 'video',
    );

  if (audioClips.length === 0) return null;

  // Find clip at current time
  const currentClip = audioClips.find(
    (c) => currentTime >= c.start && currentTime < c.start + c.duration,
  );

  if (!currentClip) return null;

  // Check for muted clip with high visual energy (likely needs audio)
  if (currentClip.muted) {
    return {
      id: `audio-muted-${currentClip.id}`,
      category: 'technical',
      priority: 'high',
      title: '片段已静音',
      description: '当前片段处于静音状态，如需保留声音请取消静音',
      icon: 'volume-off',
      actionType: 'unmute-clip',
      actionParams: { clipId: currentClip.id },
      confidence: 0.9,
      timeRelevance: round(currentTime),
      expiresAt: Date.now() + 30000,
    };
  }

  return null;
}

/**
 * Suggest content improvements based on clip analysis.
 */
export function suggestContentImprovement(
  clip: Clip,
  media: MediaAsset[],
  currentTime: number,
): ContextualSuggestion | null {
  if (clip.type !== 'video') return null;

  const mediaAsset = media.find((m) => m.id === (clip as { mediaId?: string }).mediaId);
  if (!mediaAsset) return null;

  // Suggest color grading if no color correction applied
  const hasColorCorrection = clip.colorCorrection &&
    (clip.colorCorrection.brightness !== 0 || clip.colorCorrection.contrast !== 0);

  if (!hasColorCorrection) {
    return {
      id: `color-${clip.id}`,
      category: 'creative',
      priority: 'low',
      title: '考虑添加色彩校正',
      description: '当前片段未应用色彩校正，可以提升画面质量',
      icon: 'palette',
      actionType: 'open-color-panel',
      actionParams: { clipId: clip.id },
      confidence: 0.5,
      timeRelevance: round(currentTime),
      expiresAt: Date.now() + 60000,
    };
  }

  return null;
}

/**
 * Suggest highlight marking for high-energy moments.
 */
export function suggestHighlightMark(
  clip: Clip,
  currentTime: number,
): ContextualSuggestion | null {
  // Check if clip has high motion type
  if (clip.motionType && clip.motionType.confidence > 0.7 &&
    (clip.motionType.type === 'handheld' || clip.motionType.type === 'zoom_in')) {
    return {
      id: `highlight-${clip.id}`,
      category: 'content',
      priority: 'medium',
      title: '高能量时刻',
      description: '检测到当前片段有较高的运动强度，可标记为高光',
      icon: 'star',
      actionType: 'mark-highlight',
      actionParams: { clipId: clip.id, time: currentTime },
      confidence: clip.motionType.confidence,
      timeRelevance: round(currentTime),
      expiresAt: Date.now() + 30000,
    };
  }

  return null;
}

// ==================== Main Entry ====================

/**
 * Generate contextual suggestions based on current timeline state.
 */
export function generateContextualSuggestions(
  timeline: Timeline,
  media: MediaAsset[],
  context: TimelineContext,
  config: Partial<SuggestionConfig> = {},
): ContextualSuggestion[] {
  const cfg = { ...DEFAULT_SUGGESTION_CONFIG, ...config };
  const suggestions: ContextualSuggestion[] = [];
  const { currentTime, selectedClipIds } = context;

  // Get all clips sorted by time
  const allClips = timeline.tracks
    .flatMap((t) => t.clips)
    .sort((a, b) => a.start - b.start);

  if (allClips.length === 0) return [];

  // Find clips at current time
  const clipAtPlayhead = allClips.find(
    (c) => currentTime >= c.start && currentTime < c.start + c.duration,
  );

  // Find adjacent clips
  const currentIdx = clipAtPlayhead ? allClips.indexOf(clipAtPlayhead) : -1;
  const prevClip = currentIdx > 0 ? allClips[currentIdx - 1] : null;
  const nextClip = currentIdx >= 0 && currentIdx < allClips.length - 1 ? allClips[currentIdx + 1] : null;

  // Transition suggestion
  const transitionSug = suggestTransition(prevClip, nextClip, currentTime);
  if (transitionSug) suggestions.push(transitionSug);

  // Pacing suggestion
  const pacingSug = suggestPacingFix(timeline, currentTime);
  if (pacingSug) suggestions.push(pacingSug);

  // Audio suggestion
  const audioSug = suggestAudioFix(timeline, currentTime);
  if (audioSug) suggestions.push(audioSug);

  // Content suggestions for selected clip
  if (clipAtPlayhead) {
    const contentSug = suggestContentImprovement(clipAtPlayhead, media, currentTime);
    if (contentSug && cfg.enableCreative) suggestions.push(contentSug);

    const highlightSug = suggestHighlightMark(clipAtPlayhead, currentTime);
    if (highlightSug) suggestions.push(highlightSug);
  }

  // Filter by confidence and sort
  return suggestions
    .filter((s) => s.confidence >= cfg.minConfidence)
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pDiff !== 0) return pDiff;
      return b.confidence - a.confidence;
    })
    .slice(0, cfg.maxSuggestions);
}

/**
 * Get contextual suggestion icon SVG path.
 */
export function getSuggestionIcon(category: SuggestionCategory): string {
  const icons: Record<SuggestionCategory, string> = {
    editing: 'M13 10V3L4 14h7v7l9-11h-7z', // lightning
    content: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z', // star
    technical: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z', // check
    creative: 'M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-1 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z', // palette
  };
  return icons[category];
}
