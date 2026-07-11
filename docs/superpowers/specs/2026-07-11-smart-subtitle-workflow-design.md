# 智能字幕全链路系统 — 设计文档

> 日期：2026-07-11
> 分支：`feat/smart-subtitle-workflow`
> 状态：设计阶段

## 1. 概述

### 1.1 目标

构建统一的智能字幕工作流面板（`AISubtitleWorkflowPanel`），将项目中已有的分散字幕功能串联为端到端工作流：**语音识别 → AI文本润色 → 智能样式推荐 → 多格式导出**，大幅提升对话密集型内容（采访、播客、教育视频）的字幕编辑效率。

### 1.2 设计原则

- **编排而非重写**：面板只负责 UI 和工作流编排，所有业务逻辑复用现有模块
- **最小侵入**：不修改现有数据模型、不新增 Tauri 命令、不修改导出流程
- **渐进式解锁**：每个阶段完成后自动解锁下一阶段，用户也可回顾已完成阶段
- **独立面板**：独立于 SmartRoughCutPanel，职责清晰

## 2. 架构

### 2.1 组件结构

```
apps/desktop/src/components/AISubtitleWorkflow/
├── AISubtitleWorkflowPanel.tsx   ← 主面板（Tab 容器 + 工作流编排）
├── ASRStage.tsx                  ← 语音识别阶段
├── PolishStage.tsx               ← AI文本润色阶段
├── StyleStage.tsx                ← 智能样式推荐阶段
├── ExportStage.tsx               ← 多格式导出阶段
├── useSubtitleWorkflow.ts        ← 工作流状态管理 hook
└── index.ts                      ← 导出入口
```

### 2.2 依赖关系

```
AISubtitleWorkflowPanel
  ├── 调用 → lib/whisper.ts (ASR)
  ├── 调用 → @open-factory/editor-core subtitles/srt.ts (序列化)
  ├── 调用 → @open-factory/editor-core ai-subtitle-style.ts (样式推荐)
  ├── 调用 → @open-factory/editor-core SubtitleAIPolishPanel 逻辑 (润色)
  ├── 调用 → export/export-queue-runner.ts (导出)
  └── 调用 → tauri-bridge.ts (runWhisper, callAiApi)
```

### 2.3 不修改的现有模块

| 模块 | 原因 |
|------|------|
| `model-types.ts` | SubtitleClip/Track 已满足需求 |
| `subtitles/srt.ts` | SRT/VTT/ASS 序列化已完备 |
| `export/ffmpeg-builder.ts` | 导出流程已完备 |
| `tauri-bridge.ts` | Whisper/AI API 接口已完备 |

## 3. 工作流状态管理

### 3.1 状态接口

```typescript
type WorkflowStage = 'asr' | 'polish' | 'style' | 'export'
type StageStatus = 'idle' | 'running' | 'done' | 'error'

interface SubtitleWorkflowState {
  currentStage: WorkflowStage

  asr: {
    status: StageStatus
    selectedClipId: string | null
    whisperReady: boolean
    generatedTrackId: string | null
    progress: number           // 0-100
    error: string | null
  }

  polish: {
    status: StageStatus
    selectedTrackId: string | null
    originalClips: SubtitleClip[]
    polishedClips: SubtitleClip[]
    acceptedChanges: boolean[]
    error: string | null
  }

  style: {
    status: StageStatus
    recommendedTemplateId: string | null
    appliedTemplateId: string | null
    confidence: number
    error: string | null
  }

  export: {
    status: StageStatus
    format: 'srt' | 'vtt' | 'ass'
    mode: 'burn-in' | 'soft-sub'
    outputPath: string | null
    error: string | null
  }
}
```

### 3.2 状态流转

```
┌─────┐     ┌───────┐     ┌──────┐     ┌────────┐
│ ASR │ ──→ │ 润色  │ ──→ │ 样式 │ ──→ │  导出  │
│done │     │ done  │     │ done │     │  done  │
└─────┘     └───────┘     └──────┘     └────────┘
```

- 每个阶段完成后，`currentStage` 自动前进到下一阶段
- 用户可点击已完成的阶段 Tab 回顾
- 任何阶段出错时，该阶段显示错误信息，不阻塞其他已完成阶段的访问

### 3.3 Hook 接口

