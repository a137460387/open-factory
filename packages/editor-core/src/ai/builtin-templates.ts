/**
 * Built-in Template Library
 *
 * Three preset templates for common vertical scenarios:
 * 1. Vlog - Fast-paced, dynamic cuts
 * 2. Knowledge Tutorial - Text-heavy, explanatory
 * 3. Product Demo - Split-screen, feature showcase
 */

import type {
  EditingTemplate,
  TemplateMetadata,
  TemplateTrack,
  TemplateAudioLayout,
  TemplateVariable,
  TemplateColorNode,
} from '../models/template-schema';
import { TEMPLATE_SCHEMA_VERSION } from '../models/template-schema';

// ─── Vlog Template ───────────────────────────────────────────────

const VLOG_METADATA: TemplateMetadata = {
  id: 'builtin-vlog-fast',
  version: TEMPLATE_SCHEMA_VERSION,
  name: 'Vlog - Fast Pace',
  description: 'Dynamic vlog template with quick cuts, energetic transitions, and upbeat pacing. Ideal for travel, lifestyle, and daily vlogs.',
  category: 'vlog',
  tags: ['vlog', 'fast-paced', 'dynamic', 'travel', 'lifestyle'],
  author: 'Open Factory',
  createdAt: '2026-07-21T00:00:00Z',
  updatedAt: '2026-07-21T00:00:00Z',
  aspectRatio: '16:9',
  resolutionWidth: 1920,
  resolutionHeight: 1080,
  frameRate: 30,
  estimatedDurationSec: 60,
  difficulty: 'beginner',
};

const VLOG_TRACKS: TemplateTrack[] = [
  {
    type: 'video',
    name: 'Main Footage',
    clips: [
      {
        type: 'video',
        durationSec: 3,
        flexibleDuration: true,
        placeholder: 'user-video',
        placeholderParams: {},
        effects: [{ type: 'vignette', params: { intensity: 0.3 }, enabled: true }],
        keyframes: [],
        colorNodes: [
          { type: 'saturation', params: { saturation: 15 }, enabled: true, order: 1 },
          { type: 'brightness-contrast', params: { brightness: 5, contrast: 10 }, enabled: true, order: 2 },
        ],
        opacity: 1,
        speed: 1,
        volume: 1,
      },
      {
        type: 'video',
        durationSec: 2,
        flexibleDuration: true,
        placeholder: 'user-video',
        placeholderParams: {},
        effects: [],
        keyframes: [],
        colorNodes: [],
        opacity: 1,
        speed: 1,
        volume: 1,
      },
      {
        type: 'video',
        durationSec: 4,
        flexibleDuration: true,
        placeholder: 'user-video',
        placeholderParams: {},
        effects: [],
        keyframes: [],
        colorNodes: [],
        opacity: 1,
        speed: 1,
        volume: 1,
      },
      {
        type: 'video',
        durationSec: 2.5,
        flexibleDuration: true,
        placeholder: 'user-video',
        placeholderParams: {},
        effects: [],
        keyframes: [],
        colorNodes: [],
        opacity: 1,
        speed: 1,
        volume: 1,
      },
      {
        type: 'video',
        durationSec: 3,
        flexibleDuration: true,
        placeholder: 'user-video',
        placeholderParams: {},
        effects: [],
        keyframes: [],
        colorNodes: [],
        opacity: 1,
        speed: 1,
        volume: 1,
      },
    ],
    transitions: [
      { type: 'dissolve', durationSec: 0.3 },
      { type: 'wipe-left', durationSec: 0.25 },
      { type: 'dissolve', durationSec: 0.3 },
      { type: 'flash-white', durationSec: 0.15 },
    ],
    trackEffects: [],
    muted: false,
    locked: false,
  },
  {
    type: 'text',
    name: 'Title Overlay',
    clips: [
      {
        type: 'text',
        durationSec: 3,
        flexibleDuration: true,
        placeholder: 'generated-text',
        placeholderParams: { text: '{{title}}', fontSize: 72, color: '#FFFFFF', fontWeight: 'bold' },
        effects: [],
        keyframes: [
          { normalizedTime: 0, property: 'opacity', value: 0, interpolation: 'ease-out' },
          { normalizedTime: 0.15, property: 'opacity', value: 1, interpolation: 'ease-out' },
          { normalizedTime: 0.85, property: 'opacity', value: 1, interpolation: 'linear' },
          { normalizedTime: 1, property: 'opacity', value: 0, interpolation: 'ease-in' },
        ],
        colorNodes: [],
        opacity: 1,
        speed: 1,
        volume: 0,
      },
    ],
    transitions: [],
    trackEffects: [],
    muted: false,
    locked: false,
  },
  {
    type: 'audio',
    name: 'Background Music',
    clips: [
      {
        type: 'audio',
        durationSec: 60,
        flexibleDuration: true,
        placeholder: 'user-audio',
        placeholderParams: {},
        effects: [],
        keyframes: [
          { normalizedTime: 0, property: 'volume', value: 0, interpolation: 'ease-out' },
          { normalizedTime: 0.05, property: 'volume', value: 0.7, interpolation: 'ease-out' },
          { normalizedTime: 0.9, property: 'volume', value: 0.7, interpolation: 'linear' },
          { normalizedTime: 1, property: 'volume', value: 0, interpolation: 'ease-in' },
        ],
        colorNodes: [],
        opacity: 1,
        speed: 1,
        volume: 0.7,
      },
    ],
    transitions: [],
    trackEffects: [],
    muted: false,
    locked: false,
  },
];

