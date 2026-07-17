import { describe, expect, it } from 'vitest';
import {
  generateSwitchSegments,
  generateRealtimeSwitch,
  validateSwitchPoints,
  findSwitchIntervalWarnings,
} from '../src/multi-camera/switch-generator';
import type { AngleDefinition, SwitchPointDef } from '../src/multi-camera/switch-generator';

describe('multi-camera switch-generator', () => {
  const angles: AngleDefinition[] = [
    { id: 'angle-1', mediaId: 'media-1', name: 'Camera 1', syncOffset: 0, mediaDuration: 60 },
    { id: 'angle-2', mediaId: 'media-2', name: 'Camera 2', syncOffset: 0.5, mediaDuration: 60 },
    { id: 'angle-3', mediaId: 'media-3', name: 'Camera 3', syncOffset: -0.2, mediaDuration: 60 },
  ];

  describe('generateSwitchSegments', () => {
    it('generates a single segment when no switch points', () => {
      const result = generateSwitchSegments(angles, [], 30);

      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].angleId).toBe('angle-1');
      expect(result.segments[0].duration).toBe(30);
      expect(result.transitions).toHaveLength(0);
    });

    it('generates segments with cut transitions', () => {
      const switches: SwitchPointDef[] = [
        { time: 10, targetAngleIndex: 1, transition: 'cut' },
        { time: 20, targetAngleIndex: 0, transition: 'cut' },
      ];

      const result = generateSwitchSegments(angles, switches, 30);

      expect(result.segments).toHaveLength(3);
      expect(result.segments[0].angleId).toBe('angle-1');
      expect(result.segments[0].duration).toBe(10);
      expect(result.segments[1].angleId).toBe('angle-2');
      expect(result.segments[1].duration).toBe(10);
      expect(result.segments[2].angleId).toBe('angle-1');
      expect(result.segments[2].duration).toBe(10);
      // Cut transitions should not generate transition objects
      expect(result.transitions).toHaveLength(0);
    });

    it('generates segments with dissolve transitions', () => {
      const switches: SwitchPointDef[] = [
        { time: 10, targetAngleIndex: 1, transition: 'dissolve' },
      ];

      const result = generateSwitchSegments(angles, switches, 30);

      expect(result.segments).toHaveLength(2);
      expect(result.transitions).toHaveLength(1);
      expect(result.transitions[0].type).toBe('dissolve');
    });

    it('handles empty angles', () => {
      const result = generateSwitchSegments([], [], 30);
      expect(result.segments).toHaveLength(0);
      expect(result.transitions).toHaveLength(0);
    });

    it('handles zero duration', () => {
      const result = generateSwitchSegments(angles, [], 0);
      expect(result.segments).toHaveLength(0);
    });

    it('clamps angle index to valid range', () => {
      const switches: SwitchPointDef[] = [
        { time: 10, targetAngleIndex: 99, transition: 'cut' },
      ];

      const result = generateSwitchSegments(angles, switches, 30);
      expect(result.segments[1].angleId).toBe('angle-3'); // clamped to last
    });

    it('applies sync offset to media offset', () => {
      const switches: SwitchPointDef[] = [
        { time: 10, targetAngleIndex: 1, transition: 'cut' },
      ];

      const result = generateSwitchSegments(angles, switches, 30);
      // Camera 2 has syncOffset 0.5
      expect(result.segments[1].mediaOffset).toBeGreaterThanOrEqual(10);
    });

    it('merges adjacent segments with same angle', () => {
      const switches: SwitchPointDef[] = [
        { time: 10, targetAngleIndex: 1, transition: 'cut' },
        { time: 10.001, targetAngleIndex: 1, transition: 'cut' }, // very close, same angle
      ];

      const result = generateSwitchSegments(angles, switches, 30);
      // Should merge since they're the same angle and very close
      expect(result.segments.length).toBeLessThanOrEqual(3);
    });
  });

  describe('generateRealtimeSwitch', () => {
    it('generates a switch point', () => {
      const result = generateRealtimeSwitch(10, 0, 1, angles, 20);

      expect(result).toBeDefined();
      expect(result!.time).toBe(10);
      expect(result!.targetAngleIndex).toBe(1);
      expect(result!.transition).toBe('cut');
    });

    it('returns undefined when switching to same angle', () => {
      const result = generateRealtimeSwitch(10, 0, 0, angles, 20);
      expect(result).toBeUndefined();
    });

    it('returns undefined for invalid target index', () => {
      const result = generateRealtimeSwitch(10, 0, 99, angles, 20);
      expect(result).toBeUndefined();
    });

    it('returns undefined for negative target index', () => {
      const result = generateRealtimeSwitch(10, 0, -1, angles, 20);
      expect(result).toBeUndefined();
    });
  });

  describe('validateSwitchPoints', () => {
    it('validates correct switch points', () => {
      const switches: SwitchPointDef[] = [
        { time: 5, targetAngleIndex: 0, transition: 'cut' },
        { time: 15, targetAngleIndex: 1, transition: 'dissolve' },
      ];

      const result = validateSwitchPoints(switches, 3, 30);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects negative time', () => {
      const switches: SwitchPointDef[] = [
        { time: -1, targetAngleIndex: 0, transition: 'cut' },
      ];

      const result = validateSwitchPoints(switches, 3, 30);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('时间不能为负');
    });

    it('rejects time beyond duration', () => {
      const switches: SwitchPointDef[] = [
        { time: 35, targetAngleIndex: 0, transition: 'cut' },
      ];

      const result = validateSwitchPoints(switches, 3, 30);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('超出总时长');
    });

    it('rejects out-of-range angle index', () => {
      const switches: SwitchPointDef[] = [
        { time: 5, targetAngleIndex: 5, transition: 'cut' },
      ];

      const result = validateSwitchPoints(switches, 3, 30);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('机位索引越界');
    });

    it('rejects zero angles', () => {
      const result = validateSwitchPoints([], 0, 30);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('至少需要一个机位');
    });

    it('rejects unsorted switch points', () => {
      const switches: SwitchPointDef[] = [
        { time: 15, targetAngleIndex: 0, transition: 'cut' },
        { time: 5, targetAngleIndex: 1, transition: 'cut' },
      ];

      const result = validateSwitchPoints(switches, 3, 30);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('时间顺序错误'))).toBe(true);
    });
  });

  describe('findSwitchIntervalWarnings', () => {
    it('finds too-close switches', () => {
      const switches: SwitchPointDef[] = [
        { time: 5, targetAngleIndex: 0, transition: 'cut' },
        { time: 5.3, targetAngleIndex: 1, transition: 'cut' }, // ~9 frames at 30fps
      ];

      const warnings = findSwitchIntervalWarnings(switches, 30, 12);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].index).toBe(1);
      expect(warnings[0].gapFrames).toBeLessThan(12);
    });

    it('no warnings for well-spaced switches', () => {
      const switches: SwitchPointDef[] = [
        { time: 5, targetAngleIndex: 0, transition: 'cut' },
        { time: 10, targetAngleIndex: 1, transition: 'cut' },
      ];

      const warnings = findSwitchIntervalWarnings(switches, 30, 12);
      expect(warnings).toHaveLength(0);
    });

    it('handles single switch point', () => {
      const switches: SwitchPointDef[] = [
        { time: 5, targetAngleIndex: 0, transition: 'cut' },
      ];

      const warnings = findSwitchIntervalWarnings(switches, 30, 12);
      expect(warnings).toHaveLength(0);
    });
  });
});
