import { describe, expect, it } from 'vitest';
import {
  aggregatePreflightIssues,
  groupIssuesByCategory,
  buildPreflightAIPrompt,
  parsePreflightAIResponse,
  acknowledgePreflightIssue,
  type PreflightIssue,
  type PreflightReport,
} from '../src';
import { createProject } from '../src';
import type { Project } from '../src';

function makeProject(overrides: Partial<Project> = {}): Project {
  const p = createProject('Test Preflight');
  return { ...p, ...overrides };
}

describe('aggregatePreflightIssues', () => {
  it('returns empty for clean project with no warnings', () => {
    const project = makeProject();
    const issues = aggregatePreflightIssues(project);
    expect(issues).toEqual([]);
  });

  it('aggregates flash warnings from video clips', () => {
    const project = makeProject({
      timeline: {
        transitions: [],
        markers: [],
        tracks: [{
          id: 'track-1',
          type: 'video',
          name: 'Video 1',
          clips: [{
            id: 'clip-1',
            type: 'video',
            name: 'test.mp4',
            mediaId: 'media-1',
            trackId: 'track-1',
            start: 0,
            duration: 5,
            trimStart: 0,
            trimEnd: 0,
            speed: 1,
            volume: 1,
            colorCorrection: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, vibrance: 0, hue: 0, gamma: 0, exposure: 0 },
            transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
            flashWarnings: [
              { startTime: 1.0, endTime: 2.0, flashRate: 5.0, severity: 'high' as const, isRedFlash: true },
            ],
          }],
        }],
      },
    });
    const issues = aggregatePreflightIssues(project);
    expect(issues.length).toBe(1);
    expect(issues[0].category).toBe('flash');
    expect(issues[0].severity).toBe('critical');
    expect(issues[0].clipId).toBe('clip-1');
    expect(issues[0].time).toBe(1.0);
  });

  it('aggregates continuity warnings', () => {
    const project = makeProject({
      timeline: {
        transitions: [],
        markers: [],
        tracks: [],
        continuityWarnings: [
          { clipAId: 'clip-a', clipBId: 'clip-b', type: 'jump_cut', confidence: 0.9, reason: '跳切检测' },
        ],
      },
    });
    const issues = aggregatePreflightIssues(project);
    expect(issues.length).toBe(1);
    expect(issues[0].category).toBe('continuity');
    expect(issues[0].severity).toBe('warning');
  });

  it('aggregates color consistency warnings', () => {
    const project = makeProject({
      timeline: {
        transitions: [],
        markers: [],
        tracks: [],
        colorConsistencyWarnings: [
          { clipAId: 'clip-a', clipBId: 'clip-b', type: 'skin_tone', deltaRGB: 45.2, reason: '肤色ΔRGB=45.2 > 30' },
        ],
      },
    });
    const issues = aggregatePreflightIssues(project);
    expect(issues.length).toBe(1);
    expect(issues[0].category).toBe('colorConsistency');
  });

  it('aggregates reading speed warnings from subtitle clips', () => {
    const project = makeProject({
      timeline: {
        transitions: [],
        markers: [],
        tracks: [{
          id: 'track-sub',
          type: 'subtitle',
          name: 'Subtitles',
          clips: [{
            id: 'sub-1',
            type: 'subtitle',
            name: 'sub',
            trackId: 'track-sub',
            start: 0,
            duration: 3,
            trimStart: 0,
            trimEnd: 0,
            speed: 1,
            text: '测试字幕',
            style: { fontFamily: 'sans-serif', fontSize: 24, bold: false, italic: false, color: '#ffffff', outline: true, outlineColor: '#000000', outlineWidth: 2, shadow: false, shadowColor: '#000000', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, alignment: 'center' as const, verticalPosition: 0, backgroundType: 'none' as const, backgroundColor: '#000000', backgroundOpacity: 0, lineHeight: 1.2 },
            subtitleMode: 'normal' as const,
            readingSpeedWarning: { charsPerSecond: 15, recommendedMax: 10, severity: 'critical' as const },
          }],
        }],
      },
    });
    const issues = aggregatePreflightIssues(project);
    expect(issues.length).toBe(1);
    expect(issues[0].category).toBe('readingSpeed');
    expect(issues[0].severity).toBe('critical');
  });

  it('aggregates loudness suggestion', () => {
    const project = makeProject({
      loudnessSuggestion: { measuredLUFS: -20, targetPlatform: 'youtube', targetLUFS: -14, suggestedGainDb: 6, appliedAt: null },
    });
    const issues = aggregatePreflightIssues(project);
    expect(issues.length).toBe(1);
    expect(issues[0].category).toBe('loudness');
    expect(issues[0].severity).toBe('warning');
  });

  it('aggregates shake issues when shakeScore > 50', () => {
    const project = makeProject({
      timeline: {
        transitions: [],
        markers: [],
        tracks: [{
          id: 'track-1',
          type: 'video',
          name: 'Video 1',
          clips: [{
            id: 'clip-shake',
            type: 'video',
            name: 'shake.mp4',
            mediaId: 'media-1',
            trackId: 'track-1',
            start: 0,
            duration: 5,
            trimStart: 0,
            trimEnd: 0,
            speed: 1,
            volume: 1,
            colorCorrection: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, vibrance: 0, hue: 0, gamma: 0, exposure: 0 },
            transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
            stabilization: { enabled: true, smoothing: 10, zoom: 0, analyzed: true, shakeScore: 85, severity: 'high' },
          }],
        }],
      },
    });
    const issues = aggregatePreflightIssues(project);
    expect(issues.length).toBe(1);
    expect(issues[0].category).toBe('shake');
    expect(issues[0].severity).toBe('critical');
  });

  it('skips empty fields (no flashWarnings, no anomalies, etc.)', () => {
    const project = makeProject({
      timeline: {
        transitions: [],
        markers: [],
        tracks: [{
          id: 'track-1',
          type: 'video',
          name: 'Video 1',
          clips: [{
            id: 'clip-clean',
            type: 'video',
            name: 'clean.mp4',
            mediaId: 'media-1',
            trackId: 'track-1',
            start: 0,
            duration: 5,
            trimStart: 0,
            trimEnd: 0,
            speed: 1,
            volume: 1,
            colorCorrection: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, vibrance: 0, hue: 0, gamma: 0, exposure: 0 },
            transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
          }],
        }],
      },
    });
    const issues = aggregatePreflightIssues(project);
    expect(issues).toEqual([]);
  });

  it('multi-category aggregation with flash + continuity', () => {
    const project = makeProject({
      timeline: {
        transitions: [],
        markers: [],
        tracks: [{
          id: 'track-1',
          type: 'video',
          name: 'Video 1',
          clips: [{
            id: 'clip-1',
            type: 'video',
            name: 'test.mp4',
            mediaId: 'media-1',
            trackId: 'track-1',
            start: 0,
            duration: 5,
            trimStart: 0,
            trimEnd: 0,
            speed: 1,
            volume: 1,
            colorCorrection: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, vibrance: 0, hue: 0, gamma: 0, exposure: 0 },
            transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
            flashWarnings: [{ startTime: 1, endTime: 2, flashRate: 5, severity: 'medium' as const, isRedFlash: false }],
          }],
        }],
        continuityWarnings: [{ clipAId: 'clip-1', clipBId: 'clip-2', type: 'jump_cut' as const, confidence: 0.8, reason: '跳轴' }],
      },
    });
    const issues = aggregatePreflightIssues(project);
    expect(issues.length).toBe(2);
    const categories = issues.map((i) => i.category);
    expect(categories).toContain('flash');
    expect(categories).toContain('continuity');
  });
});

