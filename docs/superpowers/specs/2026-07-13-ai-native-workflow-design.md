# AI原生工作流架构设计

**日期**: 2026-07-13
**版本**: v1.0
**状态**: 已批准

---

## 1. 背景与目标

open-factory 已具备完整的视频编辑功能和25+独立AI模块。本设计旨在深化AI能力，从辅助工具进化为AI原生创作平台，实现：

- **预测性编辑**：智能推荐最佳片段、自动生成故事线
- **智能内容感知**：场景检测、情绪分析、语音理解
- **创作效率提升**：一键应用AI建议到时间线

## 2. 设计原则

1. **复用优先**：最大化利用现有AI模块（ai-emotion-tone、ai-beat-snap、content-analysis等）
2. **纯函数核心**：所有算法模块保持纯函数，无副作用
3. **命令模式**：所有时间线变更通过Command对象
4. **异步处理**：分析任务异步执行，不阻塞UI
5. **可组合性**：分析器可独立使用，也可通过编排器组合

## 3. 架构概览

```
┌─────────────────────────────────────────────────────────┐
│                    AI 原生工作流                          │
├─────────────────────────────────────────────────────────┤
│  智能创作编排器 (SmartCreationOrchestrator)                │
│  ├── 分析阶段协调                                         │
│  ├── 结果聚合与可视化                                     │
│  └── 一键应用到时间线                                     │
├─────────────────────────────────────────────────────────┤
│  AI 分析引擎层                                           │
│  ├── 场景检测器 (SceneDetector) - 新增                    │
│  │   ├── 颜色直方图差异分析                               │
│  │   └── 运动向量估计                                    │
│  ├── 情绪分析器 (EmotionAnalyzer) - 增强                  │
│  │   ├── 音频能量分析 (复用 ai-emotion-tone.ts)           │
│  │   └── 视觉特征情绪映射                                │
│  ├── 语音理解器 (SpeechUnderstanding) - 新增              │
│  │   ├── 关键词提取 (集成 Whisper ASR)                    │
│  │   └── 主题聚类                                       │
│  └── 叙事分析器 (NarrativeAnalyzer) - 新增                │
│      ├── 故事结构识别                                    │
│      └── 叙事弧生成                                      │
├─────────────────────────────────────────────────────────┤
│  预测性编辑层                                            │
│  ├── 智能推荐器 (SmartRecommender) - 新增                 │
│  │   ├── 基于内容相似度的片段推荐                          │
│  │   └── 情感连贯性评分                                   │
│  ├── 叙事生成器 (NarrativeGenerator) - 新增               │
│  │   ├── 故事线模板引擎                                   │
│  │   └── 场景序列优化                                     │
│  └── 节奏分析器 (RhythmAnalyzer) - 增强                   │
│      ├── 音频节拍检测 (复用 ai-beat-snap.ts)              │
│      └── 剪辑点自动建议                                   │
└─────────────────────────────────────────────────────────┘
```

## 4. 模块详细设计

### 4.1 场景检测器 (ai-scene-detector.ts)

**职责**：基于视觉特征自动分割视频场景

**算法**：
- 颜色直方图差异：计算相邻帧的HSV直方图差异，超过阈值判定为场景切换
- 运动向量估计：通过帧差法估算运动强度
- 自适应阈值：根据视频内容动态调整检测灵敏度

**接口**：
```typescript
interface SceneDetectionResult {
  scenes: SceneBoundary[];
  confidence: number;
}

interface SceneBoundary {
  startTime: number;
  endTime: number;
  sceneType: ContentSceneType;
  avgBrightness: number;
  avgMotion: number;
  dominantColors: string[];
}

function detectScenes(
  visualSamples: ContentAnalysisVisualSample[],
  options?: SceneDetectionOptions
): SceneDetectionResult;
```

### 4.2 情绪分析器 (ai-emotion-analyzer.ts)

**职责**：通过音频和视觉特征分析情绪强度曲线

**算法**：
- 音频能量分析：复用ai-emotion-tone.ts的音频情绪分析
- 视觉情绪映射：基于亮度、饱和度、运动强度映射到情绪值
- 多模态融合：加权融合音频和视觉情绪

**接口**：
```typescript
interface EmotionAnalysisResult {
  curve: EmotionPoint[];
  peaks: EmotionPeak[];
  overallMood: string;
  emotionalArc: 'rising' | 'falling' | 'stable' | 'peak' | 'valley';
}

interface EmotionPoint {
  time: number;
  value: number;        // -1 到 1，负面到正面
  arousal: number;      // 0 到 1，平静到激动
  source: 'audio' | 'visual' | 'fused';
}

interface EmotionPeak {
  time: number;
  value: number;
  type: 'positive' | 'negative' | 'neutral';
}

function analyzeEmotion(
  clip: Clip,
  visualSamples: ContentAnalysisVisualSample[],
  audioSamples?: ContentAnalysisAudioSample[]
): EmotionAnalysisResult;
```

