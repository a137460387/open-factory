import { describe, expect, it } from 'vitest';
import { createProject, createTrack, type Clip, type MediaAsset } from '@open-factory/editor-core';
import { buildFrameInterpolationComparePreviewPlan } from './frameInterpolationComparePreview';

describe('frame interpolation compare preview plan', () => {
  const asset: MediaAsset = {
    id: 'media-video',
    type: 'video',
    name: 'source.mp4',
    path: 'C:/Media/source.mp4',
    duration: 8,
    width: 1280,
    height: 720
  };
  const clip: Extract<Clip, { type: 'video' }> = {
    id: 'clip-video',
    type: 'video',
    name: 'source.mp4',
    mediaId: asset.id,
    trackId: 'track-video',
    start: 2,
    duration: 4,
    volume: 1,
    trimStart: 1,
    trimEnd: 0,
    speed: 1,
    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
    frameInterpolation: { enabled: false, targetFps: 60 },
    slowMotionMode: 'none'
  };

  it('builds four preview samples with mode-specific minterpolate filters', () => {
    const project = {
      ...createProject('Compare'),
      media: [asset],
      settings: { ...createProject('Compare').settings, fps: 30, width: 1280, height: 720 },
      timeline: {
        transitions: [],
        markers: [],
        tracks: [createTrack({ id: 'track-video', type: 'video', name: 'Video', clips: [clip] })]
      }
    };
    const plan = buildFrameInterpolationComparePreviewPlan(project, clip, asset, 3, 'C:/Preview', {
      original: '原始',
      blend: 'Blend',
      mci: 'MCI',
      'optical-flow': 'Optical Flow'
    });

    expect(plan.samples).toHaveLength(4);
    expect(plan.samples[0].plan.filterComplex).not.toContain('minterpolate=');
    expect(plan.samples[1].plan.filterComplex).toContain('minterpolate=fps=60:mi_mode=blend');
    expect(plan.samples[2].plan.filterComplex).toContain('minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc');
    expect(plan.samples[3].plan.filterComplex).toContain('minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:vsbmc=1');
    expect(plan.items.map((item) => item.sourceFrameTimes)).toEqual(plan.items.map(() => [2.933, 2.967, 3, 3.033, 3.067]));
  });
});
