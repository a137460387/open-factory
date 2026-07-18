import { describe, it, expect } from 'vitest';
import {
  rgbToHsl,
  hslToRgb,
  rgbToLab,
  colorDistance,
  deltaE,
  clamp,
  lerp,
  computeHistogram,
  extractDominantColors,
  computeContrast,
  computeSaturation,
  computeColorTemperatureAndTint,
  analyzeImageColors,
  matchColors,
  autoGradeImage,
  transferStyle,
  applyColorCorrection,
  createDefaultColorCorrection,
  validateColorCorrection,
  normalizeColorCorrection,
  type RGBColor,
  type ImageData,
  type ColorCorrectionParams,
} from '../../src/ai/color-grading';

// ==================== 辅助函数测试 ====================

describe('色彩辅助函数', () => {
  describe('rgbToHsl', () => {
    it('应该正确转换纯红色', () => {
      const result = rgbToHsl({ r: 255, g: 0, b: 0 });
      expect(result.h).toBeCloseTo(0, 0);
      expect(result.s).toBeCloseTo(1, 2);
      expect(result.l).toBeCloseTo(0.5, 2);
    });

    it('应该正确转换纯绿色', () => {
      const result = rgbToHsl({ r: 0, g: 255, b: 0 });
      expect(result.h).toBeCloseTo(120, 0);
      expect(result.s).toBeCloseTo(1, 2);
      expect(result.l).toBeCloseTo(0.5, 2);
    });

    it('应该正确转换纯蓝色', () => {
      const result = rgbToHsl({ r: 0, g: 0, b: 255 });
      expect(result.h).toBeCloseTo(240, 0);
      expect(result.s).toBeCloseTo(1, 2);
      expect(result.l).toBeCloseTo(0.5, 2);
    });

    it('应该正确转换灰色', () => {
      const result = rgbToHsl({ r: 128, g: 128, b: 128 });
      expect(result.h).toBe(0);
      expect(result.s).toBeCloseTo(0, 2);
      expect(result.l).toBeCloseTo(0.502, 2);
    });

    it('应该正确转换白色', () => {
      const result = rgbToHsl({ r: 255, g: 255, b: 255 });
      expect(result.h).toBe(0);
      expect(result.s).toBe(0);
      expect(result.l).toBeCloseTo(1, 2);
    });

    it('应该正确转换黑色', () => {
      const result = rgbToHsl({ r: 0, g: 0, b: 0 });
      expect(result.h).toBe(0);
      expect(result.s).toBe(0);
      expect(result.l).toBe(0);
    });
  });

  describe('hslToRgb', () => {
    it('应该正确转换纯红色', () => {
      const result = hslToRgb({ h: 0, s: 1, l: 0.5 });
      expect(result.r).toBe(255);
      expect(result.g).toBe(0);
      expect(result.b).toBe(0);
    });

    it('应该正确转换纯绿色', () => {
      const result = hslToRgb({ h: 120, s: 1, l: 0.5 });
      expect(result.r).toBe(0);
      expect(result.g).toBe(255);
      expect(result.b).toBe(0);
    });

    it('应该正确转换纯蓝色', () => {
      const result = hslToRgb({ h: 240, s: 1, l: 0.5 });
      expect(result.r).toBe(0);
      expect(result.g).toBe(0);
      expect(result.b).toBe(255);
    });

    it('应该正确转换灰色', () => {
      const result = hslToRgb({ h: 0, s: 0, l: 0.5 });
      expect(result.r).toBe(128);
      expect(result.g).toBe(128);
      expect(result.b).toBe(128);
    });

    it('应该正确转换白色', () => {
      const result = hslToRgb({ h: 0, s: 0, l: 1 });
      expect(result.r).toBe(255);
      expect(result.g).toBe(255);
      expect(result.b).toBe(255);
    });

    it('应该正确转换黑色', () => {
      const result = hslToRgb({ h: 0, s: 0, l: 0 });
      expect(result.r).toBe(0);
      expect(result.g).toBe(0);
      expect(result.b).toBe(0);
    });
  });

  describe('rgbToLab', () => {
    it('应该正确转换颜色', () => {
      const result = rgbToLab({ r: 255, g: 0, b: 0 });
      expect(result.l).toBeDefined();
      expect(result.a).toBeDefined();
      expect(result.b).toBeDefined();
    });
  });

  describe('colorDistance', () => {
    it('应该计算相同颜色的距离为0', () => {
      const color: RGBColor = { r: 128, g: 128, b: 128 };
      expect(colorDistance(color, color)).toBe(0);
    });

    it('应该计算黑白距离', () => {
      const white: RGBColor = { r: 255, g: 255, b: 255 };
      const black: RGBColor = { r: 0, g: 0, b: 0 };
      const distance = colorDistance(white, black);
      expect(distance).toBeCloseTo(441.67, 0); // sqrt(255^2 * 3)
    });

    it('应该对称', () => {
      const color1: RGBColor = { r: 100, g: 150, b: 200 };
      const color2: RGBColor = { r: 50, g: 100, b: 150 };
      expect(colorDistance(color1, color2)).toBe(colorDistance(color2, color1));
    });
  });

  describe('deltaE', () => {
    it('应该计算相同颜色的Delta E为0', () => {
      const lab = { l: 50, a: 0, b: 0 };
      expect(deltaE(lab, lab)).toBe(0);
    });

    it('应该计算不同颜色的Delta E', () => {
      const lab1 = { l: 50, a: 0, b: 0 };
      const lab2 = { l: 60, a: 10, b: 10 };
      const result = deltaE(lab1, lab2);
      expect(result).toBeGreaterThan(0);
    });
  });

  describe('clamp', () => {
    it('应该限制值在范围内', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('lerp', () => {
    it('应该正确插值', () => {
      expect(lerp(0, 10, 0)).toBe(0);
      expect(lerp(0, 10, 1)).toBe(10);
      expect(lerp(0, 10, 0.5)).toBe(5);
    });
  });
});

// ==================== 图像分析测试 ====================

describe('图像色彩分析', () => {
  // 创建测试图像数据
  function createTestImage(width: number, height: number, color: RGBColor): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = color.r;
      data[i + 1] = color.g;
      data[i + 2] = color.b;
      data[i + 3] = 255;
    }
    return { data, width, height };
  }

  describe('computeHistogram', () => {
    it('应该计算纯色图像的直方图', () => {
      const image = createTestImage(10, 10, { r: 128, g: 128, b: 128 });
      const histogram = computeHistogram(image);

      expect(histogram.red[128]).toBeCloseTo(1, 2);
      expect(histogram.green[128]).toBeCloseTo(1, 2);
      expect(histogram.blue[128]).toBeCloseTo(1, 2);
      expect(histogram.luminance[Math.round(0.299 * 128 + 0.587 * 128 + 0.114 * 128)]).toBeCloseTo(1, 2);
    });

    it('应该归一化直方图', () => {
      const image = createTestImage(10, 10, { r: 100, g: 150, b: 200 });
      const histogram = computeHistogram(image);

      // 检查总和约为1
      const sum = histogram.red.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 2);
    });
  });

  describe('extractDominantColors', () => {
    it('应该提取纯色图像的主色调', () => {
      const image = createTestImage(10, 10, { r: 200, g: 100, b: 50 });
      const colors = extractDominantColors(image, 1);

      expect(colors.length).toBe(1);
      // 由于量化到32的倍数，颜色可能不完全匹配
      expect(colors[0].r).toBe(192);
      expect(colors[0].g).toBe(96);
      expect(colors[0].b).toBe(64);
    });
  });

  describe('computeContrast', () => {
    it('应该计算纯色图像的对比度为0', () => {
      const image = createTestImage(10, 10, { r: 128, g: 128, b: 128 });
      const contrast = computeContrast(image);
      expect(contrast).toBeCloseTo(0, 2);
    });

    it('应该计算黑白图像的对比度为1', () => {
      const data = new Uint8ClampedArray(10 * 10 * 4);
      for (let i = 0; i < data.length; i += 4) {
        const isWhite = (i / 4) % 2 === 0;
        data[i] = isWhite ? 255 : 0;
        data[i + 1] = isWhite ? 255 : 0;
        data[i + 2] = isWhite ? 255 : 0;
        data[i + 3] = 255;
      }
      const image = { data, width: 10, height: 10 };
      const contrast = computeContrast(image);
      expect(contrast).toBeCloseTo(1, 2);
    });
  });

  describe('computeSaturation', () => {
    it('应该计算灰色图像的饱和度为0', () => {
      const image = createTestImage(10, 10, { r: 128, g: 128, b: 128 });
      const saturation = computeSaturation(image);
      expect(saturation).toBeCloseTo(0, 2);
    });

    it('应该计算纯色图像的饱和度', () => {
      const image = createTestImage(10, 10, { r: 255, g: 0, b: 0 });
      const saturation = computeSaturation(image);
      expect(saturation).toBeCloseTo(1, 2);
    });
  });

  describe('computeColorTemperatureAndTint', () => {
    it('应该计算暖色图像的色温', () => {
      const image = createTestImage(10, 10, { r: 255, g: 128, b: 0 });
      const { temperature } = computeColorTemperatureAndTint(image);
      expect(temperature).toBeGreaterThan(0);
    });

    it('应该计算冷色图像的色温', () => {
      const image = createTestImage(10, 10, { r: 0, g: 128, b: 255 });
      const { temperature } = computeColorTemperatureAndTint(image);
      expect(temperature).toBeLessThan(0);
    });
  });

  describe('analyzeImageColors', () => {
    it('应该完整分析图像色彩', () => {
      const image = createTestImage(100, 100, { r: 200, g: 100, b: 50 });
      const analysis = analyzeImageColors(image);

      expect(analysis.averageBrightness).toBeDefined();
      expect(analysis.contrast).toBeDefined();
      expect(analysis.saturation).toBeDefined();
      expect(analysis.colorTemperature).toBeDefined();
      expect(analysis.tint).toBeDefined();
      expect(analysis.dominantColors).toBeDefined();
      expect(analysis.histogram).toBeDefined();
      expect(analysis.dynamicRange).toBeDefined();
      expect(analysis.colorUniformity).toBeDefined();
    });
  });
});