const VLOG_AUDIO: TemplateAudioLayout = {
  tracks: [
    { role: 'voice', volumeDb: -14, pan: 0, fadeInSec: 0.1, fadeOutSec: 0.2 },
    { role: 'music', volumeDb: -26, pan: 0, fadeInSec: 1, fadeOutSec: 2, duckTarget: 'voice', duckAttenuationDb: 10 },
  ],
  masterLoudnessTarget: -14,
  masterLimiter: true,
};

const VLOG_COLOR: TemplateColorNode[] = [
  { type: 'brightness-contrast', params: { brightness: 3, contrast: 8 }, enabled: true, order: 1 },
  { type: 'saturation', params: { saturation: 12 }, enabled: true, order: 2 },
];

const VLOG_VARIABLES: TemplateVariable[] = [
  { id: 'title', label: 'Video Title', type: 'text', defaultValue: 'My Vlog', description: 'Opening title text' },
  { id: 'accentColor', label: 'Accent Color', type: 'color', defaultValue: '#FF6B35', description: 'Overlay accent color' },
  { id: 'bgMusic', label: 'Background Music', type: 'media', defaultValue: '', description: 'Background music track' },
];

// ─── Knowledge Tutorial Template ─────────────────────────────────

const TUTORIAL_METADATA: TemplateMetadata = {
  id: 'builtin-tutorial-knowledge',
  version: TEMPLATE_SCHEMA_VERSION,
  name: 'Knowledge Tutorial',
  description: 'Structured educational template with text overlays, chapter markers, and calm pacing. Perfect for explainers, how-to videos, and online courses.',
  category: 'tutorial',
  tags: ['tutorial', 'education', 'knowledge', 'explainer', 'how-to'],
  author: 'Open Factory',
  createdAt: '2026-07-21T00:00:00Z',
  updatedAt: '2026-07-21T00:00:00Z',
  aspectRatio: '16:9',
  resolutionWidth: 1920,
  resolutionHeight: 1080,
  frameRate: 30,
  estimatedDurationSec: 120,
  difficulty: 'beginner',
};

