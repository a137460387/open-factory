import {
  getProjectPrimaryTimeline,
  getProjectSequences,
  isDefaultColorCorrection,
  normalizeColorCorrection,
  normalizeTransitionDuration,
  normalizeTransitionType,
  type Clip,
  type ColorCorrection,
  type MediaAsset,
  type Project,
  type Sequence,
  type Timeline,
  type Transition,
  type TrackType,
} from '../model';
import { getClipSourceVisibleDuration, getTimelineDuration } from '../timeline';
import { round } from '../time';
import { isDefaultColorCurves, isNeutralThreeWayColor } from '../color-grading';

export type TimelineExportFormat = 'edl' | 'fcp-xml';
export type ProfessionalNleExportFormat = 'aaf' | 'omf' | 'fcp-xml';
export type ProfessionalNleMediaMode = 'link' | 'copy';

export interface TimelineExportOptions {
  mediaPathMap?: Record<string, string> | Map<string, string>;
}

export interface ProfessionalNleExportOptions extends TimelineExportOptions {
  mediaMode?: ProfessionalNleMediaMode;
}

export interface TimelineExportEvent {
  id: string;
  clipId: string;
  clipType: Clip['type'];
  name: string;
  sourceName: string;
  sourcePath?: string;
  colorCorrection: ColorCorrection;
  trackType: TrackType;
  recordStart: number;
  recordEnd: number;
  sourceStart: number;
  sourceEnd: number;
}

export function exportTimeline(project: Project, format: TimelineExportFormat): string {
  return format === 'fcp-xml' ? exportFinalCutXml(project) : exportCmx3600Edl(project);
}

export function exportCmx3600Edl(project: Project): string {
  const fps = normalizeFps(project.settings.fps);
  const events = flattenTimelineForExport(project).filter((event) => event.trackType === 'video');
  const lines = [`TITLE: ${sanitizeEdlText(project.name)}`, 'FCM: NON-DROP FRAME', ''];
  events.forEach((event, index) => {
    const edit = String(index + 1).padStart(3, '0');
    lines.push(
      `${edit}  AX       V     C        ${secondsToTimecode(event.sourceStart, fps)} ${secondsToTimecode(event.sourceEnd, fps)} ${secondsToTimecode(event.recordStart, fps)} ${secondsToTimecode(event.recordEnd, fps)}`,
    );
    lines.push(`* FROM CLIP NAME: ${sanitizeEdlText(event.name)}`);
    if (event.sourcePath) {
      lines.push(`* SOURCE FILE: ${sanitizeEdlText(event.sourcePath)}`);
    }
    lines.push('');
  });
  return `${lines.join('\n').trimEnd()}\n`;
}

export function exportFinalCutXml(project: Project, options: TimelineExportOptions = {}): string {
  const fps = normalizeFps(project.settings.fps);
  const durationFrames = secondsToFrames(getTimelineDuration(getProjectPrimaryTimeline(project)), fps);
  const events = flattenTimelineForExport(project, options);
  const videoEvents = events.filter((event) => event.trackType === 'video');
  const audioEvents = events.filter((event) => event.trackType === 'audio');
  const transitionByPair = new Map<string, Transition>();
  for (const transition of getProjectPrimaryTimeline(project).transitions ?? []) {
    transitionByPair.set(`${transition.fromClipId}->${transition.toClipId}`, transition);
  }
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE xmeml>',
    '<xmeml version="4">',
    `  <sequence id="${escapeXml(project.id)}">`,
    `    <name>${escapeXml(project.name)}</name>`,
    `    ${rateXml(fps, 2)}`,
    `    <duration>${durationFrames}</duration>`,
    '    <media>',
    '      <video>',
    '        <track>',
    ...videoEvents.flatMap((event, index) => {
      const next = videoEvents[index + 1];
      const transition = next ? transitionByPair.get(`${event.clipId}->${next.clipId}`) : undefined;
      return [
        clipItemXml(event, index, fps, 10),
        ...(transition ? [transitionItemXml(transition, index, event, fps, 10)] : []),
      ];
    }),
    '        </track>',
    '      </video>',
    audioEvents.length > 0 ? '      <audio>' : '',
    audioEvents.length > 0 ? '        <track>' : '',
    ...audioEvents.map((event, index) => clipItemXml(event, index + videoEvents.length, fps, 10)),
    audioEvents.length > 0 ? '        </track>' : '',
    audioEvents.length > 0 ? '      </audio>' : '',
    '    </media>',
    '  </sequence>',
    '</xmeml>',
    '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function exportProfessionalNle(
  project: Project,
  format: ProfessionalNleExportFormat,
  options: ProfessionalNleExportOptions = {},
): string {
  if (format === 'aaf') {
    return exportAaf(project, options);
  }
  if (format === 'omf') {
    return exportOmf(project, options);
  }
  return exportFinalCutXml(project, options);
}

