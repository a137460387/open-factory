/**
 * Quality Inspector - Multi-dimensional quality detection engine
 * Combines traditional CV algorithms with AI-based content analysis
 */

import type {
  InspectorConfig,
  QualityReport,
  InspectorQualityIssue,
  QualitySummary,
  FrameAnalysis,
  AudioAnalysis,
  PacingSegment,
  SceneTransition,
  ComplianceResult,
  ComplianceViolation,
  PlatformSpec,
  TimeRange,
  IssueSeverity,
  TechnicalDefectType,
  ContentIssueType,
} from './types';
import { formatTime } from '../utils/time';

import {
  DEFAULT_INSPECTOR_CONFIG,
  PLATFORM_SPECS,
} from './types';

let issueCounter = 0;

function generateIssueId(): string {
  issueCounter += 1;
  return `qi-${Date.now()}-${issueCounter}`;
}

/**
 * Detect black frames by analyzing pixel brightness
 * Returns true if frame is predominantly black
 */
export function detectBlackFrame(
  pixels: Uint8ClampedArray,
  threshold: number = DEFAULT_INSPECTOR_CONFIG.blackFrameThreshold,
): boolean {
  if (pixels.length === 0) return false;

  let totalBrightness = 0;
  const sampleSize = Math.min(pixels.length, 10000);
  const step = Math.max(1, Math.floor(pixels.length / sampleSize));

  for (let i = 0; i < pixels.length; i += step * 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    totalBrightness += (r * 0.299 + g * 0.587 + b * 0.114) / 255;
  }

  const avgBrightness = totalBrightness / (sampleSize);
  return avgBrightness < threshold;
}

/**
 * Detect color bars pattern (standard test pattern)
 */
export function detectColorBars(pixels: Uint8ClampedArray, width: number, height: number): boolean {
  if (width < 100 || height < 100) return false;

  const barWidth = Math.floor(width / 7);
  const expectedColors = [
    [255, 255, 255],
    [255, 255, 0],
    [0, 255, 255],
    [0, 255, 0],
    [255, 0, 255],
    [255, 0, 0],
    [0, 0, 255],
  ];

  let matchCount = 0;
  const sampleY = Math.floor(height / 2);

  for (let bar = 0; bar < 7; bar++) {
    const x = bar * barWidth + barWidth / 2;
    const idx = (sampleY * width + Math.floor(x)) * 4;
    const [er, eg, eb] = expectedColors[bar];

    const tolerance = 30;
    if (
      Math.abs(pixels[idx] - er) < tolerance &&
      Math.abs(pixels[idx + 1] - eg) < tolerance &&
      Math.abs(pixels[idx + 2] - eb) < tolerance
    ) {
      matchCount++;
    }
  }

  return matchCount >= 5;
}

/**
 * Detect static frames (no motion between frames)
 * Returns motion score (0 = static, 1 = high motion)
 */
export function calculateMotionScore(
  prevFrame: Uint8ClampedArray,
  currFrame: Uint8ClampedArray,
): number {
  if (prevFrame.length === 0 || currFrame.length === 0) return 0;
  if (prevFrame.length !== currFrame.length) return 0;

  let totalDiff = 0;
  const sampleSize = Math.min(prevFrame.length, 10000);
  const step = Math.max(1, Math.floor(prevFrame.length / sampleSize));
  let samples = 0;

  for (let i = 0; i < prevFrame.length; i += step * 4) {
    const diff =
      Math.abs(prevFrame[i] - currFrame[i]) +
      Math.abs(prevFrame[i + 1] - currFrame[i + 1]) +
      Math.abs(prevFrame[i + 2] - currFrame[i + 2]);
    totalDiff += diff / (255 * 3);
    samples++;
  }

  return samples > 0 ? totalDiff / samples : 0;
}

/**
 * Analyze audio samples for clipping, silence, and distortion
 */
