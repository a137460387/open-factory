import { describe, it, expect } from 'vitest';
import {
  createDefaultAssistEditingConfig,
  validateAssistEditingConfig,
  applyAssistEditingPreset,
  detectSceneTransitions,
  computeAudioOnsets,
  mergeNearbyCuts,
  scoreSuggestionQuality,
  filterAndRankSuggestions,
  buildAssistEditingSystemPrompt,
  parseAssistEditingResponse,
  parseAssistEditingResponseSafe,
} from './assist-editing';
import type { AssistEditingSuggestion, ContentAnalysisResult } from './assist-editing';

// ==================== 测试辅助数据 ====================

/** 创建一个 RGBA 帧，指定大小和均匀颜色 */
function makeFrame(width: number, height: number, r: number, g: number, b: number, a = 255): Uint8Array {
  const frame = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    frame[i * 4] = r;
    frame[i * 4 + 1] = g;
    frame[i * 4 + 2] = b;
    frame[i * 4 + 3] = a;
  }
  return frame;
}

/** 创建一个简单的建议对象 */
function makeSuggestion(overrides: Partial<AssistEditingSuggestion> = {}): AssistEditingSuggestion {
  return {
    id: 'test-1',
    startTime: 1,
    endTime: 3,
    cutType: 'hard-cut',
    confidence: 0.8,
    reason: '测试原因',
    sourceAnalysis: 'scene',
    suggestedTransition: 'none',
    priority: 5,
    ...overrides,
  };
}

/** 创建一个最小的内容分析结果 */
function makeAnalysis(overrides: Partial<ContentAnalysisResult> = {}): ContentAnalysisResult {
  return {
    scenes: [],
    emotionCurve: [0.5, 0.6, 0.7, 0.8, 0.5],
    rhythmProfile: {
      bpm: 120,
      beatTimes: [0.5, 1.0, 1.5, 2.0],
      energyCurve: [0.3, 0.5, 0.7, 0.5],
      tempoChanges: [],
    },
    speakerSegments: [],
    keyFrames: [],
    ...overrides,
  };
}

// ==================== createDefaultAssistEditingConfig ====================

describe('createDefaultAssistEditingConfig', () => {
  it('should return an object with all required boolean fields', () => {
    const config = createDefaultAssistEditingConfig();
    expect(typeof config.enableAutoCut).toBe('boolean');
    expect(typeof config.enableRhythmSync).toBe('boolean');
    expect(typeof config.enableEmotionAware).toBe('boolean');
    expect(typeof config.enableContentAnalysis).toBe('boolean');
  });

  it('should have positive segment durations', () => {
    const config = createDefaultAssistEditingConfig();
    expect(config.minSegmentDuration).toBeGreaterThan(0);
    expect(config.maxSegmentDuration).toBeGreaterThan(0);
    expect(config.minSegmentDuration).toBeLessThanOrEqual(config.maxSegmentDuration);
  });

  it('should have non-empty preferredCutTypes array', () => {
    const config = createDefaultAssistEditingConfig();
    expect(Array.isArray(config.preferredCutTypes)).toBe(true);
    expect(config.preferredCutTypes.length).toBeGreaterThan(0);
  });

  it('should have a string transitionPreference', () => {
    const config = createDefaultAssistEditingConfig();
    expect(typeof config.transitionPreference).toBe('string');
  });
});

// ==================== validateAssistEditingConfig ====================

describe('validateAssistEditingConfig', () => {
  it('should return true for a valid default config', () => {
    const config = createDefaultAssistEditingConfig();
    expect(validateAssistEditingConfig(config)).toBe(true);
  });

  it('should return false when enableAutoCut is not a boolean', () => {
    const config = { ...createDefaultAssistEditingConfig(), enableAutoCut: 'yes' as any };
    expect(validateAssistEditingConfig(config)).toBe(false);
  });

  it('should return false when minSegmentDuration is negative', () => {
    const config = { ...createDefaultAssistEditingConfig(), minSegmentDuration: -1 };
    expect(validateAssistEditingConfig(config)).toBe(false);
  });

  it('should return false when minSegmentDuration > maxSegmentDuration', () => {
    const config = {
      ...createDefaultAssistEditingConfig(),
      minSegmentDuration: 20,
      maxSegmentDuration: 5,
    };
    expect(validateAssistEditingConfig(config)).toBe(false);
  });

  it('should return false when preferredCutTypes is not an array', () => {
    const config = { ...createDefaultAssistEditingConfig(), preferredCutTypes: 'hard-cut' as any };
    expect(validateAssistEditingConfig(config)).toBe(false);
  });

  it('should return false when targetDuration is negative', () => {
    const config = { ...createDefaultAssistEditingConfig(), targetDuration: -5 };
    expect(validateAssistEditingConfig(config)).toBe(false);
  });

  it('should accept valid optional targetDuration and maxCutCount', () => {
    const config = {
      ...createDefaultAssistEditingConfig(),
      targetDuration: 60,
      maxCutCount: 10,
    };
    expect(validateAssistEditingConfig(config)).toBe(true);
  });
});

