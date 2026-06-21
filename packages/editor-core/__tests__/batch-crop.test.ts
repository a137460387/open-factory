import { describe, expect, it } from 'vitest';
import {
  calculateBatchCropPreview,
  calculateBatchCropPreviews,
  buildBatchCropResults,
  collectBatchCropTargets,
  normalizeBatchAspectRatioOption,
  isCustomBatchAspectRatio,
  resolveCustomRatioValue,
  smartAnchorForClip,
  formatAspectRatioLabel
} from '../src/batch-crop';
import type { BatchCropAnchor, BatchCropTarget } from '../src/batch-crop';
import type { Timeline, MediaAsset, Clip, Track } from '../src/model';
import { createTrack, createProject } from '../src/model';
import { makeVideoClip, makeTimeline } from './test-utils';

const sampleTargets: BatchCropTarget[] = [
  { clipId: 'clip-1', sourceWidth: 1920, sourceHeight: 1080, name: 'Clip 1' },
  { clipId: 'clip-2', sourceWidth: 1080, sourceHeight: 1920, name: 'Clip 2' },
  { clipId: 'clip-3', sourceWidth: 1920, sourceHeight: 1920, name: 'Clip 3' }
];

describe('batch crop calculations', () => {
  it('calculates crop preview for 16:9', () => {
    const preview = calculateBatchCropPreview(sampleTargets[0], '16:9', { mode: 'center', offsetX: 0, offsetY: 0 });
    expect(preview.cropWidth).toBe(1920);
    expect(preview.cropHeight).toBe(1080);
    expect(preview.cropX).toBe(0);
    expect(preview.cropY).toBe(0);
  });

  it('calculates crop preview for 9:16', () => {
    const preview = calculateBatchCropPreview(sampleTargets[0], '9:16', { mode: 'center', offsetX: 0, offsetY: 0 });
    expect(preview.cropWidth).toBe(1080);
    expect(preview.cropHeight).toBe(1920);
    expect(preview.cropX).toBe(420);
    expect(preview.cropY).toBe(0);
  });

  it('calculates crop preview for 1:1', () => {
    const preview = calculateBatchCropPreview(sampleTargets[0], '1:1', { mode: 'center', offsetX: 0, offsetY: 0 });
    expect(preview.cropWidth).toBe(1920);
    expect(preview.cropHeight).toBe(1920);
    expect(preview.cropX).toBe(0);
    expect(preview.cropY).toBe(0);
  });

  it('calculates crop preview for 4:5', () => {
    const preview = calculateBatchCropPreview(sampleTargets[0], '4:5', { mode: 'center', offsetX: 0, offsetY: 0 });
    expect(preview.cropWidth).toBe(1536);
    expect(preview.cropHeight).toBe(1920);
    expect(preview.cropX).toBe(192);
    expect(preview.cropY).toBe(0);
  });

  it('calculates crop preview for 21:9', () => {
    const preview = calculateBatchCropPreview(sampleTargets[0], '21:9', { mode: 'center', offsetX: 0, offsetY: 0 });
    expect(preview.cropWidth).toBe(1920);
    expect(preview.cropHeight).toBe(822);
  });

  it('calculates previews for multiple targets', () => {
    const anchors = new Map<string, BatchCropAnchor>();
    const previews = calculateBatchCropPreviews(sampleTargets, '9:16', anchors);
    expect(previews).toHaveLength(3);
    expect(previews[0].clipId).toBe('clip-1');
    expect(previews[1].clipId).toBe('clip-2');
    expect(previews[2].clipId).toBe('clip-3');
  });

  it('builds batch crop results', () => {
    const anchors = new Map<string, BatchCropAnchor>();
    anchors.set('clip-1', { mode: 'smart', offsetX: 0.2, offsetY: -0.3 });
    const results = buildBatchCropResults(sampleTargets, '9:16', anchors);
    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({ clipId: 'clip-1', targetAspectRatio: '9:16', offsetX: 0.2, offsetY: -0.3 });
    expect(results[1]).toMatchObject({ clipId: 'clip-2', targetAspectRatio: '9:16', offsetX: 0, offsetY: 0 });
  });
});

