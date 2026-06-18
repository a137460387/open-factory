import { describe, expect, it } from 'vitest';
import {
  buildEffectPresetClipPatch,
  buildEffectPresetPreviewArgs,
  createEffectPresetFromClip,
  filterEffectPresets,
  parseEffectPresetJson,
  serializeEffectPresetFile
} from '../src';
import { makeVideoClip } from './test-utils';

describe('effect presets', () => {
  it('serializes and parses a full clip effect stack roundtrip', () => {
    const clip = makeVideoClip({
      colorCorrection: { brightness: 0.15, contrast: 1.2, saturation: 0.85, hue: 8 },
      blendMode: 'overlay',
      effects: [{ id: 'effect-vignette', type: 'vignette', enabled: true, params: { intensity: 0.7, radius: 0.45 } }],
      keyframes: {
        opacity: [
          { id: 'kf-a', time: 0, value: 0.25, easing: 'ease-in' },
          { id: 'kf-b', time: 2, value: 1, easing: 'ease-out' }
        ]
      }
    });

    const preset = createEffectPresetFromClip(clip, {
      id: 'cinematic-pop',
      name: 'Cinematic Pop',
      author: 'Ada',
      tags: ['cinematic', 'portrait'],
      now: '2026-06-18T00:00:00.000Z'
    });
    const parsed = parseEffectPresetJson(serializeEffectPresetFile(preset));

    expect(parsed).toEqual(preset);
    expect(parsed.stack).toMatchObject({
      blendMode: 'overlay',
      colorCorrection: { brightness: 0.15, contrast: 1.2, saturation: 0.85, hue: 8 }
    });
    expect(parsed.stack.effects?.[0]).toMatchObject({ type: 'vignette', params: { intensity: 0.7, radius: 0.45 } });
    expect(parsed.stack.keyframes?.opacity?.map((frame) => frame.id)).toEqual(['kf-a', 'kf-b']);
  });

  it('builds a normalized clip patch from a preset without sharing stack objects', () => {
    const clip = makeVideoClip({
      duration: 1,
      effects: [{ id: 'effect-blur', type: 'blur', enabled: true, params: { radius: 99 } }],
      keyframes: { opacity: [{ id: 'kf-outside', time: 3, value: 2, easing: 'bad' as never }] }
    });
    const preset = createEffectPresetFromClip(clip, { name: 'Clamped', now: '2026-06-18T00:00:00.000Z' });

    const patch = buildEffectPresetClipPatch(preset, 1);

    expect(patch.effects).toEqual([{ id: 'effect-blur', type: 'blur', enabled: true, params: { radius: 50 } }]);
    expect(patch.keyframes?.opacity).toEqual([{ id: 'kf-outside', time: 1, value: 1, easing: 'linear' }]);
    expect(patch.effects).not.toBe(preset.stack.effects);
  });

  it('filters presets by style and use tags', () => {
    const cards = [
      createEffectPresetFromClip(makeVideoClip(), { id: 'film-face', name: 'Film Face', tags: ['cinematic', 'portrait'] }),
      createEffectPresetFromClip(makeVideoClip(), { id: 'cyber-food', name: 'Cyber Food', tags: ['cyber', 'food'] })
    ];

    expect(filterEffectPresets(cards, { style: 'cinematic' }).map((card) => card.id)).toEqual(['film-face']);
    expect(filterEffectPresets(cards, { use: 'food' }).map((card) => card.id)).toEqual(['cyber-food']);
    expect(filterEffectPresets(cards, { style: 'cyber', use: 'portrait' }).map((card) => card.id)).toEqual([]);
  });

  it('builds ffmpeg argument arrays for standard-frame preview thumbnails', () => {
    const preset = createEffectPresetFromClip(
      makeVideoClip({
        colorCorrection: { brightness: 0.1, contrast: 1.2, saturation: 0.8, hue: 15 },
        effects: [{ id: 'effect-grain', type: 'film-grain', enabled: true, params: { strength: 0.5, size: 2 } }]
      }),
      { id: 'preview', name: 'Preview' }
    );

    const args = buildEffectPresetPreviewArgs(preset, { outputPath: 'C:/Temp/preview.png', width: 640, height: 360 });

    expect(args).toEqual(
      expect.arrayContaining(['-y', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=1:duration=1', '-frames:v', '1', '-update', '1', 'C:/Temp/preview.png'])
    );
    expect(args[args.indexOf('-vf') + 1]).toContain('eq=brightness=0.1:contrast=1.2:saturation=0.8');
    expect(args[args.indexOf('-vf') + 1]).toContain('hue=h=15');
    expect(args[args.indexOf('-vf') + 1]).toContain('noise=alls=15');
  });

  it('parses bare preset JSON and fills safe metadata defaults', () => {
    const preset = createEffectPresetFromClip(makeVideoClip(), {
      name: '!!!',
      tags: ['CINEMATIC', 'cinematic', '  food  '],
      now: 'not-a-date'
    });
    const parsed = parseEffectPresetJson(JSON.stringify(preset));

    expect(parsed).toMatchObject({
      id: 'effect-preset',
      author: 'Local user',
      tags: ['cinematic', 'food']
    });
    expect(Date.parse(parsed.createdAt)).not.toBeNaN();
  });

  it('rejects malformed preset files and missing stacks', () => {
    const preset = createEffectPresetFromClip(makeVideoClip(), { id: 'valid', name: 'Valid' });

    expect(() => parseEffectPresetJson(JSON.stringify({ schemaVersion: 999, kind: 'wrong', preset }))).toThrow('Invalid effect preset file');
    expect(() => parseEffectPresetJson(JSON.stringify({ id: 'missing-stack', name: 'Missing Stack' }))).toThrow('Invalid effect preset');
    expect(() => parseEffectPresetJson('null')).toThrow('Invalid effect preset');
  });

  it('builds preview args from a source frame and maps supported effect filters', () => {
    const preset = createEffectPresetFromClip(
      makeVideoClip({
        effects: [
          { id: 'effect-disabled', type: 'film-grain', enabled: false, params: { strength: 1 } },
          { id: 'effect-blur', type: 'blur', enabled: true, params: { radius: 2 } },
          { id: 'effect-sharpen', type: 'sharpen', enabled: true, params: { strength: 0.75 } },
          { id: 'effect-vignette', type: 'vignette', enabled: true, params: { intensity: 0.5 } },
          { id: 'effect-chromatic', type: 'chromatic-aberration', enabled: true, params: { amount: 0.4 } },
          { id: 'effect-motion', type: 'motion-blur', enabled: true, params: { amount: 0.2 } }
        ]
      }),
      { id: 'source-preview', name: 'Source Preview' }
    );

    const args = buildEffectPresetPreviewArgs(preset, { inputPath: 'C:/Frames/source.png', outputPath: 'C:/Temp/preview.png' });
    const filter = args[args.indexOf('-vf') + 1];

    expect(args).toEqual(expect.arrayContaining(['-i', 'C:/Frames/source.png', '-frames:v', '1', '-update', '1', 'C:/Temp/preview.png']));
    expect(args).not.toContain('testsrc2=size=320x180:rate=1:duration=1');
    expect(filter).toContain('boxblur=2:1');
    expect(filter).toContain('unsharp=5:5:0.75');
    expect(filter).toContain('vignette=PI/4:eval=frame');
    expect(filter).toContain('format=rgba');
    expect(filter).toContain('tmix=frames=3');
    expect(filter).not.toContain('noise=alls=30');
  });
});
