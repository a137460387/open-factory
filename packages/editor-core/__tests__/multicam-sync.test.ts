import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  syncMulticamByAudio,
  syncMulticamByTimecode,
  syncMulticamByManual,
  detectDrift,
  type MulticamSyncResult,
  type ManualSyncMarker,
} from '../src/multicam-sync';
import type { MulticamClipAngle, MediaMetadata } from '../src/model-types';

// Mock the existing audio sync module
vi.mock('../src/audio/multicam-audio-sync', () => ({
  syncMulticamAudio: vi.fn().mockReturnValue({
    clipId: 'test',
    medianOffsetSeconds: 0.5,
    medianOffsetMs: 500,
    windowResults: [
      { windowIndex: 0, startTime: 0, endTime: 10, offsetSeconds: 0.5, score: 0.85 },
      { windowIndex: 1, startTime: 10, endTime: 20, offsetSeconds: 0.52, score: 0.82 },
    ],
    drift: { hasDrift: false, slope: 0, intercept: 0, rSquared: 0, driftRateMsPerMin: 0, message: '' },
    confidence: 'high',
    atempoSegments: [],
  }),
}));

describe('MulticamSync', () => {
  const angles: MulticamClipAngle[] = [
    {
      id: 'angle-1',
      mediaId: 'media-1',
      name: 'Camera 1',
      offset: 0,
      volume: 1,
      muted: false,
    },
    {
      id: 'angle-2',
      mediaId: 'media-2',
      name: 'Camera 2',
      offset: 0,
      volume: 1,
      muted: false,
    },
  ];

  describe('syncMulticamByAudio', () => {
    it('应该返回包含offsets和confidence的结果', async () => {
      const result = await syncMulticamByAudio(angles, []);
      expect(result.offsets).toBeInstanceOf(Map);
      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('参考机位偏移量应为0', async () => {
      const result = await syncMulticamByAudio(angles, []);
      expect(result.offsets.get('angle-1')).toBe(0);
    });

    it('候选机位应有非零偏移量', async () => {
      const result = await syncMulticamByAudio(angles, []);
      // Mock returns medianOffsetSeconds: 0.5
      expect(result.offsets.get('angle-2')).toBe(0.5);
    });

    it('应正确报告漂移状态', async () => {
      const result = await syncMulticamByAudio(angles, []);
      expect(result.driftDetected).toBe(false);
    });

    it('单机位应返回零偏移', async () => {
      const singleAngle: MulticamClipAngle[] = [
        { id: 'a1', mediaId: 'm1', name: 'Cam 1', offset: 0, volume: 1, muted: false },
      ];
      const result = await syncMulticamByAudio(singleAngle, []);
      expect(result.offsets.get('a1')).toBe(0);
      expect(result.offsets.size).toBe(1);
    });
  });

  describe('syncMulticamByTimecode', () => {
    it('应该根据时间码计算偏移量', () => {
      const metadata: Record<string, MediaMetadata> = {
        'media-1': { date: '2026-07-11T10:00:00Z' },
        'media-2': { date: '2026-07-11T10:00:05Z' },
      };

      const result = syncMulticamByTimecode(angles, metadata);
      expect(result.offsets.get('angle-1')).toBe(0);
      // media-2 is 5 seconds later, so it needs -5s offset to align with media-1
      expect(result.offsets.get('angle-2')).toBe(-5);
    });

    it('置信度应为1.0', () => {
      const metadata: Record<string, MediaMetadata> = {
        'media-1': { date: '2026-07-11T10:00:00Z' },
        'media-2': { date: '2026-07-11T10:00:00Z' },
      };

      const result = syncMulticamByTimecode(angles, metadata);
      expect(result.confidence).toBe(1.0);
    });

    it('无时间码的机位偏移应为0', () => {
      const metadata: Record<string, MediaMetadata> = {
        'media-1': { date: '2026-07-11T10:00:00Z' },
        // media-2 has no date
      };

      const result = syncMulticamByTimecode(angles, metadata);
      expect(result.offsets.get('angle-1')).toBe(0);
      expect(result.offsets.get('angle-2')).toBe(0);
    });

    it('所有机位均无时间码时偏移应全为0', () => {
      const metadata: Record<string, MediaMetadata> = {};

      const result = syncMulticamByTimecode(angles, metadata);
      expect(result.offsets.get('angle-1')).toBe(0);
      expect(result.offsets.get('angle-2')).toBe(0);
      expect(result.confidence).toBe(1);
    });

    it('空机位列表应返回空结果', () => {
      const result = syncMulticamByTimecode([], {});
      expect(result.offsets.size).toBe(0);
      expect(result.confidence).toBe(1);
    });

    it('无漂移检测', () => {
      const metadata: Record<string, MediaMetadata> = {
        'media-1': { date: '2026-07-11T10:00:00Z' },
        'media-2': { date: '2026-07-11T10:00:05Z' },
      };

      const result = syncMulticamByTimecode(angles, metadata);
      expect(result.driftDetected).toBe(false);
    });

    it('最早的媒体应为参考点（偏移0）', () => {
      const metadata: Record<string, MediaMetadata> = {
        'media-1': { date: '2026-07-11T10:00:10Z' },
        'media-2': { date: '2026-07-11T10:00:03Z' },
      };

      const result = syncMulticamByTimecode(angles, metadata);
      // media-2 is earlier (10:00:03), so media-2 gets offset 0
      // media-1 is 7 seconds later, gets offset -7
      expect(result.offsets.get('angle-2')).toBe(0);
      expect(result.offsets.get('angle-1')).toBe(-7);
    });
  });

  describe('syncMulticamByManual', () => {
    it('应该根据手动标记计算偏移量', () => {
      const markers: ManualSyncMarker[] = [
        { angleId: 'angle-1', time: 10 },
        { angleId: 'angle-2', time: 12 },
      ];

      const result = syncMulticamByManual(angles, markers);
      expect(result.offsets.get('angle-1')).toBe(0);
      // angle-2 marker is at 12, reference is at 10, offset = 10 - 12 = -2
      expect(result.offsets.get('angle-2')).toBe(-2);
    });

    it('无标记时所有偏移应为0', () => {
      const result = syncMulticamByManual(angles, []);
      expect(result.offsets.get('angle-1')).toBe(0);
      expect(result.offsets.get('angle-2')).toBe(0);
    });

    it('缺少标记的机位偏移应为0', () => {
      const markers: ManualSyncMarker[] = [
        { angleId: 'angle-1', time: 5 },
        // angle-2 has no marker
      ];

      const result = syncMulticamByManual(angles, markers);
      expect(result.offsets.get('angle-1')).toBe(0);
      expect(result.offsets.get('angle-2')).toBe(0);
    });

    it('置信度应为1.0', () => {
      const markers: ManualSyncMarker[] = [
        { angleId: 'angle-1', time: 10 },
        { angleId: 'angle-2', time: 12 },
      ];

      const result = syncMulticamByManual(angles, markers);
      expect(result.confidence).toBe(1.0);
    });

    it('无漂移检测', () => {
      const markers: ManualSyncMarker[] = [
        { angleId: 'angle-1', time: 10 },
        { angleId: 'angle-2', time: 12 },
      ];

      const result = syncMulticamByManual(angles, markers);
      expect(result.driftDetected).toBe(false);
    });
  });

  describe('detectDrift', () => {
    it('应该返回漂移检测结果', async () => {
      const result = await detectDrift(angles);
      expect(typeof result.driftDetected).toBe('boolean');
    });

    it('单机位应返回无漂移', async () => {
      const singleAngle: MulticamClipAngle[] = [
        { id: 'a1', mediaId: 'm1', name: 'Cam 1', offset: 0, volume: 1, muted: false },
      ];
      const result = await detectDrift(singleAngle);
      expect(result.driftDetected).toBe(false);
      expect(result.driftRate).toBe(0);
    });

    it('空机位列表应返回无漂移', async () => {
      const result = await detectDrift([]);
      expect(result.driftDetected).toBe(false);
      expect(result.driftRate).toBe(0);
    });

    it('无漂移时driftRate应为0', async () => {
      const result = await detectDrift(angles);
      // Mock returns hasDrift: false, so driftRate should be 0
      expect(result.driftRate).toBe(0);
    });

    it('检测到漂移时应返回driftRate', async () => {
      // Re-import to get the mock reference
      const { syncMulticamAudio } = await import('../src/audio/multicam-audio-sync');
      const mockSync = vi.mocked(syncMulticamAudio);

      // Mock drift detected scenario
      mockSync.mockReturnValueOnce({
        clipId: 'test',
        medianOffsetSeconds: 0.5,
        medianOffsetMs: 500,
        windowResults: [
          { windowIndex: 0, startTime: 0, endTime: 10, offsetSeconds: 0.5, score: 0.85 },
          { windowIndex: 1, startTime: 10, endTime: 20, offsetSeconds: 0.6, score: 0.82 },
          { windowIndex: 2, startTime: 20, endTime: 30, offsetSeconds: 0.7, score: 0.8 },
        ],
        drift: {
          hasDrift: true,
          slope: 0.001,
          intercept: 0.49,
          rSquared: 0.95,
          driftRateMsPerMin: 60,
          message: '检测到时钟漂移，建议分段同步',
        },
        confidence: 'medium',
        atempoSegments: [],
      });

      const result = await detectDrift(angles);
      expect(result.driftDetected).toBe(true);
      expect(result.driftRate).toBeCloseTo(3.6, 5);
    });
  });
});