export function exportAaf(project: Project, options: ProfessionalNleExportOptions = {}): string {
  const fps = normalizeFps(project.settings.fps);
  const events = flattenTimelineForExport(project, options).filter(
    (event) => event.trackType === 'video' || event.trackType === 'audio',
  );
  const lines = [
    'AAF',
    `MasterMob: ${sanitizeAafText(project.name)}`,
    `MobRate: ${fps}`,
    `MediaMode: ${options.mediaMode ?? 'link'}`,
    `MobSlotCount: ${events.length}`,
    '',
  ];
  events.forEach((event, index) => {
    lines.push(
      `MobSlot ${index + 1}`,
      `SourceClip ${sanitizeAafText(event.name)}`,
      `MobSlotTimecode ${secondsToTimecode(event.recordStart, fps)} -> ${secondsToTimecode(event.recordEnd, fps)}`,
      `SourceMob ${sanitizeAafText(event.sourceName)}`,
      event.sourcePath ? `SourcePath ${sanitizeAafText(event.sourcePath)}` : 'SourcePath <generated>',
      `MasterMob ${sanitizeAafText(project.name)}`,
      '',
    );
  });
  return `${lines.join('\n').trimEnd()}\n`;
}

export function exportOmf(project: Project, options: ProfessionalNleExportOptions = {}): string {
  const fps = normalizeFps(project.settings.fps);
  const events = flattenTimelineForExport(project, options).filter(
    (event) => event.trackType === 'video' || event.trackType === 'audio',
  );
  const lines = [
    'OMFI 2.0',
    `MasterMob: ${sanitizeAafText(project.name)}`,
    `MobRate: ${fps}`,
    `MediaMode: ${options.mediaMode ?? 'link'}`,
    '',
  ];
  events.forEach((event, index) => {
    lines.push(
      `MobSlot ${index + 1}`,
      `SourceClip ${sanitizeAafText(event.name)}`,
      `MobSlotTimecode ${secondsToTimecode(event.recordStart, fps)} -> ${secondsToTimecode(event.recordEnd, fps)}`,
      event.sourcePath ? `SourcePath ${sanitizeAafText(event.sourcePath)}` : 'SourcePath <generated>',
      '',
    );
  });
  return `${lines.join('\n').trimEnd()}\n`;
}

export function flattenTimelineForExport(project: Project, options: TimelineExportOptions = {}): TimelineExportEvent[] {
  const sequences = getProjectSequences(project);
  const primary = getProjectPrimaryTimeline(project);
  const mediaById = new Map(project.media.map((asset) => [asset.id, asset]));
  return collectTimelineEvents(
    primary,
    sequences,
    mediaById,
    new Set([sequences.find((sequence) => sequence.timeline === primary)?.id ?? 'sequence-main']),
    options.mediaPathMap,
  )
    .filter((event) => event.recordEnd > event.recordStart)
    .sort(
      (left, right) =>
        left.recordStart - right.recordStart ||
        left.trackType.localeCompare(right.trackType) ||
        left.name.localeCompare(right.name),
    );
}

function collectTimelineEvents(
  timeline: Timeline,
  sequences: Sequence[],
  mediaById: Map<string, MediaAsset>,
  visited: Set<string>,
  mediaPathMap?: Record<string, string> | Map<string, string>,
): TimelineExportEvent[] {
  const events: TimelineExportEvent[] = [];
  for (const track of timeline.tracks) {
    if (track.type === 'text') {
      continue;
    }
    for (const clip of sortClipsByTime(track.clips)) {
      if (clip.type === 'nested-sequence') {
        if (visited.has(clip.sequenceId)) {
          continue;
        }
        const sequence = sequences.find((item) => item.id === clip.sequenceId);
        if (!sequence) {
          continue;
        }
        const nestedEvents = collectTimelineEvents(
          sequence.timeline,
          sequences,
          mediaById,
          new Set([...visited, clip.sequenceId]),
          mediaPathMap,
        );
        events.push(...mapNestedEvents(clip, nestedEvents));
        continue;
      }
      const media = 'mediaId' in clip ? mediaById.get(clip.mediaId) : undefined;
      if (
        (track.type === 'video' &&
          (clip.type === 'video' || clip.type === 'image' || clip.type === 'motion-graphic')) ||
        (track.type === 'audio' && clip.type === 'audio')
      ) {
        events.push(clipToEvent(clip, track.type, media, mediaPathMap));
      }
    }
  }
  return events;
}

