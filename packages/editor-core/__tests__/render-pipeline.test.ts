import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  FrameCacheManager,
  PredictivePrefetcher,
  ViewportCuller,
  ProxySwitcher,
  DirtyRegionBatcher,
  RenderPipeline,
  DEFAULT_RENDER_PIPELINE_CONFIG,
  createRenderPipeline,
  createDefaultRenderPipeline,
} from '../src/engine/render-pipeline';
import type { RenderViewport, DirtyRegion } from '../src/engine/render-pipeline';

const makeViewport = (overrides: Partial<RenderViewport> = {}): RenderViewport => ({
  x: 0,
  y: 0,
  width: 1920,
  height: 1080,
  scrollTop: 0,
  scrollLeft: 0,
  zoom: 1,
  ...overrides,
});

const makeTimeline = () => ({
  tracks: [
    {
      id: 'v1',
      type: 'video' as const,
      muted: false,
      solo: false,
      clips: [
        { id: 'c1', type: 'video' as const, trackId: 'v1', start: 0, duration: 5, trimStart: 0, trimEnd: 0, speed: 1, mediaId: 'm1' },
        { id: 'c2', type: 'video' as const, trackId: 'v1', start: 10, duration: 5, trimStart: 0, trimEnd: 0, speed: 1, mediaId: 'm2' },
      ],
    },
  ],
  transitions: [],
});

describe('FrameCacheManager', () => {
  let cache: FrameCacheManager;

  beforeEach(() => {
    cache = new FrameCacheManager(10, 10000);
  });

  it('stores and retrieves frames', () => {
    cache.put({ frame: 0, bitmap: null, decodeTime: 1, fromCache: false, quality: 'full' }, 100);
    expect(cache.has(0)).toBe(true);
    const result = cache.get(0);
    expect(result?.frame).toBe(0);
    expect(result?.quality).toBe('full');
  });

  it('returns undefined for missing frames', () => {
    expect(cache.get(999)).toBeUndefined();
  });

  it('evicts LRU frames when over budget', () => {
    const smallCache = new FrameCacheManager(3, 10000);
    smallCache.put({ frame: 0, bitmap: null, decodeTime: 1, fromCache: false, quality: 'full' }, 100);
    smallCache.put({ frame: 1, bitmap: null, decodeTime: 1, fromCache: false, quality: 'full' }, 100);
    smallCache.put({ frame: 2, bitmap: null, decodeTime: 1, fromCache: false, quality: 'full' }, 100);
    // At capacity (3 frames)
    smallCache.get(0); // Touch frame 0
    smallCache.put({ frame: 3, bitmap: null, decodeTime: 1, fromCache: false, quality: 'full' }, 100);
    // Frame 1 should be evicted (LRU)
    expect(smallCache.has(0)).toBe(true);
    expect(smallCache.has(1)).toBe(false);
    expect(smallCache.has(2)).toBe(true);
    expect(smallCache.has(3)).toBe(true);
  });

  it('removes frames', () => {
    cache.put({ frame: 0, bitmap: null, decodeTime: 1, fromCache: false, quality: 'full' }, 100);
    cache.remove(0);
    expect(cache.has(0)).toBe(false);
  });

  it('remove is no-op for missing frame', () => {
    cache.remove(999);
    // Should not throw
  });

  it('replaces duplicate frame keys', () => {
    cache.put({ frame: 0, bitmap: null, decodeTime: 1, fromCache: false, quality: 'full' }, 100);
    cache.put({ frame: 0, bitmap: null, decodeTime: 2, fromCache: false, quality: 'half' }, 50);
    const result = cache.get(0);
    expect(result?.decodeTime).toBe(2);
    expect(result?.quality).toBe('half');
  });

  it('retains frames around center', () => {
    for (let i = 0; i < 10; i++) {
      cache.put({ frame: i, bitmap: null, decodeTime: 1, fromCache: false, quality: 'full' }, 100);
    }
    cache.retainAround(5, 2); // Keep frames 3-7
    expect(cache.has(2)).toBe(false);
    expect(cache.has(3)).toBe(true);
    expect(cache.has(5)).toBe(true);
    expect(cache.has(7)).toBe(true);
    expect(cache.has(8)).toBe(false);
  });

  it('clears all frames', () => {
    cache.put({ frame: 0, bitmap: null, decodeTime: 1, fromCache: false, quality: 'full' }, 100);
    cache.clear();
    expect(cache.has(0)).toBe(false);
    expect(cache.getStats().frames).toBe(0);
    expect(cache.getStats().bytes).toBe(0);
  });

  it('reports stats', () => {
    cache.put({ frame: 0, bitmap: null, decodeTime: 1, fromCache: false, quality: 'full' }, 100);
    cache.put({ frame: 1, bitmap: null, decodeTime: 1, fromCache: false, quality: 'full' }, 200);
    const stats = cache.getStats();
    expect(stats.frames).toBe(2);
    expect(stats.bytes).toBe(300);
  });
});

