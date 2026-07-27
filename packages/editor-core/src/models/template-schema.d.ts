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
export declare const TEMPLATE_SCHEMA_VERSION: "1.0";
export declare const TEMPLATE_FILE_EXTENSION: ".oft";
export type TemplateCategory = 'vlog' | 'tutorial' | 'product-demo' | 'music-video' | 'documentary' | 'short-form' | 'custom';
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
export interface TemplateTransition {
    /** Transition type */
    type: TransitionType;
    /** Duration in seconds */
    durationSec: number;
}
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
export interface TemplateAudioLayout {
    /** Track role mixes */
    tracks: TemplateAudioMix[];
    /** Master loudness target in LUFS */
    masterLoudnessTarget: number;
    /** Master limiter enabled */
    masterLimiter: boolean;
}
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
export interface TemplateValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
/**
 * Validate an EditingTemplate against the schema.
 */
export declare function validateTemplate(template: EditingTemplate): TemplateValidationResult;
//# sourceMappingURL=template-schema.d.ts.map