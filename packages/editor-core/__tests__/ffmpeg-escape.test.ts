import { describe, expect, it } from 'vitest';
import { cssColorToFfmpeg, escapeDrawtextValue, formatFfmpegSeconds, normalizeFfmpegPath } from '../src';

describe('ffmpeg escaping', () => {
  it('normalizes Windows paths', () => {
    expect(normalizeFfmpegPath('D:\\Media\\clip.mp4')).toBe('D:/Media/clip.mp4');
  });

  it.each([
    ['Windows drive, backslashes, and spaces', 'C:\\Media Files\\clip title.txt', String.raw`C\\:/Media Files/clip title.txt`],
    ['Windows path with nested colon and quote', "D:\\Fonts\\A:rial's.ttf", String.raw`D\\:/Fonts/A\\:rial\'s.ttf`],
    ['Windows path with percent signs', 'E:\\Exports\\100% ready\\text.txt', String.raw`E\\:/Exports/100\% ready/text.txt`],
    ['macOS absolute path with spaces and parentheses', '/Users/editor/Video Text (Final).txt', '/Users/editor/Video Text (Final).txt'],
    ['Linux absolute path with a single quote', "/home/editor/it's ready/text.txt", String.raw`/home/editor/it\'s ready/text.txt`],
    ['Linux absolute path with equals and ampersand', '/tmp/filter=a&b/title.txt', '/tmp/filter=a&b/title.txt'],
    ['path with Chinese characters', 'C:\\素材\\标题 文本.txt', String.raw`C\\:/素材/标题 文本.txt`],
    ['mixed path with percent, ampersand, equals, and quote', "/mnt/media/标题 100%/a&b='yes'.txt", String.raw`/mnt/media/标题 100\%/a&b=\'yes\'.txt`]
  ])('escapes drawtext path values for %s', (_name, input, expected) => {
    expect(escapeDrawtextValue(input)).toBe(expected);
  });

  it('converts css hex colors to ffmpeg colors', () => {
    expect(cssColorToFfmpeg('#fff')).toBe('0xffffff');
    expect(cssColorToFfmpeg('#336699')).toBe('0x336699');
    expect(cssColorToFfmpeg('')).toBe('white');
    expect(cssColorToFfmpeg(' ')).toBe('white');
    expect(cssColorToFfmpeg('blue')).toBe('blue');
  });

  it('formats seconds with bounded precision', () => {
    expect(formatFfmpegSeconds(2.5001)).toBe('2.5');
    expect(formatFfmpegSeconds(7.0334)).toBe('7.033');
  });
});
