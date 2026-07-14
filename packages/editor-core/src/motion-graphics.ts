import type { Keyframe, KeyframeEasing } from './model-types';
import { round } from './time';

export const MOTION_GRAPHIC_FILE_FORMAT = 'open-factory-motion-graphic';
export const MOTION_GRAPHIC_SEQUENCE_KIND = 'motion-graphic-sequence';

export const MOTION_GRAPHIC_TEMPLATE_TYPES = [
  'scoreboard',
  'progress-bar',
  'data-chart',
  'countdown',
  'social-lower-third',
  'map-route',
] as const;
export type MotionGraphicTemplateType = (typeof MOTION_GRAPHIC_TEMPLATE_TYPES)[number];

export const MOTION_GRAPHIC_CHART_KINDS = ['bar', 'line', 'pie'] as const;
export type MotionGraphicChartKind = (typeof MOTION_GRAPHIC_CHART_KINDS)[number];

export type MotionGraphicParamType = 'string' | 'number' | 'boolean' | 'color' | 'select' | 'number-list';
export type MotionGraphicParamValue = string | number | boolean | number[];
export type MotionGraphicParams = Record<string, MotionGraphicParamValue>;
export type MotionGraphicParamKeyframes = Record<string, Keyframe<number>[]>;

export interface MotionGraphicParamDefinition {
  key: string;
  type: MotionGraphicParamType;
  defaultValue: MotionGraphicParamValue;
  min?: number;
  max?: number;
  step?: number;
  maxItems?: number;
  keyframeable?: boolean;
  options?: readonly string[];
}

export interface MotionGraphicTemplateDefinition {
  type: MotionGraphicTemplateType;
  params: MotionGraphicParamDefinition[];
}

export interface MotionGraphic {
  version: 1;
  templateType: MotionGraphicTemplateType;
  params: MotionGraphicParams;
  paramKeyframes?: MotionGraphicParamKeyframes;
}

export interface MotionGraphicTemplateFile {
  format: typeof MOTION_GRAPHIC_FILE_FORMAT;
  version: 1;
  templateType: MotionGraphicTemplateType;
  params: MotionGraphicParams;
  paramKeyframes?: MotionGraphicParamKeyframes;
  duration?: number;
  width?: number;
  height?: number;
}

const DEFAULT_DATA_VALUES = [38, 64, 46, 82, 58];

