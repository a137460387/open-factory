import type { Clip, Timeline, Track } from './model';
import { round } from './time';

export type StoryboardClip = Extract<Clip, { type: 'video' | 'image' }>;

export interface StoryboardCard {
  clip: StoryboardClip;
  track: Track;
  trackIndex: number;
}

export function isStoryboardClip(clip: Clip): clip is StoryboardClip {
  return clip.type === 'video' || clip.type === 'image';
}

export function getStoryboardCards(timeline: Timeline): StoryboardCard[] {
  return timeline.tracks
    .flatMap((track, trackIndex) =>
      track.clips
        .filter(isStoryboardClip)
        .map((clip) => ({
          clip,
          track,
          trackIndex
        }))
    )
    .sort((left, right) => left.clip.start - right.clip.start || left.trackIndex - right.trackIndex || left.clip.id.localeCompare(right.clip.id));
}

export function reorderStoryboardClipIds(currentIds: string[], draggedClipId: string, targetClipId: string): string[] {
  if (draggedClipId === targetClipId) {
    return [...currentIds];
  }
  const from = currentIds.indexOf(draggedClipId);
  const to = currentIds.indexOf(targetClipId);
  if (from === -1 || to === -1) {
    return [...currentIds];
  }
  const next = [...currentIds];
  const [dragged] = next.splice(from, 1);
  next.splice(to, 0, dragged);
  return next;
}

export function buildStoryboardReorderStarts(timeline: Timeline, orderedClipIds: string[]): Record<string, number> {
  const requestedOrder = new Map(orderedClipIds.map((id, index) => [id, index]));
  const starts: Record<string, number> = {};

  for (const track of timeline.tracks) {
    const currentCards = track.clips.filter(isStoryboardClip).sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
    if (currentCards.length < 2) {
      continue;
    }
    const orderedCards = [...currentCards].sort((left, right) => {
      const leftOrder = requestedOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = requestedOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder || left.start - right.start || left.id.localeCompare(right.id);
    });
    let cursor = Math.min(...currentCards.map((clip) => clip.start));
    for (const clip of orderedCards) {
      starts[clip.id] = round(cursor);
      cursor = round(cursor + clip.duration);
    }
  }

  return starts;
}