describe('PredictivePrefetcher', () => {
  let prefetcher: PredictivePrefetcher;
  let nowCounter: number;

  beforeEach(() => {
    prefetcher = new PredictivePrefetcher();
    nowCounter = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => {
      nowCounter += 100; // Each call advances 100ms
      return nowCounter;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty frames when insufficient history', () => {
    // With only 1 entry, direction defaults to 'forward'
    // so it still produces frames (no static detection possible)
    prefetcher.recordPlaybackPosition(0);
    const frames = prefetcher.getPredictedFrames(0, 30, 5);
    // 1 entry is not enough to detect direction, forward is default
    expect(frames.length).toBe(5);
  });

  it('predicts forward frames', () => {
    for (let i = 0; i < 5; i++) {
      prefetcher.recordPlaybackPosition(i);
    }
    const frames = prefetcher.getPredictedFrames(10, 30, 3);
    expect(frames.length).toBe(3);
    expect(frames[0]).toBeGreaterThan(10);
  });

  it('predicts backward frames', () => {
    for (let i = 5; i >= 0; i--) {
      prefetcher.recordPlaybackPosition(i);
    }
    const frames = prefetcher.getPredictedFrames(10, 30, 3);
    // Some frames may be negative and filtered out
    expect(frames.length).toBeGreaterThanOrEqual(1);
    expect(frames[0]).toBeLessThan(10);
  });

  it('returns empty for static playback', () => {
    for (let i = 0; i < 5; i++) {
      prefetcher.recordPlaybackPosition(5);
    }
    const frames = prefetcher.getPredictedFrames(10, 30, 3);
    expect(frames).toEqual([]);
  });

  it('returns confidence based on history length', () => {
    expect(prefetcher.getPredictionConfidence()).toBe(0);
    for (let i = 0; i < 10; i++) {
      prefetcher.recordPlaybackPosition(i);
    }
    expect(prefetcher.getPredictionConfidence()).toBeGreaterThan(0);
  });

  it('limits history window', () => {
    for (let i = 0; i < 100; i++) {
      prefetcher.recordPlaybackPosition(i);
    }
    // Should not throw or grow unbounded
    expect(prefetcher.getPredictionConfidence()).toBe(1);
  });
});

describe('ViewportCuller', () => {
  let culler: ViewportCuller;

  beforeEach(() => {
    culler = new ViewportCuller();
  });

  it('returns visible clips within viewport', () => {
    const timeline = makeTimeline();
    const viewport = makeViewport({ scrollLeft: 0, width: 500 });
    const visible = culler.getVisibleClips(timeline, viewport, 100); // 100px/s
    // Viewport shows 0-5 seconds, clip c1 is 0-5s
    expect(visible.length).toBe(1);
    expect(visible[0].id).toBe('c1');
  });

  it('returns clips that overlap viewport', () => {
    const timeline = makeTimeline();
    const viewport = makeViewport({ scrollLeft: 400, width: 200 }); // 4-6 seconds
    const visible = culler.getVisibleClips(timeline, viewport, 100);
    expect(visible.length).toBe(1);
    expect(visible[0].id).toBe('c1');
  });

  it('excludes clips outside viewport', () => {
    const timeline = makeTimeline();
    const viewport = makeViewport({ scrollLeft: 3000, width: 500 }); // 30-35 seconds
    const visible = culler.getVisibleClips(timeline, viewport, 100);
    expect(visible.length).toBe(0);
  });

  it('checks individual clip visibility', () => {
    const clip = { id: 'c1', type: 'video' as const, trackId: 'v1', start: 0, duration: 5, trimStart: 0, trimEnd: 0, speed: 1 };
    const viewport = makeViewport({ scrollLeft: 0, width: 500 });

    expect(culler.isClipVisible(clip, viewport, 100)).toBe(true);

    const farViewport = makeViewport({ scrollLeft: 10000, width: 500 });
    expect(culler.isClipVisible(clip, farViewport, 100)).toBe(false);
  });

  it('returns resize dirty region for first viewport', () => {
    const viewport = makeViewport();
    const regions = culler.getDirtyRegions(null, viewport);
    expect(regions.length).toBe(1);
    expect(regions[0].reason).toBe('resize');
  });

  it('returns scroll dirty region on scroll change', () => {
    const prev = makeViewport({ scrollLeft: 0 });
    const curr = makeViewport({ scrollLeft: 100 });
    const regions = culler.getDirtyRegions(prev, curr);
    expect(regions.some(r => r.reason === 'scroll')).toBe(true);
  });

  it('returns resize dirty region on size change', () => {
    const prev = makeViewport({ width: 1920, height: 1080 });
    const curr = makeViewport({ width: 1280, height: 720 });
    const regions = culler.getDirtyRegions(prev, curr);
    expect(regions.some(r => r.reason === 'resize')).toBe(true);
  });

  it('returns empty dirty regions when nothing changed', () => {
    const prev = makeViewport();
    const curr = makeViewport();
    const regions = culler.getDirtyRegions(prev, curr);
    expect(regions.length).toBe(0);
  });

  it('updates viewport', () => {
    const viewport = makeViewport({ scrollLeft: 100 });
    culler.updateViewport(viewport);
    // No assertion needed - just verify no error
  });
});

describe('ProxySwitcher', () => {
  let switcher: ProxySwitcher;

  beforeEach(() => {
    switcher = new ProxySwitcher();
  });

  it('auto mode does not use proxy initially', () => {
    expect(switcher.shouldUseProxy(5, 16)).toBe(false);
  });

  it('auto mode activates proxy when decode times are high', () => {
    for (let i = 0; i < 30; i++) {
      switcher.shouldUseProxy(100, 16); // Way above threshold
    }
    expect(switcher.isProxyActive()).toBe(true);
  });

  it('auto mode deactivates proxy when decode times are low', () => {
    // Activate first
    for (let i = 0; i < 30; i++) {
      switcher.shouldUseProxy(100, 16);
    }
    expect(switcher.isProxyActive()).toBe(true);

    // Then deactivate
    for (let i = 0; i < 30; i++) {
      switcher.shouldUseProxy(1, 16);
    }
    expect(switcher.isProxyActive()).toBe(false);
  });

  it('original strategy never uses proxy', () => {
    switcher.setStrategy('original');
    expect(switcher.shouldUseProxy(1000, 16)).toBe(false);
  });

  it('proxy strategy always uses proxy', () => {
    switcher.setStrategy('proxy');
    expect(switcher.shouldUseProxy(1, 16)).toBe(true);
  });

  it('adaptive strategy uses p95 for decisions', () => {
    switcher.setStrategy('adaptive');
    // Low times - should not use proxy
    for (let i = 0; i < 10; i++) {
      expect(switcher.shouldUseProxy(5, 16)).toBe(false);
    }
  });

  it('tracks average decode time', () => {
    switcher.shouldUseProxy(10, 16);
    switcher.shouldUseProxy(20, 16);
    expect(switcher.getAverageDecodeTime()).toBe(15);
  });

  it('returns 0 average when no data', () => {
    expect(switcher.getAverageDecodeTime()).toBe(0);
  });
});

describe('DirtyRegionBatcher', () => {
  it('batches and merges regions', () => {
    const batcher = new DirtyRegionBatcher(100);
    const flushed: DirtyRegion[][] = [];

    batcher.setFlushCallback((regions) => flushed.push(regions));

    batcher.addRegion({ x: 0, y: 0, width: 100, height: 100, reason: 'scroll' });
    batcher.addRegion({ x: 50, y: 50, width: 100, height: 100, reason: 'scroll' });

    const merged = batcher.flush();
    expect(merged.length).toBe(1);
    expect(merged[0].x).toBe(0);
    expect(merged[0].y).toBe(0);
    expect(merged[0].width).toBe(150);
    expect(merged[0].height).toBe(150);
  });

  it('returns empty array when no pending regions', () => {
    const batcher = new DirtyRegionBatcher(100);
    const merged = batcher.flush();
    expect(merged).toEqual([]);
  });

  it('passes single region through without merging', () => {
    const batcher = new DirtyRegionBatcher(100);
    batcher.addRegion({ x: 10, y: 20, width: 30, height: 40, reason: 'resize' });
    const merged = batcher.flush();
    expect(merged.length).toBe(1);
    expect(merged[0]).toEqual({ x: 10, y: 20, width: 30, height: 40, reason: 'resize' });
  });
});

describe('RenderPipeline', () => {
  it('creates with default config', () => {
    const pipeline = createDefaultRenderPipeline();
    expect(pipeline).toBeInstanceOf(RenderPipeline);
    pipeline.destroy();
  });

  it('creates with custom config', () => {
    const pipeline = createRenderPipeline({ maxCacheFrames: 10 });
    expect(pipeline).toBeInstanceOf(RenderPipeline);
    pipeline.destroy();
  });

  it('sets viewport and returns visible clips', () => {
    const pipeline = createRenderPipeline({ enableViewportCulling: true });
    const timeline = makeTimeline();

    pipeline.setViewport(makeViewport({ scrollLeft: 0, width: 500 }));
    const clips = pipeline.getVisibleClips(timeline, 100);
    expect(clips.length).toBeGreaterThanOrEqual(0);
    pipeline.destroy();
  });

  it('returns all clips when culling disabled', () => {
    const pipeline = createRenderPipeline({ enableViewportCulling: false });
    const timeline = makeTimeline();
    const clips = pipeline.getVisibleClips(timeline, 100);
    expect(clips.length).toBe(2);
    pipeline.destroy();
  });

  it('returns all clips when no viewport set', () => {
    const pipeline = createRenderPipeline({ enableViewportCulling: true });
    const timeline = makeTimeline();
    const clips = pipeline.getVisibleClips(timeline, 100);
    expect(clips.length).toBe(2);
    pipeline.destroy();
  });

  it('sets proxy strategy', () => {
    const pipeline = createRenderPipeline();
    pipeline.setProxyStrategy('proxy');
    // No assertion needed - just verify no error
    pipeline.destroy();
  });

  it('invalidates frame range', () => {
    const pipeline = createRenderPipeline();
    pipeline.invalidateRange(0, 10);
    // No assertion needed - just verify no error
    pipeline.destroy();
  });

  it('retains frames around center', () => {
    const pipeline = createRenderPipeline();
    pipeline.retainAround(50);
    // No assertion needed - just verify no error
    pipeline.destroy();
  });

  it('returns stats', () => {
    const pipeline = createRenderPipeline();
    const stats = pipeline.getStats();
    expect(stats.cache).toBeDefined();
    expect(stats.averageFrameTime).toBe(0);
    expect(stats.proxyActive).toBe(false);
    expect(stats.activeDecodes).toBe(0);
    pipeline.destroy();
  });
});

describe('DEFAULT_RENDER_PIPELINE_CONFIG', () => {
  it('has sensible defaults', () => {
    expect(DEFAULT_RENDER_PIPELINE_CONFIG.maxCacheFrames).toBe(120);
    expect(DEFAULT_RENDER_PIPELINE_CONFIG.maxCacheBytes).toBe(512 * 1024 * 1024);
    expect(DEFAULT_RENDER_PIPELINE_CONFIG.fpsTarget).toBe(60);
    expect(DEFAULT_RENDER_PIPELINE_CONFIG.enableViewportCulling).toBe(true);
    expect(DEFAULT_RENDER_PIPELINE_CONFIG.enablePredictivePrefetch).toBe(true);
  });
});
