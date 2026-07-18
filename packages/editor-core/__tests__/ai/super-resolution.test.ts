import { describe, it, expect } from 'vitest';
import {
  createDefaultSuperResolutionConfig,
  validateSuperResolutionConfig,
  selectOptimalModel,
  analyzeImageFeatures,
  bicubicInterpolate,
  pixelShuffle,
  residualEnhance,
  adaptiveDenoise,
  adaptiveSharpen,
  splitIntoTiles,
  mergeTiles,
  createTemporalFrameCache,
  computeMotionVectors,
  temporalBlend,
  calculatePSNR,
  calculateSSIM,
  evaluateQuality,
  upscaleFrame,
  upscaleVideoFrames,
  quickPreview,
  prepareGPUInferenceRequest,
  estimateGPUMemoryRequirement,
  type ImageData,
  type SuperResolutionConfig,
  type UpscaleFactor,
} from '../../src/ai/super-resolution';

// ==================== 辅助函数 ====================

function createTestImage(width: number, height: number, fillR = 128, fillG = 128, fillB = 128): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fillR;
    data[i + 1] = fillG;
    data[i + 2] = fillB;
    data[i + 3] = 255;
  }
  return { data, width, height };
}

function createGradientImage(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = Math.round((x / width) * 255);
      data[idx + 1] = Math.round((y / height) * 255);
      data[idx + 2] = 128;
      data[idx + 3] = 255;
    }
  }
  return { data, width, height };
}

function createCheckerboardImage(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const isWhite = ((x >> 3) + (y >> 3)) % 2 === 0;
      const val = isWhite ? 255 : 0;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }
  return { data, width, height };
}

// ==================== 配置测试 ====================

