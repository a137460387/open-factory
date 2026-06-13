import { describe, expect, it } from 'vitest';
import { buildExportTrayProgressLabel, localDatetimeInputValue, normalizeExportCompletionAction, normalizeScheduledExportStart } from './export-background';

describe('export background helpers', () => {
  it('normalizes future scheduled export times and rejects past values', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');

    expect(normalizeScheduledExportStart('2026-01-01T00:00:02.000Z', now)).toBe('2026-01-01T00:00:02.000Z');
    expect(normalizeScheduledExportStart('2025-12-31T23:59:59.000Z', now)).toBeUndefined();
    expect(normalizeScheduledExportStart('not-a-date', now)).toBeUndefined();
  });

  it('formats datetime-local values without timezone text', () => {
    expect(localDatetimeInputValue(new Date(2026, 0, 2, 3, 4, 5))).toBe('2026-01-02T03:04');
  });

  it('builds tray progress labels from clamped progress', () => {
    expect(buildExportTrayProgressLabel(0.414, 1)).toBe('Open Factory 41%');
    expect(buildExportTrayProgressLabel(2, 1)).toBe('Open Factory 100%');
    expect(buildExportTrayProgressLabel(0.5, 0)).toBe('Open Factory');
  });

  it('normalizes export completion actions', () => {
    expect(normalizeExportCompletionAction('notification')).toBe('notification');
    expect(normalizeExportCompletionAction('shutdown')).toBe('shutdown');
    expect(normalizeExportCompletionAction('hibernate')).toBe('hibernate');
    expect(normalizeExportCompletionAction('unexpected')).toBe('none');
  });
});