// ==================== applyAssistEditingPreset ====================

describe('applyAssistEditingPreset', () => {
  it('quick-cut should enable auto-cut only', () => {
    const config = applyAssistEditingPreset('quick-cut');
    expect(config.enableAutoCut).toBe(true);
    expect(config.enableRhythmSync).toBe(false);
    expect(config.enableEmotionAware).toBe(false);
    expect(config.enableContentAnalysis).toBe(false);
  });

  it('rhythm-match should enable rhythm sync only', () => {
    const config = applyAssistEditingPreset('rhythm-match');
    expect(config.enableRhythmSync).toBe(true);
    expect(config.enableAutoCut).toBe(false);
  });

  it('emotion-driven should enable emotion and rhythm', () => {
    const config = applyAssistEditingPreset('emotion-driven');
    expect(config.enableEmotionAware).toBe(true);
    expect(config.enableRhythmSync).toBe(true);
    expect(config.transitionPreference).toBe('cross-dissolve');
  });

  it('content-aware should enable all features', () => {
    const config = applyAssistEditingPreset('content-aware');
    expect(config.enableAutoCut).toBe(true);
    expect(config.enableRhythmSync).toBe(true);
    expect(config.enableEmotionAware).toBe(true);
    expect(config.enableContentAnalysis).toBe(true);
  });

  it('custom should return a valid config', () => {
    const config = applyAssistEditingPreset('custom');
    expect(validateAssistEditingConfig(config)).toBe(true);
  });

  it('all presets should produce valid configs', () => {
    const presets = ['quick-cut', 'rhythm-match', 'emotion-driven', 'content-aware', 'custom'] as const;
    for (const preset of presets) {
      expect(validateAssistEditingConfig(applyAssistEditingPreset(preset))).toBe(true);
    }
  });
});

// ==================== detectSceneTransitions ====================

describe('detectSceneTransitions', () => {
  it('should return empty array for fewer than 2 frames', () => {
    expect(detectSceneTransitions([])).toEqual([]);
    expect(detectSceneTransitions([makeFrame(4, 4, 100, 100, 100)])).toEqual([]);
  });

  it('should return empty array for identical frames', () => {
    const frame = makeFrame(4, 4, 100, 100, 100);
    expect(detectSceneTransitions([frame, frame, frame])).toEqual([]);
  });

  it('should detect a scene change between drastically different frames', () => {
    // Use many identical frames so that the adaptive threshold stays low
    // when one big change occurs among many stable frames
    const black = makeFrame(8, 8, 0, 0, 0);
    const white = makeFrame(8, 8, 255, 255, 255);
    const frames: Uint8Array[] = [];
    // 20 identical black frames
    for (let i = 0; i < 20; i++) frames.push(black);
    // then 10 identical white frames
    for (let i = 0; i < 10; i++) frames.push(white);
    const transitions = detectSceneTransitions(frames, 0.1);
    expect(transitions.length).toBeGreaterThanOrEqual(1);
  });
});

// ==================== computeAudioOnsets ====================

describe('computeAudioOnsets', () => {
  it('should return empty array for empty audio data', () => {
    expect(computeAudioOnsets(new Float32Array(0), 44100)).toEqual([]);
  });

  it('should return empty array for invalid sample rate', () => {
    expect(computeAudioOnsets(new Float32Array(1000), 0)).toEqual([]);
    expect(computeAudioOnsets(new Float32Array(1000), -1)).toEqual([]);
  });

  it('should return onsets as an array of time values', () => {
    // 1 秒 44100Hz 静音后突然出现信号
    const audio = new Float32Array(44100);
    // 前半段静音
    for (let i = 0; i < 22050; i++) audio[i] = 0;
    // 后半段有信号
    for (let i = 22050; i < 44100; i++) audio[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / 44100);
    const onsets = computeAudioOnsets(audio, 44100);
    expect(Array.isArray(onsets)).toBe(true);
    // 至少应检测到一些 onset 或者全部在合理范围内
    for (const t of onsets) {
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(1);
    }
  });
});

