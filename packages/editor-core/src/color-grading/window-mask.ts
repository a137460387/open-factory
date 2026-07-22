import { clamp01 } from '../math-utils';

/** 窗口遮罩形状 */
export type WindowMaskShape = 'circle' | 'linear-gradient' | 'polygon';

/** 窗口遮罩参数 */
export interface WindowMaskParams {
  shape: WindowMaskShape;

  circle?: {
    center: { x: number; y: number }; // 归一化坐标 0~1
    radius: number;
    softness: number; // 边缘柔和度 0~1
    rotation: number;
  };

  linearGradient?: {
    startPoint: { x: number; y: number };
    endPoint: { x: number; y: number };
    softness: number;
  };

  polygon?: {
    points: { x: number; y: number }[];
    softness: number;
  };

  invert: boolean;
  feather: number; // 像素
}

/** 创建默认圆形遮罩 */
export function createDefaultCircleMask(): WindowMaskParams {
  return {
    shape: 'circle',
    circle: {
      center: { x: 0.5, y: 0.5 },
      radius: 0.3,
      softness: 0.1,
      rotation: 0,
    },
    invert: false,
    feather: 10,
  };
}

/** 创建默认渐变遮罩 */
export function createDefaultGradientMask(): WindowMaskParams {
  return {
    shape: 'linear-gradient',
    linearGradient: {
      startPoint: { x: 0, y: 0.5 },
      endPoint: { x: 1, y: 0.5 },
      softness: 0.2,
    },
    invert: false,
    feather: 20,
  };
}

/** 验证窗口遮罩参数 */
export function validateWindowMaskParams(params: WindowMaskParams): WindowMaskParams {
  const result = { ...params };

  if (result.circle) {
    result.circle = {
      ...result.circle,
      center: {
        x: clamp01(result.circle.center.x),
        y: clamp01(result.circle.center.y),
      },
      radius: clamp01(result.circle.radius),
      softness: clamp01(result.circle.softness),
    };
  }

  if (result.linearGradient) {
    result.linearGradient = {
      ...result.linearGradient,
      startPoint: {
        x: clamp01(result.linearGradient.startPoint.x),
        y: clamp01(result.linearGradient.startPoint.y),
      },
      endPoint: {
        x: clamp01(result.linearGradient.endPoint.x),
        y: clamp01(result.linearGradient.endPoint.y),
      },
      softness: clamp01(result.linearGradient.softness),
    };
  }

  result.feather = Math.max(0, Math.min(100, result.feather));

  return result;
}

/** 生成圆形遮罩 GLSL */
export function generateCircleMaskGLSL(prefix: string): string {
  return `
uniform vec2 ${prefix}_center;
uniform float ${prefix}_radius;
uniform float ${prefix}_softness;
uniform float ${prefix}_invert;

float circleMask(vec2 uv) {
  float dist = distance(uv, ${prefix}_center);
  float mask = smoothstep(${prefix}_radius, ${prefix}_radius - ${prefix}_softness, dist);
  return ${prefix}_invert > 0.5 ? 1.0 - mask : mask;
}`.trim();
}

/** 生成渐变遮罩 GLSL */
export function generateGradientMaskGLSL(prefix: string): string {
  return `
uniform vec2 ${prefix}_start;
uniform vec2 ${prefix}_end;
uniform float ${prefix}_softness;
uniform float ${prefix}_invert;

float gradientMask(vec2 uv) {
  vec2 dir = ${prefix}_end - ${prefix}_start;
  float t = dot(uv - ${prefix}_start, dir) / dot(dir, dir);
  t = clamp(t, 0.0, 1.0);
  float mask = smoothstep(0.0, ${prefix}_softness, t) * smoothstep(1.0, 1.0 - ${prefix}_softness, t);
  return ${prefix}_invert > 0.5 ? 1.0 - mask : mask;
}`.trim();
}