export const MOTION_GRAPHIC_TEMPLATE_DEFINITIONS: Record<MotionGraphicTemplateType, MotionGraphicTemplateDefinition> = {
  scoreboard: {
    type: 'scoreboard',
    params: [
      { key: 'homeLabel', type: 'string', defaultValue: 'HOME' },
      { key: 'awayLabel', type: 'string', defaultValue: 'AWAY' },
      { key: 'homeScore', type: 'number', defaultValue: 2, min: 0, max: 999, step: 1, keyframeable: true },
      { key: 'awayScore', type: 'number', defaultValue: 1, min: 0, max: 999, step: 1, keyframeable: true },
      { key: 'periodLabel', type: 'string', defaultValue: 'Q4' },
      { key: 'accentColor', type: 'color', defaultValue: '#22d3ee' },
      { key: 'backgroundOpacity', type: 'number', defaultValue: 0.82, min: 0, max: 1, step: 0.01, keyframeable: true },
    ],
  },
  'progress-bar': {
    type: 'progress-bar',
    params: [
      { key: 'progress', type: 'number', defaultValue: 0.65, min: 0, max: 1, step: 0.01, keyframeable: true },
      { key: 'label', type: 'string', defaultValue: 'Progress' },
      { key: 'barColor', type: 'color', defaultValue: '#34d399' },
      { key: 'backgroundColor', type: 'color', defaultValue: '#0f172a' },
      { key: 'height', type: 'number', defaultValue: 48, min: 12, max: 180, step: 1, keyframeable: true },
      { key: 'cornerRadius', type: 'number', defaultValue: 14, min: 0, max: 80, step: 1, keyframeable: true },
    ],
  },
  'data-chart': {
    type: 'data-chart',
    params: [
      { key: 'chartKind', type: 'select', defaultValue: 'bar', options: MOTION_GRAPHIC_CHART_KINDS },
      { key: 'title', type: 'string', defaultValue: 'Data' },
      { key: 'dataValues', type: 'number-list', defaultValue: DEFAULT_DATA_VALUES, min: 0, max: 100, maxItems: 12 },
      { key: 'maxValue', type: 'number', defaultValue: 100, min: 1, max: 10000, step: 1, keyframeable: true },
      { key: 'primaryColor', type: 'color', defaultValue: '#60a5fa' },
      { key: 'secondaryColor', type: 'color', defaultValue: '#f97316' },
      { key: 'showLabels', type: 'boolean', defaultValue: true },
    ],
  },
  countdown: {
    type: 'countdown',
    params: [
      { key: 'startSeconds', type: 'number', defaultValue: 10, min: 1, max: 3600, step: 1, keyframeable: true },
      { key: 'prefix', type: 'string', defaultValue: '' },
      { key: 'suffix', type: 'string', defaultValue: '' },
      { key: 'fontSize', type: 'number', defaultValue: 112, min: 16, max: 360, step: 1, keyframeable: true },
      { key: 'color', type: 'color', defaultValue: '#ffffff' },
      { key: 'backgroundColor', type: 'color', defaultValue: '#111827' },
      { key: 'ringThickness', type: 'number', defaultValue: 16, min: 0, max: 80, step: 1, keyframeable: true },
    ],
  },
  'social-lower-third': {
    type: 'social-lower-third',
    params: [
      { key: 'displayName', type: 'string', defaultValue: 'Open Factory' },
      { key: 'handle', type: 'string', defaultValue: '@openfactory' },
      {
        key: 'platform',
        type: 'select',
        defaultValue: 'youtube',
        options: ['youtube', 'bilibili', 'douyin', 'custom'],
      },
      {
        key: 'followerCount',
        type: 'number',
        defaultValue: 12800,
        min: 0,
        max: 1000000000,
        step: 1,
        keyframeable: true,
      },
      { key: 'accentColor', type: 'color', defaultValue: '#ff4fd8' },
      { key: 'avatarInitials', type: 'string', defaultValue: 'OF' },
      { key: 'showIcon', type: 'boolean', defaultValue: true },
    ],
  },
  'map-route': {
    type: 'map-route',
    params: [
      { key: 'progress', type: 'number', defaultValue: 0.7, min: 0, max: 1, step: 0.01, keyframeable: true },
      { key: 'strokeWidth', type: 'number', defaultValue: 12, min: 2, max: 80, step: 1, keyframeable: true },
      { key: 'lineColor', type: 'color', defaultValue: '#facc15' },
      { key: 'mapTintColor', type: 'color', defaultValue: '#1e293b' },
      { key: 'waypointCount', type: 'number', defaultValue: 5, min: 2, max: 12, step: 1, keyframeable: true },
      { key: 'showPins', type: 'boolean', defaultValue: true },
      { key: 'zoom', type: 'number', defaultValue: 1, min: 0.5, max: 3, step: 0.05, keyframeable: true },
    ],
  },
};

export function isMotionGraphicTemplateType(value: unknown): value is MotionGraphicTemplateType {
  return MOTION_GRAPHIC_TEMPLATE_TYPES.includes(value as MotionGraphicTemplateType);
}

export function getMotionGraphicTemplateDefinition(type: unknown): MotionGraphicTemplateDefinition {
  const templateType = isMotionGraphicTemplateType(type) ? type : 'countdown';
  return MOTION_GRAPHIC_TEMPLATE_DEFINITIONS[templateType];
}

export function createDefaultMotionGraphic(templateType: MotionGraphicTemplateType = 'countdown'): MotionGraphic {
  return normalizeMotionGraphic({ version: 1, templateType, params: {} });
}

export function normalizeMotionGraphic(
  input: Partial<MotionGraphic> | undefined,
  duration = Number.POSITIVE_INFINITY,
): MotionGraphic {
  const definition = getMotionGraphicTemplateDefinition(input?.templateType);
  const params: MotionGraphicParams = {};
  for (const param of definition.params) {
    params[param.key] = normalizeMotionGraphicParamValue(param, input?.params?.[param.key]);
  }
  const paramKeyframes = normalizeMotionGraphicParamKeyframes(input?.paramKeyframes, definition, params, duration);
  return {
    version: 1,
    templateType: definition.type,
    params,
    ...(paramKeyframes ? { paramKeyframes } : {}),
  };
}

export function getMotionGraphicNumericParamKeys(graphic: Partial<MotionGraphic> | undefined): string[] {
  const normalized = normalizeMotionGraphic(graphic);
  return getMotionGraphicTemplateDefinition(normalized.templateType)
    .params.filter((param) => param.type === 'number' && param.keyframeable)
    .map((param) => param.key);
}

export function setMotionGraphicParam(
  graphic: Partial<MotionGraphic> | undefined,
  key: string,
  value: MotionGraphicParamValue,
  duration = Number.POSITIVE_INFINITY,
): MotionGraphic {
  const normalized = normalizeMotionGraphic(graphic, duration);
  const definition = getMotionGraphicTemplateDefinition(normalized.templateType);
  const param = definition.params.find((item) => item.key === key);
  if (!param) {
    return normalized;
  }
  return normalizeMotionGraphic(
    {
      ...normalized,
      params: {
        ...normalized.params,
        [key]: normalizeMotionGraphicParamValue(param, value),
      },
    },
    duration,
  );
}

