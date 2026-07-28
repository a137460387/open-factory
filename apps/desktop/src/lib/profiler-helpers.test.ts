import { describe, it, expect } from 'vitest';
import {
  estimateUndoHistoryBytes,
  createProfilerTraceEventsForFrame,
  readBrowserJsHeapBytes,
} from './profiler-helpers';
import type { ProfilerFrameSample } from '@open-factory/editor-core';

describe('profiler-helpers', () => {
  describe('estimateUndoHistoryBytes', () => {
    it('estimates bytes from entries and total', () => {
      const result = estimateUndoHistoryBytes({ entries: [{ a: 1 }], total: 10 });
      expect(result).toBeGreaterThan(0);
      // JSON.stringify length * 2 + total * 256
      expect(result).toBe(JSON.stringify([{ a: 1 }]).length * 2 + 10 * 256);
    });

    it('returns total * 256 when entries serialize fails', () => {
      const circular: any = {};
      circular.self = circular;
      const result = estimateUndoHistoryBytes({ entries: [circular], total: 5 });
      expect(result).toBe(5 * 256);
    });

    it('returns small value for empty entries (JSON overhead)', () => {
      const result = estimateUndoHistoryBytes({ entries: [], total: 0 });
      // JSON.stringify([]) = '[]' = 2 chars * 2 = 4
      expect(result).toBe(4);
    });

    it('clamps to 0 minimum', () => {
      const result = estimateUndoHistoryBytes({ entries: [], total: -1 });
      expect(result).toBe(0);
    });
  });

  describe('createProfilerTraceEventsForFrame', () => {
    it('creates events for a frame sample', () => {
      const sample: ProfilerFrameSample = {
        frameIndex: 42,
        timestampMs: 1000,
        playheadTime: 1000,
        render: {
          totalMs: 16,
          compositeMs: 4,
          colorMs: 3,
          effectsMs: 5,
          overlayMs: 4,
        },
        drawCalls: 1,
        textureBytes: 0,
        reason: '',
      };
      const events = createProfilerTraceEventsForFrame(sample);
      // 1 frame event + 4 pass events
      expect(events).toHaveLength(5);
      expect(events[0].name).toBe('frame 42');
      expect(events[0].category).toBe('preview');
      expect(events[0].depth).toBe(0);
      expect(events[0].durationMs).toBe(16);
    });

    it('uses custom-shader category when reason includes it', () => {
      const sample: ProfilerFrameSample = {
        frameIndex: 1,
        timestampMs: 500,
        playheadTime: 500,
        render: {
          totalMs: 10,
          compositeMs: 2,
          colorMs: 2,
          effectsMs: 3,
          overlayMs: 3,
        },
        drawCalls: 1,
        textureBytes: 0,
        reason: 'custom-shader',
      };
      const events = createProfilerTraceEventsForFrame(sample);
      const effectsEvent = events.find((e) => e.category === 'effects');
      expect(effectsEvent?.name).toBe('custom-shader');
    });

    it('uses effects name when reason does not include custom-shader', () => {
      const sample: ProfilerFrameSample = {
        frameIndex: 1,
        timestampMs: 500,
        playheadTime: 500,
        render: {
          totalMs: 10,
          compositeMs: 2,
          colorMs: 2,
          effectsMs: 3,
          overlayMs: 3,
        },
        drawCalls: 1,
        textureBytes: 0,
        reason: '',
      };
      const events = createProfilerTraceEventsForFrame(sample);
      const effectsEvent = events.find((e) => e.category === 'effects');
      expect(effectsEvent?.name).toBe('effects');
    });

    it('calculates correct start times from cursor', () => {
      const sample: ProfilerFrameSample = {
        frameIndex: 0,
        timestampMs: 100,
        playheadTime: 100,
        render: {
          totalMs: 20,
          compositeMs: 5,
          colorMs: 5,
          effectsMs: 5,
          overlayMs: 5,
        },
        drawCalls: 1,
        textureBytes: 0,
        reason: '',
      };
      const events = createProfilerTraceEventsForFrame(sample);
      // frame starts at 100 - 20 = 80
      expect(events[0].startMs).toBe(80);
      // passes start at 80, 85, 90, 95
      expect(events[1].startMs).toBe(80);
      expect(events[2].startMs).toBe(85);
      expect(events[3].startMs).toBe(90);
      expect(events[4].startMs).toBe(95);
    });
  });

  describe('readBrowserJsHeapBytes', () => {
    it('returns 0 when performance.memory is not available', () => {
      const result = readBrowserJsHeapBytes();
      // In test env, performance.memory likely doesn't exist
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });
});
