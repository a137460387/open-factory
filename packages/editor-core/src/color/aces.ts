/**
 * ACES色彩管理模块
 * 
 * 功能：
 * 1. ACES工作流基础 - 实现ACES色彩空间转换
 * 2. OCIO色彩管理框架集成 - 支持OpenColorIO配置
 * 3. HDR调色支持 - 支持HDR色彩空间和调色
 * 4. LUT管理 - 管理和应用LUT
 */

// ==================== 类型定义 ====================

/**
 * 色彩空间
 */
export type ColorSpace = 
  | 'srgb'
  | 'rec709'
  | 'rec2020'
  | 'display-p3'
  | 'dci-p3'
  | 'aces2065-1'
  | 'acescg'
  | 'acescct'
  | 'acescc'
  | 'acesproxy'
  | 'lin-rec709'
  | 'lin-rec2020'
  | 'lin-display-p3'
  | 'log-rec709'
  | 'log-rec2020'
  | 'custom';

/**
 * ACES工作流阶段
 */
export type ACESStage = 
  | 'input'      // 输入设备转换 (IDT)
  | 'working'    // 工作色彩空间
  | 'output'     // 输出显示转换 (ODT)
  | 'reference'; // 参考色彩空间

/**
 * 色彩管理配置
 */
export interface ColorManagementConfig {
  /** 工作色彩空间 */
  workingColorSpace: ColorSpace;
  /** 显示色彩空间 */
  displayColorSpace: ColorSpace;
  /** 输出色彩空间 */
  outputColorSpace: ColorSpace;
  /** 是否启用ACES */
  enableACES: boolean;
  /** ACES版本 */
  acesVersion: '1.0' | '1.1' | '1.2' | '1.3';
  /** 是否启用HDR */
  enableHDR: boolean;
  /** HDR峰值亮度 (nits) */
  hdrPeakLuminance: number;
  /** 是否启用色调映射 */
  enableToneMapping: boolean;
  /** 色调映射方法 */
  toneMappingMethod: ToneMappingMethod;
  /** 是否启用LUT */
  enableLUT: boolean;
  /** LUT大小 */
  lutSize: number;
}

/**
 * 色调映射方法
 */
export type ToneMappingMethod = 
  | 'none'
  | 'reinhard'
  | 'reinhard-extended'
  | 'filmic'
  | 'aces-hill'
  | 'aces-narkowicz'
  | 'aces-lottes'
  | 'uncharted2'
  | 'agx'
  | 'custom';

/**
 * 色彩矩阵 (3x3)
 */
export type ColorMatrix3x3 = [
  number, number, number,
  number, number, number,
  number, number, number,
];

/**
 * 色彩矩阵 (4x4)
 */
export type ColorMatrix4x4 = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

/**
 * RGB颜色
 */
export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

/**
 * XYZ颜色
 */
export interface XYZColor {
  x: number;
  y: number;
  z: number;
}

/**
 * LAB颜色
 */
export interface LABColor {
  l: number;
  a: number;
  b: number;
}

/**
 * 色彩空间转换配置
 */
export interface ColorSpaceConversion {
  /** 源色彩空间 */
  from: ColorSpace;
  /** 目标色彩空间 */
  to: ColorSpace;
  /** 转换矩阵 */
  matrix?: ColorMatrix3x3;
  /** 是否使用LUT */
  useLUT: boolean;
  /** LUT ID */
  lutId?: string;
}

/**
 * LUT数据
 */
export interface LUTData {
  /** LUT ID */
  id: string;
  /** LUT名称 */
  name: string;
  /** LUT类型 */
  type: '1d' | '3d';
  /** LUT大小 */
  size: number;
  /** LUT数据 */
  data: Float32Array;
  /** 源色彩空间 */
  sourceColorSpace: ColorSpace;
  /** 目标色彩空间 */
  targetColorSpace: ColorSpace;
  /** 域最小值 */
  domainMin: RGBColor;
  /** 域最大值 */
  domainMax: RGBColor;
}

/**
 * LUT库
 */
export interface LUTLibrary {
  /** LUT映射 */
  luts: Map<string, LUTData>;
  /** 添加LUT */
  addLUT(lut: LUTData): void;
  /** 获取LUT */
  getLUT(id: string): LUTData | undefined;
  /** 移除LUT */
  removeLUT(id: string): boolean;
  /** 列出所有LUT */
  listLUTs(): LUTData[];
}

