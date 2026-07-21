---
sidebar_position: 1
---

# Editor Core API

`@open-factory/editor-core` 是 Open Factory 的核心编辑引擎包，提供时间线管理、剪辑操作、关键帧动画、色彩处理、AI 分析和导出渲染等功能。

## 安装

```bash
bun add @open-factory/editor-core
```

## 核心类型

### Project

项目是最顶层的数据结构，包含所有编辑信息。

```typescript
interface Project {
  version: ProjectVersion;
  name: string;
  tracks: Track[];
  duration: number;
  fps: number;
  width: number;
  height: number;
  colorPipeline?: ProjectColorPipeline;
  workingColorSpace?: ProjectWorkingColorSpace;
}
```

### Track

轨道是时间线上的水平层，包含多个剪辑。

```typescript
type TrackType = 'video' | 'audio' | 'text' | 'subtitle' | 'multicam';

interface Track {
  id: string;
  name: string;
  type: TrackType;
  clips: Clip[];
  volume: number;
  pan: number;
  muted: boolean;
  locked: boolean;
  visible: boolean;
  colorLabel?: TimelineLabelColor;
}
```

### Clip

剪辑是时间线上的基本编辑单元。

```typescript
type ClipType =
  | 'video' | 'audio' | 'image' | 'text' | 'subtitle'
  | 'credits' | 'nested-sequence' | 'adjustment'
  | 'motion-graphic' | 'multicam';

interface Clip {
  id: string;
  type: ClipType;
  start: number;          // 时间线上的起始时间（秒）
  duration: number;        // 显示时长（秒）
  trimStart: number;       // 源素材裁剪起始
  trimEnd: number;         // 源素材裁剪结束
  sourceId: string;        // 关联的媒体资源 ID
  transform: ClipTransform;
  effects: Effect[];
  keyframes: ClipKeyframes;
  opacity: number;
  volume: number;
  speed: number;
  // ... 更多属性
}
```

## 时间线操作

### 分割剪辑

在指定时间点将一个剪辑分割为两个。

```typescript
import { splitClip } from '@open-factory/editor-core';

const clip: Clip = { /* ... */ };
const splitTime = 5.0; // 在 5 秒处分割

const [leftClip, rightClip] = splitClip(clip, splitTime);

// leftClip:  从 clip.start 到 splitTime
// rightClip: 从 splitTime 到 clip.start + clip.duration
```

**注意事项：**
- `splitTime` 必须在剪辑的有效范围内（不含首尾边界）
- 分割会自动处理关键帧、效果和变换的复制
- 返回两个新的剪辑对象（不可变操作）

### 裁剪剪辑

调整剪辑的入点和出点。

```typescript
import { trimClip } from '@open-factory/editor-core';

const trimmedClip = trimClip(clip, newTrimStart, newTrimEnd);

// newTrimStart: 新的源素材起始裁剪量（秒）
// newTrimEnd: 新的源素材结束裁剪量（秒）
```

### 查找剪辑

```typescript
import { findClipAtTime, getActiveClipsAtTime } from '@open-factory/editor-core';

// 在指定轨道上查找某个时间点的剪辑
const clip = findClipAtTime(track, 3.5);

// 获取所有轨道上某个时间点的活跃剪辑
const activeClips = getActiveClipsAtTime(timeline, 3.5);
```

## 关键帧系统

### 关键帧数据结构

```typescript
type KeyframeEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'elastic' | 'bounce';

interface Keyframe<T> {
  id: string;
  time: number;      // 关键帧时间点（秒）
  value: T;          // 关键帧值
  easing: KeyframeEasing;
  inHandle?: { dx: number; dy: number };
  outHandle?: { dx: number; dy: number };
}

interface ClipKeyframes {
  opacity?: Keyframe<number>[];
  volume?: Keyframe<number>[];
  x?: Keyframe<number>[];
  y?: Keyframe<number>[];
  scaleX?: Keyframe<number>[];
  scaleY?: Keyframe<number>[];
  speed?: Keyframe<number>[];
  // ... 更多属性
}
```

### 关键帧操作

```typescript
import {
  addKeyframe,
  removeKeyframe,
  interpolateKeyframes,
} from '@open-factory/editor-core';

// 添加关键帧
const updatedKeyframes = addKeyframe(keyframes, 'opacity', {
  time: 2.0,
  value: 0.5,
  easing: 'ease-in-out',
});

// 在任意时间点插值计算当前值
const currentValue = interpolateKeyframes(keyframes.opacity, currentTime);
```

## 色彩管理

### 色彩管线

