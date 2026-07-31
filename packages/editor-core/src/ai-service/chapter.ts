import type { AIChapterResult } from './types';

export function splitChapterSegments(
  durationSeconds: number,
  segmentMinSeconds = 60,
  segmentMaxSeconds = 90,
): Array<{ start: number; end: number }> {
  if (durationSeconds <= 0) {
    return [];
  }
  const avgSegment = (segmentMinSeconds + segmentMaxSeconds) / 2;
  const segmentCount = Math.max(1, Math.round(durationSeconds / avgSegment));
  const segmentDuration = durationSeconds / segmentCount;
  const segments: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < segmentCount; i++) {
    segments.push({
      start: Math.round(i * segmentDuration * 100) / 100,
      end: Math.round(Math.min((i + 1) * segmentDuration, durationSeconds) * 100) / 100,
    });
  }
  return segments;
}

export function suggestChapterCount(durationSeconds: number): { min: number; max: number } {
  if (durationSeconds <= 0) {
    return { min: 0, max: 0 };
  }
  const minutes = durationSeconds / 60;
  if (minutes <= 5) {
    return { min: 3, max: 5 };
  }
  if (minutes <= 15) {
    return { min: 5, max: 8 };
  }
  if (minutes <= 30) {
    return { min: 8, max: 12 };
  }
  if (minutes <= 60) {
    return { min: 12, max: 20 };
  }
  return { min: 15, max: 30 };
}

export function parseChapterResponse(json: unknown): AIChapterResult[] {
  if (!Array.isArray(json)) {
    return [];
  }
  return json
    .filter(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof (item as AIChapterResult).time === 'number' &&
        typeof (item as AIChapterResult).title === 'string',
    )
    .map((item) => ({
      time: Math.max(0, (item as AIChapterResult).time),
      title: ((item as AIChapterResult).title || '').trim().slice(0, 15),
    }))
    .filter((item) => item.title.length > 0)
    .sort((a, b) => a.time - b.time);
}

export function formatChaptersYouTube(chapters: AIChapterResult[]): string {
  return chapters
    .map((ch) => {
      const mins = Math.floor(ch.time / 60);
      const secs = Math.floor(ch.time % 60);
      return `${mins}:${secs.toString().padStart(2, '0')} ${ch.title}`;
    })
    .join('\n');
}

export function formatChaptersBilibili(chapters: AIChapterResult[]): string {
  return chapters
    .map((ch) => {
      const mins = Math.floor(ch.time / 60);
      const secs = Math.floor(ch.time % 60);
      return `${mins}:${secs.toString().padStart(2, '0')} ${ch.title}`;
    })
    .join('\n');
}
