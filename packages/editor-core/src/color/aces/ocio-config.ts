/**
 * ACES色彩管理模块 - OCIO配置生成
 */

import type { OCIOConfig } from './types';
import { ACES_MATRICES } from './matrices';

/**
 * 生成OCIO配置
 */
export function generateOCIOConfig(): OCIOConfig {
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
