import {
  DEFAULT_CLIP_SPEED,
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_TEXT_STYLE,
  DEFAULT_TRANSFORM,
  createId,
  type ClipKeyframes,
  type Keyframe,
  type KeyframeEasing,
  type TextClip,
  type TextStyle,
  type Timeline,
  type Track,
  type Transform,
} from './model';
import { getTimelineDuration } from './timeline';
import { round } from './time';

export type TitleTemplateId = 'lower-third' | 'fullscreen-title' | 'caption-bar' | 'corner-bug' | 'counter';

export interface TitleTemplateDefinition {
  id: TitleTemplateId;
  defaultDuration: number;
  defaultText: string;
  transform: Transform;
  style: TextStyle;
  keyframes: ClipKeyframes;
}

export interface InstantiateTitleTemplateOptions {
  id?: string;
  name?: string;
  text?: string;
  start?: number;
  duration?: number;
  color?: string;
}

export const TITLE_TEMPLATE_IDS: TitleTemplateId[] = [
  'lower-third',
  'fullscreen-title',
  'caption-bar',
  'corner-bug',
  'counter',
];

export const TITLE_TEMPLATES: TitleTemplateDefinition[] = [
  {
    id: 'lower-third',
    defaultDuration: 5,
    defaultText: 'Lower third',
    transform: { ...DEFAULT_TRANSFORM, x: -260, y: 210 },
    style: { ...DEFAULT_TEXT_STYLE, fontSize: 42, backgroundColor: '#0f172a', backgroundOpacity: 0.72, bold: true },
    keyframes: {
      x: [keyframe('x', 0, -340, 'ease-out'), keyframe('x', 0.35, -260, 'ease-out')],
      opacity: fadeInOutKeyframes(5),
    },
  },
  {
    id: 'fullscreen-title',
    defaultDuration: 4,
    defaultText: 'Title',
    transform: { ...DEFAULT_TRANSFORM, y: -12 },
    style: { ...DEFAULT_TEXT_STYLE, fontSize: 86, bold: true },
    keyframes: {
      opacity: fadeInOutKeyframes(4),
      scaleX: [keyframe('scaleX', 0, 0.92, 'ease-out'), keyframe('scaleX', 0.45, 1, 'ease-out')],
      scaleY: [keyframe('scaleY', 0, 0.92, 'ease-out'), keyframe('scaleY', 0.45, 1, 'ease-out')],
    },
  },
  {
    id: 'caption-bar',
    defaultDuration: 5,
    defaultText: 'Caption',
    transform: { ...DEFAULT_TRANSFORM, y: 250 },
    style: { ...DEFAULT_TEXT_STYLE, fontSize: 38, backgroundColor: '#111827', backgroundOpacity: 0.78 },
    keyframes: {
      opacity: fadeInOutKeyframes(5),
    },
  },
  {
    id: 'corner-bug',
    defaultDuration: 6,
    defaultText: 'LIVE',
    transform: { ...DEFAULT_TRANSFORM, x: 455, y: -285 },
    style: { ...DEFAULT_TEXT_STYLE, fontSize: 28, backgroundColor: '#064e3b', backgroundOpacity: 0.82, bold: true },
    keyframes: {
      opacity: [keyframe('opacity', 0, 0, 'linear'), keyframe('opacity', 0.25, 1, 'ease-out')],
    },
  },
  {
    id: 'counter',
    defaultDuration: 5,
    defaultText: '00:05',
    transform: { ...DEFAULT_TRANSFORM },
    style: {
      ...DEFAULT_TEXT_STYLE,
      fontSize: 96,
      color: '#f8fafc',
      backgroundColor: '#020617',
      backgroundOpacity: 0.18,
      bold: true,
    },
    keyframes: {
      opacity: fadeInOutKeyframes(5),
      scaleX: [keyframe('scaleX', 0, 1.15, 'ease-out'), keyframe('scaleX', 0.35, 1, 'ease-out')],
      scaleY: [keyframe('scaleY', 0, 1.15, 'ease-out'), keyframe('scaleY', 0.35, 1, 'ease-out')],
    },
  },
];

export function getTitleTemplate(templateId: TitleTemplateId): TitleTemplateDefinition {
  const template = TITLE_TEMPLATES.find((item) => item.id === templateId);
  if (!template) {
    throw new Error(`Unknown title template: ${templateId}`);
  }
  return template;
}

export function instantiateTitleTemplate(
  templateId: TitleTemplateId,
  track: Track,
  timeline: Timeline,
  options: InstantiateTitleTemplateOptions = {},
): TextClip {
  if (track.type !== 'text') {
    throw new Error('Title templates can only be placed on text tracks');
  }
  const template = getTitleTemplate(templateId);
  const duration = round(Math.max(1 / 30, options.duration ?? template.defaultDuration));
  const start = round(Math.max(0, options.start ?? findAppendStart(track, timeline)));
  const style = { ...template.style, color: options.color ?? template.style.color };
  return {
    id: options.id ?? createId('clip'),
    type: 'text',
    name: options.name ?? template.defaultText,
    trackId: track.id,
    start,
    duration,
    trimStart: 0,
    trimEnd: 0,
    speed: DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    transform: { ...template.transform },
    text: options.text ?? template.defaultText,
    style,
    keyframes: scaleTemplateKeyframes(template.keyframes, template.defaultDuration, duration),
  };
}

function findAppendStart(track: Track, timeline: Timeline): number {
  const trackEnd = track.clips.reduce((end, clip) => Math.max(end, clip.start + clip.duration), 0);
  return round(Math.max(trackEnd, getTimelineDuration(timeline) === 0 ? 0 : trackEnd));
}

function fadeInOutKeyframes(duration: number): Keyframe<number>[] {
  return [
    keyframe('opacity', 0, 0, 'linear'),
    keyframe('opacity', Math.min(0.35, duration / 3), 1, 'ease-out'),
    keyframe('opacity', Math.max(0, duration - 0.35), 1, 'linear'),
    keyframe('opacity', duration, 0, 'ease-in'),
  ];
}

function keyframe(prefix: string, time: number, value: number, easing: KeyframeEasing): Keyframe<number> {
  return { id: createId(`kf-${prefix}`), time: round(time), value, easing };
}

function scaleTemplateKeyframes(keyframes: ClipKeyframes, templateDuration: number, duration: number): ClipKeyframes {
  const ratio = templateDuration > 0 ? duration / templateDuration : 1;
  const output: ClipKeyframes = {};
  for (const property of Object.keys(keyframes) as Array<keyof ClipKeyframes>) {
    const frames = keyframes[property];
    if (frames?.length) {
      output[property] = frames.map((frame) => ({
        ...frame,
        id: createId(`kf-${property}`),
        time: round(Math.min(duration, Math.max(0, frame.time * ratio))),
      }));
    }
  }
  return output;
}
