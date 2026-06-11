import {
  getProjectPrimaryTimeline,
  getProjectSequences,
  type Clip,
  type MediaAsset,
  type Project,
  type Sequence,
  type Timeline,
  type TrackType
} from '../model';
import { getClipSourceVisibleDuration, getTimelineDuration } from '../timeline';
import { round } from '../time';

export type TimelineExportFormat = 'edl' | 'fcp-xml';

export interface TimelineExportEvent {
  id: string;
  clipId: string;
  name: string;
  sourceName: string;
  sourcePath?: string;
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
      `${edit}  AX       V     C        ${secondsToTimecode(event.sourceStart, fps)} ${secondsToTimecode(event.sourceEnd, fps)} ${secondsToTimecode(event.recordStart, fps)} ${secondsToTimecode(event.recordEnd, fps)}`
    );
    lines.push(`* FROM CLIP NAME: ${sanitizeEdlText(event.name)}`);
    if (event.sourcePath) {
      lines.push(`* SOURCE FILE: ${sanitizeEdlText(event.sourcePath)}`);
    }
    lines.push('');
  });
  return `${lines.join('\n').trimEnd()}\n`;
}

export function exportFinalCutXml(project: Project): string {
  const fps = normalizeFps(project.settings.fps);
  const durationFrames = secondsToFrames(getTimelineDuration(getProjectPrimaryTimeline(project)), fps);
  const events = flattenTimelineForExport(project);
  const videoEvents = events.filter((event) => event.trackType === 'video');
  const audioEvents = events.filter((event) => event.trackType === 'audio');
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
    ...videoEvents.map((event, index) => clipItemXml(event, index, fps, 10)),
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
    ''
  ]
    .filter(Boolean)
    .join('\n');
}

export function flattenTimelineForExport(project: Project): TimelineExportEvent[] {
  const sequences = getProjectSequences(project);
  const primary = getProjectPrimaryTimeline(project);
  const mediaById = new Map(project.media.map((asset) => [asset.id, asset]));
  return collectTimelineEvents(primary, sequences, mediaById, new Set([sequences.find((sequence) => sequence.timeline === primary)?.id ?? 'sequence-main']))
    .filter((event) => event.recordEnd > event.recordStart)
    .sort((left, right) => left.recordStart - right.recordStart || left.trackType.localeCompare(right.trackType) || left.name.localeCompare(right.name));
}

function collectTimelineEvents(timeline: Timeline, sequences: Sequence[], mediaById: Map<string, MediaAsset>, visited: Set<string>): TimelineExportEvent[] {
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
        const nestedEvents = collectTimelineEvents(sequence.timeline, sequences, mediaById, new Set([...visited, clip.sequenceId]));
        events.push(...mapNestedEvents(clip, nestedEvents));
        continue;
      }
      const media = 'mediaId' in clip ? mediaById.get(clip.mediaId) : undefined;
      if ((track.type === 'video' && (clip.type === 'video' || clip.type === 'image')) || (track.type === 'audio' && clip.type === 'audio')) {
        events.push(clipToEvent(clip, track.type, media));
      }
    }
  }
  return events;
}

function mapNestedEvents(clip: Extract<Clip, { type: 'nested-sequence' }>, nestedEvents: TimelineExportEvent[]): TimelineExportEvent[] {
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
        sourceEnd: round(event.sourceStart + startOffset + (nestedEnd - nestedStart))
      }
    ];
  });
}

function clipToEvent(clip: Clip, trackType: TrackType, media?: MediaAsset): TimelineExportEvent {
  const sourceStart = clip.type === 'image' ? 0 : clip.trimStart;
  const sourceEnd = clip.type === 'image' ? clip.duration : clip.trimStart + Math.min(getClipSourceVisibleDuration(clip), clip.duration);
  return {
    id: clip.id,
    clipId: clip.id,
    name: clip.name,
    sourceName: media?.name ?? clip.name,
    sourcePath: media?.path,
    trackType,
    recordStart: clip.start,
    recordEnd: round(clip.start + clip.duration),
    sourceStart: round(sourceStart),
    sourceEnd: round(sourceEnd)
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
    `${pad}</clipitem>`
  ]
    .filter(Boolean)
    .join('\n');
}

function rateXml(fps: number, indent: number): string {
  const pad = ' '.repeat(indent);
  return [`<rate>`, `${pad}  <timebase>${fps}</timebase>`, `${pad}  <ntsc>FALSE</ntsc>`, `${pad}</rate>`].join(`\n${pad}`);
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

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function pathToFileUrl(path: string): string {
  return `file://localhost/${path.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '$1%3A')}`;
}

function sortClipsByTime<TClip extends { start: number; id: string }>(clips: TClip[]): TClip[] {
  return [...clips].sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
}
