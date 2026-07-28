/**
 * ACES色彩管理模块 - ACES色彩管理器、常量与工具函数
 */

import type {
  ColorSpace,
  ColorManagementConfig,
  ToneMappingMethod,
  ColorMatrix3x3,
  RGBColor,
  LUTData,
  OCIOConfig,
} from './types';
import { clamp, multiplyMatrix3x3 } from './math-utils';
import { TRANSFER_FUNCTIONS } from './transfer-functions';
import { TONE_MAPPING_FUNCTIONS } from './tone-mapping';
import { LUTManager } from './lut-manager';

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
    0.4396744, 0.3829868, 0.1773388, 0.0897764, 0.8134392, 0.0967844, 0.0175417, 0.1115465, 0.8709118,
  ] as ColorMatrix3x3,

  // ACES2065-1 (AP0) 到 sRGB
  ap0ToSrgb: [
    2.5216474, -1.1366888, -0.3849586, -0.2754369, 1.3700779, -0.094641, -0.0159316, -0.1529726, 1.1689042,
  ] as ColorMatrix3x3,

  // ACEScg (AP1) 到 ACES2065-1 (AP0)
  ap1ToAP0: [
    0.6954522, 0.1406787, 0.163869, 0.0447946, 0.8596711, 0.0955343, -0.0055259, 0.0040252, 1.0015007,
  ] as ColorMatrix3x3,

  // ACES2065-1 (AP0) 到 ACEScg (AP1)
  ap0ToAP1: [
    1.4514393, -0.2365107, -0.2149286, -0.0765538, 1.1762297, -0.0996759, 0.0083162, -0.0060324, 0.9977163,
  ] as ColorMatrix3x3,

  // Rec.709 到 ACES2065-1 (AP0)
  rec709ToAP0: [
    0.4396744, 0.3829868, 0.1773388, 0.0897764, 0.8134392, 0.0967844, 0.0175417, 0.1115465, 0.8709118,
  ] as ColorMatrix3x3,

  // ACES2065-1 (AP0) 到 Rec.709
  ap0ToRec709: [
    2.5216474, -1.1366888, -0.3849586, -0.2754369, 1.3700779, -0.094641, -0.0159316, -0.1529726, 1.1689042,
  ] as ColorMatrix3x3,

  // Rec.2020 到 ACES2065-1 (AP0)
  rec2020ToAP0: [
    0.4396744, 0.3829868, 0.1773388, 0.0897764, 0.8134392, 0.0967844, 0.0175417, 0.1115465, 0.8709118,
  ] as ColorMatrix3x3,

  // ACES2065-1 (AP0) 到 Rec.2020
  ap0ToRec2020: [
    2.5216474, -1.1366888, -0.3849586, -0.2754369, 1.3700779, -0.094641, -0.0159316, -0.1529726, 1.1689042,
  ] as ColorMatrix3x3,
};

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
  convertColorSpace(color: RGBColor, from: ColorSpace, to: ColorSpace): RGBColor {
    if (from === to) {
      return { ...color };
    }

    // 转换到参考色彩空间 (ACES2065-1)
    const reference = this.toReference(color, from);

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
    targetColorSpace: ColorSpace,
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
      title = trimmed
        .substring(6)
        .trim()
        .replace(/^["']|["']$/g, '');
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
        data.push(parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2]));
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
