/**
 * Style Template Engine
 *
 * Bridges the style-analyzer (StyleFingerprint) and template-schema (EditingTemplate).
 * Extracts "style fingerprints" from projects and maps them into reusable templates.
 *
 * Pipeline:
 * 1. Analyze project → StyleFingerprint (via style-analyzer)
 * 2. Map fingerprint dimensions → template parameters
 * 3. Generate EditingTemplate with style-informed defaults
 * 4. User can customize variables before saving
 */

import type {
  EditingTemplate,
  TemplateMetadata,
  TemplateTrack,
  TemplateClip,
  TemplateTransition,
  TemplateColorNode,
  TemplateAudioMix,
  TemplateAudioLayout,
  TemplateKeyframe,
  TemplateVariable,
  TemplateCategory,
} from '../models/template-schema';
import { TEMPLATE_SCHEMA_VERSION, validateTemplate } from '../models/template-schema';
import type {
  StyleFingerprint,
  StyleRhythmProfile,
  ColorGradingStyle,
  AudioProcessingStyle,
  StyleTransitionPreference,
  EffectUsagePattern,
} from './style-analyzer';
import { extractProjectStyle, mergeStyleFingerprints } from './style-analyzer';
import type { Project, Timeline, Track, Clip, TransitionType } from '../model-types';
import type { EffectType } from '../effects';

// ─── Style-to-Template Mapping ───────────────────────────────────

/** Map style rhythm to template track structure */
function mapRhythmToTracks(
  rhythm: StyleRhythmProfile,
  category: TemplateCategory,
): { trackCount: number; avgClipDuration: number; transitionDensity: number } {
  const avgClipDuration = rhythm.avgClipDurationSec;
  const cutsPerMin = rhythm.cutsPerMinute;

  // Determine transition density from rhythm
  const transitionDensity = cutsPerMin > 15 ? 0.8 : cutsPerMin > 8 ? 0.5 : 0.2;

  // Track count based on category and complexity
  let trackCount = 2; // default: 1 video + 1 audio
  if (category === 'tutorial') trackCount = 3; // video + text + audio
  if (category === 'product-demo') trackCount = 4; // main + overlay + text + audio

  return { trackCount, avgClipDuration, transitionDensity };
}

/** Map color grading style to template color nodes */
function mapColorToNodes(color: ColorGradingStyle): TemplateColorNode[] {
  const nodes: TemplateColorNode[] = [];

  // Brightness/contrast node
  if (color.brightness.count > 0) {
    nodes.push({
      type: 'brightness-contrast',
      params: {
        brightness: color.brightness.mean,
        contrast: color.contrast.mean,
      },
      enabled: true,
      order: 1,
    });
  }

  // Saturation node
  if (color.saturation.count > 0) {
    nodes.push({
      type: 'saturation',
      params: { saturation: color.saturation.mean },
      enabled: true,
      order: 2,
    });
  }

  // Hue shift node
  if (color.hue.count > 0 && Math.abs(color.hue.mean) > 2) {
    nodes.push({
      type: 'hue',
      params: { hueShift: color.hue.mean },
      enabled: true,
      order: 3,
    });
  }

  // LUT node
  if (color.preferredLutPath && color.lutUsageRatio > 0.3) {
    nodes.push({
      type: 'lut',
      params: { path: color.preferredLutPath, intensity: color.lutUsageRatio },
      enabled: true,
      order: 4,
    });
  }

  return nodes;
}

/** Map audio processing style to template audio layout */
function mapAudioToLayout(audio: AudioProcessingStyle): TemplateAudioLayout {
  const tracks: TemplateAudioMix[] = [
    {
      role: 'voice',
      volumeDb: audio.avgTargetLoudness,
      pan: 0,
      fadeInSec: audio.avgFadeInSec,
      fadeOutSec: audio.avgFadeOutSec,
    },
    {
      role: 'music',
      volumeDb: audio.avgTargetLoudness - 12, // music under voice
      pan: 0,
      fadeInSec: audio.avgFadeInSec * 1.5,
      fadeOutSec: audio.avgFadeOutSec * 1.5,
      duckTarget: 'voice',
      duckAttenuationDb: 8,
    },
  ];

  return {
    tracks,
    masterLoudnessTarget: -14,
    masterLimiter: true,
  };
}

