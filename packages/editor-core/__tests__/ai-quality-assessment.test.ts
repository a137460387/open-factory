import { describe, it, expect } from 'vitest';
import {
  parseQualityAssessmentResponse,
  mapScoreToGrade,
  mapSuggestedFixToEditorParams,
  buildQualityAssessmentSystemPrompt,
  buildQualityAssessmentUserPrompt,
  detectFrameShake,
  analyzeAudioRms
} from '../src/ai-quality-assessment';

describe('parseQualityAssessmentResponse', () => {
  it('returns empty for null/undefined', () => {
    expect(parseQualityAssessmentResponse(null)).toEqual({ overallScore: 0, issues: [] });
    expect(parseQualityAssessmentResponse(undefined)).toEqual({ overallScore: 0, issues: [] });
  });

  it('parses valid response with issues', () => {
    const input = {
      overallScore: 72,
      issues: [
        { type: '曝光', severity: 'high', description: '画面过曝', suggestedFix: '建议调整亮度-0.3' },
        { type: '对焦', severity: 'low', description: '轻微模糊', suggestedFix: '建议增加锐度' }
      ]
    };
    const result = parseQualityAssessmentResponse(input);
    expect(result.overallScore).toBe(72);
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0].type).toBe('曝光');
    expect(result.issues[0].severity).toBe('high');
  });

  it('clamps score to 0-100', () => {
    expect(parseQualityAssessmentResponse({ overallScore: 150, issues: [] }).overallScore).toBe(100);
    expect(parseQualityAssessmentResponse({ overallScore: -10, issues: [] }).overallScore).toBe(0);
    expect(parseQualityAssessmentResponse({ overallScore: NaN, issues: [] }).overallScore).toBe(0);
  });

  it('filters out invalid issues', () => {
    const input = {
      overallScore: 80,
      issues: [
        { type: 'test', severity: 'medium', description: 'ok', suggestedFix: 'fix' },
        { type: 123, severity: 'low', description: 'bad', suggestedFix: 'fix' },
        null,
        { severity: 'high', description: 'missing type', suggestedFix: 'fix' },
        { type: 'test', severity: 'invalid', description: 'bad sev', suggestedFix: 'fix' }
      ]
    };
    const result = parseQualityAssessmentResponse(input);
    expect(result.issues).toHaveLength(1);
  });

  it('handles non-object input', () => {
    expect(parseQualityAssessmentResponse('string')).toEqual({ overallScore: 0, issues: [] });
    expect(parseQualityAssessmentResponse(42)).toEqual({ overallScore: 0, issues: [] });
  });
});

describe('mapScoreToGrade', () => {
  it('green for >= 80', () => {
    expect(mapScoreToGrade(80)).toBe('green');
    expect(mapScoreToGrade(95)).toBe('green');
    expect(mapScoreToGrade(100)).toBe('green');
  });

  it('yellow for 60-79', () => {
    expect(mapScoreToGrade(60)).toBe('yellow');
    expect(mapScoreToGrade(79)).toBe('yellow');
    expect(mapScoreToGrade(70)).toBe('yellow');
  });

  it('red for < 60', () => {
    expect(mapScoreToGrade(59)).toBe('red');
    expect(mapScoreToGrade(0)).toBe('red');
    expect(mapScoreToGrade(30)).toBe('red');
  });
});

