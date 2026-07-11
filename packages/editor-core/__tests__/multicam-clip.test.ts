import { describe, it, expect } from 'vitest';
import { createMulticamClip } from '../src/model';
import { getActiveAngleAtTime, addSwitchPoint, deleteSwitchPoint, updateSwitchPoint } from '../src/multicam';
import type { MulticamClip, MulticamClipAngle, SwitchPoint } from '../src/model-types';

describe('MulticamClip', () => {
  it('should create a multicam clip', () => {
    const angles: MulticamClipAngle[] = [
      {
        id: 'angle-1',
        mediaId: 'media-1',
        name: 'Camera 1',
        offset: 0,
        volume: 1,
        muted: false
      },
      {
        id: 'angle-2',
        mediaId: 'media-2',
        name: 'Camera 2',
        offset: 0,
        volume: 1,
        muted: false
      }
    ];

    const clip = createMulticamClip(angles, 'audio', 0);
    expect(clip.type).toBe('multicam');
    expect(clip.angles).toHaveLength(2);
    expect(clip.activeAngle).toBe(0);
    expect(clip.switchPoints).toHaveLength(0);
    expect(clip.syncMode).toBe('audio');
    expect(clip.syncReferenceAngle).toBe(0);
  });

  it('should validate syncReferenceAngle range', () => {
    const angles: MulticamClipAngle[] = [
      {
        id: 'angle-1',
        mediaId: 'media-1',
        name: 'Camera 1',
        offset: 0,
        volume: 1,
        muted: false
      }
    ];

    expect(() => createMulticamClip(angles, 'manual', 5)).toThrow('syncReferenceAngle out of range');
  });

  it('should validate syncReferenceAngle negative index', () => {
    const angles: MulticamClipAngle[] = [
      {
        id: 'angle-1',
        mediaId: 'media-1',
        name: 'Camera 1',
        offset: 0,
        volume: 1,
        muted: false
      }
    ];

    expect(() => createMulticamClip(angles, 'timecode', -1)).toThrow('syncReferenceAngle out of range');
  });

  it('should deep copy angles', () => {
    const angles: MulticamClipAngle[] = [
      {
        id: 'angle-1',
        mediaId: 'media-1',
        name: 'Camera 1',
        offset: 0,
        volume: 1,
        muted: false
      },
      {
        id: 'angle-2',
        mediaId: 'media-2',
        name: 'Camera 2',
        offset: 0.5,
        volume: 0.8,
        muted: true
      }
    ];

    const clip = createMulticamClip(angles, 'audio', 1);
    // Mutating the original should not affect the clip
    angles[0].name = 'Changed';
    expect(clip.angles[0].name).toBe('Camera 1');
    expect(clip.angles[1].offset).toBe(0.5);
    expect(clip.angles[1].volume).toBe(0.8);
    expect(clip.angles[1].muted).toBe(true);
  });

  it('should have MulticamClip type properties', () => {
    const angles: MulticamClipAngle[] = [
      {
        id: 'angle-1',
        mediaId: 'media-1',
        name: 'Camera 1',
        offset: 0,
        volume: 1,
        muted: false
      },
      {
        id: 'angle-2',
        mediaId: 'media-2',
        name: 'Camera 2',
        offset: 0,
        volume: 1,
        muted: false
      },
      {
        id: 'angle-3',
        mediaId: 'media-3',
        name: 'Camera 3',
        offset: 0,
        volume: 1,
        muted: false
      }
    ];

    const clip = createMulticamClip(angles, 'timecode', 2);
    expect(clip.syncMode).toBe('timecode');
    expect(clip.syncReferenceAngle).toBe(2);
    expect(clip.angles).toHaveLength(3);
    // Verify it satisfies BaseClip properties
    expect(clip.id).toBeDefined();
    expect(clip.start).toBe(0);
    expect(clip.duration).toBe(0);
  });

  it('should support optional colorCorrection and transform on angles', () => {
    const angles: MulticamClipAngle[] = [
      {
        id: 'angle-1',
        mediaId: 'media-1',
        name: 'Camera 1',
        offset: 0,
        volume: 1,
        muted: false,
        colorCorrection: {
          brightness: 0.1,
          contrast: 1.2,
          saturation: 1,
          hue: 0
        },
        transform: {
          x: 10,
          y: 20,
          scale: 1,
          rotation: 5,
          opacity: 1
        }
      },
      {
        id: 'angle-2',
        mediaId: 'media-2',
        name: 'Camera 2',
        offset: 0,
        volume: 1,
        muted: false
      }
    ];

    const clip = createMulticamClip(angles, 'manual', 0);
    expect(clip.angles[0].colorCorrection).toBeDefined();
    expect(clip.angles[0].colorCorrection?.brightness).toBe(0.1);
    expect(clip.angles[0].transform).toBeDefined();
    expect(clip.angles[0].transform?.x).toBe(10);
    expect(clip.angles[1].colorCorrection).toBeUndefined();
    expect(clip.angles[1].transform).toBeUndefined();
  });

  it('should deep copy nested colorCorrection and transform objects', () => {
    const colorCorrection = {
      brightness: 0.1,
      contrast: 1.2,
      saturation: 1,
      hue: 0
    };
    const transform = {
      x: 10,
      y: 20,
      scale: 1,
      rotation: 5,
      opacity: 1
    };
    const angles: MulticamClipAngle[] = [
      {
        id: 'angle-1',
        mediaId: 'media-1',
        name: 'Camera 1',
        offset: 0,
        volume: 1,
        muted: false,
        colorCorrection,
        transform
      },
      {
        id: 'angle-2',
        mediaId: 'media-2',
        name: 'Camera 2',
        offset: 0,
        volume: 1,
        muted: false
      }
    ];

    const clip = createMulticamClip(angles, 'manual', 0);

    // Mutating the original nested objects should NOT affect the clip
    colorCorrection.brightness = 0.9;
    colorCorrection.contrast = 2.0;
    transform.x = 999;
    transform.y = 888;

    expect(clip.angles[0].colorCorrection?.brightness).toBe(0.1);
    expect(clip.angles[0].colorCorrection?.contrast).toBe(1.2);
    expect(clip.angles[0].transform?.x).toBe(10);
    expect(clip.angles[0].transform?.y).toBe(20);
  });
});