/** Map transition preferences to template transitions */
function mapTransitions(
  transitions: StyleTransitionPreference[],
  clipCount: number,
  transitionDensity: number,
): TemplateTransition[] {
  if (transitions.length === 0) return [];

  const topTransition = transitions[0];
  const templateTransitions: TemplateTransition[] = [];

  // Apply transition density: decide how many clips get transitions
  const transitionCount = Math.round(clipCount * transitionDensity);

  for (let i = 0; i < transitionCount; i++) {
    templateTransitions.push({
      type: topTransition.type,
      durationSec: topTransition.avgDurationSec,
    });
  }

  return templateTransitions;
}

/** Map effect patterns to clip effects */
function mapEffectsToClip(effects: EffectUsagePattern[]): TemplateClip['effects'] {
  return effects.slice(0, 3).map((e) => ({
    type: e.type,
    params: e.avgParams,
    enabled: e.typicallyEnabled,
  }));
}

// ─── Template Generation from Style ──────────────────────────────

/**
 * Generate an EditingTemplate from a StyleFingerprint.
 * The resulting template captures the style's characteristics as reusable defaults.
 */
export function generateTemplateFromStyle(
  fingerprint: StyleFingerprint,
  options?: {
    category?: TemplateCategory;
    name?: string;
    description?: string;
    totalDurationSec?: number;
    aspectRatio?: string;
    resolutionWidth?: number;
    resolutionHeight?: number;
    frameRate?: number;
  },
): EditingTemplate {
  const category = options?.category ?? inferCategory(fingerprint);
  const totalDuration = options?.totalDurationSec ?? 60;
  const { trackCount, avgClipDuration, transitionDensity } = mapRhythmToTracks(
    fingerprint.rhythm,
    category,
  );

  const clipCount = Math.max(3, Math.round(totalDuration / Math.max(avgClipDuration, 1)));
  const actualClipDuration = totalDuration / clipCount;

  // Generate video track clips
  const videoClips: TemplateClip[] = Array.from({ length: clipCount }, (_, i) => ({
    type: 'video' as const,
    durationSec: actualClipDuration,
    flexibleDuration: true,
    placeholder: 'user-video' as const,
    placeholderParams: {},
    effects: i === 0 ? mapEffectsToClip(fingerprint.effects) : [],
    keyframes: generateDefaultKeyframes(actualClipDuration, fingerprint.rhythm),
    colorNodes: i === 0 ? mapColorToNodes(fingerprint.colorGrading) : [],
    opacity: 1,
    speed: 1,
    volume: 1,
  }));

  // Generate transitions
  const transitions = mapTransitions(
    fingerprint.transitions,
    clipCount,
    transitionDensity,
  );

  // Build tracks
  const tracks: TemplateTrack[] = [
    {
      type: 'video',
      name: 'Main Video',
      clips: videoClips,
      transitions,
      trackEffects: [],
      muted: false,
      locked: false,
    },
  ];

  // Add text track for tutorials
  if (category === 'tutorial') {
    tracks.push({
      type: 'text',
      name: 'Captions',
      clips: Array.from({ length: Math.ceil(clipCount / 2) }, () => ({
        type: 'text' as const,
        durationSec: actualClipDuration * 2,
        flexibleDuration: true,
        placeholder: 'generated-text' as const,
        placeholderParams: { text: '{{caption}}', fontSize: 48, color: '#FFFFFF' },
        effects: [],
        keyframes: [],
        colorNodes: [],
        opacity: 1,
        speed: 1,
        volume: 0,
      })),
      transitions: [],
      trackEffects: [],
      muted: false,
      locked: false,
    });
  }

  // Audio layout from style
  const audioLayout = mapAudioToLayout(fingerprint.audioProcessing);

  // Generate variables
  const variables = generateVariables(category, fingerprint);

  const now = new Date().toISOString();
  const metadata: TemplateMetadata = {
    id: `style-tpl-${fingerprint.id}`,
    version: TEMPLATE_SCHEMA_VERSION,
    name: options?.name ?? `${fingerprint.name} Style`,
    description: options?.description ?? `Template derived from style fingerprint: ${fingerprint.tags.join(', ')}`,
    category,
    tags: [...fingerprint.tags, 'style-derived'],
    author: 'Style Analyzer',
    createdAt: now,
    updatedAt: now,
    aspectRatio: options?.aspectRatio ?? '16:9',
    resolutionWidth: options?.resolutionWidth ?? 1920,
    resolutionHeight: options?.resolutionHeight ?? 1080,
    frameRate: options?.frameRate ?? 30,
    estimatedDurationSec: totalDuration,
    difficulty: 'intermediate',
  };

  return {
    metadata,
    tracks,
    audioLayout,
    globalColorNodes: mapColorToNodes(fingerprint.colorGrading),
    variables,
    sourceStyleId: fingerprint.id,
  };
}