const TUTORIAL_TRACKS: TemplateTrack[] = [
  {
    type: 'video',
    name: 'Main Content',
    clips: [
      {
        type: 'video',
        durationSec: 8,
        flexibleDuration: true,
        placeholder: 'user-video',
        placeholderParams: {},
        effects: [],
        keyframes: [],
        colorNodes: [
          { type: 'brightness-contrast', params: { brightness: 5, contrast: 5 }, enabled: true, order: 1 },
        ],
        opacity: 1,
        speed: 1,
        volume: 1,
      },
      {
        type: 'image',
        durationSec: 6,
        flexibleDuration: true,
        placeholder: 'user-image',
        placeholderParams: {},
        effects: [],
        keyframes: [
          { normalizedTime: 0, property: 'scale', value: 1.0, interpolation: 'linear' },
          { normalizedTime: 1, property: 'scale', value: 1.05, interpolation: 'ease-in-out' },
        ],
        colorNodes: [],
        opacity: 1,
        speed: 1,
        volume: 0,
      },
      {
        type: 'video',
        durationSec: 10,
        flexibleDuration: true,
        placeholder: 'user-video',
        placeholderParams: {},
        effects: [],
        keyframes: [],
        colorNodes: [],
        opacity: 1,
        speed: 1,
        volume: 1,
      },
    ],
    transitions: [
      { type: 'dissolve', durationSec: 0.5 },
      { type: 'dissolve', durationSec: 0.5 },
    ],
    trackEffects: [],
    muted: false,
    locked: false,
  },
  {
    type: 'text',
    name: 'Chapter Titles',
    clips: [
      {
        type: 'text',
        durationSec: 4,
        flexibleDuration: true,
        placeholder: 'generated-text',
        placeholderParams: { text: '{{chapter1}}', fontSize: 56, color: '#FFFFFF' },
        effects: [],
        keyframes: [
          { normalizedTime: 0, property: 'opacity', value: 0, interpolation: 'ease-out' },
          { normalizedTime: 0.1, property: 'opacity', value: 1, interpolation: 'ease-out' },
        ],
        colorNodes: [],
        opacity: 1,
        speed: 1,
        volume: 0,
      },
      {
        type: 'text',
        durationSec: 5,
        flexibleDuration: true,
        placeholder: 'generated-text',
        placeholderParams: { text: '{{chapter2}}', fontSize: 56, color: '#FFFFFF' },
        effects: [],
        keyframes: [
          { normalizedTime: 0, property: 'opacity', value: 0, interpolation: 'ease-out' },
          { normalizedTime: 0.1, property: 'opacity', value: 1, interpolation: 'ease-out' },
        ],
        colorNodes: [],
        opacity: 1,
        speed: 1,
        volume: 0,
      },
      {
        type: 'text',
        durationSec: 6,
        flexibleDuration: true,
        placeholder: 'generated-text',
        placeholderParams: { text: '{{chapter3}}', fontSize: 56, color: '#FFFFFF' },
        effects: [],
        keyframes: [
          { normalizedTime: 0, property: 'opacity', value: 0, interpolation: 'ease-out' },
          { normalizedTime: 0.1, property: 'opacity', value: 1, interpolation: 'ease-out' },
        ],
        colorNodes: [],
        opacity: 1,
        speed: 1,
        volume: 0,
      },
    ],
    transitions: [],
    trackEffects: [],
    muted: false,
    locked: false,
  },
  {
    type: 'subtitle',
    name: 'Subtitles',
    clips: [
      {
        type: 'subtitle',
        durationSec: 120,
        flexibleDuration: true,
        placeholder: 'generated-text',
        placeholderParams: { text: '{{subtitle}}', fontSize: 32, color: '#FFFF00' },
        effects: [],
        keyframes: [],
        colorNodes: [],
        opacity: 1,
        speed: 1,
        volume: 0,
      },
    ],
    transitions: [],
    trackEffects: [],
    muted: false,
    locked: false,
  },
  {
    type: 'audio',
    name: 'Narration',
    clips: [
      {
        type: 'audio',
        durationSec: 120,
        flexibleDuration: true,
        placeholder: 'user-audio',
        placeholderParams: {},
        effects: [],
        keyframes: [],
        colorNodes: [],
        opacity: 1,
        speed: 1,
        volume: 1,
      },
    ],
    transitions: [],
    trackEffects: [],
    muted: false,
    locked: false,
  },
];

