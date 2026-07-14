import { normalizeClipBlendMode, type ClipBlendMode } from './blend-modes';
import { cloneEffects, type Effect } from './effects';
import { normalizeClipKeyframes, cloneClipKeyframes } from './keyframes';
import {
  type Clip,
  type ClipKeyframes,
  type ColorCorrection,
  type KeyframeProperty,
  normalizeColorCorrection,
} from './model';

export const EFFECT_PRESET_SCHEMA_VERSION = 1;
export const EFFECT_PRESET_FILE_KIND = 'open-factory.effect-preset';

export type EffectPresetStyleTag = 'cinematic' | 'fresh' | 'retro' | 'bw' | 'cyber';
export type EffectPresetUseTag = 'portrait' | 'landscape' | 'food' | 'sport';
export type EffectPresetTag = EffectPresetStyleTag | EffectPresetUseTag | string;

export const EFFECT_PRESET_STYLE_TAGS: readonly EffectPresetStyleTag[] = ['cinematic', 'fresh', 'retro', 'bw', 'cyber'];
export const EFFECT_PRESET_USE_TAGS: readonly EffectPresetUseTag[] = ['portrait', 'landscape', 'food', 'sport'];

export interface EffectPresetStack {
  colorCorrection: ColorCorrection;
  effects?: Effect[];
  blendMode: ClipBlendMode;
  keyframes?: ClipKeyframes;
}

export interface EffectPreset {
  id: string;
  name: string;
  author: string;
  description?: string;
  tags: EffectPresetTag[];
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
  stack: EffectPresetStack;
}

export interface EffectPresetFile {
  schemaVersion: typeof EFFECT_PRESET_SCHEMA_VERSION;
  kind: typeof EFFECT_PRESET_FILE_KIND;
  preset: EffectPreset;
}

export interface EffectPresetCreateInput {
  id?: string;
  name: string;
  author?: string;
  description?: string;
  tags?: EffectPresetTag[];
  thumbnail?: string;
  now?: string;
}

export interface EffectPresetFilters {
  style?: 'all' | EffectPresetStyleTag | string;
  use?: 'all' | EffectPresetUseTag | string;
}

export interface EffectPresetPreviewArgsOptions {
  inputPath?: string;
  outputPath: string;
  width?: number;
  height?: number;
}

export function createEffectPresetFromClip(clip: Clip, input: EffectPresetCreateInput): EffectPreset {
  const timestamp = normalizeIsoDate(input.now) ?? new Date(Date.now()).toISOString();
  return normalizeEffectPreset({
    id: input.id ?? slugifyEffectPresetName(input.name),
    name: input.name,
    author: input.author ?? 'Local user',
    description: input.description,
    tags: input.tags,
    thumbnail: input.thumbnail,
    createdAt: timestamp,
    updatedAt: timestamp,
    stack: extractEffectPresetStack(clip),
  });
}

export function extractEffectPresetStack(clip: Clip): EffectPresetStack {
  return {
    colorCorrection: normalizeColorCorrection(clip.colorCorrection),
    effects: cloneEffects(clip.effects),
    blendMode: normalizeClipBlendMode(clip.blendMode),
    keyframes: cloneClipKeyframes(clip.keyframes),
  };
}

export function buildEffectPresetClipPatch(
  preset: EffectPreset | EffectPresetFile,
  clipDuration: number,
): {
  colorCorrection: ColorCorrection;
  effects?: Effect[];
  blendMode: ClipBlendMode;
  keyframes?: ClipKeyframes;
} {
  const normalized = normalizeEffectPreset('preset' in preset ? preset.preset : preset);
  return {
    colorCorrection: normalizeColorCorrection(normalized.stack.colorCorrection),
    effects: cloneEffects(normalized.stack.effects),
    blendMode: normalizeClipBlendMode(normalized.stack.blendMode),
    keyframes: normalizeClipKeyframes(cloneClipKeyframes(normalized.stack.keyframes), clipDuration),
  };
}