describe('mapSuggestedFixToEditorParams', () => {
  it('maps brightness fix', () => {
    const params = mapSuggestedFixToEditorParams('建议调整亮度欠曝');
    expect(params).toBeDefined();
    expect(params!.brightness).toBe(0.3);
  });

  it('maps contrast fix', () => {
    const params = mapSuggestedFixToEditorParams('建议增加对比度');
    expect(params).toBeDefined();
    expect(params!.contrast).toBe(1.2);
  });

  it('maps saturation fix', () => {
    const params = mapSuggestedFixToEditorParams('建议提高饱和度');
    expect(params).toBeDefined();
    expect(params!.saturation).toBe(1.2);
  });

  it('maps denoise fix', () => {
    const params = mapSuggestedFixToEditorParams('建议开启去噪');
    expect(params).toBeDefined();
    expect(params!.denoise).toBe(true);
  });

  it('maps stabilization fix', () => {
    const params = mapSuggestedFixToEditorParams('建议开启画面稳定');
    expect(params).toBeDefined();
    expect(params!.stabilization).toBe(true);
  });

  it('maps noise reduction fix', () => {
    const params = mapSuggestedFixToEditorParams('建议去除噪音');
    expect(params).toBeDefined();
    expect(params!.noiseReduction).toBe(true);
  });

  it('returns undefined for unrecognized fix', () => {
    expect(mapSuggestedFixToEditorParams('无相关建议')).toBeUndefined();
  });
});

describe('buildQualityAssessmentSystemPrompt', () => {
  it('contains key assessment terms', () => {
    const prompt = buildQualityAssessmentSystemPrompt();
    expect(prompt).toContain('质量评估');
    expect(prompt).toContain('overallScore');
    expect(prompt).toContain('severity');
    expect(prompt).toContain('suggestedFix');
  });
});

describe('buildQualityAssessmentUserPrompt', () => {
  it('includes media info', () => {
    const prompt = buildQualityAssessmentUserPrompt({
      name: 'test.mp4', type: 'video', width: 1920, height: 1080, duration: 30, hasAudio: true
    });
    expect(prompt).toContain('test.mp4');
    expect(prompt).toContain('1920x1080');
    expect(prompt).toContain('30');
    expect(prompt).toContain('音频');
  });

  it('handles minimal info', () => {
    const prompt = buildQualityAssessmentUserPrompt({ name: 'img.jpg', type: 'image' });
    expect(prompt).toContain('img.jpg');
    expect(prompt).not.toContain('分辨率');
  });
});

describe('detectFrameShake', () => {
  it('returns false for fewer than 2 frames', () => {
    expect(detectFrameShake([])).toBe(false);
    expect(detectFrameShake([new Uint8Array([100, 100, 100])])).toBe(false);
  });

  it('returns false for stable frames', () => {
    const frame1 = new Uint8Array([100, 100, 100, 100]);
    const frame2 = new Uint8Array([101, 100, 101, 100]);
    const frame3 = new Uint8Array([100, 101, 100, 101]);
    expect(detectFrameShake([frame1, frame2, frame3], 30)).toBe(false);
  });

  it('returns true for shaky frames', () => {
    const frame1 = new Uint8Array([0, 0, 0, 0]);
    const frame2 = new Uint8Array([200, 200, 200, 200]);
    const frame3 = new Uint8Array([0, 0, 0, 0]);
    expect(detectFrameShake([frame1, frame2, frame3], 30)).toBe(true);
  });
});

describe('analyzeAudioRms', () => {
  it('handles empty samples', () => {
    const result = analyzeAudioRms(new Float32Array(0));
    expect(result.isQuiet).toBe(true);
    expect(result.isClipping).toBe(false);
  });

  it('detects quiet audio', () => {
    const samples = new Float32Array(1000);
    for (let i = 0; i < 1000; i++) samples[i] = 0.001; // ~-60dB
    const result = analyzeAudioRms(samples);
    expect(result.isQuiet).toBe(true);
    expect(result.isClipping).toBe(false);
  });

  it('detects normal audio', () => {
    const samples = new Float32Array(1000);
    for (let i = 0; i < 1000; i++) samples[i] = 0.1; // ~-20dB
    const result = analyzeAudioRms(samples);
    expect(result.isQuiet).toBe(false);
    expect(result.isClipping).toBe(false);
  });

  it('detects clipping audio', () => {
    const samples = new Float32Array(1000);
    for (let i = 0; i < 1000; i++) samples[i] = 0.95; // ~-0.4dB
    const result = analyzeAudioRms(samples, -40, -1);
    expect(result.isQuiet).toBe(false);
    expect(result.isClipping).toBe(true);
  });
});
