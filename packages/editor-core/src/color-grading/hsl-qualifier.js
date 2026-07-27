import { clamp } from '../math-utils';
/** 创建默认 HSL 限定器参数 */
export function createDefaultHSLQualifierParams() {
    return {
        hueRange: { center: 0, width: 120, softness: 10 },
        saturationRange: { min: 20, max: 100, softness: 10 },
        luminanceRange: { min: 10, max: 90, softness: 10 },
        adjustments: {
            hueShift: 0,
            saturation: 0,
            brightness: 0,
            contrast: 0,
            temperature: 0,
            tint: 0,
        },
        viewMode: 'final',
        matteClean: 0,
    };
}
/** 验证 HSL 限定器参数 */
export function validateHSLQualifierParams(params) {
    return {
        hueRange: {
            center: clamp(params.hueRange.center, 0, 360),
            width: clamp(params.hueRange.width, 1, 360),
            softness: clamp(params.hueRange.softness, 0, 50),
        },
        saturationRange: {
            min: clamp(params.saturationRange.min, 0, 100),
            max: clamp(params.saturationRange.max, 0, 100),
            softness: clamp(params.saturationRange.softness, 0, 50),
        },
        luminanceRange: {
            min: clamp(params.luminanceRange.min, 0, 100),
            max: clamp(params.luminanceRange.max, 0, 100),
            softness: clamp(params.luminanceRange.softness, 0, 50),
        },
        adjustments: {
            hueShift: clamp(params.adjustments.hueShift, -180, 180),
            saturation: clamp(params.adjustments.saturation, -100, 100),
            brightness: clamp(params.adjustments.brightness, -100, 100),
            contrast: clamp(params.adjustments.contrast, -100, 100),
            temperature: clamp(params.adjustments.temperature, -100, 100),
            tint: clamp(params.adjustments.tint, -100, 100),
        },
        viewMode: params.viewMode,
        matteClean: clamp(params.matteClean, 0, 100),
    };
}
/** 生成 HSL 限定器 GLSL 代码 */
export function generateHSLQualifierGLSL(prefix) {
    return `
// HSL Qualifier
uniform vec3 ${prefix}_hueRange;      // center, width, softness
uniform vec3 ${prefix}_satRange;      // min, max, softness
uniform vec3 ${prefix}_lumRange;      // min, max, softness
uniform vec3 ${prefix}_adjustments1;  // hueShift, saturation, brightness
uniform vec3 ${prefix}_adjustments2;  // contrast, temperature, tint
uniform float ${prefix}_matteClean;

float hslQualifierMask(vec3 hsl) {
  // 色相匹配
  float hueDist = abs(hsl.x - ${prefix}_hueRange.x);
  hueDist = min(hueDist, 360.0 - hueDist);
  float hueMask = smoothstep(
    ${prefix}_hueRange.y * 0.5 + ${prefix}_hueRange.z,
    ${prefix}_hueRange.y * 0.5,
    hueDist
  );

  // 饱和度匹配
  float satMask = smoothstep(
    ${prefix}_satRange.x - ${prefix}_satRange.z,
    ${prefix}_satRange.x,
    hsl.y
  ) * smoothstep(
    ${prefix}_satRange.y + ${prefix}_satRange.z,
    ${prefix}_satRange.y,
    hsl.y
  );

  // 亮度匹配
  float lumMask = smoothstep(
    ${prefix}_lumRange.x - ${prefix}_lumRange.z,
    ${prefix}_lumRange.x,
    hsl.z
  ) * smoothstep(
    ${prefix}_lumRange.y + ${prefix}_lumRange.z,
    ${prefix}_lumRange.y,
    hsl.z
  );

  return hueMask * satMask * lumMask;
}

vec4 applyHSLQualifier(vec4 color, vec3 hsl) {
  float mask = hslQualifierMask(hsl);

  // 应用调整
  vec3 adjusted = color.rgb;
  adjusted = mix(adjusted, adjusted + ${prefix}_adjustments1.y / 100.0, mask);
  adjusted += ${prefix}_adjustments1.z / 100.0 * mask;

  return vec4(adjusted, color.a);
}`.trim();
}
/** 生成 HSL 限定器 FFmpeg 滤镜 */
export function toFfmpegSelectiveColor(params) {
    if (params.adjustments.hueShift === 0 && params.adjustments.saturation === 0 && params.adjustments.brightness === 0) {
        return '';
    }
    // 使用 FFmpeg 的 selectivecolor 滤镜
    return `selectivecolor=reds=${params.adjustments.hueShift / 100}:yellows=${params.adjustments.saturation / 100}`;
}
//# sourceMappingURL=hsl-qualifier.js.map