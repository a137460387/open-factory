import { describe, it, expect } from 'vitest';
import {
  createDefaultExtractionConfig,
  validateExtractionConfig,
  calculateKeyFrameTimestamps,
  calculatePreviewDimensions,
  mergeASRSegments,
  detectLanguageFromASR,
  generateAutoTags,
  buildTranscriptText,
  estimateMetadataUploadSize,
  aggregateMetadata,
  validateMetadataPrivacy,
} from './semantic-extractor';
import type {
  KeyFrame,
  ASRSegment,
  AudioProfile,
  VisualProfile,
  MaterialMetadata,
} from './semantic-extractor';

// ─── Test Helpers ───────────────────────────────────────────────

function makeASR(overrides: Partial<ASRSegment> = {}): ASRSegment {
  return {
    startSec: 0,
    endSec: 1,
    text: 'hello world',
    confidence: 0.9,
    ...overrides,
  };
}

function makeVisual(overrides: Partial<VisualProfile> = {}): VisualProfile {
  return {
    motionIntensity: 0.5,
    colorPalette: ['#ff0000', '#00ff00'],
    avgBrightness: 0.5,
    sceneDistribution: { indoor: 0.6, outdoor: 0.4 },
    faceCount: 1,
    hasOverlay: false,
    ...overrides,
  };
}

function makeAudio(overrides: Partial<AudioProfile> = {}): AudioProfile {
  return {
    avgLoudness: -14,
    peakDb: -1,
    silenceRatio: 0.1,
    hasMusic: false,
    speechRatio: 0.8,
    noiseLevel: 'quiet',
    ...overrides,
  };
}

function makeSource(overrides: Partial<MaterialMetadata['source']> = {}): MaterialMetadata['source'] {
  return {
    fileName: 'test.mp4',
    durationSec: 60,
    width: 1920,
    height: 1080,
    fps: 30,
    codec: 'h264',
    fileSizeBytes: 10_000_000,
    ...overrides,
  };
}

// ─── createDefaultExtractionConfig ──────────────────────────────