```typescript
function useSubtitleWorkflow() {
  return {
    state: SubtitleWorkflowState
    // ASR
    runASR: (clipId: string) => Promise<void>
    checkWhisperAvailability: () => Promise<boolean>
    // 润色
    startPolish: (trackId: string) => Promise<void>
    acceptChange: (index: number) => void
    rejectChange: (index: number) => void
    acceptAllChanges: () => void
    applyPolish: () => void
    // 样式
    requestStyleRecommendation: () => Promise<void>
    applyStyle: (templateId: string) => void
    // 导出
    setExportFormat: (format: 'srt' | 'vtt' | 'ass') => void
    setExportMode: (mode: 'burn-in' | 'soft-sub') => void
    startExport: () => Promise<void>
    // 导航
    goToStage: (stage: WorkflowStage) => void
    reset: () => void
  }
}
```

## 4. 各阶段详细设计

### 4.1 阶段 1：语音识别 (ASR)

**复用模块**：
- `apps/desktop/src/lib/whisper.ts` — `buildWhisperSubtitleTrackForClip()`, `getWhisperAvailability()`, `canGenerateSubtitlesForClip()`
- `apps/desktop/src/store/whisperSettingsStore.ts` — Whisper 配置

**UI 组件**：
- 片段选择器：显示当前选中 clip 的名称和时长
- Whisper 状态指示器：✅ 可用 / ❌ 未配置（显示配置引导）
- "开始识别" 按钮
- 进度条 + 状态文本（"正在识别... 45%"）
- 结果预览：显示前 5 条识别出的字幕文本

**流程**：
1. 从 `useEditorStore` 获取当前选中的 clip
2. 调用 `getWhisperAvailability()` 检测 Whisper 可用性
3. 用户点击"开始识别"
4. 调用 `buildWhisperSubtitleTrackForClip(clip, asset, timeline, whisperSettings)`
5. 完成后将生成的 trackId 存入状态，自动切换到"润色"阶段

### 4.2 阶段 2：AI 文本润色

**复用模块**：
- `@open-factory/editor-core` — `calculateSubtitlePolishBatchSplit`, `parseSubtitlePolishResponse`, `removeFillerWords`
- `apps/desktop/src/store/aiSettingsStore.ts` — AI 提供商配置
- `apps/desktop/src/lib/tauri-bridge.ts` — `callAiApi`, `readAiApiKey`

**UI 组件**：
- 轨道选择器：列出所有字幕轨道（自动选中 ASR 阶段生成的轨道）
- 润色选项复选框：错字修正、标点优化、去除填充词
- "AI润色" 按钮
- 对比视图：左侧原始文本，右侧润色后文本，每行带 ✅/❌ 按钮
- "全部接受" / "全部拒绝" 快捷按钮
- "应用修改" 按钮

**流程**：
1. 选择字幕轨道（从 ASR 阶段自动传递 `generatedTrackId`）
2. 用户点击"AI润色"
3. 分批发送字幕文本到 LLM（每批最多 50 条）
4. 解析响应，显示对比视图
5. 用户逐条确认/拒绝
6. 点击"应用修改" → 使用 `BatchUpdateSubtitleTextCommand` 更新字幕

### 4.3 阶段 3：智能样式推荐

**复用模块**：
- `@open-factory/editor-core` — `buildSubtitleStyleVideoContext()`, `parseSubtitleStyleResponse()`, `BUILTIN_SUBTITLE_STYLE_TEMPLATES`
- `@open-factory/editor-core` — `renderSubtitleStyleTemplatePreview()`, `applyStyleTemplateBatch()`
- `apps/desktop/src/lib/subtitleStyleTemplates.ts` — 自定义模板管理

**UI 组件**：
- 推荐列表：卡片式布局，每个卡片显示模板名 + SVG 预览 + 置信度 + 推荐原因
- "应用样式" 按钮（点击卡片后激活）
- "跳过" 按钮（直接进入导出阶段）

**流程**：
1. 自动分析视频上下文（分辨率、方向、内容标签）
2. 调用 `callAiApi` 发送样式推荐请求
3. 解析响应，渲染推荐列表
4. 用户选择模板 → 调用 `applyStyleTemplateBatch()` 应用到所有字幕
5. 自动切换到"导出"阶段

### 4.4 阶段 4：多格式导出

**复用模块**：
- `@open-factory/editor-core` — `serializeSubtitleClipsToSrt()`, `serializeSubtitleClipsToVtt()`, `serializeSubtitleClipsToAss()`
- `apps/desktop/src/export/export-queue-runner.ts` — `enqueueExport()`
- `apps/desktop/src/lib/tauri-bridge.ts` — 文件对话框

**UI 组件**：
- 格式选择器：SRT / VTT / ASS 单选按钮组
- 模式选择器：burn-in（烧录到视频）/ soft-sub（外挂字幕文件）单选按钮组
- "导出字幕" 按钮
- 导出状态显示：进度、成功/失败
- 输出路径显示 + "打开文件夹" 按钮