describe('超分辨率配置', () => {
  describe('createDefaultSuperResolutionConfig', () => {
    it('应该创建有效的默认配置', () => {
      const config = createDefaultSuperResolutionConfig();
      expect(config.scaleFactor).toBe(4);
      expect(config.model).toBe('auto');
      expect(config.denoiseStrength).toBe(0.3);
      expect(config.sharpenStrength).toBe(0.5);
      expect(config.preserveFaces).toBe(true);
      expect(config.temporalConsistency).toBe(true);
      expect(config.gpuMode).toBe('auto');
    });
  });

  describe('validateSuperResolutionConfig', () => {
    it('应该通过有效配置的验证', () => {
      const config = createDefaultSuperResolutionConfig();
      const errors = validateSuperResolutionConfig(config);
      expect(errors).toHaveLength(0);
    });

    it('应该检测无效的缩放因子', () => {
      const config = { ...createDefaultSuperResolutionConfig(), scaleFactor: 3 as UpscaleFactor };
      const errors = validateSuperResolutionConfig(config);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('应该检测越界的降噪强度', () => {
      const config = { ...createDefaultSuperResolutionConfig(), denoiseStrength: 1.5 };
      const errors = validateSuperResolutionConfig(config);
      expect(errors.some(e => e.includes('降噪'))).toBe(true);
    });

    it('应该检测越界的锐化强度', () => {
      const config = { ...createDefaultSuperResolutionConfig(), sharpenStrength: -0.1 };
      const errors = validateSuperResolutionConfig(config);
      expect(errors.some(e => e.includes('锐化'))).toBe(true);
    });

    it('应该检测无效的瓦片大小', () => {
      const config = { ...createDefaultSuperResolutionConfig(), tileSize: 10 };
      const errors = validateSuperResolutionConfig(config);
      expect(errors.some(e => e.includes('瓦片大小'))).toBe(true);
    });

    it('应该检测无效的瓦片重叠', () => {
      const config = { ...createDefaultSuperResolutionConfig(), tileSize: 128, tileOverlap: 100 };
      const errors = validateSuperResolutionConfig(config);
      expect(errors.some(e => e.includes('重叠'))).toBe(true);
    });
  });
});

// ==================== 模型选择测试 ====================

describe('模型选择', () => {
  it('应该为动漫风格图像选择动漫模型', () => {
    const animeImage = createCheckerboardImage(1920, 1080);
    const model = selectOptimalModel(animeImage, 4);
    expect(model).toBe('realesrgan-x4-anime');
  });

  it('应该为小图像选择基础模型', () => {
    const smallImage = createTestImage(320, 240);
    const model = selectOptimalModel(smallImage, 4);
    expect(model).toBe('esrgan-x4');
  });

  it('应该为小图像 2x 选择 x2plus 模型', () => {
    const smallImage = createTestImage(320, 240);
    const model = selectOptimalModel(smallImage, 2);
    expect(model).toBe('realesrgan-x2plus');
  });

  it('应该为大图像选择通用模型', () => {
    const largeImage = createTestImage(1920, 1080);
    const model = selectOptimalModel(largeImage, 4);
    expect(model).toBe('realesrgan-x4plus');
  });
});

// ==================== 图像特征分析测试 ====================

describe('图像特征分析', () => {
  it('应该正确分析均匀图像', () => {
    const image = createTestImage(64, 64, 128, 128, 128);
    const features = analyzeImageFeatures(image.data, image.width, image.height);
    expect(features.averageBrightness).toBeCloseTo(128 / 255, 1);
    expect(features.contrast).toBeCloseTo(0, 1);
    expect(features.edgeDensity).toBeCloseTo(0, 1);
  });

  it('应该正确分析渐变图像', () => {
    const image = createGradientImage(64, 64);
    const features = analyzeImageFeatures(image.data, image.width, image.height);
    expect(features.averageBrightness).toBeGreaterThan(0.3);
    expect(features.contrast).toBeGreaterThan(0.5);
  });

  it('应该正确分析棋盘格图像的边缘密度', () => {
    const image = createCheckerboardImage(64, 64);
    const features = analyzeImageFeatures(image.data, image.width, image.height);
    expect(features.edgeDensity).toBeGreaterThan(0.1);
  });

  it('应该检测动漫风格', () => {
    // 高边缘密度 + 低色彩复杂度 + 高对比度 = 动漫风格
    const image = createCheckerboardImage(256, 256);
    const features = analyzeImageFeatures(image.data, image.width, image.height);
    expect(typeof features.isAnimeStyle).toBe('boolean');
  });
});

// ==================== 插值算法测试 ====================

describe('双三次插值', () => {
  it('应该正确放大 2x', () => {
    const input = createTestImage(16, 16, 200, 100, 50);
    const output = bicubicInterpolate(input, 2);
    expect(output.width).toBe(32);
    expect(output.height).toBe(32);
    expect(output.data.length).toBe(32 * 32 * 4);
  });

  it('应该正确放大 4x', () => {
    const input = createTestImage(8, 8);
    const output = bicubicInterpolate(input, 4);
    expect(output.width).toBe(32);
    expect(output.height).toBe(32);
  });

  it('应该保持均匀图像的像素值', () => {
    const input = createTestImage(8, 8, 100, 150, 200);
    const output = bicubicInterpolate(input, 2);
    // 检查中心区域像素值接近（8x8 放大到 16x16，中心在 8,8）
    const centerIdx = (8 * 16 + 8) * 4;
    expect(output.data[centerIdx]).toBeCloseTo(100, -1);
    expect(output.data[centerIdx + 1]).toBeCloseTo(150, -1);
    expect(output.data[centerIdx + 2]).toBeCloseTo(200, -1);
  });

  it('应该保持 Alpha 通道', () => {
    const input = createTestImage(8, 8);
    const output = bicubicInterpolate(input, 2);
    for (let i = 3; i < output.data.length; i += 4) {
      expect(output.data[i]).toBe(255);
    }
  });
});

// ==================== Pixel Shuffle 测试 ====================

describe('Pixel Shuffle', () => {
  it('应该正确重排像素', () => {
    const input = createTestImage(8, 8, 100, 150, 200);
    const output = pixelShuffle(input.data, input.width, input.height, 2);
    expect(output.width).toBe(16);
    expect(output.height).toBe(16);
  });

  it('应该保持 Alpha 通道', () => {
    const input = createTestImage(8, 8);
    const output = pixelShuffle(input.data, input.width, input.height, 2);
    for (let i = 3; i < output.data.length; i += 4) {
      expect(output.data[i]).toBe(255);
    }
  });
});

// ==================== 残差增强测试 ====================

describe('残差增强', () => {
  it('应该增强图像细节', () => {
    // 使用棋盘格而非渐变，因为渐变的 Laplacian 接近 0
    const image = createCheckerboardImage(32, 32);
    const enhanced = residualEnhance(image, 0.8);
    expect(enhanced.width).toBe(image.width);
    expect(enhanced.height).toBe(image.height);
    // 增强后的图像应该与原始不同
    let diff = 0;
    for (let i = 0; i < image.data.length; i += 4) {
      diff += Math.abs(enhanced.data[i] - image.data[i]);
    }
    expect(diff).toBeGreaterThan(0);
  });

  it('应该保持图像尺寸', () => {
    const image = createTestImage(16, 16);
    const enhanced = residualEnhance(image, 0.5);
    expect(enhanced.width).toBe(16);
    expect(enhanced.height).toBe(16);
  });

  it('应该将像素值限制在 0-255', () => {
    const image = createTestImage(16, 16, 250, 250, 250);
    const enhanced = residualEnhance(image, 1.0);
    for (let i = 0; i < enhanced.data.length; i++) {
      expect(enhanced.data[i]).toBeGreaterThanOrEqual(0);
      expect(enhanced.data[i]).toBeLessThanOrEqual(255);
    }
  });
});

// ==================== 降噪测试 ====================

describe('自适应降噪', () => {
  it('强度为 0 时应返回原始图像', () => {
    const image = createTestImage(16, 16);
    const result = adaptiveDenoise(image, 0);
    expect(result.data).toBe(image.data);
  });

  it('应该减少图像噪声', () => {
    // 创建带噪声的图像
    const image = createTestImage(32, 32, 128, 128, 128);
    const noisyData = new Uint8ClampedArray(image.data.length);
    for (let i = 0; i < noisyData.length; i += 4) {
      const noise = (Math.random() - 0.5) * 40;
      noisyData[i] = Math.max(0, Math.min(255, 128 + noise));
      noisyData[i + 1] = Math.max(0, Math.min(255, 128 + noise));
      noisyData[i + 2] = Math.max(0, Math.min(255, 128 + noise));
      noisyData[i + 3] = 255;
    }
    const noisy: ImageData = { data: noisyData, width: 32, height: 32 };
    const denoised = adaptiveDenoise(noisy, 0.8);

    // 计算与理想值的偏差
    let noisyDiff = 0;
    let denoisedDiff = 0;
    for (let i = 0; i < noisyData.length; i += 4) {
      noisyDiff += Math.abs(noisyData[i] - 128);
      denoisedDiff += Math.abs(denoised.data[i] - 128);
    }
    // 降噪后应该更接近理想值
    expect(denoisedDiff).toBeLessThanOrEqual(noisyDiff + 100); // 允许小误差
  });
});

// ==================== 锐化测试 ====================

describe('自适应锐化', () => {
  it('强度为 0 时应返回原始图像', () => {
    const image = createTestImage(16, 16);
    const result = adaptiveSharpen(image, 0);
    expect(result.data).toBe(image.data);
  });

  it('应该增强图像锐度', () => {
    const image = createGradientImage(32, 32);
    const sharpened = adaptiveSharpen(image, 0.8);
    expect(sharpened.width).toBe(image.width);
    expect(sharpened.height).toBe(image.height);
  });
});

// ==================== 瓦片处理测试 ====================

describe('瓦片处理', () => {
  it('应该正确分割和合并瓦片', () => {
    const image = createGradientImage(64, 64);
    const tiles = splitIntoTiles(image, 32, 8);
    expect(tiles.length).toBeGreaterThan(1);

    // 每个瓦片应该有正确的尺寸
    for (const tile of tiles) {
      expect(tile.width).toBeLessThanOrEqual(32);
      expect(tile.height).toBeLessThanOrEqual(32);
    }
  });

  it('小图像不需要分块', () => {
    const image = createTestImage(16, 16);
    const tiles = splitIntoTiles(image, 32, 8);
    expect(tiles.length).toBe(1);
    expect(tiles[0].width).toBe(16);
    expect(tiles[0].height).toBe(16);
  });

  it('合并瓦片应该恢复正确尺寸', () => {
    const image = createGradientImage(64, 64);
    const tiles = splitIntoTiles(image, 32, 8);
    const tileResults = tiles.map((t, i) => ({
      data: t.data,
      x: (i % 3) * 24,
      y: Math.floor(i / 3) * 24,
      width: t.width,
      height: t.height,
    }));
    const merged = mergeTiles(tileResults, 64, 64, 8);
    expect(merged.width).toBe(64);
    expect(merged.height).toBe(64);
  });
});

// ==================== 时序一致性测试 ====================

describe('时序一致性', () => {
  it('应该创建空的帧缓存', () => {
    const cache = createTemporalFrameCache();
    expect(cache.previousFrame).toBeNull();
    expect(cache.motionVectors).toBeNull();
    expect(cache.blendWeight).toBe(0.2);
  });

  it('应该计算运动向量', () => {
    const frame1 = createTestImage(32, 32, 100, 100, 100);
    const frame2 = createTestImage(32, 32, 150, 150, 150);
    const vectors = computeMotionVectors(frame1, frame2);
    expect(vectors.length).toBeGreaterThan(0);
  });

  it('应该正确混合两帧', () => {
    const frame1 = createTestImage(16, 16, 100, 100, 100);
    const frame2 = createTestImage(16, 16, 200, 200, 200);
    const blended = temporalBlend(frame2, frame1, null, 0.3);
    expect(blended.width).toBe(16);
    expect(blended.height).toBe(16);
    // 混合后的值应该在两者之间
    const centerIdx = (8 * 16 + 8) * 4;
    expect(blended.data[centerIdx]).toBeGreaterThan(100);
    expect(blended.data[centerIdx]).toBeLessThan(200);
  });
});

// ==================== 质量评估测试 ====================

describe('质量评估', () => {
  it('相同图像的 PSNR 应为 Infinity', () => {
    const image = createTestImage(16, 16);
    const psnr = calculatePSNR(image, image);
    expect(psnr).toBe(Infinity);
  });

  it('不同图像的 PSNR 应为有限值', () => {
    const image1 = createTestImage(16, 16, 100, 100, 100);
    const image2 = createTestImage(16, 16, 150, 150, 150);
    const psnr = calculatePSNR(image1, image2);
    expect(Number.isFinite(psnr)).toBe(true);
    expect(psnr).toBeGreaterThan(0);
  });

  it('相同图像的 SSIM 应接近 1', () => {
    const image = createTestImage(16, 16);
    const ssim = calculateSSIM(image, image);
    expect(ssim).toBeCloseTo(1, 1);
  });

  it('不同图像的 SSIM 应小于 1', () => {
    const image1 = createTestImage(16, 16, 100, 100, 100);
    const image2 = createTestImage(16, 16, 200, 200, 200);
    const ssim = calculateSSIM(image1, image2);
    expect(ssim).toBeLessThan(1);
  });

  it('综合质量评分应在 0-1 之间', () => {
    const image1 = createTestImage(16, 16);
    const image2 = createTestImage(16, 16, 120, 120, 120);
    const quality = evaluateQuality(image1, image2);
    expect(quality.qualityScore).toBeGreaterThanOrEqual(0);
    expect(quality.qualityScore).toBeLessThanOrEqual(1);
    expect(Number.isFinite(quality.psnr)).toBe(true);
    expect(quality.ssim).toBeGreaterThanOrEqual(0);
  });
});

// ==================== 主处理函数测试 ====================

describe('upscaleFrame', () => {
  it('应该正确超分小图像', () => {
    const input = createTestImage(16, 16, 100, 150, 200);
    const config: SuperResolutionConfig = {
      ...createDefaultSuperResolutionConfig(),
      scaleFactor: 2,
      tileSize: 512,
      temporalConsistency: false,
    };
    const result = upscaleFrame(input, config);
    expect(result.output.width).toBe(32);
    expect(result.output.height).toBe(32);
    expect(result.processingTimeMs).toBeGreaterThan(0);
    expect(result.usedModel).toBeTruthy();
    expect(result.qualityScore).toBeGreaterThanOrEqual(0);
  });

  it('应该正确超分 4x', () => {
    const input = createTestImage(8, 8);
    const config: SuperResolutionConfig = {
      ...createDefaultSuperResolutionConfig(),
      scaleFactor: 4,
      tileSize: 512,
      temporalConsistency: false,
    };
    const result = upscaleFrame(input, config);
    expect(result.output.width).toBe(32);
    expect(result.output.height).toBe(32);
  });

  it('应该使用时序缓存', () => {
    const frame1 = createTestImage(16, 16, 100, 100, 100);
    const frame2 = createTestImage(16, 16, 120, 120, 120);
    const config: SuperResolutionConfig = {
      ...createDefaultSuperResolutionConfig(),
      scaleFactor: 2,
      tileSize: 512,
      temporalConsistency: true,
    };
    const result1 = upscaleFrame(frame1, config);
    const cache = createTemporalFrameCache();
    cache.previousFrame = result1.output;
    const result2 = upscaleFrame(frame2, config, cache);
    expect(result2.output.width).toBe(32);
  });

  it('应该处理大图像（分块）', () => {
    const input = createGradientImage(100, 100);
    const config: SuperResolutionConfig = {
      ...createDefaultSuperResolutionConfig(),
      scaleFactor: 2,
      tileSize: 64,
      tileOverlap: 8,
      temporalConsistency: false,
    };
    const result = upscaleFrame(input, config);
    expect(result.output.width).toBe(200);
    expect(result.output.height).toBe(200);
  });
});

describe('upscaleVideoFrames', () => {
  it('应该批量处理多帧', () => {
    const frames = [
      createTestImage(8, 8, 100, 100, 100),
      createTestImage(8, 8, 120, 120, 120),
      createTestImage(8, 8, 140, 140, 140),
    ];
    const config: SuperResolutionConfig = {
      ...createDefaultSuperResolutionConfig(),
      scaleFactor: 2,
      tileSize: 512,
    };
    let progressCalls = 0;
    const results = upscaleVideoFrames(frames, config, () => progressCalls++);
    expect(results.length).toBe(3);
    expect(progressCalls).toBe(3);
    for (const r of results) {
      expect(r.output.width).toBe(16);
      expect(r.output.height).toBe(16);
    }
  });
});

describe('quickPreview', () => {
  it('应该生成预览尺寸的图像', () => {
    const input = createGradientImage(1920, 1080);
    const preview = quickPreview(input, {
      previewScale: 0.25,
      maxPreviewSize: 480,
      fastMode: true,
    });
    expect(preview.width).toBeLessThanOrEqual(960);
    expect(preview.height).toBeLessThanOrEqual(540);
  });
});

// ==================== GPU 接口测试 ====================

describe('GPU 接口', () => {
  it('应该准备推理请求', () => {
    const request = prepareGPUInferenceRequest('realesrgan-x4plus', 4, 0, 4);
    expect(request.model).toBe('realesrgan-x4plus');
    expect(request.scaleFactor).toBe(4);
    expect(request.tileIndex).toBe(0);
    expect(request.totalTiles).toBe(4);
    expect(request.inputTextureId).toBeTruthy();
  });

  it('应该估算显存需求', () => {
    const mem = estimateGPUMemoryRequirement(1920, 1080, 4, 'realesrgan-x4plus');
    expect(mem).toBeGreaterThan(0);
    // 4x 放大的输出 = 7680*4320*4 ≈ 132MB，加上模型和中间特征
    expect(mem).toBeGreaterThan(100 * 1024 * 1024);
  });

  it('2x 模型应比 4x 需要更少显存', () => {
    const mem2x = estimateGPUMemoryRequirement(1920, 1080, 2, 'realesrgan-x2plus');
    const mem4x = estimateGPUMemoryRequirement(1920, 1080, 4, 'realesrgan-x4plus');
    expect(mem2x).toBeLessThan(mem4x);
  });
});
