import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COLOR_CORRECTION,
  isDefaultColorCorrection,
  normalizeColorCorrection,
} from '../src';
import { normalizeLutLayers, type LUTLayer } from '../src/model';
import { createDefaultColorNodeGraph, buildColorNodeGraphFilterPlan, type ColorNodeGraph } from '../src/color-node-graph';
import { makeProject, makeVideoClip } from './test-utils';
import { buildExportProjectFromProject, buildFfmpegExportPlan } from '../src/export/ffmpeg-builder';

describe('normalizeLutLayers', () => {
  it('upgrades legacy lutPath string to single LUTLayer with intensity 1', () => {
    const result = normalizeLutLayers(undefined, 'C:\\LUTs\\look.cube');
    expect(result).toEqual([{ path: 'C:\\LUTs\\look.cube', intensity: 1 }]);
  });

  it('returns empty array when both luts and lutPath are absent', () => {
    expect(normalizeLutLayers(undefined, undefined)).toEqual([]);
    expect(normalizeLutLayers(undefined, null)).toEqual([]);
    expect(normalizeLutLayers(undefined, '')).toEqual([]);
    expect(normalizeLutLayers(undefined, '   ')).toEqual([]);
  });

  it('returns empty array when luts is empty and no lutPath', () => {
    expect(normalizeLutLayers([], undefined)).toEqual([]);
    expect(normalizeLutLayers([], null)).toEqual([]);
  });

  it('normalizes luts array: filters empty paths, clamps intensity, truncates to 3', () => {
    const input: LUTLayer[] = [
      { path: 'A.cube', intensity: 0.5 },
      { path: 'B.cube', intensity: 2 },
      { path: 'C.cube', intensity: -1 },
      { path: '', intensity: 1 },
      { path: 'D.cube', intensity: 1 },
    ];
    const result = normalizeLutLayers(input, undefined);
    expect(result).toEqual([
      { path: 'A.cube', intensity: 0.5 },
      { path: 'B.cube', intensity: 1 },
      { path: 'C.cube', intensity: 0 },
    ]);
  });

  it('truncates to at most 3 LUT layers', () => {
    const input: LUTLayer[] = [
      { path: 'A.cube', intensity: 1 },
      { path: 'B.cube', intensity: 0.5 },
      { path: 'C.cube', intensity: 0.8 },
      { path: 'D.cube', intensity: 1 },
    ];
    const result = normalizeLutLayers(input, undefined);
    expect(result).toHaveLength(3);
    expect(result[0].path).toBe('A.cube');
    expect(result[1].path).toBe('B.cube');
    expect(result[2].path).toBe('C.cube');
  });

  it('prefers luts array over lutPath when both are provided', () => {
    const input: LUTLayer[] = [{ path: 'A.cube', intensity: 0.7 }];
    const result = normalizeLutLayers(input, 'B.cube');
    expect(result).toEqual([{ path: 'A.cube', intensity: 0.7 }]);
  });

  it('keeps layers with intensity=0 (filter generation handles skipping)', () => {
    const input: LUTLayer[] = [{ path: 'A.cube', intensity: 0 }];
    const result = normalizeLutLayers(input, undefined);
    expect(result).toEqual([{ path: 'A.cube', intensity: 0 }]);
  });
});

describe('LUT layers in normalizeColorCorrection', () => {
  it('includes luts: [] in default color correction', () => {
    expect(DEFAULT_COLOR_CORRECTION.luts).toEqual([]);
  });

  it('normalizes luts field through normalizeColorCorrection', () => {
    const result = normalizeColorCorrection({
      luts: [{ path: 'warm.cube', intensity: 0.8 }],
    });
    expect(result.luts).toEqual([{ path: 'warm.cube', intensity: 0.8 }]);
  });

  it('upgrades lutPath to luts through normalizeColorCorrection', () => {
    const result = normalizeColorCorrection({ lutPath: 'old.cube' });
    expect(result.lutPath).toBe('old.cube');
    expect(result.luts).toEqual([{ path: 'old.cube', intensity: 1 }]);
  });

  it('detects non-default when luts is non-empty', () => {
    expect(isDefaultColorCorrection({ luts: [{ path: 'x.cube', intensity: 1 }] })).toBe(false);
  });

  it('detects default when luts is empty', () => {
    expect(isDefaultColorCorrection(DEFAULT_COLOR_CORRECTION)).toBe(true);
  });
});

