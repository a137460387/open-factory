import { describe, expect, it } from 'vitest';
import {
  buildProgressiveExportPlan,
  buildProgressivePartialPath,
  buildProgressiveResumeArgs,
  createExportTask,
  createProgressiveExportState,
  estimateProgressiveCompletedDuration,
  interruptExportTask,
  isProgressiveExportSupported,
  updateExportTaskProgressive,
  type FfmpegExportPlan
} from '../src';

const plan: FfmpegExportPlan = {
  inputs: [{ index: 0, path: 'C:/Media/source.mp4', args: ['-i', 'C:/Media/source.mp4'] }],
  filterComplex: '',
  maps: ['-map', '0:v:0'],
  outputArgs: ['-c:v', 'libx264', 'C:/Exports/final.mp4'],
  fullArgs: ['-y', '-i', 'C:/Media/source.mp4', '-map', '0:v:0', '-c:v', 'libx264', 'C:/Exports/final.mp4'],
  warnings: [],
  textArtifacts: [],
  nestedPlans: [],
  duration: 10,
  displayCommand: 'ffmpeg -i C:/Media/source.mp4 C:/Exports/final.mp4'
};

describe('progressive export helpers', () => {
  it('builds stable partial mp4 paths next to the final output', () => {
    expect(buildProgressivePartialPath('C:/Exports/review.mp4')).toBe('C:/Exports/review.partial.mp4');
    expect(buildProgressivePartialPath('D:\\Exports\\review.cut.mov')).toBe('D:\\Exports\\review.cut.partial.mp4');
    expect(buildProgressivePartialPath('C:/Exports/no-extension')).toBe('C:/Exports/no-extension.partial.mp4');
  });

  it('accepts only H.264/H.265 MP4 video exports', () => {
    expect(isProgressiveExportSupported({ format: 'mp4', videoCodec: 'libx264', outputMode: 'video' })).toBe(true);
    expect(isProgressiveExportSupported({ format: 'mp4', videoCodec: 'hevc_nvenc', outputMode: 'video' })).toBe(true);
    expect(isProgressiveExportSupported({ format: 'mov', videoCodec: 'libx264', outputMode: 'video' })).toBe(false);
    expect(isProgressiveExportSupported({ format: 'mp4', videoCodec: 'vp9', outputMode: 'video' })).toBe(false);
    expect(isProgressiveExportSupported({ format: 'mp4', videoCodec: 'libx264', outputMode: 'audio' })).toBe(false);
  });

  it('builds resume args from completed duration', () => {
    expect(buildProgressiveResumeArgs(0)).toEqual([]);
    expect(buildProgressiveResumeArgs(2.5)).toEqual(['-ss', '2.5']);
    expect(buildProgressiveResumeArgs(2.3456)).toEqual(['-ss', '2.346']);
    expect(estimateProgressiveCompletedDuration(10, 0.42)).toBe(4.2);
  });

  it('rewrites the export plan to write the partial file and resume with -ss', () => {
    const progressive = buildProgressiveExportPlan(plan, 'C:/Exports/final.partial.mp4', 3);

    expect(progressive.outputArgs).toEqual(['-c:v', 'libx264', '-movflags', '+frag_keyframe+empty_moov+default_base_moof', '-ss', '3', 'C:/Exports/final.partial.mp4']);
    expect(progressive.fullArgs).toEqual([
      '-y',
      '-i',
      'C:/Media/source.mp4',
      '-map',
      '0:v:0',
      '-c:v',
      'libx264',
      '-movflags',
      '+frag_keyframe+empty_moov+default_base_moof',
      '-ss',
      '3',
      'C:/Exports/final.partial.mp4'
    ]);
    expect(progressive.displayCommand).toContain('C:/Exports/final.partial.mp4');
  });

  it('merges playable partial movflags with existing mp4 flags', () => {
    const progressive = buildProgressiveExportPlan(
      {
        ...plan,
        outputArgs: ['-c:v', 'libx264', '-movflags', '+faststart', 'C:/Exports/final.mp4'],
        fullArgs: ['-y', '-i', 'C:/Media/source.mp4', '-c:v', 'libx264', '-movflags', '+faststart', 'C:/Exports/final.mp4']
      },
      'C:/Exports/final.partial.mp4',
      0
    );

    const movflagsIndex = progressive.fullArgs.indexOf('-movflags');
    expect(progressive.fullArgs[movflagsIndex + 1]).toBe('+faststart+frag_keyframe+empty_moov+default_base_moof');
  });

  it('keeps progressive state on queued tasks and updates completed duration', () => {
    const progressive = createProgressiveExportState({
      outputPath: 'C:/Exports/final.mp4',
      settings: { format: 'mp4', videoCodec: 'libx264', outputMode: 'video' }
    });
    const task = createExportTask({ id: 'progressive-task', name: 'final.mp4', outputPath: 'C:/Exports/final.mp4', plan, progressive });

    expect(task.progressive?.partialPath).toBe('C:/Exports/final.partial.mp4');

    const [updated] = updateExportTaskProgressive([task], 'progressive-task', { completedDuration: 4.25 });
    expect(updated.progressive?.completedDuration).toBe(4.25);

    const [interrupted] = interruptExportTask([{ ...updated, status: 'running' }], 'progressive-task', 'paused', 'now');
    expect(interrupted.status).toBe('interrupted');
    expect(interrupted.progressive?.completedDuration).toBe(4.25);
  });
});