describe('groupIssuesByCategory', () => {
  it('groups issues by category, skipping empty', () => {
    const issues: PreflightIssue[] = [
      { id: 'f1', category: 'flash', severity: 'warning', message: 'flash 1' },
      { id: 'f2', category: 'flash', severity: 'warning', message: 'flash 2' },
      { id: 'c1', category: 'continuity', severity: 'warning', message: 'continuity 1' },
    ];
    const grouped = groupIssuesByCategory(issues);
    expect(Object.keys(grouped)).toHaveLength(2);
    expect(grouped.flash).toHaveLength(2);
    expect(grouped.continuity).toHaveLength(1);
  });

  it('returns empty object for no issues', () => {
    const grouped = groupIssuesByCategory([]);
    expect(Object.keys(grouped)).toHaveLength(0);
  });
});

describe('buildPreflightAIPrompt', () => {
  it('returns direct export message for empty issues', () => {
    const prompt = buildPreflightAIPrompt([]);
    expect(prompt).toContain('可以直接导出');
  });

  it('includes all issues in prompt', () => {
    const issues: PreflightIssue[] = [
      { id: 'f1', category: 'flash', severity: 'critical', message: '闪烁严重' },
      { id: 'c1', category: 'continuity', severity: 'warning', message: '跳切' },
    ];
    const prompt = buildPreflightAIPrompt(issues);
    expect(prompt).toContain('[CRITICAL]');
    expect(prompt).toContain('[WARNING]');
    expect(prompt).toContain('闪烁严重');
    expect(prompt).toContain('跳切');
  });
});

