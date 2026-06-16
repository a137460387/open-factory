import { round, secondsToTimecode, type TimecodeFormat } from '../time';

export type SubtitleProofreadingIssueType = 'too-short' | 'too-long' | 'reading-speed' | 'overlap' | 'blank';

export interface SubtitleProofreadingClipInput {
  id: string;
  trackId?: string;
  start: number;
  duration: number;
  text: string;
}

export interface SubtitleProofreadingSettings {
  minDuration?: number;
  maxDuration?: number;
  chineseMaxCharsPerSecond?: number;
  englishMaxCharsPerSecond?: number;
}

export interface SubtitleProofreadingIssue {
  id: string;
  type: SubtitleProofreadingIssueType;
  clipId: string;
  relatedClipId?: string;
  trackId?: string;
  start: number;
  duration: number;
  text: string;
  value?: number;
  limit?: number;
}

export interface SubtitleProofreadingFix {
  clipId: string;
  duration?: number;
  delete?: boolean;
}

type NormalizedSubtitleProofreadingClip = Required<Pick<SubtitleProofreadingClipInput, 'id' | 'start' | 'duration' | 'text'>> & Pick<SubtitleProofreadingClipInput, 'trackId'>;

export const DEFAULT_SUBTITLE_PROOFREADING_SETTINGS = {
  minDuration: 1,
  maxDuration: 7,
  chineseMaxCharsPerSecond: 12,
  englishMaxCharsPerSecond: 20
} as const satisfies Required<SubtitleProofreadingSettings>;

const EPSILON = 0.000001;

export function analyzeSubtitleProofreading(clips: SubtitleProofreadingClipInput[], settings: SubtitleProofreadingSettings = {}): SubtitleProofreadingIssue[] {
  const normalizedSettings = normalizeSubtitleProofreadingSettings(settings);
  const normalizedClips = normalizeSubtitleProofreadingClips(clips);
  const issues: SubtitleProofreadingIssue[] = [];

  for (const clip of normalizedClips) {
    if (!clip.text.trim()) {
      issues.push(createIssue('blank', clip));
      continue;
    }
    if (clip.duration < normalizedSettings.minDuration - EPSILON) {
      issues.push(createIssue('too-short', clip, { value: clip.duration, limit: normalizedSettings.minDuration }));
    }
    if (clip.duration > normalizedSettings.maxDuration + EPSILON) {
      issues.push(createIssue('too-long', clip, { value: clip.duration, limit: normalizedSettings.maxDuration }));
    }
    const readingStats = calculateSubtitleReadingSpeed(clip.text, clip.duration);
    if (readingStats.speed > readingStats.limit + EPSILON) {
      issues.push(createIssue('reading-speed', clip, { value: readingStats.speed, limit: readingStats.limit }));
    }
  }

  for (const [trackId, trackClips] of groupSubtitleClipsByTrack(normalizedClips)) {
    for (let index = 0; index < trackClips.length - 1; index += 1) {
      const current = trackClips[index];
      const next = trackClips[index + 1];
      const currentEnd = current.start + current.duration;
      if (next.start < currentEnd - EPSILON) {
        issues.push(createIssue('overlap', current, { relatedClipId: next.id, value: round(currentEnd - next.start), trackId }));
      }
    }
  }

  return issues.sort((left, right) => left.start - right.start || left.clipId.localeCompare(right.clipId) || left.type.localeCompare(right.type));
}

export function calculateSubtitleReadingSpeed(
  text: string,
  duration: number,
  settings: SubtitleProofreadingSettings = {}
): { speed: number; characterCount: number; language: 'chinese' | 'english'; limit: number } {
  const normalizedSettings = normalizeSubtitleProofreadingSettings(settings);
  const language = hasChineseText(text) ? 'chinese' : 'english';
  const characterCount = countReadableCharacters(text);
  const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;
  const speed = safeDuration > EPSILON ? round(characterCount / safeDuration) : characterCount > 0 ? Number.POSITIVE_INFINITY : 0;
  return {
    speed,
    characterCount,
    language,
    limit: language === 'chinese' ? normalizedSettings.chineseMaxCharsPerSecond : normalizedSettings.englishMaxCharsPerSecond
  };
}