// ─── Project to Template ─────────────────────────────────────────

/**
 * Extract a template directly from a project.
 * Convenience wrapper combining style extraction + template generation.
 */
export function saveProjectAsTemplate(
  project: Project,
  options?: {
    name?: string;
    description?: string;
    category?: TemplateCategory;
  },
): EditingTemplate | null {
  const fingerprint = extractProjectStyle(project);
  if (!fingerprint) return null;

  const template = generateTemplateFromStyle(fingerprint, {
    ...options,
    totalDurationSec: project.timeline.tracks
      .flatMap((t) => t.clips)
      .reduce((sum, c) => sum + c.duration, 0),
  });

  return template;
}

// ─── Template Application ────────────────────────────────────────

/**
 * Resolve template variables with user-provided values.
 */
export function resolveTemplateVariables(
  template: EditingTemplate,
  values: Record<string, string | number>,
): EditingTemplate {
  const resolved = JSON.parse(JSON.stringify(template)) as EditingTemplate;

  for (const variable of resolved.variables) {
    const value = values[variable.id] ?? variable.defaultValue;
    // Replace {{variableId}} placeholders in string fields
    resolved.tracks = JSON.parse(
      replacePlaceholders(JSON.stringify(resolved.tracks), variable.id, String(value)),
    ) as TemplateTrack[];
  }

  return resolved;
}

// ─── Helpers ─────────────────────────────────────────────────────

function inferCategory(fp: StyleFingerprint): TemplateCategory {
  if (fp.rhythm.cutsPerMinute > 15 && fp.rhythm.shortClipRatio > 0.4) return 'vlog';
  if (fp.rhythm.cutsPerMinute < 5 && fp.rhythm.longClipRatio > 0.5) return 'documentary';
  if (fp.rhythm.avgClipDurationSec > 5 && fp.rhythm.cutsPerMinute < 8) return 'tutorial';
  return 'custom';
}

function generateDefaultKeyframes(
  _durationSec: number,
  rhythm: StyleRhythmProfile,
): TemplateKeyframe[] {
  const keyframes: TemplateKeyframe[] = [];

  // Add fade-in keyframe for slow-paced content
  if (rhythm.cutsPerMinute < 10) {
    keyframes.push({
      normalizedTime: 0,
      property: 'opacity',
      value: 0,
      interpolation: 'ease-out',
    });
    keyframes.push({
      normalizedTime: 0.1,
      property: 'opacity',
      value: 1,
      interpolation: 'ease-out',
    });
  }

  return keyframes;
}

function generateVariables(
  category: TemplateCategory,
  fingerprint: StyleFingerprint,
): TemplateVariable[] {
  const vars: TemplateVariable[] = [
    {
      id: 'title',
      label: 'Title Text',
      type: 'text',
      defaultValue: 'My Video',
      description: 'Main title displayed in the template',
    },
    {
      id: 'accentColor',
      label: 'Accent Color',
      type: 'color',
      defaultValue: fingerprint.colorGrading.temperatureTendency === 'warm' ? '#FF6B35' : '#4A90D9',
      description: 'Primary accent color for text and overlays',
    },
  ];

  if (category === 'tutorial') {
    vars.push({
      id: 'caption',
      label: 'Caption Text',
      type: 'text',
      defaultValue: 'Enter your caption here',
      description: 'Text overlay caption',
    });
  }

  return vars;
}

function replacePlaceholders(
  text: string,
  varId: string,
  value: string,
): string {
  return text.replace(new RegExp(`\\{\\{${escapeRegExp(varId)}\\}\\}`, 'g'), value);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
