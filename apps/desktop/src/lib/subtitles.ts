import {
  DEFAULT_CLIP_SPEED,
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_SUBTITLE_MODE,
  DEFAULT_SUBTITLE_STYLE,
  DEFAULT_TRANSFORM,
  createId,
  createTrack,
  parseSrt,
  type Timeline,
  type Track
} from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { fileNameFromPath } from './tauri';
import { openFileDialog, readFile } from './tauri-bridge';

export const SUBTITLE_EXTENSIONS = ['srt'];

export async function pickSubtitlePaths(): Promise<string[]> {
  return openFileDialog(true, [{ name: zhCN.fileDialogs.subtitles, extensions: SUBTITLE_EXTENSIONS }]);
}

export async function readSubtitleText(path: string): Promise<string> {
  return readFile(path);
}

export function buildSubtitleTrackFromSrt(path: string, contents: string, timeline: Timeline): Track {
  const cues = parseSrt(contents);
  const trackId = createId('track');
  const name = fileNameFromPath(path).replace(/\.[^.]+$/, '') || zhCN.inspector.sections.subtitle;
  const trackNumber = timeline.tracks.filter((track) => track.type === 'subtitle').length + 1;
  return createTrack({
    id: trackId,
    type: 'subtitle',
    name: `${name} ${trackNumber}`,
    clips: cues.map((cue) => ({
      id: createId('clip'),
      type: 'subtitle' as const,
      name: `${zhCN.inspector.sections.subtitle} ${cue.index}`,
      trackId,
      start: cue.startMs / 1000,
      duration: (cue.endMs - cue.startMs) / 1000,
      trimStart: 0,
      trimEnd: 0,
      speed: DEFAULT_CLIP_SPEED,
      colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
      transform: { ...DEFAULT_TRANSFORM },
      text: cue.text,
      style: { ...DEFAULT_SUBTITLE_STYLE },
      subtitleMode: DEFAULT_SUBTITLE_MODE
    }))
  });
}

export function isSubtitlePath(path: string): boolean {
  return SUBTITLE_EXTENSIONS.some((extension) => path.toLowerCase().endsWith(`.${extension}`));
}
