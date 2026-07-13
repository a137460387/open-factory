# 智能多平台分发系统设计文档

**日期:** 2026-07-13
**作者:** 落小雨
**状态:** 已批准
**分支:** feat/smart-distribution

## 概述

为 open-factory 视频编辑器添加智能多平台分发能力，支持一次编辑多平台输出，自动裁剪和格式适配，解决内容创作者分发效率痛点。

## 现有基础设施分析

项目已具备成熟的导出系统，本设计以增量方式构建：

| 已有能力 | 文件 | 复用方式 |
|---------|------|---------|
| 6 个平台预设 | `export-presets.ts` | 扩展到 10+ 平台 |
| version-batch 批量导出 | `ExportDialog.tsx` | 升级为智能多平台模式 |
| 发布流水线 | `publish-pipeline.ts` | 集成定时调度 |
| Render Farm 并行渲染 | `render-farm.ts` | 复用多任务并行 |
| 资源感知调度 | `scheduling.ts` | 复用并发控制 |
| 导出预设推荐 | `export-preset-recommendations.ts` | 扩展推荐维度 |
| 导出队列管理 | `export-queue.ts` | 复用任务队列 |
| FFmpeg 命令构建 | `ffmpeg-builder.ts` | 集成裁剪滤镜 |

## 架构设计

### 层级结构

```
┌─────────────────────────────────────────────────┐
│  UI 层: SmartDistributionPanel                   │
│  - 平台卡片网格选择                                │
│  - 智能裁剪预览                                   │
│  - 批量导出进度监控                                │
│  - 发布计划调度                                   │
├─────────────────────────────────────────────────┤
│  Store 层: distributionStore.ts                   │
│  - 平台选择状态、裁剪参数、发布计划                   │
├─────────────────────────────────────────────────┤
│  Core 层 (packages/editor-core):                  │
│  ├── distribution/platform-presets.ts             │
│  ├── distribution/smart-crop.ts                   │
│  ├── distribution/batch-export.ts                 │
│  └── distribution/publish-scheduler.ts            │
├─────────────────────────────────────────────────┤
│  现有基础设施 (完全复用):                            │
│  ffmpeg-builder / export-queue / scheduling       │
│  render-farm / publish-pipeline / tauri-bridge    │
└─────────────────────────────────────────────────┘
```

### 模块 1: 平台预设系统

**文件:** `packages/editor-core/src/distribution/platform-presets.ts`

扩展 `ExportPlatformPreset` 类型，新增平台定义：

| 平台 | ID | 宽高比 | 分辨率 | FPS | 视频码率 | 音频码率 | 最大时长 |
|------|-----|--------|--------|-----|---------|---------|---------|
| YouTube | youtube-1080p | 16:9 | 1920×1080 | 30 | 8M | 192k | 无限制 |
| YouTube Shorts | youtube-shorts | 9:16 | 1080×1920 | 60 | 8M | 192k | 60s |
| TikTok | tiktok | 9:16 | 1080×1920 | 60 | 6M | 192k | 10min |
| Instagram Reels | instagram-reels | 9:16 | 1080×1920 | 30 | 3.5M | 128k | 90s |
| Instagram Feed | instagram-feed | 1:1 | 1080×1080 | 30 | 3.5M | 128k | 60s |
| Twitter/X | twitter-x | 16:9 | 1280×720 | 30 | 5M | 128k | 140s |
| Bilibili | bilibili | 16:9 | 1920×1080 | 60 | 10M | 192k | 无限制 |
| 微信视频号 | weixin-channels | 16:9 | 1920×1080 | 30 | 6M | 128k | 30min |
| 快手 | kuaishou | 9:16 | 1080×1920 | 30 | 6M | 128k | 10min |
| Pinterest | pinterest | 2:3 | 1000×1500 | 30 | 4M | 128k | 60s |

