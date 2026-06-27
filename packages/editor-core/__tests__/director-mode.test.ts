import { describe, it, expect } from 'vitest';
import {
  buildDirectorModeMediaInfo,
  splitDirectorModeMediaBatches,
  buildDirectorModeSystemPrompt,
  buildDirectorModeUserPrompt,
  parseDirectorModeResponse,
  validateDirectorModeTotalDuration,
  buildDirectorModeStoryboardCards
} from '../src/director-mode';

describe('buildDirectorModeMediaInfo', () => {
  it('packs media with aiAnalysis fields', () => {
    const media = [
      {
        id: 'm1',
        name: 'intro.mp4',
        type: 'video',
        duration: 10,
        aiAnalysis: { tags: ['产品', '展示'], scene: '室内', mood: '积极' }
      }
    ];
    const result = buildDirectorModeMediaInfo(media);
    expect(result).toHaveLength(1);
    expect(result[0].mediaId).toBe('m1');
    expect(result[0].filename).toBe('intro.mp4');
    expect(result[0].tags).toEqual(['产品', '展示']);
    expect(result[0].scene).toBe('室内');
    expect(result[0].mood).toBe('积极');
  });

  it('packs media without aiAnalysis', () => {
    const media = [
      { id: 'm2', name: 'clip.mp4', type: 'video', duration: 5 }
    ];
    const result = buildDirectorModeMediaInfo(media);
    expect(result).toHaveLength(1);
    expect(result[0].mediaId).toBe('m2');
    expect(result[0].tags).toBeUndefined();
    expect(result[0].scene).toBeUndefined();
    expect(result[0].mood).toBeUndefined();
  });

  it('handles mixed media with and without aiAnalysis', () => {
    const media = [
      { id: 'm1', name: 'a.mp4', type: 'video', duration: 10, aiAnalysis: { tags: ['t1'], scene: 's', mood: 'm' } },
      { id: 'm2', name: 'b.mp4', type: 'video', duration: 5 }
    ];
    const result = buildDirectorModeMediaInfo(media);
    expect(result).toHaveLength(2);
    expect(result[0].tags).toEqual(['t1']);
    expect(result[1].tags).toBeUndefined();
  });
});

describe('splitDirectorModeMediaBatches', () => {
  it('returns empty array for empty input', () => {
    expect(splitDirectorModeMediaBatches([])).toEqual([]);
  });

  it('returns single batch when count <= maxBatch', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      mediaId: `m${i}`, filename: `f${i}.mp4`, type: 'video', duration: 5
    }));
    const batches = splitDirectorModeMediaBatches(items, 50);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(10);
  });

  it('splits into multiple batches when count > maxBatch', () => {
    const items = Array.from({ length: 55 }, (_, i) => ({
      mediaId: `m${i}`, filename: `f${i}.mp4`, type: 'video', duration: 5
    }));
    const batches = splitDirectorModeMediaBatches(items, 50);
    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(50);
    expect(batches[1]).toHaveLength(5);
  });

  it('respects custom maxBatch', () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      mediaId: `m${i}`, filename: `f${i}.mp4`, type: 'video', duration: 5
    }));
    const batches = splitDirectorModeMediaBatches(items, 2);
    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(2);
    expect(batches[1]).toHaveLength(2);
    expect(batches[2]).toHaveLength(1);
  });
});

describe('buildDirectorModeSystemPrompt', () => {
  it('includes style description', () => {
    const prompt = buildDirectorModeSystemPrompt('energetic', true, true);
    expect(prompt).toContain('节奏明快');
  });

  it('includes calm style', () => {
    const prompt = buildDirectorModeSystemPrompt('calm', false, false);
    expect(prompt).toContain('舒缓叙事');
  });

  it('includes documentary style', () => {
    const prompt = buildDirectorModeSystemPrompt('documentary', true, false);
    expect(prompt).toContain('纪录片');
  });

  it('includes social-short style', () => {
    const prompt = buildDirectorModeSystemPrompt('social-short', false, true);
    expect(prompt).toContain('社媒短视频');
  });

  it('includes markers instruction when addMarkers is true', () => {
    const prompt = buildDirectorModeSystemPrompt('energetic', true, false);
    expect(prompt).toContain('章节标题');
  });

  it('does not include markers example when addMarkers is false', () => {
    const prompt = buildDirectorModeSystemPrompt('energetic', false, false);
    expect(prompt).not.toContain('章节标题');
  });

  it('sets musicTrackPlaceholder to true when requested', () => {
    const prompt = buildDirectorModeSystemPrompt('calm', false, true);
    expect(prompt).toContain('"musicTrackPlaceholder": true');
  });

  it('sets musicTrackPlaceholder to false when not requested', () => {
    const prompt = buildDirectorModeSystemPrompt('calm', false, false);
    expect(prompt).toContain('"musicTrackPlaceholder": false');
  });

  it('includes duration constraint instruction', () => {
    const prompt = buildDirectorModeSystemPrompt('calm', false, false);
    expect(prompt).toContain('duration之和必须 ≤ 目标时长');
  });
});

