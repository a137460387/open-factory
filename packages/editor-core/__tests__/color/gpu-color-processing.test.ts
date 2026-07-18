/**
 * GPU 加速色彩处理模块测试
 */
import { describe, it, expect } from 'vitest';
import {
  computeParamsHash,
  buildPipelineCacheKey,
  createDefaultColorCorrectionParams,
  createDefaultToneMappingParams,
  createDefaultPipelineConfig,
  validateGPUColorCorrectionParams,
  validateGPUToneMappingParams,
  validateGPUPipelineConfig,
  fromPrimaryWheelAndSliders,
  cpuApplyLiftGammaGain,
  cpuApplyTemperatureTint,
  cpuApplyContrast,
  cpuApplySaturation,
  cpuToneMapAcesHill,
  cpuToneMapReinhard,
  cpuToneMapFilmic,
  cpuApplyToneMapping,
  cpuApply3DLUT,
  cpuProcessPixel,
  cpuProcessFrame,
  GPUColorProcessor,
  PreviewFrameCache,
  GPUPerformanceMonitor,
  RESOLUTION_PRESETS,
  generateColorProcessingFragmentShader,
  generateVertexShader,
  generateWebGPUComputeShader,
} from '../../src/color/gpu-color-processing';
import type {
  GPUColorCorrectionParams,
  GPUToneMappingParams,
  GPU3DLUTData,
} from '../../src/color/gpu-color-processing';

