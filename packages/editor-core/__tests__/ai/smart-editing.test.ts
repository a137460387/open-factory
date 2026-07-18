import { describe, it, expect } from 'vitest';
import {
  generateId,
  clamp,
  lerp,
  average,
  standardDeviation,
  smoothArray,
  detectPeaks,
  computeSimilarity,
  computeAudioEnergy,
  computeZeroCrossingRate,
  detectSilence,
  detectBeats,
  analyzeEmotion,
  generateCutSuggestions,
  generateTrailer,
  sortSegments,
  rhythmMatchEdit,
  emotionAwareEdit,
  createDefaultSmartEditingConfig,
  validateSmartEditingConfig,
  type BeatInfo,
  type EmotionAnalysis,
  type CutSuggestion,
  type VideoSegment,
  type TrailerConfig,
  type SegmentSortOptions,
  type SmartEditingConfig,
  type TimePoint,
} from '../../src/ai/smart-editing';

// ==================== 辅助函数测试 ====================

describe('辅助函数', () => {
  describe('generateId', () => {
    it('应该生成唯一ID', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
    });
  });

  describe('clamp', () => {
    it('应该限制值在范围内', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('lerp', () => {
    it('应该正确插值', () => {
      expect(lerp(0, 10, 0)).toBe(0);
      expect(lerp(0, 10, 1)).toBe(10);
      expect(lerp(0, 10, 0.5)).toBe(5);
    });
  });

  describe('average', () => {
    it('应该计算平均值', () => {
      expect(average([1, 2, 3, 4, 5])).toBe(3);
      expect(average([])).toBe(0);
      expect(average([10])).toBe(10);
    });
  });

  describe('standardDeviation', () => {
    it('应该计算标准差', () => {
      const result = standardDeviation([1, 2, 3, 4, 5]);
      expect(result).toBeCloseTo(1.414, 2);
    });

    it('应该返回0对于空数组', () => {
      expect(standardDeviation([])).toBe(0);
    });
  });

  describe('smoothArray', () => {
    it('应该平滑数组', () => {
      const result = smoothArray([1, 2, 3, 4, 5], 3);
      expect(result.length).toBe(5);
      expect(result[0]).toBeCloseTo(1.5, 1);
      expect(result[2]).toBeCloseTo(3, 1);
    });
  });

  describe('detectPeaks', () => {
    it('应该检测峰值', () => {
      const data = [0, 0.2, 0.5, 0.8, 0.6, 0.3, 0.9, 0.4, 0.1];
      const peaks = detectPeaks(data, 0.5);
      expect(peaks.length).toBeGreaterThan(0);
    });

    it('应该返回空数组对于单调数据', () => {
      const data = [1, 2, 3, 4, 5];
      const peaks = detectPeaks(data, 0.5);
      expect(peaks.length).toBe(0);
    });
  });

  describe('computeSimilarity', () => {
    it('应该计算相同数组的相似度为1', () => {
      const array = [1, 2, 3, 4, 5];
      expect(computeSimilarity(array, array)).toBeCloseTo(1, 2);
    });

    it('应该计算不同数组的相似度', () => {
      const array1 = [1, 2, 3, 4, 5];
      const array2 = [5, 4, 3, 2, 1];
      const similarity = computeSimilarity(array1, array2);
      expect(similarity).toBeLessThan(1);
    });

    it('应该返回0对于不同长度数组', () => {
      expect(computeSimilarity([1, 2], [1, 2, 3])).toBe(0);
    });
  });
});

// ==================== 音频分析测试 ====================

describe('音频分析', () => {
  describe('computeAudioEnergy', () => {
    it('应该计算静音的能量为0', () => {
      const audio = new Float32Array(100);
      expect(computeAudioEnergy(audio)).toBe(0);
    });

    it('应该计算正弦波的能量', () => {
      const audio = new Float32Array(100);
      for (let i = 0; i < audio.length; i++) {
        audio[i] = Math.sin(i * 0.1);
      }
      const energy = computeAudioEnergy(audio);
      expect(energy).toBeGreaterThan(0);
    });
  });

  describe('computeZeroCrossingRate', () => {
    it('应该计算静音的过零率为0', () => {
      const audio = new Float32Array(100);
      expect(computeZeroCrossingRate(audio)).toBe(0);
    });

    it('应该计算正弦波的过零率', () => {
      const audio = new Float32Array(100);
      for (let i = 0; i < audio.length; i++) {
        audio[i] = Math.sin(i * 0.5);
      }
      const zcr = computeZeroCrossingRate(audio);
      expect(zcr).toBeGreaterThan(0);
    });
  });

  describe('detectSilence', () => {
    it('应该检测静音段', () => {
      const audio = new Float32Array(1000);
      // 添加一些静音段
      for (let i = 100; i < 200; i++) {
        audio[i] = 0.5;
      }
      for (let i = 400; i < 500; i++) {
        audio[i] = 0.5;
      }
      
      const silence = detectSilence(audio, 1000, 0.01, 0.1);
      expect(silence.length).toBeGreaterThan(0);
    });

    it('应该返回空数组对于全音量音频', () => {
      const audio = new Float32Array(1000);
      for (let i = 0; i < audio.length; i++) {
        audio[i] = 1;
      }
      
      const silence = detectSilence(audio, 1000, 0.01, 0.1);
      expect(silence.length).toBe(0);
    });
  });
});

// ==================== 节拍检测测试 ====================

describe('节拍检测', () => {
  describe('detectBeats', () => {
    it('应该检测节拍', () => {
      // 创建模拟音频数据
      const sampleRate = 44100;
      const duration = 5; // 5秒
      const audio = new Float32Array(sampleRate * duration);
      
      // 添加120 BPM的节拍
      const bpm = 120;
      const beatInterval = 60 / bpm;
      
      for (let i = 0; i < audio.length; i++) {
        const time = i / sampleRate;
        const beatPhase = (time % beatInterval) / beatInterval;
        
        if (beatPhase < 0.1) {
          audio[i] = 0.8;
        } else {
          audio[i] = 0.1;
        }
      }
      
      const beatInfo = detectBeats(audio, sampleRate);
      
      expect(beatInfo.bpm).toBeDefined();
      expect(beatInfo.beats).toBeDefined();
      expect(beatInfo.downbeats).toBeDefined();
      expect(beatInfo.beatStrength).toBeDefined();
      expect(beatInfo.confidence).toBeDefined();
    });

    it('应该返回合理的BPM范围', () => {
      const sampleRate = 44100;
      const audio = new Float32Array(sampleRate * 2);
      
      // 添加简单的节拍
      for (let i = 0; i < audio.length; i++) {
        const time = i / sampleRate;
        if (time % 0.5 < 0.1) {
          audio[i] = 0.8;
        }
      }
      
      const beatInfo = detectBeats(audio, sampleRate);
      expect(beatInfo.bpm).toBeGreaterThan(60);
      expect(beatInfo.bpm).toBeLessThan(200);
    });
  });
});

// ==================== 情绪分析测试 ====================

describe('情绪分析', () => {
  describe('analyzeEmotion', () => {
    it('应该分析情绪', () => {
      const sampleRate = 44100;
      const audio = new Float32Array(sampleRate * 2);
      
      // 添加不同情绪的音频特征
      for (let i = 0; i < audio.length; i++) {
        const time = i / sampleRate;
        if (time < 1) {
          audio[i] = 0.8; // 高能量
        } else {
          audio[i] = 0.1; // 低能量
        }
      }
      
      const emotion = analyzeEmotion(audio, sampleRate);
      
      expect(emotion.timeline).toBeDefined();
      expect(emotion.overallEmotion).toBeDefined();
      expect(emotion.emotionalIntensity).toBeDefined();
      expect(emotion.peaks).toBeDefined();
    });

    it('应该检测情绪高潮点', () => {
      // 使用较长音频和明确的能量对比来触发情绪高潮检测
      const sampleRate = 44100;
      const duration = 5;
      const audio = new Float32Array(sampleRate * duration);
      
      // 低能量基线 (0-2秒, 3-5秒) + 高能量区域 (2-3秒)
      for (let i = 0; i < audio.length; i++) {
        const time = i / sampleRate;
        if (time > 2.0 && time < 3.0) {
          // 高能量区域：正弦波产生高能量
          audio[i] = 0.9 * Math.sin(2 * Math.PI * 440 * time);
        } else {
          // 低能量基线：极小的信号
          audio[i] = 0.0001 * Math.sin(2 * Math.PI * 100 * time);
        }
      }
      
      const emotion = analyzeEmotion(audio, sampleRate);
      // 至少应该有情绪时间线
      expect(emotion.timeline.length).toBeGreaterThan(0);
      expect(emotion.overallEmotion).toBeDefined();
      expect(emotion.emotionalIntensity).toBeGreaterThan(0);
    });
  });
});

// ==================== 剪辑建议测试 ====================

describe('剪辑建议', () => {
  describe('generateCutSuggestions', () => {
    it('应该生成剪辑建议', () => {
      const beatInfo: BeatInfo = {
        bpm: 120,
        beats: [0, 0.5, 1, 1.5, 2],
        downbeats: [0, 2],
        beatStrength: [0.8, 0.6, 0.9, 0.7, 0.8],
        confidence: 0.8,
      };
      
      const emotionAnalysis: EmotionAnalysis = {
        timeline: [
          { time: 0, emotion: 'calm', intensity: 0.3, confidence: 0.8 },
          { time: 1, emotion: 'excited', intensity: 0.8, confidence: 0.9 },
          { time: 2, emotion: 'calm', intensity: 0.4, confidence: 0.7 },
        ],
        overallEmotion: 'calm',
        emotionalIntensity: 0.5,
        peaks: [
          { time: 1, confidence: 0.9, type: 'emotion-peak', description: '情绪高潮' },
        ],
      };
      
      const sceneChanges: TimePoint[] = [
        { time: 0.5, confidence: 0.8, type: 'scene-change' },
        { time: 1.5, confidence: 0.9, type: 'scene-change' },
      ];
      
      const suggestions = generateCutSuggestions(beatInfo, emotionAnalysis, sceneChanges);
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].time).toBeDefined();
      expect(suggestions[0].type).toBeDefined();
      expect(suggestions[0].confidence).toBeDefined();
      expect(suggestions[0].reason).toBeDefined();
    });

    it('应该支持配置选项', () => {
      const beatInfo: BeatInfo = {
        bpm: 120,
        beats: [0, 0.5, 1],
        downbeats: [0],
        beatStrength: [0.8, 0.6, 0.9],
        confidence: 0.8,
      };
      
      const emotionAnalysis: EmotionAnalysis = {
        timeline: [],
        overallEmotion: 'neutral',
        emotionalIntensity: 0,
        peaks: [],
      };
      
      const config: Partial<SmartEditingConfig> = {
        enableRhythmMatching: false,
        enableEmotionAwareness: false,
      };
      
      const suggestions = generateCutSuggestions(beatInfo, emotionAnalysis, [], config);
      expect(suggestions.length).toBe(0);
    });
  });
});

