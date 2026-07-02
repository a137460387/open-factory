import { describe, it, expect } from 'vitest';
import {
  scoreEmotionFromText,
  analyzeSubtitleEmotion,
  analyzeSubtitleClipEmotions,
  suggestEmotionColor,
  buildEmotionStyleOverrides,
  batchApplyEmotionStyles,
  calculateEmotionHeatmap,
  EMOTION_COLOR_MAP,
  EMOTION_ACCURACY_DISCLAIMER,
} from '../src/subtitles/emotion-analysis';
import type { SubtitleClip } from '../src/model-types';

function makeSubtitleClip(id: string, text: string, start = 0, duration = 2): SubtitleClip {
  return {
    id,
    type: 'subtitle',
    text,
    trackId: 'track-1',
    start,
    duration,
    trimStart: 0,
    trimEnd: 0,
    speed: 1,
    name: 'subtitle',
    style: {
      fontFamily: 'Arial',
      fontSize: 24,
      color: '#ffffff',
      backgroundColor: '#000000',
      backgroundOpacity: 0,
      bold: false,
      italic: false,
      yOffset: 80,
      outlineColor: '#000000',
      outlineWidth: 1,
      shadowColor: '#000000',
      shadowOffset: 0,
    },
    subtitleMode: 'burn-in',
    muted: false,
    volume: 1,
    effects: [],
  };
}

describe('scoreEmotionFromText - anger keywords', () => {
  it('scores anger for anger keywords', () => {
    const scores = scoreEmotionFromText('太愤怒了！气死我了！');
    expect(scores.anger).toBeGreaterThan(0);
  });

  it('detects anger with exclamation bonus', () => {
    const scores = scoreEmotionFromText('混蛋！！！');
    expect(scores.anger).toBeGreaterThan(0);
  });
});

describe('scoreEmotionFromText - joy keywords', () => {
  it('scores joy for happy keywords', () => {
    const scores = scoreEmotionFromText('太棒了！开心快乐！');
    expect(scores.joy).toBeGreaterThan(0);
  });
});

describe('scoreEmotionFromText - sadness keywords', () => {
  it('scores sadness for sad keywords', () => {
    const scores = scoreEmotionFromText('伤心难过，泪流满面');
    expect(scores.sadness).toBeGreaterThan(0);
  });
});

describe('scoreEmotionFromText - surprise keywords', () => {
  it('scores surprise for surprise keywords', () => {
    const scores = scoreEmotionFromText('天哪！竟然会这样？');
    expect(scores.surprise).toBeGreaterThan(0);
  });
});

describe('scoreEmotionFromText - neutral', () => {
  it('scores neutral for plain text', () => {
    const scores = scoreEmotionFromText('今天天气很好');
    expect(scores.neutral).toBeGreaterThan(0);
    expect(scores.anger).toBe(0);
    expect(scores.joy).toBe(0);
  });
});

describe('analyzeSubtitleEmotion', () => {
  it('identifies anger emotion', () => {
    const clip = makeSubtitleClip('c1', '太愤怒了！气死我了！');
    const result = analyzeSubtitleEmotion(clip);
    expect(result.emotion).toBe('anger');
    expect(result.clipId).toBe('c1');
  });

  it('identifies neutral for plain text', () => {
    const clip = makeSubtitleClip('c2', '普通文本内容');
    const result = analyzeSubtitleEmotion(clip);
    expect(result.emotion).toBe('neutral');
  });
});

describe('analyzeSubtitleClipEmotions', () => {
  it('batch analyzes multiple clips', () => {
    const clips = [
      makeSubtitleClip('c1', '开心快乐'),
      makeSubtitleClip('c2', '悲伤痛苦'),
    ];
    const results = analyzeSubtitleClipEmotions(clips);
    expect(results).toHaveLength(2);
    expect(results[0].emotion).toBe('joy');
    expect(results[1].emotion).toBe('sadness');
  });
});

describe('suggestEmotionColor', () => {
  it('maps anger to red', () => {
    const suggestion = suggestEmotionColor({
      clipId: 'c1',
      emotion: 'anger',
      confidence: 1,
      scores: { anger: 1, joy: 0, sadness: 0, surprise: 0, neutral: 0 },
    });
    expect(suggestion.color).toBe('#ff3333');
  });

  it('maps joy to yellow', () => {
    const suggestion = suggestEmotionColor({
      clipId: 'c2',
      emotion: 'joy',
      confidence: 1,
      scores: { anger: 0, joy: 1, sadness: 0, surprise: 0, neutral: 0 },
    });
    expect(suggestion.color).toBe('#ffe066');
  });

  it('maps sadness to blue-gray', () => {
    const suggestion = suggestEmotionColor({
      clipId: 'c3',
      emotion: 'sadness',
      confidence: 1,
      scores: { anger: 0, joy: 0, sadness: 1, surprise: 0, neutral: 0 },
    });
    expect(suggestion.color).toBe('#8899aa');
  });

  it('maps surprise to orange', () => {
    const suggestion = suggestEmotionColor({
      clipId: 'c4',
      emotion: 'surprise',
      confidence: 1,
      scores: { anger: 0, joy: 0, sadness: 0, surprise: 1, neutral: 0 },
    });
    expect(suggestion.color).toBe('#ff9933');
  });

  it('maps neutral to white', () => {
    const suggestion = suggestEmotionColor({
      clipId: 'c5',
      emotion: 'neutral',
      confidence: 1,
      scores: { anger: 0, joy: 0, sadness: 0, surprise: 0, neutral: 1 },
    });
    expect(suggestion.color).toBe('#ffffff');
  });
});

