/**
 * ACES色彩管理模块
 *
 * 功能：
 * 1. ACES工作流基础 - 实现ACES色彩空间转换
 * 2. OCIO色彩管理框架集成 - 支持OpenColorIO配置
 * 3. HDR调色支持 - 支持HDR色彩空间和调色
 * 4. LUT管理 - 管理和应用LUT
 */
/**
 * 色彩空间
 */
export type ColorSpace = 'srgb' | 'rec709' | 'rec2020' | 'display-p3' | 'dci-p3' | 'aces2065-1' | 'acescg' | 'acescct' | 'acescc' | 'acesproxy' | 'lin-rec709' | 'lin-rec2020' | 'lin-display-p3' | 'log-rec709' | 'log-rec2020' | 'custom';
/**
 * ACES工作流阶段
 */
export type ACESStage = 'input' | 'working' | 'output' | 'reference';
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
export type ToneMappingMethod = 'none' | 'reinhard' | 'reinhard-extended' | 'filmic' | 'aces-hill' | 'aces-narkowicz' | 'aces-lottes' | 'uncharted2' | 'agx' | 'custom';
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
    number
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
export type TransferFunction = 'srgb' | 'gamma2.2' | 'gamma2.4' | 'gamma2.6' | 'pq' | 'hlg' | 'linear' | 'log' | 'acescct' | 'acescc' | 'acesproxy';
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
/**
 * 钳制值到范围
 */
export declare function clamp(value: number, min: number, max: number): number;
/**
 * 线性插值
 */
export declare function lerp(a: number, b: number, t: number): number;
/**
 * 矩阵向量乘法 (3x3)
 */
export declare function multiplyMatrix3x3(matrix: ColorMatrix3x3, vector: RGBColor): RGBColor;
/**
 * 矩阵向量乘法 (4x4)
 */
export declare function multiplyMatrix4x4(matrix: ColorMatrix4x4, vector: RGBColor): RGBColor;
/**
 * 矩阵乘法 (3x3)
 */
export declare function multiplyMatrices3x3(a: ColorMatrix3x3, b: ColorMatrix3x3): ColorMatrix3x3;
/**
 * 计算矩阵逆 (3x3)
 */
export declare function invertMatrix3x3(matrix: ColorMatrix3x3): ColorMatrix3x3;
/**
 * 默认色彩管理配置
 */
export declare const DEFAULT_COLOR_MANAGEMENT_CONFIG: ColorManagementConfig;
/**
 * ACES色彩空间转换矩阵
 */
export declare const ACES_MATRICES: {
    srgbToAP0: ColorMatrix3x3;
    ap0ToSrgb: ColorMatrix3x3;
    ap1ToAP0: ColorMatrix3x3;
    ap0ToAP1: ColorMatrix3x3;
    rec709ToAP0: ColorMatrix3x3;
    ap0ToRec709: ColorMatrix3x3;
    rec2020ToAP0: ColorMatrix3x3;
    ap0ToRec2020: ColorMatrix3x3;
};
/**
 * 传输特性函数
 */
export declare const TRANSFER_FUNCTIONS: {
    /**
     * sRGB传输特性（线性到sRGB）
     */
    linearToSrgb(value: number): number;
    /**
     * sRGB传输特性（sRGB到线性）
     */
    srgbToLinear(value: number): number;
    /**
     * Gamma 2.2（线性到gamma）
     */
    linearToGamma22(value: number): number;
    /**
     * Gamma 2.2（gamma到线性）
     */
    gamma22ToLinear(value: number): number;
    /**
     * PQ传输特性（线性到PQ）
     */
    linearToPQ(value: number): number;
    /**
     * PQ传输特性（PQ到线性）
     */
    pqToLinear(value: number): number;
    /**
     * HLG传输特性（线性到HLG）
     */
    linearToHLG(value: number): number;
    /**
     * HLG传输特性（HLG到线性）
     */
    hlgToLinear(value: number): number;
    /**
     * ACEScct传输特性（线性到ACEScct）
     */
    linearToACEScct(value: number): number;
    /**
     * ACEScct传输特性（ACEScct到线性）
     */
    acescctToLinear(value: number): number;
};
/**
 * 色调映射函数
 */
export declare const TONE_MAPPING_FUNCTIONS: {
    /**
     * Reinhard色调映射
     */
    reinhard(color: RGBColor): RGBColor;
    /**
     * Reinhard扩展色调映射
     */
    reinhardExtended(color: RGBColor, maxWhite?: number): RGBColor;
    /**
     * ACES Hill色调映射
     */
    acesHill(color: RGBColor): RGBColor;
    /**
     * ACES Narkowicz色调映射
     */
    acesNarkowicz(color: RGBColor): RGBColor;
    /**
     * Filmic色调映射（Hable/Uncharted 2）
     */
    filmic(color: RGBColor): RGBColor;
    /**
     * AGX色调映射
     */
    agx(color: RGBColor): RGBColor;
};
/**
 * 色彩空间转换函数
 */
export declare const COLOR_SPACE_CONVERSIONS: {
    /**
     * sRGB到XYZ (D65)
     */
    srgbToXYZ(color: RGBColor): XYZColor;
    /**
     * XYZ到sRGB (D65)
     */
    xyzToSrgb(color: XYZColor): RGBColor;
    /**
     * XYZ到LAB
     */
    xyzToLab(color: XYZColor): LABColor;
    /**
     * LAB到XYZ
     */
    labToXYZ(color: LABColor): XYZColor;
};
/**
 * LUT管理器
 */
export declare class LUTManager implements LUTLibrary {
    luts: Map<string, LUTData>;
    addLUT(lut: LUTData): void;
    getLUT(id: string): LUTData | undefined;
    removeLUT(id: string): boolean;
    listLUTs(): LUTData[];
    /**
     * 应用3D LUT
     */
    apply3DLUT(lut: LUTData, color: RGBColor): RGBColor;
    /**
     * 应用1D LUT
     */
    apply1DLUT(lut: LUTData, color: RGBColor): RGBColor;
}
/**
 * ACES色彩管理器
 */
export declare class ACESColorManager {
    private config;
    private lutManager;
    constructor(config?: Partial<ColorManagementConfig>);
    /**
     * 获取配置
     */
    getConfig(): ColorManagementConfig;
    /**
     * 更新配置
     */
    updateConfig(config: Partial<ColorManagementConfig>): void;
    /**
     * 获取LUT管理器
     */
    getLUTManager(): LUTManager;
    /**
     * 色彩空间转换
     */
    convertColorSpace(color: RGBColor, from: ColorSpace, to: ColorSpace): RGBColor;
    /**
     * 转换到参考色彩空间 (ACES2065-1)
     */
    private toReference;
    /**
     * 从参考色彩空间转换
     */
    private fromReference;
    /**
     * 应用色调映射
     */
    applyToneMapping(color: RGBColor, method?: ToneMappingMethod): RGBColor;
    /**
     * 处理图像
     */
    processImage(imageData: Uint8ClampedArray, width: number, height: number, sourceColorSpace: ColorSpace, targetColorSpace: ColorSpace): Uint8ClampedArray;
    /**
     * 生成OCIO配置
     */
    generateOCIOConfig(): OCIOConfig;
}
/**
 * 创建默认色彩管理配置
 */
export declare function createDefaultColorManagementConfig(): ColorManagementConfig;
/**
 * 验证色彩管理配置
 */
export declare function validateColorManagementConfig(config: ColorManagementConfig): boolean;
/**
 * 解析.cube LUT文件
 */
export declare function parseCubeFile(content: string): LUTData;
//# sourceMappingURL=aces.d.ts.map