import { describe, expect, it } from 'vitest';
import type { ExportTask, FfmpegExportPlan } from '@open-factory/editor-core';
import {
  applyCodecCompareQualityResult,
  buildCodecCompareJobs,
  collectPendingCodecCompareEvaluations,
  createInitialCodecCompareResults,
  recommendCodecCompareResult,
} from './codec-compare';
import type { ExportPreset } from './export-presets';

const presets: ExportPreset[] = [
  preset('web-1080p', 'Web 1080p', 'mp4', 'libx264'),
  preset('hevc', 'HEVC Review', 'mp4', 'libx265'),
  preset('webm', 'WebM VP9', 'webm', 'libvpx-vp9'),
  preset('prores', 'ProRes 422', 'mov', 'prores_ks'),
  preset('extra', 'Extra', 'mp4', 'libx264'),
];

describe('codec compare export', () => {
  it('builds up to four preset jobs with codec-specific output paths', () => {
    const jobs = buildCodecCompareJobs({
      baseOutputPath: 'C:/Exports/master.mp4',
      presets,
      selectedPresetIds: ['web-1080p', 'hevc', 'webm', 'prores', 'extra'],
    });

    expect(jobs).toHaveLength(4);
    expect(jobs.map((job) => job.outputPath)).toEqual([
      'C:/Exports/master-Web-1080p.mp4',
      'C:/Exports/master-HEVC-Review.mp4',
      'C:/Exports/master-WebM-VP9.webm',
      'C:/Exports/master-ProRes-422.mov',
    ]);
    expect(jobs[1].settings.videoCodec).toBe('libx265');
  });

  it('recommends different presets for quality and size weights', () => {
    const results = [
      result('hq', 'High Quality', 40_000_000, 0.996, 45),
      result('balanced', 'Balanced', 18_000_000, 0.991, 42),
      result('small', 'Small', 6_000_000, 0.955, 35),
    ];

    expect(recommendCodecCompareResult(results, 'quality')?.presetId).toBe('hq');
    expect(recommendCodecCompareResult(results, 'size')?.presetId).toBe('small');
  });

  it('collects successful comparison tasks for automatic SSIM and PSNR evaluation once', () => {
    const jobs = buildCodecCompareJobs({
      baseOutputPath: 'C:/Exports/master.mp4',
      presets,
      selectedPresetIds: ['web-1080p', 'hevc'],
    });
    const tasks = jobs.map((job, index) => task(`task-${index + 1}`, job.outputPath, 'success'));
    const initial = createInitialCodecCompareResults(jobs, tasks);

    const pending = collectPendingCodecCompareEvaluations(initial);
    expect(pending).toEqual([
      { taskId: 'task-1', sourcePath: 'C:/Media/source.mp4', outputPath: 'C:/Exports/master-Web-1080p.mp4' },
      { taskId: 'task-2', sourcePath: 'C:/Media/source.mp4', outputPath: 'C:/Exports/master-HEVC-Review.mp4' },
    ]);

    const evaluated = applyCodecCompareQualityResult(
      initial,
      'task-1',
      { taskId: 'task-1', ssim: 0.99, psnr: 42, vmafAvailable: false, durationMs: 10 },
      4096,
    );
    expect(collectPendingCodecCompareEvaluations(evaluated).map((request) => request.taskId)).toEqual(['task-2']);
  });
});

function preset(id: string, name: string, format: string, videoCodec: string): ExportPreset {
  return {
    id,
    name,
    description: name,
    builtin: true,
    settings: {
      format,
      videoCodec,
      audioCodec: 'aac',
      outputMode: 'video',
    },
  };
}

function result(presetId: string, presetName: string, fileSizeBytes: number, ssim: number, psnr: number) {
  return {
    presetId,
    presetName,
    outputPath: `C:/Exports/${presetId}.mp4`,
    taskId: presetId,
    status: 'success' as const,
    sourcePath: 'C:/Media/source.mp4',
    fileSizeBytes,
    ssim,
    psnr,
    qualityStatus: 'complete' as const,
  };
}

function task(id: string, outputPath: string, status: ExportTask['status']): ExportTask {
  return {
    id,
    name: id,
    outputPath,
    plan: {
      inputs: [{ path: 'C:/Media/source.mp4', args: [], index: 0 }],
      filterComplex: '',
      maps: [],
      outputArgs: [],
      fullArgs: [],
      warnings: [],
      textArtifacts: [],
      nestedPlans: [],
      duration: 3,
    } satisfies FfmpegExportPlan,
    priority: 'normal',
    status,
    progress: status === 'success' ? 1 : 0,
    createdAt: '2026-06-16T00:00:00.000Z',
    startedAt: '2026-06-16T00:00:01.000Z',
    finishedAt: status === 'success' ? '2026-06-16T00:00:03.000Z' : undefined,
  };
}