// ==================== mergeNearbyCuts ====================

describe('mergeNearbyCuts', () => {
  it('should return empty array for empty input', () => {
    expect(mergeNearbyCuts([], 1)).toEqual([]);
  });

  it('should keep all suggestions when gaps are large enough', () => {
    const suggestions = [
      makeSuggestion({ startTime: 0, priority: 5, confidence: 0.8 }),
      makeSuggestion({ startTime: 5, priority: 5, confidence: 0.8 }),
      makeSuggestion({ startTime: 10, priority: 5, confidence: 0.8 }),
    ];
    const merged = mergeNearbyCuts(suggestions, 1);
    expect(merged.length).toBe(3);
  });

  it('should merge nearby suggestions keeping higher priority', () => {
    const suggestions = [
      makeSuggestion({ id: 'a', startTime: 1.0, priority: 3, confidence: 0.5 }),
      makeSuggestion({ id: 'b', startTime: 1.2, priority: 8, confidence: 0.9 }),
    ];
    const merged = mergeNearbyCuts(suggestions, 2);
    expect(merged.length).toBe(1);
    expect(merged[0].id).toBe('b');
  });

  it('should keep the one with higher confidence when priorities are equal', () => {
    const suggestions = [
      makeSuggestion({ id: 'low', startTime: 1.0, priority: 5, confidence: 0.4 }),
      makeSuggestion({ id: 'high', startTime: 1.1, priority: 5, confidence: 0.9 }),
    ];
    const merged = mergeNearbyCuts(suggestions, 2);
    expect(merged.length).toBe(1);
    expect(merged[0].id).toBe('high');
  });

  it('should handle minGap of 0', () => {
    const suggestions = [
      makeSuggestion({ startTime: 1.0 }),
      makeSuggestion({ startTime: 1.0 }),
    ];
    const merged = mergeNearbyCuts(suggestions, 0);
    expect(merged.length).toBe(2);
  });
});

// ==================== scoreSuggestionQuality ====================