/**
 * HDR元数据
 */
export interface HDRMetadata {
  /** 是否为HDR */
  isHDR: boolean;
  /** 色彩空间 */
  colorSpace: ColorSpace;
  /** 传输特性 */
  transferFunction: TransferFunction;
  /** 峰值亮度 (nits) */
  peakLuminance: number;
  /** 平均亮度 (nits) */
  averageLuminance: number;
  /** 最小亮度 (nits) */
  minLuminance: number;
  /** 色域 */
  colorGamut: ColorGamut;
}

/**
 * 传输特性
 */
export type TransferFunction = 
  | 'srgb'
  | 'gamma2.2'
  | 'gamma2.4'
  | 'gamma2.6'
  | 'pq'
  | 'hlg'
  | 'linear'
  | 'log'
  | 'acescct'
  | 'acescc'
  | 'acesproxy';

/**
 * 色域
 */
export type ColorGamut = 
  | 'srgb'
  | 'rec709'
  | 'rec2020'
  | 'display-p3'
  | 'dci-p3'
  | 'aces'
  | 'custom';

/**
 * OCIO配置
 */
export interface OCIOConfig {
  /** 配置名称 */
  name: string;
  /** 配置版本 */
  version: string;
  /** 色彩空间列表 */
  colorSpaces: OCIOColorSpace[];
  /** 视图列表 */
  views: OCIOView[];
  /** 显示列表 */
  displays: OCIODisplay[];
  /** 默认显示 */
  defaultDisplay: string;
  /** 默认视图 */
  defaultView: string;
}

/**
 * OCIO色彩空间
 */
export interface OCIOColorSpace {
  /** 名称 */
  name: string;
  /** 家族 */
  family: string;
  /** 描述 */
  description: string;
  /** 别名 */
  aliases: string[];
  /** 是否为参考空间 */
  isReference: boolean;
  /** 转换类型 */
  conversionType: 'matrix' | 'function' | 'lut';
  /** 转换参数 */
  conversionParams: Record<string, number | string | number[]>;
}

/**
 * OCIO视图
 */
export interface OCIOView {
  /** 名称 */
  name: string;
  /** 视图变换 */
  viewTransform: string;
  /** 色调映射 */
  toneMapping?: string;
}

/**
 * OCIO显示
 */
export interface OCIODisplay {
  /** 名称 */
  name: string;
  /** 视图列表 */
  views: string[];
}

// ==================== 辅助函数 ====================

/**
 * 钳制值到范围
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 线性插值
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 矩阵向量乘法 (3x3)
 */
export function multiplyMatrix3x3(matrix: ColorMatrix3x3, vector: RGBColor): RGBColor {
  return {
    r: matrix[0] * vector.r + matrix[1] * vector.g + matrix[2] * vector.b,
    g: matrix[3] * vector.r + matrix[4] * vector.g + matrix[5] * vector.b,
    b: matrix[6] * vector.r + matrix[7] * vector.g + matrix[8] * vector.b,
  };
}

/**
 * 矩阵向量乘法 (4x4)
 */
export function multiplyMatrix4x4(matrix: ColorMatrix4x4, vector: RGBColor): RGBColor {
  return {
    r: matrix[0] * vector.r + matrix[1] * vector.g + matrix[2] * vector.b + matrix[3],
    g: matrix[4] * vector.r + matrix[5] * vector.g + matrix[6] * vector.b + matrix[7],
    b: matrix[8] * vector.r + matrix[9] * vector.g + matrix[10] * vector.b + matrix[11],
  };
}

/**
 * 矩阵乘法 (3x3)
 */
export function multiplyMatrices3x3(a: ColorMatrix3x3, b: ColorMatrix3x3): ColorMatrix3x3 {
  return [
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
    a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
    a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
    a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
    a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
    a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
    a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
    a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
    a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
  ];
}

/**
 * 计算矩阵逆 (3x3)
 */
