import { describe, expect, it } from 'vitest';
import {
  expandDataSubtitleClipToCueInputs,
  expandDataSubtitleTemplate,
  findDataSubtitleRowAtTime,
  normalizeDataSubtitleSource,
  parseDataSubtitleCsvRows,
  parseDataSubtitleRows,
  parseDataSubtitleJsonRows,
  resolveDataSubtitleText,
  serializeSubtitleCueInputsToSrt,
  type DataSubtitleSource
} from '../src';
import { makeSubtitleClip } from './test-utils';

describe('live data subtitles', () => {
  it('parses CSV rows and finds the nearest timestamp inside the data range', () => {
    const rows = parseDataSubtitleCsvRows(['time,name,score,text', '0,Ada,10,Ada 10', '2,Lin,18,Lin 18', '5,Mia,21,Mia 21'].join('\n'));

    expect(rows.map((row) => row.time)).toEqual([0, 2, 5]);
    expect(findDataSubtitleRowAtTime(rows, 1.4)?.values.name).toBe('Lin');
    expect(findDataSubtitleRowAtTime(rows, -0.1)).toBeUndefined();
    expect(findDataSubtitleRowAtTime(rows, 6)).toBeUndefined();
  });

  it('parses JSON rows', () => {
    expect(parseDataSubtitleJsonRows(JSON.stringify([{ time: 1, text: 'JSON row', score: 9 }]))).toEqual([
      { time: 1, text: 'JSON row', values: { text: 'JSON row', score: '9' } }
    ]);
  });

  it('parses quoted CSV cells and timecode timestamps', () => {
    const rows = parseDataSubtitleRows(['timestamp,name,text', '"00:00:01,500","Ada, host","Score ""12"""'].join('\n'), 'csv');

    expect(rows).toEqual([{ time: 1.5, text: 'Score "12"', values: { name: 'Ada, host', text: 'Score "12"' } }]);
  });

  it('rejects malformed data subtitle sources', () => {
    expect(() => parseDataSubtitleCsvRows('name,text\nAda,No time')).toThrow('time column');
    expect(() => parseDataSubtitleCsvRows('time,text\n0,"open')).toThrow('unterminated');
    expect(() => parseDataSubtitleJsonRows('{"time":1}')).toThrow('must be an array');
    expect(() => parseDataSubtitleJsonRows('[null]')).toThrow('must be an object');
    expect(() => parseDataSubtitleCsvRows('time,text\nbad,Ada')).toThrow('Invalid data subtitle time');
    expect(() => parseDataSubtitleCsvRows('time,text\n00:70:00,Ada')).toThrow('Invalid data subtitle time');
    expect(() => parseDataSubtitleJsonRows('[{"time":""}]')).toThrow('time is empty');
  });

  it('expands template variables from rows and runtime context', () => {
    const row = { time: 1, text: 'Ada 12', values: { name: 'Ada', score: '12', text: 'Ada 12' } };

    expect(
      expandDataSubtitleTemplate('{row.name}: {row.score} / {frame_count} / {timecode} / {date}', row, 1.5, {
        fps: 30,
        date: new Date('2026-06-16T00:00:00.000Z')
      })
    ).toBe('Ada: 12 / 45 / 00:00:01:15 / 2026-06-16');
  });

  it('returns empty text when time is outside the data range', () => {
    const source: DataSubtitleSource = {
      sourceType: 'csv',
      template: '{row.text}',
      rows: [{ time: 1, text: 'Only row', values: { text: 'Only row' } }]
    };

    expect(resolveDataSubtitleText(source, 0.5)).toBe('');
    expect(resolveDataSubtitleText(source, 2)).toBe('');
  });

  it('normalizes template-only sources and renders runtime variables without rows', () => {
    const source = normalizeDataSubtitleSource({ sourceType: 'template', template: '{timecode} {row.missing}', rows: [] });

    expect(resolveDataSubtitleText(source, 1, { fps: 24 })).toBe('00:00:01:00');
    expect(resolveDataSubtitleText(undefined, 1)).toBe('');
    expect(normalizeDataSubtitleSource({ sourceType: 'csv', rows: [] })).toBeUndefined();
    expect(findDataSubtitleRowAtTime([{ time: -1, values: {} }], 1)).toBeUndefined();
  });

  it('expands a data subtitle clip into static SRT cues for export', () => {
    const clip = makeSubtitleClip({
      id: 'data-sub',
      start: 0,
      duration: 2,
      dataSubtitle: {
        sourceType: 'csv',
        template: '{row.name} {row.score}',
        rows: [
          { time: 0, values: { name: 'Ada', score: '12' } },
          { time: 1, values: { name: 'Lin', score: '18' } }
        ]
      }
    });

    expect(serializeSubtitleCueInputsToSrt(expandDataSubtitleClipToCueInputs(clip))).toContain('Ada 12');
    expect(serializeSubtitleCueInputsToSrt(expandDataSubtitleClipToCueInputs(clip))).toContain('Lin 18');
  });

  it('falls back to the subtitle text when no live data source is bound', () => {
    const clip = makeSubtitleClip({ id: 'plain-subtitle', start: 2, duration: 3, text: 'Static subtitle', speaker: 'Ada', soundDesc: '[音乐]' });

    expect(expandDataSubtitleClipToCueInputs(clip)).toEqual([
      expect.objectContaining({
        id: 'plain-subtitle',
        start: 2,
        duration: 3,
        text: 'Static subtitle',
        speaker: 'Ada',
        soundDesc: '[音乐]'
      })
    ]);
  });
});
