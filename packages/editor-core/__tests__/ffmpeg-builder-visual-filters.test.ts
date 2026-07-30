import { describe, expect, it } from 'vitest';
import {
  visualKindOrder,
  hasSphericalVideoClips,
  buildPanoramaProjectionFilters,
  buildPlaybackStartByClipId,
  buildMediaCompositeFilter,
  buildAdjustmentLayerFilters,
  getExportClipSourceDuration,
} from '../src/export/ffmpeg-builder/visual-filters';
import type { ExportClip, ExportTimeline, ExportSettings, VisualItem } from '../src/export/export-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeExportClip(overrides: Partial<ExportClip> = {}): ExportClip {
  return {
    id: 'clip-1',
    type: 'video',
    mediaPath: '/media.mp4',
    sourceColorProfile: null,
    nestedSequenceId: null,
    start: 0,
    duration: 5,
    trimStart: 0,
    trimEnd: 0,
    speed: 1,
    slowMotionMode: 'none',
    sourceDuration: 5,
    trackIndex: 0,
    transform: { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    border: { enabled: false, width: 0, color: '#000000', radius: 0 },
    colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
    chromaKey: { enabled: false },
    stabilization: { enabled: false },
    frameInterpolation: { enabled: false },
    audioDenoise: { enabled: false },
    aiLocalDenoise: { enabled: false },
    audioRestoration: { enabled: false },
    spatialAudio: { x: 0, y: 0, z: 0, distance: 'medium' },
    videoRestoration: { enabled: false },
    qualityEnhancement: { enabled: false },
    projection: 'flat',
    panorama: { yaw: 0, pitch: 0, roll: 0, fov: 90, outputProjection: 'flat' },
    masks: [],
    imageSequence: null,
    effects: [],
    blendMode: 'normal',
    keyframes: null,
    volume: 1,
    audioChannelRouting: { enabled: false },
    pan: 0,
    eq: { enabled: false, bands: [] },
    compressor: { enabled: false, threshold: -20, ratio: 4, attack: 5, release: 50 },
    muted: false,
    pitchSemitones: 0,
    reverseAudio: false,
    fadeInDuration: 0,
    fadeOutDuration: 0,
    fadeInCurve: 'linear',
    fadeOutCurve: 'linear',
    hasEmbeddedAudio: false,
    audioChannels: 2,
    audioSampleRate: 44100,
    textStyle: null,
    textPath: null,
    subtitleStyle: null,
    subtitleType: null,
    speaker: null,
    soundDesc: null,
    subtitleMode: null,
    dataSubtitle: null,
    creditsStyle: null,
    motionGraphic: null,
    privacyRedactions: [],
    ...overrides,
  } as ExportClip;
}

const defaultSettings: ExportSettings = {
  width: 1920,
  height: 1080,
  fps: 30,
  sampleRate: 44100,
  videoCodec: 'libx264',
  audioCodec: 'aac',
  format: 'mp4',
  outputPath: '/out.mp4',
  videoBitrate: null,
  audioBitrate: null,
  outputMode: 'video',
  scaleMode: 'none',
  targetAspectRatio: 'source',
  reframeOffsetX: 0,
  reframeOffsetY: 0,
  subtitleMode: undefined,
  subtitleFormat: 'srt',
  exportSidecarSubtitle: false,
  subtitleLanguages: undefined,
  subtitleBurnInLanguage: undefined,
  hardwareEncoding: false,
  hardwareEncoderSettings: null,
  loudnessNormalization: 'off',
  platformPreset: undefined,
  videoProfile: undefined,
  watermark: null,
  timecodeBurnIn: null,
  slate: null,
  colorManagement: { inputColorSpace: 'srgb', outputColorSpace: 'srgb', embedIccProfile: false },
  colorPipeline: 'sdr-srgb',
  masterProcessing: null,
  spatialAudioAssets: null,
  audioVisualization: { style: 'waveform-line', color: '#22d3ee', background: { type: 'solid', color: '#050816' } },
  workingColorSpace: 'srgb',
};

