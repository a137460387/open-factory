/**
 * Template Schema - Vertical Scene Deep Templates
 *
 * Defines the data structure for reusable editing templates.
 * Templates capture timeline structure, clip properties, keyframes,
 * color grading nodes, and audio mixer parameters.
 *
 * .oft (Open Factory Template) file format is JSON-based.
 */

import type { TransitionType, ClipType, TrackType } from '../model-types';
import type { EffectType, EffectParams } from '../effects';

// ─── Template Version ────────────────────────────────────────────

export const TEMPLATE_SCHEMA_VERSION = '1.0' as const;
export const TEMPLATE_FILE_EXTENSION = '.oft' as const;

// ─── Template Categories ─────────────────────────────────────────

export type TemplateCategory =
  | 'vlog'
  | 'tutorial'
  | 'product-demo'
  | 'music-video'
  | 'documentary'
  | 'short-form'
  | 'custom';

// ─── Keyframe ────────────────────────────────────────────────────

export interface TemplateKeyframe {
  /** Normalized time position 0-1 within the clip */
  normalizedTime: number;
  /** Property being animated */
  property: string;
  /** Keyframe value */
  value: number;
  /** Interpolation type */
  interpolation: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'hold';
}

// ─── Color Grading Node ──────────────────────────────────────────

export interface TemplateColorNode {
  /** Node type */
  type: 'brightness-contrast' | 'saturation' | 'hue' | 'curves' | 'lut' | 'color-wheel';
  /** Node parameters */
  params: Record<string, number | string>;
  /** Whether node is enabled by default */
  enabled: boolean;
  /** Processing order */
  order: number;
}

// ─── Audio Mixer Parameters ──────────────────────────────────────

export interface TemplateAudioMix {
  /** Track role identifier */
  role: 'voice' | 'music' | 'sfx' | 'ambient';
  /** Volume in dB */
  volumeDb: number;
  /** Pan -1 (left) to 1 (right) */
  pan: number;
  /** Fade in duration in seconds */
  fadeInSec: number;
  /** Fade out duration in seconds */
  fadeOutSec: number;
  /** EQ preset name */
  eqPreset?: string;
  /** Ducking target role */
  duckTarget?: string;
  /** Ducking attenuation in dB */
  duckAttenuationDb?: number;
}

// ─── Clip Template ───────────────────────────────────────────────

export interface TemplateClip {
  /** Clip type */
  type: ClipType;
  /** Duration in seconds (or ratio of total for flexible sizing) */
  durationSec: number;
  /** If true, durationSec is treated as ratio of template total duration */
  flexibleDuration: boolean;
  /** Source placeholder type */
  placeholder: 'user-video' | 'user-image' | 'user-audio' | 'generated-text' | 'solid-color' | 'gradient';
  /** Placeholder default params (color, text content, etc.) */
  placeholderParams: Record<string, string | number>;
  /** Effects to apply */
  effects: Array<{
    type: EffectType;
    params: EffectParams;
    enabled: boolean;
  }>;
  /** Keyframes for this clip */
  keyframes: TemplateKeyframe[];
  /** Color grading nodes */
  colorNodes: TemplateColorNode[];
  /** Opacity 0-1 */
  opacity: number;
  /** Speed multiplier */
  speed: number;
  /** Volume 0-1 for audio clips */
  volume: number;
}

// ─── Transition Template ─────────────────────────────────────────

export interface TemplateTransition {
  /** Transition type */
  type: TransitionType;
  /** Duration in seconds */
  durationSec: number;
}

// ─── Track Template ──────────────────────────────────────────────

export interface TemplateTrack {
  /** Track type */
  type: TrackType;
  /** Track name / role */
  name: string;
  /** Clips in this track */
  clips: TemplateClip[];
  /** Transitions between clips */
  transitions: TemplateTransition[];
  /** Track-level effects */
  trackEffects: Array<{
    type: EffectType;
    params: EffectParams;
    enabled: boolean;
  }>;
  /** Track is muted by default */
  muted: boolean;
  /** Track is locked by default */
  locked: boolean;
}

// ─── Audio Mix Layout ────────────────────────────────────────────

export interface TemplateAudioLayout {
  /** Track role mixes */
  tracks: TemplateAudioMix[];
  /** Master loudness target in LUFS */
  masterLoudnessTarget: number;
  /** Master limiter enabled */
  masterLimiter: boolean;
}

// ─── Template Metadata ───────────────────────────────────────────