describe('batch crop normalization', () => {
  it('normalizes batch aspect ratio option', () => {
    expect(normalizeBatchAspectRatioOption('16:9')).toBe('16:9');
    expect(normalizeBatchAspectRatioOption('9:16')).toBe('9:16');
    expect(normalizeBatchAspectRatioOption('custom')).toBe('custom');
    expect(normalizeBatchAspectRatioOption('unknown')).toBe('custom');
  });

  it('identifies custom batch aspect ratio', () => {
    expect(isCustomBatchAspectRatio('custom')).toBe(true);
    expect(isCustomBatchAspectRatio('16:9')).toBe(false);
  });

  it('resolves custom ratio value', () => {
    expect(resolveCustomRatioValue(16, 9)).toBeCloseTo(16 / 9, 5);
    expect(resolveCustomRatioValue(1, 1)).toBe(1);
  });

  it('creates smart anchor for clip', () => {
    const anchor = smartAnchorForClip({ id: 'c1', name: 'Test' }, 1920, 1080);
    expect(anchor.mode).toBe('smart');
    expect(anchor.offsetX).toBe(0);
    expect(anchor.offsetY).toBe(0);
  });

  it('formats aspect ratio label', () => {
    expect(formatAspectRatioLabel('16:9')).toBe('16:9');
    expect(formatAspectRatioLabel('custom')).toBe('Custom');
  });
});

describe('batch crop anchor with offset', () => {
  it('applies smart anchor offset to crop position', () => {
    const preview = calculateBatchCropPreview(sampleTargets[0], '9:16', { mode: 'smart', offsetX: 0.5, offsetY: -0.5 });
    expect(preview.cropWidth).toBe(1080);
    expect(preview.cropHeight).toBe(1920);
    expect(preview.cropX).toBe(630);
    expect(preview.cropY).toBe(0);
  });
});

describe('collectBatchCropTargets', () => {
  it('collects targets from matching clip IDs', () => {
    const clip = makeVideoClip({ id: 'c1', mediaId: 'a1' });
    const timeline = makeTimeline([clip]);
    const media: MediaAsset[] = [
      { id: 'a1', name: 'Video 1', path: '/video1.mp4', type: 'video', duration: 10, width: 1920, height: 1080, missing: false, folderId: null }
    ];
    const targets = collectBatchCropTargets(timeline, ['c1'], media);
    expect(targets.length).toBeGreaterThanOrEqual(1);
    expect(targets[0].clipId).toBe('c1');
    expect(targets[0].sourceWidth).toBe(1920);
    expect(targets[0].sourceHeight).toBe(1080);
  });

  it('uses default dimensions when media asset is missing', () => {
    const clip = makeVideoClip({ id: 'c2', mediaId: 'a2' });
    const timeline = makeTimeline([clip]);
    const targets = collectBatchCropTargets(timeline, ['c2'], []);
    expect(targets).toHaveLength(1);
    expect(targets[0].sourceWidth).toBe(1920);
    expect(targets[0].sourceHeight).toBe(1080);
  });

  it('filters out clips not in clipIds', () => {
    const clip = makeVideoClip({ id: 'c3' });
    const timeline = makeTimeline([clip]);
    const targets = collectBatchCropTargets(timeline, ['nonexistent'], []);
    expect(targets).toHaveLength(0);
  });

  it('handles text clips without mediaId', () => {
    const textClip = makeTextClip({ id: 'txt1', name: 'Title' });
    const timeline = makeTimeline([textClip]);
    const targets = collectBatchCropTargets(timeline, ['txt1'], []);
    expect(targets).toHaveLength(1);
    expect(targets[0].clipId).toBe('txt1');
    expect(targets[0].name).toBe('Title');
    expect(targets[0].sourceWidth).toBe(1920);
    expect(targets[0].sourceHeight).toBe(1080);
  });
});
import { collectBatchCropTargets } from '../src/batch-crop';
import type { Clip } from '../src/model';
import { makeTextClip } from './test-utils';