// ==================== 色彩匹配测试 ====================

describe('色彩匹配', () => {
  function createTestImage(width: number, height: number, color: RGBColor): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = color.r;
      data[i + 1] = color.g;
      data[i + 2] = color.b;
      data[i + 3] = 255;
    }
    return { data, width, height };
  }

  describe('matchColors', () => {
    it('应该匹配相同图像', () => {
      const image = createTestImage(10, 10, { r: 128, g: 128, b: 128 });
      const result = matchColors(image, image);

      expect(result.correction.brightness).toBeCloseTo(0, 2);
      expect(result.correction.contrast).toBeCloseTo(0, 2);
      expect(result.correction.saturation).toBeCloseTo(0, 2);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('应该匹配不同亮度图像', () => {
      const darkImage = createTestImage(10, 10, { r: 50, g: 50, b: 50 });
      const brightImage = createTestImage(10, 10, { r: 200, g: 200, b: 200 });
      const result = matchColors(brightImage, darkImage);

      expect(result.correction.brightness).toBeGreaterThan(0);
      expect(result.matchedFeatures).toContain('brightness');
    });

    it('应该支持自定义选项', () => {
      const image1 = createTestImage(10, 10, { r: 100, g: 100, b: 100 });
      const image2 = createTestImage(10, 10, { r: 200, g: 200, b: 200 });

      const result = matchColors(image1, image2, {
        intensity: 0.5,
        matchLuminance: true,
        matchContrast: false,
        matchSaturation: false,
        matchColorTemperature: false,
        matchTint: false,
        matchHistogram: false,
      });

      expect(result.matchedFeatures).toEqual(['brightness']);
      expect(result.matchedFeatures).not.toContain('contrast');
    });
  });
});