describe('parsePreflightAIResponse', () => {
  it('parses valid response', () => {
    const json = JSON.stringify({ summary: '发现2个问题', criticalCount: 1, warningCount: 1, recommendations: ['先修复闪烁'] });
    const result = parsePreflightAIResponse(json);
    expect(result).not.toBeNull();
    expect(result!.summary).toBe('发现2个问题');
    expect(result!.criticalCount).toBe(1);
    expect(result!.warningCount).toBe(1);
    expect(result!.recommendations).toHaveLength(1);
  });

  it('returns null for invalid JSON', () => {
    expect(parsePreflightAIResponse('not json')).toBeNull();
  });

  it('returns null for missing fields', () => {
    expect(parsePreflightAIResponse('{"summary":"ok"}')).toBeNull();
  });

  it('returns null for wrong types', () => {
    const json = JSON.stringify({ summary: 123, criticalCount: 'a', warningCount: 1, recommendations: [] });
    expect(parsePreflightAIResponse(json)).toBeNull();
  });
});

describe('acknowledgePreflightIssue', () => {
  it('adds issue ID to acknowledgedIssueIds', () => {
    const report: PreflightReport = {
      generatedAt: '',
      issuesByCategory: {},
      aiSummary: '',
      totalCritical: 0,
      totalWarnings: 0,
      acknowledgedIssueIds: [],
    };
    const result = acknowledgePreflightIssue(report, 'flash-1');
    expect(result.acknowledgedIssueIds).toEqual(['flash-1']);
  });

  it('deduplicates repeated acknowledgements', () => {
    const report: PreflightReport = {
      generatedAt: '',
      issuesByCategory: {},
      aiSummary: '',
      totalCritical: 0,
      totalWarnings: 0,
      acknowledgedIssueIds: ['flash-1'],
    };
    const result = acknowledgePreflightIssue(report, 'flash-1');
    expect(result).toBe(report);
    expect(result.acknowledgedIssueIds).toEqual(['flash-1']);
  });

  it('does not mutate original report', () => {
    const report: PreflightReport = {
      generatedAt: '',
      issuesByCategory: {},
      aiSummary: '',
      totalCritical: 0,
      totalWarnings: 0,
      acknowledgedIssueIds: [],
    };
    acknowledgePreflightIssue(report, 'new-id');
    expect(report.acknowledgedIssueIds).toEqual([]);
  });
});