export function analyzeAudioSegment(
  samples: Float32Array,
  config: InspectorConfig = DEFAULT_INSPECTOR_CONFIG,
): AudioAnalysis {
  if (samples.length === 0) {
    return {
      timestamp: 0,
      rmsDb: -Infinity,
      peakDb: -Infinity,
      isClipping: false,
      isSilent: true,
      isDistorted: false,
      spectralCentroid: 0,
    };
  }

  let sumSquares = 0;
  let peak = 0;

  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    sumSquares += samples[i] * samples[i];
    if (abs > peak) peak = abs;
  }

  const rms = Math.sqrt(sumSquares / samples.length);
  const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
  const peakDb = peak > 0 ? 20 * Math.log10(peak) : -Infinity;

  const isClipping = peakDb > config.clippingThresholdDb;
  const isSilent = rmsDb < config.silenceThresholdDb;

  // Simple distortion detection: high peak-to-rms ratio
  const crestFactor = rms > 0 ? peak / rms : 0;
  const isDistorted = crestFactor > 10 && !isSilent;

  // Simplified spectral centroid estimation
  const spectralCentroid = estimateSpectralCentroid(samples);

  return {
    timestamp: 0,
    rmsDb,
    peakDb,
    isClipping,
    isSilent,
    isDistorted,
    spectralCentroid,
  };
}

/**
 * Estimate spectral centroid from time-domain samples
 * Higher values indicate brighter/harsher sound
 */
function estimateSpectralCentroid(samples: Float32Array): number {
  if (samples.length < 64) return 0;

  // Simple zero-crossing rate as proxy for spectral content
  let crossings = 0;
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i] >= 0 && samples[i - 1] < 0) || (samples[i] < 0 && samples[i - 1] >= 0)) {
      crossings++;
    }
  }

  return crossings / samples.length;
}

/**
 * Analyze frame sequence for technical defects
 */
export function analyzeFrames(
  frames: Array<{ timestamp: number; pixels: Uint8ClampedArray; width: number; height: number }>,
  config: InspectorConfig = DEFAULT_INSPECTOR_CONFIG,
): FrameAnalysis[] {
  const analyses: FrameAnalysis[] = [];

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const isBlack = detectBlackFrame(frame.pixels, config.blackFrameThreshold);
    const isColorBars = detectColorBars(frame.pixels, frame.width, frame.height);

    let motionScore = 0;
    if (i > 0) {
      motionScore = calculateMotionScore(frames[i - 1].pixels, frame.pixels);
    }

    const isStatic = motionScore < config.staticFrameThreshold && i > 0;

    // Calculate brightness and contrast
    let totalBrightness = 0;
    let minBrightness = 255;
    let maxBrightness = 0;
    const sampleSize = Math.min(frame.pixels.length, 5000);
    const step = Math.max(1, Math.floor(frame.pixels.length / sampleSize));
    let samples = 0;

    for (let j = 0; j < frame.pixels.length; j += step * 4) {
      const brightness = frame.pixels[j] * 0.299 + frame.pixels[j + 1] * 0.587 + frame.pixels[j + 2] * 0.114;
      totalBrightness += brightness;
      minBrightness = Math.min(minBrightness, brightness);
      maxBrightness = Math.max(maxBrightness, brightness);
      samples++;
    }

    const avgBrightness = samples > 0 ? totalBrightness / samples / 255 : 0;
    const contrast = samples > 0 ? (maxBrightness - minBrightness) / 255 : 0;

    analyses.push({
      timestamp: frame.timestamp,
      isBlack,
      isStatic,
      isColorBars,
      brightness: avgBrightness,
      contrast,
      motionScore,
    });
  }

  return analyses;
}

/**
 * Detect scene transitions from frame analyses
 */
export function detectQualitySceneTransitions(
  frameAnalyses: FrameAnalysis[],
  motionThreshold: number = 0.3,
): SceneTransition[] {
  const transitions: SceneTransition[] = [];

  for (let i = 1; i < frameAnalyses.length; i++) {
    const prev = frameAnalyses[i - 1];
    const curr = frameAnalyses[i];
    const motionDelta = Math.abs(curr.motionScore - prev.motionScore);

    if (motionDelta > motionThreshold) {
      const brightnessDelta = Math.abs(curr.brightness - prev.brightness);

      let type: SceneTransition['type'] = 'cut';
      if (brightnessDelta > 0.5) {
        type = 'fade';
      } else if (motionDelta > 0.6) {
        type = 'dissolve';
      }

      transitions.push({
        time: curr.timestamp,
        type,
        confidence: Math.min(1, motionDelta),
        isDiscontinuous: motionDelta > 0.8,
      });
    }
  }

  return transitions;
}

/**
 * Analyze pacing from scene transitions
 */
