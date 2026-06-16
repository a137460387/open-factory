import { describe, expect, it } from 'vitest';
import {
  analyzeSubtitleProofreading,
  buildSubtitleProofreadingFixes,
  calculateSubtitleReadingSpeed,
  serializeSubtitleProofreadingCsv
} from '../src';
import { makeSubtitleClip } from './test-utils';

describe('subtitle proofreading helpers', () => {
  it('marks subtitle durations outside the configured minimum and maximum', () => {
    const issues = analyzeSubtitleProofreading(
      [
        makeSubtitleClip({ id: 'short', start: 0, duration: 0.5, text: '太短' }),
        makeSubtitleClip({ id: 'long', start: 2, duration: 8, text: 'Too long' }),
        makeSubtitleClip({ id: 'ok', start: 12, duration: 3, text: '正常字幕' })
      ],
      { minDuration: 1, maxDuration: 7 }
    );

    expect(issues.map((issue) => [issue.type, issue.clipId, issue.limit])).toEqual([
      ['too-short', 'short', 1],
      ['too-long', 'long', 7]
    ]);
  });

  it('calculates Chinese and English reading speeds with separate limits', () => {
    expect(calculateSubtitleReadingSpeed('这是十二个中文字吗', 1)).toMatchObject({
      language: 'chinese',
      characterCount: 9,
      speed: 9,
      limit: 12
    });
    expect(calculateSubtitleReadingSpeed('abcdefghijklmnopqrstu', 1)).toMatchObject({
      language: 'english',
      characterCount: 21,
      speed: 21,
      limit: 20
    });

    const issues = analyzeSubtitleProofreading([
      makeSubtitleClip({ id: 'zh-fast', start: 0, duration: 1, text: '这是一条非常非常快的中文字幕' }),
      makeSubtitleClip({ id: 'en-fast', start: 2, duration: 1, text: 'abcdefghijklmnopqrstuvwxyz' })
    ]);

    expect(issues.filter((issue) => issue.type === 'reading-speed').map((issue) => [issue.clipId, issue.limit])).toEqual([
      ['zh-fast', 12],
      ['en-fast', 20]
    ]);
  });

  it('detects overlaps only inside the same subtitle track', () => {
    const issues = analyzeSubtitleProofreading([
      makeSubtitleClip({ id: 'a', trackId: 'track-a', start: 0, duration: 2 }),
      makeSubtitleClip({ id: 'b', trackId: 'track-a', start: 1.5, duration: 2 }),
      makeSubtitleClip({ id: 'c', trackId: 'track-b', start: 1, duration: 2 })
    ]);

    expect(issues.filter((issue) => issue.type === 'overlap')).toEqual([
      expect.objectContaining({ clipId: 'a', relatedClipId: 'b', value: 0.5 })
    ]);
  });

  it('detects blank subtitles and builds recommended duration/delete fixes', () => {
    const clips = [
      makeSubtitleClip({ id: 'short', start: 0, duration: 0.4, text: '短' }),
      makeSubtitleClip({ id: 'long', start: 2, duration: 9, text: 'Long subtitle' }),
      makeSubtitleClip({ id: 'blank', start: 12, duration: 2, text: '   ' })
    ];
    const issues = analyzeSubtitleProofreading(clips);

    expect(issues.map((issue) => issue.type)).toEqual(['too-short', 'too-long', 'blank']);
    expect(buildSubtitleProofreadingFixes(clips, issues)).toEqual([
      { clipId: 'short', duration: 1 },
      { clipId: 'long', duration: 7 },
      { clipId: 'blank', delete: true }
    ]);
  });

  it('ignores stale issues and keeps blank subtitle deletion as the only fix', () => {
    const clips = [makeSubtitleClip({ id: 'blank', start: 1, duration: 0.25, text: '' })];

    expect(
      buildSubtitleProofreadingFixes(clips, [
        { id: 'missing-too-short', type: 'too-short', clipId: 'missing', start: 0, duration: 0.2, text: 'missing', limit: 1 },
        { id: 'blank-blank', type: 'blank', clipId: 'blank', start: 1, duration: 0.25, text: '' },
        { id: 'blank-too-short', type: 'too-short', clipId: 'blank', start: 1, duration: 0.25, text: '', limit: 1 }
      ])
    ).toEqual([{ clipId: 'blank', delete: true }]);
  });

  it('normalizes unsafe subtitle inputs before proofreading', () => {
    const issues = analyzeSubtitleProofreading([
      { id: 'skip', start: Number.NaN, duration: 1, text: 'ignored' },
      { id: 'b', start: -1, duration: -2, text: undefined as unknown as string },
      { id: 'a', start: -1, duration: 0.5, text: '' }
    ]);

    expect(issues.map((issue) => [issue.clipId, issue.type, issue.start, issue.duration, issue.trackId])).toEqual([
      ['a', 'blank', 0, 0.5, undefined],
      ['a', 'overlap', 0, 0.5, ''],
      ['b', 'blank', 0, 0, undefined]
    ]);
  });

  it('serializes a proofreading report as CSV with timecodes and escaped content', () => {
    const issues = analyzeSubtitleProofreading([makeSubtitleClip({ id: 'short', start: 1, duration: 0.4, text: '短,字幕' })]);

    expect(serializeSubtitleProofreadingCsv(issues, { fps: 25 })).toBe('timecode,issue_type,clip_id,related_clip_id,content\n00:00:01:00,too-short,short,,"短,字幕"\n');
  });

  it('serializes proofreading CSV with explicit drop-frame timecode settings', () => {
    const issues = analyzeSubtitleProofreading([makeSubtitleClip({ id: 'fast', start: 1800 / 29.97, duration: 1, text: 'abcdefghijklmnopqrstuvwxyz' })]);

    expect(serializeSubtitleProofreadingCsv(issues, { fps: 29.97, timecodeFormat: 'df' })).toContain('00:01:00:02,reading-speed,fast,,abcdefghijklmnopqrstuvwxyz');
  });
});
