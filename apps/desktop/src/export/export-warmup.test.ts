import { beforeEach, describe, expect, it } from 'vitest';
import { createProject, type FfmpegCapabilities } from '@open-factory/editor-core';
import {
  EXPORT_WARMUP_CACHE_TTL_MS,
  resetExportWarmupCache,
  runExportWarmup,
  type ExportWarmupDependencies,
} from './export-warmup';

const availableCapabilities: FfmpegCapabilities = {
  available: true,
  version: 'ffmpeg 6.0',
  hasLibx264: true,
  hasAac: true,
  hasDrawtext: true,
  hasLibfreetype: true,
  hasMinterpolate: true,
  hasArnndn: true,
  hasLibvmaf: true,
  hardwareEncoderAvailable: false,
  hardwareEncoder: null,
  drawtextWarning: null,
};

describe('export warmup', () => {
  beforeEach(() => resetExportWarmupCache());

  it('runs warmup steps in export-start order', async () => {
    const calls: string[] = [];
    const steps: string[] = [];
    const project = createProject('Warmup Order');
    const deps: ExportWarmupDependencies = {
      checkProxyGeneration: () => {
        calls.push('proxy');
      },
      createTempDirectory: () => {
        calls.push('temp-dir');
        return 'C:/Temp/open-factory/segments';
      },
      getFfmpegCapabilities: () => {
        calls.push('ffmpeg');
        return availableCapabilities;
      },
      checkFonts: () => {
        calls.push('fonts');
      },
      now: () => 1_000,
    };

    const result = await runExportWarmup(project, deps, { onStep: (step) => steps.push(step) });

    expect(calls).toEqual(['proxy', 'temp-dir', 'ffmpeg', 'fonts']);
    expect(steps).toEqual(['proxy-check', 'temp-dir', 'ffmpeg', 'fonts']);
    expect(result.cached).toBe(false);
    expect(result.steps).toEqual(['proxy-check', 'temp-dir', 'ffmpeg', 'fonts']);
  });

  it('uses the five-minute cache without repeating warmup work', async () => {
    let now = 10_000;
    let calls = 0;
    const project = createProject('Warmup Cache');
    const deps: ExportWarmupDependencies = {
      checkProxyGeneration: () => {
        calls += 1;
      },
      createTempDirectory: () => 'C:/Temp/open-factory/segments',
      getFfmpegCapabilities: () => availableCapabilities,
      checkFonts: () => undefined,
      now: () => now,
    };

    await runExportWarmup(project, deps);
    now += EXPORT_WARMUP_CACHE_TTL_MS - 1;
    const cached = await runExportWarmup(project, deps);
    now += 2;
    const expired = await runExportWarmup(project, deps);

    expect(cached.cached).toBe(true);
    expect(expired.cached).toBe(false);
    expect(calls).toBe(2);
  });

  it('fails before enqueue when FFmpeg is unavailable', async () => {
    const calls: string[] = [];
    const project = createProject('Warmup Failure');
    const unavailable = { ...availableCapabilities, available: false, version: null };
    const deps: ExportWarmupDependencies = {
      checkProxyGeneration: () => {
        calls.push('proxy');
      },
      createTempDirectory: () => {
        calls.push('temp-dir');
        return 'C:/Temp/open-factory/segments';
      },
      getFfmpegCapabilities: () => {
        calls.push('ffmpeg');
        return unavailable;
      },
      checkFonts: () => {
        calls.push('fonts');
      },
      now: () => 1_000,
    };

    await expect(runExportWarmup(project, deps, { ffmpegUnavailableMessage: 'FFmpeg 不可用' })).rejects.toThrow(
      'FFmpeg 不可用',
    );
    await expect(runExportWarmup(project, deps, { ffmpegUnavailableMessage: 'FFmpeg 不可用' })).rejects.toThrow(
      'FFmpeg 不可用',
    );

    expect(calls).toEqual(['proxy', 'temp-dir', 'ffmpeg', 'proxy', 'temp-dir', 'ffmpeg']);
  });
});
