import { describe, expect, it } from 'vitest';
import {
  analyzeExportOptimizationSuggestions,
  applyExportOptimizationSuggestion,
  normalizeExportOptimizationSettings,
  type MediaAsset,
  type Project
} from '../src';
import { makeProject, makeTimeline, makeVideoClip } from './test-utils';

describe('export optimization suggestions', () => {
  it('suggests hardware/proxy workflow for 4K media exported to 1080p', () => {
    const project = makeProjectWithMedia([makeAsset({ id: 'media-4k', width: 3840, height: 2160 })]);

    const suggestions = analyzeExportOptimizationSuggestions(project, { width: 1920, height: 1080, fps: 30, format: 'mp4' });

    expect(suggestions).toContainEqual(expect.objectContaining({ id: 'proxy-for-4k-downscale', mediaIds: ['media-4k'] }));
  });

  it('suggests frame-rate unification for 60fps media exported as 30fps', () => {
    const project = makeProjectWithMedia([makeAsset({ id: 'media-60', frameRate: 60 })]);

    const suggestions = analyzeExportOptimizationSuggestions(project, { width: 1920, height: 1080, fps: 30, format: 'mp4' });

    expect(suggestions).toContainEqual(expect.objectContaining({ id: 'unify-frame-rate', value: 30, targetValue: 60 }));
  });

  it('suggests loudness normalization from measured low LUFS', () => {
    const project = makeProjectWithMedia([makeAsset({ id: 'media-audio', type: 'audio', width: 0, height: 0 })]);

    const suggestions = analyzeExportOptimizationSuggestions(project, { format: 'mp4', loudnessNormalization: 'off' }, undefined, { measuredIntegratedLufs: -28 });

    expect(suggestions).toContainEqual(expect.objectContaining({ id: 'normalize-loudness', value: -28, targetValue: -14 }));
  });

  it('suggests CFR conversion for VFR media and can dismiss suggestions', () => {
    const project = makeProjectWithMedia([
      makeAsset({
        id: 'media-vfr',
        variableFrameRate: true,
        avgFrameRate: '30000/1001',
        realFrameRate: '60000/1001'
      })
    ]);

    const suggestions = analyzeExportOptimizationSuggestions(project, { fps: 30 }, { dismissedSuggestionIds: ['proxy-for-4k-downscale'] });
    const dismissed = analyzeExportOptimizationSuggestions(project, { fps: 30 }, { dismissedSuggestionIds: ['convert-vfr-to-cfr'] });

    expect(suggestions).toContainEqual(expect.objectContaining({ id: 'convert-vfr-to-cfr', targetValue: 29.97 }));
    expect(dismissed.map((suggestion) => suggestion.id)).not.toContain('convert-vfr-to-cfr');
  });

  it('suggests parallel render farm for projects over 30 minutes', () => {
    const project = makeProjectWithMedia([makeAsset({ id: 'media-long', duration: 2_000 })], 2_000);

    const suggestions = analyzeExportOptimizationSuggestions(project, { fps: 30 }, undefined, { suggestedRenderFarmInstances: 3 });

    expect(suggestions).toContainEqual(expect.objectContaining({ id: 'parallel-long-export', targetValue: 3 }));
  });

  it('applies each suggestion to export settings or render-farm state', () => {
    expect(applyExportOptimizationSuggestion('proxy-for-4k-downscale', { format: 'mp4' }).settings).toMatchObject({
      hardwareEncoding: true,
      scaleMode: 'fit'
    });
    expect(applyExportOptimizationSuggestion({ id: 'unify-frame-rate', severity: 'warning', mediaIds: [], targetValue: 60 }, { fps: 30 }).settings.fps).toBe(60);
    expect(applyExportOptimizationSuggestion('normalize-loudness', {}).settings.loudnessNormalization).toBe('youtube');
    expect(applyExportOptimizationSuggestion({ id: 'convert-vfr-to-cfr', severity: 'warning', mediaIds: [], targetValue: 29.97 }, { fps: 30 }).settings.fps).toBe(29.97);
    expect(applyExportOptimizationSuggestion({ id: 'parallel-long-export', severity: 'info', mediaIds: [], targetValue: 4 }, {}).renderFarm).toEqual({
      enabled: true,
      instances: 4
    });
  });

  it('normalizes persisted dismissed suggestion ids', () => {
    expect(
      normalizeExportOptimizationSettings({
        dismissedSuggestionIds: ['normalize-loudness', 'normalize-loudness', 'unknown']
      }).dismissedSuggestionIds
    ).toEqual(['normalize-loudness']);
  });
});

function makeProjectWithMedia(media: MediaAsset[], duration = 6): Project {
  const project = makeProject();
  const [first] = media;
  project.media = media;
  project.timeline = makeTimeline([
    first?.type === 'audio'
      ? ({ ...makeVideoClip({ mediaId: first.id, duration }), type: 'audio', trackId: 'track-audio', volume: 1 } as never)
      : makeVideoClip({ mediaId: first?.id ?? 'media-1', duration })
  ]);
  return project;
}

function makeAsset(overrides: Partial<MediaAsset> & { id: string }): MediaAsset {
  return {
    id: overrides.id,
    type: overrides.type ?? 'video',
    name: `${overrides.id}.mp4`,
    path: `C:/Media/${overrides.id}.mp4`,
    duration: overrides.duration ?? 6,
    width: overrides.width ?? 1920,
    height: overrides.height ?? 1080,
    size: 4096,
    mtimeMs: 1000,
    frameRate: overrides.frameRate,
    avgFrameRate: overrides.avgFrameRate,
    realFrameRate: overrides.realFrameRate,
    variableFrameRate: overrides.variableFrameRate
  };
}