export function analyzeQualityPacing(
  transitions: SceneTransition[],
  totalDuration: number,
  windowSeconds: number = 30,
): PacingSegment[] {
  if (transitions.length === 0 || totalDuration <= 0) return [];

  const segments: PacingSegment[] = [];
  const avgCPM = (transitions.length / totalDuration) * 60;

  for (let t = 0; t < totalDuration; t += windowSeconds / 2) {
    const windowEnd = t + windowSeconds;
    const cutsInWindow = transitions.filter(
      (tr) => tr.time >= t && tr.time < windowEnd,
    ).length;
    const cpm = (cutsInWindow / windowSeconds) * 60;

    let classification: PacingSegment['classification'] = 'normal';
    if (cpm < avgCPM * DEFAULT_INSPECTOR_CONFIG.slowPacingRatio) {
      classification = 'slow';
    } else if (cpm > avgCPM * DEFAULT_INSPECTOR_CONFIG.fastPacingRatio) {
      classification = 'fast';
    }

    segments.push({
      timeRange: { start: t, end: Math.min(windowEnd, totalDuration) },
      cutsPerMinute: cpm,
      classification,
    });
  }

  return segments;
}

/**
 * Check compliance against platform specifications
 */
export function checkPlatformCompliance(
  mediaInfo: {
    width: number;
    height: number;
    frameRate: number;
    duration: number;
    audioSampleRate: number;
    audioChannels: number;
    fileSize?: number;
    videoBitrate?: number;
    audioBitrate?: number;
  },
  platformId: string = DEFAULT_INSPECTOR_CONFIG.targetPlatform,
): ComplianceResult {
  const spec = PLATFORM_SPECS[platformId as keyof typeof PLATFORM_SPECS] || PLATFORM_SPECS.custom;
  const violations: ComplianceViolation[] = [];

  // Resolution check
  if (mediaInfo.width !== spec.width || mediaInfo.height !== spec.height) {
    const actualRatio = mediaInfo.width / mediaInfo.height;
    const expectedRatio = spec.aspectRatio;
    if (Math.abs(actualRatio - expectedRatio) > 0.01) {
      violations.push({
        parameter: 'aspectRatio',
        expected: expectedRatio.toFixed(2),
        actual: actualRatio.toFixed(2),
        severity: 'error',
      });
    }
    if (mediaInfo.width < spec.width || mediaInfo.height < spec.height) {
      violations.push({
        parameter: 'resolution',
        expected: `${spec.width}x${spec.height}`,
        actual: `${mediaInfo.width}x${mediaInfo.height}`,
        severity: 'warning',
      });
    }
  }

  // Duration check
  if (mediaInfo.duration > spec.maxDuration) {
    violations.push({
      parameter: 'duration',
      expected: `<= ${spec.maxDuration}s`,
      actual: `${mediaInfo.duration.toFixed(1)}s`,
      severity: 'error',
    });
  }
  if (spec.minDuration && mediaInfo.duration < spec.minDuration) {
    violations.push({
      parameter: 'duration',
      expected: `>= ${spec.minDuration}s`,
      actual: `${mediaInfo.duration.toFixed(1)}s`,
      severity: 'error',
    });
  }

  // Frame rate check
  if (Math.abs(mediaInfo.frameRate - spec.frameRate) > 0.1) {
    violations.push({
      parameter: 'frameRate',
      expected: spec.frameRate,
      actual: mediaInfo.frameRate,
      severity: 'warning',
    });
  }

  // Audio sample rate check
  if (mediaInfo.audioSampleRate !== spec.audioSampleRate) {
    violations.push({
      parameter: 'audioSampleRate',
      expected: spec.audioSampleRate,
      actual: mediaInfo.audioSampleRate,
      severity: 'warning',
    });
  }

  // Audio channels check
  if (mediaInfo.audioChannels !== spec.audioChannels) {
    violations.push({
      parameter: 'audioChannels',
      expected: spec.audioChannels,
      actual: mediaInfo.audioChannels,
      severity: 'info',
    });
  }

  // File size check
  if (spec.maxFileSize && mediaInfo.fileSize && mediaInfo.fileSize > spec.maxFileSize) {
    violations.push({
      parameter: 'fileSize',
      expected: `<= ${(spec.maxFileSize / 1024 / 1024).toFixed(0)}MB`,
      actual: `${(mediaInfo.fileSize / 1024 / 1024).toFixed(0)}MB`,
      severity: 'error',
    });
  }

  return {
    platform: platformId as any,
    passed: violations.length === 0,
    violations,
  };
}

/**
 * Generate quality issues from analyses
 */
