import { describe, expect, it } from 'vitest';
import {
  buildCreditsRollYExpression,
  calculateCreditsContentHeight,
  calculateCreditsRollYRange,
  formatCreditsRowsForTextfile,
  normalizeCreditsStyle,
  normalizeCreditsRollSpeed,
  parseCreditsText
} from '../src';

describe('credits roll', () => {
  it('parses pipe separated role and actor rows', () => {
    expect(parseCreditsText('导演 | 林青\n摄影|Ada')).toEqual([
      { role: '导演', name: '林青' },
      { role: '摄影', name: 'Ada' }
    ]);
  });

  it('parses CSV double-column rows with quoted commas', () => {
    expect(parseCreditsText('"Music, Mix", Casey\nEditor, Jules\n"Quote ""Lead""", Pat')).toEqual([
      { role: 'Music, Mix', name: 'Casey' },
      { role: 'Editor', name: 'Jules' },
      { role: 'Quote "Lead"', name: 'Pat' }
    ]);
  });

  it('parses single-column rows and formats textfile content', () => {
    const rows = parseCreditsText('Open Factory Team\nSpecial Thanks');

    expect(rows).toEqual([
      { role: '', name: 'Open Factory Team' },
      { role: '', name: 'Special Thanks' }
    ]);
    expect(formatCreditsRowsForTextfile(rows)).toBe('Open Factory Team\nSpecial Thanks');
    expect(formatCreditsRowsForTextfile([{ role: 'Producer', name: '' }])).toBe('Producer');
  });

  it('builds the FFmpeg y expression and clamps roll speed', () => {
    expect(buildCreditsRollYExpression(95)).toBe('h-t*95');
    expect(normalizeCreditsRollSpeed(-20)).toBe(1);
    expect(normalizeCreditsRollSpeed(1600)).toBe(1000);
  });

  it('calculates scroll y range from speed, duration, and canvas height', () => {
    expect(calculateCreditsRollYRange({ speed: 80, duration: 6, canvasHeight: 720 })).toEqual({ startY: 720, endY: 240 });
    expect(calculateCreditsContentHeight(parseCreditsText('A\nB\nC'), { fontSize: 40, lineSpacing: 10 })).toBe(150);
  });
  it('normalizes 3-char hex shorthand to 6-char in credits style colors', () => {
    const result = normalizeCreditsStyle({ color: '#f00', backgroundColor: '#abc' });
    expect(result.color).toBe('#ff0000');
    expect(result.backgroundColor).toBe('#aabbcc');
  });

  it('normalizes 6-char hex and strips case', () => {
    const result = normalizeCreditsStyle({ color: '#AAFF00', backgroundColor: '#123ABC' });
    expect(result.color).toBe('#aaff00');
    expect(result.backgroundColor).toBe('#123abc');
  });

  it('falls back to defaults for invalid color strings', () => {
    const result = normalizeCreditsStyle({ color: 'red', backgroundColor: '' });
    expect(result.color).toBe('#ffffff');
    expect(result.backgroundColor).toBe('#000000');
  });

});