// ── Helper for creating test MulticamClip ──
const testAngles: MulticamClipAngle[] = [
  { id: 'angle-1', mediaId: 'media-1', name: 'Camera 1', offset: 0, volume: 1, muted: false },
  { id: 'angle-2', mediaId: 'media-2', name: 'Camera 2', offset: 0, volume: 1, muted: false },
  { id: 'angle-3', mediaId: 'media-3', name: 'Camera 3', offset: 0, volume: 1, muted: false }
];

function makeTestClip(switchPoints: SwitchPoint[] = [], activeAngle = 0): MulticamClip {
  const clip = createMulticamClip(testAngles, 'audio', activeAngle);
  return { ...clip, switchPoints };
}

// ── getActiveAngleAtTime ──
describe('getActiveAngleAtTime', () => {
  it('should return the default active angle when there are no switch points', () => {
    const clip = makeTestClip();
    const activeAngle = getActiveAngleAtTime(clip, 5);
    expect(activeAngle.id).toBe('angle-1');
  });

  it('should return the correct angle based on a single switch point', () => {
    const clip = makeTestClip([{ time: 10, targetAngle: 1, transition: 'cut' }]);

    expect(getActiveAngleAtTime(clip, 5).id).toBe('angle-1');
    expect(getActiveAngleAtTime(clip, 15).id).toBe('angle-2');
  });

  it('should handle multiple switch points', () => {
    const clip = makeTestClip([
      { time: 10, targetAngle: 1, transition: 'cut' },
      { time: 20, targetAngle: 0, transition: 'cut' }
    ]);

    expect(getActiveAngleAtTime(clip, 5).id).toBe('angle-1');
    expect(getActiveAngleAtTime(clip, 15).id).toBe('angle-2');
    expect(getActiveAngleAtTime(clip, 25).id).toBe('angle-1');
  });

  it('should handle boundary at switch point time (inclusive)', () => {
    const clip = makeTestClip([{ time: 10, targetAngle: 1, transition: 'cut' }]);

    expect(getActiveAngleAtTime(clip, 10).id).toBe('angle-2');
    expect(getActiveAngleAtTime(clip, 0).id).toBe('angle-1');
  });

  it('should handle time before all switch points', () => {
    const clip = makeTestClip([
      { time: 10, targetAngle: 1, transition: 'cut' },
      { time: 20, targetAngle: 2, transition: 'dissolve' }
    ]);

    expect(getActiveAngleAtTime(clip, 0).id).toBe('angle-1');
    expect(getActiveAngleAtTime(clip, 9.99).id).toBe('angle-1');
  });

  it('should handle time after all switch points', () => {
    const clip = makeTestClip([
      { time: 10, targetAngle: 1, transition: 'cut' },
      { time: 20, targetAngle: 2, transition: 'cut' }
    ]);

    expect(getActiveAngleAtTime(clip, 100).id).toBe('angle-3');
  });

  it('should throw when angles array is empty', () => {
    const emptyClip = {
      id: 'test',
      name: 'test',
      trackId: 'track-1',
      type: 'multicam' as const,
      start: 0,
      duration: 10,
      trimStart: 0,
      trimEnd: 0,
      speed: 1,
      colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      angles: [] as MulticamClipAngle[],
      activeAngle: 0,
      switchPoints: [] as SwitchPoint[],
      syncMode: 'audio' as const,
      syncReferenceAngle: 0
    };
    expect(() => getActiveAngleAtTime(emptyClip as MulticamClip, 0)).toThrow('MulticamClip has no angles');
  });

  it('should fall back to default activeAngle for invalid targetAngle', () => {
    const clip = makeTestClip([{ time: 5, targetAngle: 99, transition: 'cut' }]);
    const result = getActiveAngleAtTime(clip, 10);
    expect(result.id).toBe('angle-1');
  });

  it('should throw when activeAngle is negative', () => {
    const clip: MulticamClip = {
      id: 'test',
      name: 'test',
      trackId: 'track-1',
      type: 'multicam',
      start: 0,
      duration: 10,
      trimStart: 0,
      trimEnd: 0,
      speed: 1,
      colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      angles: testAngles,
      activeAngle: -1,
      switchPoints: [],
      syncMode: 'audio',
      syncReferenceAngle: 0
    };
    expect(() => getActiveAngleAtTime(clip, 0)).toThrow('activeAngle out of range');
  });

  it('should throw when activeAngle is >= angles.length', () => {
    const clip: MulticamClip = {
      id: 'test',
      name: 'test',
      trackId: 'track-1',
      type: 'multicam',
      start: 0,
      duration: 10,
      trimStart: 0,
      trimEnd: 0,
      speed: 1,
      colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      angles: testAngles,
      activeAngle: 5,
      switchPoints: [],
      syncMode: 'audio',
      syncReferenceAngle: 0
    };
    expect(() => getActiveAngleAtTime(clip, 0)).toThrow('activeAngle out of range');
  });

  it('should throw when activeAngle is negative even with switch points', () => {
    const clip: MulticamClip = {
      id: 'test',
      name: 'test',
      trackId: 'track-1',
      type: 'multicam',
      start: 0,
      duration: 10,
      trimStart: 0,
      trimEnd: 0,
      speed: 1,
      colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      angles: testAngles,
      activeAngle: -1,
      switchPoints: [{ time: 10, targetAngle: 1, transition: 'cut' }],
      syncMode: 'audio',
      syncReferenceAngle: 0
    };
    expect(() => getActiveAngleAtTime(clip, 5)).toThrow('activeAngle out of range');
  });

  it('should throw when activeAngle equals angles.length', () => {
    const clip: MulticamClip = {
      id: 'test',
      name: 'test',
      trackId: 'track-1',
      type: 'multicam',
      start: 0,
      duration: 10,
      trimStart: 0,
      trimEnd: 0,
      speed: 1,
      colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      angles: testAngles,
      activeAngle: 3,
      switchPoints: [],
      syncMode: 'audio',
      syncReferenceAngle: 0
    };
    expect(() => getActiveAngleAtTime(clip, 0)).toThrow('activeAngle out of range');
  });
});