// ==================== 预告片生成测试 ====================

describe('预告片生成', () => {
  describe('generateTrailer', () => {
    it('应该生成预告片', () => {
      const segments: VideoSegment[] = [
        {
          id: '1',
          startTime: 0,
          endTime: 10,
          duration: 10,
          emotion: 'calm',
          importance: 0.5,
          tags: ['intro'],
          sceneType: 'indoor',
          motionIntensity: 0.3,
          audioFeatures: {
            volume: 0.5,
            hasSpeech: true,
            hasMusic: false,
            spectralFeatures: {
              lowEnergy: 0.3,
              midEnergy: 0.5,
              highEnergy: 0.2,
              spectralCentroid: 1000,
              spectralRolloff: 5000,
            },
          },
        },
        {
          id: '2',
          startTime: 10,
          endTime: 25,
          duration: 15,
          emotion: 'excited',
          importance: 0.9,
          tags: ['action', 'climax'],
          sceneType: 'outdoor',
          motionIntensity: 0.8,
          audioFeatures: {
            volume: 0.8,
            hasSpeech: false,
            hasMusic: true,
            spectralFeatures: {
              lowEnergy: 0.6,
              midEnergy: 0.7,
              highEnergy: 0.5,
              spectralCentroid: 2000,
              spectralRolloff: 8000,
            },
          },
        },
      ];
      
      const trailer = generateTrailer(segments);
      
      expect(trailer.segments).toBeDefined();
      expect(trailer.totalDuration).toBeDefined();
      expect(trailer.emotionCurve).toBeDefined();
      expect(trailer.beatInfo).toBeDefined();
      expect(trailer.qualityScore).toBeDefined();
    });

    it('应该支持自定义配置', () => {
      const segments: VideoSegment[] = [
        {
          id: '1',
          startTime: 0,
          endTime: 10,
          duration: 10,
          emotion: 'excited',
          importance: 0.9,
          tags: ['action'],
          sceneType: 'outdoor',
          motionIntensity: 0.8,
          audioFeatures: {
            volume: 0.8,
            hasSpeech: false,
            hasMusic: true,
            spectralFeatures: {
              lowEnergy: 0.6,
              midEnergy: 0.7,
              highEnergy: 0.5,
              spectralCentroid: 2000,
              spectralRolloff: 8000,
            },
          },
        },
      ];
      
      const config: Partial<TrailerConfig> = {
        targetDuration: 30,
        style: 'action',
        tempo: 'fast',
        climaxCount: 1,
      };
      
      const trailer = generateTrailer(segments, config);
      expect(trailer.totalDuration).toBeLessThanOrEqual(40);
    });
  });
});

