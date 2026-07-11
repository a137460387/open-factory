import { describe, expect, it } from 'vitest';
import {
  runAlgorithmPipeline,
  selectHighlightClips,
  assembleBySceneOrder,
  filterSilentFromMedia,
  assembleByDialogue,
  scoreMediaForHighlight,
  type AlgorithmStep
} from '../src/algorithm-pipeline';
import type { MediaAsset } from '../src/model-types';

function makeMedia(overrides: Partial<MediaAsset> & { id: string }): MediaAsset {
  return {
    type: 'video',
    name: `${overrides.id}.mp4`,
    path: `/tmp/${overrides.id}.mp4`,
    duration: 10,
    width: 1920,
    height: 1080,
    hasAudio: true,
    ...overrides
  } as MediaAsset;
}

describe('scoreMediaForHighlight', () => {
  it('returns low score for media without AI analysis', () => {
    const media = makeMedia({ id: 'm1' });
    expect(scoreMediaForHighlight(media)).toBe(10); // only moderate duration bonus
  });

  it('scores positive mood higher', () => {
    const withMood = makeMedia({ id: 'm1', aiAnalysis: { tags: [], scene: '', mood: 'happy', objects: [], analysisTime: '', providerId: '' } });
    const withoutMood = makeMedia({ id: 'm2', aiAnalysis: { tags: [], scene: '', mood: 'sad', objects: [], analysisTime: '', providerId: '' } });
    expect(scoreMediaForHighlight(withMood)).toBeGreaterThan(scoreMediaForHighlight(withoutMood));
  });

  it('scores rich tags higher', () => {
    const richTags = makeMedia({ id: 'm1', aiAnalysis: { tags: ['a', 'b', 'c', 'd'], scene: '', mood: '', objects: [], analysisTime: '', providerId: '' } });
    const fewTags = makeMedia({ id: 'm2', aiAnalysis: { tags: ['a'], scene: '', mood: '', objects: [], analysisTime: '', providerId: '' } });
    expect(scoreMediaForHighlight(richTags)).toBeGreaterThan(scoreMediaForHighlight(fewTags));
  });

  it('scores moderate duration higher', () => {
    const moderate = makeMedia({ id: 'm1', duration: 20 });
    const tooShort = makeMedia({ id: 'm2', duration: 1 });
    expect(scoreMediaForHighlight(moderate)).toBeGreaterThan(scoreMediaForHighlight(tooShort));
  });

  it('includes quality assessment score', () => {
    const withQuality = makeMedia({ id: 'm1', qualityAssessment: { overallScore: 80, issues: [] } });
    const without = makeMedia({ id: 'm2' });
    expect(scoreMediaForHighlight(withQuality)).toBeGreaterThan(scoreMediaForHighlight(without));
  });
});

describe('selectHighlightClips', () => {
  it('returns empty array for empty media', () => {
    expect(selectHighlightClips([])).toEqual([]);
  });

  it('selects clips sorted by score descending', () => {
    const media = [
      makeMedia({ id: 'low', duration: 3 }),
      makeMedia({ id: 'high', aiAnalysis: { tags: ['a', 'b', 'c', 'd'], scene: '室内', mood: 'happy', objects: [], analysisTime: '', providerId: '' }, duration: 20 }),
      makeMedia({ id: 'mid', aiAnalysis: { tags: ['a'], scene: '', mood: 'calm', objects: [], analysisTime: '', providerId: '' }, duration: 10 })
    ];
    const result = selectHighlightClips(media);
    expect(result.length).toBe(3);
    expect(result[0].mediaId).toBe('high');
  });

  it('respects maxClips option', () => {
    const media = Array.from({ length: 15 }, (_, i) => makeMedia({ id: `m${i}` }));
    const result = selectHighlightClips(media, { maxClips: 5 });
    expect(result.length).toBe(5);
  });

  it('clamps duration within bounds', () => {
    const media = [makeMedia({ id: 'm1', duration: 100 })];
    const result = selectHighlightClips(media, { maxDuration: 20 });
    expect(result[0].duration).toBeLessThanOrEqual(20);
  });

  it('sets reason with mood and scene info', () => {
    const media = [makeMedia({ id: 'm1', aiAnalysis: { tags: ['t'], scene: '室外', mood: 'energetic', objects: [], analysisTime: '', providerId: '' } })];
    const result = selectHighlightClips(media);
    expect(result[0].reason).toContain('energetic');
    expect(result[0].reason).toContain('室外');
  });
});

describe('assembleBySceneOrder', () => {
  it('returns empty array for empty media', () => {
    expect(assembleBySceneOrder([])).toEqual([]);
  });

  it('groups media by scene', () => {
    const media = [
      makeMedia({ id: 'outdoor', aiAnalysis: { tags: [], scene: '室外', mood: '', objects: [], analysisTime: '', providerId: '' } }),
      makeMedia({ id: 'indoor', aiAnalysis: { tags: [], scene: '室内', mood: '', objects: [], analysisTime: '', providerId: '' } })
    ];
    const result = assembleBySceneOrder(media);
    expect(result.length).toBe(2);
    expect(result[0].reason).toContain('室内');
    expect(result[1].reason).toContain('室外');
  });

  it('sorts scenes by narrative order', () => {
    const media = [
      makeMedia({ id: 'ending', aiAnalysis: { tags: [], scene: '结尾', mood: '', objects: [], analysisTime: '', providerId: '' } }),
      makeMedia({ id: 'intro', aiAnalysis: { tags: [], scene: '室内', mood: '', objects: [], analysisTime: '', providerId: '' } })
    ];
    const result = assembleBySceneOrder(media);
    expect(result[0].mediaId).toBe('intro');
    expect(result[1].mediaId).toBe('ending');
  });

  it('handles media without AI analysis', () => {
    const media = [makeMedia({ id: 'no-analysis' })];
    const result = assembleBySceneOrder(media);
    expect(result.length).toBe(1);
    expect(result[0].reason).toContain('未分类');
  });
});

