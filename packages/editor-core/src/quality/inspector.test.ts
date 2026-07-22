/**
 * Quality Inspector Tests
 */

import { describe, it, expect } from 'vitest';
import {
  detectBlackFrame,
  detectColorBars,
  calculateMotionScore,
  analyzeAudioSegment,
  analyzeFrames,
  detectQualitySceneTransitions,
  analyzeQualityPacing,
  checkPlatformCompliance,
  generateIssues,
  calculateQualityScore,
  scoreToGrade,
  formatTime,
  runQualityInspection,
} from './inspector';

import type {
  FrameAnalysis,
  AudioAnalysis,
  SceneTransition,
  InspectorConfig,
} from './types';

import { DEFAULT_INSPECTOR_CONFIG, PLATFORM_SPECS } from './types';

describe('Quality Inspector', () => {
  describe('detectBlackFrame', () => {
    it('should detect black frame', () => {
      const pixels = new Uint8ClampedArray(100 * 4); // 100 pixels, all black
      expect(detectBlackFrame(pixels, 0.05)).toBe(true);
    });

    it('should not detect bright frame as black', () => {
      const pixels = new Uint8ClampedArray(100 * 4);
      for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = 200;     // R
        pixels[i + 1] = 200; // G
        pixels[i + 2] = 200; // B
        pixels[i + 3] = 255; // A
      }
      expect(detectBlackFrame(pixels, 0.05)).toBe(false);
    });

    it('should return false for empty pixels', () => {
      const pixels = new Uint8ClampedArray(0);
      expect(detectBlackFrame(pixels)).toBe(false);
    });
  });

  describe('detectColorBars', () => {
    it('should detect color bars pattern', () => {
      const width = 700;
      const height = 100;
      const pixels = new Uint8ClampedArray(width * height * 4);

      const expectedColors = [
        [255, 255, 255],
        [255, 255, 0],
        [0, 255, 255],
        [0, 255, 0],
        [255, 0, 255],
        [255, 0, 0],
        [0, 0, 255],
      ];

      const barWidth = Math.floor(width / 7);
      const sampleY = Math.floor(height / 2);

      for (let bar = 0; bar < 7; bar++) {
        const [r, g, b] = expectedColors[bar];
        for (let x = bar * barWidth; x < (bar + 1) * barWidth; x++) {
          const idx = (sampleY * width + x) * 4;
          pixels[idx] = r;
          pixels[idx + 1] = g;
          pixels[idx + 2] = b;
          pixels[idx + 3] = 255;
        }
      }

      expect(detectColorBars(pixels, width, height)).toBe(true);
    });

    it('should return false for small frames', () => {
      const pixels = new Uint8ClampedArray(50 * 50 * 4);
      expect(detectColorBars(pixels, 50, 50)).toBe(false);
    });
  });

  describe('calculateMotionScore', () => {
    it('should return 0 for identical frames', () => {
      const frame = new Uint8ClampedArray(100 * 4);
      for (let i = 0; i < frame.length; i += 4) {
        frame[i] = 128;
        frame[i + 1] = 128;
        frame[i + 2] = 128;
        frame[i + 3] = 255;
      }
      expect(calculateMotionScore(frame, frame)).toBe(0);
    });

    it('should return high score for different frames', () => {
      const frame1 = new Uint8ClampedArray(100 * 4);
      const frame2 = new Uint8ClampedArray(100 * 4);

      for (let i = 0; i < frame1.length; i += 4) {
        frame1[i] = 0;
        frame1[i + 1] = 0;
        frame1[i + 2] = 0;
        frame1[i + 3] = 255;

        frame2[i] = 255;
        frame2[i + 1] = 255;
        frame2[i + 2] = 255;
        frame2[i + 3] = 255;
      }

      const score = calculateMotionScore(frame1, frame2);
      expect(score).toBeGreaterThan(0.5);
    });

    it('should return 0 for empty frames', () => {
      const frame1 = new Uint8ClampedArray(0);
      const frame2 = new Uint8ClampedArray(0);
      expect(calculateMotionScore(frame1, frame2)).toBe(0);
    });
  });

  describe('analyzeAudioSegment', () => {
    it('should detect clipping', () => {
      const samples = new Float32Array(1000);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = 0.99; // Near max
      }
      const result = analyzeAudioSegment(samples, DEFAULT_INSPECTOR_CONFIG);
      expect(result.isClipping).toBe(true);
    });

    it('should detect silence', () => {
      const samples = new Float32Array(1000);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = 0.0001; // Very quiet
      }
      const result = analyzeAudioSegment(samples, DEFAULT_INSPECTOR_CONFIG);
      expect(result.isSilent).toBe(true);
    });

    it('should return correct values for empty samples', () => {
      const samples = new Float32Array(0);
      const result = analyzeAudioSegment(samples, DEFAULT_INSPECTOR_CONFIG);
      expect(result.isSilent).toBe(true);
      expect(result.rmsDb).toBe(-Infinity);
    });
  });

  describe('formatTime', () => {
    it('should format seconds correctly', () => {
      expect(formatTime(0)).toBe('00:00.00');
      expect(formatTime(65)).toBe('01:05.00');
      expect(formatTime(3661)).toBe('1:01:01.00');
    });
  });

  describe('scoreToGrade', () => {
    it('should map scores to correct grades', () => {
      expect(scoreToGrade(95)).toBe('A');
      expect(scoreToGrade(85)).toBe('B');
      expect(scoreToGrade(75)).toBe('C');
      expect(scoreToGrade(65)).toBe('D');
      expect(scoreToGrade(50)).toBe('F');
    });
  });

  describe('checkPlatformCompliance', () => {
    it('should pass for matching specs', () => {
      const mediaInfo = {
        width: 1920,
        height: 1080,
        frameRate: 30,
        duration: 600,
        audioSampleRate: 48000,
        audioChannels: 2,
      };
      const result = checkPlatformCompliance(mediaInfo, 'youtube-1080p');
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should fail for wrong resolution', () => {
      const mediaInfo = {
        width: 1280,
        height: 720,
        frameRate: 30,
        duration: 600,
        audioSampleRate: 48000,
        audioChannels: 2,
      };
      const result = checkPlatformCompliance(mediaInfo, 'youtube-1080p');
      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('should fail for too long duration on TikTok', () => {
      const mediaInfo = {
        width: 1080,
        height: 1920,
        frameRate: 30,
        duration: 700, // Over 600s limit
        audioSampleRate: 44100,
        audioChannels: 2,
      };
      const result = checkPlatformCompliance(mediaInfo, 'tiktok-9-16');
      expect(result.passed).toBe(false);
    });
  });

  describe('calculateQualityScore', () => {
    it('should calculate score with no issues', () => {
      const summary = calculateQualityScore([]);
      expect(summary.totalIssues).toBe(0);
      expect(summary.technicalScore).toBe(100);
      expect(summary.contentScore).toBe(100);
      expect(summary.complianceScore).toBe(100);
    });

    it('should deduct points for issues', () => {
      const issues = [
        {
          id: '1',
          category: 'technical' as const,
          type: 'black-frame',
          severity: 'error' as const,
          description: 'Test',
          suggestion: 'Fix',
          autoFixable: false,
        },
        {
          id: '2',
          category: 'content' as const,
          type: 'pacing-slow',
          severity: 'warning' as const,
          description: 'Test',
          suggestion: 'Fix',
          autoFixable: false,
        },
      ];
      const summary = calculateQualityScore(issues);
      expect(summary.totalIssues).toBe(2);
      expect(summary.errorIssues).toBe(1);
      expect(summary.warningIssues).toBe(1);
    });
  });

  describe('runQualityInspection', () => {
    it('should run complete inspection', async () => {
      const mediaData = {
        frames: [
          {
            timestamp: 0,
            pixels: new Uint8ClampedArray(100 * 100 * 4),
            width: 100,
            height: 100,
          },
        ],
        audioSegments: [
          {
            timestamp: 0,
            samples: new Float32Array(1000),
          },
        ],
        mediaInfo: {
          width: 1920,
          height: 1080,
          frameRate: 30,
          duration: 60,
          audioSampleRate: 48000,
          audioChannels: 2,
        },
      };

      const report = await runQualityInspection(mediaData, DEFAULT_INSPECTOR_CONFIG);
      expect(report).toBeDefined();
      expect(report.id).toBeDefined();
      expect(report.grade).toBeDefined();
      expect(report.summary).toBeDefined();
    });
  });
});
