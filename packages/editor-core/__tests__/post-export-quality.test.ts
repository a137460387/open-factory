import { describe, expect, it } from 'vitest';
import {
  DEFAULT_POST_EXPORT_QUALITY_ASSURANCE_SETTINGS,
  buildPostExportBlackDetectArgs,
  buildPostExportQualityAssuranceResult,
  buildPostExportSilenceDetectArgs,
  hasEnabledPostExportQualityChecks,
  normalizePostExportQualityAssuranceSettings,
  parseBlackDetectOutput,
  parseSilenceDetectOutput,
  shouldRetryPostExportQuality
} from '../src';

describe('post export quality assurance', () => {
  it('builds black frame and silence FFmpeg argument arrays', () => {
    expect(buildPostExportBlackDetectArgs('C:/Exports/final.mp4')).toEqual([
      '-hide_banner',
      '-i',
      'C:/Exports/final.mp4',
      '-vf',
      'blackdetect=d=0.5',
      '-an',
      '-f',
      'null',
      '-'
    ]);
    expect(buildPostExportSilenceDetectArgs('C:/Exports/final.mp4')).toEqual([
      '-hide_banner',
      '-i',
      'C:/Exports/final.mp4',
      '-af',
      'silencedetect=n=-50dB:d=2',
      '-vn',
      '-f',
      'null',
      '-'
    ]);
  });

  it('parses blackdetect and silencedetect output ranges', () => {
    expect(parseBlackDetectOutput('[blackdetect @ 0] black_start:1 black_end:1.75 black_duration:0.75')).toEqual([{ start: 1, end: 1.75, duration: 0.75 }]);
    expect(
      parseSilenceDetectOutput(['[silencedetect @ 0] silence_start: 2', '[silencedetect @ 0] silence_end: 4.25 | silence_duration: 2.25'].join('\n'))
    ).toEqual([{ start: 2, end: 4.25, duration: 2.25 }]);
  });

  it('keeps default settings disabled with no enabled checks', () => {
    const settings = normalizePostExportQualityAssuranceSettings(undefined);
    expect(settings).toEqual(DEFAULT_POST_EXPORT_QUALITY_ASSURANCE_SETTINGS);
    expect(hasEnabledPostExportQualityChecks(settings)).toBe(false);
  });

  it('summarizes duration, file size, resolution, black frame, and silence checks', () => {
    const settings = normalizePostExportQualityAssuranceSettings({
      enabled: true,
      duration: true,
      blackFrames: true,
      silence: true,
      fileSize: true,
      resolution: true,
      minFileSizeBytes: 1_000,
      maxFileSizeBytes: 10_000
    });

    const result = buildPostExportQualityAssuranceResult(
      settings,
      {
        expectedDuration: 10,
        actualDuration: 10.02,
        fps: 30,
        expectedWidth: 1920,
        expectedHeight: 1080,
        actualWidth: 1920,
        actualHeight: 1080,
        fileSizeBytes: 12_000,
        blackFrames: [{ start: 1, end: 1.75, duration: 0.75 }],
        silence: []
      },
      '2026-06-16T00:00:00.000Z'
    );

    expect(result.status).toBe('warning');
    expect(result.checks.map((check) => [check.id, check.status])).toEqual([
      ['duration', 'pass'],
      ['blackFrames', 'warning'],
      ['silence', 'pass'],
      ['fileSize', 'warning'],
      ['resolution', 'pass']
    ]);
  });

  it('recommends one automatic retry only for failed checks', () => {
    const settings = normalizePostExportQualityAssuranceSettings({ enabled: true, duration: true, autoRetry: true });
    const result = buildPostExportQualityAssuranceResult(settings, { expectedDuration: 10, actualDuration: 10.2, fps: 30 });

    expect(result.status).toBe('fail');
    expect(shouldRetryPostExportQuality(result, settings, 0)).toBe(true);
    expect(shouldRetryPostExportQuality(result, settings, 1)).toBe(false);
    expect(shouldRetryPostExportQuality({ status: 'warning' }, settings, 0)).toBe(false);
  });

  it('reports missing file size and missing resolution as quality issues', () => {
    const settings = normalizePostExportQualityAssuranceSettings({ enabled: true, fileSize: true, resolution: true });
    const result = buildPostExportQualityAssuranceResult(settings, {});

    expect(result.status).toBe('fail');
    expect(result.checks.map((check) => [check.id, check.status, check.message])).toEqual([
      ['fileSize', 'warning', '无法读取导出文件大小'],
      ['resolution', 'fail', '无法读取导出分辨率']
    ]);
  });

  it('fails resolution checks when output dimensions differ from the preset', () => {
    const settings = normalizePostExportQualityAssuranceSettings({ enabled: true, resolution: true });
    const result = buildPostExportQualityAssuranceResult(settings, {
      expectedWidth: 1920,
      expectedHeight: 1080,
      actualWidth: 1280,
      actualHeight: 720
    });

    expect(result.status).toBe('fail');
    expect(result.checks[0]).toMatchObject({
      id: 'resolution',
      status: 'fail',
      expected: '1920x1080',
      actual: '1280x720'
    });
  });

  it('checks file size lower bounds and pass ranges', () => {
    const warningSettings = normalizePostExportQualityAssuranceSettings({
      enabled: true,
      fileSize: true,
      minFileSizeBytes: 2048,
      maxFileSizeBytes: 4096
    });
    const warning = buildPostExportQualityAssuranceResult(warningSettings, { fileSizeBytes: 1024 });

    expect(warning.status).toBe('warning');
    expect(warning.checks[0]).toMatchObject({
      id: 'fileSize',
      status: 'warning',
      expected: 2048,
      actual: 1024
    });

    const pass = buildPostExportQualityAssuranceResult(warningSettings, { fileSizeBytes: 3072 });
    expect(pass.status).toBe('pass');
    expect(pass.checks[0]).toMatchObject({
      id: 'fileSize',
      status: 'pass',
      actual: 3072
    });
  });
});