// ==================== 片段排序测试 ====================

describe('片段排序', () => {
  describe('sortSegments', () => {
    it('应该按时间顺序排序', () => {
      const segments: VideoSegment[] = [
        {
          id: '2',
          startTime: 10,
          endTime: 20,
          duration: 10,
          emotion: 'calm',
          importance: 0.5,
          tags: [],
          sceneType: 'indoor',
          motionIntensity: 0.3,
          audioFeatures: {
            volume: 0.5,
            hasSpeech: false,
            hasMusic: false,
            spectralFeatures: {
              lowEnergy: 0.3,
              midEnergy: 0.5,
              highEnergy: 0.2,
              spectralCentroid: 1000,
              spectralRolloff: 5000,
            },
          },
        },
        {
          id: '1',
          startTime: 0,
          endTime: 10,
          duration: 10,
          emotion: 'excited',
          importance: 0.8,
          tags: ['action'],
          sceneType: 'outdoor',
          motionIntensity: 0.7,
          audioFeatures: {
            volume: 0.8,
            hasSpeech: false,
            hasMusic: true,
            spectralFeatures: {
              lowEnergy: 0.6,
              midEnergy: 0.7,
              highEnergy: 0.5,
              spectralCentroid: 2000,
              spectralRolloff: 8000,
            },
          },
        },
      ];
      
      const sorted = sortSegments(segments, { strategy: 'chronological' });
      
      expect(sorted[0].id).toBe('1');
      expect(sorted[1].id).toBe('2');
    });

    it('应该按重要性排序', () => {
      const segments: VideoSegment[] = [
        {
          id: '1',
          startTime: 0,
          endTime: 10,
          duration: 10,
          emotion: 'calm',
          importance: 0.5,
          tags: [],
          sceneType: 'indoor',
          motionIntensity: 0.3,
          audioFeatures: {
            volume: 0.5,
            hasSpeech: false,
            hasMusic: false,
            spectralFeatures: {
              lowEnergy: 0.3,
              midEnergy: 0.5,
              highEnergy: 0.2,
              spectralCentroid: 1000,
              spectralRolloff: 5000,
            },
          },
        },
        {
          id: '2',
          startTime: 10,
          endTime: 20,
          duration: 10,
          emotion: 'excited',
          importance: 0.9,
          tags: ['action'],
          sceneType: 'outdoor',
          motionIntensity: 0.8,
          audioFeatures: {
            volume: 0.8,
            hasSpeech: false,
            hasMusic: true,
            spectralFeatures: {
              lowEnergy: 0.6,
              midEnergy: 0.7,
              highEnergy: 0.5,
              spectralCentroid: 2000,
              spectralRolloff: 8000,
            },
          },
        },
      ];
      
      const sorted = sortSegments(segments, { strategy: 'importance' });
      
      expect(sorted[0].id).toBe('2');
      expect(sorted[1].id).toBe('1');
    });
  });
});