describe('filterSilentFromMedia', () => {
  it('returns empty array for empty media', () => {
    expect(filterSilentFromMedia([])).toEqual([]);
  });

  it('returns full clip for media without audio', () => {
    const media = [makeMedia({ id: 'no-audio', hasAudio: false })];
    const result = filterSilentFromMedia(media);
    expect(result.length).toBe(1);
    expect(result[0].reason).toContain('无音频');
  });

  it('generates non-silent segments for media with audio', () => {
    const media = [makeMedia({ id: 'audio', duration: 10, hasAudio: true })];
    const result = filterSilentFromMedia(media);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].duration).toBeGreaterThan(0);
  });

  it('clamps segment duration to source duration', () => {
    const media = [makeMedia({ id: 'short', duration: 1, hasAudio: true })];
    const result = filterSilentFromMedia(media);
    for (const clip of result) {
      expect(clip.duration).toBeLessThanOrEqual(1);
    }
  });
});

describe('assembleByDialogue', () => {
  it('returns empty array for empty media', () => {
    expect(assembleByDialogue([])).toEqual([]);
  });

  it('returns single segment for short media without audio', () => {
    const media = [makeMedia({ id: 'no-audio', hasAudio: false, duration: 5 })];
    const result = assembleByDialogue(media);
    expect(result.length).toBe(1);
    expect(result[0].reason).toContain('无音频');
  });

  it('splits longer media into dialogue segments', () => {
    const media = [makeMedia({ id: 'long', duration: 30, hasAudio: true })];
    const result = assembleByDialogue(media);
    expect(result.length).toBeGreaterThanOrEqual(2);
    for (const clip of result) {
      expect(clip.reason).toContain('语音段');
    }
  });

  it('each segment has valid duration', () => {
    const media = [makeMedia({ id: 'm', duration: 20, hasAudio: true })];
    const result = assembleByDialogue(media);
    for (const clip of result) {
      expect(clip.duration).toBeGreaterThan(0);
      expect(clip.startTime).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('runAlgorithmPipeline', () => {
  it('returns empty array for empty media', () => {
    expect(runAlgorithmPipeline([], { steps: ['highlight'] })).toEqual([]);
  });

  it('returns empty array for empty steps', () => {
    const media = [makeMedia({ id: 'm1' })];
    expect(runAlgorithmPipeline(media, { steps: [] })).toEqual([]);
  });

  it('runs highlight step and returns clips', () => {
    const media = [
      makeMedia({ id: 'a', aiAnalysis: { tags: ['x', 'y', 'z', 'w'], scene: '室内', mood: 'happy', objects: [], analysisTime: '', providerId: '' } }),
      makeMedia({ id: 'b' })
    ];
    const result = runAlgorithmPipeline(media, { steps: ['highlight'] });
    expect(result.length).toBe(2);
    expect(result[0].mediaId).toBe('a');
  });

  it('runs scene step and returns clips', () => {
    const media = [
      makeMedia({ id: 'a', aiAnalysis: { tags: [], scene: '室外', mood: '', objects: [], analysisTime: '', providerId: '' } }),
      makeMedia({ id: 'b', aiAnalysis: { tags: [], scene: '室内', mood: '', objects: [], analysisTime: '', providerId: '' } })
    ];
    const result = runAlgorithmPipeline(media, { steps: ['scene'] });
    expect(result.length).toBe(2);
    expect(result[0].reason).toContain('室内');
  });

  it('runs silence step and returns clips', () => {
    const media = [makeMedia({ id: 'a', duration: 10, hasAudio: true })];
    const result = runAlgorithmPipeline(media, { steps: ['silence'] });
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('runs dialogue step and returns clips', () => {
    const media = [makeMedia({ id: 'a', duration: 20, hasAudio: true })];
    const result = runAlgorithmPipeline(media, { steps: ['dialogue'] });
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('uses first matching step when multiple provided', () => {
    const media = [
      makeMedia({ id: 'a', aiAnalysis: { tags: ['x', 'y', 'z', 'w'], scene: '室内', mood: 'happy', objects: [], analysisTime: '', providerId: '' } })
    ];
    const result = runAlgorithmPipeline(media, { steps: ['highlight', 'scene'] });
    expect(result.length).toBe(1);
  });

  it('falls through to next step if first returns empty', () => {
    const media = [makeMedia({ id: 'a' })];
    const result = runAlgorithmPipeline(media, { steps: ['highlight', 'silence'] });
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('reassigns track indices sequentially', () => {
    const media = [
      makeMedia({ id: 'a', aiAnalysis: { tags: [], scene: '室内', mood: '', objects: [], analysisTime: '', providerId: '' } }),
      makeMedia({ id: 'b', aiAnalysis: { tags: [], scene: '室外', mood: '', objects: [], analysisTime: '', providerId: '' } }),
      makeMedia({ id: 'c', aiAnalysis: { tags: [], scene: '结尾', mood: '', objects: [], analysisTime: '', providerId: '' } })
    ];
    const result = runAlgorithmPipeline(media, { steps: ['scene'] });
    result.forEach((clip, index) => {
      expect(clip.trackIndex).toBe(index);
    });
  });
});
