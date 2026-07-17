import { describe, expect, it } from 'vitest';
import {
  evaluateSyncQuality,
  calculateOverallSyncQuality,
  buildAngleSyncStatuses,
  buildSyncStatusSummary,
  getSyncQualityColor,
  getSyncQualityLabel,
  formatOffsetDisplay,
  buildSyncTimelineData,
} from '../src/multi-camera/sync-status';

describe('multi-camera sync-status', () => {
  describe('evaluateSyncQuality', () => {
    it('returns excellent for offset < 10ms with high confidence', () => {
      expect(evaluateSyncQuality(5, 0.9)).toBe('excellent');
    });

    it('returns good for offset < 30ms', () => {
      expect(evaluateSyncQuality(20, 0.8)).toBe('good');
    });

    it('returns fair for offset < 100ms', () => {
      expect(evaluateSyncQuality(50, 0.7)).toBe('fair');
    });

    it('returns poor for offset < 500ms', () => {
      expect(evaluateSyncQuality(200, 0.6)).toBe('poor');
    });

    it('returns unsynced for offset >= 500ms', () => {
      expect(evaluateSyncQuality(600, 0.8)).toBe('unsynced');
    });

    it('downgrades to poor when confidence is below medium threshold', () => {
      expect(evaluateSyncQuality(5, 0.3)).toBe('poor');
    });

    it('returns unsynced for very low confidence with large offset', () => {
      expect(evaluateSyncQuality(600, 0.2)).toBe('unsynced');
    });

    it('handles negative offsets', () => {
      expect(evaluateSyncQuality(-15, 0.8)).toBe('good');
    });

    it('handles zero offset', () => {
      expect(evaluateSyncQuality(0, 1)).toBe('excellent');
    });
  });

  describe('calculateOverallSyncQuality', () => {
    it('returns unsynced for empty array', () => {
      expect(calculateOverallSyncQuality([])).toBe('unsynced');
    });

    it('returns the single quality for one element', () => {
      expect(calculateOverallSyncQuality(['good'])).toBe('good');
    });

    it('returns the worst quality from multiple elements', () => {
      expect(calculateOverallSyncQuality(['excellent', 'good', 'fair'])).toBe('fair');
    });

    it('returns unsynced if any element is unsynced', () => {
      expect(calculateOverallSyncQuality(['excellent', 'good', 'unsynced'])).toBe('unsynced');
    });

    it('returns excellent when all are excellent', () => {
      expect(calculateOverallSyncQuality(['excellent', 'excellent'])).toBe('excellent');
    });
  });

  describe('buildAngleSyncStatuses', () => {
    it('builds status for each angle', () => {
      const statuses = buildAngleSyncStatuses(
        ['angle-1', 'angle-2'],
        { 'angle-1': 'Camera 1', 'angle-2': 'Camera 2' },
        { 'angle-1': 0, 'angle-2': 0.02 },
        { 'angle-1': 0.9, 'angle-2': 0.8 },
      );

      expect(statuses).toHaveLength(2);
      expect(statuses[0].angleId).toBe('angle-1');
      expect(statuses[0].quality).toBe('excellent');
      expect(statuses[1].angleId).toBe('angle-2');
      expect(statuses[1].offsetMs).toBe(20);
    });

    it('detects drift when drift rate exceeds threshold', () => {
      const statuses = buildAngleSyncStatuses(
        ['angle-1'],
        { 'angle-1': 'Camera 1' },
        { 'angle-1': 0 },
        { 'angle-1': 0.9 },
        { 'angle-1': 100 },
      );

      expect(statuses[0].hasDrift).toBe(true);
      expect(statuses[0].driftRateMsPerMin).toBe(100);
    });

    it('no drift when rate is below threshold', () => {
      const statuses = buildAngleSyncStatuses(
        ['angle-1'],
        { 'angle-1': 'Camera 1' },
        { 'angle-1': 0 },
        { 'angle-1': 0.9 },
        { 'angle-1': 10 },
      );

      expect(statuses[0].hasDrift).toBe(false);
    });

    it('uses default values for missing data', () => {
      const statuses = buildAngleSyncStatuses(
        ['angle-1'],
        {},
        {},
        {},
      );

      expect(statuses[0].angleName).toBe('angle-1');
      expect(statuses[0].offsetMs).toBe(0);
      expect(statuses[0].confidence).toBe(0);
    });
  });

  describe('buildSyncStatusSummary', () => {
    it('builds complete summary', () => {
      const summary = buildSyncStatusSummary(
        ['angle-1', 'angle-2'],
        { 'angle-1': 'Camera 1', 'angle-2': 'Camera 2' },
        { 'angle-1': 0, 'angle-2': 0.01 },
        { 'angle-1': 0.9, 'angle-2': 0.8 },
      );

      expect(summary.overallQuality).toBe('good');
      expect(summary.angleStatuses).toHaveLength(2);
      expect(summary.averageConfidence).toBeGreaterThan(0);
      expect(summary.syncedAt).toBeGreaterThan(0);
    });

    it('handles empty angles', () => {
      const summary = buildSyncStatusSummary([], {}, {}, {});
      expect(summary.overallQuality).toBe('unsynced');
      expect(summary.averageConfidence).toBe(0);
      expect(summary.angleStatuses).toHaveLength(0);
    });

    it('detects drift in summary', () => {
      const summary = buildSyncStatusSummary(
        ['angle-1'],
        { 'angle-1': 'Camera 1' },
        { 'angle-1': 0 },
        { 'angle-1': 0.9 },
        { 'angle-1': 100 },
      );

      expect(summary.anyDriftDetected).toBe(true);
    });

    it('clamps sync progress to 0-1', () => {
      const summary1 = buildSyncStatusSummary(['angle-1'], {}, {}, {}, {}, -0.5);
      expect(summary1.syncProgress).toBe(0);

      const summary2 = buildSyncStatusSummary(['angle-1'], {}, {}, {}, {}, 1.5);
      expect(summary2.syncProgress).toBe(1);
    });
  });

  describe('getSyncQualityColor', () => {
    it('returns green for excellent', () => {
      expect(getSyncQualityColor('excellent')).toBe('#22c55e');
    });

    it('returns red for unsynced', () => {
      expect(getSyncQualityColor('unsynced')).toBe('#ef4444');
    });
  });

  describe('getSyncQualityLabel', () => {
    it('returns Chinese labels', () => {
      expect(getSyncQualityLabel('excellent')).toBe('优秀');
      expect(getSyncQualityLabel('good')).toBe('良好');
      expect(getSyncQualityLabel('fair')).toBe('一般');
      expect(getSyncQualityLabel('poor')).toBe('较差');
      expect(getSyncQualityLabel('unsynced')).toBe('未同步');
    });
  });

  describe('formatOffsetDisplay', () => {
    it('formats milliseconds', () => {
      expect(formatOffsetDisplay(5)).toBe('5ms');
      expect(formatOffsetDisplay(-15)).toBe('-15ms');
    });

    it('formats seconds', () => {
      expect(formatOffsetDisplay(1500)).toBe('1.50s');
      expect(formatOffsetDisplay(-2300)).toBe('-2.30s');
    });

    it('returns 0ms for zero', () => {
      expect(formatOffsetDisplay(0)).toBe('0ms');
    });

    it('returns 0ms for sub-millisecond', () => {
      expect(formatOffsetDisplay(0.5)).toBe('0ms');
    });
  });

  describe('buildSyncTimelineData', () => {
    it('converts window results to timeline points', () => {
      const windowResults = [
        { startTime: 0, endTime: 10, offsetSeconds: 0.1, score: 0.9 },
        { startTime: 10, endTime: 20, offsetSeconds: 0.15, score: 0.85 },
      ];

      const timeline = buildSyncTimelineData(windowResults, 'angle-1');

      expect(timeline).toHaveLength(2);
      expect(timeline[0].time).toBe(5);
      expect(timeline[0].offsets['angle-1']).toBe(0.1);
      expect(timeline[0].scores['angle-1']).toBe(0.9);
    });

    it('handles empty input', () => {
      expect(buildSyncTimelineData([], 'angle-1')).toHaveLength(0);
    });
  });
});