describe('LUT layers in ffmpeg export', () => {
  it('generates lut3d filter for single LUT with intensity=1', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-lut1',
        duration: 2,
        colorCorrection: { luts: [{ path: 'C:\\LUTs\\warm.cube', intensity: 1 }] },
      }),
    ];
    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));
    expect(plan.filterComplex).toContain(String.raw`lut3d=file=C\\:/LUTs/warm.cube`);
  });

  it('generates lut3d filter for legacy lutPath (backward compat)', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-legacy',
        duration: 2,
        colorCorrection: { lutPath: 'C:\\LUTs\\legacy.cube' },
      }),
    ];
    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));
    expect(plan.filterComplex).toContain(String.raw`lut3d=file=C\\:/LUTs/legacy.cube`);
  });

  it('generates split+blend filters for LUT with intensity < 1', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-half',
        duration: 2,
        colorCorrection: { luts: [{ path: 'C:\\LUTs\\cool.cube', intensity: 0.5 }] },
      }),
    ];
    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));
    expect(plan.filterComplex).toContain('split[lut0a][lut0b]');
    expect(plan.filterComplex).toContain('lut0b]lut3d=');
    expect(plan.filterComplex).toContain('blend=all_expr=');
  });

  it('chains multiple LUT lut3d filters', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-multi',
        duration: 2,
        colorCorrection: {
          luts: [
            { path: 'C:\\LUTs\\a.cube', intensity: 1 },
            { path: 'C:\\LUTs\\b.cube', intensity: 1 },
          ],
        },
      }),
    ];
    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));
    expect(plan.filterComplex).toContain(String.raw`lut3d=file=C\\:/LUTs/a.cube`);
    expect(plan.filterComplex).toContain(String.raw`lut3d=file=C\\:/LUTs/b.cube`);
  });

  it('skips LUT layer with intensity=0 (no lut3d filter generated)', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-skip',
        duration: 2,
        colorCorrection: {
          luts: [
            { path: 'C:\\LUTs\\skip.cube', intensity: 0 },
            { path: 'C:\\LUTs\\keep.cube', intensity: 1 },
          ],
        },
      }),
    ];
    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));
    expect(plan.filterComplex).not.toContain('skip.cube');
    expect(plan.filterComplex).toContain(String.raw`lut3d=file=C\\:/LUTs/keep.cube`);
  });

  it('does not generate any LUT filters when all luts are empty', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-nolut',
        duration: 2,
        colorCorrection: { luts: [] },
      }),
    ];
    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));
    expect(plan.filterComplex).not.toContain('lut3d=');
  });
});

describe('LUT layers in color node graph', () => {
  it('generates lut3d filter for multi-LUT node graph', () => {
    const graph: ColorNodeGraph = {
      version: 1,
      outputNodeId: 'lut-node',
      nodes: [
        {
          id: 'lut-node',
          type: 'lut',
          name: 'LUT',
          position: { x: 280, y: 160 },
          correction: {
            inputColorSpace: 'rec709',
            brightness: 0,
            contrast: 1,
            saturation: 1,
            hue: 0,
            lutPath: null,
            luts: [
              { path: 'C:/Looks/a.cube', intensity: 1 },
              { path: 'C:/Looks/b.cube', intensity: 0.5 },
            ],
            colorCurves: { master: [{ x: 0, y: 0 }, { x: 1, y: 1 }], r: [{ x: 0, y: 0 }, { x: 1, y: 1 }], g: [{ x: 0, y: 0 }, { x: 1, y: 1 }], b: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
            threeWayColor: { lift: { r: 0, g: 0, b: 0, intensity: 1 }, gamma: { r: 0, g: 0, b: 0, intensity: 1 }, gain: { r: 0, g: 0, b: 0, intensity: 1 } },
          },
        },
      ],
      connections: [],
    };
    const plan = buildColorNodeGraphFilterPlan(graph, {
      inputLabel: 'src',
      outputLabel: 'out',
      clipId: 'clip-node',
    });
    const filter = plan.filters.join(';');
    expect(filter).toContain(String.raw`lut3d=file=C\:/Looks/a.cube`);
    expect(filter).toContain(String.raw`lut3d=file=C\:/Looks/b.cube`);
  });
});
