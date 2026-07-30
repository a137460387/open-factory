/**
 * ACES色彩管理模块 - 类型定义
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
  | 'input' // 输入设备转换 (IDT)
  | 'working' // 工作色彩空间
  | 'output' // 输出显示转换 (ODT)
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
export type ColorMatrix3x3 = [number, number, number, number, number, number, number, number, number];

/**
 * 色彩矩阵 (4x4)
 */
export type ColorMatrix4x4 = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
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
  'srgb' | 'gamma2.2' | 'gamma2.4' | 'gamma2.6' | 'pq' | 'hlg' | 'linear' | 'log' | 'acescct' | 'acescc' | 'acesproxy';

/**
 * 色域
 */
export type ColorGamut = 'srgb' | 'rec709' | 'rec2020' | 'display-p3' | 'dci-p3' | 'aces' | 'custom';

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
