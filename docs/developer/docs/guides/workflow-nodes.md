---
sidebar_position: 3
---

# 工作流节点开发指南

本指南介绍如何为 Open Factory 的工作流引擎开发自定义节点，实现自动化视频处理流水线。

## 概述

Open Factory 工作流引擎基于节点图（Node Graph）架构，每个节点代表一个处理步骤：

- **输入节点** — 数据源（文件、流、API）
- **处理节点** — 转换操作（裁剪、滤镜、AI 分析）
- **输出节点** — 结果输出（文件、通知、API 回调）
- **控制节点** — 流程控制（条件、循环、并行）

## 节点结构

### 基本节点接口

```typescript
interface WorkflowNode {
  id: string;
  type: string;
  name: string;
  description: string;
  inputs: NodePort[];
  outputs: NodePort[];
  parameters: NodeParameter[];
  execute(context: ExecutionContext): Promise<NodeResult>;
}

interface NodePort {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'image' | 'data' | 'any';
  required: boolean;
  multiple?: boolean;  // 是否支持多个连接
}

interface NodeParameter {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'file' | 'color';
  default?: unknown;
  required?: boolean;
  options?: unknown[];  // 用于 select 类型
}

interface NodeResult {
  outputs: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

interface ExecutionContext {
  projectId: string;
  workingDir: string;
  tempDir: string;
  logger: Logger;
  progress: (percent: number) => void;
  getNodeOutput(nodeId: string, portId: string): unknown;
}
```

## 创建自定义节点

### 示例：视频裁剪节点

```typescript
import type { WorkflowNode, ExecutionContext } from '@open-factory/workflow-engine';

/**
 * Video crop node - crops video to specified dimensions.
 */
const VideoCropNode: WorkflowNode = {
  id: 'video-crop',
  type: 'process',
  name: 'Video Crop',
  description: 'Crop video to specified dimensions and position',

  inputs: [
    {
      id: 'input-video',
      name: 'Input Video',
      type: 'video',
      required: true,
    },
  ],

  outputs: [
    {
      id: 'output-video',
      name: 'Output Video',
      type: 'video',
    },
  ],

  parameters: [
    {
      id: 'x',
      name: 'X Position',
      type: 'number',
      default: 0,
      required: true,
    },
    {
      id: 'y',
      name: 'Y Position',
      type: 'number',
      default: 0,
      required: true,
    },
    {
      id: 'width',
      name: 'Width',
      type: 'number',
      required: true,
    },
    {
      id: 'height',
      name: 'Height',
      type: 'number',
      required: true,
    },
  ],

  async execute(context: ExecutionContext): Promise<NodeResult> {
    const inputPath = context.getNodeOutput('input-node', 'output-video') as string;
    const { x, y, width, height } = getParameters(context);

    context.logger.info(`Cropping video: ${width}x${height} at (${x}, ${y})`);
    context.progress(0);

    // Execute crop operation
    const outputPath = `${context.tempDir}/cropped-${Date.now()}.mp4`;

    await cropVideo(inputPath, outputPath, { x, y, width, height });

    context.progress(100);

    return {
      outputs: {
        'output-video': outputPath,
      },
      metadata: {
        originalSize: await getVideoSize(inputPath),
        croppedSize: { width, height },
      },
    };
  },
};

export default VideoCropNode;
```

### 示例：AI 场景检测节点

```typescript
import type { WorkflowNode, ExecutionContext } from '@open-factory/workflow-engine';

/**
 * AI scene detection node - detects scene changes in video.
 */
const SceneDetectionNode: WorkflowNode = {
  id: 'ai-scene-detection',
  type: 'ai-process',
  name: 'Scene Detection',
  description: 'Detect scene changes using AI analysis',

  inputs: [
    {
      id: 'input-video',
      name: 'Input Video',
      type: 'video',
      required: true,
    },
  ],

  outputs: [
    {
      id: 'scenes',
      name: 'Scene List',
      type: 'data',
    },
    {
      id: 'scene-count',
      name: 'Scene Count',
      type: 'data',
    },
  ],

  parameters: [
    {
      id: 'threshold',
      name: 'Detection Threshold',
      type: 'number',
      default: 0.3,
    },
    {
      id: 'min-duration',
      name: 'Minimum Scene Duration (s)',
      type: 'number',
      default: 1.0,
    },
  ],

  async execute(context: ExecutionContext): Promise<NodeResult> {
    const inputPath = context.getNodeOutput('input-node', 'output-video') as string;
    const threshold = getParameter(context, 'threshold', 0.3);
    const minDuration = getParameter(context, 'min-duration', 1.0);

    context.logger.info('Starting AI scene detection...');
    context.progress(0);

    const scenes = await detectScenes(inputPath, {
      threshold,
      minSceneDuration: minDuration,
      onProgress: (percent) => context.progress(percent),
    });

    context.logger.info(`Detected ${scenes.length} scenes`);

    return {
      outputs: {
        scenes,
        'scene-count': scenes.length,
      },
    };
  },
};

export default SceneDetectionNode;
```