每个平台预设定义：
```typescript
interface DistributionPlatformSpec {
  id: ExportPlatformPreset;
  name: string;
  icon: string;           // emoji 或图标标识
  aspectRatio: string;    // '16:9' | '9:16' | '1:1' | '2:3'
  orientation: 'landscape' | 'portrait' | 'square';
  width: number;
  height: number;
  fps: number;
  videoBitrate: string;
  audioBitrate: string;
  videoCodec: string;
  audioCodec: string;
  format: string;
  maxDurationSecs?: number;
  loudnessTarget?: string;
  description: string;
}
```

### 模块 2: 智能裁剪算法

**文件:** `packages/editor-core/src/distribution/smart-crop.ts`

基于 FFmpeg 的无依赖裁剪策略：

1. **画面分析阶段** (通过 Tauri bridge 调用 FFmpeg)：
   - 使用 `cropdetect` 滤镜检测有效画面区域
   - 使用 `select='gt(scene,0.3)'` 检测场景切换点
   - 使用 `fps=1` 采样关键帧进行分析

2. **重心计算算法**：
   - 默认画面中心为 (0.5, 0.5)
   - 字幕安全区偏移：如果下方有字幕，重心上移
   - 运动区域加权：通过帧差分析运动主体位置
   - 安全边距：保留各平台的安全区域

3. **裁剪策略输出**：
```typescript
interface SmartCropResult {
  platformId: ExportPlatformPreset;
  sourceAspectRatio: string;
  targetAspectRatio: string;
  cropX: number;          // 归一化 0-1
  cropY: number;          // 归一化 0-1
  cropWidth: number;      // 归一化 0-1
  cropHeight: number;     // 归一化 0-1
  scaleFilter: string;    // FFmpeg scale 滤镜片段
  confidence: number;     // 0-1 置信度
  warnings: string[];
}
```

4. **FFmpeg 集成**：
   - 生成 `crop=w:h:x:y,scale=W:H` 滤镜片段
   - 通过 `reframeOffsetX`/`reframeOffsetY` 集成到现有 ExportSettings
   - 在 ffmpeg-builder.ts 的 filter_complex 链中注入裁剪节点

### 模块 3: 批量导出引擎

**文件:** `packages/editor-core/src/distribution/batch-export.ts`

```typescript
interface DistributionBatchRequest {
  project: Project;
  platforms: DistributionPlatformSpec[];
  cropResults?: Map<string, SmartCropResult>;
  outputDir: string;
  template: string;       // 输出文件名模板
  priority: ExportTaskPriority;
}

interface DistributionBatchResult {
  batchId: string;
  tasks: DistributionTask[];
  totalEstimatedTime: number;
  totalEstimatedSize: number;
}

interface DistributionTask {
  platformId: ExportPlatformPreset;
  platformName: string;
  settings: ExportSettings;
  estimatedDuration: number;
  estimatedFileSize: number;
}
```

核心流程：
1. 为每个平台构建独立的 `ExportSettings`
2. 应用智能裁剪结果到 `reframeOffsetX`/`reframeOffsetY`
3. 使用 `buildFfmpegExportPlan` 生成各平台的 FFmpeg 计划
4. 通过 `createExportTask` 批量入队到 export-queue
5. 利用 `startResourceAwareExportTaskSlots` 管理并发
6. 收集统一进度和完成状态

### 模块 4: 发布计划系统

**文件:** `packages/editor-core/src/distribution/publish-scheduler.ts`

```typescript
interface DistributionSchedule {
  id: string;
  batchId: string;
  platformId: ExportPlatformPreset;
  scheduledAt: string;        // ISO 8601
  status: 'pending' | 'ready' | 'publishing' | 'published' | 'failed';
  publishConfig?: ExportPublishPlatform;
  retryCount: number;
  maxRetries: number;
}
```

复用现有 `publish-pipeline.ts` 的 `isWithinPublishWindow` 和日志系统。

### 模块 5: UI 面板

**文件:** `apps/desktop/src/components/SmartDistribution/`

