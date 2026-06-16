import { describe, expect, it } from 'vitest';
import {
  buildSmartSegmentRecommendations,
  buildSmartTimelineContext,
  calculateDurationMatchScore,
  calculateColorHistogramDistance,
  calculateColorHistogramSimilarity,
  detectTimelineGaps,
  durationMatchesGap,
  sortRecommendationsBySimilarity,
  type MediaAsset,
  type Project
} from '../src';
import { makeVideoClip } from './test-utils';

describe('smart segment recommendations', () => {
  it('calculates color histogram distance and similarity', () => {
    expect(calculateColorHistogramDistance([10, 0, 0], [5, 5, 0])).toBe(0.5);
    expect(calculateColorHistogramSimilarity([10, 0, 0], [5, 5, 0])).toBe(0.5);
    expect(calculateColorHistogramSimilarity([1, 2, 3], [1, 2, 3])).toBe(1);
    expect(calculateColorHistogramDistance([], [])).toBe(0);
    expect(calculateColorHistogramSimilarity([0, -1, Number.NaN], [0, 0, 0])).toBe(1);
  });

  it('matches media duration inside a gap tolerance range', () => {
    expect(calculateDurationMatchScore(10, 10)).toBe(1);
    expect(calculateDurationMatchScore(0, 10)).toBe(0);
    expect(calculateDurationMatchScore(10, Number.NaN)).toBe(0);
    expect(durationMatchesGap(10, 10)).toBe(true);
    expect(durationMatchesGap(11.9, 10)).toBe(true);
    expect(durationMatchesGap(12.1, 10)).toBe(false);
    expect(durationMatchesGap(7.9, 10)).toBe(false);
  });

  it('detects video track gaps between existing clips', () => {
    const project = makeProject();
    project.timeline.tracks.push({ id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [makeVideoClip({ id: 'not-visual', start: 10, duration: 2 })] as never });
    project.timeline.tracks[0].clips = [
      makeVideoClip({ id: 'clip-a', mediaId: 'asset-used-a', start: 0, duration: 2 }),
      makeVideoClip({ id: 'clip-overlap', mediaId: 'asset-used-a', start: 1, duration: 2 }),
      makeVideoClip({ id: 'clip-b', mediaId: 'asset-used-b', start: 4, duration: 2 })
    ];

    expect(detectTimelineGaps(project.timeline)).toEqual([
      { id: 'track-video:3-4', trackId: 'track-video', trackName: 'Video 1', start: 3, end: 4, duration: 1 }
    ]);
    expect(detectTimelineGaps({ tracks: [{ id: 'track-video', type: 'video', name: 'Video 1', clips: [] }] })).toEqual([]);
  });

  it('sorts unused media by color similarity and duration fit', () => {
    const project = makeProject();
    project.media = [
      makeAsset('asset-used-a', 'Used warm.mp4', 2),
      makeAsset('asset-used-b', 'Used warm 2.mp4', 2),
      makeAsset('asset-similar', 'Similar warm insert.mp4', 2.1),
      makeAsset('asset-cool', 'Cool insert.mp4', 2),
      makeAsset('asset-long', 'Long warm insert.mp4', 6)
    ];
    project.timeline.tracks[0].clips = [
      makeVideoClip({ id: 'clip-a', mediaId: 'asset-used-a', start: 0, duration: 2 }),
      makeVideoClip({ id: 'clip-b', mediaId: 'asset-used-b', start: 4, duration: 2 })
    ];

    const recommendations = buildSmartSegmentRecommendations(project, {
      histograms: {
        'asset-used-a': [1, 0, 0],
        'asset-used-b': [0.9, 0.1, 0],
        'asset-similar': [0.92, 0.08, 0],
        'asset-cool': [0, 1, 0],
        'asset-long': [0.95, 0.05, 0]
      }
    });

    expect(recommendations.map((item) => item.assetId)).toEqual(['asset-similar', 'asset-long', 'asset-cool']);
    expect(recommendations[0]).toMatchObject({
      assetId: 'asset-similar',
      gap: { start: 2, end: 4, duration: 2 }
    });
    expect(recommendations[0].reasons.map((reason) => reason.code)).toContain('duration-fit');
  });

  it('can re-sort a recommendation list by similarity score', () => {
    const sorted = sortRecommendationsBySimilarity([
      makeRecommendation('a', 0.2, 0.9),
      makeRecommendation('b', 0.8, 0.5),
      makeRecommendation('c', 0.8, 0.7)
    ]);

    expect(sorted.map((item) => item.assetId)).toEqual(['c', 'b', 'a']);
  });

  it('builds context and recommendations from SVG thumbnails without provided histograms', () => {
    const project = makeProject();
    project.media = [
      makeAsset('asset-used', 'Used slate.mp4', 3, 'video', svgThumb('#336699')),
      makeAsset('asset-image', 'Matching still.png', 5, 'image', svgThumb('#336699')),
      makeAsset('asset-fallback', 'Fallback.mov', 5, 'video', 'data:image/svg+xml;utf8,%E0%A4%A')
    ];
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-used', mediaId: 'asset-used', start: 0, duration: 3 })];

    const context = buildSmartTimelineContext(project);
    const recommendations = buildSmartSegmentRecommendations(project, { maxRecommendations: 1 });

    expect(context.usedMediaIds).toEqual(['asset-used']);
    expect(context.usedTypes).toEqual(['video']);
    expect(context.averageClipDuration).toBe(3);
    expect(context.rhythmCutsPerMinute).toBe(0);
    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]).toMatchObject({ assetId: 'asset-image', colorSimilarity: 1, typeScore: 0.75 });
    expect(recommendations[0].reasons.map((reason) => reason.code)).toContain('color-similar');
  });

  it('returns style-only recommendations when there are no timeline gaps', () => {
    const project = makeProject();
    project.media = [makeAsset('asset-used', 'Used.mp4', 3), makeAsset('asset-unused', 'Unused.mp4', 3), makeAsset('asset-audio', 'Voice.wav', 3, 'audio')];
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-used', mediaId: 'asset-used', start: 0, duration: 3 })];

    const recommendations = buildSmartSegmentRecommendations(project, {
      histograms: { 'asset-used': [1, 0], 'asset-unused': [1, 0], 'asset-audio': [1, 0] },
      maxRecommendations: 3
    });

    expect(recommendations.map((item) => item.assetId)).toEqual(['asset-unused']);
    expect(recommendations[0].gap).toBeUndefined();
    expect(recommendations[0].durationScore).toBe(0);
  });
});

