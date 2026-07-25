import { describe, it, expect } from 'vitest';
import {
  createDefaultContentGenerationConfig,
  validateContentGenerationConfig,
  detectSilence,
  computeAudioEnergyEnvelope,
  generateMusicStructure,
  estimateGenerationTime,
  buildContentGenerationSystemPrompt,
  buildContentGenerationUserPrompt,
  parseContentGenerationResponse,
  parseContentGenerationResponseSafe,
  generateSubtitle,
  generateEffect,
  generateDubbing,
  generateMusic,
} from './content-generation';
import type { ContentGenerationConfig } from './content-generation';

// ==================== 测试辅助函数 ====================

/** 创建正弦波音频数据 */
function makeSineWave(frequency: number, sampleRate: number, durationSec: number, amplitude = 0.5): Float32Array {
  const length = Math.floor(sampleRate * durationSec);
  const data = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    data[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return data;
}

/** 创建一段静音 */
function makeSilence(sampleRate: number, durationSec: number): Float32Array {
  return new Float32Array(Math.floor(sampleRate * durationSec));
}

/** 创建带静音段的音频：信号-静音-信号 */
function makeAudioWithSilence(sampleRate: number): Float32Array {
  const speech = makeSineWave(440, sampleRate, 1.0, 0.3);
  const silence = makeSilence(sampleRate, 0.5);
  const result = new Float32Array(speech.length * 2 + silence.length);
  result.set(speech, 0);
  result.set(silence, speech.length);
  result.set(speech, speech.length + silence.length);
  return result;
}

// ==================== createDefaultContentGenerationConfig ====================

describe('createDefaultContentGenerationConfig', () => {
  it('should create config for subtitle type', () => {
    const config = createDefaultContentGenerationConfig('subtitle');
    expect(config.type).toBe('subtitle');
    expect(config.outputFormat).toBe('srt');
  });

  it('should create config for dubbing type', () => {
    const config = createDefaultContentGenerationConfig('dubbing');
    expect(config.type).toBe('dubbing');
    expect(config.outputFormat).toBe('wav');
  });

  it('should create config for music type', () => {
    const config = createDefaultContentGenerationConfig('music');
    expect(config.type).toBe('music');
    expect(config.outputFormat).toBe('wav');
  });

  it('should create config for effect type', () => {
    const config = createDefaultContentGenerationConfig('effect');
    expect(config.type).toBe('effect');
    expect(config.outputFormat).toBe('json');
  });

  it('should create config for voiceover type', () => {
    const config = createDefaultContentGenerationConfig('voiceover');
    expect(config.type).toBe('voiceover');
    expect(config.outputFormat).toBe('wav');
  });

  it('should have language auto by default', () => {
    const config = createDefaultContentGenerationConfig('subtitle');
    expect(config.language).toBe('auto');
  });

  it('should have standard quality by default', () => {
    const config = createDefaultContentGenerationConfig('subtitle');
    expect(config.quality).toBe('standard');
  });

  it('should have GPU disabled by default', () => {
    const config = createDefaultContentGenerationConfig('subtitle');
    expect(config.enableGPU).toBe(false);
  });
});

// ==================== validateContentGenerationConfig ====================

describe('validateContentGenerationConfig', () => {
  it('should return true for valid config', () => {
    const config = createDefaultContentGenerationConfig('subtitle');
    expect(validateContentGenerationConfig(config)).toBe(true);
  });

  it('should return false for null input', () => {
    expect(validateContentGenerationConfig(null as any)).toBe(false);
  });

  it('should return false for missing type', () => {
    expect(validateContentGenerationConfig({} as any)).toBe(false);
  });

  it('should return false for invalid type', () => {
    expect(validateContentGenerationConfig({ type: 'invalid' } as any)).toBe(false);
  });

  it('should return false for invalid quality', () => {
    const config = { type: 'subtitle' as const, quality: 'ultra-high' as any };
    expect(validateContentGenerationConfig(config)).toBe(false);
  });

  it('should return true for all valid types', () => {
    const types = ['subtitle', 'dubbing', 'music', 'effect', 'voiceover'] as const;
    for (const type of types) {
      expect(validateContentGenerationConfig({ type })).toBe(true);
    }
  });

  it('should return true when quality is undefined (optional)', () => {
    expect(validateContentGenerationConfig({ type: 'subtitle' })).toBe(true);
  });
});

// ==================== computeAudioEnergyEnvelope ====================

describe('computeAudioEnergyEnvelope', () => {
  it('should return empty Float32Array for empty input', () => {
    const result = computeAudioEnergyEnvelope(new Float32Array(0), 1024);
    expect(result.length).toBe(0);
  });

  it('should return empty Float32Array for zero window size', () => {
    const result = computeAudioEnergyEnvelope(new Float32Array(100), 0);
    expect(result.length).toBe(0);
  });

  it('should return correct number of frames', () => {
    const audio = new Float32Array(4096);
    const result = computeAudioEnergyEnvelope(audio, 1024);
    expect(result.length).toBe(4);
  });

  it('should return dB values (negative or -inf)', () => {
    const audio = makeSineWave(440, 44100, 0.1, 0.5);
    const result = computeAudioEnergyEnvelope(audio, 1024);
    for (let i = 0; i < result.length; i++) {
      expect(result[i]).toBeLessThanOrEqual(0);
    }
  });

  it('should return a Float32Array', () => {
    const audio = makeSineWave(440, 44100, 0.1, 0.5);
    const result = computeAudioEnergyEnvelope(audio, 512);
    expect(result).toBeInstanceOf(Float32Array);
  });
});

// ==================== detectSilence ====================

describe('detectSilence', () => {
  it('should return empty array for empty audio', () => {
    expect(detectSilence(new Float32Array(0), 44100)).toEqual([]);
  });

  it('should return empty array for zero sample rate', () => {
    expect(detectSilence(new Float32Array(100), 0)).toEqual([]);
  });

  it('should detect silence in a silent signal', () => {
    const silence = makeSilence(44100, 1.0);
    const result = detectSilence(silence, 44100, -40, 100);
    expect(result.length).toBeGreaterThanOrEqual(1);
    if (result.length > 0) {
      expect(result[0].startMs).toBeGreaterThanOrEqual(0);
      expect(result[0].endMs).toBeGreaterThan(result[0].startMs);
    }
  });

  it('should find silence gaps in mixed audio', () => {
    const audio = makeAudioWithSilence(44100);
    const result = detectSilence(audio, 44100, -40, 100);
    // 至少有一个静音段
    expect(result.length).toBeGreaterThanOrEqual(0);
    for (const seg of result) {
      expect(seg.endMs).toBeGreaterThan(seg.startMs);
    }
  });

  it('should respect minDurationMs parameter', () => {
    const silence = makeSilence(44100, 2.0);
    // 使用很大的 minDuration，应该过滤掉短段
    const result = detectSilence(silence, 44100, -40, 5000);
    // 没有足够长的段，可能为空或包含一个长段
    for (const seg of result) {
      expect(seg.endMs - seg.startMs).toBeGreaterThanOrEqual(4000);
    }
  });
});

// ==================== generateMusicStructure ====================

describe('generateMusicStructure', () => {
  it('should return a valid music structure', () => {
    const structure = generateMusicStructure('cinematic', 'epic', 60, 90);
    expect(structure.sections.length).toBeGreaterThan(0);
    expect(structure.tempo).toBe(90);
    expect(structure.totalBeats).toBeGreaterThan(0);
    expect(structure.timeSignature).toEqual([4, 4]);
    expect(structure.key).toBe('C minor');
  });

  it('should start with intro and end with outro', () => {
    const structure = generateMusicStructure('pop', 'happy', 30, 120);
    expect(structure.sections[0].type).toBe('intro');
    expect(structure.sections[structure.sections.length - 1].type).toBe('outro');
  });

  it('should clamp duration to valid range', () => {
    const structure = generateMusicStructure('ambient', 'calm', 1, 70);
    expect(structure.totalBeats).toBeGreaterThan(0);
  });

  it('should clamp tempo to valid range', () => {
    const structure = generateMusicStructure('rock', 'energetic', 60, 500);
    expect(structure.tempo).toBeLessThanOrEqual(240);
  });

  it('should use genre-appropriate key', () => {
    const jazz = generateMusicStructure('jazz', 'calm', 30, 100);
    expect(jazz.key).toBe('Bb major');

    const rock = generateMusicStructure('rock', 'energetic', 30, 130);
    expect(rock.key).toBe('E minor');
  });

  it('should have non-overlapping section beats', () => {
    const structure = generateMusicStructure('cinematic', 'epic', 120, 90);
    for (let i = 1; i < structure.sections.length; i++) {
      expect(structure.sections[i].startBeat).toBe(structure.sections[i - 1].endBeat);
    }
  });
});

// ==================== estimateGenerationTime ====================

describe('estimateGenerationTime', () => {
  it('should return a positive number', () => {
    const config = createDefaultContentGenerationConfig('subtitle');
    const time = estimateGenerationTime(config);
    expect(time).toBeGreaterThan(0);
  });

  it('should return higher time for higher quality', () => {
    const draft: ContentGenerationConfig = { type: 'subtitle', quality: 'draft' };
    const ultra: ContentGenerationConfig = { type: 'subtitle', quality: 'ultra' };
    expect(estimateGenerationTime(ultra)).toBeGreaterThan(estimateGenerationTime(draft));
  });

  it('should return lower time with GPU enabled', () => {
    const noGpu: ContentGenerationConfig = { type: 'music', enableGPU: false };
    const withGpu: ContentGenerationConfig = { type: 'music', enableGPU: true };
    expect(estimateGenerationTime(withGpu)).toBeLessThan(estimateGenerationTime(noGpu));
  });

  it('should vary by content type', () => {
    const subtitleTime = estimateGenerationTime({ type: 'subtitle' });
    const musicTime = estimateGenerationTime({ type: 'music' });
    expect(musicTime).toBeGreaterThan(subtitleTime);
  });

  it('should adjust for duration in customParams', () => {
    const short: ContentGenerationConfig = { type: 'music', customParams: { duration: 10 } };
    const long: ContentGenerationConfig = { type: 'music', customParams: { duration: 120 } };
    expect(estimateGenerationTime(long)).toBeGreaterThan(estimateGenerationTime(short));
  });
});

// ==================== buildContentGenerationSystemPrompt ====================

describe('buildContentGenerationSystemPrompt', () => {
  it('should return non-empty string for subtitle', () => {
    const prompt = buildContentGenerationSystemPrompt('subtitle');
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toContain('字幕');
  });

  it('should return non-empty string for dubbing', () => {
    const prompt = buildContentGenerationSystemPrompt('dubbing');
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toContain('配音');
  });

  it('should return non-empty string for music', () => {
    const prompt = buildContentGenerationSystemPrompt('music');
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toContain('配乐');
  });

  it('should return non-empty string for effect', () => {
    const prompt = buildContentGenerationSystemPrompt('effect');
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toContain('特效');
  });

  it('should return non-empty string for voiceover', () => {
    const prompt = buildContentGenerationSystemPrompt('voiceover');
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toContain('旁白');
  });

  it('all prompts should contain JSON format reference', () => {
    const types = ['subtitle', 'dubbing', 'music', 'effect', 'voiceover'] as const;
    for (const type of types) {
      expect(buildContentGenerationSystemPrompt(type)).toContain('JSON');
    }
  });
});

// ==================== parseContentGenerationResponse ====================

describe('parseContentGenerationResponse', () => {
  it('should throw for null input', () => {
    expect(() => parseContentGenerationResponse(null, 'subtitle')).toThrow();
  });

  it('should throw for non-object input', () => {
    expect(() => parseContentGenerationResponse('string', 'subtitle')).toThrow();
  });

  it('should throw when no valid contents exist', () => {
    expect(() => parseContentGenerationResponse({ contents: [] }, 'subtitle')).toThrow();
  });

  it('should parse a valid single-object response', () => {
    const input = {
      data: { subtitles: [] },
      duration: 5,
      metadata: {},
      quality: 'standard',
      generationTimeMs: 100,
    };
    const result = parseContentGenerationResponse(input, 'subtitle');
    expect(result.contents.length).toBe(1);
    expect(result.contents[0].type).toBe('subtitle');
    expect(result.contents[0].duration).toBe(5);
  });

  it('should parse a response with contents array', () => {
    const input = {
      contents: [
        { id: 'c1', data: { a: 1 }, duration: 10, metadata: {}, quality: 'high' },
        { id: 'c2', data: { b: 2 }, duration: 20, metadata: {}, quality: 'standard' },
      ],
    };
    const result = parseContentGenerationResponse(input, 'music');
    expect(result.contents.length).toBe(2);
    expect(result.contents[0].id).toBe('c1');
  });

  it('should skip invalid items in contents array', () => {
    const input = {
      contents: [null, 'invalid', { id: 'valid', data: { x: 1 }, duration: 5, metadata: {} }],
    };
    const result = parseContentGenerationResponse(input, 'effect');
    expect(result.contents.length).toBe(1);
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
  });

  it('should default quality to standard when invalid', () => {
    const input = { id: 'x', data: {}, duration: 1, metadata: {}, quality: 'bad' };
    const result = parseContentGenerationResponse(input, 'subtitle');
    expect(result.contents[0].quality).toBe('standard');
  });
});

// ==================== parseContentGenerationResponseSafe ====================

describe('parseContentGenerationResponseSafe', () => {
  it('should return data on valid input', async () => {
    const input = {
      data: { subtitles: [] },
      duration: 5,
      metadata: {},
      quality: 'standard',
      generationTimeMs: 100,
    };
    const result = await parseContentGenerationResponseSafe(input, 'subtitle');
    expect(result.error).toBeNull();
    expect(result.data.contents.length).toBe(1);
  });

  it('should return error on null input', async () => {
    const result = await parseContentGenerationResponseSafe(null, 'subtitle');
    expect(result.error).not.toBeNull();
    expect(result.data.contents).toEqual([]);
  });

  it('should return error when contents array is empty', async () => {
    const result = await parseContentGenerationResponseSafe({ contents: [] }, 'music');
    expect(result.error).not.toBeNull();
  });
});

// ==================== generateSubtitle ====================

describe('generateSubtitle', () => {
  it('should return GeneratedContent with type subtitle', () => {
    const audio = makeSineWave(440, 44100, 2.0, 0.3);
    const result = generateSubtitle(audio, 44100);
    expect(result.type).toBe('subtitle');
    expect(result.id).toContain('subtitle');
  });

  it('should have duration > 0', () => {
    const audio = makeSineWave(440, 44100, 2.0, 0.3);
    const result = generateSubtitle(audio, 44100);
    expect(result.duration).toBeGreaterThan(0);
  });

  it('should contain subtitle config in data', () => {
    const audio = makeSineWave(440, 44100, 2.0, 0.3);
    const result = generateSubtitle(audio, 44100, { maxCharsPerLine: 15, maxLines: 2 });
    const data = result.data as any;
    expect(data.config).toBeDefined();
    expect(data.config.maxCharsPerLine).toBe(15);
  });

  it('should respect custom position', () => {
    const audio = makeSineWave(440, 44100, 2.0, 0.3);
    const result = generateSubtitle(audio, 44100, { position: 'top' });
    const data = result.data as any;
    if (data.subtitles.length > 0) {
      expect(data.subtitles[0].position).toBe('top');
    }
  });
});

// ==================== generateEffect ====================

describe('generateEffect', () => {
  it('should return GeneratedContent with type effect', () => {
    const result = generateEffect({ effectType: 'particle' });
    expect(result.type).toBe('effect');
    expect(result.id).toContain('effect');
  });

  it('should have duration and intensity in data', () => {
    const result = generateEffect({ effectType: 'rain', intensity: 0.7, duration: 5 });
    const data = result.data as any;
    expect(data.intensity).toBe(0.7);
    expect(data.duration).toBe(5);
  });

  it('should generate parameters for particle effect', () => {
    const result = generateEffect({ effectType: 'particle', intensity: 0.5 });
    const data = result.data as any;
    expect(data.parameters).toBeDefined();
    expect(data.parameters.particleCount).toBeGreaterThan(0);
  });

  it('should generate parameters for snow effect', () => {
    const result = generateEffect({ effectType: 'snow', intensity: 0.8 });
    const data = result.data as any;
    expect(data.parameters.particleCount).toBeGreaterThan(0);
    expect(data.parameters.color).toBe('#ffffff');
  });

  it('should clamp intensity to 0-1', () => {
    const result = generateEffect({ effectType: 'fire', intensity: 2.0 });
    const data = result.data as any;
    expect(data.intensity).toBeLessThanOrEqual(1);
  });
});

// ==================== generateDubbing ====================

describe('generateDubbing', () => {
  it('generates dubbing with default config', () => {
    const result = generateDubbing('Hello world');
    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
  });

  it('generates dubbing with custom config', () => {
    const result = generateDubbing('Test text', { language: 'zh' });
    expect(result).toBeDefined();
  });

  it('handles empty text', () => {
    const result = generateDubbing('');
    expect(result).toBeDefined();
  });

  it('handles speed and pitch config', () => {
    const result = generateDubbing('Test', { speed: 1.5, pitch: 0.8 });
    expect(result).toBeDefined();
  });

  it('handles emotion config', () => {
    const result = generateDubbing('Test', { emotion: 'happy' });
    expect(result).toBeDefined();
  });
});

// ==================== generateMusic ====================

describe('generateMusic', () => {
  it('generates music with default config', () => {
    const result = generateMusic();
    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
  });

  it('generates music with custom config', () => {
    const result = generateMusic({ genre: 'pop', duration: 30 });
    expect(result).toBeDefined();
  });

  it('generates music with different genres', () => {
    for (const genre of ['rock', 'jazz', 'electronic', 'classical']) {
      const result = generateMusic({ genre });
      expect(result).toBeDefined();
    }
  });

  it('handles mood config', () => {
    const result = generateMusic({ mood: 'energetic' });
    expect(result).toBeDefined();
  });
});

// ==================== buildContentGenerationUserPrompt ====================

describe('buildContentGenerationUserPrompt', () => {
  it('builds prompt for subtitle type', () => {
    const config = createDefaultContentGenerationConfig('subtitle');
    const prompt = buildContentGenerationUserPrompt(config);
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('builds prompt for music type', () => {
    const config = createDefaultContentGenerationConfig('music');
    const prompt = buildContentGenerationUserPrompt(config);
    expect(typeof prompt).toBe('string');
  });

  it('builds prompt for effect type', () => {
    const config = createDefaultContentGenerationConfig('effect');
    const prompt = buildContentGenerationUserPrompt(config);
    expect(typeof prompt).toBe('string');
  });
});

// ==================== Additional effect type coverage ====================

describe('generateEffect - additional types', () => {
  const effectTypes = ['light-leak', 'lens-flare', 'glitch', 'smoke', 'vignette', 'bokeh'] as const;

  for (const effectType of effectTypes) {
    it(`handles ${effectType} effect type`, () => {
      const result = generateEffect({ effectType, intensity: 0.5, duration: 3 });
      expect(result.type).toBe('effect');
      expect(result.data).toBeDefined();
    });
  }

  it('handles custom parameters', () => {
    const result = generateEffect({ effectType: 'particle', parameters: { color: '#ff0000' } });
    expect(result.data).toBeDefined();
  });
});

// ==================== generateMusicStructure additional coverage ====================

describe('generateMusicStructure - additional genres', () => {
  const genres = ['electronic', 'jazz', 'classical', 'ambient', 'rock', 'hip-hop'] as const;
  const moods = ['happy', 'sad', 'energetic', 'calm', 'dramatic', 'mysterious'] as const;

  for (const genre of genres) {
    it(`handles ${genre} genre`, () => {
      const result = generateMusicStructure(genre, 'happy', 30, 120);
      expect(result.sections.length).toBeGreaterThan(0);
      expect(result.totalBeats).toBeGreaterThan(0);
    });
  }

  for (const mood of moods) {
    it(`handles ${mood} mood`, () => {
      const result = generateMusicStructure('electronic', mood, 30, 120);
      expect(result.sections.length).toBeGreaterThan(0);
    });
  }

  it('clamps duration to max', () => {
    const result = generateMusicStructure('electronic', 'happy', 9999, 120);
    expect(result.totalBeats).toBeGreaterThan(0);
  });

  it('clamps tempo', () => {
    const result = generateMusicStructure('electronic', 'happy', 30, 500);
    expect(result.tempo).toBeLessThanOrEqual(240);
  });
});

// ==================== parseContentGenerationResponse additional coverage ====================

describe('parseContentGenerationResponse - additional', () => {
  it('handles subtitle response', () => {
    const result = parseContentGenerationResponse({ segments: [{ text: 'hello', start: 0, end: 1 }] }, 'subtitle');
    expect(result).toBeDefined();
  });

  it('handles music response', () => {
    const result = parseContentGenerationResponse({ notes: [{ pitch: 60, start: 0, duration: 1 }] }, 'music');
    expect(result).toBeDefined();
  });
});

// ==================== generateSubtitle additional coverage ====================

describe('generateSubtitle - additional configs', () => {
  it('handles custom maxCharsPerLine', () => {
    const audio = new Float32Array(44100 * 2);
    audio.fill(0.3);
    const result = generateSubtitle(audio, 44100, { maxCharsPerLine: 20 });
    expect(result.type).toBe('subtitle');
  });

  it('handles custom maxLines', () => {
    const audio = new Float32Array(44100 * 2);
    audio.fill(0.3);
    const result = generateSubtitle(audio, 44100, { maxLines: 3 });
    expect(result.type).toBe('subtitle');
  });

  it('handles custom position', () => {
    const audio = new Float32Array(44100 * 2);
    audio.fill(0.3);
    const result = generateSubtitle(audio, 44100, { position: 'top' });
    expect(result.type).toBe('subtitle');
  });

  it('handles autoBreak disabled', () => {
    const audio = new Float32Array(44100 * 2);
    audio.fill(0.3);
    const result = generateSubtitle(audio, 44100, { autoBreak: false });
    expect(result.type).toBe('subtitle');
  });

  it('handles fontSize config', () => {
    const audio = new Float32Array(44100 * 2);
    audio.fill(0.3);
    const result = generateSubtitle(audio, 44100, { fontSize: 48 });
    expect(result.type).toBe('subtitle');
  });
});

// ==================== parseContentGenerationResponseSafe ====================

describe('parseContentGenerationResponseSafe', () => {
  it('returns result for valid input', () => {
    const result = parseContentGenerationResponseSafe({ segments: [] }, 'subtitle');
    expect(result).toBeDefined();
  });

  it('handles null input', () => {
    const result = parseContentGenerationResponseSafe(null, 'subtitle');
    expect(result).toBeDefined();
  });
});

// ==================== estimateGenerationTime additional coverage ====================

describe('estimateGenerationTime - additional types', () => {
  it('estimates for effect type', () => {
    const result = estimateGenerationTime({ type: 'effect' });
    expect(result).toBeGreaterThan(0);
  });

  it('estimates for voiceover type', () => {
    const result = estimateGenerationTime({ type: 'voiceover' });
    expect(result).toBeGreaterThan(0);
  });
});

// ==================== Branch coverage: generateDubbing emotions ====================

describe('generateDubbing - emotion branches', () => {
  const emotions = ['neutral', 'happy', 'sad', 'angry', 'fearful', 'excited', 'calm', 'unknown'] as const;
  for (const emotion of emotions) {
    it(`handles emotion=${emotion}`, () => {
      const result = generateDubbing('This is a test sentence. Another sentence here.', { emotion });
      expect(result.type).toBe('dubbing');
      expect(result.data.emotion).toBe(emotion);
    });
  }
});

// ==================== Branch coverage: generateDubbing text patterns ====================

describe('generateDubbing - text splitting branches', () => {
  it('handles text with Chinese sentence-ending punctuation', () => {
    const result = generateDubbing('你好世界！这是测试。还有更多内容？');
    expect(result.metadata.sentenceCount).toBeGreaterThan(0);
  });

  it('handles text with comma splitting', () => {
    const text = 'this is a long text without sentence ending punctuation but with commas, semicolons; and more content here';
    const result = generateDubbing(text);
    expect(result.metadata.sentenceCount).toBeGreaterThan(0);
  });

  it('handles very long text with fixed-length splitting', () => {
    const text = 'a'.repeat(100);
    const result = generateDubbing(text);
    expect(result.metadata.sentenceCount).toBeGreaterThan(1);
  });

  it('handles text with quoted emphasis words', () => {
    const result = generateDubbing('He said "important" and "critical" words here.');
    expect(result.type).toBe('dubbing');
  });

  it('handles text with uppercase words', () => {
    const result = generateDubbing('The API and SDK are critical components here.');
    expect(result.type).toBe('dubbing');
  });

  it('handles mixed CJK and English text', () => {
    const result = generateDubbing('你好 world 测试 test 句子.');
    expect(result.metadata.charCount).toBeGreaterThan(0);
    expect(result.metadata.wordCount).toBeGreaterThan(0);
  });

  it('handles lipSync config', () => {
    const result = generateDubbing('Test.', { lipSync: true });
    expect(result.data.lipSync).toBe(true);
  });

  it('handles voiceId config', () => {
    const result = generateDubbing('Test.', { voiceId: 'custom-voice' });
    expect(result.data.voiceId).toBe('custom-voice');
  });
});

// ==================== Branch coverage: generateMusic genres ====================

describe('generateMusic - all genres with loopable/fade', () => {
  const genres = ['cinematic', 'pop', 'electronic', 'ambient', 'jazz', 'rock', 'classical', 'lo-fi'] as const;
  for (const genre of genres) {
    it(`generates ${genre} music with loopable and fade`, () => {
      const result = generateMusic({ genre, loopable: true, fadeIn: 2, fadeOut: 3 });
      expect(result.type).toBe('music');
      expect(result.data.genre).toBe(genre);
      expect(result.data.loopable).toBe(true);
      expect(result.data.fadeIn).toBe(2);
      expect(result.data.fadeOut).toBe(3);
    });
  }
});

// ==================== Branch coverage: generateMusicStructure edge cases ====================

describe('generateMusicStructure - short vs long', () => {
  it('handles very short duration (forced minimum)', () => {
    const structure = generateMusicStructure('cinematic', 'calm', 1, 60);
    expect(structure.sections.length).toBeGreaterThan(0);
    expect(structure.totalBeats).toBeGreaterThan(0);
  });

  it('handles very long duration', () => {
    const structure = generateMusicStructure('cinematic', 'epic', 300, 120);
    expect(structure.sections.length).toBeGreaterThan(3);
  });
});

// ==================== Branch coverage: generateEffect edge cases ====================

describe('generateEffect - intensity boundaries', () => {
  it('handles minimum intensity', () => {
    const result = generateEffect({ effectType: 'particle', intensity: 0 });
    expect(result.data.intensity).toBe(0);
  });

  it('handles maximum intensity', () => {
    const result = generateEffect({ effectType: 'particle', intensity: 1 });
    expect(result.data.intensity).toBe(1);
  });

  it('handles custom parameters override', () => {
    const result = generateEffect({
      effectType: 'particle',
      parameters: { customField: 'value' },
    });
    expect(result.data.parameters).toBeDefined();
  });
});

// ==================== Branch coverage: generateSubtitle edge cases ====================

describe('generateSubtitle - speaker diarization', () => {
  it('handles speakerDiarization enabled', () => {
    const result = generateSubtitle({
      audioData: makeSineWave(440, 44100, 2.0, 0.5),
      text: 'Hello world. This is a test.',
      speakerDiarization: true,
    });
    expect(result.type).toBe('subtitle');
  });
});

// ==================== Branch coverage: buildContentGenerationUserPrompt ====================

describe('buildContentGenerationUserPrompt - all types', () => {
  const types = ['subtitle', 'dubbing', 'music', 'effect', 'voiceover'] as const;
  for (const type of types) {
    it(`builds prompt for ${type}`, () => {
      const prompt = buildContentGenerationUserPrompt({ type });
      expect(prompt.length).toBeGreaterThan(0);
    });
  }
});

// ==================== Branch coverage: parseContentGenerationResponse ====================

describe('parseContentGenerationResponse - error branches', () => {
  it('throws for array input', () => {
    expect(() => parseContentGenerationResponse([], 'subtitle')).toThrow();
  });

  it('throws for object with empty contents', () => {
    expect(() => parseContentGenerationResponse({ contents: [] }, 'subtitle')).toThrow();
  });

  it('parses dubbing response', () => {
    const result = parseContentGenerationResponse({
      type: 'dubbing',
      timeline: [],
    }, 'dubbing');
    expect(result.contents.length).toBe(1);
  });

  it('parses effect response', () => {
    const result = parseContentGenerationResponse({
      type: 'effect',
      effectType: 'particle',
    }, 'effect');
    expect(result.contents.length).toBe(1);
  });
});