const TUTORIAL_AUDIO: TemplateAudioLayout = {
  tracks: [
    { role: 'voice', volumeDb: -14, pan: 0, fadeInSec: 0.05, fadeOutSec: 0.1 },
    { role: 'music', volumeDb: -30, pan: 0, fadeInSec: 2, fadeOutSec: 3, duckTarget: 'voice', duckAttenuationDb: 15 },
  ],
  masterLoudnessTarget: -16,
  masterLimiter: true,
};

const TUTORIAL_COLOR: TemplateColorNode[] = [
  { type: 'brightness-contrast', params: { brightness: 5, contrast: 5 }, enabled: true, order: 1 },
];

const TUTORIAL_VARIABLES: TemplateVariable[] = [
  { id: 'title', label: 'Video Title', type: 'text', defaultValue: 'Learn Something New', description: 'Opening title' },
  { id: 'chapter1', label: 'Chapter 1 Title', type: 'text', defaultValue: 'Introduction', description: 'First chapter title' },
  { id: 'chapter2', label: 'Chapter 2 Title', type: 'text', defaultValue: 'Core Concepts', description: 'Second chapter title' },
  { id: 'chapter3', label: 'Chapter 3 Title', type: 'text', defaultValue: 'Summary', description: 'Third chapter title' },
  { id: 'subtitle', label: 'Subtitle Track', type: 'text', defaultValue: '', description: 'Subtitle content (SRT format)' },
  { id: 'narration', label: 'Narration Audio', type: 'media', defaultValue: '', description: 'Voice narration track' },
];

// ─── Product Demo Template ───────────────────────────────────────

const PRODUCT_METADATA: TemplateMetadata = {
  id: 'builtin-product-demo',
  version: TEMPLATE_SCHEMA_VERSION,
  name: 'Product Demo - Split Screen',
  description: 'Professional split-screen product showcase template. Features side-by-side comparisons, feature callouts, and polished transitions.',
  category: 'product-demo',
  tags: ['product', 'demo', 'split-screen', 'showcase', 'marketing'],
  author: 'Open Factory',
  createdAt: '2026-07-21T00:00:00Z',
  updatedAt: '2026-07-21T00:00:00Z',
  aspectRatio: '16:9',
  resolutionWidth: 1920,
  resolutionHeight: 1080,
  frameRate: 30,
  estimatedDurationSec: 90,
  difficulty: 'intermediate',
};