export interface TemplateMetadata {
  /** Template unique ID */
  id: string;
  /** Template schema version */
  version: typeof TEMPLATE_SCHEMA_VERSION;
  /** Human-readable name */
  name: string;
  /** Template description */
  description: string;
  /** Template category */
  category: TemplateCategory;
  /** Tags for search/discovery */
  tags: string[];
  /** Author name */
  author: string;
  /** Creation timestamp ISO */
  createdAt: string;
  /** Last update timestamp ISO */
  updatedAt: string;
  /** Thumbnail data URL or path */
  thumbnail?: string;
  /** Target aspect ratio (e.g., '16:9', '9:16', '1:1') */
  aspectRatio: string;
  /** Target resolution width */
  resolutionWidth: number;
  /** Target resolution height */
  resolutionHeight: number;
  /** Target frame rate */
  frameRate: number;
  /** Estimated total duration in seconds */
  estimatedDurationSec: number;
  /** Difficulty level */
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

// ─── Complete Template ───────────────────────────────────────────

export interface EditingTemplate {
  /** Template metadata */
  metadata: TemplateMetadata;
  /** Timeline tracks */
  tracks: TemplateTrack[];
  /** Audio mix layout */
  audioLayout: TemplateAudioLayout;
  /** Global color grading applied to output */
  globalColorNodes: TemplateColorNode[];
  /** Template-level variables that users can customize */
  variables: TemplateVariable[];
  /** Style fingerprint ID if derived from a style */
  sourceStyleId?: string;
}

// ─── Template Variables ──────────────────────────────────────────

export type TemplateVariableType = 'text' | 'color' | 'number' | 'duration' | 'media';

export interface TemplateVariable {
  /** Variable ID (referenced in template as {{variableId}}) */
  id: string;
  /** Display label */
  label: string;
  /** Variable type */
  type: TemplateVariableType;
  /** Default value */
  defaultValue: string | number;
  /** Min value (for number/duration) */
  min?: number;
  /** Max value (for number/duration) */
  max?: number;
  /** Description for user */
  description?: string;
}

// ─── Template File (.oft) ────────────────────────────────────────

export interface OftFile {
  /** File format identifier */
  format: 'open-factory-template';
  /** Schema version */
  schemaVersion: typeof TEMPLATE_SCHEMA_VERSION;
  /** The template data */
  template: EditingTemplate;
  /** File checksum for integrity verification */
  checksum: string;
}

// ─── Template Library Entry ──────────────────────────────────────

export interface TemplateLibraryEntry {
  /** Template data */
  template: EditingTemplate;
  /** Whether this is a built-in template */
  builtin: boolean;
  /** Whether this is a user-created template */
  userCreated: boolean;
  /** Usage count */
  usageCount: number;
  /** Last used timestamp */
  lastUsedAt?: string;
}

// ─── Template Search/Filter ──────────────────────────────────────

export interface TemplateFilter {
  /** Filter by category */
  category?: TemplateCategory;
  /** Filter by tags */
  tags?: string[];
  /** Filter by aspect ratio */
  aspectRatio?: string;
  /** Filter by difficulty */
  difficulty?: TemplateMetadata['difficulty'];
  /** Search query */
  query?: string;
  /** Sort by */
  sortBy?: 'name' | 'createdAt' | 'usageCount' | 'difficulty';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
}

// ─── Validation ──────────────────────────────────────────────────

export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate an EditingTemplate against the schema.
 */
export function validateTemplate(template: EditingTemplate): TemplateValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Metadata validation
  if (!template.metadata.id) errors.push('metadata.id is required');
  if (!template.metadata.name) errors.push('metadata.name is required');
  if (!template.metadata.category) errors.push('metadata.category is required');
  if (template.metadata.resolutionWidth <= 0) errors.push('resolutionWidth must be positive');
  if (template.metadata.resolutionHeight <= 0) errors.push('resolutionHeight must be positive');
  if (template.metadata.frameRate <= 0) errors.push('frameRate must be positive');
  if (template.metadata.estimatedDurationSec <= 0) errors.push('estimatedDurationSec must be positive');

  // Track validation
  if (template.tracks.length === 0) {
    warnings.push('Template has no tracks');
  }

  for (const track of template.tracks) {
    if (track.clips.length === 0) {
      warnings.push(`Track "${track.name}" has no clips`);
    }
    for (const clip of track.clips) {
      if (clip.durationSec <= 0 && !clip.flexibleDuration) {
        errors.push(`Clip in track "${track.name}" has invalid duration`);
      }
      if (clip.opacity < 0 || clip.opacity > 1) {
        errors.push(`Clip opacity must be 0-1, got ${clip.opacity}`);
      }
      if (clip.speed <= 0) {
        errors.push(`Clip speed must be positive, got ${clip.speed}`);
      }
    }
  }

  // Audio layout validation
  if (template.audioLayout.masterLoudnessTarget > 0) {
    warnings.push('Master loudness target should be negative (LUFS)');
  }

  // Variable validation
  const varIds = new Set<string>();
  for (const v of template.variables) {
    if (varIds.has(v.id)) {
      errors.push(`Duplicate variable ID: ${v.id}`);
    }
    varIds.add(v.id);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
