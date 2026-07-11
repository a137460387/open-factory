import { describe, it, expect } from 'vitest';
import { createMulticamClip } from '../src/model';
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