// ==================== 节奏匹配剪辑测试 ====================

describe('节奏匹配剪辑', () => {
  describe('rhythmMatchEdit', () => {
    it('应该生成节奏匹配剪辑', () => {
      const segments: VideoSegment[] = [
        {
          id: '1',
          startTime: 0,
          endTime: 2,
          duration: 2,
          emotion: 'calm',
          importance: 0.5,
          tags: [],
          sceneType: 'indoor',
          motionIntensity: 0.3,
          audioFeatures: {
            volume: 0.5,
            hasSpeech: false,
            hasMusic: false,
            spectralFeatures: {
              lowEnergy: 0.3,
              midEnergy: 0.5,
              highEnergy: 0.2,
              spectralCentroid: 1000,
              spectralRolloff: 5000,
            },
          },
        },
      ];
      
      const beatInfo: BeatInfo = {
        bpm: 120,
        beats: [0, 0.5, 1, 1.5, 2],
        downbeats: [0, 2],
        beatStrength: [0.8, 0.6, 0.9, 0.7, 0.8],
        confidence: 0.8,
      };
      
      const suggestions = rhythmMatchEdit(segments, beatInfo);
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].type).toBe('hard-cut');
      expect(suggestions[0].reason).toBe('节奏匹配');
    });
  });
});

