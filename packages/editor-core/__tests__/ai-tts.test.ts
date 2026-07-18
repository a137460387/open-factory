import { describe, it, expect } from 'vitest';
import {
  detectTTSLanguage,
  getAvailableVoices,
  getVoicesByLanguage,
  getVoicesByGender,
  getVoiceById,
  recommendVoice,
  preprocessText,
  segmentText,
  calculateTextStats,
  normalizeTTSParams,
  adjustDurationBySpeed,
  adjustTimingsBySpeed,
  alignToTimeline,
  mergeSynthesisResults,
  applyVolume,
  applyFadeInOut,
  generateSilence,
  pcmToWav,
  validateTTSParams,
} from '../src/ai/tts';
import type { TTSSynthesisResult, WordTiming } from '../src/ai/tts';

describe('TTS (Text-to-Speech)', () => {
  // -- 语言检测测试 --
  describe('Language Detection', () => {
    it('detectTTSLanguage 应该检测中文', () => {
      expect(detectTTSLanguage('你好世界')).toBe('zh');
      expect(detectTTSLanguage('这是一段中文文本')).toBe('zh');
    });

    it('detectTTSLanguage 应该检测英文', () => {
      expect(detectTTSLanguage('Hello world')).toBe('en');
      expect(detectTTSLanguage('This is English text')).toBe('en');
    });

    it('detectTTSLanguage 应该检测日文', () => {
      expect(detectTTSLanguage('こんにちは')).toBe('ja');
      expect(detectTTSLanguage('これは日本語です')).toBe('ja');
    });

    it('detectTTSLanguage 应该检测韩文', () => {
      expect(detectTTSLanguage('안녕하세요')).toBe('ko');
      expect(detectTTSLanguage('한국어 텍스트')).toBe('ko');
    });

    it('detectTTSLanguage 应该处理混合文本', () => {
      // 主要是中文
      expect(detectTTSLanguage('这是中文包含English的文本')).toBe('zh');
    });

    it('detectTTSLanguage 应该处理空文本', () => {
      expect(detectTTSLanguage('')).toBe('auto');
      expect(detectTTSLanguage('   ')).toBe('auto');
    });
  });

  // -- 语音管理测试 --
  describe('Voice Management', () => {
    it('getAvailableVoices 应该返回所有语音', () => {
      const voices = getAvailableVoices();
      expect(voices.length).toBeGreaterThan(0);
      expect(voices.every(v => v.id && v.name)).toBe(true);
    });

    it('getVoicesByLanguage 应该按语言筛选', () => {
      const zhVoices = getVoicesByLanguage('zh');
      expect(zhVoices.every(v => v.language === 'zh')).toBe(true);

      const enVoices = getVoicesByLanguage('en');
      expect(enVoices.every(v => v.language === 'en')).toBe(true);
    });

    it('getVoicesByLanguage auto 应该返回所有语音', () => {
      const allVoices = getVoicesByLanguage('auto');
      expect(allVoices.length).toBe(getAvailableVoices().length);
    });

    it('getVoicesByGender 应该按性别筛选', () => {
      const femaleVoices = getVoicesByGender('female');
      expect(femaleVoices.every(v => v.gender === 'female')).toBe(true);

      const maleVoices = getVoicesByGender('male');
      expect(maleVoices.every(v => v.gender === 'male')).toBe(true);
    });

    it('getVoiceById 应该根据ID查找语音', () => {
      const voice = getVoiceById('vits-zh-female-1');
      expect(voice).toBeDefined();
      expect(voice?.id).toBe('vits-zh-female-1');
      expect(voice?.language).toBe('zh');
    });

    it('getVoiceById 应该返回undefined对于不存在的ID', () => {
      expect(getVoiceById('non-existent-voice')).toBeUndefined();
    });

    it('recommendVoice 应该推荐匹配语言的语音', () => {
      const voice = recommendVoice('你好世界');
      expect(voice).toBeDefined();
      expect(voice?.language).toBe('zh');
    });

    it('recommendVoice 应该考虑性别偏好', () => {
      const voice = recommendVoice('你好世界', 'male');
      expect(voice).toBeDefined();
      expect(voice?.gender).toBe('male');
    });

    it('recommendVoice 应该处理英文文本', () => {
      const voice = recommendVoice('Hello world');
      expect(voice).toBeDefined();
      expect(voice?.language).toBe('en');
    });
  });

  // -- 文本处理测试 --
  describe('Text Processing', () => {
    it('preprocessText 应该规范化标点', () => {
      const input = '你好，世界！';
      const output = preprocessText(input);
      expect(output).toContain(',');
      expect(output).toContain('!');
    });

    it('preprocessText 应该移除多余空白', () => {
      const input = '  你好   世界  ';
      const output = preprocessText(input);
      expect(output).toBe('你好 世界');
    });

    it('preprocessText 应该处理空文本', () => {
      expect(preprocessText('')).toBe('');
      expect(preprocessText('   ')).toBe('');
    });

    it('segmentText 应该不分割短文本', () => {
      const text = '这是一段短文本';
      const segments = segmentText(text, 100);
      expect(segments).toHaveLength(1);
      expect(segments[0]).toBe(preprocessText(text));
    });

    it('segmentText 应该在句号处分割', () => {
      const text = '第一句话。第二句话。第三句话。';
      const segments = segmentText(text, 10);
      expect(segments.length).toBeGreaterThan(1);
      expect(segments.join('')).toContain('第一句话');
    });

    it('segmentText 应该处理空文本', () => {
      expect(segmentText('')).toEqual([]);
    });

    it('calculateTextStats 应该计算正确的统计信息', () => {
      const text = '你好世界。这是测试。';
      const stats = calculateTextStats(text);

      expect(stats.charCount).toBe(text.length);
      expect(stats.language).toBe('zh');
      expect(stats.sentenceCount).toBe(2);
      expect(stats.estimatedDurationMs).toBeGreaterThan(0);
    });

    it('calculateTextStats 应该处理英文文本', () => {
      const text = 'Hello world. This is a test.';
      const stats = calculateTextStats(text);

      expect(stats.language).toBe('en');
      expect(stats.wordCount).toBe(6);
      expect(stats.sentenceCount).toBe(2);
    });

    it('calculateTextStats 应该处理空文本', () => {
      const stats = calculateTextStats('');
      expect(stats.charCount).toBe(0);
      expect(stats.wordCount).toBe(0);
      expect(stats.sentenceCount).toBe(0);
      expect(stats.estimatedDurationMs).toBe(0);
    });
  });

  // -- 参数规范化测试 --
  describe('Parameter Normalization', () => {
    it('normalizeTTSParams 应该设置默认值', () => {
      const params = normalizeTTSParams({
        text: '测试',
        voiceId: 'vits-zh-female-1',
      });

      expect(params.speed).toBe(1.0);
      expect(params.pitch).toBe(1.0);
      expect(params.volume).toBe(1.0);
      expect(params.styleIntensity).toBe(0.5);
    });

    it('normalizeTTSParams 应该限制参数范围', () => {
      const params = normalizeTTSParams({
        text: '测试',
        voiceId: 'vits-zh-female-1',
        speed: 3.0,  // 超过最大值
        pitch: 0.1,  // 低于最小值
        volume: 1.5, // 超过最大值
      });

      expect(params.speed).toBe(2.0);
      expect(params.pitch).toBe(0.5);
      expect(params.volume).toBe(1.0);
    });

    it('normalizeTTSParams 应该预处理文本', () => {
      const params = normalizeTTSParams({
        text: '  测试  文本  ',
        voiceId: 'vits-zh-female-1',
      });

      expect(params.text).toBe('测试 文本');
    });
  });

  // -- 时长调整测试 --
  describe('Duration Adjustment', () => {
    it('adjustDurationBySpeed 应该根据语速调整时长', () => {
      expect(adjustDurationBySpeed(1000, 1.0)).toBe(1000);
      expect(adjustDurationBySpeed(1000, 2.0)).toBe(500);
      expect(adjustDurationBySpeed(1000, 0.5)).toBe(2000);
    });

    it('adjustDurationBySpeed 应该限制语速范围', () => {
      expect(adjustDurationBySpeed(1000, 3.0)).toBe(500); // 限制到2.0
      expect(adjustDurationBySpeed(1000, 0.1)).toBe(2000); // 限制到0.5
    });

    it('adjustTimingsBySpeed 应该调整时间映射', () => {
      const timings: WordTiming[] = [
        { text: '你好', startMs: 0, endMs: 500, confidence: 0.9 },
        { text: '世界', startMs: 500, endMs: 1000, confidence: 0.9 },
      ];

      const adjusted = adjustTimingsBySpeed(timings, 2.0);

      expect(adjusted[0].startMs).toBe(0);
      expect(adjusted[0].endMs).toBe(250);
      expect(adjusted[1].startMs).toBe(250);
      expect(adjusted[1].endMs).toBe(500);
    });
  });

  // -- 时间线对齐测试 --
  describe('Timeline Alignment', () => {
    const createMockResult = (durationMs: number): TTSSynthesisResult => ({
      audioData: new Float32Array(0),
      sampleRate: 22050,
      durationMs,
      format: 'pcm',
      stats: {
        processingTimeMs: 100,
        realTimeFactor: 0.1,
        charCount: 10,
        wordCount: 2,
      },
    });

    it('alignToTimeline 应该在自然模式下对齐', () => {
      const segments = ['你好', '世界'];
      const results = [createMockResult(1000), createMockResult(1500)];

      const alignment = alignToTimeline(segments, results, { mode: 'natural' });

      expect(alignment.segments).toHaveLength(2);
      expect(alignment.segments[0].startMs).toBe(0);
      expect(alignment.segments[0].endMs).toBe(1000);
      expect(alignment.segments[1].startMs).toBe(1000);
      expect(alignment.segments[1].endMs).toBe(2500);
      expect(alignment.totalDurationMs).toBe(2500);
    });

    it('alignToTimeline 应该在固定间隔模式下对齐', () => {
      const segments = ['你好', '世界'];
      const results = [createMockResult(1000), createMockResult(1500)];

      const alignment = alignToTimeline(segments, results, {
        mode: 'fixed',
        fixedGapMs: 200,
      });

      expect(alignment.segments[0].endMs).toBe(1000);
      expect(alignment.segments[1].startMs).toBe(1200); // 1000 + 200
    });

    it('alignToTimeline 应该处理空输入', () => {
      const alignment = alignToTimeline([], [], { mode: 'natural' });

      expect(alignment.segments).toEqual([]);
      expect(alignment.totalDurationMs).toBe(0);
      expect(alignment.averageSpeed).toBe(1.0);
    });
  });

  // -- 结果合并测试 --
  describe('Result Merging', () => {
    it('mergeSynthesisResults 应该合并多个结果', () => {
      const results: TTSSynthesisResult[] = [
        {
          audioData: new Float32Array([0.1, 0.2, 0.3]),
          sampleRate: 22050,
          durationMs: 100,
          format: 'pcm',
          wordTimings: [{ text: '你好', startMs: 0, endMs: 100, confidence: 0.9 }],
          stats: { processingTimeMs: 50, realTimeFactor: 0.5, charCount: 2, wordCount: 1 },
        },
        {
          audioData: new Float32Array([0.4, 0.5, 0.6]),
          sampleRate: 22050,
          durationMs: 100,
          format: 'pcm',
          wordTimings: [{ text: '世界', startMs: 0, endMs: 100, confidence: 0.9 }],
          stats: { processingTimeMs: 50, realTimeFactor: 0.5, charCount: 2, wordCount: 1 },
        },
      ];

      const merged = mergeSynthesisResults(results, 100);

      expect(merged.audioData.length).toBeGreaterThan(0);
      expect(merged.sampleRate).toBe(22050);
      expect(merged.wordTimings).toHaveLength(2);
      // 第二个结果的时间应该有偏移
      expect(merged.wordTimings[1].startMs).toBeGreaterThan(0);
    });

    it('mergeSynthesisResults 应该处理空输入', () => {
      const merged = mergeSynthesisResults([]);

      expect(merged.audioData.length).toBe(0);
      expect(merged.totalDurationMs).toBe(0);
      expect(merged.wordTimings).toEqual([]);
    });
  });

  // -- 音频处理测试 --
  describe('Audio Processing', () => {
    it('applyVolume 应该调整音量', () => {
      const audio = new Float32Array([0.5, -0.5, 0.8, -0.8]);
      const adjusted = applyVolume(audio, 0.5);

      expect(adjusted[0]).toBeCloseTo(0.25, 5);
      expect(adjusted[1]).toBeCloseTo(-0.25, 5);
      expect(adjusted[2]).toBeCloseTo(0.4, 5);
      expect(adjusted[3]).toBeCloseTo(-0.4, 5);
    });

    it('applyVolume 应该限制音量范围', () => {
      const audio = new Float32Array([0.5]);
      const adjusted = applyVolume(audio, 2.0); // 超过最大值
      expect(adjusted[0]).toBeCloseTo(0.5, 5); // 限制到1.0
    });

    it('applyFadeInOut 应该应用淡入淡出', () => {
      const audio = new Float32Array(100).fill(1.0);
      const sampleRate = 100; // 100样本/秒
      const faded = applyFadeInOut(audio, sampleRate, 10, 10);

      // 淡入区域应该小于1
      expect(faded[0]).toBeLessThan(1.0);
      expect(faded[9]).toBeCloseTo(1.0, 1);

      // 淡出区域应该小于1
      expect(faded[99]).toBeLessThan(1.0);
      expect(faded[90]).toBeCloseTo(1.0, 1);
    });

    it('generateSilence 应该生成静音', () => {
      const silence = generateSilence(22050, 1000); // 1秒

      expect(silence.length).toBe(22050);
      expect(silence.every(s => s === 0)).toBe(true);
    });

    it('pcmToWav 应该生成有效的WAV头', () => {
      const pcm = new Float32Array([0.5, -0.5]);
      const wav = pcmToWav(pcm, 22050);
      const view = new DataView(wav);

      // 检查RIFF头
      const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
      expect(riff).toBe('RIFF');

      // 检查WAVE标记
      const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
      expect(wave).toBe('WAVE');

      // 检查fmt标记
      const fmt = String.fromCharCode(view.getUint8(12), view.getUint8(13), view.getUint8(14), view.getUint8(15));
      expect(fmt).toBe('fmt ');
    });
  });

  // -- 验证测试 --
  describe('Validation', () => {
    it('validateTTSParams 应该检测空文本', () => {
      const issues = validateTTSParams({
        text: '',
        voiceId: 'vits-zh-female-1',
      });

      expect(issues.some(i => i.type === 'empty-text')).toBe(true);
    });

    it('validateTTSParams 应该检测文本过长', () => {
      const longText = 'a'.repeat(6000);
      const issues = validateTTSParams({
        text: longText,
        voiceId: 'vits-zh-female-1',
      });

      expect(issues.some(i => i.type === 'text-too-long')).toBe(true);
    });

    it('validateTTSParams 应该检测无效参数', () => {
      const issues = validateTTSParams({
        text: '测试',
        voiceId: 'vits-zh-female-1',
        speed: 3.0,
        pitch: 0.1,
        volume: 1.5,
      });

      expect(issues.some(i => i.type === 'invalid-params')).toBe(true);
    });

    it('validateTTSParams 应该检测不存在的语音', () => {
      const issues = validateTTSParams({
        text: '测试',
        voiceId: 'non-existent-voice',
      });

      expect(issues.some(i => i.type === 'voice-not-found')).toBe(true);
    });

    it('validateTTSParams 应该通过有效参数', () => {
      const issues = validateTTSParams({
        text: '测试文本',
        voiceId: 'vits-zh-female-1',
        speed: 1.0,
        pitch: 1.0,
        volume: 1.0,
      });

      expect(issues).toEqual([]);
    });
  });
});
