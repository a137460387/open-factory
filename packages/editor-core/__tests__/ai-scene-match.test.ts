import { describe, it, expect } from 'vitest';
import {
  buildSceneMatchContext,
  buildSceneMatchMediaPayload,
  buildSceneMatchSystemPrompt,
  buildSceneMatchUserPrompt,
  parseSceneMatchResponse,
  buildSceneMatchDragParams,
  getUnanalyzedMediaIdsForSceneMatch,
  SCENE_MATCH_MAX_SIMILAR,
  SCENE_MATCH_MAX_CONTRAST
} from '../src/ai-scene-match';

describe('buildSceneMatchContext', () => {
  it('extracts prev/next scene from timeline neighbors', () => {
    const clip = { id: 'c2', name: 'beach.mp4', type: 'video', mediaId: 'm2' };
    const timelineClips = [
      { id: 'c1', start: 0, mediaId: 'm1', aiAnalysis: { tags: [], scene: '森林', mood: '宁静', objects: [] } },
      { id: 'c2', start: 5, mediaId: 'm2' },
      { id: 'c3', start: 10, mediaId: 'm3', aiAnalysis: { tags: [], scene: '城市夜景', mood: '繁华', objects: [] } }
    ];
    const media = [
      { id: 'm1', aiAnalysis: { tags: [], scene: '森林', mood: '宁静', objects: [] } },
      { id: 'm2', aiAnalysis: { tags: ['海滩'], scene: '沙滩', mood: '愉快', objects: ['浪花'] } },
      { id: 'm3', aiAnalysis: { tags: [], scene: '城市夜景', mood: '繁华', objects: [] } }
    ];
    const ctx = buildSceneMatchContext(clip, timelineClips, media);
    expect(ctx.clipId).toBe('c2');
    expect(ctx.clipName).toBe('beach.mp4');
    expect(ctx.prevScene).toBe('森林');
    expect(ctx.nextScene).toBe('城市夜景');
    expect(ctx.aiAnalysis?.scene).toBe('沙滩');
  });

  it('resolves aiAnalysis from media when clip has no direct analysis', () => {
    const clip = { id: 'c1', name: 'clip1', type: 'video', mediaId: 'm1' };
    const timelineClips = [{ id: 'c1', start: 0, mediaId: 'm1' }];
    const media = [
      { id: 'm1', aiAnalysis: { tags: ['tag1'], scene: '办公室', mood: '专注', objects: ['电脑'] } }
    ];
    const ctx = buildSceneMatchContext(clip, timelineClips, media);
    expect(ctx.aiAnalysis?.scene).toBe('办公室');
  });

  it('returns undefined prev/next for single clip timeline', () => {
    const clip = { id: 'c1', name: 'solo.mp4', type: 'video' };
    const timelineClips = [{ id: 'c1', start: 0 }];
    const media: Array<{ id: string }> = [];
    const ctx = buildSceneMatchContext(clip, timelineClips, media);
    expect(ctx.prevScene).toBeUndefined();
    expect(ctx.nextScene).toBeUndefined();
    expect(ctx.aiAnalysis).toBeUndefined();
  });

  it('handles first and last clip correctly', () => {
    const clip = { id: 'c1', name: 'first.mp4', type: 'video', mediaId: 'm1' };
    const timelineClips = [
      { id: 'c1', start: 0, mediaId: 'm1' },
      { id: 'c2', start: 5, mediaId: 'm2', aiAnalysis: { tags: [], scene: '海滩', mood: '愉快', objects: [] } }
    ];
    const media = [{ id: 'm1' }, { id: 'm2' }];
    const ctx = buildSceneMatchContext(clip, timelineClips, media);
    expect(ctx.prevScene).toBeUndefined();
    expect(ctx.nextScene).toBe('海滩');
  });
});

describe('buildSceneMatchMediaPayload', () => {
  it('extracts aiAnalysis fields from media items', () => {
    const media = [
      { id: 'm1', name: 'a.mp4', type: 'video', aiAnalysis: { tags: ['户外'], scene: '公园', mood: '愉快', objects: ['树'] } }
    ];
    const result = buildSceneMatchMediaPayload(media);
    expect(result).toHaveLength(1);
    expect(result[0].mediaId).toBe('m1');
    expect(result[0].aiAnalysis?.tags).toEqual(['户外']);
  });

  it('falls back to filename for items without aiAnalysis', () => {
    const media = [
      { id: 'm1', name: 'sunset.mp4', type: 'video' }
    ];
    const result = buildSceneMatchMediaPayload(media);
    expect(result[0].aiAnalysis?.scene).toBe('sunset.mp4');
    expect(result[0].aiAnalysis?.tags).toEqual([]);
  });

  it('filters to only aiAnalysis items when count > 200', () => {
    const media = Array.from({ length: 201 }, (_, i) => ({
      id: `m${i}`,
      name: `f${i}.mp4`,
      type: 'video',
      ...(i % 2 === 0 ? { aiAnalysis: { tags: ['t'], scene: 's', mood: 'm', objects: [] } } : {})
    }));
    const result = buildSceneMatchMediaPayload(media, 200);
    expect(result).toHaveLength(101);
    result.forEach((item) => expect(item.aiAnalysis).toBeDefined());
  });
});

describe('buildSceneMatchSystemPrompt', () => {
  it('returns a non-empty string containing format instructions', () => {
    const prompt = buildSceneMatchSystemPrompt();
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toContain('similar');
    expect(prompt).toContain('contrast');
  });
});

