import {
  DEFAULT_CLIP_SPEED,
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_SUBTITLE_MODE,
  DEFAULT_SUBTITLE_STYLE,
  DEFAULT_TRANSFORM,
  createId,
  createTrack,
  getClipSpeed,
  parseSubtitleDataImport,
  parseSrt,
  round,
  type ProjectSpeaker,
  type SubtitleDataCue,
  type SubtitleDataImportFormat,
  type Timeline,
  type Track,
} from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { fileNameFromPath } from './tauri';
import { openFileDialog, readFile } from './tauri-bridge';

const SUBTITLE_EXTENSIONS = ['srt', 'vtt'];
const SUBTITLE_DATA_EXTENSIONS = ['csv', 'json'];

export async function pickSubtitlePaths(): Promise<string[]> {
  return openFileDialog(true, [{ name: zhCN.fileDialogs.subtitles, extensions: SUBTITLE_EXTENSIONS }]);
}

export async function pickSubtitleDataPaths(): Promise<string[]> {
  return openFileDialog(true, [{ name: zhCN.fileDialogs.subtitleData, extensions: SUBTITLE_DATA_EXTENSIONS }]);
}

export async function readSubtitleText(path: string): Promise<string> {
  return readFile(path);
}

export interface SubtitleTimingOptions {
  timelineStart?: number;
  sourceStart?: number;
  sourceDuration?: number;
  speed?: number;
}

export function buildSubtitleTrackFromSrt(
  path: string,
  contents: string,
  timeline: Timeline,
  timing: SubtitleTimingOptions = {},
): Track {
  const cues = parseSrt(contents);
  const trackId = createId('track');
  const name = fileNameFromPath(path).replace(/\.[^.]+$/, '') || zhCN.inspector.sections.subtitle;
  const trackNumber = timeline.tracks.filter((track) => track.type === 'subtitle').length + 1;
  const timelineStart = round(Math.max(0, timing.timelineStart ?? 0));
  const sourceStart = round(Math.max(0, timing.sourceStart ?? 0));
  const sourceEnd =
    typeof timing.sourceDuration === 'number' ? round(sourceStart + Math.max(0, timing.sourceDuration)) : undefined;
  const speed = getClipSpeed({ speed: timing.speed });
  const subtitleType = cues.some((cue) => cue.subtitleType === 'cc') ? 'cc' : 'subtitle';
  return createTrack({
    id: trackId,
    type: 'subtitle',
    subtitleType,
    name: `${name} ${trackNumber}`,
    clips: cues
      .map((cue) => {
        const cueStart = cue.startMs / 1000;
        const cueEnd = cue.endMs / 1000;
        const clippedStart = Math.max(cueStart, sourceStart);
        const clippedEnd = Math.min(cueEnd, sourceEnd ?? cueEnd);
        if (clippedEnd <= clippedStart) {
          return undefined;
        }
        return {
          id: createId('clip'),
          type: 'subtitle' as const,
          name: `${zhCN.inspector.sections.subtitle} ${cue.index}`,
          trackId,
          start: round(timelineStart + (clippedStart - sourceStart) / speed),
          duration: round((clippedEnd - clippedStart) / speed),
          trimStart: 0,
          trimEnd: 0,
          speed: DEFAULT_CLIP_SPEED,
          colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
          transform: { ...DEFAULT_TRANSFORM },
          text: cue.text,
          subtitleType: cue.subtitleType ?? subtitleType,
          speaker: cue.speaker,
          soundDesc: cue.soundDesc,
          style: { ...DEFAULT_SUBTITLE_STYLE },
          subtitleMode: DEFAULT_SUBTITLE_MODE,
        };
      })
      .filter((clip): clip is NonNullable<typeof clip> => Boolean(clip)),
  });
}

export function collectSubtitleSpeakersFromTrack(track: Track): ProjectSpeaker[] {
  const seen = new Set<string>();
  const speakers: ProjectSpeaker[] = [];
  for (const clip of track.clips) {
    if (clip.type !== 'subtitle' || !clip.speaker?.trim()) {
      continue;
    }
    const name = clip.speaker.trim();
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    speakers.push({ id: createId('speaker'), name });
  }
  return speakers;
}

export function parseSubtitleDataFile(path: string, contents: string): SubtitleDataCue[] {
  return parseSubtitleDataImport(contents, inferSubtitleDataFormat(path));
}

export function buildSubtitleTrackFromDataCues(
  path: string,
  cues: SubtitleDataCue[],
  timeline: Timeline,
  targetTrackId?: string,
): Track {
  const trackId = targetTrackId ?? createId('track');
  const name = fileNameFromPath(path).replace(/\.[^.]+$/, '') || zhCN.inspector.sections.subtitle;
  const trackNumber = timeline.tracks.filter((track) => track.type === 'subtitle').length + 1;
  return createTrack({
    id: trackId,
    type: 'subtitle',
    name: `${name} ${trackNumber}`,
    clips: cues.map((cue, index) => ({
      id: createId('clip'),
      type: 'subtitle' as const,
      name: `${zhCN.inspector.sections.subtitle} ${index + 1}`,
      trackId,
      start: round(cue.start),
      duration: round(cue.end - cue.start),
      trimStart: 0,
      trimEnd: 0,
      speed: DEFAULT_CLIP_SPEED,
      colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
      transform: { ...DEFAULT_TRANSFORM },
      text: cue.text,
      style: { ...DEFAULT_SUBTITLE_STYLE, ...cue.style },
      subtitleMode: DEFAULT_SUBTITLE_MODE,
    })),
  });
}

export function isSubtitlePath(path: string): boolean {
  return SUBTITLE_EXTENSIONS.some((extension) => path.toLowerCase().endsWith(`.${extension}`));
}

function inferSubtitleDataFormat(path: string): SubtitleDataImportFormat {
  return path.toLowerCase().endsWith('.json') ? 'json' : 'csv';
}