describe('createDefaultExtractionConfig', () => {
  it('returns all required fields', () => {
    const config = createDefaultExtractionConfig();
    expect(config.maxKeyFrames).toBe(20);
    expect(config.previewMaxWidth).toBe(160);
    expect(config.previewMaxHeight).toBe(90);
    expect(config.previewQuality).toBe(30);
    expect(config.enableASR).toBe(true);
    expect(config.enableVisualAnalysis).toBe(true);
    expect(config.sceneChangeThreshold).toBe(0.3);
  });

  it('returns a fresh copy each time', () => {
    const a = createDefaultExtractionConfig();
    const b = createDefaultExtractionConfig();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

// ─── validateExtractionConfig ───────────────────────────────────

describe('validateExtractionConfig', () => {
  it('returns no errors for valid config', () => {
    expect(validateExtractionConfig({})).toEqual([]);
    expect(validateExtractionConfig({ maxKeyFrames: 10 })).toEqual([]);
  });

  it('catches maxKeyFrames out of range', () => {
    expect(validateExtractionConfig({ maxKeyFrames: 0 })).toHaveLength(1);
    expect(validateExtractionConfig({ maxKeyFrames: 300 })).toHaveLength(1);
  });

  it('catches negative intervalSec', () => {
    expect(validateExtractionConfig({ intervalSec: -1 })).toHaveLength(1);
  });

  it('catches previewMaxWidth out of range', () => {
    expect(validateExtractionConfig({ previewMaxWidth: 10 })).toHaveLength(1);
    expect(validateExtractionConfig({ previewMaxWidth: 1000 })).toHaveLength(1);
  });

  it('catches previewQuality out of range', () => {
    expect(validateExtractionConfig({ previewQuality: 0 })).toHaveLength(1);
    expect(validateExtractionConfig({ previewQuality: 101 })).toHaveLength(1);
  });

  it('catches sceneChangeThreshold out of range', () => {
    expect(validateExtractionConfig({ sceneChangeThreshold: -0.1 })).toHaveLength(1);
    expect(validateExtractionConfig({ sceneChangeThreshold: 1.5 })).toHaveLength(1);
  });
});

// ─── calculateKeyFrameTimestamps ────────────────────────────────

describe('calculateKeyFrameTimestamps', () => {
  it('returns empty for zero duration', () => {
    expect(calculateKeyFrameTimestamps(0, { maxKeyFrames: 10, intervalSec: 0 })).toEqual([]);
  });

  it('returns empty for negative duration', () => {
    expect(calculateKeyFrameTimestamps(-1, { maxKeyFrames: 10, intervalSec: 0 })).toEqual([]);
  });

  it('uses fixed interval when specified', () => {
    const ts = calculateKeyFrameTimestamps(10, { maxKeyFrames: 100, intervalSec: 2 });
    expect(ts).toEqual([0, 2, 4, 6, 8]);
  });

  it('respects maxKeyFrames with fixed interval', () => {
    const ts = calculateKeyFrameTimestamps(100, { maxKeyFrames: 3, intervalSec: 5 });
    expect(ts).toHaveLength(3);
  });

  it('auto mode distributes evenly', () => {
    const ts = calculateKeyFrameTimestamps(60, { maxKeyFrames: 10, intervalSec: 0 });
    expect(ts.length).toBeLessThanOrEqual(10);
    expect(ts.length).toBeGreaterThanOrEqual(1);
    // Should be sorted
    for (let i = 1; i < ts.length; i++) {
      expect(ts[i]).toBeGreaterThan(ts[i - 1]);
    }
  });

  it('handles very short video', () => {
    const ts = calculateKeyFrameTimestamps(0.5, { maxKeyFrames: 5, intervalSec: 0 });
    expect(ts.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── calculatePreviewDimensions ─────────────────────────────────

describe('calculatePreviewDimensions', () => {
  it('scales 1920x1080 to fit 160x90', () => {
    const dim = calculatePreviewDimensions(1920, 1080, 160, 90);
    expect(dim.width).toBe(160);
    expect(dim.height).toBeLessThanOrEqual(90);
    // Should maintain aspect ratio (16:9)
    expect(dim.width / dim.height).toBeCloseTo(16 / 9, 0);
  });

  it('handles portrait video', () => {
    const dim = calculatePreviewDimensions(1080, 1920, 160, 90);
    expect(dim.width).toBeLessThanOrEqual(160);
    expect(dim.height).toBeLessThanOrEqual(90);
  });

  it('produces even dimensions', () => {
    const dim = calculatePreviewDimensions(1920, 1080, 160, 90);
    expect(dim.width % 2).toBe(0);
    expect(dim.height % 2).toBe(0);
  });

  it('handles invalid dimensions gracefully', () => {
    const dim = calculatePreviewDimensions(0, 0, 160, 90);
    expect(dim.width).toBe(160);
    expect(dim.height).toBe(90);
  });

  it('handles square video', () => {
    const dim = calculatePreviewDimensions(1080, 1080, 160, 90);
    expect(dim.width).toBeLessThanOrEqual(160);
    expect(dim.height).toBeLessThanOrEqual(90);
    // Square should produce 90x90 (or close)
    expect(dim.width).toBe(dim.height);
  });
});

// ─── mergeASRSegments ──────────────────────────────────────────

describe('mergeASRSegments', () => {
  it('returns empty for empty input', () => {
    expect(mergeASRSegments([], 0.3, 30)).toEqual([]);
  });

  it('keeps single segment unchanged', () => {
    const seg = makeASR({ startSec: 0, endSec: 1, text: 'hello' });
    expect(mergeASRSegments([seg], 0.3, 30)).toEqual([seg]);
  });

  it('merges close segments', () => {
    const segs = [
      makeASR({ startSec: 0, endSec: 1, text: 'hello' }),
      makeASR({ startSec: 1.1, endSec: 2, text: 'world' }),
    ];
    const merged = mergeASRSegments(segs, 0.3, 30);
    expect(merged).toHaveLength(1);
    expect(merged[0].text).toBe('hello world');
    expect(merged[0].startSec).toBe(0);
    expect(merged[0].endSec).toBe(2);
  });

  it('does not merge distant segments', () => {
    const segs = [
      makeASR({ startSec: 0, endSec: 1, text: 'hello' }),
      makeASR({ startSec: 5, endSec: 6, text: 'world' }),
    ];
    const merged = mergeASRSegments(segs, 0.3, 30);
    expect(merged).toHaveLength(2);
  });

  it('respects maxDurationSec', () => {
    const segs = [
      makeASR({ startSec: 0, endSec: 15, text: 'long' }),
      makeASR({ startSec: 15.1, endSec: 30, text: 'speech' }),
    ];
    const merged = mergeASRSegments(segs, 0.5, 20);
    // Merged duration would be 30s > 20s max, so should not merge
    expect(merged).toHaveLength(2);
  });

  it('sorts by startSec before merging', () => {
    const segs = [
      makeASR({ startSec: 5, endSec: 6, text: 'second' }),
      makeASR({ startSec: 0, endSec: 1, text: 'first' }),
    ];
    const merged = mergeASRSegments(segs, 0.3, 30);
    expect(merged[0].text).toContain('first');
  });
});

// ─── detectLanguageFromASR ─────────────────────────────────────

describe('detectLanguageFromASR', () => {
  it('detects Chinese', () => {
    expect(detectLanguageFromASR('这是一个中文句子')).toBe('zh');
  });

  it('detects Japanese', () => {
    expect(detectLanguageFromASR('これは日本語のテストです')).toBe('ja');
  });

  it('detects Korean', () => {
    expect(detectLanguageFromASR('이것은 한국어 테스트입니다')).toBe('ko');
  });

  it('defaults to English', () => {
    expect(detectLanguageFromASR('This is an English sentence')).toBe('en');
  });

  it('returns unknown for empty text', () => {
    expect(detectLanguageFromASR('')).toBe('unknown');
    expect(detectLanguageFromASR('   ')).toBe('unknown');
  });
});

// ─── generateAutoTags ──────────────────────────────────────────

describe('generateAutoTags', () => {
  it('tags high motion', () => {
    const tags = generateAutoTags(makeVisual({ motionIntensity: 0.8 }), makeAudio(), []);
    expect(tags).toContain('high-motion');
  });

  it('tags static', () => {
    const tags = generateAutoTags(makeVisual({ motionIntensity: 0.1 }), makeAudio(), []);
    expect(tags).toContain('static');
  });

  it('tags bright and dark', () => {
    expect(generateAutoTags(makeVisual({ avgBrightness: 0.8 }), makeAudio(), [])).toContain('bright');
    expect(generateAutoTags(makeVisual({ avgBrightness: 0.2 }), makeAudio(), [])).toContain('dark');
  });

  it('tags people when faces detected', () => {
    expect(generateAutoTags(makeVisual({ faceCount: 2 }), makeAudio(), [])).toContain('people');
  });

  it('tags music and speech', () => {
    expect(generateAutoTags(makeVisual(), makeAudio({ hasMusic: true }), [])).toContain('music');
    expect(generateAutoTags(makeVisual(), makeAudio({ speechRatio: 0.6 }), [])).toContain('speech');
  });

  it('tags noisy audio', () => {
    expect(generateAutoTags(makeVisual(), makeAudio({ noiseLevel: 'noisy' }), [])).toContain('noisy');
  });

  it('tags detected language from ASR', () => {
    const segs = [makeASR({ language: 'zh' })];
    expect(generateAutoTags(makeVisual(), makeAudio(), segs)).toContain('lang:zh');
  });

  it('tags dominant scenes', () => {
    const tags = generateAutoTags(
      makeVisual({ sceneDistribution: { outdoor: 0.5, indoor: 0.5 } }),
      makeAudio(),
      []
    );
    expect(tags).toContain('outdoor');
    expect(tags).toContain('indoor');
  });
});

// ─── buildTranscriptText ───────────────────────────────────────

describe('buildTranscriptText', () => {
  it('joins segment texts', () => {
    const segs = [
      makeASR({ text: 'hello' }),
      makeASR({ text: 'world' }),
    ];
    expect(buildTranscriptText(segs)).toBe('hello world');
  });

  it('filters empty text', () => {
    const segs = [makeASR({ text: 'hello' }), makeASR({ text: '' }), makeASR({ text: 'world' })];
    expect(buildTranscriptText(segs)).toBe('hello world');
  });

  it('returns empty for no segments', () => {
    expect(buildTranscriptText([])).toBe('');
  });
});

// ─── aggregateMetadata ─────────────────────────────────────────

describe('aggregateMetadata', () => {
  it('produces valid metadata', () => {
    const result = aggregateMetadata(
      makeSource(),
      [],
      [makeASR()],
      makeAudio(),
      makeVisual(),
      createDefaultExtractionConfig()
    );

    expect(result.metadata.version).toBe('1.0');
    expect(result.metadata.source.fileName).toBe('test.mp4');
    expect(result.metadata.extractedAt).toBeTruthy();
    expect(result.metadata.tags).toBeInstanceOf(Array);
    expect(result.metadata.transcriptText).toBeTruthy();
  });

  it('warns on zero duration', () => {
    const result = aggregateMetadata(
      makeSource({ durationSec: 0 }),
      [],
      [],
      makeAudio(),
      makeVisual(),
      createDefaultExtractionConfig()
    );
    expect(result.warnings.some(w => w.includes('duration'))).toBe(true);
  });

  it('warns on invalid dimensions', () => {
    const result = aggregateMetadata(
      makeSource({ width: 0, height: 0 }),
      [],
      [],
      makeAudio(),
      makeVisual(),
      createDefaultExtractionConfig()
    );
    expect(result.warnings.some(w => w.includes('dimensions'))).toBe(true);
  });

  it('skips ASR when disabled', () => {
    const config = createDefaultExtractionConfig();
    config.enableASR = false;
    const result = aggregateMetadata(
      makeSource(),
      [],
      [makeASR()],
      makeAudio(),
      makeVisual(),
      config
    );
    expect(result.metadata.asrSegments).toEqual([]);
    expect(result.metadata.transcriptText).toBe('');
  });
});

// ─── validateMetadataPrivacy ───────────────────────────────────

describe('validateMetadataPrivacy', () => {
  it('passes for valid metadata', () => {
    const metadata: MaterialMetadata = {
      version: '1.0',
      source: makeSource(),
      extractedAt: new Date().toISOString(),
      keyFrames: [{ timeSec: 1, frameIndex: 30, previewWidth: 160, previewHeight: 90, lowResPreview: 'abc' }],
      asrSegments: [],
      transcriptText: '',
      audioProfile: makeAudio(),
      visualProfile: makeVisual(),
      tags: [],
    };
    const result = validateMetadataPrivacy(metadata);
    expect(result.safe).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('flags oversized preview width', () => {
    const metadata: MaterialMetadata = {
      version: '1.0',
      source: makeSource(),
      extractedAt: new Date().toISOString(),
      keyFrames: [{ timeSec: 1, frameIndex: 30, previewWidth: 1920, previewHeight: 1080 }],
      asrSegments: [],
      transcriptText: '',
      audioProfile: makeAudio(),
      visualProfile: makeVisual(),
      tags: [],
    };
    const result = validateMetadataPrivacy(metadata);
    expect(result.safe).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('flags oversized base64 preview', () => {
    const largeBase64 = 'x'.repeat(60000);
    const metadata: MaterialMetadata = {
      version: '1.0',
      source: makeSource(),
      extractedAt: new Date().toISOString(),
      keyFrames: [{ timeSec: 1, frameIndex: 30, lowResPreview: largeBase64 }],
      asrSegments: [],
      transcriptText: '',
      audioProfile: makeAudio(),
      visualProfile: makeVisual(),
      tags: [],
    };
    const result = validateMetadataPrivacy(metadata);
    expect(result.safe).toBe(false);
  });
});

// ─── estimateMetadataUploadSize ────────────────────────────────

describe('estimateMetadataUploadSize', () => {
  it('estimates size for minimal metadata', () => {
    const metadata: MaterialMetadata = {
      version: '1.0',
      source: makeSource(),
      extractedAt: new Date().toISOString(),
      keyFrames: [],
      asrSegments: [],
      transcriptText: '',
      audioProfile: makeAudio(),
      visualProfile: makeVisual(),
      tags: [],
    };
    const size = estimateMetadataUploadSize(metadata);
    expect(size).toBeGreaterThan(0);
    expect(size).toBeLessThan(10000);
  });

  it('includes base64 preview size', () => {
    const base64 = 'x'.repeat(5000);
    const metadata: MaterialMetadata = {
      version: '1.0',
      source: makeSource(),
      extractedAt: new Date().toISOString(),
      keyFrames: [{ timeSec: 1, frameIndex: 30, lowResPreview: base64 }],
      asrSegments: [],
      transcriptText: '',
      audioProfile: makeAudio(),
      visualProfile: makeVisual(),
      tags: [],
    };
    const size = estimateMetadataUploadSize(metadata);
    expect(size).toBeGreaterThanOrEqual(5000);
  });
});