describe('scoreSuggestionQuality', () => {
  it('should return a score between 0 and 1', () => {
    const suggestion = makeSuggestion();
    const context = makeAnalysis();
    const score = scoreSuggestionQuality(suggestion, context);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('should score higher for combined source analysis', () => {
    const context = makeAnalysis();
    const combined = makeSuggestion({ sourceAnalysis: 'combined' });
    const keyframe = makeSuggestion({ sourceAnalysis: 'keyframe' });
    const scoreCombined = scoreSuggestionQuality(combined, context);
    const scoreKeyframe = scoreSuggestionQuality(keyframe, context);
    expect(scoreCombined).toBeGreaterThanOrEqual(scoreKeyframe);
  });

  it('should return a valid score for empty context', () => {
    const emptyContext: ContentAnalysisResult = {
      scenes: [],
      emotionCurve: [],
      rhythmProfile: { bpm: 120, beatTimes: [], energyCurve: [], tempoChanges: [] },
      speakerSegments: [],
      keyFrames: [],
    };
    const suggestion = makeSuggestion();
    const score = scoreSuggestionQuality(suggestion, emptyContext);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

// ==================== filterAndRankSuggestions ====================

describe('filterAndRankSuggestions', () => {
  it('should return empty array for empty input', () => {
    expect(filterAndRankSuggestions([], 10)).toEqual([]);
  });

  it('should sort by priority descending', () => {
    const suggestions = [
      makeSuggestion({ id: 'low', priority: 2, confidence: 0.9 }),
      makeSuggestion({ id: 'high', priority: 9, confidence: 0.5 }),
      makeSuggestion({ id: 'mid', priority: 5, confidence: 0.7 }),
    ];
    const result = filterAndRankSuggestions(suggestions, 10);
    expect(result[0].id).toBe('high');
    expect(result[1].id).toBe('mid');
    expect(result[2].id).toBe('low');
  });

  it('should limit results to maxCount', () => {
    const suggestions = Array.from({ length: 10 }, (_, i) =>
      makeSuggestion({ id: `s${i}`, priority: i }),
    );
    const result = filterAndRankSuggestions(suggestions, 3);
    expect(result.length).toBe(3);
  });

  it('should sort by confidence when priorities are equal', () => {
    const suggestions = [
      makeSuggestion({ id: 'a', priority: 5, confidence: 0.4 }),
      makeSuggestion({ id: 'b', priority: 5, confidence: 0.9 }),
    ];
    const result = filterAndRankSuggestions(suggestions, 10);
    expect(result[0].id).toBe('b');
  });
});

// ==================== buildAssistEditingSystemPrompt ====================

describe('buildAssistEditingSystemPrompt', () => {
  it('should return a non-empty string', () => {
    const prompt = buildAssistEditingSystemPrompt();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('should contain key terms about video editing', () => {
    const prompt = buildAssistEditingSystemPrompt();
    expect(prompt).toContain('剪辑');
    expect(prompt).toContain('JSON');
  });
});

// ==================== parseAssistEditingResponse ====================

describe('parseAssistEditingResponse', () => {
  it('should throw for null input', () => {
    expect(() => parseAssistEditingResponse(null)).toThrow();
  });

  it('should throw for undefined input', () => {
    expect(() => parseAssistEditingResponse(undefined)).toThrow();
  });

  it('should throw for non-object input', () => {
    expect(() => parseAssistEditingResponse('string')).toThrow();
  });

  it('should throw when suggestions is missing', () => {
    expect(() => parseAssistEditingResponse({})).toThrow('suggestions');
  });

  it('should parse a valid response with suggestions', () => {
    const input = {
      suggestions: [
        {
          startTime: 1,
          endTime: 3,
          cutType: 'hard-cut',
          confidence: 0.85,
          reason: '场景切换',
          suggestedTransition: 'none',
          priority: 7,
        },
      ],
    };
    const result = parseAssistEditingResponse(input);
    expect(result.suggestions.length).toBe(1);
    expect(result.suggestions[0].cutType).toBe('hard-cut');
    expect(result.totalEstimatedDuration).toBe(2);
  });

  it('should skip suggestions with missing required fields', () => {
    const input = {
      suggestions: [
        { startTime: 1 }, // missing endTime, cutType, confidence
        {
          startTime: 5,
          endTime: 8,
          cutType: 'hard-cut',
          confidence: 0.7,
          reason: 'ok',
          priority: 5,
        },
      ],
    };
    const result = parseAssistEditingResponse(input);
    expect(result.suggestions.length).toBe(1);
  });

  it('should skip suggestions where endTime <= startTime', () => {
    const input = {
      suggestions: [
        {
          startTime: 5,
          endTime: 3,
          cutType: 'hard-cut',
          confidence: 0.8,
          reason: 'backwards',
          priority: 5,
        },
      ],
    };
    const result = parseAssistEditingResponse(input);
    expect(result.suggestions.length).toBe(0);
  });

  it('should clamp confidence to 0-1', () => {
    const input = {
      suggestions: [
        {
          startTime: 1,
          endTime: 3,
          cutType: 'hard-cut',
          confidence: 1.5,
          reason: 'test',
          priority: 5,
        },
      ],
    };
    const result = parseAssistEditingResponse(input);
    expect(result.suggestions[0].confidence).toBeLessThanOrEqual(1);
  });
});

// ==================== parseAssistEditingResponseSafe ====================

describe('parseAssistEditingResponseSafe', () => {
  it('should return data on valid input', async () => {
    const input = {
      suggestions: [
        {
          startTime: 1,
          endTime: 3,
          cutType: 'hard-cut',
          confidence: 0.85,
          reason: 'test',
          priority: 5,
        },
      ],
    };
    const result = await parseAssistEditingResponseSafe(input);
    expect(result.error).toBeNull();
    expect(result.data.suggestions.length).toBe(1);
  });

  it('should return error on null input', async () => {
    const result = await parseAssistEditingResponseSafe(null);
    expect(result.error).not.toBeNull();
    expect(result.data.suggestions).toEqual([]);
  });

  it('should return error on invalid JSON structure', async () => {
    const result = await parseAssistEditingResponseSafe('not an object');
    expect(result.error).not.toBeNull();
  });

  it('should return error when suggestions is not an array', async () => {
    const result = await parseAssistEditingResponseSafe({ suggestions: 'bad' });
    expect(result.error).not.toBeNull();
  });
});