### 4.3 语音理解器 (ai-speech-understanding.ts)

**职责**：集成现有ASR，提取关键词和主题

**算法**：
- 关键词提取：基于TF-IDF的关键词提取
- 主题聚类：基于语义相似度的主题分组
- 叙事标记：识别叙事结构标记（开场、高潮、结尾）

**接口**：
```typescript
interface SpeechUnderstandingResult {
  keywords: Keyword[];
  topics: Topic[];
  narrativeMarkers: NarrativeMarker[];
  summary: string;
}

interface Keyword {
  word: string;
  score: number;
  frequency: number;
}

interface Topic {
  name: string;
  keywords: string[];
  relevance: number;
  timeRange: { start: number; end: number };
}

interface NarrativeMarker {
  time: number;
  type: 'opening' | 'rising' | 'climax' | 'falling' | 'ending';
  confidence: number;
  description: string;
}

function understandSpeech(
  transcript: string,
  timeAlignment?: { start: number; end: number }[]
): SpeechUnderstandingResult;
```

### 4.4 叙事分析器 (ai-narrative-analyzer.ts)

**职责**：识别故事结构、生成叙事弧

**算法**：
- 故事结构识别：基于场景序列和情绪曲线识别三幕结构
- 叙事弧生成：生成可视化叙事弧
- 结构评分：评估叙事完整性

**接口**：
```typescript
interface NarrativeAnalysisResult {
  structure: NarrativeStructure;
  arc: NarrativeArc;
  score: number;  // 0-100，叙事完整性评分
  suggestions: NarrativeSuggestion[];
}

interface NarrativeStructure {
  hasOpening: boolean;
  hasRisingAction: boolean;
  hasClimax: boolean;
  hasFallingAction: boolean;
  hasResolution: boolean;
  acts: NarrativeAct[];
}

interface NarrativeArc {
  points: ArcPoint[];
  peakTime: number;
  peakIntensity: number;
}

interface NarrativeSuggestion {
  type: 'missing_act' | 'weak_transition' | 'pacing_issue';
  description: string;
  suggestedAction: string;
  timeRange?: { start: number; end: number };
}

function analyzeNarrative(
  scenes: SceneBoundary[],
  emotionCurve: EmotionPoint[],
  speechUnderstanding?: SpeechUnderstandingResult
): NarrativeAnalysisResult;
```

### 4.5 智能推荐器 (ai-smart-recommender.ts)

**职责**：基于内容相关性和情感连贯性推荐最佳片段

**算法**：
- 内容相似度：基于场景类型、视觉特征、关键词的相似度计算
- 情感连贯性：确保推荐片段的情感与当前上下文连贯
- 多样性平衡：避免推荐过于相似的片段

**接口**：
```typescript
interface RecommendationResult {
  recommendations: RecommendedClip[];
  reasoning: string;
}

interface RecommendedClip {
  clipId: string;
  score: number;
  relevanceScore: number;
  emotionalFitScore: number;
  diversityScore: number;
  reason: string;
  suggestedPosition?: number;
}

function recommendClips(
  context: {
    currentClips: Clip[];
    targetEmotion?: number;
    targetSceneType?: ContentSceneType;
    narrativePhase?: string;
  },
  availableClips: Clip[],
  options?: { maxRecommendations?: number }
): RecommendationResult;
```

### 4.6 叙事生成器 (ai-narrative-generator.ts)

**职责**：根据视频内容自动生成故事线建议

**算法**：
- 故事线模板引擎：内置多种叙事模板（纪录片、Vlog、教程等）
- 场景序列优化：基于情绪曲线和节奏优化场景排列
- 个性化调整：根据用户偏好调整生成策略

**接口**：
```typescript
interface NarrativeGenerationResult {
  storyline: StorylineSegment[];
  totalDuration: number;
  pacing: 'slow' | 'moderate' | 'fast';
  template: string;
}

interface StorylineSegment {
  id: string;
  sceneType: ContentSceneType;
  purpose: string;
  suggestedClips: string[];
  duration: number;
  emotionTarget: number;
  transitionType: string;
}

function generateNarrative(
  analysisResults: {
    scenes: SceneBoundary[];
    emotions: EmotionAnalysisResult;
    speech?: SpeechUnderstandingResult;
  },
  options?: {
    template?: 'documentary' | 'vlog' | 'tutorial' | 'cinematic';
    targetDuration?: number;
    pacing?: 'slow' | 'moderate' | 'fast';
  }
): NarrativeGenerationResult;
```

