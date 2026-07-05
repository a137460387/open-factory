import { describe, expect, it } from 'vitest';
import type { Project } from '../src/model-types';
import {
  buildExportPresetRecommendations,
  buildExportRecommendationContext,
  checkProjectHasHdrMedia,
  hasSubtitleTracks,
  isHdrMediaProfile,
  type ExportRecommendationContext,
  type ExportRecommendationReasonCode
} from '../src/export/export-preset-recommendations';
import { createProject } from '../src/model';

function makeProject(overrides: Partial<Project> = {}): Project {
  return { ...createProject('test'), ...overrides };
}

function makeContext(overrides: Partial<ExportRecommendationContext> = {}): ExportRecommendationContext {
  return {
    width: 1920,
    height: 1080,
    duration: 120,
    hasSubtitles: false,
    hasHdrMedia: false,
    ...overrides
  };
}

describe('buildExportRecommendationContext', () => {
  it('detects portrait resolution from project settings', () => {
    const project = makeProject();
    project.settings.width = 1080;
    project.settings.height = 1920;
    const context = buildExportRecommendationContext(project);
    expect(context.width).toBe(1080);
    expect(context.height).toBe(1920);
  });

  it('detects subtitle tracks in project', () => {
    const project = makeProject();
    project.timeline.tracks.push({
      id: 'sub-track-1',
      type: 'subtitle',
      name: '字幕',
      clips: [{ id: 'sub-1', type: 'subtitle', start: 0, duration: 5, text: 'hello', style: {} as any, subtitleMode: 'soft-sub' }]
    } as any);
    const context = buildExportRecommendationContext(project);
    expect(context.hasSubtitles).toBe(true);
  });
});

describe('buildExportPresetRecommendations', () => {
  it('recommends tiktok for portrait short video', () => {
    const context = makeContext({ width: 1080, height: 1920, duration: 30 });
    const results = buildExportPresetRecommendations(context, (code) => code);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].presetId).toBe('tiktok');
  });

  it('includes resolution reason for portrait project', () => {
    const context = makeContext({ width: 1080, height: 1920, duration: 30 });
    const results = buildExportPresetRecommendations(context, (code) => code);
    const tiktok = results.find((r) => r.presetId === 'tiktok');
    expect(tiktok).toBeDefined();
    expect(tiktok!.reasons.some((r) => r.code === 'resolution')).toBe(true);
  });

  it('includes duration reason for short project', () => {
    const context = makeContext({ width: 1080, height: 1920, duration: 30 });
    const results = buildExportPresetRecommendations(context, (code) => code);
    const tiktok = results.find((r) => r.presetId === 'tiktok');
    expect(tiktok).toBeDefined();
    expect(tiktok!.reasons.some((r) => r.code === 'duration')).toBe(true);
  });

  it('includes subtitles reason when project has subtitles', () => {
    const context = makeContext({ width: 1080, height: 1920, duration: 30, hasSubtitles: true });
    const results = buildExportPresetRecommendations(context, (code) => code);
    const tiktok = results.find((r) => r.presetId === 'tiktok');
    expect(tiktok).toBeDefined();
    expect(tiktok!.reasons.some((r) => r.code === 'subtitles')).toBe(true);
  });

  it('includes hdr reason when project has HDR media', () => {
    const context = makeContext({ width: 1080, height: 1920, duration: 30, hasHdrMedia: true });
    const results = buildExportPresetRecommendations(context, (code) => code);
    const tiktok = results.find((r) => r.presetId === 'tiktok');
    expect(tiktok).toBeDefined();
    expect(tiktok!.reasons.some((r) => r.code === 'hdr')).toBe(true);
  });

  it('returns at most 3 recommendations', () => {
    const context = makeContext({ width: 1080, height: 1920, duration: 30, hasSubtitles: true, hasHdrMedia: true });
    const results = buildExportPresetRecommendations(context, (code) => code);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it('generates human-readable reason label via labelFn', () => {
    const context = makeContext({ width: 1080, height: 1920, duration: 30 });
    const labelMap: Record<ExportRecommendationReasonCode, string> = {
      resolution: '竖屏短视频',
      duration: '60秒以内',
      subtitles: '含字幕',
      hdr: '含HDR素材'
    };
    const results = buildExportPresetRecommendations(context, (code) => labelMap[code]);
    expect(results[0].reasons[0].label).toBe('竖屏短视频');
  });
});

