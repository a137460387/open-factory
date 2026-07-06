import { describe, expect, it } from 'vitest';
import {
  THUMBNAIL_SAMPLE_COUNT,
  THUMBNAIL_TOP_CANDIDATE_COUNT,
  buildThumbnailExportSettings,
  buildThumbnailOutputFileName,
  buildThumbnailOutputPath,
  buildThumbnailSampleTimestamps,
  rankThumbnailCandidates,
  scoreThumbnailFrame,
  type ThumbnailCandidate,
  type ThumbnailFrameSample
} from '../src';

function makeSample({
  faceDetected = false,
  pixels,
  width = 4,
  height = 4
}: {
  faceDetected?: boolean;
  pixels: Array<[number, number, number]>;
  width?: number;
  height?: number;
}): ThumbnailFrameSample {
  return {
    timestamp: 0,
    width,
    height,
    faceDetected,
    data: pixels.flatMap(([r, g, b]) => [r, g, b, 255])
  };
}

const neutralPixels: Array<[number, number, number]> = Array.from({ length: 16 }, () => [120, 120, 120]);
const sharpColorPixels: Array<[number, number, number]> = [
  [0, 0, 0],
  [255, 0, 0],
  [0, 0, 0],
  [0, 0, 255],
  [0, 255, 0],
  [255, 255, 255],
  [0, 0, 255],
  [255, 255, 0],
  [0, 0, 0],
  [255, 255, 0],
  [0, 0, 0],
  [255, 0, 255],
  [255, 0, 0],
  [0, 0, 0],
  [0, 255, 255],
  [0, 0, 0]
];

describe('thumbnail scoring', () => {
  it('samples twenty evenly spaced timestamps inside the media duration', () => {
    const timestamps = buildThumbnailSampleTimestamps(21);

    expect(timestamps).toHaveLength(THUMBNAIL_SAMPLE_COUNT);
    expect(timestamps[0]).toBe(1);
    expect(timestamps.at(-1)).toBe(20);
  });

  it('returns all-zero timestamps for zero or negative duration', () => {
    expect(buildThumbnailSampleTimestamps(0)).toEqual(Array.from({ length: THUMBNAIL_SAMPLE_COUNT }, () => 0));
    expect(buildThumbnailSampleTimestamps(-5)).toEqual(Array.from({ length: THUMBNAIL_SAMPLE_COUNT }, () => 0));
  });

  it('scores face, clarity, color richness, and low motion dimensions', () => {
    const previous = makeSample({ pixels: neutralPixels });
    const colorful = makeSample({ faceDetected: true, pixels: sharpColorPixels });
    const score = scoreThumbnailFrame(colorful, { previous });

    expect(score.face).toBe(40);
    expect(score.clarity).toBeGreaterThan(0);
    expect(score.color).toBeGreaterThan(0);
    expect(score.motion).toBeLessThan(15);
    expect(score.total).toBeCloseTo(score.face + score.clarity + score.color + score.motion, 5);
  });

  it('awards the full low-motion score when no neighbor frame is available', () => {
    const score = scoreThumbnailFrame(makeSample({ pixels: neutralPixels }));

    expect(score.motion).toBe(15);
  });

  it('uses next frame for motion comparison when previous is not available', () => {
    const next = makeSample({ pixels: neutralPixels });
    const sample = makeSample({ pixels: sharpColorPixels });
    const score = scoreThumbnailFrame(sample, { next });

    expect(score.motion).toBeLessThan(15);
  });

  it('does not crash or add face points when YuNet detection is unavailable', () => {
    const sample = makeSample({ pixels: sharpColorPixels });
    delete sample.faceDetected;

    expect(() => scoreThumbnailFrame(sample)).not.toThrow();
    expect(scoreThumbnailFrame(sample).face).toBe(0);
  });

  it('ranks the top five candidates by total score, face, clarity, and timestamp', () => {
    const candidates: ThumbnailCandidate[] = Array.from({ length: 7 }, (_item, index) => ({
      ...makeSample({ pixels: neutralPixels }),
      timestamp: index,
      score: {
        face: index === 2 ? 40 : 0,
        clarity: index === 1 ? 20 : 5,
        color: 0,
        motion: 0,
        total: index === 2 ? 50 : index === 1 ? 30 : index
      }
    }));

    const ranked = rankThumbnailCandidates(candidates);

    expect(ranked).toHaveLength(THUMBNAIL_TOP_CANDIDATE_COUNT);
    expect(ranked.map((candidate) => candidate.timestamp)).toEqual([2, 1, 6, 5, 4]);
  });

  it('builds platform export settings for crop and fit modes', () => {
    expect(buildThumbnailExportSettings('youtube', true)).toMatchObject({
      width: 1280,
      height: 720,
      scaleMode: 'none',
      targetAspectRatio: '16:9',
      format: 'jpg'
    });
    expect(buildThumbnailExportSettings('bilibili', true)).toMatchObject({ width: 1920, height: 1080, targetAspectRatio: '16:9' });
    expect(buildThumbnailExportSettings('douyin', true)).toMatchObject({ width: 1080, height: 1920, targetAspectRatio: '9:16' });
    expect(buildThumbnailExportSettings('douyin', false)).toMatchObject({ scaleMode: 'fit', targetAspectRatio: 'source' });
  });

  it('formats batch thumbnail file names and output paths', () => {
    expect(buildThumbnailOutputFileName('Launch Cut.mp4')).toBe('Launch-Cut_thumb.jpg');
    expect(buildThumbnailOutputFileName('频道片头.mov')).toBe('频道片头_thumb.jpg');
    expect(buildThumbnailOutputPath('C:\\Exports\\thumbs\\', 'Launch Cut.mp4')).toBe('C:/Exports/thumbs/Launch-Cut_thumb.jpg');
  });

  it('scores zero-dimension sample with empty data gracefully', () => {
    const degenerate: ThumbnailFrameSample = { timestamp: 0, width: 0, height: 0, data: [] };
    const score = scoreThumbnailFrame(degenerate);
    expect(score.face).toBe(0);
    expect(score.clarity).toBe(0);
    expect(score.color).toBe(0);
    expect(score.motion).toBe(15);
    expect(score.total).toBe(15);
  });

  it('returns zero clarity when frame is too small for Laplacian kernel', () => {
    const tiny = makeSample({ width: 2, height: 2, pixels: [[120, 120, 120], [100, 100, 100], [80, 80, 80], [60, 60, 60]] });
    const score = scoreThumbnailFrame(tiny);
    expect(score.clarity).toBe(0);
  });
});