// ==================== AI自动分级测试 ====================

describe('AI自动分级', () => {
  function createTestImage(width: number, height: number, color: RGBColor): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = color.r;
      data[i + 1] = color.g;
      data[i + 2] = color.b;
      data[i + 3] = 255;
    }
    return { data, width, height };
  }

  describe('autoGradeImage', () => {
    it('应该生成默认校正参数', () => {
      const image = createTestImage(100, 100, { r: 128, g: 128, b: 128 });
      const result = autoGradeImage(image);

      expect(result.correction).toBeDefined();
      expect(result.detectedSceneType).toBeDefined();
      expect(result.appliedStyle).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('应该检测夜景场景', () => {
      const darkImage = createTestImage(100, 100, { r: 20, g: 20, b: 20 });
      const result = autoGradeImage(darkImage, { sceneTypeHint: 'night' });

      expect(result.detectedSceneType).toBe('night');
      expect(result.correction.brightness).toBeGreaterThan(0);
    });

    it('应该检测日落场景', () => {
      const sunsetImage = createTestImage(100, 100, { r: 200, g: 100, b: 50 });
      const result = autoGradeImage(sunsetImage, { sceneTypeHint: 'sunset' });

      expect(result.detectedSceneType).toBe('sunset');
      expect(result.correction.temperature).toBeGreaterThan(0);
    });

    it('应该支持不同风格', () => {
      const image = createTestImage(100, 100, { r: 128, g: 128, b: 128 });
      
      const cinematicResult = autoGradeImage(image, { targetStyle: 'cinematic' });
      expect(cinematicResult.appliedStyle).toBe('cinematic');
      
      const vintageResult = autoGradeImage(image, { targetStyle: 'vintage' });
      expect(vintageResult.appliedStyle).toBe('vintage');
    });

    it('应该保留肤色', () => {
      const image = createTestImage(100, 100, { r: 200, g: 150, b: 100 });
      const result = autoGradeImage(image, { preserveSkinTones: true });

      expect(result.skinToneMask).toBeDefined();
      expect(result.skinToneMask!.length).toBe(100 * 100);
    });
  });
});