function mapNestedEvents(
  clip: Extract<Clip, { type: 'nested-sequence' }>,
  nestedEvents: TimelineExportEvent[],
): TimelineExportEvent[] {
  const visibleStart = clip.trimStart;
  const visibleEnd = clip.trimStart + clip.duration;
  return nestedEvents.flatMap((event) => {
    const nestedStart = Math.max(event.recordStart, visibleStart);
    const nestedEnd = Math.min(event.recordEnd, visibleEnd);
    if (nestedEnd <= nestedStart) {
      return [];
    }
    const startOffset = nestedStart - event.recordStart;
    return [
      {
        ...event,
        id: `${clip.id}:${event.id}`,
        recordStart: round(clip.start + nestedStart - visibleStart),
        recordEnd: round(clip.start + nestedEnd - visibleStart),
        sourceStart: round(event.sourceStart + startOffset),
        sourceEnd: round(event.sourceStart + startOffset + (nestedEnd - nestedStart)),
      },
    ];
  });
}

function clipToEvent(
  clip: Clip,
  trackType: TrackType,
  media?: MediaAsset,
  mediaPathMap?: Record<string, string> | Map<string, string>,
): TimelineExportEvent {
  const sourceStart = clip.type === 'image' || clip.type === 'motion-graphic' ? 0 : clip.trimStart;
  const sourceEnd =
    clip.type === 'image' || clip.type === 'motion-graphic'
      ? clip.duration
      : clip.trimStart + Math.min(getClipSourceVisibleDuration(clip), clip.duration);
  return {
    id: clip.id,
    clipId: clip.id,
    clipType: clip.type,
    name: clip.name,
    sourceName: media?.name ?? clip.name,
    sourcePath: resolveMediaPath(media?.path, mediaPathMap),
    colorCorrection: normalizeColorCorrection(clip.colorCorrection),
    trackType,
    recordStart: clip.start,
    recordEnd: round(clip.start + clip.duration),
    sourceStart: round(sourceStart),
    sourceEnd: round(sourceEnd),
  };
}

function clipItemXml(event: TimelineExportEvent, index: number, fps: number, indent: number): string {
  const pad = ' '.repeat(indent);
  const start = secondsToFrames(event.recordStart, fps);
  const end = secondsToFrames(event.recordEnd, fps);
  const sourceIn = secondsToFrames(event.sourceStart, fps);
  const sourceOut = secondsToFrames(event.sourceEnd, fps);
  const fileId = `file-${index + 1}`;
  return [
    `${pad}<clipitem id="clipitem-${index + 1}">`,
    `${pad}  <name>${escapeXml(event.name)}</name>`,
    `${pad}  ${rateXml(fps, 2)}`,
    `${pad}  <start>${start}</start>`,
    `${pad}  <end>${end}</end>`,
    `${pad}  <in>${sourceIn}</in>`,
    `${pad}  <out>${sourceOut}</out>`,
    `${pad}  <file id="${fileId}">`,
    `${pad}    <name>${escapeXml(event.sourceName)}</name>`,
    event.sourcePath ? `${pad}    <pathurl>${escapeXml(pathToFileUrl(event.sourcePath))}</pathurl>` : '',
    `${pad}  </file>`,
    ...buildColorCorrectionXml(event.colorCorrection, indent + 2),
    `${pad}</clipitem>`,
  ]
    .filter(Boolean)
    .join('\n');
}