export function serializeEffectPresetFile(preset: EffectPreset): string {
  const file: EffectPresetFile = {
    schemaVersion: EFFECT_PRESET_SCHEMA_VERSION,
    kind: EFFECT_PRESET_FILE_KIND,
    preset: normalizeEffectPreset(preset),
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

export function parseEffectPresetJson(contents: string): EffectPreset {
  const parsed = JSON.parse(contents) as Partial<EffectPresetFile> | Partial<EffectPreset>;
  if (parsed && typeof parsed === 'object' && 'preset' in parsed) {
    if (
      parsed.schemaVersion !== EFFECT_PRESET_SCHEMA_VERSION ||
      parsed.kind !== EFFECT_PRESET_FILE_KIND ||
      !parsed.preset
    ) {
      throw new Error('Invalid effect preset file.');
    }
    return normalizeEffectPreset(parsed.preset);
  }
  return normalizeEffectPreset(parsed);
}

export function normalizeEffectPreset(input: unknown): EffectPreset {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid effect preset.');
  }
  const raw = input as Record<string, unknown>;
  const id = normalizeText(raw.id, 96) || slugifyEffectPresetName(normalizeText(raw.name, 96));
  const name = normalizeText(raw.name, 120);
  const stack = normalizeEffectPresetStack(raw.stack);
  if (!id || !name || !stack) {
    throw new Error('Invalid effect preset.');
  }
  const createdAt = normalizeIsoDate(raw.createdAt) ?? new Date(Date.now()).toISOString();
  return {
    id,
    name,
    author: normalizeText(raw.author, 120) || 'Unknown author',
    description: normalizeText(raw.description, 400) || undefined,
    tags: normalizeEffectPresetTags(raw.tags),
    thumbnail: normalizeText(raw.thumbnail, 4000) || undefined,
    createdAt,
    updatedAt: normalizeIsoDate(raw.updatedAt) ?? createdAt,
    stack,
  };
}

export function filterEffectPresets<T extends Pick<EffectPreset, 'tags'>>(
  presets: T[],
  filters: EffectPresetFilters = {},
): T[] {
  return presets.filter((preset) => {
    const tags = preset.tags.map((tag) => tag.toLowerCase());
    return matchesTagFilter(tags, filters.style) && matchesTagFilter(tags, filters.use);
  });
}

export function buildEffectPresetPreviewArgs(
  preset: EffectPreset | EffectPresetFile,
  options: EffectPresetPreviewArgsOptions,
): string[] {
  const normalized = normalizeEffectPreset('preset' in preset ? preset.preset : preset);
  const width = clampInteger(options.width, 320, 64, 4096);
  const height = clampInteger(options.height, 180, 64, 4096);
  const filters = buildEffectPresetPreviewFilters(normalized);
  const args = ['-y'];
  if (options.inputPath) {
    args.push('-i', options.inputPath);
  } else {
    args.push('-f', 'lavfi', '-i', `testsrc2=size=${width}x${height}:rate=1:duration=1`);
  }
  if (filters.length > 0) {
    args.push('-vf', filters.join(','));
  }
  args.push('-frames:v', '1', '-update', '1', options.outputPath);
  return args;
}

function normalizeEffectPresetStack(input: unknown): EffectPresetStack | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }
  const raw = input as Partial<EffectPresetStack>;
  const keyframes = normalizePresetKeyframes(raw.keyframes);
  return {
    colorCorrection: normalizeColorCorrection(raw.colorCorrection),
    effects: cloneEffects(raw.effects),
    blendMode: normalizeClipBlendMode(raw.blendMode),
    keyframes,
  };
}

function normalizePresetKeyframes(keyframes: ClipKeyframes | undefined): ClipKeyframes | undefined {
  const cloned = cloneClipKeyframes(keyframes);
  if (!cloned) {
    return undefined;
  }
  const normalized: ClipKeyframes = {};
  for (const property of Object.keys(cloned) as KeyframeProperty[]) {
    const frames = cloned[property];
    if (frames?.length) {
      normalized[property] = frames.map((frame) => ({ ...frame }));
    }
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function buildEffectPresetPreviewFilters(preset: EffectPreset): string[] {
  const filters: string[] = [];
  const color = preset.stack.colorCorrection;
  filters.push(
    `eq=brightness=${roundFilterNumber(color.brightness)}:contrast=${roundFilterNumber(color.contrast)}:saturation=${roundFilterNumber(color.saturation)}`,
  );
  if (color.hue) {
    filters.push(`hue=h=${roundFilterNumber(color.hue)}`);
  }
  for (const effect of preset.stack.effects ?? []) {
    if (!effect.enabled) {
      continue;
    }
    if (effect.type === 'blur') {
      filters.push(`boxblur=${roundFilterNumber(Number(effect.params.radius ?? 1))}:1`);
    } else if (effect.type === 'sharpen') {
      filters.push(`unsharp=5:5:${roundFilterNumber(Number(effect.params.strength ?? 1))}`);
    } else if (effect.type === 'vignette') {
      filters.push(`vignette=PI/4:eval=frame`);
    } else if (effect.type === 'film-grain') {
      filters.push(`noise=alls=${Math.round(Number(effect.params.strength ?? 0.2) * 30)}:allf=t+u`);
    } else if (effect.type === 'chromatic-aberration') {
      filters.push('format=rgba');
    } else if (effect.type === 'motion-blur') {
      filters.push('tmix=frames=3:weights="1 1 1"');
    }
  }
  return filters;
}

function normalizeEffectPresetTags(value: unknown): EffectPresetTag[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map((tag) => normalizeText(tag, 40).toLowerCase()).filter(Boolean)));
}

function matchesTagFilter(tags: string[], filter: string | undefined): boolean {
  return !filter || filter === 'all' || tags.includes(filter.toLowerCase());
}

function normalizeText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeIsoDate(value: unknown): string | undefined {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined;
}

function slugifyEffectPresetName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'effect-preset'
  );
}

function clampInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  return Math.min(
    max,
    Math.max(min, Math.round(typeof value === 'number' && Number.isFinite(value) ? value : fallback)),
  );
}

function roundFilterNumber(value: number): string {
  const finite = Number.isFinite(value) ? value : 0;
  return String(Math.round(finite * 1000) / 1000);
}
