# Open Factory 插件开发指南

> 版本: v4.35.0 | 最后更新: 2026-07-17

## 概述

Open Factory 插件系统允许开发者扩展编辑器的功能。插件分为四类：

| 类别 | 说明 | 示例 |
|------|------|------|
| **效果插件 (Effect)** | 自定义视频/音频效果 | 模糊、色彩校正、风格化 |
| **导出插件 (Export)** | 自定义导出预设和后处理 | 特殊编码器、云上传 |
| **工作流插件 (Workflow)** | 自动化编辑工作流 | 批量处理、模板应用 |
| **AI模型插件 (AI Model)** | 集成本地AI模型 | 场景检测、语音识别 |

---

## 快速开始

### 1. 项目结构

```
my-plugin/
├── package.json
├── manifest.json
├── src/
│   └── index.ts
└── tsconfig.json
```

### 2. 定义清单文件 (manifest.json)

```json
{
  "id": "com.example.my-plugin",
  "name": "我的插件",
  "version": "1.0.0",
  "description": "一个示例效果插件",
  "category": "effect",
  "author": "Your Name",
  "permissions": ["read-project", "write-project"],
  "main": "dist/index.js"
}
```

### 3. 实现插件

```typescript
import type { EffectPlugin, EffectParameter, PluginContext } from '@open-factory/editor-core';

const parameters: EffectParameter[] = [
  {
    name: 'intensity',
    label: '强度',
    type: 'number',
    defaultValue: 1.0,
    min: 0,
    max: 2,
    step: 0.1,
  },
];

const plugin: EffectPlugin = {
  effectId: 'com.example.my-plugin.blur',
  effectName: '自定义模糊',
  effectCategory: '模糊',
  parameters,

  applyEffect(params, frameData, width, height) {
    const intensity = (params.intensity as number) ?? 1.0;
    const output = new Uint8ClampedArray(frameData);
    
    // 简单的盒式模糊实现
    const radius = Math.round(intensity * 3);
    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        let r = 0, g = 0, b = 0, count = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 4;
            r += frameData[idx];
            g += frameData[idx + 1];
            b += frameData[idx + 2];
            count++;
          }
        }
        const idx = (y * width + x) * 4;
        output[idx] = r / count;
        output[idx + 1] = g / count;
        output[idx + 2] = b / count;
      }
    }
    
    return output;
  },

  toFFmpegFilter(params) {
    const intensity = (params.intensity as number) ?? 1.0;
    const size = Math.round(intensity * 5) * 2 + 1;
    return `boxblur=${size}:${size}`;
  },

  onLoad(context: PluginContext) {
    context.logger.info('插件已加载');
  },

  onActivate(context: PluginContext) {
    context.logger.info('插件已激活');
  },
};

export default plugin;
```

---

## 插件类型详解

### 效果插件 (EffectPlugin)

用于创建自定义视频/音频效果。

**接口定义：**

```typescript
interface EffectPlugin extends PluginLifecycle {
  effectId: string;
  effectName: string;
  effectCategory: string;
  parameters: EffectParameter[];
  gpuAccelerated?: boolean;

  applyEffect(
    params: Record<string, unknown>,
    frameData: Uint8ClampedArray,
    width: number,
    height: number,
  ): Uint8ClampedArray | Promise<Uint8ClampedArray>;

  toFFmpegFilter?(params: Record<string, unknown>): string;
}
```

**参数类型：**

| type | 说明 | 额外属性 |
|------|------|----------|
| `number` | 数值滑块 | min, max, step |
| `boolean` | 开关 | - |
| `color` | 颜色选择器 | - |
| `select` | 下拉选择 | options: Array<{label, value}> |
| `text` | 文本输入 | - |

### 导出插件 (ExportPlugin)

用于定义自定义导出预设。

**接口定义：**

```typescript
interface ExportPlugin extends PluginLifecycle {
  presetId: string;
  presets: ExportPreset[];

  prepareExport(
    preset: ExportPreset,
    options: ExportOptions,
  ): string[] | Promise<string[]>;

  postExport?(outputPath: string, preset: ExportPreset): void | Promise<void>;
}
```

**示例 - H.265 导出预设：**

