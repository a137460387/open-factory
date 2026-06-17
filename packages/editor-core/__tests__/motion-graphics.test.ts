import { describe, expect, it } from 'vitest';
import {
  createDefaultMotionGraphic,
  getMotionGraphicParamValueAtTime,
  getMotionGraphicTemplateDefinition,
  MOTION_GRAPHIC_TEMPLATE_DEFINITIONS,
  MOTION_GRAPHIC_TEMPLATE_TYPES,
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
});
