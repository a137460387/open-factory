import type { Clip, MediaAsset, Project, TimelineMarker, Track } from './model';

export type TimelineSearchMediaFilter = 'all' | 'video' | 'audio' | 'image' | 'subtitle';
export type TimelineSearchEffectFilter = 'all' | 'has-effects' | 'no-effects';
export type TimelineSearchKeyframeFilter = 'all' | 'has-keyframes' | 'no-keyframes';
export type TimelineSearchResultKind = 'clip' | 'marker';

export interface TimelineSearchOptions {
  query: string;
  useRegex?: boolean;
  mediaFilter?: TimelineSearchMediaFilter;
  effectFilter?: TimelineSearchEffectFilter;
  keyframeFilter?: TimelineSearchKeyframeFilter;
}

export interface TimelineSearchResult {
  id: string;
  kind: TimelineSearchResultKind;
  label: string;
  start: number;
  duration?: number;
  trackId?: string;
  trackName: string;
  clipId?: string;
  clipType?: Clip['type'];
  mediaId?: string;
  mediaName?: string;
  matchReasons: string[];
}

export interface TimelineSearchResponse {
  results: TimelineSearchResult[];
  error?: 'invalid-regex';
}

export interface TimelineSearchJump {
  playheadTime: number;
  selectedClipIds: string[];
}

export interface TimelineSearchMatcher {
  empty: boolean;
  matches(value: string | undefined): boolean;
}

export function searchTimeline(project: Project, options: TimelineSearchOptions): TimelineSearchResponse {
  const matcher = buildTimelineSearchMatcher(options.query, options.useRegex);
  if (!matcher) {
    return { results: [], error: 'invalid-regex' };
  }
  const mediaById = new Map(project.media.map((asset) => [asset.id, asset]));
  const groupNamesByClipId = buildGroupNamesByClipId(project);
  const hasActiveFilter = hasTimelineSearchFilter(options);
  const results: TimelineSearchResult[] = [];

  for (const track of project.timeline.tracks) {
    for (const clip of track.clips) {
      if (!clipPassesTimelineSearchFilters(clip, options)) {
        continue;
      }
      const asset = 'mediaId' in clip ? mediaById.get(clip.mediaId) : undefined;
      const reasons = collectClipSearchReasons(clip, track, asset, groupNamesByClipId.get(clip.id) ?? [], matcher);
      if (reasons.length === 0 && !(matcher.empty && hasActiveFilter)) {
        continue;
      }
      results.push({
        id: clip.id,
        kind: 'clip',
        label: clip.name,
        start: clip.start,
        duration: clip.duration,
        trackId: track.id,
        trackName: track.name,
        clipId: clip.id,
        clipType: clip.type,
        mediaId: asset?.id,
        mediaName: asset?.name,
        matchReasons: reasons.length > 0 ? reasons : ['filter']
      });
    }
  }

  if (!hasActiveFilter) {
    for (const marker of project.timeline.markers ?? []) {
      if (matcher.matches(marker.label)) {
        results.push(markerToSearchResult(marker));
      }
    }
  }

  return {
    results: results.sort((left, right) => left.start - right.start || kindSort(left.kind) - kindSort(right.kind) || left.label.localeCompare(right.label))
  };
}

export function buildTimelineSearchMatcher(query: string, useRegex = false): TimelineSearchMatcher | undefined {
  const trimmed = query.trim();
  if (!trimmed) {
    return { empty: true, matches: () => false };
  }
  if (useRegex) {
    try {
      const regex = new RegExp(trimmed, 'i');
      return { empty: false, matches: (value) => Boolean(value && regex.test(value)) };
    } catch {
      return undefined;
    }
  }
  const normalized = trimmed.toLowerCase();
  return { empty: false, matches: (value) => Boolean(value?.toLowerCase().includes(normalized)) };
}

export function clipPassesTimelineSearchFilters(clip: Clip, options: Pick<TimelineSearchOptions, 'mediaFilter' | 'effectFilter' | 'keyframeFilter'>): boolean {
  const mediaFilter = options.mediaFilter ?? 'all';
  if (mediaFilter !== 'all' && clip.type !== mediaFilter) {
    return false;
  }
  const effectCount = clip.effects?.length ?? 0;
  if (options.effectFilter === 'has-effects' && effectCount === 0) {
    return false;
  }
  if (options.effectFilter === 'no-effects' && effectCount > 0) {
    return false;
  }
  const hasKeyframes = clipHasTimelineSearchKeyframes(clip);
  if (options.keyframeFilter === 'has-keyframes' && !hasKeyframes) {
    return false;
  }
  if (options.keyframeFilter === 'no-keyframes' && hasKeyframes) {
    return false;
  }
  return true;
}

export function createTimelineSearchJump(result: TimelineSearchResult): TimelineSearchJump {
  return {
    playheadTime: result.start,
    selectedClipIds: result.kind === 'clip' && result.clipId ? [result.clipId] : []
  };
}

function collectClipSearchReasons(clip: Clip, track: Track, asset: MediaAsset | undefined, groupNames: string[], matcher: TimelineSearchMatcher): string[] {
  const reasons: string[] = [];
  addReason(reasons, matcher.matches(clip.name), 'clip-name');
  addReason(reasons, matcher.matches(asset?.name) || matcher.matches(asset?.path), 'file-name');
  addReason(reasons, matcher.matches(clip.colorLabel ?? undefined) || matcher.matches(track.color ?? undefined), 'color-label');
  addReason(reasons, (clip.effects ?? []).some((effect) => matcher.matches(effect.type)), 'effect-type');
  addReason(reasons, clip.type === 'subtitle' && matcher.matches(clip.text), 'subtitle-text');
  addReason(reasons, groupNames.some((name) => matcher.matches(name)), 'group-name');
  return reasons;
}

function addReason(reasons: string[], matched: boolean, reason: string): void {
  if (matched) {
    reasons.push(reason);
  }
}

function buildGroupNamesByClipId(project: Project): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const group of project.clipGroups ?? []) {
    for (const clipId of group.clipIds) {
      const names = map.get(clipId) ?? [];
      names.push(group.name);
      map.set(clipId, names);
    }
  }
  return map;
}

function markerToSearchResult(marker: TimelineMarker): TimelineSearchResult {
  return {
    id: marker.id,
    kind: 'marker',
    label: marker.label,
    start: marker.time,
    trackName: 'Markers',
    matchReasons: ['marker-name']
  };
}

function clipHasTimelineSearchKeyframes(clip: Clip): boolean {
  return Object.values(clip.keyframes ?? {}).some((frames) => Array.isArray(frames) && frames.length > 0);
}

function hasTimelineSearchFilter(options: Pick<TimelineSearchOptions, 'mediaFilter' | 'effectFilter' | 'keyframeFilter'>): boolean {
  return (options.mediaFilter ?? 'all') !== 'all' || (options.effectFilter ?? 'all') !== 'all' || (options.keyframeFilter ?? 'all') !== 'all';
}

function kindSort(kind: TimelineSearchResultKind): number {
  return kind === 'clip' ? 0 : 1;
}