const PRODUCT_TRACKS: TemplateTrack[] = [
  {
    type: 'video',
    name: 'Product Main',
    clips: [
      {
        type: 'video',
        durationSec: 5,
        flexibleDuration: true,
        placeholder: 'user-video',
        placeholderParams: {},
        effects: [],
        keyframes: [
          { normalizedTime: 0, property: 'opacity', value: 0, interpolation: 'ease-out' },
          { normalizedTime: 0.1, property: 'opacity', value: 1, interpolation: 'ease-out' },
        ],
        colorNodes: [
          { type: 'brightness-contrast', params: { brightness: 3, contrast: 12 }, enabled: true, order: 1 },
          { type: 'saturation', params: { saturation: 8 }, enabled: true, order: 2 },
        ],
        opacity: 1,
        speed: 1,
        volume: 1,
      },
      {
        type: 'video',
        durationSec: 8,
        flexibleDuration: true,
        placeholder: 'user-video',
        placeholderParams: {},
        effects: [],
        keyframes: [],
        colorNodes: [],
        opacity: 1,
        speed: 1,
        volume: 1,
      },
      {
        type: 'video',
        durationSec: 6,
        flexibleDuration: true,
        placeholder: 'user-video',
        placeholderParams: {},
        effects: [],
        keyframes: [],
        colorNodes: [],
        opacity: 1,
        speed: 1,
        volume: 1,
      },
    ],
    transitions: [
      { type: 'dissolve', durationSec: 0.5 },
      { type: 'zoom-dissolve', durationSec: 0.4 },
    ],
    trackEffects: [],
    muted: false,
    locked: false,
  },
  {
    type: 'video',
    name: 'Overlay / Comparison',
    clips: [
      {
        type: 'video',
        durationSec: 8,
        flexibleDuration: true,
        placeholder: 'user-video',
        placeholderParams: {},
        effects: [],
        keyframes: [
          { normalizedTime: 0, property: 'opacity', value: 0, interpolation: 'ease-out' },
          { normalizedTime: 0.15, property: 'opacity', value: 0.9, interpolation: 'ease-out' },
        ],
        colorNodes: [],
        opacity: 0.9,
        speed: 1,
        volume: 0,
      },
      {
        type: 'video',
        durationSec: 6,
        flexibleDuration: true,
        placeholder: 'user-video',
        placeholderParams: {},
        effects: [],
        keyframes: [],
        colorNodes: [],
        opacity: 0.9,
        speed: 1,
        volume: 0,
      },
    ],
    transitions: [{ type: 'dissolve', durationSec: 0.3 }],
    trackEffects: [],
    muted: false,
    locked: false,
  },
  {
    type: 'text',
    name: 'Feature Callouts',
    clips: [
      {
        type: 'text',
        durationSec: 5,
        flexibleDuration: true,
        placeholder: 'generated-text',
        placeholderParams: { text: '{{feature1}}', fontSize: 48, color: '#FFFFFF' },
        effects: [],
        keyframes: [
          { normalizedTime: 0, property: 'opacity', value: 0, interpolation: 'ease-out' },
          { normalizedTime: 0.1, property: 'opacity', value: 1, interpolation: 'ease-out' },
        ],
        colorNodes: [],
        opacity: 1,
        speed: 1,
        volume: 0,
      },
      {
        type: 'text',
        durationSec: 8,
        flexibleDuration: true,
        placeholder: 'generated-text',
        placeholderParams: { text: '{{feature2}}', fontSize: 48, color: '#FFFFFF' },
        effects: [],
        keyframes: [
          { normalizedTime: 0, property: 'opacity', value: 0, interpolation: 'ease-out' },
          { normalizedTime: 0.1, property: 'opacity', value: 1, interpolation: 'ease-out' },
        ],
        colorNodes: [],
        opacity: 1,
        speed: 1,
        volume: 0,
      },
      {
        type: 'text',
        durationSec: 6,
        flexibleDuration: true,
        placeholder: 'generated-text',
        placeholderParams: { text: '{{cta}}', fontSize: 64, color: '#FFFFFF', fontWeight: 'bold' },
        effects: [],
        keyframes: [
          { normalizedTime: 0, property: 'opacity', value: 0, interpolation: 'ease-out' },
          { normalizedTime: 0.1, property: 'opacity', value: 1, interpolation: 'ease-out' },
        ],
        colorNodes: [],
        opacity: 1,
        speed: 1,
        volume: 0,
      },
    ],
    transitions: [],
    trackEffects: [],
    muted: false,
    locked: false,
  },
  {
    type: 'audio',
    name: 'Background Music',
    clips: [
      {
        type: 'audio',
        durationSec: 90,
        flexibleDuration: true,
        placeholder: 'user-audio',
        placeholderParams: {},
        effects: [],
        keyframes: [
          { normalizedTime: 0, property: 'volume', value: 0, interpolation: 'ease-out' },
          { normalizedTime: 0.05, property: 'volume', value: 0.6, interpolation: 'ease-out' },
          { normalizedTime: 0.85, property: 'volume', value: 0.6, interpolation: 'linear' },
          { normalizedTime: 1, property: 'volume', value: 0, interpolation: 'ease-in' },
        ],
        colorNodes: [],
        opacity: 1,
        speed: 1,
        volume: 0.6,
      },
    ],
    transitions: [],
    trackEffects: [],
    muted: false,
    locked: false,
  },
];