// ── addSwitchPoint ──
describe('addSwitchPoint', () => {
  it('should add a switch point to an empty array', () => {
    const result = addSwitchPoint([], { time: 10, targetAngle: 1, transition: 'cut' });
    expect(result).toEqual([{ time: 10, targetAngle: 1, transition: 'cut' }]);
  });

  it('should insert a switch point in sorted order', () => {
    const existing: SwitchPoint[] = [{ time: 5, targetAngle: 0, transition: 'cut' }];
    const result = addSwitchPoint(existing, { time: 10, targetAngle: 1, transition: 'cut' });
    expect(result.map((sp) => sp.time)).toEqual([5, 10]);
  });

  it('should insert before earlier switch points', () => {
    const existing: SwitchPoint[] = [{ time: 10, targetAngle: 1, transition: 'cut' }];
    const result = addSwitchPoint(existing, { time: 5, targetAngle: 0, transition: 'dissolve' });
    expect(result.map((sp) => sp.time)).toEqual([5, 10]);
  });

  it('should replace a switch point at the same time', () => {
    const existing: SwitchPoint[] = [{ time: 10, targetAngle: 1, transition: 'cut' }];
    const result = addSwitchPoint(existing, { time: 10, targetAngle: 2, transition: 'wipe' });
    expect(result).toHaveLength(1);
    expect(result[0].targetAngle).toBe(2);
    expect(result[0].transition).toBe('wipe');
  });

  it('should not mutate the original array', () => {
    const existing: SwitchPoint[] = [{ time: 5, targetAngle: 0, transition: 'cut' }];
    const result = addSwitchPoint(existing, { time: 10, targetAngle: 1, transition: 'cut' });
    expect(existing).toHaveLength(1);
    expect(result).toHaveLength(2);
  });

  it('should insert in the middle correctly', () => {
    const existing: SwitchPoint[] = [
      { time: 5, targetAngle: 0, transition: 'cut' },
      { time: 15, targetAngle: 2, transition: 'cut' }
    ];
    const result = addSwitchPoint(existing, { time: 10, targetAngle: 1, transition: 'dissolve' });
    expect(result.map((sp) => sp.time)).toEqual([5, 10, 15]);
  });
});

