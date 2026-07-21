import { describe, test, expect } from 'vitest';
import {
  detectAvailableProviders,
  heuristicSceneDetection,
  heuristicQualityAssessment,
  heuristicContentAnalysis,
  DEFAULT_INFERENCE_CONFIG,
} from '../../src/headless/headless-ai-inference';

describe('Headless AI Inference', () => {
  describe('detectAvailableProviders', () => {
    test('always returns heuristic as fallback', async () => {
      const providers = await detectAvailableProviders();
      expect(providers).toContain('heuristic');
      expect(providers.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('heuristicSceneDetection', () => {
    test('returns empty scenes for empty input', () => {
      const result = heuristicSceneDetection({ frames: [], threshold: 0.3 });
      expect(result.scenes).toEqual([]);
    });

    test('returns single scene for one frame', () => {
      const result = heuristicSceneDetection({
        frames: [{ timestamp: 0, data: new Uint8Array([100, 150, 200]) }],
        threshold: 0.3,
      });
      expect(result.scenes).toHaveLength(1);
      expect(result.scenes[0]!.startIndex).toBe(0);
      expect(result.scenes[0]!.confidence).toBe(1.0);
    });

    test('detects scene change on large frame difference', () => {
      const darkFrame = new Uint8Array(100).fill(10);
      const brightFrame = new Uint8Array(100).fill(240);

      const result = heuristicSceneDetection({
        frames: [
          { timestamp: 0, data: darkFrame },
          { timestamp: 1, data: brightFrame },
          { timestamp: 2, data: brightFrame },
        ],
        threshold: 0.3,
      });

      expect(result.scenes.length).toBeGreaterThanOrEqual(2);
    });

    test('does not detect scene change on similar frames', () => {
      const frame1 = new Uint8Array(100).fill(100);
      const frame2 = new Uint8Array(100).fill(102);

      const result = heuristicSceneDetection({
        frames: [
          { timestamp: 0, data: frame1 },
          { timestamp: 1, data: frame2 },
        ],
        threshold: 0.3,
      });

      expect(result.scenes).toHaveLength(1);
    });
  });

  describe('heuristicQualityAssessment', () => {
    test('gives high score for good quality input', () => {
      const result = heuristicQualityAssessment({
        width: 1920,
        height: 1080,
        bitrate: 10_000_000,
        frameRate: 30,
        loudnessIntegrated: -16,
        loudnessTruePeak: -3,
        codec: 'h264',
      });

      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.issues.filter((i) => i.severity === 'critical')).toHaveLength(0);
    });

    test('flags low resolution', () => {
      const result = heuristicQualityAssessment({
        width: 640,
        height: 480,
        bitrate: 2_000_000,
        frameRate: 30,
        loudnessIntegrated: -16,
        loudnessTruePeak: -3,
        codec: 'h264',
      });

      expect(result.issues.some((i) => i.code === 'LOW_RESOLUTION')).toBe(true);
      expect(result.score).toBeLessThan(100);
    });

    test('flags true peak clipping as critical', () => {
      const result = heuristicQualityAssessment({
        width: 1920,
        height: 1080,
        bitrate: 8_000_000,
        frameRate: 30,
        loudnessIntegrated: -16,
        loudnessTruePeak: 0,
        codec: 'h264',
      });

      expect(result.issues.some((i) => i.severity === 'critical' && i.code === 'TRUE_PEAK_CLIPPING')).toBe(true);
    });

    test('flags loudness above -14 LUFS', () => {
      const result = heuristicQualityAssessment({
        width: 1920,
        height: 1080,
        bitrate: 8_000_000,
        frameRate: 30,
        loudnessIntegrated: -10,
        loudnessTruePeak: -3,
        codec: 'h264',
      });

      expect(result.issues.some((i) => i.code === 'LOUDNESS_HIGH')).toBe(true);
    });

    test('flags low frame rate', () => {
      const result = heuristicQualityAssessment({
        width: 1920,
        height: 1080,
        bitrate: 8_000_000,
        frameRate: 15,
        loudnessIntegrated: -16,
        loudnessTruePeak: -3,
        codec: 'h264',
      });

      expect(result.issues.some((i) => i.code === 'LOW_FRAMERATE')).toBe(true);
    });

    test('provides recommendations for non-optimal codec', () => {
      const result = heuristicQualityAssessment({
        width: 1920,
        height: 1080,
        bitrate: 8_000_000,
        frameRate: 30,
        loudnessIntegrated: -16,
        loudnessTruePeak: -3,
        codec: 'mpeg4',
      });

      expect(result.issues.some((i) => i.code === 'CODEC_NOT_OPTIMAL')).toBe(true);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('heuristicContentAnalysis', () => {
    test('returns defaults for empty frames', () => {
      const result = heuristicContentAnalysis({ frames: [] });
      expect(result.mood).toBe('neutral');
      expect(result.motionLevel).toBe('static');
      expect(result.tags).toEqual([]);
    });

    test('detects bright content', () => {
      const brightFrame = new Uint8Array(1000).fill(220);
      const result = heuristicContentAnalysis({
        frames: [
          { timestamp: 0, data: brightFrame },
          { timestamp: 1, data: brightFrame },
        ],
      });

      expect(result.tags).toContain('bright');
      expect(result.brightness).toBeGreaterThan(0.7);
    });

    test('detects dark content', () => {
      const darkFrame = new Uint8Array(1000).fill(30);
      const result = heuristicContentAnalysis({
        frames: [
          { timestamp: 0, data: darkFrame },
          { timestamp: 1, data: darkFrame },
        ],
      });

      expect(result.tags).toContain('dark');
    });

    test('detects high motion', () => {
      const frame1 = new Uint8Array(1000).fill(10);
      const frame2 = new Uint8Array(1000).fill(240);

      const result = heuristicContentAnalysis({
        frames: [
          { timestamp: 0, data: frame1 },
          { timestamp: 1, data: frame2 },
        ],
      });

      expect(result.motionLevel).toBe('high');
      expect(result.tags).toContain('dynamic');
    });

    test('detects static content', () => {
      const frame = new Uint8Array(1000).fill(128);
      const result = heuristicContentAnalysis({
        frames: [
          { timestamp: 0, data: frame },
          { timestamp: 1, data: frame },
          { timestamp: 2, data: frame },
        ],
      });

      expect(result.motionLevel).toBe('static');
    });

    test('uses audio features for mood detection', () => {
      const frame = new Uint8Array(100).fill(128);
      const result = heuristicContentAnalysis({
        frames: [{ timestamp: 0, data: frame }],
        audioFeatures: { rms: 0.8, zeroCrossingRate: 0.5, spectralCentroid: 0.6 },
      });

      expect(result.mood).toBe('energetic');
    });
  });

  describe('DEFAULT_INFERENCE_CONFIG', () => {
    test('has expected defaults', () => {
      expect(DEFAULT_INFERENCE_CONFIG.preferredProvider).toBe('onnx-cpu');
      expect(DEFAULT_INFERENCE_CONFIG.enableGpu).toBe(false);
      expect(DEFAULT_INFERENCE_CONFIG.maxMemoryMb).toBe(512);
    });
  });
});
