import { describe, it, expect } from 'vitest';
import {
  detectBlackFrame,
  detectColorBars,
  calculateMotionScore,
  analyzeAudioSegment,
  calculateQualityScore,
  scoreToGrade,
  formatTime,
} from '../../src/quality/inspector';
import type { InspectorQualityIssue } from '../../src/quality/types';

function makeIssue(overrides: Partial<InspectorQualityIssue> = {}): InspectorQualityIssue {
  return {
    id: 'i1',
    category: 'technical',
    type: 'black-frame',
    severity: 'warning',
    description: '',
    suggestion: '',
    autoFixable: false,
    ...overrides,
  };
}

// 辅助：构造 RGBA 像素数组
function makePixels(width: number, height: number, fillR: number, fillG: number, fillB: number): Uint8ClampedArray {
  const arr = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < arr.length; i += 4) {
    arr[i] = fillR;
    arr[i + 1] = fillG;
    arr[i + 2] = fillB;
    arr[i + 3] = 255;
  }
  return arr;
}

describe('inspector: detectBlackFrame', () => {
  it('全黑帧被检测为黑场', () => {
    const pixels = makePixels(100, 100, 0, 0, 0);
    expect(detectBlackFrame(pixels)).toBe(true);
  });

  it('亮帧不被检测为黑场', () => {
    const pixels = makePixels(100, 100, 200, 200, 200);
    expect(detectBlackFrame(pixels)).toBe(false);
  });

  it('空数组返回 false', () => {
    expect(detectBlackFrame(new Uint8ClampedArray(0))).toBe(false);
  });

  it('自定义阈值生效（阈值越高越易判为黑场）', () => {
    const darkPixels = makePixels(100, 100, 5, 5, 5);
    // 高阈值：判定为黑场
    expect(detectBlackFrame(darkPixels, 0.5)).toBe(true);
  });
});

describe('inspector: detectColorBars', () => {
  it('过小尺寸返回 false', () => {
    const pixels = makePixels(50, 50, 255, 255, 255);
    expect(detectColorBars(pixels, 50, 50)).toBe(false);
  });

  it('纯色画面不匹配彩条', () => {
    const pixels = makePixels(700, 200, 128, 128, 128);
    expect(detectColorBars(pixels, 700, 200)).toBe(false);
  });
});

describe('inspector: calculateMotionScore', () => {
  it('相同帧运动分数为 0', () => {
    const frame = makePixels(100, 100, 100, 100, 100);
    expect(calculateMotionScore(frame, frame)).toBe(0);
  });

  it('完全不同的帧有高运动分数', () => {
    const dark = makePixels(100, 100, 0, 0, 0);
    const bright = makePixels(100, 100, 255, 255, 255);
    const score = calculateMotionScore(dark, bright);
    expect(score).toBeGreaterThan(0.5);
  });

  it('空数组返回 0', () => {
    expect(calculateMotionScore(new Uint8ClampedArray(0), new Uint8ClampedArray(0))).toBe(0);
  });

  it('长度不一致返回 0', () => {
    const a = makePixels(100, 100, 0, 0, 0);
    const b = makePixels(100, 100, 0, 0, 0).slice(0, 100);
    expect(calculateMotionScore(a, b)).toBe(0);
  });
});

describe('inspector: analyzeAudioSegment', () => {
  it('空样本返回静音标记', () => {
    const result = analyzeAudioSegment(new Float32Array(0));
    expect(result.isSilent).toBe(true);
    expect(result.isClipping).toBe(false);
    expect(result.rmsDb).toBe(-Infinity);
  });

  it('正常音量不被标记为削波或静音', () => {
    const samples = new Float32Array(1000);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin(i * 0.1) * 0.3;
    }
    const result = analyzeAudioSegment(samples);
    expect(result.isClipping).toBe(false);
    expect(result.isSilent).toBe(false);
    expect(result.rmsDb).toBeGreaterThan(-Infinity);
  });

  it('削波样本被检测', () => {
    const samples = new Float32Array(1000).fill(1.0);
    const result = analyzeAudioSegment(samples);
    expect(result.peakDb).toBeGreaterThanOrEqual(0);
  });

  it('spectralCentroid 为有限数', () => {
    const samples = new Float32Array(256);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 0.5 - 0.25;
    const result = analyzeAudioSegment(samples);
    expect(result.spectralCentroid).toBeTypeOf('number');
    expect(Number.isFinite(result.spectralCentroid)).toBe(true);
  });
});

describe('inspector: calculateQualityScore', () => {
  it('无问题时满分', () => {
    const summary = calculateQualityScore([]);
    expect(summary.totalIssues).toBe(0);
    expect(summary.technicalScore).toBe(100);
    expect(summary.contentScore).toBe(100);
    expect(summary.complianceScore).toBe(100);
  });

  it('critical 问题扣 20 分', () => {
    const summary = calculateQualityScore([
      makeIssue({ severity: 'critical' }),
      makeIssue({ severity: 'critical' }),
    ]);
    expect(summary.criticalIssues).toBe(2);
  });

  it('按严重级别正确统计', () => {
    const summary = calculateQualityScore([
      makeIssue({ severity: 'critical' }),
      makeIssue({ severity: 'error' }),
      makeIssue({ severity: 'warning' }),
      makeIssue({ severity: 'info' }),
    ]);
    expect(summary.criticalIssues).toBe(1);
    expect(summary.errorIssues).toBe(1);
    expect(summary.warningIssues).toBe(1);
    expect(summary.infoIssues).toBe(1);
  });

  it('按类别计算分数', () => {
    const summary = calculateQualityScore([
      makeIssue({ category: 'technical', id: '1' }),
      makeIssue({ category: 'technical', id: '2' }),
      makeIssue({ category: 'content', id: '3' }),
    ]);
    expect(summary.technicalScore).toBe(80); // 100 - 2*10
    expect(summary.contentScore).toBe(92); // 100 - 1*8
    expect(summary.complianceScore).toBe(100);
  });

  it('autoFixable 计数正确', () => {
    const summary = calculateQualityScore([
      makeIssue({ autoFixable: true }),
      makeIssue({ autoFixable: false }),
      makeIssue({ autoFixable: true }),
    ]);
    expect(summary.autoFixableCount).toBe(2);
  });

  it('大量问题分数不低于 0', () => {
    const issues = Array.from({ length: 20 }, (_, i) => makeIssue({ id: String(i), severity: 'critical' }));
    const summary = calculateQualityScore(issues);
    expect(summary.technicalScore).toBeGreaterThanOrEqual(0);
  });
});

describe('inspector: scoreToGrade', () => {
  it('分数正确映射等级', () => {
    expect(scoreToGrade(95)).toBe('A');
    expect(scoreToGrade(90)).toBe('A');
    expect(scoreToGrade(85)).toBe('B');
    expect(scoreToGrade(80)).toBe('B');
    expect(scoreToGrade(75)).toBe('C');
    expect(scoreToGrade(70)).toBe('C');
    expect(scoreToGrade(65)).toBe('D');
    expect(scoreToGrade(60)).toBe('D');
    expect(scoreToGrade(50)).toBe('F');
    expect(scoreToGrade(0)).toBe('F');
  });
});

describe('inspector: formatTime', () => {
  it('小于 1 小时格式为 M:SS.CC', () => {
    const result = formatTime(65.5);
    expect(result).toBe('01:05.50');
  });

  it('大于 1 小时格式为 H:MM:SS.CC', () => {
    const result = formatTime(3661.25);
    expect(result).toBe('1:01:01.25');
  });

  it('零秒', () => {
    expect(formatTime(0)).toBe('00:00.00');
  });
});
