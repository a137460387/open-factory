import type { PrimarySliderParams } from './types';

export class PrimarySliders {
  /**
   * 将滑块参数转换为 WebGL uniform 值
   */
  static toUniforms(
    params: PrimarySliderParams,
    prefix: string
  ): Record<string, number> {
    return {
      [`${prefix}_temperature`]: params.temperature / 100,
      [`${prefix}_tint`]: params.tint / 100,
      [`${prefix}_contrast`]: params.contrast / 100,
      [`${prefix}_pivot`]: params.pivot,
      [`${prefix}_saturation`]: params.saturation / 100,
      [`${prefix}_hue`]: (params.hue / 180) * Math.PI,
    };
  }

  /**
   * 生成 GLSL 着色器代码片段
   */
  static toGlslSnippet(prefix: string): string {
    return [
      `// Primary Sliders`,
      `color = applyTemperatureTint(color, ${prefix}_temperature, ${prefix}_tint);`,
      `color = applyContrast(color, ${prefix}_contrast, ${prefix}_pivot);`,
      `color = applySaturation(color, ${prefix}_saturation);`,
      `color = applyHueRotation(color, ${prefix}_hue);`,
    ].join('\n');
  }

  /**
   * 生成 GLSL 函数定义
   */
  static generateGlslFunction(): string {
    return `
vec4 applyTemperatureTint(vec4 color, float temperature, float tint) {
  // 色温: 暖色(+)/冷色(-)
  color.r += temperature * 0.1;
  color.b -= temperature * 0.1;
  // 色调: 品红(+)/绿色(-)
  color.g -= tint * 0.1;
  return clamp(color, 0.0, 1.0);
}

vec4 applyContrast(vec4 color, float contrast, float pivot) {
  // 对比度: 围绕轴心点拉伸/压缩
  return clamp(vec4((color.rgb - pivot) * (1.0 + contrast) + pivot, color.a), 0.0, 1.0);
}

vec4 applySaturation(vec4 color, float saturation) {
  // 饱和度: 基于亮度的混合
  float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
  return clamp(vec4(mix(vec3(luma), color.rgb, saturation), color.a), 0.0, 1.0);
}

vec4 applyHueRotation(vec4 color, float angle) {
  // 色相旋转: YIQ 色彩空间旋转
  float cosA = cos(angle);
  float sinA = sin(angle);
  mat3 yiqMatrix = mat3(
    0.299, 0.587, 0.114,
    0.596, -0.274, -0.322,
    0.211, -0.523, 0.312
  );
  mat3 yiqInverse = mat3(
    1.0, 0.956, 0.621,
    1.0, -0.272, -0.647,
    1.0, -1.106, 1.703
  );
  vec3 yiq = yiqMatrix * color.rgb;
  float newI = yiq.y * cosA - yiq.z * sinA;
  float newZ = yiq.y * sinA + yiq.z * cosA;
  yiq.y = newI;
  yiq.z = newZ;
  return clamp(vec4(yiqInverse * yiq, color.a), 0.0, 1.0);
}`.trim();
  }

  /**
   * 转换为 FFmpeg 滤镜字符串
   */
  static toFfmpegFilter(params: PrimarySliderParams): string {
    const filters: string[] = [];

    // 色温
    if (params.temperature !== 0) {
      const tempK = 6500 + params.temperature * 50; // -100~100 映射到 1500~11500K
      filters.push(`colortemperature=temperature=${tempK}`);
    }

    // 色调
    if (params.tint !== 0) {
      filters.push(`hue=h=0:s=1:b=${params.tint / 100}`);
    }

    // 对比度 + 饱和度
    if (params.contrast !== 0 || params.saturation !== 100) {
      const contrast = 1 + params.contrast / 100;
      const saturation = params.saturation / 100;
      filters.push(`eq=contrast=${contrast}:saturation=${saturation}`);
    }

    // 色相旋转
    if (params.hue !== 0) {
      filters.push(`hue=h=${params.hue}`);
    }

    return filters.join(',');
  }
}
