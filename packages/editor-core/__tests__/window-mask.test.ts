import { describe, it, expect } from 'vitest';
import {
  createDefaultCircleMask,
  createDefaultGradientMask,
  validateWindowMaskParams,
  generateCircleMaskGLSL,
  generateGradientMaskGLSL,
} from '../src/color-grading/window-mask';

describe('window-mask', () => {
  describe('createDefaultCircleMask', () => {
    it('should create circle mask with default values', () => {
      const mask = createDefaultCircleMask();

      expect(mask.shape).toBe('circle');
      expect(mask.circle).toBeDefined();
      expect(mask.circle!.center).toEqual({ x: 0.5, y: 0.5 });
      expect(mask.circle!.radius).toBe(0.3);
      expect(mask.circle!.softness).toBe(0.1);
      expect(mask.circle!.rotation).toBe(0);
      expect(mask.invert).toBe(false);
      expect(mask.feather).toBe(10);
    });

    it('should have valid center coordinates', () => {
      const mask = createDefaultCircleMask();

      expect(mask.circle!.center.x).toBeGreaterThanOrEqual(0);
      expect(mask.circle!.center.x).toBeLessThanOrEqual(1);
      expect(mask.circle!.center.y).toBeGreaterThanOrEqual(0);
      expect(mask.circle!.center.y).toBeLessThanOrEqual(1);
    });

    it('should have valid radius and softness', () => {
      const mask = createDefaultCircleMask();

      expect(mask.circle!.radius).toBeGreaterThanOrEqual(0);
      expect(mask.circle!.radius).toBeLessThanOrEqual(1);
      expect(mask.circle!.softness).toBeGreaterThanOrEqual(0);
      expect(mask.circle!.softness).toBeLessThanOrEqual(1);
    });
  });

  describe('createDefaultGradientMask', () => {
    it('should create gradient mask with default values', () => {
      const mask = createDefaultGradientMask();

      expect(mask.shape).toBe('linear-gradient');
      expect(mask.linearGradient).toBeDefined();
      expect(mask.linearGradient!.startPoint).toEqual({ x: 0, y: 0.5 });
      expect(mask.linearGradient!.endPoint).toEqual({ x: 1, y: 0.5 });
      expect(mask.linearGradient!.softness).toBe(0.2);
      expect(mask.invert).toBe(false);
      expect(mask.feather).toBe(20);
    });

    it('should have valid start and end points', () => {
      const mask = createDefaultGradientMask();

      expect(mask.linearGradient!.startPoint.x).toBeGreaterThanOrEqual(0);
      expect(mask.linearGradient!.startPoint.x).toBeLessThanOrEqual(1);
      expect(mask.linearGradient!.startPoint.y).toBeGreaterThanOrEqual(0);
      expect(mask.linearGradient!.startPoint.y).toBeLessThanOrEqual(1);
      expect(mask.linearGradient!.endPoint.x).toBeGreaterThanOrEqual(0);
      expect(mask.linearGradient!.endPoint.x).toBeLessThanOrEqual(1);
      expect(mask.linearGradient!.endPoint.y).toBeGreaterThanOrEqual(0);
      expect(mask.linearGradient!.endPoint.y).toBeLessThanOrEqual(1);
    });
  });

  describe('validateWindowMaskParams', () => {
    it('should clamp circle center coordinates', () => {
      const params = createDefaultCircleMask();
      params.circle!.center = { x: 1.5, y: -0.5 };

      const validated = validateWindowMaskParams(params);

      expect(validated.circle!.center.x).toBe(1);
      expect(validated.circle!.center.y).toBe(0);
    });

    it('should clamp circle radius', () => {
      const params = createDefaultCircleMask();
      params.circle!.radius = 1.5;

      const validated = validateWindowMaskParams(params);

      expect(validated.circle!.radius).toBe(1);
    });

    it('should clamp circle softness', () => {
      const params = createDefaultCircleMask();
      params.circle!.softness = -0.5;

      const validated = validateWindowMaskParams(params);

      expect(validated.circle!.softness).toBe(0);
    });

    it('should clamp gradient points', () => {
      const params = createDefaultGradientMask();
      params.linearGradient!.startPoint = { x: 1.5, y: -0.5 };
      params.linearGradient!.endPoint = { x: -0.5, y: 1.5 };

      const validated = validateWindowMaskParams(params);

      expect(validated.linearGradient!.startPoint.x).toBe(1);
      expect(validated.linearGradient!.startPoint.y).toBe(0);
      expect(validated.linearGradient!.endPoint.x).toBe(0);
      expect(validated.linearGradient!.endPoint.y).toBe(1);
    });

    it('should clamp gradient softness', () => {
      const params = createDefaultGradientMask();
      params.linearGradient!.softness = 1.5;

      const validated = validateWindowMaskParams(params);

      expect(validated.linearGradient!.softness).toBe(1);
    });

    it('should clamp feather value', () => {
      const params = createDefaultCircleMask();
      params.feather = 150;

      const validated = validateWindowMaskParams(params);

      expect(validated.feather).toBe(100);
    });

    it('should handle negative feather', () => {
      const params = createDefaultCircleMask();
      params.feather = -10;

      const validated = validateWindowMaskParams(params);

      expect(validated.feather).toBe(0);
    });

    it('should preserve invert flag', () => {
      const params = createDefaultCircleMask();
      params.invert = true;

      const validated = validateWindowMaskParams(params);

      expect(validated.invert).toBe(true);
    });

    it('should handle polygon mask validation', () => {
      const params = {
        shape: 'polygon' as const,
        polygon: {
          points: [
            { x: 0.2, y: 0.3 },
            { x: 0.8, y: 0.3 },
            { x: 0.5, y: 0.7 }
          ],
          softness: 0.15
        },
        invert: false,
        feather: 15
      };

      const validated = validateWindowMaskParams(params);

      expect(validated.shape).toBe('polygon');
      expect(validated.polygon).toBeDefined();
      expect(validated.polygon!.points.length).toBe(3);
      expect(validated.feather).toBe(15);
    });

    it('should return new object (immutable)', () => {
      const params = createDefaultCircleMask();

      const validated = validateWindowMaskParams(params);

      expect(validated).not.toBe(params);
      expect(validated.circle).not.toBe(params.circle);
    });

    it('should preserve rotation value', () => {
      const params = createDefaultCircleMask();
      params.circle!.rotation = 45;

      const validated = validateWindowMaskParams(params);

      expect(validated.circle!.rotation).toBe(45);
    });

    it('should keep exact boundary values 0 and 1 unchanged', () => {
      const params = createDefaultCircleMask();
      params.circle!.center = { x: 0, y: 1 };
      params.circle!.radius = 0;
      params.circle!.softness = 1;

      const validated = validateWindowMaskParams(params);

      expect(validated.circle!.center.x).toBe(0);
      expect(validated.circle!.center.y).toBe(1);
      expect(validated.circle!.radius).toBe(0);
      expect(validated.circle!.softness).toBe(1);
    });

    it('should keep feather at exact boundary values', () => {
      const params = createDefaultCircleMask();
      params.feather = 0;
      expect(validateWindowMaskParams(params).feather).toBe(0);

      params.feather = 100;
      expect(validateWindowMaskParams(params).feather).toBe(100);
    });

    it('should not mutate polygon points', () => {
      const params = {
        shape: 'polygon' as const,
        polygon: {
          points: [
            { x: 0.5, y: 0.5 },
            { x: 0.8, y: 0.8 },
          ],
          softness: 0.2,
        },
        invert: false,
        feather: 5,
      };

      const validated = validateWindowMaskParams(params);

      expect(validated.polygon!.points).toEqual(params.polygon.points);
      expect(validated.polygon!.softness).toBe(0.2);
    });
  });

  describe('generateCircleMaskGLSL', () => {
    it('should include uniform declarations with prefix', () => {
      const glsl = generateCircleMaskGLSL('myPrefix');

      expect(glsl).toContain('uniform vec2 myPrefix_center');
      expect(glsl).toContain('uniform float myPrefix_radius');
      expect(glsl).toContain('uniform float myPrefix_softness');
      expect(glsl).toContain('uniform float myPrefix_invert');
    });

    it('should define circleMask function', () => {
      const glsl = generateCircleMaskGLSL('cg');

      expect(glsl).toContain('float circleMask(vec2 uv)');
      expect(glsl).toContain('distance(uv, cg_center)');
      expect(glsl).toContain('smoothstep');
    });

    it('should handle invert logic in GLSL', () => {
      const glsl = generateCircleMaskGLSL('p');

      expect(glsl).toContain('p_invert > 0.5 ? 1.0 - mask : mask');
    });

    it('should work with empty string prefix', () => {
      const glsl = generateCircleMaskGLSL('');

      expect(glsl).toContain('uniform vec2 _center');
      expect(glsl).toContain('float circleMask(vec2 uv)');
    });
  });

  describe('generateGradientMaskGLSL', () => {
    it('should include uniform declarations with prefix', () => {
      const glsl = generateGradientMaskGLSL('grad');

      expect(glsl).toContain('uniform vec2 grad_start');
      expect(glsl).toContain('uniform vec2 grad_end');
      expect(glsl).toContain('uniform float grad_softness');
      expect(glsl).toContain('uniform float grad_invert');
    });

    it('should define gradientMask function', () => {
      const glsl = generateGradientMaskGLSL('g');

      expect(glsl).toContain('float gradientMask(vec2 uv)');
      expect(glsl).toContain('g_end - g_start');
      expect(glsl).toContain('clamp(t, 0.0, 1.0)');
    });

    it('should use smoothstep for soft edges', () => {
      const glsl = generateGradientMaskGLSL('g');

      expect(glsl).toContain('smoothstep(0.0, g_softness, t)');
      expect(glsl).toContain('smoothstep(1.0, 1.0 - g_softness, t)');
    });

    it('should handle invert logic in GLSL', () => {
      const glsl = generateGradientMaskGLSL('g');

      expect(glsl).toContain('g_invert > 0.5 ? 1.0 - mask : mask');
    });
  });
});