// ── deleteSwitchPoint ──
describe('deleteSwitchPoint', () => {
  it('should delete a switch point at the given index', () => {
    const existing: SwitchPoint[] = [
      { time: 5, targetAngle: 0, transition: 'cut' },
      { time: 10, targetAngle: 1, transition: 'cut' },
      { time: 15, targetAngle: 2, transition: 'cut' }
    ];
    const result = deleteSwitchPoint(existing, 1);
    expect(result).toHaveLength(2);
    expect(result.map((sp) => sp.time)).toEqual([5, 15]);
  });

  it('should delete the first switch point', () => {
    const existing: SwitchPoint[] = [
      { time: 5, targetAngle: 0, transition: 'cut' },
      { time: 10, targetAngle: 1, transition: 'cut' }
    ];
    const result = deleteSwitchPoint(existing, 0);
    expect(result).toHaveLength(1);
    expect(result[0].time).toBe(10);
  });

  it('should delete the last switch point', () => {
    const existing: SwitchPoint[] = [
      { time: 5, targetAngle: 0, transition: 'cut' },
      { time: 10, targetAngle: 1, transition: 'cut' }
    ];
    const result = deleteSwitchPoint(existing, 1);
    expect(result).toHaveLength(1);
    expect(result[0].time).toBe(5);
  });

  it('should throw when index is out of range (negative)', () => {
    const existing: SwitchPoint[] = [{ time: 5, targetAngle: 0, transition: 'cut' }];
    expect(() => deleteSwitchPoint(existing, -1)).toThrow('Switch point index out of range');
  });

  it('should throw when index is out of range (too large)', () => {
    const existing: SwitchPoint[] = [{ time: 5, targetAngle: 0, transition: 'cut' }];
    expect(() => deleteSwitchPoint(existing, 5)).toThrow('Switch point index out of range');
  });

  it('should not mutate the original array', () => {
    const existing: SwitchPoint[] = [
      { time: 5, targetAngle: 0, transition: 'cut' },
      { time: 10, targetAngle: 1, transition: 'cut' }
    ];
    const result = deleteSwitchPoint(existing, 0);
    expect(existing).toHaveLength(2);
    expect(result).toHaveLength(1);
  });
});

