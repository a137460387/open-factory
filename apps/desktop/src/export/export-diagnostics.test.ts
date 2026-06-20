import { describe, expect, it } from 'vitest';
import { matchExportDiagnostics, EXPORT_ERROR_PATTERNS } from './export-diagnostics';

describe('export diagnostics', () => {
  it('matches codec unsupported errors', () => {
    const matches = matchExportDiagnostics('Unknown encoder libsvtav1');
    expect(matches).toHaveLength(1);
    expect(matches[0].label).toBe('编解码器不支持');
  });

  it('matches path with special characters errors', () => {
    const matches = matchExportDiagnostics("No such file or directory 'C:\\视频\\输出.mp4'");
    expect(matches).toHaveLength(1);
    expect(matches[0].label).toBe('输出路径异常');
  });

  it('matches disk space errors', () => {
    const matches = matchExportDiagnostics('No space left on device');
    expect(matches).toHaveLength(1);
    expect(matches[0].label).toBe('磁盘空间不足');
  });

  it('matches permission denied errors', () => {
    const matches = matchExportDiagnostics('Permission denied: /output/video.mp4');
    expect(matches).toHaveLength(1);
    expect(matches[0].label).toBe('权限不足');
  });

  it('matches corrupt source errors', () => {
    const matches = matchExportDiagnostics('Invalid data found when processing input');
    expect(matches).toHaveLength(1);
    expect(matches[0].label).toBe('源文件损坏');
  });

  it('returns empty for unrecognized errors', () => {
    const matches = matchExportDiagnostics('Something completely unrelated');
    expect(matches).toHaveLength(0);
  });

  it('returns empty for empty stderr', () => {
    expect(matchExportDiagnostics('')).toHaveLength(0);
  });

  it('can match multiple patterns at once', () => {
    const matches = matchExportDiagnostics('Unknown encoder h265_nvenc; No space left on device');
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('has at least 5 error patterns for comprehensive coverage', () => {
    expect(EXPORT_ERROR_PATTERNS.length).toBeGreaterThanOrEqual(5);
  });
});
