/**
 * Content-Aware Template Adaptation Engine
 *
 * Analyzes media assets (duration, visual complexity, audio features)
 * and automatically adapts EditingTemplate parameters to fit the content.
 *
 * Pipeline:
 * 1. Analyze media assets → MediaAnalysis
 * 2. Map analysis dimensions → adaptation adjustments
 * 3. Apply adjustments to template → TemplateAdaptationResult
 * 4. Convenience: one-step smart adaptation from project + template
 *
 * Design: pure functions, immutable operations, no classes.
 */

import type {
  EditingTemplate,
  TemplateClip,
  TemplateKeyframe,
  TemplateAudioLayout,
  TemplateAudioMix,
  TemplateTrack,
} from '../models/template-schema';
import type { Project, Clip, MediaAsset } from '../model-types';

// ─── Media Analysis ────────────────────────────────────────────────

/** Audio feature profile extracted from media */
export interface AudioFeatures {
  /** Average loudness in dB */
  avgLoudnessDb: number;
  /** Peak loudness in dB */
  peakLoudnessDb: number;
  /** Dynamic range (peak - average) in dB */
  dynamicRangeDb: number;
  /** Dominant frequency band: 'bass' | 'mid' | 'treble' */
  dominantBand: 'bass' | 'mid' | 'treble';
  /** Beat density: beats per second (0 if undetectable) */
  beatsPerSecond: number;
  /** Whether the audio contains speech */
  hasSpeech: boolean;
  /** Signal-to-noise ratio estimate in dB */
  snrDb: number;
}

/** Visual complexity metrics for a single frame or region */
export interface VisualComplexity {
  /** Edge density 0-1 (higher = more detail) */
  edgeDensity: number;
  /** Color variance 0-1 (higher = more colorful) */
  colorVariance: number;
  /** Motion estimate 0-1 (higher = more motion between frames) */
  motionIntensity: number;
  /** Overall complexity score 0-1 */
  overallScore: number;
}

/** Result of analyzing a media asset */
export interface MediaAnalysis {
  /** Source media asset ID */
  mediaId: string;
  /** Duration in seconds */
  durationSec: number;
  /** Resolution width */
  width: number;
  /** Resolution height */
  height: number;
  /** Frame rate (0 if unknown) */
  frameRate: number;
  /** Whether the asset has an audio track */
  hasAudio: boolean;
  /** Visual complexity metrics (null for audio-only) */
  visualComplexity: VisualComplexity | null;
  /** Audio features (null if no audio track) */
  audioFeatures: AudioFeatures | null;
}

// ─── Adaptation Result ─────────────────────────────────────────────

/** Describes a single adaptation change applied to a clip */
export interface AdaptationChange {
  /** Track name where the clip resides */
  trackName: string;
  /** Index of the clip within the track */
  clipIndex: number;
  /** What was adapted */
  field: 'durationSec' | 'speed' | 'opacity' | 'volume' | 'effectIntensity';
  /** Original value */
  originalValue: number;
  /** New value after adaptation */
  adaptedValue: number;
  /** Reason for the change */
  reason: string;
}

/** Describes an audio layout adaptation */
export interface AudioAdaptationChange {
  /** Role of the audio track */
  role: string;
  /** What was adapted */
  field: 'volumeDb' | 'fadeInSec' | 'fadeOutSec' | 'duckAttenuationDb' | 'masterLoudnessTarget';
  /** Original value */
  originalValue: number;
  /** New value after adaptation */
  adaptedValue: number;
  /** Reason for the change */
  reason: string;
}

/** Complete result of template adaptation */
export interface TemplateAdaptationResult {
  /** The adapted template (immutable copy) */
  template: EditingTemplate;
  /** Summary of clip-level changes */
  clipChanges: AdaptationChange[];
  /** Summary of audio layout changes */
  audioChanges: AudioAdaptationChange[];
  /** Total duration after adaptation in seconds */
  adaptedDurationSec: number;
  /** Human-readable summary */
  summary: string;
}

// ─── Analysis Constants ────────────────────────────────────────────

const COMPLEXITY_THRESHOLDS = {
  low: 0.3,
  medium: 0.6,
  high: 0.85,
} as const;