### 示例：条件分支节点

```typescript
import type { WorkflowNode, ExecutionContext } from '@open-factory/workflow-engine';

/**
 * Conditional branch node - routes flow based on condition.
 */
const ConditionalNode: WorkflowNode = {
  id: 'conditional',
  type: 'control',
  name: 'Conditional Branch',
  description: 'Route workflow based on a condition',

  inputs: [
    {
      id: 'input',
      name: 'Input',
      type: 'any',
      required: true,
    },
  ],

  outputs: [
    {
      id: 'true',
      name: 'True Branch',
      type: 'any',
    },
    {
      id: 'false',
      name: 'False Branch',
      type: 'any',
    },
  ],

  parameters: [
    {
      id: 'condition',
      name: 'Condition',
      type: 'select',
      options: ['equals', 'greater-than', 'less-than', 'contains', 'exists'],
      required: true,
    },
    {
      id: 'value',
      name: 'Compare Value',
      type: 'string',
      required: true,
    },
  ],

  async execute(context: ExecutionContext): Promise<NodeResult> {
    const input = context.getNodeOutput('input-node', 'output') as unknown;
    const condition = getParameter(context, 'condition') as string;
    const compareValue = getParameter(context, 'value') as string;

    const result = evaluateCondition(input, condition, compareValue);

    context.logger.info(`Condition "${condition} ${compareValue}" evaluated to: ${result}`);

    return {
      outputs: {
        [result ? 'true' : 'false']: input,
      },
    };
  },
};

function evaluateCondition(
  input: unknown,
  condition: string,
  compareValue: string
): boolean {
  switch (condition) {
    case 'equals':
      return String(input) === compareValue;
    case 'greater-than':
      return Number(input) > Number(compareValue);
    case 'less-than':
      return Number(input) < Number(compareValue);
    case 'contains':
      return String(input).includes(compareValue);
    case 'exists':
      return input !== undefined && input !== null;
    default:
      return false;
  }
}

export default ConditionalNode;
```

## 节点注册

### 注册自定义节点

```typescript
import { WorkflowEngine } from '@open-factory/workflow-engine';
import VideoCropNode from './nodes/video-crop';
import SceneDetectionNode from './nodes/scene-detection';
import ConditionalNode from './nodes/conditional';

const engine = new WorkflowEngine();

// 注册自定义节点
engine.registerNode(VideoCropNode);
engine.registerNode(SceneDetectionNode);
engine.registerNode(ConditionalNode);

// 批量注册
engine.registerNodes([
  VideoCropNode,
  SceneDetectionNode,
  ConditionalNode,
]);
```

### 使用插件注册节点

```typescript
import type { OpenFactoryPlugin } from '@open-factory/plugin-sdk';
import VideoCropNode from './nodes/video-crop';

const plugin: OpenFactoryPlugin = {
  id: 'com.example.workflow-nodes',
  name: 'Workflow Nodes Pack',
  version: '1.0.0',
  description: 'Additional workflow nodes',
  permissions: ['read-project', 'write-project'],
  hooks: {
    onMenuRegister({ menus }) {
      menus.push({
        id: 'workflow-nodes',
        label: 'Workflow Nodes',
      });
    },
  },
};

export default plugin;
```

## 工作流定义

### 使用 JSON 定义工作流

