import { describe, expect, it } from 'vitest';
import type { MediaAsset } from '@open-factory/editor-core';
import { createProject } from '@open-factory/editor-core';
import { buildBatchWatermarkFileName, buildBatchWatermarkJobs, selectBatchWatermarkPreviewJob } from './batchWatermark';

describe('batch watermark helpers', () => {
  it('builds one export job for each selected video or image asset', () => {
    const project = createProject('Batch Watermark');
    project.media = [
      asset('video-a', 'Scene A.mp4', 'video'),
      asset('image-a', 'Still.png', 'image'),
      asset('audio-a', 'Voice.wav', 'audio'),
      asset('video-b', 'Scene B.mov', 'video')
    ];

    const jobs = buildBatchWatermarkJobs(project, {
      assetIds: ['video-a', 'image-a', 'audio-a', 'video-b'],
      outputDirectory: 'D:/Exports',
      watermarkText: 'DRAFT'
    });

    expect(jobs).toHaveLength(3);
    expect(jobs.map((job) => job.assetId)).toEqual(['video-a', 'image-a', 'video-b']);
    expect(jobs.map((job) => job.outputPath)).toEqual(['D:/Exports/Scene A_watermarked.mp4', 'D:/Exports/Still_watermarked.mp4', 'D:/Exports/Scene B_watermarked.mp4']);
    expect(jobs.every((job) => job.settings.watermark?.enabled)).toBe(true);
  });

  it('renders file name templates with base name index and extension', () => {
    expect(buildBatchWatermarkFileName(asset('a', 'clip.v1.mp4', 'video'), '{name}_{index}_wm.{ext}', 7)).toBe('clip.v1_007_wm.mp4');
    expect(buildBatchWatermarkFileName(asset('b', 'still.png', 'image'), undefined, 1)).toBe('still_watermarked.mp4');
  });

  it('uses the first selected job for preview generation only', () => {
    const project = createProject('Preview First');
    project.media = [asset('first', 'first.mp4', 'video'), asset('second', 'second.mp4', 'video')];
    const jobs = buildBatchWatermarkJobs(project, {
      assetIds: ['first', 'second'],
      outputDirectory: 'D:/Exports'
    });

    expect(selectBatchWatermarkPreviewJob(jobs)?.assetId).toBe('first');
  });
});

function asset(id: string, name: string, type: MediaAsset['type']): MediaAsset {
  return {
    id,
    name,
    type,
    path: `C:/Media/${name}`,
    duration: type === 'image' ? 0 : 6,
    width: type === 'audio' ? 0 : 1280,
    height: type === 'audio' ? 0 : 720,
    hasAudio: type === 'video'
  };
}