const DURATION_RATIO = {
  minScale: 0.5,
  maxScale: 2.0,
} as const;

const EFFECT_SCALE = {
  /** At low complexity, effects scale to this factor */
  lowComplexity: 0.4,
  /** At medium complexity, effects stay at 1.0 */
  mediumComplexity: 1.0,
  /** At high complexity, effects reduce to avoid visual noise */
  highComplexity: 0.75,
} as const;

// ─── Media Analysis ────────────────────────────────────────────────

/**
 * Analyze a single media asset and extract content features.
 * Uses available metadata; visual/audio heuristics are estimated from properties.
 *
 * @param media - The media asset to analyze
 * @returns Analysis result with duration, visual complexity, and audio features
 */
export function analyzeMedia(media: MediaAsset): MediaAnalysis {
  const hasAudio = media.hasAudio === true || media.type === 'audio';

  return {
    mediaId: media.id,
    durationSec: media.duration,
    width: media.width,
    height: media.height,
    frameRate: media.frameRate ?? 0,
    hasAudio,
    visualComplexity: media.type !== 'audio' ? estimateVisualComplexity(media) : null,
    audioFeatures: hasAudio ? estimateAudioFeatures(media) : null,
  };
}

/**
 * Analyze multiple media assets and return individual analyses.
 *
 * @param mediaAssets - Array of media assets
 * @returns Array of analysis results
 */
export function analyzeMediaBatch(mediaAssets: readonly MediaAsset[]): readonly MediaAnalysis[] {
  return mediaAssets.map(analyzeMedia);
}

// ─── Template Adaptation ───────────────────────────────────────────

/**
 * Adapt a template to fit the analyzed media content.
 *
 * Adjustments:
 * - **Duration**: scales clip durations so the total matches the media duration,
 *   respecting flexible vs fixed clips.
 * - **Visual complexity**: adjusts effect intensity — reduces for complex footage
 *   (avoid visual noise) and for simple footage (avoid over-processing).
 * - **Audio features**: adjusts audio layout volumes and dynamics to match
 *   the source audio's loudness profile.
 *
 * @param template - The source template to adapt
 * @param analysis - Media analysis result (typically the primary video asset)
 * @returns Adaptation result with adapted template and change log
 */
export function adaptTemplateToContent(
  template: EditingTemplate,
  analysis: MediaAnalysis,
): TemplateAdaptationResult {
  const clipChanges: AdaptationChange[] = [];
  const audioChanges: AudioAdaptationChange[] = [];

  // Step 1: Duration adaptation
  const { tracks: durationTracks, changes: durationChanges } = adaptDurations(
    template.tracks,
    analysis.durationSec,
  );
  clipChanges.push(...durationChanges);

  // Step 2: Visual complexity adaptation
  const { tracks: visualTracks, changes: visualChanges } = adaptVisualEffects(
    durationTracks,
    analysis.visualComplexity,
  );
  clipChanges.push(...visualChanges);

  // Step 3: Audio adaptation
  const { audioLayout: adaptedAudio, changes: audioLayoutChanges } = adaptAudioLayout(
    template.audioLayout,
    analysis.audioFeatures,
    analysis.durationSec,
  );
  audioChanges.push(...audioLayoutChanges);

  const adaptedTemplate: EditingTemplate = {
    ...template,
    tracks: visualTracks,
    audioLayout: adaptedAudio,
    metadata: {
      ...template.metadata,
      estimatedDurationSec: analysis.durationSec,
      updatedAt: new Date().toISOString(),
    },
  };

  const totalChanges = clipChanges.length + audioChanges.length;

  return {
    template: adaptedTemplate,
    clipChanges,
    audioChanges,
    adaptedDurationSec: analysis.durationSec,
    summary: buildSummary(analysis, totalChanges, clipChanges.length, audioChanges.length),
  };
}

// ─── Smart Adaptation ──────────────────────────────────────────────

/**
 * One-click smart adaptation: analyzes the primary video media in the project
 * and adapts the template to fit it.
 *
 * Selects the first video asset as the primary reference. If no video asset
 * exists, falls back to the first audio asset. Returns null if no media exists.
 *
 * @param project - The project containing media assets
 * @param template - The template to adapt
 * @returns Adaptation result, or null if no suitable media found
 */
