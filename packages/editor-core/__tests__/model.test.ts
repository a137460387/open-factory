import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PROJECT_SETTINGS,
  DEFAULT_CHROMA_KEY,
  DEFAULT_SLOW_MOTION_MODE,
  DEFAULT_NESTED_SEQUENCE_NAME,
  DEFAULT_TEXT_STYLE,
  DEFAULT_TRACK_COMPRESSOR,
  DEFAULT_TRACK_EQ,
  DEFAULT_TRANSFORM,
  MAX_NESTED_SEQUENCE_DEPTH,
  PRIMARY_SEQUENCE_ID,
  clampClipSpeed,
  createBaseClip,
  createDefaultTimeline,
  createId,
  createMask,
  createNestedSequenceClip,
  createProject,
  createSequence,
  createTrack,
  createTimelineMarker,
  createTransition,
  getProjectActiveSequenceId,
  getProjectPrimaryTimeline,
  getProjectSequences,
  getNestedSequenceDepth,
  isNestedSequenceDepthExceeded,
  normalizeChromaKey,
  normalizeFrameInterpolation,
  normalizeMask,
  normalizeMasks,
  normalizeMasterVolume,
  normalizeSlowMotionMode,
  normalizeSequenceFrameRate,
  normalizeSequenceName,
  normalizeStabilization,
  normalizeTimelineMarkers,
  normalizeTrackCompressor,
  normalizeTrackEQ,
  normalizeVideoRestoration,
  serializeLegacyProject,
  suggestDeinterlaceMode,
  switchProjectActiveSequence
} from '../src';
import { makeProject, makeVideoClip } from './test-utils';

const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

afterEach(() => {
  if (originalCryptoDescriptor) {
    Object.defineProperty(globalThis, 'crypto', originalCryptoDescriptor);
  }
});

