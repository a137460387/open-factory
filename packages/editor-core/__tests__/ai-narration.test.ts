import { describe, it, expect } from 'vitest';
import {
  estimateWordCount,
  buildNarrationSystemPrompt,
  buildNarrationUserPrompt,
  buildChaptersFromMarkers,
  parseNarrationResponse,
  buildTtsRequests,
  NARRATION_CHARS_PER_SECOND_ZH,
  NARRATION_WORDS_PER_SECOND_EN,
  NARRATION_STYLES,
} from '../src/ai-narration';

describe('estimateWordCount', () => {
  it('calculates Chinese character count from duration', () => {
    const result = estimateWordCount(10, true);
    const expected = Math.round(10 * NARRATION_CHARS_PER_SECOND_ZH);
    expect(result.min).toBe(Math.max(1, Math.round(expected * 0.8)));
    expect(result.max).toBe(Math.round(expected * 1.2));
  });

  it('calculates English word count from duration', () => {
    const result = estimateWordCount(10, false);
    const expected = Math.round(10 * NARRATION_WORDS_PER_SECOND_EN);
    expect(result.min).toBe(Math.max(1, Math.round(expected * 0.8)));
    expect(result.max).toBe(Math.round(expected * 1.2));
  });

  it('returns at least 1 for short durations', () => {
    const result = estimateWordCount(0.1, true);
    expect(result.min).toBeGreaterThanOrEqual(1);
    expect(result.max).toBeGreaterThanOrEqual(1);
  });

  it('returns {min:1,max:1} for zero duration Chinese', () => {
    const result = estimateWordCount(0, true);
    expect(result.min).toBe(1);
    expect(result.max).toBe(1);
  });

  it('returns {min:1,max:1} for zero duration English', () => {
    const result = estimateWordCount(0, false);
    expect(result.min).toBe(1);
    expect(result.max).toBe(1);
  });

  it('handles negative duration as zero', () => {
    const result = estimateWordCount(-5, true);
    expect(result.min).toBe(1);
    expect(result.max).toBe(1);
  });

  it('handles non-finite duration as zero', () => {
    const result = estimateWordCount(Number.NaN, false);
    expect(result.min).toBe(1);
    expect(result.max).toBe(1);
  });
});

describe('buildNarrationSystemPrompt', () => {
  it('includes style-specific prompt for commentary', () => {
    const prompt = buildNarrationSystemPrompt('commentary', true);
    expect(prompt).toContain('解说旁白');
    expect(prompt).toContain('中文');
  });

  it('includes style-specific prompt for advertisement', () => {
    const prompt = buildNarrationSystemPrompt('advertisement', true);
    expect(prompt).toContain('广告文案');
  });

  it('includes style-specific prompt for documentary', () => {
    const prompt = buildNarrationSystemPrompt('documentary', true);
    expect(prompt).toContain('纪录片叙事');
  });

  it('includes style-specific prompt for social-media', () => {
    const prompt = buildNarrationSystemPrompt('social-media', true);
    expect(prompt).toContain('社媒');
  });

  it('uses English instruction when isChinese is false', () => {
    const prompt = buildNarrationSystemPrompt('commentary', false);
    expect(prompt).toContain('English');
    expect(prompt).not.toContain('中文');
  });

  it('falls back to commentary for unknown style', () => {
    const prompt = buildNarrationSystemPrompt('unknown-style' as any, true);
    expect(prompt).toContain('解说旁白');
  });
});

describe('buildNarrationUserPrompt', () => {
  it('includes chapter count header', () => {
    const prompt = buildNarrationUserPrompt([
      { time: 0, duration: 30, label: '', sceneDescription: '', subtitleText: '' },
    ]);
    expect(prompt).toContain('1 个章节');
  });

  it('includes timecodes for each chapter', () => {
    const prompt = buildNarrationUserPrompt([
      { time: 60, duration: 120, label: '', sceneDescription: '', subtitleText: '' },
    ]);
    expect(prompt).toContain('1:00');
    expect(prompt).toContain('2:00');
  });

  it('includes scene description when provided', () => {
    const prompt = buildNarrationUserPrompt([
      { time: 0, duration: 30, label: '', sceneDescription: 'A sunset scene', subtitleText: '' },
    ]);
    expect(prompt).toContain('A sunset scene');
  });

  it('includes subtitle text when provided', () => {
    const prompt = buildNarrationUserPrompt([
      { time: 0, duration: 30, label: '', sceneDescription: '', subtitleText: 'Hello world' },
    ]);
    expect(prompt).toContain('Hello world');
  });

  it('includes label when provided', () => {
    const prompt = buildNarrationUserPrompt([
      { time: 0, duration: 30, label: 'Opening', sceneDescription: '', subtitleText: '' },
    ]);
    expect(prompt).toContain('Opening');
  });

  it('handles empty chapters list', () => {
    const prompt = buildNarrationUserPrompt([]);
    expect(prompt).toContain('0 个章节');
  });
});