export function createSmartAdaptation(
  project: Project,
  template: EditingTemplate,
): TemplateAdaptationResult | null {
  const primaryMedia = selectPrimaryMedia(project.media);
  if (!primaryMedia) return null;

  const analysis = analyzeMedia(primaryMedia);
  return adaptTemplateToContent(template, analysis);
}

// ─── Duration Adaptation ───────────────────────────────────────────

interface DurationAdaptResult {
  tracks: readonly TemplateTrack[];
  changes: AdaptationChange[];
}

function adaptDurations(
  tracks: readonly TemplateTrack[],
  targetDurationSec: number,
): DurationAdaptResult {
  const changes: AdaptationChange[] = [];

  // Calculate current total duration from flexible clips
  const totalFlexibleDuration = tracks.reduce((sum, track) => {
    return sum + track.clips
      .filter((c) => c.flexibleDuration)
      .reduce((s, c) => s + c.durationSec, 0);
  }, 0);

  if (totalFlexibleDuration <= 0) {
    return { tracks, changes };
  }

  const scaleFactor = clamp(
    targetDurationSec / totalFlexibleDuration,
    DURATION_RATIO.minScale,
    DURATION_RATIO.maxScale,
  );

  const adaptedTracks = tracks.map((track) => {
    const adaptedClips = track.clips.map((clip, index) => {
      if (!clip.flexibleDuration) return clip;

      const newDuration = round2(clip.durationSec * scaleFactor);
      if (Math.abs(newDuration - clip.durationSec) < 0.01) return clip;

      changes.push({
        trackName: track.name,
        clipIndex: index,
        field: 'durationSec',
        originalValue: clip.durationSec,
        adaptedValue: newDuration,
        reason: `Duration scaled by ${scaleFactor.toFixed(2)}x to fit ${targetDurationSec.toFixed(1)}s content`,
      });

      return { ...clip, durationSec: newDuration };
    });

    return { ...track, clips: adaptedClips };
  });

  return { tracks: adaptedTracks, changes };
}

// ─── Visual Complexity Adaptation ──────────────────────────────────

interface VisualAdaptResult {
  tracks: readonly TemplateTrack[];
  changes: AdaptationChange[];
}

function adaptVisualEffects(
  tracks: readonly TemplateTrack[],
  complexity: VisualComplexity | null,
): VisualAdaptResult {
  if (!complexity) return { tracks, changes: [] };

  const changes: AdaptationChange[] = [];
  const effectFactor = computeEffectScaleFactor(complexity.overallScore);

  // No adjustment needed if factor is ~1.0
  if (Math.abs(effectFactor - 1.0) < 0.05) {
    return { tracks, changes };
  }

  const adaptedTracks = tracks.map((track) => {
    const adaptedClips = track.clips.map((clip, clipIndex) => {
      if (clip.effects.length === 0) return clip;

      const adaptedEffects = clip.effects.map((effect) => ({
        ...effect,
        params: scaleEffectParams(effect.params, effectFactor),
      }));

      changes.push({
        trackName: track.name,
        clipIndex,
        field: 'effectIntensity',
        originalValue: 1.0,
        adaptedValue: effectFactor,
        reason: describeComplexityAdjustment(complexity.overallScore, effectFactor),
      });

      return { ...clip, effects: adaptedEffects };
    });

    return { ...track, clips: adaptedClips };
  });

  return { tracks: adaptedTracks, changes };
}

function computeEffectScaleFactor(complexityScore: number): number {
  if (complexityScore < COMPLEXITY_THRESHOLDS.low) {
    return EFFECT_SCALE.lowComplexity;
  }
  if (complexityScore < COMPLEXITY_THRESHOLDS.medium) {
    return EFFECT_SCALE.mediumComplexity;
  }
  if (complexityScore < COMPLEXITY_THRESHOLDS.high) {
    // Linear interpolation between medium and high
    const t = (complexityScore - COMPLEXITY_THRESHOLDS.medium) /
      (COMPLEXITY_THRESHOLDS.high - COMPLEXITY_THRESHOLDS.medium);
    return lerp(EFFECT_SCALE.mediumComplexity, EFFECT_SCALE.highComplexity, t);
  }
  return EFFECT_SCALE.highComplexity;
}