```typescript
import { ProjectColorPipeline } from '@open-factory/editor-core';

interface ProjectColorPipeline {
  workingSpace: ProjectWorkingColorSpace;
  inputTransforms: InputColorSpace[];
  outputTransform: string;
}
```

### 调色工具

```typescript
import {
  ColorGradingGraph,
  ColorCurves,
  ThreeWayColor,
} from '@open-factory/editor-core';

// 三向色彩校正
const colorCorrection: ThreeWayColor = {
  shadows: { hue: 200, saturation: 0.3 },
  midtones: { hue: 45, saturation: 0.1 },
  highlights: { hue: 60, saturation: 0.2 },
};
```

## 效果系统

### 内置效果类型

```typescript
import type { Effect } from '@open-factory/editor-core';

interface Effect {
  id: string;
  type: string;        // 效果类型标识
  enabled: boolean;
  parameters: Record<string, unknown>;
}
```

支持的效果类别：

| 类别 | 示例 |
|------|------|
| 色彩调整 | 亮度/对比度、色相/饱和度、曲线 |
| 模糊与锐化 | 高斯模糊、USM 锐化 |
| 变换 | 裁剪、翻转、旋转 |
| 音频 | 均衡器、压缩器、降噪 |
| 绿幕 | 色度键、亮度键、差值抠像 |

## 音频处理

### 波形与分析

```typescript
import {
  detectSilence,
  detectDialogue,
  generateWaveform,
} from '@open-factory/editor-core';

// 静音检测
const silenceRanges = await detectSilence(audioBuffer, {
  thresholdDb: -40,
  minDuration: 0.5,
});

// 对话检测
const dialogueSegments = await detectDialogue(audioBuffer);

// 波形生成
const waveform = await generateWaveform(audioBuffer, {
  samplesPerPixel: 256,
});
```

### 音频混音

```typescript
import type { MixerState } from '@open-factory/editor-core';

interface MixerState {
  tracks: {
    trackId: string;
    volume: number;
    pan: number;
    muted: boolean;
    solo: boolean;
    eq: TrackEQ;
    compressor: TrackCompressor;
  }[];
  masterVolume: number;
}
```

## AI 功能

### 场景检测

```typescript
import { detectScenes } from '@open-factory/editor-core';

const scenes = await detectScenes(videoPath, {
  threshold: 0.3,
  minSceneDuration: 1.0,
});

// scenes: Array<{ startTime: number; endTime: number; confidence: number }>
```

### 智能剪辑

```typescript
import { smartCut } from '@open-factory/editor-core';

const cuts = await smartCut(videoPath, {
  removeSilence: true,
  removeFillerWords: true,
  targetPacing: 'dynamic',
});
```

### AI 质量评估

```typescript
import { assessQuality } from '@open-factory/editor-core';

const report = await assessQuality(videoPath);
// {
//   overall: 85,
//   technical: { sharpness: 90, exposure: 80, ... },
//   content: { pacing: 85, engagement: 78, ... },
//   issues: [...]
// }
```

## 导出与渲染

### 导出设置

```typescript
import type { ExportSettings } from '@open-factory/editor-core';

const settings: ExportSettings = {
  outputPath: '/output/video.mp4',
  format: 'mp4',
  codec: 'h264',
  width: 1920,
  height: 1080,
  fps: 30,
  bitrate: 8_000_000,
  audioCodec: 'aac',
  audioBitrate: 192_000,
};
```

### 渲染管线

```typescript
import { RenderPipeline, ExportScheduler } from '@open-factory/render-farm';

const pipeline = new RenderPipeline({
  project,
  settings,
  progressCallback: (progress) => {
    console.log(`${progress.percent}% - ${progress.currentStage}`);
  },
});

await pipeline.start();
```

### 批量导出

```typescript
import { VersionedBatchExporter } from '@open-factory/editor-core';

const batch = new VersionedBatchExporter({
  presets: [
    { name: 'youtube', width: 1920, height: 1080, fps: 30 },
    { name: 'instagram', width: 1080, height: 1080, fps: 30 },
    { name: 'tiktok', width: 1080, height: 1920, fps: 30 },
  ],
});

await batch.exportAll(project);
```

## 协作编辑

```typescript
import {
  CollaborationManager,
  CollaborationPermissions,
} from '@open-factory/editor-core';

const manager = new CollaborationManager({
  projectId: 'project-123',
  userId: 'user-456',
  permissions: CollaborationPermissions.EDITOR,
});

// 监听远程变更
manager.onRemoteChange((change) => {
  console.log(`${change.userId} modified ${change.target}`);
});

// 发送本地变更
manager.sendChange({
  type: 'clip-update',
  clipId: 'clip-1',
  property: 'start',
  value: 5.0,
});
```