describe('buildEmotionStyleOverrides', () => {
  it('builds red outline for anger', () => {
    const style = buildEmotionStyleOverrides('anger');
    expect(style.color).toBe('#ff3333');
    expect(style.outlineWidth).toBe(2);
  });

  it('builds default outline for neutral', () => {
    const style = buildEmotionStyleOverrides('neutral');
    expect(style.color).toBe('#ffffff');
    expect(style.outlineWidth).toBe(1);
  });
});

describe('batchApplyEmotionStyles', () => {
  it('applies styles to all matching clips', () => {
    const scores = [
      { clipId: 'c1', emotion: 'anger' as const, confidence: 1, scores: { anger: 1, joy: 0, sadness: 0, surprise: 0, neutral: 0 } },
      { clipId: 'c2', emotion: 'joy' as const, confidence: 1, scores: { anger: 0, joy: 1, sadness: 0, surprise: 0, neutral: 0 } },
      { clipId: 'c3', emotion: 'anger' as const, confidence: 1, scores: { anger: 1, joy: 0, sadness: 0, surprise: 0, neutral: 0 } },
    ];
    const result = batchApplyEmotionStyles(scores, 'anger');
    expect(result).toHaveLength(2);
    expect(result[0].clipId).toBe('c1');
    expect(result[1].clipId).toBe('c3');
  });

  it('applies to all when no filter', () => {
    const scores = [
      { clipId: 'c1', emotion: 'anger' as const, confidence: 1, scores: { anger: 1, joy: 0, sadness: 0, surprise: 0, neutral: 0 } },
      { clipId: 'c2', emotion: 'joy' as const, confidence: 1, scores: { anger: 0, joy: 1, sadness: 0, surprise: 0, neutral: 0 } },
    ];
    expect(batchApplyEmotionStyles(scores)).toHaveLength(2);
  });
});

describe('calculateEmotionHeatmap', () => {
  it('returns empty for no clips', () => {
    expect(calculateEmotionHeatmap([], [])).toHaveLength(0);
  });

  it('computes heatmap segments', () => {
    const clips = [
      makeSubtitleClip('c1', '愤怒！', 0, 3),
      makeSubtitleClip('c2', '普通文本', 3, 3),
    ];
    const scores = [
      { clipId: 'c1', emotion: 'anger' as const, confidence: 1, scores: { anger: 2, joy: 0, sadness: 0, surprise: 0, neutral: 0 } },
      { clipId: 'c2', emotion: 'neutral' as const, confidence: 1, scores: { anger: 0, joy: 0, sadness: 0, surprise: 0, neutral: 1 } },
    ];
    const heatmap = calculateEmotionHeatmap(clips, scores, { bucketSeconds: 1, duration: 6 });
    expect(heatmap.length).toBeGreaterThan(0);
    expect(heatmap[0].normalized).toBeGreaterThanOrEqual(0);
    expect(heatmap[0].normalized).toBeLessThanOrEqual(1);
  });
});

describe('EMOTION_ACCURACY_DISCLAIMER', () => {
  it('contains disclaimer text', () => {
    expect(EMOTION_ACCURACY_DISCLAIMER).toContain('参考');
  });
});

describe('analyzeSubtitleEmotion - edge cases', () => {
  it('returns neutral for empty text without throwing', () => {
    const clip = makeSubtitleClip('empty', '');
    const result = analyzeSubtitleEmotion(clip);
    expect(result.emotion).toBe('neutral');
    expect(result.confidence).toBe(1);
    expect(result.scores.neutral).toBe(1);
  });

  it('handles clip with missing style field gracefully', () => {
    // analyzeSubtitleEmotion only reads clip.text and clip.id, not style
    const clip = { id: 'no-style', text: '普通文本' } as SubtitleClip;
    const result = analyzeSubtitleEmotion(clip);
    expect(result.emotion).toBe('neutral');
    expect(result.clipId).toBe('no-style');
  });
});
