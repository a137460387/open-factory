import { describe, expect, it } from 'vitest';
import {
  formatSrtTimecode,
  parseSrt,
  parseSrtTimecodeMs,
  serializeSrt,
  serializeSubtitleClipsToAss,
  serializeSubtitleClipsToSrt,
  serializeSubtitleClipsToVtt,
  serializeSubtitleCueInputsToAss,
  serializeSubtitleCueInputsToSrt,
  serializeSubtitleCueInputsToVtt
} from '../src';
import { makeSubtitleClip } from './test-utils';

describe('SRT subtitles', () => {
  it('returns no cues for an empty SRT file', () => {
    expect(parseSrt('')).toEqual([]);
    expect(parseSrt('\n\n')).toEqual([]);
  });

  it('parses timecodes into milliseconds and preserves multiline text', () => {
    const cues = parseSrt(`
1
00:00:00,500 --> 00:00:02,000
Hello factory
Second line

2
00:01:03.250 --> 00:01:05.500
Another caption
`);

    expect(cues).toEqual([
      { index: 1, startMs: 500, endMs: 2000, text: 'Hello factory\nSecond line' },
      { index: 2, startMs: 63_250, endMs: 65_500, text: 'Another caption' }
    ]);
    expect(parseSrtTimecodeMs('01:02:03,004')).toBe(3_723_004);
  });

  it('parses cues without numeric indexes', () => {
    expect(parseSrt('00:00:01,000 --> 00:00:02,000\nNo index')).toEqual([
      { index: 1, startMs: 1000, endMs: 2000, text: 'No index' }
    ]);
  });

  it('ignores blocks without timing data and non-positive duration', () => {
    expect(parseSrt('not a cue\n\n1\n00:00:02,000 --> 00:00:01,000\nBackwards')).toEqual([]);
  });

  it('accepts end time suffixes emitted by some SRT tools', () => {
    expect(parseSrt('1\n00:00:01,000 --> 00:00:02,000 align:start position:0%\nStyled timing')[0]).toMatchObject({
      startMs: 1000,
      endMs: 2000,
      text: 'Styled timing'
    });
  });

  it('throws for invalid timecode values', () => {
    expect(() => parseSrtTimecodeMs('bad')).toThrow('Invalid SRT timecode');
  });

  it('serializes cues and subtitle clips with SRT timecodes', () => {
    expect(formatSrtTimecode(3_723_004)).toBe('01:02:03,004');
    expect(
      serializeSrt([
        { startMs: 0, endMs: 1250, text: 'First' },
        { startMs: 1500, endMs: 3000, text: 'Second\nline' }
      ])
    ).toBe('1\n00:00:00,000 --> 00:00:01,250\nFirst\n\n2\n00:00:01,500 --> 00:00:03,000\nSecond\nline\n');

    expect(
      serializeSubtitleClipsToSrt([
        makeSubtitleClip({ id: 'b', start: 2, duration: 1, text: 'Later' }),
        makeSubtitleClip({ id: 'a', start: 0.25, duration: 1, text: 'Earlier' })
      ])
    ).toBe('1\n00:00:00,250 --> 00:00:01,250\nEarlier\n\n2\n00:00:02,000 --> 00:00:03,000\nLater\n');
  });

  it('serializes empty cue lists without a trailing block', () => {
    expect(serializeSrt([])).toBe('');
  });

  it('clamps negative formatted timecodes to zero', () => {
    expect(formatSrtTimecode(-100)).toBe('00:00:00,000');
  });

  it('skips blank subtitle clip text during serialization', () => {
    expect(
      serializeSubtitleClipsToSrt([
        makeSubtitleClip({ id: 'blank', start: 0, duration: 1, text: '   ' }),
        makeSubtitleClip({ id: 'caption', start: 1, duration: 1, text: 'Visible' })
      ])
    ).toBe('1\n00:00:01,000 --> 00:00:02,000\nVisible\n');
  });

  it('serializes subtitle clip style into ASS styles and dialogue', () => {
    const ass = serializeSubtitleClipsToAss([
      makeSubtitleClip({
        id: 'styled',
        start: 1.25,
        duration: 2,
        text: 'First line\nSecond line',
        style: {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: 32,
          color: '#aabbcc',
          backgroundColor: '#112233',
          backgroundOpacity: 0.25,
          bold: true,
          italic: true,
          yOffset: 90
        }
      })
    ]);

    expect(ass).toContain('[V4+ Styles]');
    expect(ass).toContain('Style: OpenFactory,Inter,32,&H00CCBBAA,&H00CCBBAA,&H00000000,&HBF332211,-1,-1');
    expect(ass).toContain('Dialogue: 0,0:00:01.25,0:00:03.25,OpenFactory');
    expect(ass).toContain('First line\\NSecond line');
  });

  it('serializes VTT cues with position and alignment settings', () => {
    const vtt = serializeSubtitleClipsToVtt([
      makeSubtitleClip({
        id: 'vtt',
        start: 0.5,
        duration: 1.25,
        text: 'Cue text',
        transform: { x: -0.5 },
        style: { yOffset: 60 }
      })
    ]);

    expect(vtt).toContain('WEBVTT');
    expect(vtt).toContain('00:00:00.500 --> 00:00:01.750 line:94% position:25% align:start');
    expect(vtt).toContain('Cue text');
  });

  it('serializes generic cue inputs to SRT while sorting and skipping blank cues', () => {
    expect(
      serializeSubtitleCueInputsToSrt([
        { id: 'late', start: 2, duration: 1, text: 'Late' },
        { id: 'blank', start: 1, duration: 1, text: '   ' },
        { id: 'early', start: 0, duration: 1, text: 'Early' }
      ])
    ).toBe('1\n00:00:00,000 --> 00:00:01,000\nEarly\n\n2\n00:00:02,000 --> 00:00:03,000\nLate\n');
  });

  it('serializes empty and explicitly positioned VTT cue inputs', () => {
    expect(serializeSubtitleCueInputsToVtt([])).toBe('WEBVTT\n');
    expect(
      serializeSubtitleCueInputsToVtt([
        {
          id: 'right',
          start: 0,
          duration: 1,
          text: 'Right aligned',
          style: { x: 0.75, y: 0.25 }
        }
      ])
    ).toContain('00:00:00.000 --> 00:00:01.000 line:62.5% position:87.5% align:end');
  });

  it('serializes SSA with default style fallbacks and escaped dialogue text', () => {
    const ssa = serializeSubtitleCueInputsToAss(
      [
        {
          id: 'ssa',
          start: 0,
          duration: 1,
          text: '{SSA}\r\nText',
          style: { fontFamily: '"", Arial', color: 'not-a-color', backgroundColor: 'bad', backgroundOpacity: 2 }
        }
      ],
      'ssa'
    );

    expect(ssa).toContain('[V4 Styles]');
    expect(ssa).toContain('Style: OpenFactory,Arial,42,&H00FFFFFF,&H00FFFFFF,&H00FFFFFF,&H00FFFFFF');
    expect(ssa).toContain('Dialogue: Marked=0,0:00:00.00,0:00:01.00,OpenFactory');
    expect(ssa).toContain('SSA\\NText');
  });
});
