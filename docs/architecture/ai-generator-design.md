# AI Generator Architecture - Sprint AH

## Overview

集成 Wan2.1-I2V-14B-720P-Turbo 模型，实现本地生成式 AI 功能，支持文生视频、图生视频，目标 720P 视频生成 <30秒。

## 技术栈选择

### 模型推理引擎

**ONNX Runtime Web (推荐)**

选择理由：
- 跨平台支持（浏览器、Node.js、桌面）
- WebGPU 加速支持
- 模型量化支持（INT8/INT4）
- 社区活跃，文档完善
- 与 TypeScript/JavaScript 生态集成良好

**备选方案：**
- TensorFlow.js：生态成熟但性能稍差
- MediaPipe：Google 支持但灵活性有限
- WebNN：新兴标准但兼容性待提升

### WebGPU 加速

- 使用 WebGPU 进行并行计算
- 支持 GPU 加速的矩阵运算
- 降级策略：WebGL → CPU

### 模型格式

- ONNX 格式：跨平台兼容
- 量化版本：INT8/INT4 减少内存占用
- 分片加载：支持大模型流式加载

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend UI Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Text2Video   │  │ Image2Video  │  │  Interactive │      │
│  │   Panel      │  │    Panel     │  │   Generator  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                  AI Generator Core                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Generation Pipeline                                 │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │  │
│  │  │ Text    │ │ Image   │ │ Video   │ │ Post    │  │  │
│  │  │ Encode  │ │ Encode  │ │ Decode  │ │ Process │  │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Model Manager                                       │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │  │
│  │  │   Model     │ │   Model     │ │   Model     │  │  │
│  │  │   Loader    │ │   Cache     │ │   Hot Swap  │  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Compute Engine                                      │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │  │
│  │  │  WebGPU     │ │   WebGL     │ │    CPU      │  │  │
│  │  │  (Primary)  │ │  (Fallback) │ │  (Fallback) │  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    Model Storage                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Wan2.1      │  │  Text        │  │  VAE         │      │
│  │  I2V-14B     │  │  Encoder     │  │  Decoder     │      │
│  │  (Quantized) │  │  (CLIP)      │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## 目录结构

```
packages/ai-generator/
├── src/
│   ├── index.ts                 # 入口文件
│   ├── types.ts                 # 类型定义
│   ├── config.ts                # 配置管理
│   ├── core/
│   │   ├── generator.ts         # 生成器核心
│   │   ├── pipeline.ts          # 生成管道
│   │   └── scheduler.ts         # 任务调度
│   ├── models/
│   │   ├── model-manager.ts     # 模型管理器
│   │   ├── model-loader.ts      # 模型加载器
│   │   ├── model-cache.ts       # 模型缓存
│   │   └── quantization.ts      # 量化工具
│   ├── compute/
│   │   ├── engine.ts            # 计算引擎抽象
│   │   ├── webgpu-engine.ts     # WebGPU 实现
│   │   ├── webgl-engine.ts      # WebGL 降级
│   │   └── cpu-engine.ts        # CPU 降级
│   ├── pipelines/
│   │   ├── text-to-video.ts     # 文生视频
│   │   ├── image-to-video.ts    # 图生视频
│   │   └── interactive.ts       # 交互式生成
│   ├── utils/
│   │   ├── tensor.ts            # 张量操作
│   │   ├── image.ts             # 图像处理
│   │   ├── video.ts             # 视频处理
│   │   └── stream.ts            # 流式输出
│   └── workers/
│       ├── inference.worker.ts  # 推理 Worker
│       └── postprocess.worker.ts # 后处理 Worker
├── models/                      # 模型文件（gitignore）
│   ├── wan2.1-i2v-14b/
│   │   ├── model.onnx           # 主模型
│   │   ├── model_int8.onnx      # INT8 量化版
│   │   ├── model_int4.onnx      # INT4 量化版
│   │   ├── text_encoder.onnx    # 文本编码器
│   │   └── vae_decoder.onnx     # VAE 解码器
│   └── config.json              # 模型配置
├── tests/
│   ├── unit/
│   └── integration/
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## 核心功能

### 1. 文生视频 (Text-to-Video)

```typescript
interface TextToVideoOptions {
  prompt: string;
  negativePrompt?: string;
  width: number;       // 1280, 720, 480
  height: number;      // 720, 480, 360
  duration: number;    // 秒，1-10
  fps: number;         // 24, 30
  style?: 'cinematic' | 'anime' | 'realistic' | 'artistic';
  seed?: number;
  steps?: number;      // 推理步数，20-50
  guidanceScale?: number; // 引导强度，1-20
}

interface TextToVideoResult {
  video: Blob;
  metadata: {
    width: number;
    height: number;
    duration: number;
    fps: number;
    generationTime: number;
    modelVersion: string;
  };
}
```

### 2. 图生视频 (Image-to-Video)

```typescript
interface ImageToVideoOptions {
  image: Blob | File;
  prompt?: string;
  motionStrength: number;  // 0-1
  width: number;
  height: number;
  duration: number;
  fps: number;
  seed?: number;
}

interface ImageToVideoResult {
  video: Blob;
  metadata: {
    width: number;
    height: number;
    duration: number;
    fps: number;
    generationTime: number;
    sourceImageSize: { width: number; height: number };
  };
}
```

### 3. 交互式生成 (Interactive Generation)

```typescript
interface InteractiveOptions {
  prompt: string;
  width: number;
  height: number;
  duration: number;
  fps: number;
  previewQuality: 'low' | 'medium' | 'high';
  onPreview?: (frame: ImageData) => void;
  onProgress?: (progress: number) => void;
}