// ==================== 风格迁移测试 ====================

describe('风格迁移', () => {
  function createTestImage(width: number, height: number, color: RGBColor): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = color.r;
      data[i + 1] = color.g;
      data[i + 2] = color.b;
      data[i + 3] = 255;
    }
    return { data, width, height };
  }

  describe('transferStyle', () => {
    it('应该迁移风格', () => {
      const styleImage = createTestImage(10, 10, { r: 200, g: 100, b: 50 });
      const contentImage = createTestImage(10, 10, { r: 100, g: 150, b: 200 });
      
      const result = transferStyle(styleImage, contentImage);

      expect(result.transferredImageData).toBeDefined();
      expect(result.colorMapping).toBeDefined();
      expect(result.qualityScore).toBeGreaterThan(0);
      expect(result.qualityScore).toBeLessThanOrEqual(1);
    });

    it('应该支持不同强度', () => {
      const styleImage = createTestImage(10, 10, { r: 200, g: 100, b: 50 });
      const contentImage = createTestImage(10, 10, { r: 100, g: 150, b: 200 });
      
      const weakResult = transferStyle(styleImage, contentImage, { strength: 0.3 });
      const strongResult = transferStyle(styleImage, contentImage, { strength: 0.9 });

      // 强度越高，图像变化越大
      expect(weakResult.qualityScore).not.toBe(strongResult.qualityScore);
    });

    it('应该支持直方图匹配', () => {
      const styleImage = createTestImage(10, 10, { r: 200, g: 100, b: 50 });
      const contentImage = createTestImage(10, 10, { r: 100, g: 150, b: 200 });
      
      const result = transferStyle(styleImage, contentImage, { matchHistogram: true });
      expect(result.transferredImageData).toBeDefined();
    });
  });
});

// ==================== 色彩校正应用测试 ====================

