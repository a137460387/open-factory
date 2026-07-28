/**
 * GPU accelerated color processing module
 *
 * Features:
 * 1. GPU backend abstraction - WebGPU / WebGL2 dual backend
 * 2. 3D LUT GPU acceleration - texture sampling for high-performance LUT
 * 3. Color correction GPU pipeline - Lift/Gamma/Gain/Offset shaders
 * 4. Tone mapping GPU acceleration - multiple algorithms
 * 5. Multi-resolution preview - 1080p / 4K adaptive
 * 6. Preview cache - parameter hash cache mechanism
 * 7. Performance monitoring - frame time, GPU memory stats
 */

// Re-export all types, constants, factories, validation, and conversion
export * from './gpu-color-processing-types';

// Re-export shader generation
export { generateColorProcessingFragmentShader, generateVertexShader, generateWebGPUComputeShader } from './gpu-color-processing-shaders';

// Re-export CPU fallback functions
export {
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
} from './gpu-color-processing-cpu';

// Re-export classes and utility functions
export {
  computeParamsHash,
  buildPipelineCacheKey,
  GPUColorProcessor,
  PreviewFrameCache,
  GPUPerformanceMonitor,
} from './gpu-color-processing-classes';