describe('hasSubtitleTracks', () => {
  it('returns false for project without subtitle tracks', () => {
    expect(hasSubtitleTracks(makeProject())).toBe(false);
  });

  it('returns true when project has subtitle clips', () => {
    const project = makeProject();
    project.timeline.tracks.push({
      id: 'sub-track',
      type: 'subtitle',
      name: '字幕',
      clips: [{ id: 'sub-1', type: 'subtitle', start: 0, duration: 3, text: 'hi', style: {} as any, subtitleMode: 'soft-sub' }]
    } as any);
    expect(hasSubtitleTracks(project)).toBe(true);
  });
});

describe('checkProjectHasHdrMedia', () => {
  it('returns false for project without HDR media', () => {
    expect(checkProjectHasHdrMedia(makeProject())).toBe(false);
  });

  it('returns true when project media has rec2020 color profile', () => {
    const project = makeProject();
    project.media.push({
      id: 'hdr-asset',
      type: 'video',
      name: 'hdr.mp4',
      path: '/hdr.mp4',
      duration: 10,
      width: 3840,
      height: 2160,
      colorProfile: { sourceColorSpace: 'rec2020', label: 'BT.2020' }
    });
    expect(checkProjectHasHdrMedia(project)).toBe(true);
  });
});

describe('isHdrMediaProfile', () => {
  it('returns false for undefined profile', () => {
    expect(isHdrMediaProfile(undefined)).toBe(false);
  });

  it('returns true for rec2020 profile', () => {
    expect(isHdrMediaProfile({ sourceColorSpace: 'rec2020', label: 'BT.2020' })).toBe(true);
  });

  it('returns false for sRGB profile', () => {
    expect(isHdrMediaProfile({ sourceColorSpace: 'srgb', label: 'sRGB' })).toBe(false);
  });
});

describe('buildExportPresetRecommendations default labelFn', () => {
  it('uses default labelFn when no labelFn provided', () => {
    const context = makeContext({ width: 1080, height: 1920, duration: 30 });
    const results = buildExportPresetRecommendations(context);
    expect(results.length).toBeGreaterThan(0);
    const first = results[0];
    expect(first.reasons[0].label).toBe('portrait');
  });

  it('generates duration label for short duration via default labelFn', () => {
    const context = makeContext({ width: 1080, height: 1920, duration: 30 });
    const results = buildExportPresetRecommendations(context);
    expect(results.length).toBeGreaterThan(0);
    const durationReason = results[0].reasons.find((r) => r.code === 'duration');
    expect(durationReason?.label).toBe('short');
  });

  it('generates subtitles label when hasSubtitles via default labelFn', () => {
    const context = makeContext({ width: 1080, height: 1920, duration: 30, hasSubtitles: true });
    const results = buildExportPresetRecommendations(context);
    expect(results.length).toBeGreaterThan(0);
    const subtitleReason = results[0].reasons.find((r) => r.code === 'subtitles');
    expect(subtitleReason?.label).toBe('subtitles');
  });

  it('generates hdr label when hasHdrMedia', () => {
    const context = makeContext({ width: 1080, height: 1920, duration: 30, hasHdrMedia: true });
    const results = buildExportPresetRecommendations(context);
    expect(results.length).toBeGreaterThan(0);
    const hdrReason = results[0].reasons.find((r) => r.code === 'hdr');
    expect(hdrReason?.label).toBe('hdr');
  });

  it('scores landscape presets for landscape resolution', () => {
    const context = makeContext({ width: 1920, height: 1080, duration: 120 });
    const results = buildExportPresetRecommendations(context, (code) => code);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].reasons.some((r) => r.code === 'resolution')).toBe(true);
  });
});

describe('checkProjectHasHdrMedia media without colorProfile', () => {
  it('returns false for media entries that lack colorProfile', () => {
    const project = makeProject();
    project.media.push({
      id: 'sdr-asset',
      type: 'video',
      name: 'sdr.mp4',
      path: '/sdr.mp4',
      duration: 10,
      width: 1920,
      height: 1080
    });
    expect(checkProjectHasHdrMedia(project)).toBe(false);
  });
});
