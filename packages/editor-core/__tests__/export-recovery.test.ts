import { describe, expect, it } from 'vitest';
import {
  appendExportRecoveryLog,
  buildExportRecoveryDecision,
  buildExportRecoveryReport,
  classifyExportError,
  fallbackExportCodecPlan,
  hasEnoughDiskSpace,
  MAX_EXPORT_RECOVERY_ATTEMPTS,
  stripDrawtextFromExportPlan,
  type FfmpegExportPlan
} from '../src';

describe('export recovery', () => {
  it('classifies common FFmpeg failure messages', () => {
    expect(classifyExportError('Unknown encoder h264_nvenc')).toBe('unsupported-codec');
    expect(classifyExportError('Cannot allocate memory while opening encoder')).toBe('out-of-memory');
    expect(classifyExportError('No space left on device')).toBe('disk-space');
    expect(classifyExportError('drawtext failed to load font file')).toBe('missing-font');
    expect(classifyExportError('ffmpeg failed with exit code 1')).toBe('ffmpeg-crash');
  });

  it('stops recovery after the maximum attempt count', () => {
    const decision = buildExportRecoveryDecision(makePlan('h264_nvenc'), 'Unknown encoder h264_nvenc', MAX_EXPORT_RECOVERY_ATTEMPTS);
    expect(decision).toMatchObject({ action: 'none', canRetry: false });
  });

  it('retries FFmpeg crashes only once with the same arguments', () => {
    expect(buildExportRecoveryDecision(makePlan('libx264'), 'ffmpeg failed with exit code 1', 0)).toMatchObject({ action: 'retry-same', canRetry: true });
    expect(buildExportRecoveryDecision(makePlan('libx264'), 'ffmpeg failed with exit code 1', 1)).toMatchObject({ action: 'none', canRetry: false });
  });

  it('builds recovery decisions for memory font disk and unknown failures', () => {
    expect(buildExportRecoveryDecision(makePlan('libx264'), 'Cannot allocate memory while opening encoder', 0)).toMatchObject({
      errorKind: 'out-of-memory',
      action: 'reduce-concurrency',
      canRetry: true
    });
    expect(buildExportRecoveryDecision(makePlan('libx264'), 'drawtext failed to load font file', 0)).toMatchObject({
      errorKind: 'missing-font',
      action: 'skip-drawtext',
      canRetry: true
    });
    expect(buildExportRecoveryDecision(makePlan('libx264'), 'No space left on device', 0)).toMatchObject({
      errorKind: 'disk-space',
      action: 'prompt-disk-cleanup',
      canRetry: false
    });
    expect(buildExportRecoveryDecision(makePlan('libx264'), 'unrecognized exporter failure', 0)).toMatchObject({
      errorKind: 'unknown',
      action: 'none',
      canRetry: false
    });
  });

  it('checks disk space with a reserve budget', () => {
    expect(hasEnoughDiskSpace(2_000, 1_000, 500)).toBe(true);
    expect(hasEnoughDiskSpace(1_200, 1_000, 500)).toBe(false);
    expect(hasEnoughDiskSpace(Number.NaN, 1_000, 500)).toBe(false);
  });

  it('falls back unsupported codecs to software encoders in args and settings', () => {
    const recovered = fallbackExportCodecPlan(makePlan('h264_nvenc'));
    expect(recovered.settings?.videoCodec).toBe('libx264');
    expect(recovered.outputArgs).toContain('libx264');
    expect(recovered.fullArgs).toContain('libx264');
  });

  it('strips drawtext filters and records a warning for missing fonts', () => {
    const recovered = stripDrawtextFromExportPlan(makePlan('libx264'));
    expect(recovered.filterComplex).toBe('format=yuv420p');
    expect(recovered.fullArgs).toContain('format=yuv420p');
    expect(recovered.fullArgs).not.toContain('drawtext=text=Demo,format=yuv420p');
    expect(recovered.warnings.at(-1)).toContain('Skipped drawtext');
  });

  it('records recovery log entries in an export report', () => {
    const decision = buildExportRecoveryDecision(makePlan('h264_nvenc'), 'Unknown encoder h264_nvenc', 0);
    const entries = appendExportRecoveryLog([], decision, 'Unknown encoder h264_nvenc', 'success');
    expect(buildExportRecoveryReport(entries, true)).toEqual({
      healed: true,
      attempts: 1,
      entries
    });
  });
});

function makePlan(videoCodec: string): FfmpegExportPlan {
  return {
    settings: {
      width: 1280,
      height: 720,
      fps: 30,
      sampleRate: 44_100,
      videoCodec,
      audioCodec: 'aac',
      outputPath: 'C:/Exports/out.mp4',
      format: 'mp4',
      hardwareEncoding: videoCodec.includes('nvenc')
    },
    inputs: [],
    filterComplex: 'drawtext=text=Demo,format=yuv420p',
    maps: ['-map', '[vout]'],
    outputArgs: ['-c:v', videoCodec, '-c:a', 'aac', 'C:/Exports/out.mp4'],
    fullArgs: ['-y', '-filter_complex', 'drawtext=text=Demo,format=yuv420p', '-c:v', videoCodec, '-c:a', 'aac', 'C:/Exports/out.mp4'],
    warnings: [],
    textArtifacts: [],
    nestedPlans: [],
    duration: 1
  };
}