**流程**：
1. 用户选择格式和模式
2. 点击"导出字幕"
3. 如果是 soft-sub 模式：
   - 调用对应序列化函数生成字幕文件内容
   - 通过文件对话框选择保存路径
   - 写入文件
4. 如果是 burn-in 模式：
   - 调用 `enqueueExport()` 将任务加入导出队列
   - 导出系统会自动处理字幕烧录
5. 显示导出结果

## 5. 面板注册

### 5.1 入口位置

在 AI 面板列表中注册，与现有 AI 面板（AI粗剪、AI解说等）并列。

注册位置：
- `apps/desktop/src/components/EditorShell.tsx` — 添加 lazy import
- `apps/desktop/src/components/layout/ShellRightPanel.tsx` — 添加渲染入口

参考 `SmartRoughCutPanel` 的注册方式：
```typescript
// EditorShell.tsx
const AISubtitleWorkflowPanel = lazy(() =>
  import('./AISubtitleWorkflow/AISubtitleWorkflowPanel')
    .then((module) => ({ default: module.AISubtitleWorkflowPanel }))
);

// ShellRightPanel.tsx
const AISubtitleWorkflowPanel = lazy(() =>
  import('../AISubtitleWorkflow/AISubtitleWorkflowPanel')
    .then((m) => ({ default: m.AISubtitleWorkflowPanel }))
);
```

### 5.2 国际化

在 `apps/desktop/src/i18n/strings.ts` 中添加：
```typescript
aiSubtitleWorkflow: {
  title: '智能字幕工作流',
  stages: {
    asr: '语音识别',
    polish: 'AI润色',
    style: '样式推荐',
    export: '导出'
  },
  // ... 各阶段的 UI 文本
}
```

## 6. 测试策略

### 6.1 E2E 测试

文件：`apps/desktop/e2e/smart-subtitles.spec.ts`

测试用例：
1. **ASR 阶段**：模拟 Whisper 可用 → 选择片段 → 运行 ASR → 验证字幕轨道生成
2. **润色阶段**：模拟 AI 响应 → 对比视图显示 → 接受修改 → 验证字幕文本更新
3. **样式阶段**：模拟 AI 推荐 → 选择模板 → 验证样式应用
4. **导出阶段**：选择 SRT 格式 → 导出 → 验证文件内容格式正确
5. **端到端**：完成全部 4 个阶段 → 验证最终字幕状态

遵循 `STABILITY_CHECKLIST.md` 规范。

### 6.2 单元测试

- `useSubtitleWorkflow` hook 的状态流转逻辑
- 各阶段的错误处理

## 7. 文件清单

### 7.1 新增文件

| 文件 | 作用 |
|------|------|
| `apps/desktop/src/components/AISubtitleWorkflow/AISubtitleWorkflowPanel.tsx` | 主面板组件 |
| `apps/desktop/src/components/AISubtitleWorkflow/ASRStage.tsx` | 语音识别阶段 |
| `apps/desktop/src/components/AISubtitleWorkflow/PolishStage.tsx` | AI润色阶段 |
| `apps/desktop/src/components/AISubtitleWorkflow/StyleStage.tsx` | 样式推荐阶段 |
| `apps/desktop/src/components/AISubtitleWorkflow/ExportStage.tsx` | 导出阶段 |
| `apps/desktop/src/components/AISubtitleWorkflow/useSubtitleWorkflow.ts` | 工作流状态 hook |
| `apps/desktop/src/components/AISubtitleWorkflow/index.ts` | 导出入口 |
| `apps/desktop/e2e/smart-subtitles.spec.ts` | E2E 测试 |

### 7.2 小幅修改的文件

| 文件 | 修改内容 |
|------|---------|
| `apps/desktop/src/components/EditorShell.tsx` | 添加 AISubtitleWorkflowPanel 的 lazy import |
| `apps/desktop/src/components/layout/ShellRightPanel.tsx` | 添加面板渲染入口 |
| `apps/desktop/src/i18n/strings.ts` | 添加 `aiSubtitleWorkflow` 国际化文本 |

## 8. 不在范围内

以下功能不在本次实现范围内（可作为后续迭代）：

- ❌ 多 ASR 引擎适配器（Vosk、API Whisper 等）— 当前只使用本地 Whisper
- ❌ 字幕翻译集成 — 已有 `subtitles/translation.ts`，后续可加入工作流
- ❌ 批量处理多个片段 — 当前只处理单个选中片段
- ❌ 字幕编辑器内联编辑 — 当前只做润色，不做自由编辑
