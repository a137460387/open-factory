import type { SubtitleClip } from '../model';

export interface SrtCue {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

const TIMECODE_PATTERN = /^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})$/;

export function parseSrt(contents: string): SrtCue[] {
  const normalized = contents.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) {
    return [];
  }
  return normalized
    .split(/\n{2,}/)
    .map((block, blockIndex) => parseSrtBlock(block, blockIndex))
    .filter((cue): cue is SrtCue => Boolean(cue));
}

export function parseSrtTimecodeMs(value: string): number {
  const match = TIMECODE_PATTERN.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid SRT timecode: ${value}`);
  }
  const [, hours, minutes, seconds, milliseconds] = match;
  return (
    Number(hours) * 60 * 60 * 1000 +
    Number(minutes) * 60 * 1000 +
    Number(seconds) * 1000 +
    Number(milliseconds)
  );
}

export function serializeSrt(cues: Array<Pick<SrtCue, 'startMs' | 'endMs' | 'text'>>): string {
  return cues
    .map((cue, index) =>
      [
        String(index + 1),
        `${formatSrtTimecode(cue.startMs)} --> ${formatSrtTimecode(cue.endMs)}`,
        cue.text.trimEnd()
      ].join('\n')
    )
    .join('\n\n')
    .concat(cues.length > 0 ? '\n' : '');
}

export function serializeSubtitleClipsToSrt(clips: SubtitleClip[]): string {
  const cues = clips
    .filter((clip) => clip.duration > 0 && clip.text.trim().length > 0)
    .sort((left, right) => left.start - right.start || left.id.localeCompare(right.id))
    .map((clip) => ({
      startMs: secondsToMs(clip.start),
      endMs: secondsToMs(clip.start + clip.duration),
      text: clip.text
    }));
  return serializeSrt(cues);
}

export function formatSrtTimecode(milliseconds: number): string {
  const total = Math.max(0, Math.round(milliseconds));
  const ms = total % 1000;
  const totalSeconds = Math.floor(total / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(ms, 3)}`;
}

function parseSrtBlock(block: string, blockIndex: number): SrtCue | undefined {
  const lines = block.split('\n').map((line) => line.trimEnd());
  const timingIndex = lines.findIndex((line) => line.includes('-->'));
  if (timingIndex === -1) {
    return undefined;
  }
  const [startRaw, endRaw] = lines[timingIndex].split('-->').map((part) => part.trim());
  if (!startRaw || !endRaw) {
    return undefined;
  }
  const startMs = parseSrtTimecodeMs(startRaw);
  const endMs = parseSrtTimecodeMs(endRaw.split(/\s+/)[0]);
  if (endMs <= startMs) {
    return undefined;
  }
  const explicitIndex = timingIndex > 0 ? Number(lines[timingIndex - 1]) : NaN;
  return {
    index: Number.isFinite(explicitIndex) && explicitIndex > 0 ? explicitIndex : blockIndex + 1,
    startMs,
    endMs,
    text: lines.slice(timingIndex + 1).join('\n').trim()
  };
}

function secondsToMs(seconds: number): number {
  return Math.round(Math.max(0, seconds) * 1000);
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}