export function invertMatrix3x3(matrix: ColorMatrix3x3): ColorMatrix3x3 {
  const [
    a, b, c,
    d, e, f,
    g, h, i,
  ] = matrix;

  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);

  if (Math.abs(det) < 1e-10) {
    throw new Error('矩阵不可逆');
  }

  const invDet = 1 / det;

  return [
    (e * i - f * h) * invDet,
    (c * h - b * i) * invDet,
    (b * f - c * e) * invDet,
    (f * g - d * i) * invDet,
    (a * i - c * g) * invDet,
    (c * d - a * f) * invDet,
    (d * h - e * g) * invDet,
    (b * g - a * h) * invDet,
    (a * e - b * d) * invDet,
  ];
}

// ==================== 核心功能 ====================

/**
 * 默认色彩管理配置
 */
export const DEFAULT_COLOR_MANAGEMENT_CONFIG: ColorManagementConfig = {
  workingColorSpace: 'acescg',
  displayColorSpace: 'srgb',
  outputColorSpace: 'rec709',
  enableACES: true,
  acesVersion: '1.3',
  enableHDR: false,
  hdrPeakLuminance: 1000,
  enableToneMapping: true,
  toneMappingMethod: 'aces-hill',
  enableLUT: true,
  lutSize: 33,
};

/**
 * ACES色彩空间转换矩阵
 */
export const ACES_MATRICES = {
  // sRGB到ACES2065-1 (AP0)
  srgbToAP0: [
    0.4396744, 0.3829868, 0.1773388,
    0.0897764, 0.8134392, 0.0967844,
    0.0175417, 0.1115465, 0.8709118,
  ] as ColorMatrix3x3,

  // ACES2065-1 (AP0) 到 sRGB
  ap0ToSrgb: [
    2.5216474, -1.1366888, -0.3849586,
    -0.2754369, 1.3700779, -0.0946410,
    -0.0159316, -0.1529726, 1.1689042,
  ] as ColorMatrix3x3,

  // ACEScg (AP1) 到 ACES2065-1 (AP0)
  ap1ToAP0: [
    0.6954522, 0.1406787, 0.1638690,
    0.0447946, 0.8596711, 0.0955343,
    -0.0055259, 0.0040252, 1.0015007,
  ] as ColorMatrix3x3,

  // ACES2065-1 (AP0) 到 ACEScg (AP1)
  ap0ToAP1: [
    1.4514393, -0.2365107, -0.2149286,
    -0.0765538, 1.1762297, -0.0996759,
    0.0083162, -0.0060324, 0.9977163,
  ] as ColorMatrix3x3,

  // Rec.709 到 ACES2065-1 (AP0)
  rec709ToAP0: [
    0.4396744, 0.3829868, 0.1773388,
    0.0897764, 0.8134392, 0.0967844,
    0.0175417, 0.1115465, 0.8709118,
  ] as ColorMatrix3x3,

  // ACES2065-1 (AP0) 到 Rec.709
  ap0ToRec709: [
    2.5216474, -1.1366888, -0.3849586,
    -0.2754369, 1.3700779, -0.0946410,
    -0.0159316, -0.1529726, 1.1689042,
  ] as ColorMatrix3x3,

  // Rec.2020 到 ACES2065-1 (AP0)
  rec2020ToAP0: [
    0.4396744, 0.3829868, 0.1773388,
    0.0897764, 0.8134392, 0.0967844,
    0.0175417, 0.1115465, 0.8709118,
  ] as ColorMatrix3x3,

  // ACES2065-1 (AP0) 到 Rec.2020
  ap0ToRec2020: [
    2.5216474, -1.1366888, -0.3849586,
    -0.2754369, 1.3700779, -0.0946410,
    -0.0159316, -0.1529726, 1.1689042,
  ] as ColorMatrix3x3,
};

/**
 * 传输特性函数
 */