export function generateIssues(
  frameAnalyses: FrameAnalysis[],
  audioAnalyses: AudioAnalysis[],
  pacingSegments: PacingSegment[],
  sceneTransitions: SceneTransition[],
  complianceResult: ComplianceResult,
  config: InspectorConfig,
): InspectorQualityIssue[] {
  const issues: InspectorQualityIssue[] = [];

  // Technical issues from frame analysis
  for (const frame of frameAnalyses) {
    if (frame.isBlack) {
      issues.push({
        id: generateIssueId(),
        category: 'technical',
        type: 'black-frame',
        severity: 'warning',
        timeRange: { start: frame.timestamp, end: frame.timestamp + config.frameSampleInterval },
        description: `检测到黑帧 (时间: ${formatTime(frame.timestamp)})`,
        suggestion: '检查素材是否完整，或在黑帧位置添加转场',
        autoFixable: false,
      });
    }

    if (frame.isColorBars) {
      issues.push({
        id: generateIssueId(),
        category: 'technical',
        type: 'color-bars',
        severity: 'error',
        timeRange: { start: frame.timestamp, end: frame.timestamp + config.frameSampleInterval },
        description: `检测到彩条测试图案 (时间: ${formatTime(frame.timestamp)})`,
        suggestion: '移除测试图案，使用正式素材',
        autoFixable: false,
      });
    }

    if (frame.isStatic) {
      issues.push({
        id: generateIssueId(),
        category: 'technical',
        type: 'static-frame',
        severity: 'warning',
        timeRange: { start: frame.timestamp, end: frame.timestamp + config.frameSampleInterval },
        description: `检测到静帧 (时间: ${formatTime(frame.timestamp)})`,
        suggestion: '检查是否为冻结帧效果，或素材可能损坏',
        autoFixable: false,
      });
    }
  }

  // Audio issues
  for (const audio of audioAnalyses) {
    if (audio.isClipping) {
      issues.push({
        id: generateIssueId(),
        category: 'technical',
        type: 'audio-clipping',
        severity: 'error',
        timeRange: { start: audio.timestamp, end: audio.timestamp + config.audioSampleInterval },
        description: `检测到音频爆音 (时间: ${formatTime(audio.timestamp)}, 峰值: ${audio.peakDb.toFixed(1)}dB)`,
        suggestion: '降低音频音量或使用限幅器',
        autoFixable: true,
      });
    }

    if (audio.isSilent && !audio.isClipping) {
      issues.push({
        id: generateIssueId(),
        category: 'technical',
        type: 'audio-clipping',
        severity: 'info',
        timeRange: { start: audio.timestamp, end: audio.timestamp + config.audioSampleInterval },
        description: `检测到静音段 (时间: ${formatTime(audio.timestamp)})`,
        suggestion: '检查是否为预期的静音，或添加背景音乐',
        autoFixable: false,
      });
    }
  }

  // Pacing issues
  for (const segment of pacingSegments) {
    if (segment.classification === 'slow') {
      issues.push({
        id: generateIssueId(),
        category: 'content',
        type: 'pacing-slow',
        severity: 'warning',
        timeRange: segment.timeRange,
        description: `节奏过慢 (${formatTime(segment.timeRange.start)} - ${formatTime(segment.timeRange.end)}: ${segment.cutsPerMinute.toFixed(1)} CPM)`,
        suggestion: '考虑剪辑冗余片段或加快节奏',
        autoFixable: false,
      });
    } else if (segment.classification === 'fast') {
      issues.push({
        id: generateIssueId(),
        category: 'content',
        type: 'pacing-fast',
        severity: 'warning',
        timeRange: segment.timeRange,
        description: `节奏过快 (${formatTime(segment.timeRange.start)} - ${formatTime(segment.timeRange.end)}: ${segment.cutsPerMinute.toFixed(1)} CPM)`,
        suggestion: '考虑延长片段或减少切换频率',
        autoFixable: false,
      });
    }
  }

  // Scene discontinuity
  for (const transition of sceneTransitions) {
    if (transition.isDiscontinuous) {
      issues.push({
        id: generateIssueId(),
        category: 'content',
        type: 'scene-discontinuity',
        severity: 'warning',
        timeRange: { start: transition.time - 0.5, end: transition.time + 0.5 },
        description: `场景不连贯 (时间: ${formatTime(transition.time)})`,
        suggestion: '添加转场效果或调整剪辑点',
        autoFixable: true,
      });
    }
  }

  // Compliance violations
  for (const violation of complianceResult.violations) {
    issues.push({
      id: generateIssueId(),
      category: 'compliance',
      type: `compliance-${violation.parameter}`,
      severity: violation.severity,
      description: `${violation.parameter} 不符合规范: 期望 ${violation.expected}, 实际 ${violation.actual}`,
      suggestion: `调整 ${violation.parameter} 以符合平台要求`,
      autoFixable: false,
    });
  }

  return issues;
}

