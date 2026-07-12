import type { PrimaryWheelParams } from './types';

export class PrimaryWheels {
  /**
   * 将色轮参数转换为 WebGL uniform 值
   */
  static toUniforms(
    params: PrimaryWheelParams,
    prefix: string
  ): Record<string, number[]> {
    return {
      [`${prefix}_lift`]: [params.lift.r, params.lift.g, params.lift.b, params.liftMaster],
      [`${prefix}_gamma`]: [params.gamma.r, params.gamma.g, params.gamma.b, params.gammaMaster],
      [`${prefix}_gain`]: [params.gain.r, params.gain.g, params.gain.b, params.gainMaster],
      [`${prefix}_offset`]: [params.offset.r, params.offset.g, params.offset.b, params.offsetMaster],
    };
  }

  /**
   * 生成 GLSL 着色器代码片段
   */
  static toGlslSnippet(prefix: string): string {
    return [
      `// Primary Wheels`,
      `color = applyLiftGammaGain(color,`,
      `  ${prefix}_lift, ${prefix}_gamma, ${prefix}_gain, ${prefix}_offset);`,
    ].join('\n');
  }

  /**
   * 生成 GLSL 函数定义
   */
  static generateGlslFunction(): string {
    return `
vec4 applyLiftGammaGain(vec4 color, vec4 lift, vec4 gamma, vec4 gain, vec4 offset) {
  // Lift: 加到暗部
  vec3 lifted = color.rgb + lift.rgb * (1.0 - color.rgb) + lift.a;

  // Gain: 乘到高光
  vec3 gained = lifted * (1.0 + gain.rgb) + gain.a;

  // Gamma: 中间调调整
  vec3 gammaCorrected = pow(max(gained, vec3(0.0001)), 1.0 / (1.0 + gamma.rgb + gamma.a));

  // Offset: 整体偏移
  vec3 result = gammaCorrected + offset.rgb + offset.a;

  return vec4(clamp(result, 0.0, 1.0), color.a);
}`.trim();
  }

  /**
   * 转换为 FFmpeg 滤镜字符串
   */
  static toFfmpegFilter(params: PrimaryWheelParams): string {
    const filters: string[] = [];

    // 检查是否有非零的 lift/gamma/gain
    const hasLift = params.lift.r !== 0 || params.lift.g !== 0 || params.lift.b !== 0 || params.liftMaster !== 0;
    const hasGamma = params.gamma.r !== 0 || params.gamma.g !== 0 || params.gamma.b !== 0 || params.gammaMaster !== 0;
    const hasGain = params.gain.r !== 0 || params.gain.g !== 0 || params.gain.b !== 0 || params.gainMaster !== 0;

    if (hasLift || hasGamma || hasGain) {
      // 使用 colorbalance 滤镜
      const rs = params.lift.r + params.liftMaster;
      const gs = params.lift.g + params.liftMaster;
      const bs = params.lift.b + params.liftMaster;
      const rm = params.gamma.r + params.gammaMaster;
      const gm = params.gamma.g + params.gammaMaster;
      const bm = params.gamma.b + params.gammaMaster;
      const rh = params.gain.r + params.gainMaster;
      const gh = params.gain.g + params.gainMaster;
      const bh = params.gain.b + params.gainMaster;

      filters.push(
        `colorbalance=rs=${rs}:gs=${gs}:bs=${bs}:rm=${rm}:gm=${gm}:bm=${bm}:rh=${rh}:gh=${gh}:bh=${bh}`
      );
    }

    // Offset 使用 curves 滤镜
    const hasOffset = params.offset.r !== 0 || params.offset.g !== 0 || params.offset.b !== 0 || params.offsetMaster !== 0;
    if (hasOffset) {
      const or = 0.5 + params.offset.r + params.offsetMaster;
      const og = 0.5 + params.offset.g + params.offsetMaster;
      const ob = 0.5 + params.offset.b + params.offsetMaster;
      filters.push(`curves=r='0/0 0.5/${or} 1/1':g='0/0 0.5/${og} 1/1':b='0/0 0.5/${ob} 1/1'`);
    }

    return filters.join(',');
  }
}