export const TRANSFER_FUNCTIONS = {
  /**
   * sRGB传输特性（线性到sRGB）
   */
  linearToSrgb(value: number): number {
    return value <= 0.0031308
      ? value * 12.92
      : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
  },

  /**
   * sRGB传输特性（sRGB到线性）
   */
  srgbToLinear(value: number): number {
    return value <= 0.04045
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
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

/**
 * 色调映射函数
 */
export const TONE_MAPPING_FUNCTIONS = {
  /**
   * Reinhard色调映射
   */
  reinhard(color: RGBColor): RGBColor {
    return {
      r: color.r / (1 + color.r),
      g: color.g / (1 + color.g),
      b: color.b / (1 + color.b),
    };
  },

  /**
   * Reinhard扩展色调映射
   */
  reinhardExtended(color: RGBColor, maxWhite: number = 1): RGBColor {
    const divisor = 1 + color.r / (maxWhite * maxWhite);
    return {
      r: color.r * (1 + color.r / (maxWhite * maxWhite)) / divisor,
      g: color.g * (1 + color.g / (maxWhite * maxWhite)) / (1 + color.g / (maxWhite * maxWhite)),
      b: color.b * (1 + color.b / (maxWhite * maxWhite)) / (1 + color.b / (maxWhite * maxWhite)),
    };
  },

  /**
   * ACES Hill色调映射
   */
  acesHill(color: RGBColor): RGBColor {
    const a = 2.51;
    const b = 0.03;
    const c = 2.43;
    const d = 0.59;
    const e = 0.14;

    return {
      r: clamp((color.r * (a * color.r + b)) / (color.r * (c * color.r + d) + e), 0, 1),
      g: clamp((color.g * (a * color.g + b)) / (color.g * (c * color.g + d) + e), 0, 1),
      b: clamp((color.b * (a * color.b + b)) / (color.b * (c * color.b + d) + e), 0, 1),
    };
  },

  /**
   * ACES Narkowicz色调映射
   */
  acesNarkowicz(color: RGBColor): RGBColor {
    const a = 2.51;
    const b = 0.03;
    const c = 2.43;
    const d = 0.59;
    const e = 0.14;

    return {
      r: clamp((color.r * (a * color.r + b)) / (color.r * (c * color.r + d) + e), 0, 1),
      g: clamp((color.g * (a * color.g + b)) / (color.g * (c * color.g + d) + e), 0, 1),
      b: clamp((color.b * (a * color.b + b)) / (color.b * (c * color.b + d) + e), 0, 1),
    };
  },

  /**
   * Filmic色调映射（Hable/Uncharted 2）
   */
  filmic(color: RGBColor): RGBColor {
    const A = 0.15; // Shoulder Strength
    const B = 0.50; // Linear Strength
    const C = 0.10; // Linear Angle
    const D = 0.20; // Toe Strength
    const E = 0.02; // Toe Numerator
    const F = 0.30; // Toe Denominator

    const filmicChannel = (x: number) => {
      return ((x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * F)) - E / F;
    };

    const whiteScale = 1 / filmicChannel(1);

    return {
      r: clamp(filmicChannel(color.r) * whiteScale, 0, 1),
      g: clamp(filmicChannel(color.g) * whiteScale, 0, 1),
      b: clamp(filmicChannel(color.b) * whiteScale, 0, 1),
    };
  },

  /**
   * AGX色调映射
   */
  agx(color: RGBColor): RGBColor {
    // 简化的AGX实现
    const minEv = -12.47393;
    const maxEv = 4.026069;

    const linearToAgx = (x: number) => {
      return clamp(Math.log2(x) - minEv / (maxEv - minEv), 0, 1);
    };

    return {
      r: linearToAgx(color.r),
      g: linearToAgx(color.g),
      b: linearToAgx(color.b),
    };
  },
};

/**
 * 色彩空间转换函数
 */
export const COLOR_SPACE_CONVERSIONS = {
  /**
   * sRGB到XYZ (D65)
   */
  srgbToXYZ(color: RGBColor): XYZColor {
    // sRGB到XYZ矩阵 (D65)
    const matrix: ColorMatrix3x3 = [
      0.4124564, 0.3575761, 0.1804375,
      0.2126729, 0.7151522, 0.0721750,
      0.0193339, 0.1191920, 0.9503041,
    ];

    // 线性化sRGB
    const linear: RGBColor = {
      r: TRANSFER_FUNCTIONS.srgbToLinear(color.r),
      g: TRANSFER_FUNCTIONS.srgbToLinear(color.g),
      b: TRANSFER_FUNCTIONS.srgbToLinear(color.b),
    };

    const result = multiplyMatrix3x3(matrix, linear);
    return { x: result.r, y: result.g, z: result.b };
  },

  /**
   * XYZ到sRGB (D65)
   */
  xyzToSrgb(color: XYZColor): RGBColor {
    // XYZ到sRGB矩阵 (D65)
    const matrix: ColorMatrix3x3 = [
      3.2404542, -1.5371385, -0.4985314,
      -0.9692660, 1.8760108, 0.0415560,
      0.0556434, -0.2040259, 1.0572252,
    ];

    const linear = multiplyMatrix3x3(matrix, { r: color.x, g: color.y, b: color.z });

    return {
      r: TRANSFER_FUNCTIONS.linearToSrgb(clamp(linear.r, 0, 1)),
      g: TRANSFER_FUNCTIONS.linearToSrgb(clamp(linear.g, 0, 1)),
      b: TRANSFER_FUNCTIONS.linearToSrgb(clamp(linear.b, 0, 1)),
    };
  },

  /**
   * XYZ到LAB
   */
  xyzToLab(color: XYZColor): LABColor {
    // D65白点
    const Xn = 0.95047;
    const Yn = 1.0;
    const Zn = 1.08883;

    const f = (t: number) => {
      const delta = 6 / 29;
      return t > delta * delta * delta
        ? Math.pow(t, 1 / 3)
        : t / (3 * delta * delta) + 4 / 29;
    };

    const fx = f(color.x / Xn);
    const fy = f(color.y / Yn);
    const fz = f(color.z / Zn);

    return {
      l: 116 * fy - 16,
      a: 500 * (fx - fy),
      b: 200 * (fy - fz),
    };
  },

  /**
   * LAB到XYZ
   */
  labToXYZ(color: LABColor): XYZColor {
    // D65白点
    const Xn = 0.95047;
    const Yn = 1.0;
    const Zn = 1.08883;

    const fy = (color.l + 16) / 116;
    const fx = color.a / 500 + fy;
    const fz = fy - color.b / 200;

    const delta = 6 / 29;

    const fInv = (t: number) => {
      return t > delta
        ? t * t * t
        : 3 * delta * delta * (t - 4 / 29);
    };

    return {
      x: Xn * fInv(fx),
      y: Yn * fInv(fy),
      z: Zn * fInv(fz),
    };
  },
};

/**
 * LUT管理器
 */
export class LUTManager implements LUTLibrary {
  luts: Map<string, LUTData> = new Map();

  addLUT(lut: LUTData): void {
    this.luts.set(lut.id, lut);
  }

  getLUT(id: string): LUTData | undefined {
    return this.luts.get(id);
  }

  removeLUT(id: string): boolean {
    return this.luts.delete(id);
  }

  listLUTs(): LUTData[] {
    return Array.from(this.luts.values());
  }

  /**
   * 应用3D LUT
   */
  apply3DLUT(lut: LUTData, color: RGBColor): RGBColor {
    if (lut.type !== '3d') {
      throw new Error('只能应用3D LUT');
    }

    const { size, data, domainMin, domainMax } = lut;

    // 归一化到LUT域
    const normalized: RGBColor = {
      r: (color.r - domainMin.r) / (domainMax.r - domainMin.r),
      g: (color.g - domainMin.g) / (domainMax.g - domainMin.g),
      b: (color.b - domainMin.b) / (domainMax.b - domainMin.b),
    };

    // 钳制到[0, 1]
    const clamped: RGBColor = {
      r: clamp(normalized.r, 0, 1),
      g: clamp(normalized.g, 0, 1),
      b: clamp(normalized.b, 0, 1),
    };

    // 计算LUT索引
    const rIdx = clamped.r * (size - 1);
    const gIdx = clamped.g * (size - 1);
    const bIdx = clamped.b * (size - 1);

    // 三线性插值
    const r0 = Math.floor(rIdx);
    const g0 = Math.floor(gIdx);
    const b0 = Math.floor(bIdx);
    const r1 = Math.min(r0 + 1, size - 1);
    const g1 = Math.min(g0 + 1, size - 1);
    const b1 = Math.min(b0 + 1, size - 1);

    const rf = rIdx - r0;
    const gf = gIdx - g0;
    const bf = bIdx - b0;

    // 获取LUT值
    const getLUTValue = (ri: number, gi: number, bi: number, channel: number): number => {
      const idx = (bi * size * size + gi * size + ri) * 3 + channel;
      return data[idx];
    };

    // 三线性插值
    const interpolate = (channel: number): number => {
      const c000 = getLUTValue(r0, g0, b0, channel);
      const c001 = getLUTValue(r0, g0, b1, channel);
      const c010 = getLUTValue(r0, g1, b0, channel);
      const c011 = getLUTValue(r0, g1, b1, channel);
      const c100 = getLUTValue(r1, g0, b0, channel);
      const c101 = getLUTValue(r1, g0, b1, channel);
      const c110 = getLUTValue(r1, g1, b0, channel);
      const c111 = getLUTValue(r1, g1, b1, channel);

      const c00 = lerp(c000, c100, rf);
      const c01 = lerp(c001, c101, rf);
      const c10 = lerp(c010, c110, rf);
      const c11 = lerp(c011, c111, rf);

      const c0 = lerp(c00, c10, gf);
      const c1 = lerp(c01, c11, gf);

      return lerp(c0, c1, bf);
    };

    return {
      r: interpolate(0),
      g: interpolate(1),
      b: interpolate(2),
    };
  }

  /**
   * 应用1D LUT
   */
  apply1DLUT(lut: LUTData, color: RGBColor): RGBColor {
    if (lut.type !== '1d') {
      throw new Error('只能应用1D LUT');
    }

    const { size, data, domainMin, domainMax } = lut;

    const interpolate1D = (value: number, channel: number): number => {
      const normalized = (value - domainMin.r) / (domainMax.r - domainMin.r);
      const clamped = clamp(normalized, 0, 1);
      const idx = clamped * (size - 1);
      const i0 = Math.floor(idx);
      const i1 = Math.min(i0 + 1, size - 1);
      const f = idx - i0;

      return lerp(data[i0 * 3 + channel], data[i1 * 3 + channel], f);
    };

    return {
      r: interpolate1D(color.r, 0),
      g: interpolate1D(color.g, 1),
      b: interpolate1D(color.b, 2),
    };
  }
}

/**
 * ACES色彩管理器
 */
export class ACESColorManager {
  private config: ColorManagementConfig;
  private lutManager: LUTManager;

  constructor(config: Partial<ColorManagementConfig> = {}) {
    this.config = { ...DEFAULT_COLOR_MANAGEMENT_CONFIG, ...config };
    this.lutManager = new LUTManager();
  }

  /**
   * 获取配置
   */
  getConfig(): ColorManagementConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ColorManagementConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取LUT管理器
   */
  getLUTManager(): LUTManager {
    return this.lutManager;
  }

  /**
   * 色彩空间转换
   */
  convertColorSpace(
    color: RGBColor,
    from: ColorSpace,
    to: ColorSpace
  ): RGBColor {
    if (from === to) {
      return { ...color };
    }

    // 转换到参考色彩空间 (ACES2065-1)
    let reference = this.toReference(color, from);

    // 从参考色彩空间转换到目标
    return this.fromReference(reference, to);
  }

  /**
   * 转换到参考色彩空间 (ACES2065-1)
   */
  private toReference(color: RGBColor, from: ColorSpace): RGBColor {
    switch (from) {
      case 'srgb':
      case 'rec709':
        return multiplyMatrix3x3(ACES_MATRICES.srgbToAP0, color);
      
      case 'rec2020':
        return multiplyMatrix3x3(ACES_MATRICES.rec2020ToAP0, color);
      
      case 'aces2065-1':
        return { ...color };
      
      case 'acescg':
        return multiplyMatrix3x3(ACES_MATRICES.ap1ToAP0, color);
      
      case 'lin-rec709':
        return multiplyMatrix3x3(ACES_MATRICES.srgbToAP0, color);
      
      case 'lin-rec2020':
        return multiplyMatrix3x3(ACES_MATRICES.rec2020ToAP0, color);
      
      case 'acescct':
        // 先转换为线性
        const linear: RGBColor = {
          r: TRANSFER_FUNCTIONS.acescctToLinear(color.r),
          g: TRANSFER_FUNCTIONS.acescctToLinear(color.g),
          b: TRANSFER_FUNCTIONS.acescctToLinear(color.b),
        };
        return multiplyMatrix3x3(ACES_MATRICES.ap1ToAP0, linear);
      
      default:
        // 默认假设为sRGB
        return multiplyMatrix3x3(ACES_MATRICES.srgbToAP0, color);
    }
  }

  /**
   * 从参考色彩空间转换
   */
  private fromReference(color: RGBColor, to: ColorSpace): RGBColor {
    switch (to) {
      case 'srgb':
      case 'rec709':
        return multiplyMatrix3x3(ACES_MATRICES.ap0ToSrgb, color);
      
      case 'rec2020':
        return multiplyMatrix3x3(ACES_MATRICES.ap0ToRec2020, color);
      
      case 'aces2065-1':
        return { ...color };
      
      case 'acescg':
        return multiplyMatrix3x3(ACES_MATRICES.ap0ToAP1, color);
      
      case 'lin-rec709':
        return multiplyMatrix3x3(ACES_MATRICES.ap0ToSrgb, color);
      
      case 'lin-rec2020':
        return multiplyMatrix3x3(ACES_MATRICES.ap0ToRec2020, color);
      
      case 'acescct':
        // 转换为ACEScg，然后应用ACEScct传输特性
        const ap1 = multiplyMatrix3x3(ACES_MATRICES.ap0ToAP1, color);
        return {
          r: TRANSFER_FUNCTIONS.linearToACEScct(ap1.r),
          g: TRANSFER_FUNCTIONS.linearToACEScct(ap1.g),
          b: TRANSFER_FUNCTIONS.linearToACEScct(ap1.b),
        };
      
      default:
        return multiplyMatrix3x3(ACES_MATRICES.ap0ToSrgb, color);
    }
  }

  /**
   * 应用色调映射
   */
  applyToneMapping(color: RGBColor, method?: ToneMappingMethod): RGBColor {
    const toneMappingMethod = method || this.config.toneMappingMethod;

    switch (toneMappingMethod) {
      case 'reinhard':
        return TONE_MAPPING_FUNCTIONS.reinhard(color);
      
      case 'reinhard-extended':
        return TONE_MAPPING_FUNCTIONS.reinhardExtended(color);
      
      case 'aces-hill':
        return TONE_MAPPING_FUNCTIONS.acesHill(color);
      
      case 'aces-narkowicz':
        return TONE_MAPPING_FUNCTIONS.acesNarkowicz(color);
      
      case 'filmic':
        return TONE_MAPPING_FUNCTIONS.filmic(color);
      
      case 'agx':
        return TONE_MAPPING_FUNCTIONS.agx(color);
      
      case 'none':
      default:
        return { ...color };
    }
  }

  /**
   * 处理图像
   */
  processImage(
    imageData: Uint8ClampedArray,
    width: number,
    height: number,
    sourceColorSpace: ColorSpace,
    targetColorSpace: ColorSpace
  ): Uint8ClampedArray {
    const result = new Uint8ClampedArray(imageData.length);

    for (let i = 0; i < imageData.length; i += 4) {
      const color: RGBColor = {
        r: imageData[i] / 255,
        g: imageData[i + 1] / 255,
        b: imageData[i + 2] / 255,
      };

      // 色彩空间转换
      let converted = this.convertColorSpace(color, sourceColorSpace, targetColorSpace);

      // 应用色调映射（如果需要）
      if (this.config.enableToneMapping) {
        converted = this.applyToneMapping(converted);
      }

      // 应用LUT（如果启用）
      if (this.config.enableLUT) {
        const luts = this.lutManager.listLUTs();
        for (const lut of luts) {
          if (lut.type === '3d') {
            converted = this.lutManager.apply3DLUT(lut, converted);
          } else {
            converted = this.lutManager.apply1DLUT(lut, converted);
          }
        }
      }

      // 钳制并写入结果
      result[i] = clamp(Math.round(converted.r * 255), 0, 255);
      result[i + 1] = clamp(Math.round(converted.g * 255), 0, 255);
      result[i + 2] = clamp(Math.round(converted.b * 255), 0, 255);
      result[i + 3] = imageData[i + 3];
    }

    return result;
  }

  /**
   * 生成OCIO配置
   */
  generateOCIOConfig(): OCIOConfig {
    return {
      name: 'Open Factory ACES Config',
      version: '1.0',
      colorSpaces: [
        {
          name: 'sRGB',
          family: 'Input',
          description: 'sRGB色彩空间',
          aliases: ['srgb', 'srgb_texture'],
          isReference: false,
          conversionType: 'matrix',
          conversionParams: {
            matrix: ACES_MATRICES.srgbToAP0,
          },
        },
        {
          name: 'Rec.709',
          family: 'Input',
          description: 'Rec.709色彩空间',
          aliases: ['rec709', 'bt709'],
          isReference: false,
          conversionType: 'matrix',
          conversionParams: {
            matrix: ACES_MATRICES.rec709ToAP0,
          },
        },
        {
          name: 'ACES2065-1',
          family: 'ACES',
          description: 'ACES参考色彩空间',
          aliases: ['ap0', 'aces'],
          isReference: true,
          conversionType: 'matrix',
          conversionParams: {
            matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
          },
        },
        {
          name: 'ACEScg',
          family: 'ACES',
          description: 'ACES工作色彩空间',
          aliases: ['ap1', 'lin_acescg'],
          isReference: false,
          conversionType: 'matrix',
          conversionParams: {
            matrix: ACES_MATRICES.ap1ToAP0,
          },
        },
        {
          name: 'ACEScct',
          family: 'ACES',
          description: 'ACEScct色彩空间',
          aliases: ['acescct'],
          isReference: false,
          conversionType: 'function',
          conversionParams: {
            function: 'linearToACEScct',
          },
        },
      ],
      views: [
        {
          name: 'ACES 1.0 SDR Video',
          viewTransform: 'ACES Output - SDR Video',
          toneMapping: 'aces-hill',
        },
        {
          name: 'ACES 1.0 HDR Video (1000 nits)',
          viewTransform: 'ACES Output - HDR Video',
          toneMapping: 'aces-hill',
        },
      ],
      displays: [
        {
          name: 'sRGB',
          views: ['ACES 1.0 SDR Video'],
        },
        {
          name: 'Rec.2020',
          views: ['ACES 1.0 HDR Video (1000 nits)'],
        },
      ],
      defaultDisplay: 'sRGB',
      defaultView: 'ACES 1.0 SDR Video',
    };
  }
}

/**
 * 创建默认色彩管理配置
 */
export function createDefaultColorManagementConfig(): ColorManagementConfig {
  return { ...DEFAULT_COLOR_MANAGEMENT_CONFIG };
}

/**
 * 验证色彩管理配置
 */
export function validateColorManagementConfig(config: ColorManagementConfig): boolean {
  return (
    typeof config.workingColorSpace === 'string' &&
    typeof config.displayColorSpace === 'string' &&
    typeof config.outputColorSpace === 'string' &&
    typeof config.enableACES === 'boolean' &&
    typeof config.acesVersion === 'string' &&
    typeof config.enableHDR === 'boolean' &&
    typeof config.hdrPeakLuminance === 'number' &&
    typeof config.enableToneMapping === 'boolean' &&
    typeof config.toneMappingMethod === 'string' &&
    typeof config.enableLUT === 'boolean' &&
    typeof config.lutSize === 'number'
  );
}

/**
 * 解析.cube LUT文件
 */
export function parseCubeFile(content: string): LUTData {
  const lines = content.split('\n');
  let title = '';
  let size = 0;
  let domainMin: RGBColor = { r: 0, g: 0, b: 0 };
  let domainMax: RGBColor = { r: 1, g: 1, b: 1 };
  const data: number[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('#')) {
      continue;
    }
    
    if (trimmed.startsWith('TITLE')) {
      title = trimmed.substring(6).trim().replace(/^["']|["']$/g, '');
    } else if (trimmed.startsWith('LUT_3D_SIZE')) {
      size = parseInt(trimmed.substring(12).trim());
    } else if (trimmed.startsWith('DOMAIN_MIN')) {
      const parts = trimmed.substring(11).trim().split(/\s+/);
      domainMin = {
        r: parseFloat(parts[0]),
        g: parseFloat(parts[1]),
        b: parseFloat(parts[2]),
      };
    } else if (trimmed.startsWith('DOMAIN_MAX')) {
      const parts = trimmed.substring(11).trim().split(/\s+/);
      domainMax = {
        r: parseFloat(parts[0]),
        g: parseFloat(parts[1]),
        b: parseFloat(parts[2]),
      };
    } else if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 3) {
        data.push(
          parseFloat(parts[0]),
          parseFloat(parts[1]),
          parseFloat(parts[2])
        );
      }
    }
  }

  return {
    id: generateId(),
    name: title || 'Untitled LUT',
    type: '3d',
    size,
    data: new Float32Array(data),
    sourceColorSpace: 'srgb',
    targetColorSpace: 'srgb',
    domainMin,
    domainMax,
  };
}

/**
 * 生成ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