export function setMotionGraphicParamKeyframe(
  graphic: Partial<MotionGraphic> | undefined,
  key: string,
  input: { id?: string; time: number; value: number; easing?: KeyframeEasing },
  duration: number,
): MotionGraphic {
  const normalized = normalizeMotionGraphic(graphic, duration);
  const definition = getMotionGraphicTemplateDefinition(normalized.templateType);
  const param = definition.params.find((item) => item.key === key);
  if (!param || param.type !== 'number' || !param.keyframeable) {
    return normalized;
  }
  const frame = normalizeMotionGraphicKeyframe(input, param, duration);
  const current = normalized.paramKeyframes?.[key] ?? [];
  const nextFrames = current.filter((item) => item.id !== frame.id && Math.abs(item.time - frame.time) > 0.000001);
  nextFrames.push(frame);
  return normalizeMotionGraphic(
    {
      ...normalized,
      paramKeyframes: {
        ...normalized.paramKeyframes,
        [key]: nextFrames,
      },
    },
    duration,
  );
}

export function getMotionGraphicParamValueAtTime(
  graphic: Partial<MotionGraphic> | undefined,
  key: string,
  time: number,
  duration = Number.POSITIVE_INFINITY,
): MotionGraphicParamValue | undefined {
  const normalized = normalizeMotionGraphic(graphic, duration);
  const definition = getMotionGraphicTemplateDefinition(normalized.templateType);
  const param = definition.params.find((item) => item.key === key);
  if (!param) {
    return undefined;
  }
  const fallback = normalized.params[key];
  if (param.type !== 'number' || typeof fallback !== 'number') {
    return fallback;
  }
  return interpolateMotionGraphicKeyframes(normalized.paramKeyframes?.[key], time, fallback);
}

export function buildMotionGraphicTemplateFile(
  graphic: Partial<MotionGraphic> | undefined,
  options: { duration?: number; width?: number; height?: number } = {},
): MotionGraphicTemplateFile {
  const normalized = normalizeMotionGraphic(graphic, options.duration);
  return {
    format: MOTION_GRAPHIC_FILE_FORMAT,
    version: 1,
    templateType: normalized.templateType,
    params: normalized.params,
    ...(normalized.paramKeyframes ? { paramKeyframes: normalized.paramKeyframes } : {}),
    ...(Number.isFinite(options.duration) ? { duration: round(Math.max(0.001, options.duration!)) } : {}),
    ...(Number.isFinite(options.width) ? { width: Math.max(1, Math.round(options.width!)) } : {}),
    ...(Number.isFinite(options.height) ? { height: Math.max(1, Math.round(options.height!)) } : {}),
  };
}

export function serializeMotionGraphicTemplate(
  graphic: Partial<MotionGraphic> | undefined,
  options: { duration?: number; width?: number; height?: number } = {},
): string {
  return `${JSON.stringify(buildMotionGraphicTemplateFile(graphic, options), null, 2)}\n`;
}

export function parseMotionGraphicTemplate(contents: string): MotionGraphicTemplateFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new Error(`Invalid .ofmgt.json file: ${error instanceof Error ? error.message : 'parse failed'}`);
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid .ofmgt.json file.');
  }
  const input = parsed as Partial<MotionGraphicTemplateFile>;
  if (input.format !== MOTION_GRAPHIC_FILE_FORMAT || input.version !== 1) {
    throw new Error('Unsupported motion graphic template file.');
  }
  const duration = Number.isFinite(input.duration) ? Math.max(0.001, Number(input.duration)) : undefined;
  const graphic = normalizeMotionGraphic(
    {
      version: 1,
      templateType: input.templateType,
      params: input.params,
      paramKeyframes: input.paramKeyframes,
    },
    duration,
  );
  return buildMotionGraphicTemplateFile(graphic, {
    duration,
    width: input.width,
    height: input.height,
  });
}