// ---------------------------------------------------------------------------
// visualKindOrder
// ---------------------------------------------------------------------------
describe('visualKindOrder', () => {
  it('media items sort first (0)', () => {
    const media: VisualItem = { kind: 'media', trackIndex: 0, start: 0, duration: 5, label: 'v1', xExpression: '0', yExpression: '0', blendMode: 'normal' };
    expect(visualKindOrder(media)).toBe(0);
  });

  it('adjustment items sort second (1)', () => {
    const adj: VisualItem = { kind: 'adjustment', trackIndex: 0, start: 0, duration: 5, clip: makeExportClip() };
    expect(visualKindOrder(adj)).toBe(1);
  });

  it('text/credits items sort last (2)', () => {
    const text: VisualItem = { kind: 'text', trackIndex: 0, start: 0, duration: 5, clip: makeExportClip({ type: 'text' }) };
    expect(visualKindOrder(text)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// hasSphericalVideoClips
// ---------------------------------------------------------------------------
describe('hasSphericalVideoClips', () => {
  it('returns false for flat clips', () => {
    expect(hasSphericalVideoClips([makeExportClip()])).toBe(false);
  });

  it('returns true for equirectangular video', () => {
    expect(hasSphericalVideoClips([makeExportClip({ projection: 'equirectangular' })])).toBe(true);
  });

  it('returns true for cubemap video', () => {
    expect(hasSphericalVideoClips([makeExportClip({ projection: 'cubemap' })])).toBe(true);
  });

  it('returns false for non-video spherical clips', () => {
    expect(hasSphericalVideoClips([makeExportClip({ type: 'image', projection: 'equirectangular' })])).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(hasSphericalVideoClips([])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildPanoramaProjectionFilters
// ---------------------------------------------------------------------------
describe('buildPanoramaProjectionFilters', () => {
  it('returns empty for flat projection', () => {
    expect(buildPanoramaProjectionFilters(makeExportClip())).toEqual([]);
  });

  it('returns empty for equirectangular to equirectangular', () => {
    const clip = makeExportClip({
      projection: 'equirectangular',
      panorama: { yaw: 0, pitch: 0, roll: 0, fov: 90, outputProjection: 'equirectangular' },
    });
    expect(buildPanoramaProjectionFilters(clip)).toEqual([]);
  });

  it('builds v360 filter for equirectangular to flat', () => {
    const clip = makeExportClip({
      projection: 'equirectangular',
      panorama: { yaw: 90, pitch: 0, roll: 0, fov: 120, outputProjection: 'flat' },
    });
    const filters = buildPanoramaProjectionFilters(clip);
    expect(filters).toHaveLength(1);
    expect(filters[0]).toContain('v360=');
    expect(filters[0]).toContain('e');
    expect(filters[0]).toContain('flat');
    expect(filters[0]).toContain('yaw=90');
  });

  it('builds v360 filter for cubemap to flat', () => {
    const clip = makeExportClip({
      projection: 'cubemap',
      panorama: { yaw: 0, pitch: 45, roll: 0, fov: 90, outputProjection: 'flat' },
    });
    const filters = buildPanoramaProjectionFilters(clip);
    expect(filters).toHaveLength(1);
    expect(filters[0]).toContain('c3x2');
  });
});

// ---------------------------------------------------------------------------
// buildPlaybackStartByClipId
// ---------------------------------------------------------------------------
describe('buildPlaybackStartByClipId', () => {
  it('returns playback start for each clip', () => {
    const timeline: ExportTimeline = {
      duration: 10,
      transitions: [],
      tracks: [
        {
          index: 0,
          type: 'video',
          muted: false,
          solo: false,
          locked: false,
          volume: 1,
          pan: 0,
          clips: [
            makeExportClip({ id: 'c1', start: 0, duration: 5 }),
            makeExportClip({ id: 'c2', start: 5, duration: 5 }),
          ],
        },
      ],
    };
    const starts = buildPlaybackStartByClipId(timeline);
    expect(starts.get('c1')).toBe(0);
    expect(starts.get('c2')).toBe(5);
  });

  it('accounts for transition overlap', () => {
    const timeline: ExportTimeline = {
      duration: 9,
      transitions: [
        { id: 't1', type: 'crossfade', duration: 1, fromClipId: 'c1', toClipId: 'c2' },
      ],
      tracks: [
        {
          index: 0,
          type: 'video',
          muted: false,
          solo: false,
          locked: false,
          volume: 1,
          pan: 0,
          clips: [
            makeExportClip({ id: 'c1', start: 0, duration: 5 }),
            makeExportClip({ id: 'c2', start: 5, duration: 4 }),
          ],
        },
      ],
    };
    const starts = buildPlaybackStartByClipId(timeline);
    expect(starts.get('c1')).toBe(0);
    // c2 playback start should be adjusted for transition
    expect(starts.get('c2')).toBeLessThan(5);
  });
});

// ---------------------------------------------------------------------------
// buildMediaCompositeFilter
// ---------------------------------------------------------------------------
describe('buildMediaCompositeFilter', () => {
  const mediaItem: Extract<VisualItem, { kind: 'media' }> = {
    kind: 'media',
    trackIndex: 0,
    start: 0,
    duration: 5,
    label: 'v_clip1',
    xExpression: '(main_w-overlay_w)/2',
    yExpression: '(main_h-overlay_h)/2',
    blendMode: 'normal',
  };

  it('builds overlay filter for normal blend mode', () => {
    const filter = buildMediaCompositeFilter('base0', 'base1', mediaItem, defaultSettings, 10);
    expect(filter).toContain('overlay=');
    expect(filter).toContain('[base0]');
    expect(filter).toContain('[base1]');
    expect(filter).toContain('between(t,0,5)');
  });

  it('builds blend graph for non-normal blend mode', () => {
    const blendItem = { ...mediaItem, blendMode: 'overlay' as const };
    const filter = buildMediaCompositeFilter('base0', 'base1', blendItem, defaultSettings, 10);
    expect(filter).toContain('blend=all_mode=overlay');
    expect(filter).toContain('alphaextract');
    expect(filter).toContain('alphamerge');
  });
});

// ---------------------------------------------------------------------------
// buildAdjustmentLayerFilters
// ---------------------------------------------------------------------------
describe('buildAdjustmentLayerFilters', () => {
  it('returns empty when no color correction or effects', () => {
    const filters = buildAdjustmentLayerFilters('base0', 'base1', makeExportClip(), [], defaultSettings);
    expect(filters).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getExportClipSourceDuration
// ---------------------------------------------------------------------------
describe('getExportClipSourceDuration', () => {
  it('returns sourceDuration for video', () => {
    expect(getExportClipSourceDuration(makeExportClip({ type: 'video', sourceDuration: 10, duration: 5 }))).toBe(10);
  });

  it('returns sourceDuration for audio', () => {
    expect(getExportClipSourceDuration(makeExportClip({ type: 'audio', sourceDuration: 8, duration: 4 }))).toBe(8);
  });

  it('returns duration for image', () => {
    expect(getExportClipSourceDuration(makeExportClip({ type: 'image', sourceDuration: 10, duration: 3 }))).toBe(3);
  });

  it('returns at least 0.001', () => {
    expect(getExportClipSourceDuration(makeExportClip({ type: 'video', sourceDuration: 0, duration: 0 }))).toBeGreaterThanOrEqual(0.001);
  });
});
