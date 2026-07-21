import { describe, test, expect } from 'vitest';
import { parseFfmpegProgress } from '../../src/headless/headless-renderer';

describe('parseFfmpegProgress', () => {
  test('parses frame, fps, and time from ffmpeg output', () => {
    const line = 'frame=  120 fps= 30 q=28.0 size=    1024kB time=00:00:04.00 bitrate= 2097.2kbits/s speed=2.0x';
    const result = parseFfmpegProgress(line, 10);

    expect(result).not.toBeNull();
    expect(result!.phase).toBe('rendering');
    expect(result!.frame).toBe(120);
    expect(result!.fps).toBe(30);
    expect(result!.percent).toBeCloseTo(40, 0);
  });

  test('handles zero duration gracefully', () => {
    const line = 'frame=  60 fps= 30 q=28.0 size=    512kB time=00:00:02.00 bitrate= 2097.2kbits/s';
    const result = parseFfmpegProgress(line, 0);

    expect(result).not.toBeNull();
    expect(result!.percent).toBe(0);
  });

  test('caps percent at 100', () => {
    const line = 'frame=  300 fps= 30 q=28.0 size=    2048kB time=00:00:10.00 bitrate= 2097.2kbits/s';
    const result = parseFfmpegProgress(line, 5);

    expect(result).not.toBeNull();
    expect(result!.percent).toBeLessThanOrEqual(100);
  });

  test('returns null for non-progress lines', () => {
    expect(parseFfmpegProgress('ffmpeg version 6.0', 10)).toBeNull();
    expect(parseFfmpegProgress('Input #0, mp4', 10)).toBeNull();
    expect(parseFfmpegProgress('', 10)).toBeNull();
  });

  test('parses time correctly for long videos', () => {
    const line = 'frame= 9000 fps= 30 q=28.0 size=   10240kB time=00:05:00.00 bitrate= 2097.2kbits/s';
    const result = parseFfmpegProgress(line, 600);

    expect(result).not.toBeNull();
    expect(result!.percent).toBeCloseTo(50, 0);
  });
});