describe('buildSceneMatchUserPrompt', () => {
  it('includes clip info and analysis in the prompt', () => {
    const context = {
      clipId: 'c1',
      clipName: 'beach.mp4',
      clipType: 'video',
      aiAnalysis: { tags: ['海滩', '阳光'], scene: '沙滩', mood: '愉快', objects: ['浪花', '沙子'] },
      prevScene: '森林',
      nextScene: undefined
    };
    const mediaItems = [
      { mediaId: 'm1', name: 'a.mp4', type: 'video', aiAnalysis: { tags: ['户外'], scene: '公园', mood: '愉快', objects: ['树'] } }
    ];
    const prompt = buildSceneMatchUserPrompt(context, mediaItems);
    expect(prompt).toContain('beach.mp4');
    expect(prompt).toContain('沙滩');
    expect(prompt).toContain('森林');
    expect(prompt).toContain('m1');
    expect(prompt).not.toContain('后一片段场景');
  });

  it('includes fallback message when no aiAnalysis', () => {
    const context = { clipId: 'c1', clipName: 'unknown.mp4', clipType: 'video' };
    const prompt = buildSceneMatchUserPrompt(context, []);
    expect(prompt).toContain('无（将基于文件名推断）');
  });
});

describe('parseSceneMatchResponse', () => {
  it('parses similar and contrast results correctly', () => {
    const json = {
      similar: [
        { mediaId: 'm1', score: 0.9, reason: '场景相近' },
        { mediaId: 'm2', score: 0.7, reason: '氛围类似' }
      ],
      contrast: [
        { mediaId: 'm3', score: 0.8, reason: '明暗对比强烈' }
      ]
    };
    const result = parseSceneMatchResponse(json);
    expect(result.similar).toHaveLength(2);
    expect(result.similar[0].mediaId).toBe('m1');
    expect(result.similar[0].score).toBe(0.9);
    expect(result.similar[0].reason).toBe('场景相近');
    expect(result.contrast).toHaveLength(1);
    expect(result.contrast[0].mediaId).toBe('m3');
  });

  it('sorts by score descending and limits to max count', () => {
    const json = {
      similar: Array.from({ length: 10 }, (_, i) => ({ mediaId: `m${i}`, score: 1 - i * 0.1, reason: `r${i}` })),
      contrast: Array.from({ length: 10 }, (_, i) => ({ mediaId: `c${i}`, score: 1 - i * 0.1, reason: `r${i}` }))
    };
    const result = parseSceneMatchResponse(json);
    expect(result.similar).toHaveLength(SCENE_MATCH_MAX_SIMILAR);
    expect(result.contrast).toHaveLength(SCENE_MATCH_MAX_CONTRAST);
    expect(result.similar[0].score).toBeGreaterThanOrEqual(result.similar[1].score);
  });

  it('filters out invalid entries and zero scores', () => {
    const json = {
      similar: [
        { mediaId: 'm1', score: 0, reason: 'zero' },
        { mediaId: '', score: 0.5, reason: 'empty id' },
        null,
        { mediaId: 'm2', score: 0.8, reason: 'valid' }
      ],
      contrast: 'not an array'
    };
    const result = parseSceneMatchResponse(json);
    expect(result.similar).toHaveLength(2);
    expect(result.similar[0].mediaId).toBe('m2');
    expect(result.contrast).toHaveLength(0);
  });

  it('clamps score to 0-1 range', () => {
    const json = {
      similar: [{ mediaId: 'm1', score: 1.5, reason: 'high' }],
      contrast: [{ mediaId: 'm2', score: -0.3, reason: 'neg' }]
    };
    const result = parseSceneMatchResponse(json);
    expect(result.similar[0].score).toBe(1);
    expect(result.contrast).toHaveLength(0);
  });

  it('returns empty for null/undefined input', () => {
    expect(parseSceneMatchResponse(null).similar).toHaveLength(0);
    expect(parseSceneMatchResponse(undefined).contrast).toHaveLength(0);
    expect(parseSceneMatchResponse('string').similar).toHaveLength(0);
  });

  it('trims whitespace from mediaId and reason', () => {
    const json = {
      similar: [{ mediaId: '  m1  ', score: 0.5, reason: '  good  ' }],
      contrast: []
    };
    const result = parseSceneMatchResponse(json);
    expect(result.similar[0].mediaId).toBe('m1');
    expect(result.similar[0].reason).toBe('good');
  });
});

describe('buildSceneMatchDragParams', () => {
  it('constructs drag params from media asset', () => {
    const asset = { id: 'm1', name: 'beach.mp4', type: 'video', path: '/media/beach.mp4', duration: 10, width: 1920, height: 1080 };
    const params = buildSceneMatchDragParams(asset);
    expect(params.mediaId).toBe('m1');
    expect(params.name).toBe('beach.mp4');
    expect(params.type).toBe('video');
    expect(params.path).toBe('/media/beach.mp4');
    expect(params.duration).toBe(10);
    expect(params.width).toBe(1920);
    expect(params.height).toBe(1080);
  });
});

describe('getUnanalyzedMediaIdsForSceneMatch', () => {
  it('returns ids of media without aiAnalysis not in result set', () => {
    const allMedia = [
      { id: 'm1', aiAnalysis: { tags: [], scene: 's', mood: 'm', objects: [] } },
      { id: 'm2' },
      { id: 'm3' }
    ];
    const resultIds = new Set(['m1']);
    const unanalyzed = getUnanalyzedMediaIdsForSceneMatch(allMedia, resultIds);
    expect(unanalyzed).toEqual(['m2', 'm3']);
  });

  it('returns empty when all media have analysis', () => {
    const allMedia = [
      { id: 'm1', aiAnalysis: { tags: [], scene: 's', mood: 'm', objects: [] } }
    ];
    const unanalyzed = getUnanalyzedMediaIdsForSceneMatch(allMedia, new Set());
    expect(unanalyzed).toHaveLength(0);
  });
});
