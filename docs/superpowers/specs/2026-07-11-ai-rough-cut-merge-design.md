# AI 粗剪自动化 — 合并 AI Rough Cut 与 Smart Rough Cut

## 概述

在现有 AI Rough Cut 面板中新增"算法模式"，将 Smart Rough Cut 的算法能力整合为第三种输入模式，形成统一的粗剪入口。

## 架构设计

### 统一入口 + 模式切换

```
┌─────────────────────────────────────────────────────┐
│              AIRoughCutPanel (统一入口)                │
│  ┌───────────┬───────────┬───────────────┐          │
│  │ 文字描述   │ 模板选择   │  ⭐ 算法模式    │          │
│  │ (现有)     │ (现有)     │  (新增)        │          │
│  └───────────┴───────────┴───────────────┘          │
│                       │                              │
│  ┌────────────────────▼──────────────────────┐      │
│  │         故事板预览 (共享)                    │      │
│  └────────────────────┬──────────────────────┘      │
│                       │                              │
│  ┌────────────────────▼──────────────────────┐      │
│  │     确认插入时间线 (BatchAddClipsCommand)    │      │
│  └───────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   LLM Pipeline    Algorithm      Shared
   (现有逻辑)       Pipeline       Storyboard
                     (新增)         Preview
```

### 数据流

```
MediaAsset[] → AlgorithmPipeline → AIRoughCutClip[] → 故事板预览 → BatchAddClipsCommand
```

### 四种算法能力

| 算法 | 输入 | 输出 | 复用来源 |
|------|------|------|----------|
| 高光片段选择 | MediaAsset[] | Top-N 评分最高片段 | highlight-reel.ts 评分逻辑 |
| 场景检测驱动 | MediaAsset[] | 按场景分组排列 | aiAnalysis.scene |
| 静音剔除 | MediaAsset[] | 非静音区间片段 | silence-detection.ts |
| 对话驱动剪辑 | MediaAsset[] | 按语音区间切分 | dialogue-detection.ts |

## 新增/修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/editor-core/src/algorithm-pipeline.ts` | 新增 | 算法流水线核心逻辑 |
| `packages/editor-core/__tests__/algorithm-pipeline.test.ts` | 新增 | 单元测试 |
| `packages/editor-core/src/index.ts` | 修改 | 导出新模块 |
| `apps/desktop/src/components/AIRoughCut/AIRoughCutPanel.tsx` | 修改 | 新增算法模式 UI |
| `apps/desktop/src/i18n/strings.ts` | 修改 | 新增 i18n 字符串 |
| `apps/desktop/e2e/ai-rough-cut.spec.ts` | 修改 | 新增算法模式 E2E 测试 |
| `apps/desktop/src/e2e/install-mocks.ts` | 修改 | 新增算法模式 mock fixture |

## 算法详细设计

### 高光片段选择 `selectHighlightClips()`

评分逻辑：
- aiAnalysis.mood 为积极情绪 → +30 分
- aiAnalysis.tags 丰富（>3 个）→ +20 分
- qualityAssessment.overallScore → 0-50 分
- 时长适中（5-60s）→ +10 分

### 场景检测驱动 `assembleBySceneOrder()`

按 aiAnalysis.scene 分组，按叙事顺序排列。

### 静音剔除 `filterSilentFromMedia()`

对媒体音频进行静音检测，提取非静音区间。

### 对话驱动剪辑 `assembleByDialogue()`

对媒体音频进行语音活动检测，按对话区间切分。

## 测试策略

- 单元测试：空数据、正常数据、边界数据、多算法组合
- E2E 测试：mock 媒体 → 算法模式 → 生成 → 确认 → 验证时间线