```json
{
  "name": "Video Processing Pipeline",
  "version": "1.0.0",
  "nodes": [
    {
      "id": "input",
      "type": "file-input",
      "parameters": {
        "path": "${inputPath}"
      }
    },
    {
      "id": "detect-scenes",
      "type": "ai-scene-detection",
      "parameters": {
        "threshold": 0.3,
        "min-duration": 1.0
      },
      "connections": {
        "input-video": { "nodeId": "input", "portId": "output-video" }
      }
    },
    {
      "id": "check-scenes",
      "type": "conditional",
      "parameters": {
        "condition": "greater-than",
        "value": "5"
      },
      "connections": {
        "input": { "nodeId": "detect-scenes", "portId": "scene-count" }
      }
    },
    {
      "id": "smart-cut",
      "type": "ai-smart-cut",
      "parameters": {
        "remove-silence": true,
        "target-pacing": "dynamic"
      },
      "connections": {
        "input-video": { "nodeId": "check-scenes", "portId": "true" }
      }
    },
    {
      "id": "output",
      "type": "file-output",
      "parameters": {
        "path": "${outputPath}",
        "format": "mp4"
      },
      "connections": {
        "input-video": { "nodeId": "smart-cut", "portId": "output-video" }
      }
    }
  ],
  "variables": {
    "inputPath": "./raw/video.mp4",
    "outputPath": "./processed/output.mp4"
  }
}
```

## 执行工作流

```typescript
import { WorkflowEngine } from '@open-factory/workflow-engine';

const engine = new WorkflowEngine();
const definition = require('./workflow.json');

// 执行工作流
const result = await engine.execute(definition, {
  onNodeStart: (nodeId) => {
    console.log(`Starting node: ${nodeId}`);
  },
  onNodeComplete: (nodeId, output) => {
    console.log(`Completed node: ${nodeId}`, output);
  },
  onNodeError: (nodeId, error) => {
    console.error(`Node ${nodeId} failed:`, error);
  },
  onProgress: (percent) => {
    console.log(`Overall progress: ${percent}%`);
  },
});

console.log('Workflow completed:', result);
```

## 测试节点

```typescript
import { describe, it, expect } from 'vitest';
import { WorkflowEngine, MockExecutionContext } from '@open-factory/workflow-engine';
import VideoCropNode from './video-crop';

describe('VideoCropNode', () => {
  it('should have correct ports', () => {
    expect(VideoCropNode.inputs).toHaveLength(1);
    expect(VideoCropNode.outputs).toHaveLength(1);
    expect(VideoCropNode.inputs[0].type).toBe('video');
  });

  it('should crop video', async () => {
    const context = new MockExecutionContext({
      parameters: { x: 100, y: 50, width: 640, height: 480 },
      nodeOutputs: {
        'input-node': { 'output-video': '/input/video.mp4' },
      },
    });

    const result = await VideoCropNode.execute(context);

    expect(result.outputs['output-video']).toBeDefined();
    expect(result.metadata?.croppedSize).toEqual({ width: 640, height: 480 });
  });
});
```

## 内置节点类型

### 输入节点

| 节点 | 说明 |
|------|------|
| `file-input` | 从文件读取 |
| `stream-input` | 从流读取 |
| `api-input` | 从 API 获取 |
| `project-input` | 读取项目数据 |

### 处理节点

| 节点 | 说明 |
|------|------|
| `video-crop` | 视频裁剪 |
| `video-resize` | 视频缩放 |
| `video-speed` | 速度调整 |
| `audio-adjust` | 音频调整 |
| `color-grade` | 调色处理 |
| `text-overlay` | 文字叠加 |
| `transition-add` | 添加转场 |

### AI 节点

| 节点 | 说明 |
|------|------|
| `ai-scene-detection` | 场景检测 |
| `ai-smart-cut` | 智能剪辑 |
| `ai-quality-assess` | 质量评估 |
| `ai-transcription` | 语音转文字 |
| `ai-translate` | 翻译 |
| `ai-object-detect` | 物体检测 |

### 控制节点

| 节点 | 说明 |
|------|------|
| `conditional` | 条件分支 |
| `loop` | 循环 |
| `parallel` | 并行执行 |
| `merge` | 合并 |
| `delay` | 延时 |
| `retry` | 重试 |

### 输出节点

| 节点 | 说明 |
|------|------|
| `file-output` | 输出到文件 |
| `api-output` | 调用 API |
| `notification` | 发送通知 |
| `project-save` | 保存项目 |
