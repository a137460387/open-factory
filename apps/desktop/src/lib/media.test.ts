import { describe, expect, it } from 'vitest';
import { detectPngSequences } from './media';

describe('media import sequence detection', () => {
  it('groups contiguous numbered PNG files into one image sequence', () => {
    expect(
      detectPngSequences(['C:/Media/frame001.png', 'C:/Media/frame003.png', 'C:/Media/frame002.png', 'C:/Media/plate.jpg'])
    ).toEqual([
      {
        pattern: 'C:/Media/frame%03d.png',
        startNumber: 1,
        frameCount: 3,
        frameRate: 30,
        paths: ['C:/Media/frame001.png', 'C:/Media/frame002.png', 'C:/Media/frame003.png']
      }
    ]);
  });

  it('skips non-contiguous PNG runs', () => {
    expect(detectPngSequences(['C:/Media/frame001.png', 'C:/Media/frame003.png'])).toEqual([]);
  });

  it('keeps separate PNG sequence prefixes in separate groups', () => {
    const sequences = detectPngSequences(['C:/Media/a001.png', 'C:/Media/b001.png', 'C:/Media/a002.png', 'C:/Media/b002.png']);

    expect(sequences.map((sequence) => sequence.pattern).sort()).toEqual(['C:/Media/a%03d.png', 'C:/Media/b%03d.png']);
  });

  it('uses the requested sequence frame rate', () => {
    expect(detectPngSequences(['C:/Media/frame10.png', 'C:/Media/frame11.png'], 12)[0]).toMatchObject({
      pattern: 'C:/Media/frame%02d.png',
      startNumber: 10,
      frameRate: 12
    });
  });
});