interface InteractiveGenerator {
  start(options: InteractiveOptions): Promise<void>;
  updatePrompt(prompt: string): void;
  updateParams(params: Partial<InteractiveOptions>): void;
  pause(): void;
  resume(): void;
  cancel(): void;
  getPreview(): ImageData | null;
  getFinalVideo(): Promise<Blob>;
}
```

## 模型优化策略

### 量化

```typescript
// INT8 量化
const quantizedModel = await quantizeModel(model, {
  precision: 'int8',
  calibrationData: sampleInputs,
  optimizeFor: 'latency',
});

// INT4 量化（更激进）
const ultraQuantized = await quantizeModel(model, {
  precision: 'int4',
  calibrationData: sampleInputs,
  optimizeFor: 'memory',
});
```

### WebGPU 加速

```typescript
// 初始化 WebGPU
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();

// 创建计算管线
const pipeline = device.createComputePipeline({
  layout: 'auto',
  compute: {
    module: shaderModule,
    entryPoint: 'main',
  },
});

// 执行 GPU 计算
const commandEncoder = device.createCommandEncoder();
const passEncoder = commandEncoder.beginComputePass();
passEncoder.setPipeline(pipeline);
passEncoder.setBindGroup(0, bindGroup);
passEncoder.dispatchWorkgroups(workgroupCount);
passEncoder.end();
device.queue.submit([commandEncoder.finish()]);
```

### 分片加载

```typescript
// 大模型分片加载
const modelChunks = await loadModelInChunks(modelUrl, {
  chunkSize: 50 * 1024 * 1024, // 50MB per chunk
  onProgress: (loaded, total) => {
    updateProgressBar(loaded / total);
  },
  onChunkLoaded: (chunkIndex) => {
    console.log(`Chunk ${chunkIndex} loaded`);
  },
});
```

## 性能目标

### 720P 视频生成

| 配置 | 目标时间 | 内存占用 |
|------|---------|---------|
| WebGPU + INT8 | <30秒 | <4GB |
| WebGPU + INT4 | <20秒 | <2GB |
| WebGL + INT8 | <60秒 | <4GB |
| CPU + INT8 | <120秒 | <4GB |

### 预览性能

| 质量 | 分辨率 | 帧率 | 延迟 |
|------|--------|------|------|
| Low | 320x180 | 15fps | <1秒 |
| Medium | 640x360 | 24fps | <2秒 |
| High | 1280x720 | 30fps | <5秒 |

## 降级策略

```typescript
async function getComputeEngine(): Promise<ComputeEngine> {
  // 1. 尝试 WebGPU
  if (await isWebGPUSupported()) {
    try {
      const engine = new WebGPUEngine();
      await engine.initialize();
      return engine;
    } catch (e) {
      console.warn('WebGPU initialization failed, falling back to WebGL');
    }
  }

  // 2. 降级到 WebGL
  if (await isWebGLSupported()) {
    try {
      const engine = new WebGLEngine();
      await engine.initialize();
      return engine;
    } catch (e) {
      console.warn('WebGL initialization failed, falling back to CPU');
    }
  }

  // 3. 最终降级到 CPU
  return new CPUEngine();
}
```

## 安全与限制

### 使用限额

```typescript
const USAGE_LIMITS = {
  free: {
    dailyGenerations: 5,
    maxDuration: 5,      // 秒
    maxResolution: '720p',
    priority: 'low',
  },
  creator: {
    dailyGenerations: 50,
    maxDuration: 10,
    maxResolution: '1080p',
    priority: 'medium',
  },
  pro: {
    dailyGenerations: -1, // 无限
    maxDuration: 30,
    maxResolution: '4k',
    priority: 'high',
  },
};
```

### 内容安全

```typescript
// 内容过滤
const contentFilter = new ContentFilter({
  blockNSFW: true,
  blockViolence: true,
  blockHateSpeech: true,
  customBlocklist: ['copyrighted_content'],
});

// 水印
const watermark = new Watermark({
  text: 'Generated by Open Factory',
  position: 'bottom-right',
  opacity: 0.3,
});
```

## 实现阶段

### Phase 1: 基础框架（当前 Sprint）

1. 创建 `packages/ai-generator/` 模块
2. 实现模型管理器和加载器
3. 实现 WebGPU 计算引擎
4. 实现基础文生视频功能
5. 编写单元测试

### Phase 2: 功能完善

1. 实现图生视频
2. 实现交互式生成
3. 优化量化策略
4. 添加内容安全过滤

### Phase 3: 生产就绪

1. 性能优化和基准测试
2. 错误处理和恢复
3. 用户限额和计费集成
4. 监控和日志

## 依赖项

```json
{
  "dependencies": {
    "onnxruntime-web": "^1.16.0",
    "@webgpu/types": "^0.1.0",
    "sharp": "^0.33.0",
    "ffmpeg.wasm": "^0.12.0"
  },
  "devDependencies": {
    "@types/offscreencanvas": "^2019.0.0"
  }
}
```

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| WebGPU 兼容性差 | 性能下降 | WebGL/CPU 降级策略 |
| 模型文件过大 | 加载慢 | 分片加载 + 量化 |
| 内存占用过高 | 崩溃 | 流式处理 + 内存池 |
| 生成质量不稳定 | 用户体验差 | 多次采样 + 质量筛选 |