```
SmartDistribution/
├── SmartDistributionPanel.tsx    # 主面板
├── PlatformCard.tsx              # 平台选择卡片
├── CropPreview.tsx               # 裁剪预览
├── BatchProgressView.tsx         # 批量导出进度
├── ScheduleCalendar.tsx          # 发布日历
└── SmartDistributionPanel.test.tsx
```

嵌入方式：在 `ShellRightPanel.tsx` 的面板优先级链中添加，通过 `editorUIStore` 控制显示。

### 数据流

```
用户选择平台 → distributionStore.setPlatforms()
    ↓
智能裁剪分析 → smartCrop.analyzeProject()
    ↓
生成裁剪预览 → CropPreview 组件
    ↓
用户确认导出 → batchExport.createBatch()
    ↓
任务入队 → export-queue (多个 ExportTask)
    ↓
并行渲染 → scheduling.ts + render-farm.ts
    ↓
进度更新 → distributionStore.updateProgress()
    ↓
完成通知 → export-notification.ts
    ↓ (可选)
定时发布 → publishScheduler.schedule()
```

## 测试策略

### 单元测试 (Vitest)

- `platform-presets.test.ts`: 平台预设完整性验证
- `smart-crop.test.ts`: 裁剪算法精度测试
- `batch-export.test.ts`: 批量任务生成正确性
- `publish-scheduler.test.ts`: 调度逻辑测试

### E2E 测试 (Playwright)

- `smart-distribution.spec.ts`:
  - 多平台预设 → 断言生成正确格式
  - 智能裁剪 → 断言重要区域保留
  - 批量导出 → 断言并行处理正确
  - 定时发布 → 断言调度准确

## 文件清单

### 新增文件

| 文件路径 | 作用 |
|---------|------|
| `packages/editor-core/src/distribution/platform-presets.ts` | 平台预设定义和管理 |
| `packages/editor-core/src/distribution/smart-crop.ts` | 智能裁剪算法 |
| `packages/editor-core/src/distribution/batch-export.ts` | 批量导出编排 |
| `packages/editor-core/src/distribution/publish-scheduler.ts` | 发布计划调度 |
| `packages/editor-core/src/distribution/index.ts` | barrel export |
| `apps/desktop/src/components/SmartDistribution/SmartDistributionPanel.tsx` | 主面板 |
| `apps/desktop/src/components/SmartDistribution/PlatformCard.tsx` | 平台卡片 |
| `apps/desktop/src/components/SmartDistribution/CropPreview.tsx` | 裁剪预览 |
| `apps/desktop/src/components/SmartDistribution/BatchProgressView.tsx` | 批量进度 |
| `apps/desktop/src/store/distributionStore.ts` | Zustand store |
| `apps/desktop/src/distribution/distribution-service.ts` | 分发服务编排 |
| `packages/editor-core/__tests__/distribution/platform-presets.test.ts` | 平台预设单测 |
| `packages/editor-core/__tests__/distribution/smart-crop.test.ts` | 裁剪算法单测 |
| `packages/editor-core/__tests__/distribution/batch-export.test.ts` | 批量导出单测 |
| `packages/editor-core/__tests__/distribution/publish-scheduler.test.ts` | 发布调度单测 |
| `apps/desktop/e2e/smart-distribution.spec.ts` | E2E 测试 |

### 修改文件

| 文件路径 | 修改内容 |
|---------|---------|
| `packages/editor-core/src/export/export-types.ts` | 扩展 ExportPlatformPreset 类型 |
| `packages/editor-core/src/index.ts` | 添加 distribution 模块导出 |
| `apps/desktop/src/components/layout/ShellRightPanel.tsx` | 添加 SmartDistributionPanel |
| `apps/desktop/src/components/layout/ShellFloatingDialogs.tsx` | 添加分发对话框 |
| `apps/desktop/src/store/editorUIStore.ts` | 添加分发面板开关状态 |