function transitionItemXml(
  transition: Transition,
  index: number,
  event: TimelineExportEvent,
  fps: number,
  indent: number,
): string {
  const pad = ' '.repeat(indent);
  const durationFrames = secondsToFrames(normalizeTransitionDuration(transition.duration), fps);
  const start = secondsToFrames(Math.max(0, event.recordEnd - transition.duration), fps);
  const end = start + durationFrames;
  const name = transition.type === 'fade-black' ? 'Fade Through Black' : 'Cross Dissolve';
  return [
    `${pad}<transitionitem id="transitionitem-${index + 1}">`,
    `${pad}  <name>${escapeXml(name)}</name>`,
    `${pad}  <start>${start}</start>`,
    `${pad}  <end>${end}</end>`,
    `${pad}  <effect>`,
    `${pad}    <name>${escapeXml(name)}</name>`,
    `${pad}    <effectid>${escapeXml(normalizeTransitionType(transition.type))}</effectid>`,
    `${pad}  </effect>`,
    `${pad}</transitionitem>`,
  ].join('\n');
}

function buildColorCorrectionXml(colorCorrection: ColorCorrection, indent: number): string[] {
  if (isDefaultColorCorrection(colorCorrection)) {
    return [];
  }
  const pad = ' '.repeat(indent);
  const lines = [
    `${pad}<filter>`,
    `${pad}  <effect>`,
    `${pad}    <name>Open Factory Color Correction</name>`,
    `${pad}    <effectid>open-factory-color-correction</effectid>`,
    `${pad}    <parameter><name>Brightness</name><value>${formatXmlNumber(colorCorrection.brightness)}</value></parameter>`,
    `${pad}    <parameter><name>Contrast</name><value>${formatXmlNumber(colorCorrection.contrast)}</value></parameter>`,
    `${pad}    <parameter><name>Saturation</name><value>${formatXmlNumber(colorCorrection.saturation)}</value></parameter>`,
    `${pad}    <parameter><name>Hue</name><value>${formatXmlNumber(colorCorrection.hue)}</value></parameter>`,
  ];
  if (colorCorrection.lutPath) {
    lines.push(
      `${pad}    <parameter><name>LUT Path</name><value>${escapeXml(colorCorrection.lutPath)}</value></parameter>`,
    );
  }
  if (!isDefaultColorCurves(colorCorrection.colorCurves)) {
    lines.push(`${pad}    <parameter><name>Color Curves</name><value>present</value></parameter>`);
  }
  if (!isNeutralThreeWayColor(colorCorrection.threeWayColor)) {
    lines.push(`${pad}    <parameter><name>Three-Way Color</name><value>present</value></parameter>`);
  }
  lines.push(`${pad}  </effect>`, `${pad}</filter>`);
  return lines;
}

function rateXml(fps: number, indent: number): string {
  const pad = ' '.repeat(indent);
  return [`<rate>`, `${pad}  <timebase>${fps}</timebase>`, `${pad}  <ntsc>FALSE</ntsc>`, `${pad}</rate>`].join(
    `\n${pad}`,
  );
}

function secondsToFrames(seconds: number, fps: number): number {
  return Math.max(0, Math.round(seconds * fps));
}

function secondsToTimecode(seconds: number, fps: number): string {
  const totalFrames = secondsToFrames(seconds, fps);
  const frames = totalFrames % fps;
  const totalSeconds = Math.floor(totalFrames / fps);
  const secs = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  return [hours, minutes, secs, frames].map((value) => String(value).padStart(2, '0')).join(':');
}

function normalizeFps(fps: number): number {
  return Math.max(1, Math.round(Number.isFinite(fps) ? fps : 30));
}

function sanitizeEdlText(value: string): string {
  return value.replace(/\r?\n/g, ' ').trim();
}

function sanitizeAafText(value: string): string {
  return sanitizeEdlText(value).replace(/[<>"]/g, ' ');
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatXmlNumber(value: number): string {
  return round(value).toString();
}

function resolveMediaPath(
  path: string | undefined,
  mediaPathMap?: Record<string, string> | Map<string, string>,
): string | undefined {
  if (!path || !mediaPathMap) {
    return path;
  }
  if (mediaPathMap instanceof Map) {
    return mediaPathMap.get(path) ?? path;
  }
  return mediaPathMap[path] ?? path;
}

function pathToFileUrl(path: string): string {
  return `file://localhost/${path.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '$1%3A')}`;
}

function sortClipsByTime<TClip extends { start: number; id: string }>(clips: TClip[]): TClip[] {
  return [...clips].sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
}
