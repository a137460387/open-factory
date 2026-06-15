import { describe, expect, it } from 'vitest';
import { buildDefaultGifOutputPath, estimateGifFileSizeBytes, normalizeGifWorkflowSettings } from './gifWorkflow';

describe('gif workflow helpers', () => {
  it('builds a default animated gif path next to the source file', () => {
    expect(buildDefaultGifOutputPath('C:/Media/tiny-video.mp4')).toBe('C:/Media/tiny-video_animated.gif');
    expect(buildDefaultGifOutputPath('D:\\Shots\\clip.mov')).toBe('D:/Shots/clip_animated.gif');
  });

  it('estimates larger GIF files for more frames and pixels', () => {
    const small = estimateGifFileSizeBytes({ sourceWidth: 1920, sourceHeight: 1080, scaleWidth: 320, frameRate: 12, duration: 2 });
    const longer = estimateGifFileSizeBytes({ sourceWidth: 1920, sourceHeight: 1080, scaleWidth: 320, frameRate: 12, duration: 4 });
    const faster = estimateGifFileSizeBytes({ sourceWidth: 1920, sourceHeight: 1080, scaleWidth: 320, frameRate: 24, duration: 2 });
    const wider = estimateGifFileSizeBytes({ sourceWidth: 1920, sourceHeight: 1080, scaleWidth: 640, frameRate: 12, duration: 2 });

    expect(longer).toBeGreaterThan(small);
    expect(faster).toBeGreaterThan(small);
    expect(wider).toBeGreaterThan(small);
  });

  it('normalizes GIF workflow parameters within supported limits', () => {
    expect(
      normalizeGifWorkflowSettings(
        {
          frameRate: 99,
          scaleWidth: 2,
          startTime: 12,
          duration: 10,
          loopCount: 200,
          dither: 'bad' as never
        },
        5
      )
    ).toEqual({
      frameRate: 30,
      scaleWidth: 16,
      startTime: 5,
      duration: 0.1,
      loopCount: 100,
      dither: 'floyd_steinberg'
    });
  });
});
