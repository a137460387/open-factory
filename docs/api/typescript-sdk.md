# Open Factory TypeScript SDK Reference

## 安装

```bash
npm install @open-factory/editor-core
```

## 无头模块导入

```typescript
import {
  HeadlessEditorCore,
  headlessRender,
  headlessAnalyze,
  applyTemplate,
  detectScenes,
  assessQuality,
  analyzeContent,
} from '@open-factory/editor-core/headless';
```

---

## HeadlessEditorCore

无头编辑器核心，不依赖 DOM 环境。

### 构造函数

```typescript
new HeadlessEditorCore(config?: Partial<HeadlessConfig>)
```

**HeadlessConfig:**

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `ffmpegPath` | `string` | `'ffmpeg'` | FFmpeg 二进制路径 |
| `tempDir` | `string` | `'/tmp/open-factory'` | 临时文件目录 |
| `concurrency` | `number` | `4` | 最大并发渲染线程 |
| `logLevel` | `LogLevel` | `'info'` | 日志级别 |
| `aiProvider` | `'cpu' \| 'cuda' \| 'auto'` | `'auto'` | AI 推理提供者 |

### 方法

#### `getConfig(): HeadlessConfig`
返回当前配置的只读副本。

#### `loadProject(projectPath: string): Promise<ProjectFile>`
从磁盘加载项目文件并解析。

#### `isValidProjectFile(data: unknown): data is ProjectFile`
验证项目文件结构是否合法（支持 V1/V2 格式）。

#### `extractTimeline(projectFile: ProjectFile): Timeline`
从项目文件中提取主时间线。

#### `extractAssets(projectFile: ProjectFile): MediaAsset[]`
从项目文件中提取媒体资产列表。

#### `getTimelineDuration(projectFile: ProjectFile): number`
获取时间线播放时长（秒）。

#### `getRenderableTrackCount(projectFile: ProjectFile): number`
获取可渲染轨道数量。

#### `buildRenderArgs(projectFile, outputPath, settings?, range?): Promise<string[]>`
构建 FFmpeg 渲染命令参数。

#### `checkFfmpeg(): Promise<{ available: boolean; version?: string; error?: string }>`
检查 FFmpeg 是否可用。

---

## headlessRender

渲染项目文件为视频。

```typescript
const result = await headlessRender({
  projectPath: './project.ofp',
  outputPath: './output.mp4',
  settings: {
    width: 1920,
    height: 1080,
    fps: 30,
    videoBitrate: '8M',
    audioBitrate: '192k',
  },
  range: [10, 30], // 可选：渲染范围（秒）
  onProgress: (progress) => {
    console.log(`${progress.phase}: ${progress.percent}%`);
  },
});
```

**HeadlessRenderRequest:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `projectPath` | `string` | 是 | 项目文件路径 |
| `outputPath` | `string` | 是 | 输出视频路径 |
| `settings` | `Partial<HeadlessExportSettings>` | 否 | 导出设置覆盖 |
| `range` | `[number, number]` | 否 | 渲染范围 [开始, 结束] |
| `onProgress` | `(p: HeadlessProgress) => void` | 否 | 进度回调 |

**HeadlessRenderResult:**

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | `boolean` | 是否成功 |
| `outputPath` | `string` | 输出文件路径 |
| `duration` | `number` | 渲染耗时（秒） |
| `fileSize` | `number` | 输出文件大小（字节） |
| `warnings` | `string[]` | 警告列表 |
| `error` | `string?` | 错误信息 |

---

## headlessAnalyze

分析视频内容。

```typescript
const result = await headlessAnalyze({
  inputPath: './video.mp4',
  type: 'quality', // 'quality' | 'semantic' | 'compliance' | 'full'
  format: 'json',
  onProgress: (progress) => {
    console.log(`${progress.phase}: ${progress.percent}%`);
  },
});
```

**分析类型:**

| 类型 | 说明 | 返回类型 |
|------|------|----------|
| `quality` | 技术质量评估 | `QualityReport` |
| `semantic` | 场景检测与语义分析 | `SemanticReport` |
| `compliance` | 平台合规检查 | `ComplianceReport` |
| `full` | 以上全部 | `FullReport` |

**QualityReport 字段:**

| 字段 | 类型 | 说明 |
|------|------|------|
| `resolution` | `{ width, height }` | 分辨率 |
| `frameRate` | `number` | 帧率 |
| `bitrate` | `number` | 比特率 |
| `codec` | `string` | 视频编码 |
| `loudness` | `{ integrated, truePeak, range }` | 响度指标 |
| `issues` | `QualityIssue[]` | 问题列表 |
| `score` | `number` | 质量评分（0-100） |

---

## applyTemplate

将模板应用于素材文件。

```typescript
const result = await applyTemplate({
  templatePath: './template.json',
  mediaFiles: ['./media1.mp4', './media2.mp4'],
  outputProjectPath: './output-project.json',
  render: true,
  renderOutputPath: './output.mp4',
});
```

---

## AI 推理接口

### detectScenes

启发式场景检测。

```typescript
const result = await detectScenes({
  frames: [
    { timestamp: 0, data: frameBuffer1 },
    { timestamp: 1, data: frameBuffer2 },
  ],
  threshold: 0.3,
});
// result.provider: 'heuristic' | 'onnx-cpu' | 'onnx-cuda'
// result.result.scenes: SceneDetectionOutput
```

### assessQuality

技术质量评估。

```typescript
const result = await assessQuality({
  width: 1920,
  height: 1080,
  bitrate: 8_000_000,
  frameRate: 30,
  loudnessIntegrated: -16,
  loudnessTruePeak: -3,
  codec: 'h264',
});
// result.result.score: number (0-100)
// result.result.issues: QualityIssue[]
```

### analyzeContent

内容分析。

```typescript
const result = await analyzeContent({
  frames: [{ timestamp: 0, data: frameBuffer }],
  audioFeatures: { rms: 0.5, zeroCrossingRate: 0.3, spectralCentroid: 0.4 },
});
// result.result.mood: 'neutral' | 'energetic' | 'calm'
// result.result.motionLevel: 'static' | 'low' | 'medium' | 'high'
// result.result.tags: string[]
```

### detectAvailableProviders

检测可用的推理提供者。

```typescript
const providers = await detectAvailableProviders();
// ['onnx-cuda', 'onnx-cpu', 'heuristic'] 或子集
```

---

## 类型定义

所有类型均可从 `@open-factory/editor-core/headless` 导出：

```typescript
export type {
  HeadlessConfig,
  HeadlessExportSettings,
  HeadlessRenderRequest,
  HeadlessRenderResult,
  HeadlessProgress,
  HeadlessAnalyzeRequest,
  HeadlessAnalyzeResult,
  QualityReport,
  QualityIssue,
  SemanticReport,
  SceneInfo,
  ComplianceReport,
  ComplianceCheck,
  FullReport,
  TemplateApplyRequest,
  TemplateApplyResult,
  TemplateDefinition,
  MediaSlot,
  InferenceProvider,
  InferenceConfig,
  InferenceResult,
  SceneDetectionInput,
  SceneDetectionOutput,
  QualityAssessmentInput,
  QualityAssessmentOutput,
  ContentAnalysisInput,
  ContentAnalysisOutput,
  OnnxSession,
};
```