function normalizeMotionGraphicParamValue(
  param: MotionGraphicParamDefinition,
  value: MotionGraphicParamValue | undefined,
): MotionGraphicParamValue {
  if (param.type === 'number') {
    return normalizeNumber(
      value,
      typeof param.defaultValue === 'number' ? param.defaultValue : 0,
      param.min,
      param.max,
    );
  }
  if (param.type === 'boolean') {
    return value === true;
  }
  if (param.type === 'color') {
    return normalizeColor(value, typeof param.defaultValue === 'string' ? param.defaultValue : '#ffffff');
  }
  if (param.type === 'select') {
    const text = typeof value === 'string' ? value : typeof param.defaultValue === 'string' ? param.defaultValue : '';
    return param.options?.includes(text) ? text : String(param.defaultValue);
  }
  if (param.type === 'number-list') {
    const source = Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? value
            .split(',')
            .map((item) => Number(item.trim()))
            .filter((item) => Number.isFinite(item))
        : Array.isArray(param.defaultValue)
          ? param.defaultValue
          : [];
    const maxItems = Math.max(1, Math.round(param.maxItems ?? 16));
    const normalized = source.slice(0, maxItems).map((item) => normalizeNumber(item, 0, param.min, param.max));
    return normalized.length > 0 ? normalized : [...(Array.isArray(param.defaultValue) ? param.defaultValue : [0])];
  }
  const fallback = typeof param.defaultValue === 'string' ? param.defaultValue : '';
  return String(typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : fallback)
    .trim()
    .slice(0, 120);
}

function normalizeMotionGraphicParamKeyframes(
  input: MotionGraphicParamKeyframes | undefined,
  definition: MotionGraphicTemplateDefinition,
  params: MotionGraphicParams,
  duration: number,
): MotionGraphicParamKeyframes | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }
  const output: MotionGraphicParamKeyframes = {};
  for (const param of definition.params) {
    if (param.type !== 'number' || !param.keyframeable) {
      continue;
    }
    const fallback = params[param.key];
    if (typeof fallback !== 'number') {
      continue;
    }
    const frames = Array.isArray(input[param.key]) ? input[param.key] : [];
    const normalized = frames.flatMap((frame) => {
      if (!frame || typeof frame.time !== 'number' || !Number.isFinite(frame.time)) {
        return [];
      }
      return [normalizeMotionGraphicKeyframe(frame, param, duration)];
    });
    normalized.sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
    if (normalized.length > 0) {
      output[param.key] = normalized;
    }
  }
  return Object.keys(output).length > 0 ? output : undefined;
}

function normalizeMotionGraphicKeyframe(
  input: { id?: string; time: number; value: number; easing?: KeyframeEasing },
  param: MotionGraphicParamDefinition,
  duration: number,
): Keyframe<number> {
  const maxTime = Number.isFinite(duration) ? Math.max(0, duration) : Number.POSITIVE_INFINITY;
  return {
    id: typeof input.id === 'string' && input.id ? input.id : createLocalId('motion-param'),
    time: round(Math.min(maxTime, Math.max(0, input.time))),
    value: normalizeNumber(
      input.value,
      typeof param.defaultValue === 'number' ? param.defaultValue : 0,
      param.min,
      param.max,
    ),
    easing: normalizeEasing(input.easing),
  };
}

function normalizeNumber(value: unknown, fallback: number, min?: number, max?: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  const finite = Number.isFinite(numeric) ? numeric : fallback;
  return round(Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, finite)));
}

function normalizeColor(value: unknown, fallback: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (/^#[0-9a-fA-F]{6}$/.test(text)) {
    return text.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{3}$/.test(text)) {
    return `#${text
      .slice(1)
      .split('')
      .map((char) => char + char)
      .join('')
      .toLowerCase()}`;
  }
  return fallback;
}

function normalizeEasing(easing: unknown): KeyframeEasing {
  return easing === 'ease-in' || easing === 'ease-out' || easing === 'ease-in-out' || easing === 'linear'
    ? easing
    : 'linear';
}

function interpolateMotionGraphicKeyframes(
  frames: Keyframe<number>[] | undefined,
  time: number,
  fallback: number,
): number {
  if (!frames || frames.length === 0) {
    return fallback;
  }
  const sorted = [...frames].sort((left, right) => left.time - right.time);
  const t = round(Math.max(0, time));
  if (t <= sorted[0].time) {
    return sorted[0].value;
  }
  if (t >= sorted[sorted.length - 1].time) {
    return sorted[sorted.length - 1].value;
  }
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const left = sorted[index];
    const right = sorted[index + 1];
    if (t < left.time || t > right.time) {
      continue;
    }
    const span = Math.max(0.000001, right.time - left.time);
    const eased = applyEasing((t - left.time) / span, left.easing);
    return round(left.value + (right.value - left.value) * eased);
  }
  return fallback;
}

function applyEasing(progress: number, easing: KeyframeEasing): number {
  const value = Math.min(1, Math.max(0, progress));
  if (easing === 'ease-in') {
    return value * value;
  }
  if (easing === 'ease-out') {
    return 1 - (1 - value) * (1 - value);
  }
  if (easing === 'ease-in-out') {
    return value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
  }
  return value;
}

function createLocalId(prefix: string): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) {
    return randomUuid;
  }
  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}