```typescript
const plugin: ExportPlugin = {
  presetId: 'com.example.h265-export',
  presets: [
    {
      id: 'h265-4k',
      name: 'H.265 4K',
      extension: 'mp4',
      mimeType: 'video/mp4',
      ffmpegArgs: ['-c:v', 'libx265', '-preset', 'medium', '-crf', '23'],
      description: '高质量 H.265 编码',
    },
  ],

  prepareExport(preset, options) {
    return ['-maxrate', `${options.videoBitrate ?? 20000}k`];
  },
};
```

### 工作流插件 (WorkflowPlugin)

用于创建自动化编辑工作流。

**接口定义：**

```typescript
interface WorkflowPlugin extends PluginLifecycle {
  workflowId: string;
  workflowName: string;
  workflowDescription?: string;
  steps: WorkflowStep[];

  executeStep(step: WorkflowStep, input: unknown): unknown | Promise<unknown>;
  validateInput?(input: unknown): { valid: boolean; errors?: string[] };
}
```

**示例 - 批量裁剪工作流：**

```typescript
const plugin: WorkflowPlugin = {
  workflowId: 'com.example.batch-crop',
  workflowName: '批量裁剪',
  workflowDescription: '将多个片段裁剪到指定宽高比',
  steps: [
    { id: 'select-clips', name: '选择片段', requiresInput: true },
    { id: 'select-ratio', name: '选择宽高比', requiresInput: true },
    { id: 'apply', name: '应用裁剪' },
  ],

  async executeStep(step, input) {
    switch (step.id) {
      case 'select-clips':
        return { clips: input };
      case 'select-ratio':
        return { ratio: input };
      case 'apply':
        // 执行裁剪逻辑
        return { success: true };
    }
  },
};
```

### AI模型插件 (AIModelPlugin)

用于集成本地AI模型。

**接口定义：**

```typescript
interface AIModelPlugin extends PluginLifecycle {
  modelInfo: AIModelInfo;

  loadModel(): Promise<boolean>;
  infer<T>(request: AIInferenceRequest): Promise<AIInferenceResult<T>>;
  isModelLoaded(): boolean;
  unloadModel(): Promise<void>;
}
```

**模型能力 (capabilities)：**

- `scene-detection` - 场景检测
- `object-detection` - 物体检测
- `face-detection` - 人脸检测
- `speech-to-text` - 语音转文字
- `text-to-speech` - 文字转语音
- `translation` - 翻译
- `summarization` - 摘要
- `style-transfer` - 风格迁移
- `super-resolution` - 超分辨率
- `noise-reduction` - 降噪
- `custom` - 自定义

**示例 - ONNX 模型集成：**

```typescript
const plugin: AIModelPlugin = {
  modelInfo: {
    modelId: 'com.example.object-detector',
    name: '物体检测器',
    version: '1.0.0',
    capabilities: ['object-detection'],
    local: true,
    modelSize: 50 * 1024 * 1024, // 50MB
    gpuMemoryMb: 512,
  },

  async loadModel() {
    // 加载 ONNX 模型
    // const session = await ort.InferenceSession.create('model.onnx');
    return true;
  },

  async infer(request) {
    const start = performance.now();
    // 执行推理
    const output = { detections: [] };
    return {
      output,
      inferenceTimeMs: performance.now() - start,
      confidence: 0.9,
    };
  },

  isModelLoaded() {
    return true;
  },

  async unloadModel() {
    // 释放模型资源
  },
};
```

---

## 插件生命周期

插件经历以下状态：

```
registered → loading → loaded → active → deactivated → unloaded
                    ↘ error ↙
```

**生命周期钩子：**

| 钩子 | 调用时机 | 用途 |
|------|----------|------|
| `onLoad` | 插件首次加载 | 初始化资源、注册菜单 |
| `onActivate` | 插件激活 | 开始监听事件、激活功能 |
| `onDeactivate` | 插件停用 | 停止监听、释放临时资源 |
| `onUnload` | 插件卸载 | 释放所有资源 |
| `onError` | 发生错误 | 错误处理和恢复 |

---

## 插件上下文 (PluginContext)

每个插件在生命周期中都会收到一个 `PluginContext` 对象：

```typescript
interface PluginContext {
  manifest: PluginManifest;    // 插件清单
  logger: PluginLogger;        // 日志工具
  storage: PluginStorage;      // 持久化存储
  events: PluginEventEmitter;  // 事件发射器
}
```

### 日志