### 4.7 智能创作编排器 (ai-smart-creation-orchestrator.ts)

**职责**：协调各分析模块，提供统一的分析和应用接口

**流程**：
1. 接收媒体素材
2. 并行执行场景检测、情绪分析、语音理解
3. 聚合结果，执行叙事分析
4. 生成推荐和故事线
5. 提供一键应用接口

**接口**：
```typescript
interface SmartCreationResult {
  scenes: SceneDetectionResult;
  emotions: EmotionAnalysisResult;
  speech?: SpeechUnderstandingResult;
  narrative: NarrativeAnalysisResult;
  recommendations: RecommendationResult;
  storyline?: NarrativeGenerationResult;
}

interface SmartCreationProgress {
  phase: 'scene_detection' | 'emotion_analysis' | 'speech_understanding' | 'narrative_analysis' | 'recommendation' | 'storyline';
  progress: number;  // 0-100
  message: string;
}

async function orchestrateSmartCreation(
  media: MediaAsset[],
  options?: {
    enableSpeechUnderstanding?: boolean;
    narrativeTemplate?: string;
    targetDuration?: number;
    onProgress?: (progress: SmartCreationProgress) => void;
  }
): Promise<SmartCreationResult>;
```

## 5. UI集成设计

### 5.1 智能创作面板 (SmartCreationPanel.tsx)

**功能**：
- 启动智能创作分析
- 显示分析进度
- 展示结果：情绪曲线、场景缩略图、推荐片段、叙事结构
- 一键应用功能

**布局**：
```
┌─────────────────────────────────────────────┐
│  智能创作                           [开始分析] │
├─────────────────────────────────────────────┤
│  [情绪曲线图表]                              │
│  ─────────────────────────────────────────── │
│  [场景时间线缩略图]                           │
│  ─────────────────────────────────────────── │
│  推荐片段:                                   │
│  [片段1] [片段2] [片段3]                      │
│  ─────────────────────────────────────────── │
│  叙事结构:                                   │
│  [开场] → [发展] → [高潮] → [结尾]            │
│  ─────────────────────────────────────────── │
│  [应用推荐]  [生成故事线]  [导出报告]          │
└─────────────────────────────────────────────┘
```

### 5.2 可视化组件

- **EmotionCurveChart.tsx**：情绪曲线图表（基于现有Waveform可视化模式）
- **SceneTimeline.tsx**：场景时间线缩略图（复用TimelineThumbnails模式）
- **RecommendationList.tsx**：推荐片段列表（虚拟化列表）
- **NarrativeTimeline.tsx**：叙事结构时间线（可视化叙事弧）

## 6. 状态管理

在现有Zustand store基础上新增：

```typescript
// apps/desktop/src/store/smartCreationStore.ts
interface SmartCreationState {
  // 分析状态
  isAnalyzing: boolean;
  progress: SmartCreationProgress | null;
  result: SmartCreationResult | null;

  // UI状态
  selectedRecommendations: string[];
  activeNarrativeTemplate: string;

  // 操作
  startAnalysis: (media: MediaAsset[]) => Promise<void>;
  applyRecommendations: (clipIds: string[]) => void;
  applyStoryline: (storyline: NarrativeGenerationResult) => void;
  clearResults: () => void;
}
```

## 7. 测试策略

### 7.1 单元测试

- 场景检测算法测试
- 情绪分析融合测试
- 推荐算法测试
- 叙事生成测试

### 7.2 E2E测试

- 完整工作流：导入素材 → 运行分析 → 查看结果 → 应用推荐
- 边界情况：空素材、单个片段、大量素材
- 错误处理：分析失败、网络错误

## 8. 实现优先级

1. **P0 - 核心分析**：场景检测、情绪分析、编排器
2. **P1 - 预测性编辑**：智能推荐、叙事生成
3. **P2 - UI集成**：面板、可视化、一键应用
4. **P3 - 增强功能**：语音理解、高级叙事模板

## 9. 依赖关系

- 复用：`content-analysis.ts`、`ai-emotion-tone.ts`、`ai-beat-snap.ts`
- 新增：`ai-scene-detector.ts`、`ai-narrative-analyzer.ts`、`ai-smart-creation-orchestrator.ts`
- UI：Radix UI、Tailwind CSS、Zustand
- 测试：Vitest、Playwright

---

**设计完成，已批准进入实现阶段。**
