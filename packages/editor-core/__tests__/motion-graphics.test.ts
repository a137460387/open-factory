import { describe, expect, it, vi } from 'vitest';
import {
  createDefaultMotionGraphic,
  getMotionGraphicNumericParamKeys,
  getMotionGraphicParamValueAtTime,
  getMotionGraphicTemplateDefinition,
  MOTION_GRAPHIC_TEMPLATE_DEFINITIONS,
  MOTION_GRAPHIC_TEMPLATE_TYPES,
  normalizeMotionGraphic,
  parseMotionGraphicTemplate,
  serializeMotionGraphicTemplate,
  setMotionGraphicParam,
  setMotionGraphicParamKeyframe
} from '../src';

describe('motion graphics', () => {
  it('serializes and parses motion graphic templates', () => {
    const motionGraphic = setMotionGraphicParamKeyframe(
      setMotionGraphicParam(createDefaultMotionGraphic('countdown'), 'startSeconds', 12, 4),
      'startSeconds',
      { time: 0, value: 12, easing: 'linear' },
      4
    );

    const serialized = serializeMotionGraphicTemplate(motionGraphic, { duration: 4, width: 1280, height: 720 });
    const parsed = parseMotionGraphicTemplate(serialized);

    expect(parsed.format).toBe('open-factory-motion-graphic');
    expect(parsed.templateType).toBe('countdown');
    expect(parsed.params.startSeconds).toBe(12);
    expect(parsed.paramKeyframes?.startSeconds?.[0]?.value).toBe(12);
  });

  it('keeps template parameter definitions complete', () => {
    for (const templateType of MOTION_GRAPHIC_TEMPLATE_TYPES) {
      const definition = getMotionGraphicTemplateDefinition(templateType);
      const normalized = createDefaultMotionGraphic(templateType);
      expect(definition.type).toBe(templateType);
      expect(definition.params.length).toBeGreaterThan(0);
      for (const param of definition.params) {
        expect(Object.prototype.hasOwnProperty.call(normalized.params, param.key)).toBe(true);
      }
    }
  });

  it('interpolates numeric motion graphic keyframes', () => {
    const motionGraphic = setMotionGraphicParamKeyframe(
      setMotionGraphicParamKeyframe(setMotionGraphicParam(createDefaultMotionGraphic('progress-bar'), 'progress', 0.1, 10), 'progress', { time: 0, value: 0.1, easing: 'linear' }, 10),
      'progress',
      { time: 10, value: 0.9, easing: 'linear' },
      10
    );

    expect(getMotionGraphicParamValueAtTime(motionGraphic, 'progress', 5, 10)).toBeCloseTo(0.5, 3);
  });

  it('normalizes unknown template types to countdown', () => {
    const parsed = parseMotionGraphicTemplate(
      JSON.stringify({
        format: 'open-factory-motion-graphic',
        version: 1,
        templateType: 'unknown',
        params: { color: '#fff' },
        duration: 3
      })
    );

    expect(parsed.templateType).toBe('countdown');
    expect(parsed.params).toMatchObject(MOTION_GRAPHIC_TEMPLATE_DEFINITIONS.countdown.params.reduce((acc, param) => ({ ...acc, [param.key]: expect.anything() }), {}));
  });

  it('exposes only keyframeable numeric params and ignores invalid mutations', () => {
    const lowerThird = createDefaultMotionGraphic('social-lower-third');
    const progress = createDefaultMotionGraphic('progress-bar');

    expect(getMotionGraphicNumericParamKeys(createDefaultMotionGraphic('scoreboard'))).toEqual(['homeScore', 'awayScore', 'backgroundOpacity']);
    expect(setMotionGraphicParam(lowerThird, 'missing', 123)).toEqual(lowerThird);
    expect(setMotionGraphicParamKeyframe(lowerThird, 'displayName', { time: 1, value: 10 }, 3)).toEqual(lowerThird);
    expect(getMotionGraphicParamValueAtTime(lowerThird, 'missing', 1)).toBeUndefined();
    expect(getMotionGraphicParamValueAtTime(lowerThird, 'platform', 1)).toBe('youtube');
    expect(getMotionGraphicParamValueAtTime(progress, 'progress', 2)).toBe(0.65);
  });

  it('normalizes parsed chart lists, shorthand colors, and invalid keyframes', () => {
    const parsed = parseMotionGraphicTemplate(
      JSON.stringify({
        format: 'open-factory-motion-graphic',
        version: 1,
        templateType: 'data-chart',
        params: {
          chartKind: 'pie',
          dataValues: '1, bad, 250, -20',
          primaryColor: '#abc',
          showLabels: false
        },
        paramKeyframes: {
          maxValue: [{ id: 'bad-frame' }, { id: 'max-frame', time: 3, value: 20000, easing: 'ease-out' }]
        },
        duration: 2,
        width: 0,
        height: 720.7
      })
    );

    expect(parsed.params.dataValues).toEqual([1, 100, 0]);
    expect(parsed.params.primaryColor).toBe('#aabbcc');
    expect(parsed.params.showLabels).toBe(false);
    expect(parsed.paramKeyframes?.maxValue).toEqual([{ id: 'max-frame', time: 2, value: 10000, easing: 'ease-out' }]);
    expect(parsed.width).toBe(1);
    expect(parsed.height).toBe(721);
  });

  it('rejects malformed motion graphic template files', () => {
    expect(() => parseMotionGraphicTemplate('{')).toThrow('Invalid .ofmgt.json file');
    expect(() => parseMotionGraphicTemplate('42')).toThrow('Invalid .ofmgt.json file.');
    expect(() => parseMotionGraphicTemplate(JSON.stringify({ format: 'other', version: 1 }))).toThrow('Unsupported motion graphic template file.');
  });

  it('interpolates keyframes across easing modes and boundary times', () => {
    const graphic = normalizeMotionGraphic(
      {
        version: 1,
        templateType: 'progress-bar',
        params: { progress: 0.5 },
        paramKeyframes: {
          progress: [
            { id: 'a', time: 0, value: 0, easing: 'ease-in' },
            { id: 'b', time: 1, value: 1, easing: 'ease-out' },
            { id: 'c', time: 2, value: 0, easing: 'ease-in-out' },
            { id: 'd', time: 3, value: 1, easing: 'linear' }
          ]
        }
      },
      3
    );

    expect(getMotionGraphicParamValueAtTime(graphic, 'progress', -1, 3)).toBe(0);
    expect(getMotionGraphicParamValueAtTime(graphic, 'progress', 4, 3)).toBe(1);
    expect(getMotionGraphicParamValueAtTime(graphic, 'progress', 0.5, 3)).toBe(0.25);
    expect(getMotionGraphicParamValueAtTime(graphic, 'progress', 1.5, 3)).toBe(0.25);
    expect(getMotionGraphicParamValueAtTime(graphic, 'progress', 2.5, 3)).toBe(0.5);
  });

  it('falls back to local ids when crypto UUIDs are unavailable', () => {
    const originalCrypto = globalThis.crypto;
    vi.stubGlobal('crypto', {});
    try {
      const graphic = setMotionGraphicParamKeyframe(createDefaultMotionGraphic('progress-bar'), 'progress', { time: 1, value: 0.42 }, 3);

      expect(graphic.paramKeyframes?.progress?.[0]?.id).toMatch(/^motion-param-/);
    } finally {
      vi.stubGlobal('crypto', originalCrypto);
    }
  });
});