const PRODUCT_AUDIO: TemplateAudioLayout = {
  tracks: [
    { role: 'voice', volumeDb: -12, pan: 0, fadeInSec: 0.1, fadeOutSec: 0.2 },
    { role: 'music', volumeDb: -24, pan: 0, fadeInSec: 1.5, fadeOutSec: 2, duckTarget: 'voice', duckAttenuationDb: 12 },
    { role: 'sfx', volumeDb: -18, pan: 0, fadeInSec: 0, fadeOutSec: 0.1 },
  ],
  masterLoudnessTarget: -14,
  masterLimiter: true,
};

const PRODUCT_COLOR: TemplateColorNode[] = [
  { type: 'brightness-contrast', params: { brightness: 3, contrast: 12 }, enabled: true, order: 1 },
  { type: 'saturation', params: { saturation: 8 }, enabled: true, order: 2 },
];

const PRODUCT_VARIABLES: TemplateVariable[] = [
  { id: 'title', label: 'Product Name', type: 'text', defaultValue: 'Product Name', description: 'Product name for title card' },
  { id: 'feature1', label: 'Feature 1', type: 'text', defaultValue: 'Feature One', description: 'First feature callout' },
  { id: 'feature2', label: 'Feature 2', type: 'text', defaultValue: 'Feature Two', description: 'Second feature callout' },
  { id: 'cta', label: 'Call to Action', type: 'text', defaultValue: 'Learn More', description: 'End card CTA text' },
  { id: 'accentColor', label: 'Brand Color', type: 'color', defaultValue: '#2563EB', description: 'Brand accent color' },
  { id: 'bgMusic', label: 'Background Music', type: 'media', defaultValue: '', description: 'Background music track' },
];

// ─── Exported Built-in Templates ─────────────────────────────────

export const BUILTIN_VLOG_TEMPLATE: EditingTemplate = {
  metadata: VLOG_METADATA,
  tracks: VLOG_TRACKS,
  audioLayout: VLOG_AUDIO,
  globalColorNodes: VLOG_COLOR,
  variables: VLOG_VARIABLES,
};

export const BUILTIN_TUTORIAL_TEMPLATE: EditingTemplate = {
  metadata: TUTORIAL_METADATA,
  tracks: TUTORIAL_TRACKS,
  audioLayout: TUTORIAL_AUDIO,
  globalColorNodes: TUTORIAL_COLOR,
  variables: TUTORIAL_VARIABLES,
};

export const BUILTIN_PRODUCT_DEMO_TEMPLATE: EditingTemplate = {
  metadata: PRODUCT_METADATA,
  tracks: PRODUCT_TRACKS,
  audioLayout: PRODUCT_AUDIO,
  globalColorNodes: PRODUCT_COLOR,
  variables: PRODUCT_VARIABLES,
};

/** All built-in templates */
export const BUILTIN_TEMPLATES: readonly EditingTemplate[] = [
  BUILTIN_VLOG_TEMPLATE,
  BUILTIN_TUTORIAL_TEMPLATE,
  BUILTIN_PRODUCT_DEMO_TEMPLATE,
];

/** Get built-in template by ID */
export function getBuiltinTemplate(id: string): EditingTemplate | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.metadata.id === id);
}

/** Get templates by category */
export function getTemplatesByCategory(
  category: EditingTemplate['metadata']['category'],
): EditingTemplate[] {
  return BUILTIN_TEMPLATES.filter((t) => t.metadata.category === category);
}