```typescript
context.logger.info('信息日志');
context.logger.warn('警告日志');
context.logger.error('错误日志');
context.logger.debug('调试日志');
```

### 持久化存储

```typescript
// 存储数据
await context.storage.set('settings', { theme: 'dark' });

// 读取数据
const settings = await context.storage.get('settings');

// 删除数据
await context.storage.delete('settings');

// 清空所有数据
await context.storage.clear();

// 获取所有键
const keys = await context.storage.keys();
```

### 事件通信

```typescript
// 发送事件
context.events.emit('my-event', { data: 'hello' });

// 监听事件
const unsubscribe = context.events.on('my-event', (data) => {
  console.log('收到事件:', data);
});

// 取消监听
unsubscribe();

// 一次性监听
context.events.once('my-event', (data) => {
  console.log('只监听一次');
});
```

---

## 权限系统

插件需要声明所需的权限：

| 权限 | 说明 |
|------|------|
| `read-project` | 读取项目数据 |
| `write-project` | 修改项目数据 |
| `read-media` | 读取媒体文件 |
| `export-hook` | 拦截导出流程 |
| `menu-register` | 注册菜单项 |
| `timeline-mutation` | 修改时间线 |
| `ai-inference` | 执行AI推理 |
| `network-access` | 网络访问 |

在 `manifest.json` 中声明：

```json
{
  "permissions": ["read-project", "write-project", "timeline-mutation"]
}
```

---

## 最佳实践

### 1. 纯函数优先

效果插件的 `applyEffect` 应该是纯函数，相同输入产生相同输出。

### 2. 异步处理

长时间操作使用 `async/await`，避免阻塞主线程。

### 3. 错误处理

```typescript
try {
  await someOperation();
} catch (error) {
  context.logger.error('操作失败:', error);
  throw error; // 让插件管理器处理
}
```

### 4. 资源清理

在 `onUnload` 中释放所有资源：

```typescript
onUnload(context) {
  // 清理定时器
  clearInterval(this.timer);
  // 关闭连接
  this.connection?.close();
  // 释放内存
  this.buffer = null;
}
```

### 5. 类型安全

使用 TypeScript 类型确保类型安全：

```typescript
interface MyParams {
  intensity: number;
  color: string;
}

const plugin: EffectPlugin = {
  applyEffect(params: Record<string, unknown>, frameData, width, height) {
    const { intensity, color } = params as MyParams;
    // ...
  },
};
```

---

## 测试插件

```typescript
import { describe, it, expect } from 'vitest';
import plugin from '../src/index';

describe('My Plugin', () => {
  it('applies effect correctly', () => {
    const frameData = new Uint8ClampedArray(1920 * 1080 * 4);
    const result = plugin.applyEffect({ intensity: 1.0 }, frameData, 1920, 1080);
    expect(result).toBeInstanceOf(Uint8ClampedArray);
    expect(result.length).toBe(frameData.length);
  });

  it('generates FFmpeg filter', () => {
    const filter = plugin.toFFmpegFilter?.({ intensity: 1.0 });
    expect(filter).toContain('boxblur');
  });
});
```

---

## 示例插件

完整的示例插件可以在 `examples/plugins/` 目录找到：

- `examples/plugins/blur-effect/` - 模糊效果插件
- `examples/plugins/h265-export/` - H.265 导出插件
- `examples/plugins/batch-workflow/` - 批量处理工作流插件
- `examples/plugins/object-detector/` - 物体检测AI插件

---

## API 参考

完整的 API 参考请查看 `packages/editor-core/src/plugins/plugin-types.ts` 中的类型定义。

---

## 常见问题

### Q: 插件如何访问项目数据？

A: 通过 `PluginHostAPI` 接口，需要 `read-project` 权限。

### Q: 插件可以修改时间线吗？

A: 可以，但需要 `timeline-mutation` 权限。所有修改通过命令模式执行，支持撤销。

### Q: AI模型插件支持GPU加速吗？

A: 支持。在 `modelInfo` 中声明 `gpuMemoryMb`，系统会自动管理GPU资源。

### Q: 插件之间可以通信吗？

A: 可以通过 `PluginEventEmitter` 进行事件通信。

### Q: 如何调试插件？

A: 使用 `context.logger` 输出日志，或在 `dev` 模式下加载插件进行调试。