describe('buildChaptersFromMarkers', () => {
  it('creates chapters from sorted markers with correct durations', () => {
    const markers = [
      { time: 0, label: 'Intro' },
      { time: 30, label: 'Middle' },
      { time: 60, label: 'End' },
    ];
    const chapters = buildChaptersFromMarkers(markers, 90, new Map(), new Map());
    expect(chapters).toHaveLength(3);
    expect(chapters[0]).toMatchObject({ time: 0, duration: 30, label: 'Intro' });
    expect(chapters[1]).toMatchObject({ time: 30, duration: 30, label: 'Middle' });
    expect(chapters[2]).toMatchObject({ time: 60, duration: 30, label: 'End' });
  });

  it('sorts markers by time', () => {
    const markers = [
      { time: 60, label: 'End' },
      { time: 0, label: 'Intro' },
      { time: 30, label: 'Middle' },
    ];
    const chapters = buildChaptersFromMarkers(markers, 90, new Map(), new Map());
    expect(chapters[0].time).toBe(0);
    expect(chapters[1].time).toBe(30);
    expect(chapters[2].time).toBe(60);
  });

  it('uses totalDuration for last marker end time', () => {
    const markers = [{ time: 0, label: '' }];
    const chapters = buildChaptersFromMarkers(markers, 120, new Map(), new Map());
    expect(chapters[0].duration).toBe(120);
  });

  it('attaches scene descriptions from map', () => {
    const markers = [{ time: 0, label: '' }];
    const descMap = new Map<number, string>();
    descMap.set(0, 'A beautiful forest');
    const chapters = buildChaptersFromMarkers(markers, 60, descMap, new Map());
    expect(chapters[0].sceneDescription).toBe('A beautiful forest');
  });

  it('attaches subtitle text from map', () => {
    const markers = [{ time: 0, label: '' }];
    const subMap = new Map<number, string>();
    subMap.set(0, 'Hello everyone');
    const chapters = buildChaptersFromMarkers(markers, 60, new Map(), subMap);
    expect(chapters[0].subtitleText).toBe('Hello everyone');
  });

  it('returns empty array for empty markers', () => {
    const chapters = buildChaptersFromMarkers([], 60, new Map(), new Map());
    expect(chapters).toHaveLength(0);
  });

  it('handles non-finite totalDuration as zero', () => {
    const markers = [{ time: 0, label: '' }];
    const chapters = buildChaptersFromMarkers(markers, Number.NaN, new Map(), new Map());
    expect(chapters[0].duration).toBe(0);
  });
});

describe('parseNarrationResponse', () => {
  it('parses valid segments from JSON array', () => {
    const input = [
      { markerTime: 0, duration: 30, text: 'Hello', speakerNote: 'Slow start' },
      { markerTime: 30, duration: 30, text: 'World', speakerNote: '' },
    ];
    const result = parseNarrationResponse(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ markerTime: 0, duration: 30, text: 'Hello', speakerNote: 'Slow start' });
  });

  it('skips items without text', () => {
    const input = [
      { markerTime: 0, duration: 30, text: '', speakerNote: '' },
      { markerTime: 30, duration: 30, text: 'Valid', speakerNote: '' },
    ];
    const result = parseNarrationResponse(input);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Valid');
  });

  it('skips items without markerTime', () => {
    const input = [
      { duration: 30, text: 'No time', speakerNote: '' },
    ];
    const result = parseNarrationResponse(input);
    expect(result).toHaveLength(0);
  });

  it('returns empty for non-array input', () => {
    expect(parseNarrationResponse(null)).toEqual([]);
    expect(parseNarrationResponse('string')).toEqual([]);
    expect(parseNarrationResponse({})).toEqual([]);
  });

  it('clamps negative markerTime to 0', () => {
    const input = [{ markerTime: -5, duration: 30, text: 'Test', speakerNote: '' }];
    const result = parseNarrationResponse(input);
    expect(result[0].markerTime).toBe(0);
  });

  it('trims whitespace from text and speakerNote', () => {
    const input = [{ markerTime: 0, duration: 30, text: '  hello  ', speakerNote: '  note  ' }];
    const result = parseNarrationResponse(input);
    expect(result[0].text).toBe('hello');
    expect(result[0].speakerNote).toBe('note');
  });
});

describe('buildTtsRequests', () => {
  it('builds TTS requests with voiceId for each segment', () => {
    const segments = [
      { markerTime: 0, duration: 30, text: 'Hello', speakerNote: '' },
      { markerTime: 30, duration: 30, text: 'World', speakerNote: '' },
    ];
    const result = buildTtsRequests(segments, 'voice-123');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ text: 'Hello', markerTime: 0, voiceId: 'voice-123' });
    expect(result[1]).toEqual({ text: 'World', markerTime: 30, voiceId: 'voice-123' });
  });

  it('filters out segments with empty text', () => {
    const segments = [
      { markerTime: 0, duration: 30, text: '', speakerNote: '' },
      { markerTime: 30, duration: 30, text: 'Valid', speakerNote: '' },
    ];
    const result = buildTtsRequests(segments, 'voice-123');
    expect(result).toHaveLength(1);
  });

  it('returns empty for empty segments', () => {
    expect(buildTtsRequests([], 'voice-123')).toEqual([]);
  });
});

describe('NARRATION_STYLES', () => {
  it('contains all 4 styles', () => {
    expect(NARRATION_STYLES).toHaveLength(4);
    expect(NARRATION_STYLES).toContain('commentary');
    expect(NARRATION_STYLES).toContain('advertisement');
    expect(NARRATION_STYLES).toContain('documentary');
    expect(NARRATION_STYLES).toContain('social-media');
  });
});