function describeComplexityAdjustment(score: number, factor: number): string {
  if (score < COMPLEXITY_THRESHOLDS.low) {
    return `Simple footage (score ${score.toFixed(2)}): reduced effects to ${factor.toFixed(2)}x to avoid over-processing`;
  }
  if (score > COMPLEXITY_THRESHOLDS.high) {
    return `Complex footage (score ${score.toFixed(2)}): reduced effects to ${factor.toFixed(2)}x to avoid visual noise`;
  }
  return `Moderate footage (score ${score.toFixed(2)}): adjusted effects to ${factor.toFixed(2)}x`;
}

function scaleEffectParams(
  params: Record<string, number | string>,
  factor: number,
): Record<string, number | string> {
  const scaled: Record<string, number | string> = {};
  for (const [key, value] of Object.entries(params)) {
    scaled[key] = typeof value === 'number' ? round2(value * factor) : value;
  }
  return scaled;
}

// ─── Audio Layout Adaptation ───────────────────────────────────────

interface AudioAdaptResult {
  audioLayout: TemplateAudioLayout;
  changes: AudioAdaptationChange[];
}

function adaptAudioLayout(
  layout: TemplateAudioLayout,
  audioFeatures: AudioFeatures | null,
  durationSec: number,
): AudioAdaptResult {
  if (!audioFeatures) {
    return { audioLayout: layout, changes: [] };
  }

  const changes: AudioAdaptationChange[] = [];

  // Adapt track volumes based on source loudness
  const adaptedTracks = layout.tracks.map((track) => adaptAudioTrack(track, audioFeatures, changes));

  // Adapt master loudness target based on dynamic range
  const targetLoudness = computeMasterLoudness(audioFeatures);
  let masterLoudnessTarget = layout.masterLoudnessTarget;

  if (Math.abs(targetLoudness - masterLoudnessTarget) > 1) {
    changes.push({
      role: 'master',
      field: 'masterLoudnessTarget',
      originalValue: masterLoudnessTarget,
      adaptedValue: targetLoudness,
      reason: `Adjusted master target from ${masterLoudnessTarget} to ${targetLoudness} LUFS based on source dynamic range ${audioFeatures.dynamicRangeDb.toFixed(1)} dB`,
    });
    masterLoudnessTarget = targetLoudness;
  }

  return {
    audioLayout: {
      ...layout,
      tracks: adaptedTracks,
      masterLoudnessTarget,
    },
    changes,
  };
}

function adaptAudioTrack(
  track: TemplateAudioMix,
  features: AudioFeatures,
  changes: AudioAdaptationChange[],
): TemplateAudioMix {
  let adapted = { ...track };

  // Adjust voice track volume to match source loudness
  if (track.role === 'voice' && features.hasSpeech) {
    const targetVol = clamp(features.avgLoudnessDb, -24, -6);
    if (Math.abs(targetVol - track.volumeDb) > 2) {
      changes.push({
        role: 'voice',
        field: 'volumeDb',
        originalValue: track.volumeDb,
        adaptedValue: targetVol,
        reason: `Voice volume adjusted to ${targetVol} dB to match source speech loudness`,
      });
      adapted = { ...adapted, volumeDb: targetVol };
    }
  }

  // Adjust music ducking based on speech presence
  if (track.role === 'music' && features.hasSpeech) {
    const targetDuck = features.dynamicRangeDb > 15 ? 12 : 8;
    if (track.duckAttenuationDb !== undefined &&
        Math.abs(targetDuck - track.duckAttenuationDb) > 1) {
      changes.push({
        role: 'music',
        field: 'duckAttenuationDb',
        originalValue: track.duckAttenuationDb,
        adaptedValue: targetDuck,
        reason: `Music ducking increased to ${targetDuck} dB for clear speech`,
      });
      adapted = { ...adapted, duckAttenuationDb: targetDuck };
    }
  }

  // Adjust fade durations based on beat density
  if (features.beatsPerSecond > 0) {
    const beatInterval = 1 / features.beatsPerSecond;
    const targetFade = round2(Math.min(beatInterval * 0.5, 2.0));

    if (Math.abs(targetFade - track.fadeInSec) > 0.3) {
      changes.push({
        role: track.role,
        field: 'fadeInSec',
        originalValue: track.fadeInSec,
        adaptedValue: targetFade,
        reason: `Fade-in aligned to beat interval (${beatInterval.toFixed(2)}s)`,
      });
      adapted = { ...adapted, fadeInSec: targetFade };
    }

    if (Math.abs(targetFade - track.fadeOutSec) > 0.3) {
      changes.push({
        role: track.role,
        field: 'fadeOutSec',
        originalValue: track.fadeOutSec,
        adaptedValue: targetFade,
        reason: `Fade-out aligned to beat interval (${beatInterval.toFixed(2)}s)`,
      });
      adapted = { ...adapted, fadeOutSec: targetFade };
    }
  }

  return adapted;
}

