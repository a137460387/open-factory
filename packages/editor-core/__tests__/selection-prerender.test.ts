import { describe, expect, it } from 'vitest';
import {
  buildClipContentDigest,
  buildRenderCacheFilePath,
  calculateSelectionRenderHash,
  checkSelectionCacheStatus,
  doesPropertyChangeTriggerStale,
  calculateDurationOverflow,
  clipToDigestInput,
  collectClipsInRange,
  type ClipDigestInput,
  type SelectionRenderCacheEntry,
} from '../src/selection-prerender';
import type { Clip, VideoClip, Timeline } from '../src/model';

function makeClipDigest(overrides: Partial<ClipDigestInput> = {}): ClipDigestInput {
  return {
    clipId: 'c1',
    start: 0,
    duration: 10,
    trimStart: 0,
    speed: 1,
    colorBrightness: 0,
    colorContrast: 0,
    colorSaturation: 0,
    colorHue: 0,
    effects: [],
    keyframeSnapshot: '',
    ...overrides,
  };
}

function makeVideoClip(overrides: Partial<VideoClip> = {}): VideoClip {
  return {
    id: 'clip-1', type: 'video', name: 'C', trackId: 't',
    start: 0, duration: 10, trimStart: 0, trimEnd: 0, speed: 1,
    mediaId: 'm1', volume: 1,
    colorCorrection: { brightness: 0, contrast: 0, saturation: 0, hue: 0 },
    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    ...overrides,
  };
}

describe('buildClipContentDigest', () => {
  it('produces consistent digest for same input', () => {
    const d = buildClipContentDigest([makeClipDigest()]);
    expect(d).toBe(buildClipContentDigest([makeClipDigest()]));
  });

  it('produces different digest when brightness changes', () => {
    const d1 = buildClipContentDigest([makeClipDigest()]);
    const d2 = buildClipContentDigest([makeClipDigest({ colorBrightness: 0.5 })]);
    expect(d1).not.toBe(d2);
  });

  it('produces different digest when effects change', () => {
    const d1 = buildClipContentDigest([makeClipDigest()]);
    const d2 = buildClipContentDigest([makeClipDigest({ effects: [{ id: 'e1', type: 'blur', params: {} }] })]);
    expect(d1).not.toBe(d2);
  });

  it('produces different digest when speed changes', () => {
    const d1 = buildClipContentDigest([makeClipDigest()]);
    const d2 = buildClipContentDigest([makeClipDigest({ speed: 2 })]);
    expect(d1).not.toBe(d2);
  });
});

describe('calculateSelectionRenderHash', () => {
  it('produces different hash when clip content changes', async () => {
    const h1 = await calculateSelectionRenderHash(0, 10, [makeClipDigest()]);
    const h2 = await calculateSelectionRenderHash(0, 10, [makeClipDigest({ colorBrightness: 1 })]);
    expect(h1).not.toBe(h2);
  });

  it('produces different hash when time range changes', async () => {
    const h1 = await calculateSelectionRenderHash(0, 10, [makeClipDigest()]);
    const h2 = await calculateSelectionRenderHash(0, 20, [makeClipDigest()]);
    expect(h1).not.toBe(h2);
  });

  it('produces same hash for identical inputs', async () => {
    const h1 = await calculateSelectionRenderHash(0, 10, [makeClipDigest()]);
    const h2 = await calculateSelectionRenderHash(0, 10, [makeClipDigest()]);
    expect(h1).toBe(h2);
  });

  it('uses custom sha256 function when provided', async () => {
    const h = await calculateSelectionRenderHash(0, 10, [makeClipDigest()], async () => 'custom-hash');
    expect(h).toBe('custom-hash');
  });

  it('falls back to simpleHash when crypto.subtle is unavailable', async () => {
    const origCrypto = globalThis.crypto;
    try {
      Object.defineProperty(globalThis, 'crypto', {
        value: { subtle: undefined },
        configurable: true,
        writable: true,
      });
      const h = await calculateSelectionRenderHash(0, 10, [makeClipDigest()]);
      expect(typeof h).toBe('string');
      expect(h.length).toBeGreaterThan(0);
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        value: origCrypto,
        configurable: true,
        writable: true,
      });
    }
  });
});

