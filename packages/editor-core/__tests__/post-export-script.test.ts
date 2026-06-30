import { describe, expect, it } from 'vitest';
import { expandPostExportScriptCommand, formatPostExportDate, formatPostExportDuration, normalizeExportPostScript } from '../src';

describe('post export script helpers', () => {
  it('expands output, project, duration, and date variables', () => {
    const command = expandPostExportScriptCommand('notify --file "{output}" --name {project} --duration {duration} --date {date}', {
      outputPath: 'C:/Exports/review.mp4',
      projectName: 'Launch Cut',
      durationSeconds: 12.5,
      date: new Date(2026, 5, 14)
    });

    expect(command).toBe('notify --file "C:/Exports/review.mp4" --name Launch Cut --duration 12.5 --date 20260614');
  });

  it('normalizes empty script settings to null', () => {
    expect(normalizeExportPostScript(undefined)).toBeNull();
    expect(normalizeExportPostScript({ command: '   ' })).toBeNull();
    expect(normalizeExportPostScript({ command: ' echo {output} ' })).toEqual({ command: 'echo {output}' });
  });

  it('rejects post-export scripts with a non-string command field', () => {
    expect(normalizeExportPostScript({ command: 123 })).toBeNull();
  });

  it('formats dates and durations deterministically', () => {
    expect(formatPostExportDate(new Date(2026, 0, 5))).toBe('20260105');
    expect(formatPostExportDuration(10)).toBe('10');
    expect(formatPostExportDuration(10.1254)).toBe('10.125');
    expect(formatPostExportDuration(Number.NaN)).toBe('0');
  });
});