// ── updateSwitchPoint ──
describe('updateSwitchPoint', () => {
  it('should update a switch point at the given index', () => {
    const existing: SwitchPoint[] = [
      { time: 5, targetAngle: 0, transition: 'cut' },
      { time: 10, targetAngle: 1, transition: 'cut' }
    ];
    const result = updateSwitchPoint(existing, 1, { targetAngle: 2 });
    expect(result[1].targetAngle).toBe(2);
    expect(result[1].time).toBe(10);
    expect(result[1].transition).toBe('cut');
  });

  it('should update the transition type', () => {
    const existing: SwitchPoint[] = [{ time: 10, targetAngle: 1, transition: 'cut' }];
    const result = updateSwitchPoint(existing, 0, { transition: 'dissolve' });
    expect(result[0].transition).toBe('dissolve');
  });

  it('should re-sort when time is updated', () => {
    const existing: SwitchPoint[] = [
      { time: 5, targetAngle: 0, transition: 'cut' },
      { time: 10, targetAngle: 1, transition: 'cut' },
      { time: 15, targetAngle: 2, transition: 'cut' }
    ];
    // Move the first switch point to time 12, which should re-sort
    const result = updateSwitchPoint(existing, 0, { time: 12 });
    expect(result.map((sp) => sp.time)).toEqual([10, 12, 15]);
  });

  it('should throw when index is out of range (negative)', () => {
    const existing: SwitchPoint[] = [{ time: 5, targetAngle: 0, transition: 'cut' }];
    expect(() => updateSwitchPoint(existing, -1, { time: 10 })).toThrow('Switch point index out of range');
  });

  it('should throw when index is out of range (too large)', () => {
    const existing: SwitchPoint[] = [{ time: 5, targetAngle: 0, transition: 'cut' }];
    expect(() => updateSwitchPoint(existing, 5, { time: 10 })).toThrow('Switch point index out of range');
  });

  it('should not mutate the original array', () => {
    const existing: SwitchPoint[] = [{ time: 5, targetAngle: 0, transition: 'cut' }];
    const result = updateSwitchPoint(existing, 0, { targetAngle: 2 });
    expect(existing[0].targetAngle).toBe(0);
    expect(result[0].targetAngle).toBe(2);
  });

  it('should handle updating multiple fields at once', () => {
    const existing: SwitchPoint[] = [{ time: 5, targetAngle: 0, transition: 'cut' }];
    const result = updateSwitchPoint(existing, 0, { time: 8, targetAngle: 2, transition: 'wipe' });
    expect(result[0]).toEqual({ time: 8, targetAngle: 2, transition: 'wipe' });
  });
});