function computeMasterLoudness(features: AudioFeatures): number {
  // Wide dynamic range → more headroom needed → lower target
  if (features.dynamicRangeDb > 20) return -16;
  if (features.dynamicRangeDb > 12) return -14;
  // Tight dynamics (pop music, podcasts) → louder target
  return -12;
}

// ─── Helpers ───────────────────────────────────────────────────────

function estimateVisualComplexity(media: MediaAsset): VisualComplexity {
  // Heuristic estimation based on resolution and codec
  const pixels = media.width * media.height;
  const resolutionFactor = clamp(pixels / (3840 * 2160), 0, 1);

  // Higher resolution tends to have more detail
  const edgeDensity = clamp(resolutionFactor * 0.6 + 0.2, 0, 1);

  // Estimate motion from frame rate
  const fps = media.frameRate ?? 30;
  const motionIntensity = clamp((fps - 15) / 45, 0.1, 0.9);

  // Color variance heuristic: higher for video, moderate for image
  const colorVariance = media.type === 'video' ? 0.5 : 0.3;

  const overallScore = edgeDensity * 0.4 + colorVariance * 0.3 + motionIntensity * 0.3;

  return {
    edgeDensity: round2(edgeDensity),
    colorVariance: round2(colorVariance),
    motionIntensity: round2(motionIntensity),
    overallScore: round2(overallScore),
  };
}

function estimateAudioFeatures(media: MediaAsset): AudioFeatures {
  // Heuristic estimation from metadata
  const sampleRate = media.audioSampleRate ?? 44100;
  const channels = media.audioChannels ?? 2;

  // Higher sample rate suggests higher quality audio with more treble content
  const dominantBand: AudioFeatures['dominantBand'] =
    sampleRate >= 48000 ? 'treble' : sampleRate >= 44100 ? 'mid' : 'bass';

  return {
    avgLoudnessDb: -14,
    peakLoudnessDb: -3,
    dynamicRangeDb: 11,
    dominantBand,
    beatsPerSecond: 0,
    hasSpeech: false,
    snrDb: channels >= 2 ? 30 : 20,
  };
}

function selectPrimaryMedia(mediaAssets: readonly MediaAsset[]): MediaAsset | null {
  if (mediaAssets.length === 0) return null;

  // Prefer video, then image, then audio
  const video = mediaAssets.find((m) => m.type === 'video' && !m.missing);
  if (video) return video;

  const image = mediaAssets.find((m) => m.type === 'image' && !m.missing);
  if (image) return image;

  const audio = mediaAssets.find((m) => m.type === 'audio' && !m.missing);
  if (audio) return audio;

  return null;
}

function buildSummary(
  analysis: MediaAnalysis,
  totalChanges: number,
  clipChanges: number,
  audioChanges: number,
): string {
  const durationStr = analysis.durationSec.toFixed(1);
  const complexityStr = analysis.visualComplexity
    ? `complexity ${(analysis.visualComplexity.overallScore * 100).toFixed(0)}%`
    : 'no visual';

  if (totalChanges === 0) {
    return `No adaptation needed for ${durationStr}s content (${complexityStr})`;
  }

  return `Adapted to ${durationStr}s content (${complexityStr}): ` +
    `${clipChanges} clip adjustment(s), ${audioChanges} audio adjustment(s)`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