export function buildSubtitleProofreadingFixes(
  clips: SubtitleProofreadingClipInput[],
  issues: SubtitleProofreadingIssue[],
  settings: SubtitleProofreadingSettings = {}
): SubtitleProofreadingFix[] {
  const normalizedSettings = normalizeSubtitleProofreadingSettings(settings);
  const clipsById = new Map(normalizeSubtitleProofreadingClips(clips).map((clip) => [clip.id, clip]));
  const fixesByClipId = new Map<string, SubtitleProofreadingFix>();

  for (const issue of issues) {
    const clip = clipsById.get(issue.clipId);
    if (!clip) {
      continue;
    }
    if (issue.type === 'blank') {
      fixesByClipId.set(issue.clipId, { clipId: issue.clipId, delete: true });
      continue;
    }
    if (fixesByClipId.get(issue.clipId)?.delete) {
      continue;
    }
    if (issue.type === 'too-short') {
      fixesByClipId.set(issue.clipId, { clipId: issue.clipId, duration: normalizedSettings.minDuration });
    } else if (issue.type === 'too-long') {
      fixesByClipId.set(issue.clipId, { clipId: issue.clipId, duration: normalizedSettings.maxDuration });
    }
  }

  return Array.from(fixesByClipId.values()).sort((left, right) => {
    const leftClip = clipsById.get(left.clipId);
    const rightClip = clipsById.get(right.clipId);
    return (leftClip?.start ?? 0) - (rightClip?.start ?? 0) || left.clipId.localeCompare(right.clipId);
  });
}

export function serializeSubtitleProofreadingCsv(
  issues: SubtitleProofreadingIssue[],
  options: { fps?: number; timecodeFormat?: TimecodeFormat } = {}
): string {
  const rows = [['timecode', 'issue_type', 'clip_id', 'related_clip_id', 'content']];
  for (const issue of issues) {
    rows.push([
      secondsToTimecode(issue.start, options.fps ?? 30, options.timecodeFormat ?? 'ndf'),
      issue.type,
      issue.clipId,
      issue.relatedClipId ?? '',
      issue.text
    ]);
  }
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n') + '\n';
}

export function normalizeSubtitleProofreadingSettings(settings: SubtitleProofreadingSettings = {}): Required<SubtitleProofreadingSettings> {
  const minDuration = round(Math.max(1 / 30, finiteOrDefault(settings.minDuration, DEFAULT_SUBTITLE_PROOFREADING_SETTINGS.minDuration)));
  const maxDuration = round(Math.max(minDuration, finiteOrDefault(settings.maxDuration, DEFAULT_SUBTITLE_PROOFREADING_SETTINGS.maxDuration)));
  return {
    minDuration,
    maxDuration,
    chineseMaxCharsPerSecond: round(Math.max(1, finiteOrDefault(settings.chineseMaxCharsPerSecond, DEFAULT_SUBTITLE_PROOFREADING_SETTINGS.chineseMaxCharsPerSecond))),
    englishMaxCharsPerSecond: round(Math.max(1, finiteOrDefault(settings.englishMaxCharsPerSecond, DEFAULT_SUBTITLE_PROOFREADING_SETTINGS.englishMaxCharsPerSecond)))
  };
}

function normalizeSubtitleProofreadingClips(clips: SubtitleProofreadingClipInput[]): NormalizedSubtitleProofreadingClip[] {
  return clips
    .filter((clip) => clip.id && Number.isFinite(clip.start) && Number.isFinite(clip.duration))
    .map((clip) => ({
      id: clip.id,
      trackId: clip.trackId,
      start: round(Math.max(0, clip.start)),
      duration: round(Math.max(0, clip.duration)),
      text: typeof clip.text === 'string' ? clip.text : ''
    }))
    .sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
}

function groupSubtitleClipsByTrack(clips: NormalizedSubtitleProofreadingClip[]): Map<string, NormalizedSubtitleProofreadingClip[]> {
  const groups = new Map<string, NormalizedSubtitleProofreadingClip[]>();
  for (const clip of clips) {
    const key = clip.trackId ?? '';
    groups.set(key, [...(groups.get(key) ?? []), clip]);
  }
  return groups;
}

function createIssue(
  type: SubtitleProofreadingIssueType,
  clip: ReturnType<typeof normalizeSubtitleProofreadingClips>[number],
  extra: Partial<Pick<SubtitleProofreadingIssue, 'relatedClipId' | 'value' | 'limit' | 'trackId'>> = {}
): SubtitleProofreadingIssue {
  return {
    id: `${type}:${clip.id}${extra.relatedClipId ? `:${extra.relatedClipId}` : ''}`,
    type,
    clipId: clip.id,
    relatedClipId: extra.relatedClipId,
    trackId: extra.trackId ?? clip.trackId,
    start: clip.start,
    duration: clip.duration,
    text: clip.text,
    value: extra.value,
    limit: extra.limit
  };
}

function countReadableCharacters(text: string): number {
  return Array.from(text.replace(/\s+/g, '')).length;
}

function hasChineseText(text: string): boolean {
  return /[\u3400-\u9fff]/u.test(text);
}

function finiteOrDefault(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function escapeCsvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