describe('GPU 加速色彩处理', () => {
  describe('常量与预设', () => {
    it('应有 4 种分辨率预设', () => {
      expect(Object.keys(RESOLUTION_PRESETS)).toHaveLength(4);
      expect(RESOLUTION_PRESETS['1080p']).toEqual({ width: 1920, height: 1080, label: '1080p' });
      expect(RESOLUTION_PRESETS['4k']).toEqual({ width: 3840, height: 2160, label: '4K' });
    });
  });

  describe('参数哈希', () => {
    it('相同参数应产生相同哈希', () => {
      const a = computeParamsHash({ x: 1, y: 2 });
      const b = computeParamsHash({ x: 1, y: 2 });
      expect(a).toBe(b);
    });

    it('不同参数应产生不同哈希', () => {
      const a = computeParamsHash({ x: 1 });
      const b = computeParamsHash({ x: 2 });
      expect(a).not.toBe(b);
    });

    it('键顺序无关', () => {
      const a = computeParamsHash({ x: 1, y: 2 });
      const b = computeParamsHash({ y: 2, x: 1 });
      expect(a).toBe(b);
    });
  });

  describe('缓存键生成', () => {
    it('应生成一致的缓存键', () => {
      const cc = createDefaultColorCorrectionParams();
      const key1 = buildPipelineCacheKey('img-001', cc, null, null, '1080p');
      const key2 = buildPipelineCacheKey('img-001', cc, null, null, '1080p');
      expect(key1).toBe(key2);
    });

    it('不同分辨率应产生不同键', () => {
      const cc = createDefaultColorCorrectionParams();
      const key1 = buildPipelineCacheKey('img-001', cc, null, null, '1080p');
      const key2 = buildPipelineCacheKey('img-001', cc, null, null, '4k');
      expect(key1).not.toBe(key2);
    });
  });

  describe('默认工厂函数', () => {
    it('createDefaultColorCorrectionParams 应返回零值参数', () => {
      const p = createDefaultColorCorrectionParams();
      expect(p.lift).toEqual({ r: 0, g: 0, b: 0 });
      expect(p.gamma).toEqual({ r: 0, g: 0, b: 0 });
      expect(p.gain).toEqual({ r: 0, g: 0, b: 0 });
      expect(p.temperature).toBe(0);
      expect(p.saturation).toBe(100);
    });

    it('createDefaultToneMappingParams 应使用 aces-hill', () => {
      const p = createDefaultToneMappingParams();
      expect(p.method).toBe('aces-hill');
      expect(p.exposure).toBe(0);
    });

    it('createDefaultPipelineConfig 应使用 webgl2 和 1080p', () => {
      const c = createDefaultPipelineConfig();
      expect(c.backend).toBe('webgl2');
      expect(c.resolution).toBe('1080p');
      expect(c.enableCache).toBe(true);
    });
  });

  describe('参数验证', () => {
    it('validateGPUColorCorrectionParams 应限制范围', () => {
      const p = validateGPUColorCorrectionParams({
        lift: { r: 5, g: -5, b: 0.5 },
        liftMaster: 2,
        gamma: { r: 0, g: 0, b: 0 },
        gammaMaster: 0,
        gain: { r: 0, g: 0, b: 0 },
        gainMaster: 0,
        offset: { r: 0, g: 0, b: 0 },
        offsetMaster: 0,
        temperature: 200,
        tint: -200,
        contrast: 0,
        pivot: 0.5,
        saturation: 500,
        hueRotation: 400,
      });
      expect(p.lift.r).toBe(1);
      expect(p.lift.g).toBe(-1);
      expect(p.liftMaster).toBe(1);
      expect(p.temperature).toBe(100);
      expect(p.tint).toBe(-100);
      expect(p.saturation).toBe(200);
      expect(p.hueRotation).toBe(180);
    });

    it('validateGPUToneMappingParams 应限制范围', () => {
      const p = validateGPUToneMappingParams({
        method: 'reinhard',
        exposure: 100,
        whitePoint: -1,
        shoulderStrength: 2,
        linearStrength: -1,
        linearAngle: 2,
        toeStrength: 2,
        toeNumerator: 2,
        toeDenominator: 0,
        linearWhitePoint: 200,
      });
      expect(p.exposure).toBe(10);
      expect(p.whitePoint).toBe(0.01);
      expect(p.shoulderStrength).toBe(1);
      expect(p.linearStrength).toBe(0);
      expect(p.toeDenominator).toBe(0.01);
    });

    it('validateGPUPipelineConfig 应修正无效分辨率', () => {
      const c = validateGPUPipelineConfig({
        ...createDefaultPipelineConfig(),
        resolution: 'invalid' as '1080p',
      });
      expect(c.resolution).toBe('1080p');
    });
  });

  describe('类型转换', () => {
    it('fromPrimaryWheelAndSliders 应正确转换', () => {
      const wheels = {
        lift: { r: 0.1, g: 0.2, b: 0.3, y: 0 },
        liftMaster: 0.05,
        gamma: { r: 0, g: 0, b: 0, y: 0 },
        gammaMaster: 0,
        gain: { r: 0.1, g: 0, b: 0, y: 0 },
        gainMaster: 0,
        offset: { r: 0, g: 0, b: 0, y: 0 },
        offsetMaster: 0,
      };
      const sliders = {
        temperature: 10,
        tint: -5,
        contrast: 20,
        pivot: 0.5,
        saturation: 120,
        hue: 15,
      };
      const result = fromPrimaryWheelAndSliders(wheels, sliders);
      expect(result.lift).toEqual({ r: 0.1, g: 0.2, b: 0.3 });
      expect(result.temperature).toBe(10);
      expect(result.saturation).toBe(120);
      expect(result.hueRotation).toBe(15);
    });
  });

  describe('CPU 回退 - Lift/Gamma/Gain', () => {
    it('中性参数不应改变颜色', () => {
      const [r, g, b] = cpuApplyLiftGammaGain(0.5, 0.5, 0.5, createDefaultColorCorrectionParams());
      expect(r).toBeCloseTo(0.5, 2);
      expect(g).toBeCloseTo(0.5, 2);
      expect(b).toBeCloseTo(0.5, 2);
    });

    it('lift 应提亮暗部', () => {
      const params = createDefaultColorCorrectionParams();
      params.lift.r = 0.5;
      const [r] = cpuApplyLiftGammaGain(0.1, 0.1, 0.1, params);
      expect(r).toBeGreaterThan(0.1);
    });

    it('gain 应增强亮部', () => {
      const params = createDefaultColorCorrectionParams();
      params.gain.r = 0.5;
      const [r] = cpuApplyLiftGammaGain(0.8, 0.8, 0.8, params);
      expect(r).toBeGreaterThan(0.8);
    });
  });

  describe('CPU 回退 - 色温/色调', () => {
    it('中性色温不应改变颜色', () => {
      const [r, g, b] = cpuApplyTemperatureTint(0.5, 0.5, 0.5, 0, 0);
      expect(r).toBeCloseTo(0.5, 2);
      expect(g).toBeCloseTo(0.5, 2);
      expect(b).toBeCloseTo(0.5, 2);
    });

    it('暖色温应增加红色', () => {
      const [r, , b] = cpuApplyTemperatureTint(0.5, 0.5, 0.5, 50, 0);
      expect(r).toBeGreaterThan(0.5);
      expect(b).toBeLessThan(0.5);
    });
  });

  describe('CPU 回退 - 对比度', () => {
    it('零对比度不应改变颜色', () => {
      const [r, g, b] = cpuApplyContrast(0.5, 0.5, 0.5, 0, 0.5);
      expect(r).toBeCloseTo(0.5, 2);
      expect(g).toBeCloseTo(0.5, 2);
      expect(b).toBeCloseTo(0.5, 2);
    });

    it('正对比度应拉伸差异', () => {
      const [r, , b] = cpuApplyContrast(0.7, 0.5, 0.3, 50, 0.5);
      expect(r).toBeGreaterThan(0.7);
      expect(b).toBeLessThan(0.3);
    });
  });

  describe('CPU 回退 - 饱和度', () => {
    it('100% 饱和度不应改变颜色', () => {
      const [r, g, b] = cpuApplySaturation(0.3, 0.6, 0.9, 100);
      expect(r).toBeCloseTo(0.3, 2);
      expect(g).toBeCloseTo(0.6, 2);
      expect(b).toBeCloseTo(0.9, 2);
    });

    it('0% 饱和度应产生灰度', () => {
      const [r, g, b] = cpuApplySaturation(1, 0, 0, 0);
      const lum = 0.2126;
      expect(r).toBeCloseTo(lum, 2);
      expect(g).toBeCloseTo(lum, 2);
      expect(b).toBeCloseTo(lum, 2);
    });
  });

  describe('CPU 回退 - 色调映射', () => {
    it('ACES Hill 应映射到 [0,1]', () => {
      const [r, g, b] = cpuToneMapAcesHill(2.0, 3.0, 4.0);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(1);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
    });

    it('Reinhard 应映射到 [0,1]', () => {
      const [r, g, b] = cpuToneMapReinhard(10, 20, 30);
      expect(r).toBeGreaterThan(0);
      expect(r).toBeLessThan(1);
      expect(g).toBeGreaterThan(0);
      expect(g).toBeLessThan(1);
    });

    it('Filmic 应映射到 [0,1]', () => {
      const [r, g, b] = cpuToneMapFilmic(5, 10, 15);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
    });

    it('none 方法不应改变颜色', () => {
      const [r, g, b] = cpuApplyToneMapping(0.5, 0.5, 0.5, 'none', 0);
      expect(r).toBeCloseTo(0.5, 2);
      expect(g).toBeCloseTo(0.5, 2);
      expect(b).toBeCloseTo(0.5, 2);
    });

    it('曝光应增加亮度', () => {
      const [r1] = cpuApplyToneMapping(0.3, 0.3, 0.3, 'none', 0);
      const [r2] = cpuApplyToneMapping(0.3, 0.3, 0.3, 'none', 2);
      expect(r2).toBeGreaterThan(r1);
    });
  });

  describe('CPU 回退 - 3D LUT', () => {
    const identityLUT: GPU3DLUTData = (() => {
      const size = 4;
      const data = new Float32Array(size * size * size * 3);
      for (let b = 0; b < size; b++) {
        for (let g = 0; g < size; g++) {
          for (let r = 0; r < size; r++) {
            const idx = (b * size * size + g * size + r) * 3;
            data[idx] = r / (size - 1);
            data[idx + 1] = g / (size - 1);
            data[idx + 2] = b / (size - 1);
          }
        }
      }
      return { size, data, textureId: 'identity', format: 'rgb' as const };
    })();

    it('恒等 LUT 不应改变颜色', () => {
      const [r, g, b] = cpuApply3DLUT(0.3, 0.6, 0.9, identityLUT, 1.0);
      expect(r).toBeCloseTo(0.3, 1);
      expect(g).toBeCloseTo(0.6, 1);
      expect(b).toBeCloseTo(0.9, 1);
    });

    it('强度 0 不应改变颜色', () => {
      const [r, g, b] = cpuApply3DLUT(0.5, 0.5, 0.5, identityLUT, 0);
      expect(r).toBeCloseTo(0.5, 2);
      expect(g).toBeCloseTo(0.5, 2);
      expect(b).toBeCloseTo(0.5, 2);
    });
  });

  describe('CPU 回退 - 完整管线', () => {
    it('中性参数不应改变颜色', () => {
      const [r, g, b] = cpuProcessPixel(0.5, 0.5, 0.5, null, null, null, 1);
      expect(r).toBeCloseTo(0.5, 2);
      expect(g).toBeCloseTo(0.5, 2);
      expect(b).toBeCloseTo(0.5, 2);
    });

    it('应正确组合多个处理步骤', () => {
      const cc = createDefaultColorCorrectionParams();
      cc.saturation = 0;
      const tm = createDefaultToneMappingParams();
      tm.exposure = 1;
      const [r, g, b] = cpuProcessPixel(0.5, 0.5, 0.5, cc, tm, null, 1);
      // 灰度 + 色调映射后应仍在 [0,1]
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
      // 灰度值在三个通道应接近
      expect(Math.abs(r - g)).toBeLessThan(0.01);
      expect(Math.abs(g - b)).toBeLessThan(0.01);
    });
  });

  describe('CPU 回退 - 整帧处理', () => {
    it('应正确处理 2x2 帧', () => {
      const input = new Uint8ClampedArray([
        128, 64, 32, 255,
        200, 100, 50, 255,
        64, 128, 192, 255,
        0, 0, 0, 255,
      ]);
      const output = cpuProcessFrame(input, 2, 2, null, null, null, 1);
      expect(output.length).toBe(16);
      // 中性参数应保持原值
      expect(output[0]).toBeCloseTo(128, 0);
      expect(output[4]).toBeCloseTo(200, 0);
    });

    it('应正确应用色彩校正', () => {
      const input = new Uint8ClampedArray([100, 100, 100, 255]);
      const cc = createDefaultColorCorrectionParams();
      cc.contrast = 50;
      const output = cpuProcessFrame(input, 1, 1, cc, null, null, 1);
      // 对比度变化应产生不同值
      expect(output[0]).not.toBe(100);
    });
  });

  describe('着色器生成', () => {
    it('片段着色器应包含必要的 uniform', () => {
      const shader = generateColorProcessingFragmentShader();
      expect(shader).toContain('u_inputTexture');
      expect(shader).toContain('u_lift');
      expect(shader).toContain('u_gamma');
      expect(shader).toContain('u_gain');
      expect(shader).toContain('u_temperature');
      expect(shader).toContain('u_saturation');
      expect(shader).toContain('u_toneMappingMethod');
      expect(shader).toContain('u_lutTexture');
    });

    it('顶点着色器应包含位置和纹理坐标', () => {
      const shader = generateVertexShader();
      expect(shader).toContain('a_position');
      expect(shader).toContain('a_texCoord');
      expect(shader).toContain('v_texCoord');
    });

    it('WebGPU 计算着色器应包含工作组大小', () => {
      const shader = generateWebGPUComputeShader();
      expect(shader).toContain('@workgroup_size(8, 8, 1)');
      expect(shader).toContain('texture_2d<f32>');
      expect(shader).toContain('texture_3d<f32>');
      expect(shader).toContain('texture_storage_2d');
    });
  });

  describe('GPUColorProcessor', () => {
    it('应能创建实例', () => {
      const processor = new GPUColorProcessor();
      expect(processor.getBackend()).toBe('cpu-fallback');
      expect(processor.getConfig().resolution).toBe('1080p');
    });

    it('应能更新配置', () => {
      const processor = new GPUColorProcessor();
      processor.updateConfig({ resolution: '4k' });
      expect(processor.getConfig().resolution).toBe('4k');
    });

    it('应能处理帧 (CPU 回退)', async () => {
      const processor = new GPUColorProcessor();
      const input = new Uint8ClampedArray([128, 128, 128, 255]);
      const result = await processor.processFrame(input, 1, 1);
      expect(result.width).toBe(1);
      expect(result.height).toBe(1);
      expect(result.outputData.length).toBe(4);
      expect(result.backend).toBe('cpu-fallback');
    });

    it('缓存应命中相同参数', async () => {
      const processor = new GPUColorProcessor({ enableCache: true });
      const input = new Uint8ClampedArray([128, 128, 128, 255]);
      const cc = createDefaultColorCorrectionParams();

      const r1 = await processor.processFrame(input, 1, 1, cc);
      expect(r1.fromCache).toBe(false);

      // 相同参数应命中缓存
      const r2 = await processor.processFrame(input, 1, 1, cc);
      expect(r2.fromCache).toBe(true);
    });

    it('应能清除缓存', async () => {
      const processor = new GPUColorProcessor({ enableCache: true });
      const input = new Uint8ClampedArray([128, 128, 128, 255]);
      await processor.processFrame(input, 1, 1);
      processor.clearCache();
      const r = await processor.processFrame(input, 1, 1);
      expect(r.fromCache).toBe(false);
    });

    it('应能注册和触发状态回调', async () => {
      const processor = new GPUColorProcessor();
      let called = false;
      processor.onStatusChange(() => { called = true; });
      await processor.initialize();
      expect(called).toBe(true);
    });

    it('应能获取性能统计', async () => {
      const processor = new GPUColorProcessor();
      const input = new Uint8ClampedArray([128, 128, 128, 255]);
      await processor.processFrame(input, 1, 1);
      const stats = processor.getPerformanceStats();
      expect(stats.framesRendered).toBe(1);
      expect(stats.frameTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('dispose 应清理资源', async () => {
      const processor = new GPUColorProcessor();
      await processor.initialize();
      processor.dispose();
      expect(processor.getDeviceInfo()).toBeNull();
    });
  });

  describe('PreviewFrameCache', () => {
    it('应能存取帧', () => {
      const cache = new PreviewFrameCache();
      const data = new Uint8ClampedArray([1, 2, 3, 4]);
      cache.set('test', data, 2, 2);
      const result = cache.get('test');
      expect(result).not.toBeNull();
      expect(result!.width).toBe(2);
      expect(result!.height).toBe(2);
    });

    it('不存在的键应返回 null', () => {
      const cache = new PreviewFrameCache();
      expect(cache.get('missing')).toBeNull();
    });

    it('应能清除缓存', () => {
      const cache = new PreviewFrameCache();
      cache.set('a', new Uint8ClampedArray([1]), 1, 1);
      cache.clear();
      expect(cache.size()).toBe(0);
    });

    it('LRU 淘汰应生效', () => {
      const cache = new PreviewFrameCache(2);
      cache.set('a', new Uint8ClampedArray([1]), 1, 1);
      cache.set('b', new Uint8ClampedArray([2]), 1, 1);
      cache.set('c', new Uint8ClampedArray([3]), 1, 1);
      expect(cache.size()).toBe(2);
      expect(cache.get('a')).toBeNull(); // 最旧的被淘汰
    });
  });

  describe('GPUPerformanceMonitor', () => {
    it('应正确计算平均帧时间', () => {
      const monitor = new GPUPerformanceMonitor();
      monitor.recordFrame(16.67, 10);
      monitor.recordFrame(16.67, 10);
      expect(monitor.getAverageFrameTime()).toBeCloseTo(16.67, 1);
    });

    it('应正确计算 FPS', () => {
      const monitor = new GPUPerformanceMonitor();
      monitor.recordFrame(16.67, 10);
      expect(monitor.getEstimatedFPS()).toBeCloseTo(60, 0);
    });

    it('应正确计算 P95', () => {
      const monitor = new GPUPerformanceMonitor();
      for (let i = 0; i < 100; i++) {
        monitor.recordFrame(16, 10);
      }
      monitor.recordFrame(50, 40); // 异常帧
      const p95 = monitor.getP95FrameTime();
      expect(p95).toBeGreaterThanOrEqual(16);
    });

    it('应正确计算 GPU 利用率', () => {
      const monitor = new GPUPerformanceMonitor();
      monitor.recordFrame(16, 12);
      const util = monitor.getGPUUtilization();
      expect(util).toBeCloseTo(12 / 16, 2);
    });

    it('应能重置', () => {
      const monitor = new GPUPerformanceMonitor();
      monitor.recordFrame(16, 10);
      monitor.reset();
      expect(monitor.getAverageFrameTime()).toBe(0);
    });

    it('应能获取完整报告', () => {
      const monitor = new GPUPerformanceMonitor();
      monitor.recordFrame(16.67, 10);
      const report = monitor.getReport();
      expect(report.sampleCount).toBe(1);
      expect(report.estimatedFPS).toBeCloseTo(60, 0);
    });
  });
});