describe('buildRenderCacheFilePath', () => {
  it('builds correct path: projectId/hash.mp4', () => {
    expect(buildRenderCacheFilePath('proj-1', 'abc123')).toBe('proj-1/abc123.mp4');
  });
});

describe('checkSelectionCacheStatus', () => {
  it('returns none when no cached entry', () => {
    expect(checkSelectionCacheStatus('hash1', undefined)).toBe('none');
  });

  it('returns valid when hash matches', () => {
    const entry: SelectionRenderCacheEntry = { hash: 'hash1', filePath: 'p', startSec: 0, endSec: 10, createdAt: 0 };
    expect(checkSelectionCacheStatus('hash1', entry)).toBe('valid');
  });

  it('returns stale when hash differs', () => {
    const entry: SelectionRenderCacheEntry = { hash: 'hash1', filePath: 'p', startSec: 0, endSec: 10, createdAt: 0 };
    expect(checkSelectionCacheStatus('hash2', entry)).toBe('stale');
  });
});

describe('doesPropertyChangeTriggerStale', () => {
  it('returns true for brightness (color)', () => {
    expect(doesPropertyChangeTriggerStale('brightness')).toBe(true);
  });

  it('returns true for effects', () => {
    expect(doesPropertyChangeTriggerStale('effects')).toBe(true);
  });

  it('returns true for keyframes', () => {
    expect(doesPropertyChangeTriggerStale('keyframes')).toBe(true);
  });

  it('returns true for trimStart (裁剪)', () => {
    expect(doesPropertyChangeTriggerStale('trimStart')).toBe(true);
  });

  it('returns true for speed', () => {
    expect(doesPropertyChangeTriggerStale('speed')).toBe(true);
  });

  it('returns false for volume (音量/静音不触发stale)', () => {
    expect(doesPropertyChangeTriggerStale('volume')).toBe(false);
  });

  it('returns false for muted', () => {
    expect(doesPropertyChangeTriggerStale('muted')).toBe(false);
  });

  it('returns false for pan', () => {
    expect(doesPropertyChangeTriggerStale('pan')).toBe(false);
  });
});

describe('calculateDurationOverflow', () => {
  it('returns 0 when under limit', () => {
    expect(calculateDurationOverflow(100, 200)).toBe(0);
  });

  it('returns overflow seconds when over limit', () => {
    expect(calculateDurationOverflow(250, 200)).toBe(50);
  });

  it('returns 0 when maxDuration is 0 or negative', () => {
    expect(calculateDurationOverflow(100, 0)).toBe(0);
    expect(calculateDurationOverflow(100, -10)).toBe(0);
  });
});

describe('clipToDigestInput', () => {
  it('extracts correct digest fields from clip', () => {
    const clip = makeVideoClip({ speed: 2, trimStart: 1 });
    const d = clipToDigestInput(clip);
    expect(d.clipId).toBe('clip-1');
    expect(d.speed).toBe(2);
    expect(d.trimStart).toBe(1);
    expect(d.colorBrightness).toBe(0);
  });
});

describe('collectClipsInRange', () => {
  function makeTimeline(clips: Clip[]): Timeline {
    return { tracks: [{ id: 't1', type: 'video', name: 'V1', clips }] } as unknown as Timeline;
  }

  it('returns empty array for empty timeline', () => {
    expect(collectClipsInRange(makeTimeline([]), 0, 10)).toEqual([]);
  });

  it('returns clips that overlap the range', () => {
    const clip1 = makeVideoClip({ id: 'c1', start: 2, duration: 5 });
    const clip2 = makeVideoClip({ id: 'c2', start: 20, duration: 5 });
    const result = collectClipsInRange(makeTimeline([clip1, clip2]), 0, 10);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c1');
  });

  it('returns clips whose end overlaps start of range', () => {
    const clip = makeVideoClip({ id: 'c1', start: 0, duration: 5 });
    const result = collectClipsInRange(makeTimeline([clip]), 4, 10);
    expect(result).toHaveLength(1);
  });

  it('excludes clips whose end is at range start', () => {
    const clip = makeVideoClip({ id: 'c1', start: 0, duration: 5 });
    const result = collectClipsInRange(makeTimeline([clip]), 5, 10);
    expect(result).toHaveLength(0);
  });
});
