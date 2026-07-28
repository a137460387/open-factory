/**
 * ACES色彩管理模块 - 传输特性函数
 */

/**
 * 传输特性函数
 */
export const TRANSFER_FUNCTIONS = {
  /**
   * sRGB传输特性（线性到sRGB）
   */
  linearToSrgb(value: number): number {
    return value <= 0.0031308 ? value * 12.92 : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
  },

  /**
   * sRGB传输特性（sRGB到线性）
   */
  srgbToLinear(value: number): number {
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  },

  /**
   * Gamma 2.2（线性到gamma）
   */
  linearToGamma22(value: number): number {
    return Math.pow(value, 1 / 2.2);
  },

  /**
   * Gamma 2.2（gamma到线性）
   */
  gamma22ToLinear(value: number): number {
    return Math.pow(value, 2.2);
  },

  /**
   * PQ传输特性（线性到PQ）
   */
  linearToPQ(value: number): number {
    const m1 = 0.1593017578125;
    const m2 = 78.84375;
    const c1 = 0.8359375;
    const c2 = 18.8515625;
    const c3 = 18.6875;

    const y = value / 10000; // 归一化到10000 nits
    const ym1 = Math.pow(y, m1);

    return Math.pow((c1 + c2 * ym1) / (1 + c3 * ym1), m2);
  },

  /**
   * PQ传输特性（PQ到线性）
   */
  pqToLinear(value: number): number {
    const m1 = 0.1593017578125;
    const m2 = 78.84375;
    const c1 = 0.8359375;
    const c2 = 18.8515625;
    const c3 = 18.6875;

    const p = Math.pow(value, 1 / m2);
    const num = Math.max(p - c1, 0);
    const den = c2 - c3 * p;

    return Math.pow(num / den, 1 / m1) * 10000;
  },

  /**
   * HLG传输特性（线性到HLG）
   */
  linearToHLG(value: number): number {
    const a = 0.17883277;
    const b = 0.28466892;
    const c = 0.55991073;

    if (value <= 1 / 12) {
      return Math.sqrt(3 * value);
    } else {
      return a * Math.log(12 * value - b) + c;
    }
  },

  /**
   * HLG传输特性（HLG到线性）
   */
  hlgToLinear(value: number): number {
    const a = 0.17883277;
    const b = 0.28466892;
    const c = 0.55991073;

    if (value <= 0.5) {
      return (value * value) / 3;
    } else {
      return (Math.exp((value - c) / a) + b) / 12;
    }
  },

  /**
   * ACEScct传输特性（线性到ACEScct）
   */
  linearToACEScct(value: number): number {
    if (value <= 0.0078125) {
      return 10.5402377416545 * value + 0.0729055341958355;
    } else {
      return (Math.log2(value) + 9.72) / 17.52;
    }
  },

  /**
   * ACEScct传输特性（ACEScct到线性）
   */
  acescctToLinear(value: number): number {
    if (value <= 0.155251141552511) {
      return (value - 0.0729055341958355) / 10.5402377416545;
    } else {
      return Math.pow(2, value * 17.52 - 9.72);
    }
  },
};