describe('buildDirectorModeUserPrompt', () => {
  it('includes description and target duration', () => {
    const mediaInfo = [{ mediaId: 'm1', filename: 'a.mp4', type: 'video', duration: 10 }];
    const prompt = buildDirectorModeUserPrompt('产品宣传片', 90, mediaInfo);
    expect(prompt).toContain('产品宣传片');
    expect(prompt).toContain('90秒');
  });

  it('includes media details with aiAnalysis', () => {
    const mediaInfo = [{
      mediaId: 'm1', filename: 'a.mp4', type: 'video', duration: 10,
      tags: ['产品'], scene: '室内', mood: '积极'
    }];
    const prompt = buildDirectorModeUserPrompt('desc', 60, mediaInfo);
    expect(prompt).toContain('标签: 产品');
    expect(prompt).toContain('场景: 室内');
    expect(prompt).toContain('氛围: 积极');
  });

  it('omits optional fields when not present', () => {
    const mediaInfo = [{ mediaId: 'm1', filename: 'a.mp4', type: 'video', duration: 10 }];
    const prompt = buildDirectorModeUserPrompt('desc', 60, mediaInfo);
    expect(prompt).not.toContain('标签:');
    expect(prompt).not.toContain('场景:');
    expect(prompt).not.toContain('氛围:');
  });
});

describe('parseDirectorModeResponse', () => {
  it('returns empty plan for null/undefined', () => {
    expect(parseDirectorModeResponse(null)).toEqual({ segments: [], markers: [], musicTrackPlaceholder: false });
    expect(parseDirectorModeResponse(undefined)).toEqual({ segments: [], markers: [], musicTrackPlaceholder: false });
  });

  it('returns empty plan for non-object', () => {
    expect(parseDirectorModeResponse('string')).toEqual({ segments: [], markers: [], musicTrackPlaceholder: false });
  });

  it('parses valid segments', () => {
    const json = {
      segments: [
        { mediaId: 'm1', trimStart: 0, duration: 5, trackIndex: 0, order: 0, reason: '开场' },
        { mediaId: 'm2', trimStart: 2, duration: 10, trackIndex: 0, order: 1, reason: '展示' }
      ],
      markers: [],
      musicTrackPlaceholder: false
    };
    const result = parseDirectorModeResponse(json);
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0].mediaId).toBe('m1');
    expect(result.segments[0].trimStart).toBe(0);
    expect(result.segments[0].duration).toBe(5);
    expect(result.segments[0].order).toBe(0);
    expect(result.segments[0].reason).toBe('开场');
    expect(result.segments[1].mediaId).toBe('m2');
    expect(result.segments[1].trimStart).toBe(2);
  });

  it('parses markers', () => {
    const json = {
      segments: [],
      markers: [
        { time: 0, label: '开场' },
        { time: 30, label: '产品展示' }
      ],
      musicTrackPlaceholder: true
    };
    const result = parseDirectorModeResponse(json);
    expect(result.markers).toHaveLength(2);
    expect(result.markers[0].time).toBe(0);
    expect(result.markers[0].label).toBe('开场');
    expect(result.markers[1].time).toBe(30);
    expect(result.musicTrackPlaceholder).toBe(true);
  });

  it('skips segments with missing mediaId', () => {
    const json = {
      segments: [
        { duration: 5, trackIndex: 0, order: 0, reason: 'test' },
        { mediaId: '', duration: 5, trackIndex: 0, order: 1, reason: 'test' },
        { mediaId: 'm1', duration: 5, trackIndex: 0, order: 2, reason: 'valid' }
      ],
      markers: [],
      musicTrackPlaceholder: false
    };
    const result = parseDirectorModeResponse(json);
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].mediaId).toBe('m1');
  });

  it('skips segments with missing duration', () => {
    const json = {
      segments: [
        { mediaId: 'm1', trackIndex: 0, order: 0, reason: 'test' }
      ],
      markers: [],
      musicTrackPlaceholder: false
    };
    const result = parseDirectorModeResponse(json);
    expect(result.segments).toHaveLength(0);
  });

  it('applies default values for missing optional fields', () => {
    const json = {
      segments: [{ mediaId: 'm1', duration: 5 }],
      markers: [],
      musicTrackPlaceholder: false
    };
    const result = parseDirectorModeResponse(json);
    expect(result.segments[0].trimStart).toBe(0);
    expect(result.segments[0].trackIndex).toBe(0);
    expect(result.segments[0].order).toBe(0);
    expect(result.segments[0].reason).toBe('');
  });

  it('clamps negative trimStart to 0', () => {
    const json = {
      segments: [{ mediaId: 'm1', trimStart: -3, duration: 5 }],
      markers: [],
      musicTrackPlaceholder: false
    };
    const result = parseDirectorModeResponse(json);
    expect(result.segments[0].trimStart).toBe(0);
  });

  it('clamps duration below 0.1 to 0.1', () => {
    const json = {
      segments: [{ mediaId: 'm1', duration: 0 }],
      markers: [],
      musicTrackPlaceholder: false
    };
    const result = parseDirectorModeResponse(json);
    expect(result.segments[0].duration).toBe(0.1);
  });

  it('skips markers with missing label', () => {
    const json = {
      segments: [],
      markers: [{ time: 5, label: '' }, { time: 10, label: '有效' }],
      musicTrackPlaceholder: false
    };
    const result = parseDirectorModeResponse(json);
    expect(result.markers).toHaveLength(1);
    expect(result.markers[0].label).toBe('有效');
  });

  it('skips markers with non-number time', () => {
    const json = {
      segments: [],
      markers: [{ time: 'abc', label: 'test' }],
      musicTrackPlaceholder: false
    };
    const result = parseDirectorModeResponse(json);
    expect(result.markers).toHaveLength(0);
  });

  it('sets musicTrackPlaceholder to false when not boolean true', () => {
    const json = { segments: [], markers: [], musicTrackPlaceholder: 'yes' };
    expect(parseDirectorModeResponse(json).musicTrackPlaceholder).toBe(false);
  });
});