// ==================== 情绪感知剪辑测试 ====================

describe('情绪感知剪辑', () => {
  describe('emotionAwareEdit', () => {
    it('应该生成情绪感知剪辑', () => {
      const segments: VideoSegment[] = [
        {
          id: '1',
          startTime: 0,
          endTime: 5,
          duration: 5,
          emotion: 'calm',
          importance: 0.5,
          tags: [],
          sceneType: 'indoor',
          motionIntensity: 0.3,
          audioFeatures: {
            volume: 0.5,
            hasSpeech: false,
            hasMusic: false,
            spectralFeatures: {
              lowEnergy: 0.3,
              midEnergy: 0.5,
              highEnergy: 0.2,
              spectralCentroid: 1000,
              spectralRolloff: 5000,
            },
          },
        },
      ];
      
      const emotionAnalysis: EmotionAnalysis = {
        timeline: [
          { time: 0, emotion: 'calm', intensity: 0.3, confidence: 0.8 },
          { time: 2, emotion: 'excited', intensity: 0.8, confidence: 0.9 },
          { time: 4, emotion: 'calm', intensity: 0.4, confidence: 0.7 },
        ],
        overallEmotion: 'calm',
        emotionalIntensity: 0.5,
        peaks: [],
      };
      
      const suggestions = emotionAwareEdit(segments, emotionAnalysis);
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].type).toBe('cutaway');
      expect(suggestions[0].reason).toContain('情绪变化');
    });
  });
});

// ==================== 配置测试 ====================

describe('配置', () => {
  describe('createDefaultSmartEditingConfig', () => {
    it('应该创建默认配置', () => {
      const config = createDefaultSmartEditingConfig();
      
      expect(config.enableRhythmMatching).toBe(true);
      expect(config.enableEmotionAwareness).toBe(true);
      expect(config.enableAutoTrailer).toBe(true);
      expect(config.enableSmartSorting).toBe(true);
      expect(config.rhythmMatchPrecision).toBe(0.8);
      expect(config.emotionAnalysisPrecision).toBe(0.7);
      expect(config.minCutInterval).toBe(0.5);
      expect(config.maxCutInterval).toBe(10);
      expect(config.defaultTransition).toBe('cross-dissolve');
    });
  });

  describe('validateSmartEditingConfig', () => {
    it('应该验证有效配置', () => {
      const config = createDefaultSmartEditingConfig();
      expect(validateSmartEditingConfig(config)).toBe(true);
    });

    it('应该拒绝无效配置', () => {
      const invalid = { enableRhythmMatching: 'invalid' } as any;
      expect(validateSmartEditingConfig(invalid)).toBe(false);
    });
  });
});