/**
 * Calculate overall quality score and grade
 */
export function calculateQualityScore(issues: InspectorQualityIssue[]): QualitySummary {
  const totalIssues = issues.length;
  const criticalIssues = issues.filter((i) => i.severity === 'critical').length;
  const errorIssues = issues.filter((i) => i.severity === 'error').length;
  const warningIssues = issues.filter((i) => i.severity === 'warning').length;
  const infoIssues = issues.filter((i) => i.severity === 'info').length;
  const autoFixableCount = issues.filter((i) => i.autoFixable).length;

  // Deduct points based on severity
  let score = 100;
  score -= criticalIssues * 20;
  score -= errorIssues * 10;
  score -= warningIssues * 5;
  score -= infoIssues * 1;
  score = Math.max(0, Math.min(100, score));

  // Category scores
  const technicalIssues = issues.filter((i) => i.category === 'technical');
  const contentIssues = issues.filter((i) => i.category === 'content');
  const complianceIssues = issues.filter((i) => i.category === 'compliance');

  const technicalScore = Math.max(0, 100 - technicalIssues.length * 10);
  const contentScore = Math.max(0, 100 - contentIssues.length * 8);
  const complianceScore = Math.max(0, 100 - complianceIssues.length * 15);

  return {
    totalIssues,
    criticalIssues,
    errorIssues,
    warningIssues,
    infoIssues,
    technicalScore,
    contentScore,
    complianceScore,
    autoFixableCount,
  };
}

/**
 * Map score to letter grade
 */
export function scoreToGrade(score: number): QualityReport['grade'] {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Format time in seconds to HH:MM:SS format
 */
export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

/**
 * Run complete quality inspection
 */
export async function runQualityInspection(
  mediaData: {
    frames: Array<{ timestamp: number; pixels: Uint8ClampedArray; width: number; height: number }>;
    audioSegments: Array<{ timestamp: number; samples: Float32Array }>;
    mediaInfo: {
      width: number;
      height: number;
      frameRate: number;
      duration: number;
      audioSampleRate: number;
      audioChannels: number;
      fileSize?: number;
    };
  },
  config: InspectorConfig = DEFAULT_INSPECTOR_CONFIG,
): Promise<QualityReport> {
  const startTime = performance.now();

  // Step 1: Analyze frames for technical defects
  const frameAnalyses = config.enableTechnicalDetection
    ? analyzeFrames(mediaData.frames, config)
    : [];

  // Step 2: Analyze audio segments
  const audioAnalyses: AudioAnalysis[] = [];
  if (config.enableTechnicalDetection) {
    for (const segment of mediaData.audioSegments) {
      const analysis = analyzeAudioSegment(segment.samples, config);
      analysis.timestamp = segment.timestamp;
      audioAnalyses.push(analysis);
    }
  }

  // Step 3: Detect scene transitions
  const sceneTransitions = config.enableContentAnalysis
    ? detectQualitySceneTransitions(frameAnalyses)
    : [];

  // Step 4: Analyze pacing
  const pacingSegments = config.enableContentAnalysis
    ? analyzeQualityPacing(sceneTransitions, mediaData.mediaInfo.duration)
    : [];

  // Step 5: Check compliance
  const complianceResult = config.enableComplianceCheck
    ? checkPlatformCompliance(mediaData.mediaInfo, config.targetPlatform)
    : { platform: config.targetPlatform, passed: true, violations: [] };

  // Step 6: Generate issues
  const issues = generateIssues(
    frameAnalyses,
    audioAnalyses,
    pacingSegments,
    sceneTransitions,
    complianceResult,
    config,
  );

  // Step 7: Calculate score
  const summary = calculateQualityScore(issues);
  const grade = scoreToGrade(summary.technicalScore * 0.4 + summary.contentScore * 0.35 + summary.complianceScore * 0.25);
  const overallScore = Math.round(summary.technicalScore * 0.4 + summary.contentScore * 0.35 + summary.complianceScore * 0.25);

  const duration = performance.now() - startTime;

  return {
    id: `report-${Date.now()}`,
    timestamp: Date.now(),
    duration,
    overallScore,
    grade,
    issues,
    frameAnalyses,
    audioAnalyses,
    pacingSegments,
    sceneTransitions,
    complianceResults: [complianceResult],
    summary,
  };
}
