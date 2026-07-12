import { PrimaryWheels, PrimarySliders, generateHSLQualifierGLSL, generateCircleMaskGLSL, generateGradientMaskGLSL } from '@open-factory/editor-core';
import type { ColorGradingGraph, WindowMaskParams } from '@open-factory/editor-core';

type ColorGradingNode = ColorGradingGraph['nodes'][number];

/** Result of compiling a color grading node chain to GLSL. */
export interface CompiledColorGradingShader {
  /** Function definitions and uniform declarations (placed before main). */
  preamble: string;
  /** Per-node function calls operating on a `vec4 color` variable (placed inside main). */
  calls: string;
}

/**
 * Compile a color grading node chain into GLSL fragment shader pieces.
 *
 * - `preamble` contains function definitions and uniform declarations
 *   and should be placed **before** `void main()`.
 * - `calls` contains per-node invocations that operate on a `vec4 color`
 *   variable and should be placed **inside** `void main()`.
 */
export function compileColorGradingShader(nodes: ColorGradingNode[]): CompiledColorGradingShader {
  if (nodes.length === 0) {
    return { preamble: '', calls: '' };
  }

  const functions: string[] = [];
  const uniforms: string[] = [];
  const calls: string[] = [];

  const hasWheel = nodes.some(n => n.type === 'primary-wheel');
  const hasSlider = nodes.some(n => n.type === 'primary-slider');
  const hasHslQualifier = nodes.some(n => n.type === 'hsl-qualifier');
  const hasWindowMask = nodes.some(n => n.type === 'window-mask');

  if (hasWheel) {
    functions.push(PrimaryWheels.generateGlslFunction());
  }
  if (hasSlider) {
    functions.push(PrimarySliders.generateGlslFunction());
  }

  // 为第一个 HSL 限定器节点生成 GLSL 函数定义
  if (hasHslQualifier) {
    const firstHsl = nodes.find(n => n.type === 'hsl-qualifier')!;
    const hslPrefix = `cg_${firstHsl.id.replace(/-/g, '_')}`;
    functions.push(generateHSLQualifierGLSL(hslPrefix));
    // 添加 rgb2hsl 辅助函数（如果尚未定义）
    functions.unshift(`
vec3 rgb2hsl(vec3 c) {
  float maxC = max(max(c.r, c.g), c.b);
  float minC = min(min(c.r, c.g), c.b);
  float l = (maxC + minC) * 0.5;
  if (maxC == minC) return vec3(0.0, 0.0, l);
  float d = maxC - minC;
  float s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
  float h = 0.0;
  if (maxC == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
  else if (maxC == c.g) h = (c.b - c.r) / d + 2.0;
  else h = (c.r - c.g) / d + 4.0;
  return vec3(h * 60.0, s * 100.0, l * 100.0);
}`.trim());
  }

  // 为窗口遮罩生成 GLSL 函数定义
  if (hasWindowMask) {
    const firstMask = nodes.find(n => n.type === 'window-mask')!;
    const maskPrefix = `cg_${firstMask.id.replace(/-/g, '_')}`;
    const params = firstMask.params as WindowMaskParams;
    if (params.shape === 'circle') {
      functions.push(generateCircleMaskGLSL(maskPrefix));
    } else if (params.shape === 'linear-gradient') {
      functions.push(generateGradientMaskGLSL(maskPrefix));
    }
  }

  for (const node of nodes) {
    const prefix = `cg_${node.id.replace(/-/g, '_')}`;

    if (node.type === 'primary-wheel') {
      uniforms.push(`uniform vec4 ${prefix}_lift;`);
      uniforms.push(`uniform vec4 ${prefix}_gamma;`);
      uniforms.push(`uniform vec4 ${prefix}_gain;`);
      uniforms.push(`uniform vec4 ${prefix}_offset;`);
      calls.push(PrimaryWheels.toGlslSnippet(prefix));
    } else if (node.type === 'primary-slider') {
      uniforms.push(`uniform float ${prefix}_temperature;`);
      uniforms.push(`uniform float ${prefix}_tint;`);
      uniforms.push(`uniform float ${prefix}_contrast;`);
      uniforms.push(`uniform float ${prefix}_pivot;`);
      uniforms.push(`uniform float ${prefix}_saturation;`);
      uniforms.push(`uniform float ${prefix}_hue;`);
      calls.push(PrimarySliders.toGlslSnippet(prefix));
    } else if (node.type === 'hsl-qualifier') {
      // HSL 限定器着色器
      uniforms.push(`uniform vec3 ${prefix}_hueRange;`);
      uniforms.push(`uniform vec3 ${prefix}_satRange;`);
      uniforms.push(`uniform vec3 ${prefix}_lumRange;`);
      uniforms.push(`uniform vec3 ${prefix}_adjustments1;`);
      uniforms.push(`uniform vec3 ${prefix}_adjustments2;`);
      uniforms.push(`uniform float ${prefix}_matteClean;`);
      calls.push(`color = applyHSLQualifier(color, rgb2hsl(color.rgb));`);
    } else if (node.type === 'curves') {
      // 曲线节点 - 256x1 纹理查找表
      uniforms.push(`uniform sampler2D u_curvesLUT_${node.id};`);
      functions.push(`
vec4 applyCurves_${node.id}(vec4 color) {
  float r = texture2D(u_curvesLUT_${node.id}, vec2(color.r, 0.5)).r;
  float g = texture2D(u_curvesLUT_${node.id}, vec2(color.g, 0.5)).g;
  float b = texture2D(u_curvesLUT_${node.id}, vec2(color.b, 0.5)).b;
  float m = texture2D(u_curvesLUT_${node.id}, vec2(
    dot(color.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.5
  )).a;
  return vec4(r + m - 0.5, g + m - 0.5, b + m - 0.5, color.a);
}`.trim());
      calls.push(`color = applyCurves_${node.id}(color);`);
    } else if (node.type === 'lut-apply') {
      // LUT 3D 纹理采样
      uniforms.push(`uniform sampler3D u_lut3D_${node.id};`);
      uniforms.push(`uniform float u_lutIntensity_${node.id};`);
      functions.push(`
vec4 applyLUT_${node.id}(vec4 color) {
  vec3 lutColor = texture3D(u_lut3D_${node.id}, color.rgb).rgb;
  return vec4(mix(color.rgb, lutColor, u_lutIntensity_${node.id}), color.a);
}`.trim());
      calls.push(`color = applyLUT_${node.id}(color);`);
    } else if (node.type === 'window-mask') {
      // 窗口遮罩着色器
      const params = node.params as WindowMaskParams;
      if (params.shape === 'circle' && params.circle) {
        uniforms.push(`uniform vec2 ${prefix}_center;`);
        uniforms.push(`uniform float ${prefix}_radius;`);
        uniforms.push(`uniform float ${prefix}_softness;`);
        uniforms.push(`uniform float ${prefix}_invert;`);
        calls.push(`color *= circleMask(v_uv);`);
      } else if (params.shape === 'linear-gradient' && params.linearGradient) {
        uniforms.push(`uniform vec2 ${prefix}_start;`);
        uniforms.push(`uniform vec2 ${prefix}_end;`);
        uniforms.push(`uniform float ${prefix}_softness;`);
        uniforms.push(`uniform float ${prefix}_invert;`);
        calls.push(`color *= gradientMask(v_uv);`);
      }
    }
  }

  const preamble = [...functions, '', ...uniforms].join('\n');
  const callsCode = calls.join('\n');

  return { preamble, calls: callsCode };
}