function makeProject(): Project {
  return {
    version: '0.2',
    id: 'project',
    name: 'Project',
    createdAt: '2026-06-16T00:00:00.000Z',
    updatedAt: '2026-06-16T00:00:00.000Z',
    masterVolume: 1,
    settings: { fps: 30, timecodeFormat: 'ndf', width: 1920, height: 1080 },
    media: [],
    mediaFolders: [],
    mediaMetadata: {},
    annotations: [],
    reviewAnnotations: [],
    collaborationNotes: [],
    timelineNotes: [],
    bookmarks: [],
    beatMarkers: [],
    exportRanges: [],
    protectedRanges: [],
    clipGroups: [],
    speakers: [],
    documentation: {},
    timeline: {
      tracks: [{ id: 'track-video', type: 'video', name: 'Video 1', clips: [] }]
    },
    sequences: [],
    activeSequenceId: 'sequence-main'
  };
}

function makeAsset(id: string, name: string, duration: number, type: MediaAsset['type'] = 'video', thumbnail?: string): MediaAsset {
  return {
    id,
    type,
    name,
    path: `C:/Media/${name}`,
    duration,
    width: 1920,
    height: 1080,
    thumbnail
  };
}

function svgThumb(fill: string): string {
  return `data:image/svg+xml;utf8,<svg><rect fill="${encodeURIComponent(fill)}"/></svg>`;
}

function makeRecommendation(assetId: string, colorSimilarity: number, score: number): ReturnType<typeof buildSmartSegmentRecommendations>[number] {
  return {
    id: assetId,
    assetId,
    assetName: `${assetId}.mp4`,
    assetType: 'video',
    duration: 1,
    score,
    colorSimilarity,
    durationScore: 0,
    typeScore: 1,
    reasons: []
  };
}