describe('色彩校正应用', () => {
  function createTestImage(width: number, height: number, color: RGBColor): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = color.r;
      data[i + 1] = color.g;
      data[i + 2] = color.b;
      data[i + 3] = 255;
    }
    return { data, width, height };
  }

  describe('applyColorCorrection', () => {
    it('应该应用亮度调整', () => {
      const image = createTestImage(10, 10, { r: 128, g: 128, b: 128 });
      const correction: ColorCorrectionParams = {
        ...createDefaultColorCorrection(),
        brightness: 0.2,
      };

      const result = applyColorCorrection(image, correction);
      
      // 亮度应该增加
      expect(result.data[0]).toBeGreaterThan(128);
    });

    it('应该应用对比度调整', () => {
      const image = createTestImage(10, 10, { r: 128, g: 128, b: 128 });
      const correction: ColorCorrectionParams = {
        ...createDefaultColorCorrection(),
        contrast: 0.5,
      };

      const result = applyColorCorrection(image, correction);
      expect(result.data).toBeDefined();
    });

    it('应该应用饱和度调整', () => {
      const image = createTestImage(10, 10, { r: 200, g: 100, b: 50 });
      const correction: ColorCorrectionParams = {
        ...createDefaultColorCorrection(),
        saturation: 0.5,
      };

      const result = applyColorCorrection(image, correction);
      expect(result.data).toBeDefined();
    });

    it('应该应用色温调整', () => {
      const image = createTestImage(10, 10, { r: 128, g: 128, b: 128 });
      const correction: ColorCorrectionParams = {
        ...createDefaultColorCorrection(),
        temperature: 0.5,
      };

      const result = applyColorCorrection(image, correction);
      // 暖色调应该增加红色，减少蓝色
      expect(result.data[0]).toBeGreaterThan(128); // R
      expect(result.data[2]).toBeLessThan(128); // B
    });

    it('应该保持alpha通道', () => {
      const image = createTestImage(10, 10, { r: 128, g: 128, b: 128 });
      const correction = createDefaultColorCorrection();

      const result = applyColorCorrection(image, correction);
      expect(result.data[3]).toBe(255); // Alpha应该保持不变
    });
  });
});

// ==================== 工具函数测试 ====================

describe('工具函数', () => {
  describe('createDefaultColorCorrection', () => {
    it('应该创建默认参数', () => {
      const correction = createDefaultColorCorrection();

      expect(correction.brightness).toBe(0);
      expect(correction.contrast).toBe(0);
      expect(correction.saturation).toBe(0);
      expect(correction.temperature).toBe(0);
      expect(correction.tint).toBe(0);
      expect(correction.hueRotation).toBe(0);
      expect(correction.gamma).toBe(1);
      expect(correction.lift).toEqual({ r: 0, g: 0, b: 0 });
      expect(correction.gammaRGB).toEqual({ r: 0, g: 0, b: 0 });
      expect(correction.gain).toEqual({ r: 0, g: 0, b: 0 });
    });
  });

  describe('validateColorCorrection', () => {
    it('应该验证有效参数', () => {
      const correction = createDefaultColorCorrection();
      expect(validateColorCorrection(correction)).toBe(true);
    });

    it('应该拒绝无效参数', () => {
      const invalid = { brightness: 'invalid' } as any;
      expect(validateColorCorrection(invalid)).toBe(false);
    });
  });

  describe('normalizeColorCorrection', () => {
    it('应该归一化参数', () => {
      const correction: ColorCorrectionParams = {
        brightness: 2, // 超出范围
        contrast: -2, // 超出范围
        saturation: 0.5,
        temperature: 0,
        tint: 0,
        hueRotation: 0,
        gamma: 1,
        lift: { r: 0, g: 0, b: 0 },
        gammaRGB: { r: 0, g: 0, b: 0 },
        gain: { r: 0, g: 0, b: 0 },
      };

      const normalized = normalizeColorCorrection(correction);
      expect(normalized.brightness).toBe(1);
      expect(normalized.contrast).toBe(-1);
      expect(normalized.saturation).toBe(0.5);
    });
  });
});