describe('model factories', () => {
  it('creates projects with default settings and editable default tracks', () => {
    const project = createProject();

    expect(project.name).toBe('Untitled Project');
    expect(project.version).toBe('0.2');
    expect(project.masterVolume).toBe(1);
    expect(project.settings).toEqual(DEFAULT_PROJECT_SETTINGS);
    expect(project.media).toEqual([]);
    expect(project.timeline.tracks.map((track) => track.type)).toEqual(['video', 'audio', 'text']);
    expect(project.timeline.tracks.every((track) => track.clips.length === 0)).toBe(true);
    expect(project.timeline.tracks.every((track) => track.pan === 0 && track.volume === 1)).toBe(true);
    expect(project.sequences[0]).toMatchObject({ id: 'sequence-main', name: 'Main Sequence', timeline: project.timeline });
    expect(project.activeSequenceId).toBe('sequence-main');
  });

  it('creates a default timeline with independent track ids', () => {
    const timeline = createDefaultTimeline();
    const ids = timeline.tracks.map((track) => track.id);

    expect(new Set(ids).size).toBe(3);
    expect(timeline.tracks.map((track) => track.name)).toEqual(['Video 1', 'Audio 1', 'Text 1']);
    expect(timeline.markers).toEqual([]);
  });

  it('normalizes track processing, sequence names, transition defaults, and master values', () => {
    expect(clampClipSpeed(Number.NaN)).toBe(1);
    expect(clampClipSpeed(0)).toBe(0.25);
    expect(clampClipSpeed(99)).toBe(4);
    expect(normalizeMasterVolume(Number.NaN)).toBe(1);
    expect(normalizeMasterVolume(99)).toBe(2);
    expect(normalizeSequenceName(undefined)).toBe(DEFAULT_NESTED_SEQUENCE_NAME);
    expect(createSequence({ timeline: createDefaultTimeline() })).toMatchObject({ name: DEFAULT_NESTED_SEQUENCE_NAME });
    expect(createTransition({ fromClipId: 'clip-a', toClipId: 'clip-b', type: 'bad' as never, duration: Number.NaN })).toMatchObject({
      id: expect.any(String),
      type: 'dissolve',
      duration: 0.5
    });

    expect(
      normalizeTrackEQ({
        enabled: false,
        bands: [{ id: ' ', type: 'bad' as never, frequency: 1, gain: 99, q: 99 }]
      })
    ).toEqual({
      enabled: false,
      bands: [{ ...DEFAULT_TRACK_EQ.bands[0], frequency: 20, gain: 24, q: 4 }, ...DEFAULT_TRACK_EQ.bands.slice(1)]
    });
    expect(normalizeTrackCompressor({ enabled: true, threshold: -99, ratio: 99, attack: 0, release: 99_999, makeupGain: 99 })).toEqual({
      ...DEFAULT_TRACK_COMPRESSOR,
      enabled: true,
      threshold: -60,
      ratio: 20,
      attack: 0.01,
      release: 9000,
      makeupGain: 24
    });
  });

  it('normalizes chroma key and mask defaults with bounded values', () => {
    expect(normalizeChromaKey({ enabled: true, color: [-10, 128.4, 999], similarity: 4, blend: -2 })).toEqual({
      ...DEFAULT_CHROMA_KEY,
      enabled: true,
      color: [0, 128, 255],
      colors: [[0, 128, 255]],
      similarity: 1,
      blend: 0
    });
    expect(
      normalizeChromaKey({
        colors: [
          [0, 255, 0],
          [0, 0, 255],
          [300, -1, 125.4],
          [255, 0, 0]
        ],
        spillSuppression: true,
        erosion: 99
      })
    ).toEqual({
      ...DEFAULT_CHROMA_KEY,
      enabled: false,
      color: [0, 255, 0],
      colors: [
        [0, 255, 0],
        [0, 0, 255],
        [255, 0, 125]
      ],
      spillSuppression: true,
      erosion: 5
    });
    expect(normalizeChromaKey(undefined)).toEqual(DEFAULT_CHROMA_KEY);

    const mask = createMask({ id: 'mask-a', type: 'ellipse', x: 0.9, y: -1, w: 0.4, h: 0, feather: 4, inverted: true });
    expect(mask).toEqual({ id: 'mask-a', type: 'ellipse', x: 0.6, y: 0, w: 0.4, h: 0.001, feather: 1, inverted: true, enabled: true });
    expect(normalizeMask({ id: 'mask-disabled', enabled: false, type: 'bad' as never })).toMatchObject({ id: 'mask-disabled', type: 'rect', enabled: false });
    expect(
      normalizeMask({
        id: 'mask-privacy',
        keyframes: [{ time: 2, x: 0.9, y: 0.9, w: 0.4, h: 0.4 }, { time: Number.NaN, x: 0, y: 0, w: 0.2, h: 0.2 }],
        privacyBlur: { enabled: true, effect: 'bad' as never }
      })
    ).toMatchObject({
      id: 'mask-privacy',
      keyframes: [{ time: 2, x: 0.6, y: 0.6, w: 0.4, h: 0.4 }],
      privacyBlur: { enabled: true, effect: 'pixelize', color: '#000000' }
    });
    expect(normalizeMasks(undefined)).toEqual([]);
    expect(normalizeMasks([mask])).toEqual([mask]);
    expect(normalizeStabilization({ enabled: true, smoothing: 999, zoom: -1, analyzed: true, trfPath: ' C:\\Temp\\clip.trf ' })).toEqual({
      enabled: true,
      smoothing: 100,
      zoom: 0,
      analyzed: true,
      trfPath: 'C:\\Temp\\clip.trf'
    });
    expect(normalizeStabilization(undefined)).toEqual({ enabled: false, smoothing: 30, zoom: 0, analyzed: false, trfPath: null });
    expect(normalizeFrameInterpolation({ enabled: true, targetFps: 120 })).toEqual({ enabled: true, targetFps: 120 });
    expect(normalizeFrameInterpolation({ enabled: true, targetFps: 144 as never })).toEqual({ enabled: true, targetFps: 60 });
    expect(normalizeFrameInterpolation(undefined)).toEqual({ enabled: false, targetFps: 60 });
    expect(normalizeVideoRestoration(undefined)).toEqual({
      deinterlace: { enabled: false, mode: 0 },
      temporalDenoise: { preset: 'off', lumaSpatial: 4, chromaSpatial: 3, lumaTmp: 6 },
      spatialDenoise: { enabled: false, strength: 1.5, patchSize: 7, researchSize: 15 }
    });
    expect(
      normalizeVideoRestoration({
        deinterlace: { enabled: true, mode: 2 as never },
        temporalDenoise: { preset: 'custom', lumaSpatial: 99, chromaSpatial: -1, lumaTmp: 2.25 },
        spatialDenoise: { enabled: true, strength: 40, patchSize: 8, researchSize: 14 }
      })
    ).toEqual({
      deinterlace: { enabled: true, mode: 0 },
      temporalDenoise: { preset: 'custom', lumaSpatial: 20, chromaSpatial: 0, lumaTmp: 2.25 },
      spatialDenoise: { enabled: true, strength: 30, patchSize: 9, researchSize: 15 }
    });
    expect(normalizeSlowMotionMode('optical-flow')).toBe('optical-flow');
    expect(normalizeSlowMotionMode('bad-mode')).toBe(DEFAULT_SLOW_MOTION_MODE);
    expect(normalizeSlowMotionMode(undefined)).toBe(DEFAULT_SLOW_MOTION_MODE);
    expect(normalizeSequenceFrameRate(240)).toBe(120);
    expect(normalizeSequenceFrameRate(Number.NaN)).toBeUndefined();
  });

  it('suggests deinterlace only for interlaced field orders', () => {
    expect(suggestDeinterlaceMode('tt')).toBe(0);
    expect(suggestDeinterlaceMode('bb')).toBe(0);
    expect(suggestDeinterlaceMode('top coded first (swapped)')).toBeNull();
    expect(suggestDeinterlaceMode('progressive')).toBeNull();
    expect(suggestDeinterlaceMode(undefined)).toBeNull();
  });

  it('keeps primary sequence fallbacks and active sequence switching stable', () => {
    const project = createProject();
    const orphanedPrimaryTimeline = createDefaultTimeline();
    const nestedTimeline = createDefaultTimeline();
    const legacyLikeProject = {
      ...project,
      timeline: orphanedPrimaryTimeline,
      sequences: [createSequence({ id: 'sequence-a', name: 'A', timeline: nestedTimeline })],
      activeSequenceId: 'missing-sequence'
    };

    const sequences = getProjectSequences(legacyLikeProject);
    expect(sequences[0]).toMatchObject({ id: PRIMARY_SEQUENCE_ID, name: 'Main Sequence', timeline: orphanedPrimaryTimeline });
    expect(getProjectActiveSequenceId(legacyLikeProject)).toBe(PRIMARY_SEQUENCE_ID);
    expect(getProjectPrimaryTimeline(legacyLikeProject)).toBe(orphanedPrimaryTimeline);

    const switched = switchProjectActiveSequence({ ...legacyLikeProject, sequences }, 'sequence-a');
    expect(switched.activeSequenceId).toBe('sequence-a');
    expect(switched.timeline).toBe(nestedTimeline);
    expect(switchProjectActiveSequence(switched, 'does-not-exist').activeSequenceId).toBe('sequence-a');
  });

  it('normalizes timeline markers with bounded time, fallback label, and color', () => {
    expect(createTimelineMarker({ id: 'marker-1', time: -5, label: '  ', color: 'red' }, 10)).toEqual({
      id: 'marker-1',
      time: 0,
      label: 'Marker',
      color: '#f97316'
    });
    expect(normalizeTimelineMarkers([{ id: 'marker-b', time: 9, label: 'B', color: '#AABBCC' }, { id: 'marker-a', time: 2, label: 'A', color: '#112233' }], 5)).toEqual([
      { id: 'marker-a', time: 2, label: 'A', color: '#112233' },
      { id: 'marker-b', time: 5, label: 'B', color: '#aabbcc' }
    ]);
  });

  it('creates base clips by clamping timing values and merging transforms', () => {
    const clip = createBaseClip({
      name: 'Clamped',
      trackId: 'track-video',
      start: -1,
      duration: -2,
      trimStart: -3,
      trimEnd: 1.23456,
      transform: { ...DEFAULT_TRANSFORM, opacity: 0.25, x: 12 }
    });

    expect(clip.id).toEqual(expect.any(String));
    expect(clip.id.length).toBeGreaterThan(0);
    expect(clip.start).toBe(0);
    expect(clip.duration).toBe(0);
    expect(clip.trimStart).toBe(0);
    expect(clip.trimEnd).toBe(1.23456);
    expect(clip.transform).toEqual({ ...DEFAULT_TRANSFORM, opacity: 0.25, x: 12 });
    expect(clip.slowMotionMode).toBe('none');
  });

  it('serializes legacy projects without sharing nested transform objects', () => {
    const project = makeProject();
    project.timeline.markers = [{ id: 'marker-1', time: 1, label: 'Intro', color: '#f97316' }];
    project.timeline.tracks[0].clips[0].keyframes = {
      opacity: [{ id: 'opacity-a', time: 0, value: 1, easing: 'linear' }]
    };
    const legacy = serializeLegacyProject(project);

    expect(legacy.version).toBe('0.1');
    expect(legacy.project.settings).toEqual(project.settings);
    expect(legacy.assets[0]).toEqual(project.media[0]);
    expect(legacy.timeline.markers).toEqual(project.timeline.markers);
    legacy.timeline.tracks[0].clips[0].transform.opacity = 0.1;
    legacy.timeline.tracks[0].clips[0].keyframes!.opacity![0].value = 0.25;
    legacy.timeline.markers![0].label = 'Changed';
    expect(project.timeline.tracks[0].clips[0].transform.opacity).toBe(1);
    expect(project.timeline.tracks[0].clips[0].keyframes!.opacity![0].value).toBe(1);
    expect(project.timeline.markers[0].label).toBe('Intro');
  });

  it('serializes legacy projects with empty marker and transition arrays when omitted', () => {
    const project = createProject();
    project.timeline.markers = undefined;
    project.timeline.transitions = undefined;

    const legacy = serializeLegacyProject(project);

    expect(legacy.timeline.markers).toEqual([]);
    expect(legacy.timeline.transitions).toEqual([]);
  });

  it('falls back to a generated id when randomUUID is unavailable', () => {
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });

    const id = createId('fallback');

    expect(id).toMatch(/^fallback-[a-z0-9]+-[a-z0-9]+$/);
  });

  it('exports stable default constants for UI and clip factories', () => {
    expect(DEFAULT_TRANSFORM).toEqual({ x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 });
    expect(DEFAULT_TEXT_STYLE).toMatchObject({ fontSize: 48, color: '#ffffff', bold: false, italic: false });
  });

  it('detects nested sequence depth beyond the preview/export limit', () => {
    const project = createProject();
    const makeSequence = (id: string, childId?: string) =>
      createSequence({
        id,
        name: id,
        timeline: {
          tracks: [
            createTrack({
              id: `track-${id}`,
              type: 'video',
              name: id,
              clips: childId
                ? [
                    createNestedSequenceClip({
                      id: `clip-${id}`,
                      type: 'nested-sequence',
                      name: childId,
                      trackId: `track-${id}`,
                      sequenceId: childId,
                      start: 0,
                      duration: 1,
                      trimStart: 0,
                      trimEnd: 0
                    })
                  ]
                : []
            })
          ]
        }
      });
    project.timeline = makeSequence('sequence-main', 'sequence-a').timeline;
    project.sequences = [
      makeSequence('sequence-main', 'sequence-a'),
      makeSequence('sequence-a', 'sequence-b'),
      makeSequence('sequence-b', 'sequence-c'),
      makeSequence('sequence-c', 'sequence-d'),
      makeSequence('sequence-d')
    ];

    expect(getNestedSequenceDepth(project)).toBe(4);
    expect(isNestedSequenceDepthExceeded(project)).toBe(true);
  });

  it('handles missing, plain, missing-target, and recursive nested sequence depth checks', () => {
    const project = createProject();
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'plain-video' })];
    project.sequences = [createSequence({ id: PRIMARY_SEQUENCE_ID, name: 'Main Sequence', timeline: project.timeline })];

    expect(getNestedSequenceDepth(project, 'missing-sequence')).toBe(0);
    expect(getNestedSequenceDepth(project)).toBe(0);

    project.timeline.tracks[0].clips = [
      createNestedSequenceClip({
        id: 'missing-nested',
        type: 'nested-sequence',
        name: 'Missing',
        trackId: 'track-video',
        sequenceId: 'sequence-missing',
        start: 0,
        duration: 1,
        trimStart: 0,
        trimEnd: 0
      })
    ];
    project.sequences = [createSequence({ id: PRIMARY_SEQUENCE_ID, name: 'Main Sequence', timeline: project.timeline })];
    expect(getNestedSequenceDepth(project)).toBe(0);

    project.timeline.tracks[0].clips[0] = {
      ...project.timeline.tracks[0].clips[0],
      sequenceId: PRIMARY_SEQUENCE_ID
    } as ReturnType<typeof createNestedSequenceClip>;
    expect(getNestedSequenceDepth(project)).toBe(MAX_NESTED_SEQUENCE_DEPTH + 1);
  });
});
