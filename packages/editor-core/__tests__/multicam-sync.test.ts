import { describe, it, expect, vi } from 'vitest';
import { syncMulticamByAudio, syncMulticamByTimecode, syncMulticamByManual, detectMulticamDrift, type ManualSyncMarker } from '../src/multicam-sync';
import type { MulticamClipAngle, MediaMetadata } from '../src/model-types';

vi.mock('../src/audio/multicam-audio-sync', () => ({
  syncMulticamAudio: vi.fn().mockReturnValue({
    clipId: 'test', medianOffsetSeconds: 0.5, medianOffsetMs: 500,
    windowResults: [{ windowIndex: 0, startTime: 0, endTime: 10, offsetSeconds: 0.5, score: 0.85 }],
    drift: { hasDrift: false, slope: 0, intercept: 0, rSquared: 0, driftRateMsPerMin: 0, message: '' },
    confidence: 'high', atempoSegments: [],
  }),
}));

describe('MulticamSync', () => {
  const angles: MulticamClipAngle[] = [
    { id: 'angle-1', mediaId: 'media-1', name: 'Camera 1', offset: 0, volume: 1, muted: false },
    { id: 'angle-2', mediaId: 'media-2', name: 'Camera 2', offset: 0, volume: 1, muted: false },
  ];
  const audioSamplesMap = new Map<string, ArrayLike<number>>([['angle-1', new Float32Array([0.1, 0.2, 0.3])], ['angle-2', new Float32Array([0.4, 0.5, 0.6])]]);

  describe('syncMulticamByAudio', () => {
    it('should return offsets and confidence', async () => { const r = await syncMulticamByAudio(angles, audioSamplesMap); expect(r.offsets).toBeInstanceOf(Map); expect(r.confidence).toBeGreaterThanOrEqual(0); });
    it('reference offset should be 0', async () => { expect((await syncMulticamByAudio(angles, audioSamplesMap)).offsets.get('angle-1')).toBe(0); });
    it('candidate offset should be non-zero', async () => { expect((await syncMulticamByAudio(angles, audioSamplesMap)).offsets.get('angle-2')).toBe(0.5); });
    it('single angle returns zero', async () => { expect((await syncMulticamByAudio([{ id: 'a1', mediaId: 'm1', name: 'C1', offset: 0, volume: 1, muted: false }], new Map())).offsets.get('a1')).toBe(0); });
    it('empty returns empty', async () => { expect((await syncMulticamByAudio([], new Map())).offsets.size).toBe(0); });
  });
  describe('syncMulticamByTimecode', () => {
    it('calculates offsets', () => { const r = syncMulticamByTimecode(angles, { 'media-1': { date: '2026-07-11T10:00:00Z' }, 'media-2': { date: '2026-07-11T10:00:05Z' } }); expect(r.offsets.get('angle-1')).toBe(0); expect(r.offsets.get('angle-2')).toBe(-5); });
    it('no timestamps returns zero', () => { expect(syncMulticamByTimecode(angles, {}).offsets.get('angle-1')).toBe(0); });
  });
  describe('syncMulticamByManual', () => {
    it('calculates offsets from markers', () => { const r = syncMulticamByManual(angles, [{ angleId: 'angle-1', time: 10 }, { angleId: 'angle-2', time: 12 }]); expect(r.offsets.get('angle-1')).toBe(0); expect(r.offsets.get('angle-2')).toBe(-2); });
  });
  describe('detectMulticamDrift', () => {
    it('returns drift result', async () => { expect(typeof (await detectMulticamDrift(angles, audioSamplesMap)).driftDetected).toBe('boolean'); });
    it('single angle no drift', async () => { expect((await detectMulticamDrift([{ id: 'a1', mediaId: 'm1', name: 'C1', offset: 0, volume: 1, muted: false }], audioSamplesMap)).driftDetected).toBe(false); });
    it('empty no drift', async () => { expect((await detectMulticamDrift([], audioSamplesMap)).driftDetected).toBe(false); });
    it('detects drift', async () => {
      const { syncMulticamAudio } = await import('../src/audio/multicam-audio-sync');
      vi.mocked(syncMulticamAudio).mockReturnValueOnce({ clipId: 'test', medianOffsetSeconds: 0.5, medianOffsetMs: 500, windowResults: [{ windowIndex: 0, startTime: 0, endTime: 10, offsetSeconds: 0.5, score: 0.85 }], drift: { hasDrift: true, slope: 0.001, intercept: 0.49, rSquared: 0.95, driftRateMsPerMin: 60, message: 'drift' }, confidence: 'medium', atempoSegments: [] });
      const r = await detectMulticamDrift(angles, audioSamplesMap); expect(r.driftDetected).toBe(true); expect(r.driftRate).toBeCloseTo(3.6, 5);
    });
  });
});