describe('validateDirectorModeTotalDuration', () => {
  it('returns true for empty segments', () => {
    expect(validateDirectorModeTotalDuration([], 90)).toBe(true);
  });

  it('returns true when total equals target', () => {
    const segments = [
      { mediaId: 'm1', trimStart: 0, duration: 30, trackIndex: 0, order: 0, reason: '' },
      { mediaId: 'm2', trimStart: 0, duration: 60, trackIndex: 0, order: 1, reason: '' }
    ];
    expect(validateDirectorModeTotalDuration(segments, 90)).toBe(true);
  });

  it('returns true when total is less than target', () => {
    const segments = [
      { mediaId: 'm1', trimStart: 0, duration: 20, trackIndex: 0, order: 0, reason: '' }
    ];
    expect(validateDirectorModeTotalDuration(segments, 90)).toBe(true);
  });

  it('returns false when total exceeds target', () => {
    const segments = [
      { mediaId: 'm1', trimStart: 0, duration: 50, trackIndex: 0, order: 0, reason: '' },
      { mediaId: 'm2', trimStart: 0, duration: 50, trackIndex: 0, order: 1, reason: '' }
    ];
    expect(validateDirectorModeTotalDuration(segments, 90)).toBe(false);
  });
});

describe('buildDirectorModeStoryboardCards', () => {
  it('converts plan segments to storyboard cards sorted by order', () => {
    const plan = {
      segments: [
        { mediaId: 'm2', trimStart: 0, duration: 10, trackIndex: 0, order: 1, reason: '展示' },
        { mediaId: 'm1', trimStart: 0, duration: 5, trackIndex: 0, order: 0, reason: '开场' }
      ],
      markers: [],
      musicTrackPlaceholder: false
    };
    const mediaById = new Map([
      ['m1', { name: 'intro.mp4' }],
      ['m2', { name: 'demo.mp4' }]
    ]);
    const cards = buildDirectorModeStoryboardCards(plan, mediaById);
    expect(cards).toHaveLength(2);
    expect(cards[0].mediaName).toBe('intro.mp4');
    expect(cards[0].order).toBe(0);
    expect(cards[1].mediaName).toBe('demo.mp4');
    expect(cards[1].order).toBe(1);
  });

  it('uses mediaId as fallback name when not in map', () => {
    const plan = {
      segments: [{ mediaId: 'unknown', trimStart: 0, duration: 5, trackIndex: 0, order: 0, reason: '' }],
      markers: [],
      musicTrackPlaceholder: false
    };
    const cards = buildDirectorModeStoryboardCards(plan, new Map());
    expect(cards[0].mediaName).toBe('unknown');
  });

  it('initializes deleted as false', () => {
    const plan = {
      segments: [{ mediaId: 'm1', trimStart: 0, duration: 5, trackIndex: 0, order: 0, reason: '' }],
      markers: [],
      musicTrackPlaceholder: false
    };
    const cards = buildDirectorModeStoryboardCards(plan, new Map());
    expect(cards[0].deleted).toBe(false);
  });

  it('preserves all segment fields', () => {
    const plan = {
      segments: [{ mediaId: 'm1', trimStart: 2.5, duration: 8, trackIndex: 1, order: 3, reason: '理由' }],
      markers: [],
      musicTrackPlaceholder: false
    };
    const cards = buildDirectorModeStoryboardCards(plan, new Map());
    expect(cards[0].trimStart).toBe(2.5);
    expect(cards[0].duration).toBe(8);
    expect(cards[0].trackIndex).toBe(1);
    expect(cards[0].order).toBe(3);
    expect(cards[0].reason).toBe('理由');
  });
});
