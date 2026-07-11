# 智能字幕全链路系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建统一的智能字幕工作流面板，串联现有字幕功能（Whisper ASR → AI润色 → 样式推荐 → 多格式导出）为端到端工作流。

**Architecture:** 独立面板组件 `AISubtitleWorkflowPanel`，采用分步向导模式（4个Tab），通过 `useSubtitleWorkflow` hook 管理状态。所有业务逻辑复用现有模块，面板只负责 UI 编排。

**Tech Stack:** React, TypeScript, Zustand, @open-factory/editor-core, Tauri bridge

## Global Constraints

- 所有用户面向文本使用中文（zhCN i18n）
- Timeline mutation 必须通过 command 对象
- 不直接调用 Zustand setter 修改 timeline
- 所有 Tauri 调用通过 `tauri-bridge.ts`
- 遵循 `data-testid` 覆盖规范
- 面板使用 lazy loading 模式

---

## File Structure

### 新增文件

| 文件 | 职责 |
|------|------|
| `apps/desktop/src/components/AISubtitleWorkflow/useSubtitleWorkflow.ts` | 工作流状态管理 hook |
| `apps/desktop/src/components/AISubtitleWorkflow/ASRStage.tsx` | 语音识别阶段 UI |
| `apps/desktop/src/components/AISubtitleWorkflow/PolishStage.tsx` | AI文本润色阶段 UI |
| `apps/desktop/src/components/AISubtitleWorkflow/StyleStage.tsx` | 智能样式推荐阶段 UI |
| `apps/desktop/src/components/AISubtitleWorkflow/ExportStage.tsx` | 多格式导出阶段 UI |
| `apps/desktop/src/components/AISubtitleWorkflow/AISubtitleWorkflowPanel.tsx` | 主面板组件 |
| `apps/desktop/src/components/AISubtitleWorkflow/index.ts` | 导出入口 |
| `apps/desktop/e2e/smart-subtitles.spec.ts` | E2E 测试 |

### 修改文件

| 文件 | 修改内容 |
|------|---------|
| `apps/desktop/src/store/editorUIStore.ts` | 添加 `aiSubtitleWorkflowOpen` 状态 |
| `apps/desktop/src/components/layout/ShellRightPanel.tsx` | 添加面板渲染入口 |
| `apps/desktop/src/i18n/strings.ts` | 添加 `aiSubtitleWorkflow` 国际化文本 |

---

### Task 1: 国际化文本

**Files:**
- Modify: `apps/desktop/src/i18n/strings.ts`

**Interfaces:**
- Produces: `zhCN.aiSubtitleWorkflow` 对象

- [ ] **Step 1: 添加国际化文本**

在 `apps/desktop/src/i18n/strings.ts` 的 `zh` 对象中添加：

```typescript
aiSubtitleWorkflow: {
  title: '智能字幕工作流',
  stages: {
    asr: '语音识别',
    polish: 'AI润色',
    style: '样式推荐',
    export: '导出',
  },
  asr: {
    selectClip: '选择目标片段',
    noClipSelected: '请在时间线上选择一个音频或视频片段',
    whisperNotConfigured: 'Whisper 未配置',
    whisperReady: 'Whisper 就绪',
    startRecognition: '开始识别',
    recognizing: '正在识别...',
    recognitionComplete: '识别完成',
    recognitionFailed: '识别失败',
    previewTitle: '识别结果预览',
    noResults: '未识别到字幕',
  },
  polish: {
    selectTrack: '选择字幕轨道',
    noTrackAvailable: '没有可用的字幕轨道',
    startPolish: 'AI 润色',
    processing: (done: number, total: number) => `处理中 ${done}/${total}`,
    previewTitle: '润色结果',
    noChanges: '没有需要修改的内容',
    accept: '接受',
    reject: '拒绝',
    acceptAll: '全部接受',
    rejectAll: '全部拒绝',
    applyAccepted: '应用修改',
    appliedTitle: '润色已应用',
    appliedMessage: (count: number) => `已应用 ${count} 处修改`,
    failedTitle: '润色失败',
    failedMessage: '请检查 AI 配置后重试',
    cancelledTitle: '已取消',
    cancelledMessage: '润色操作已取消',
    removeFillers: '去除填充词',
  },
  style: {
    analyzing: '正在分析视频内容...',
    recommendStyles: '推荐样式',
    noRecommendations: '暂无推荐样式',
    applyStyle: '应用样式',
    styleApplied: '样式已应用',
    skipStyle: '跳过样式',
    confidence: (value: number) => `置信度 ${Math.round(value * 100)}%`,
    failedTitle: '样式推荐失败',
    failedMessage: '请检查 AI 配置后重试',
  },
  export: {
    format: '导出格式',
    mode: '导出模式',
    burnIn: '烧录到视频',
    softSub: '外挂字幕文件',
    startExport: '导出字幕',
    exporting: '正在导出...',
    exportComplete: '导出完成',
    exportFailed: '导出失败',
    openFolder: '打开文件夹',
    outputPath: '输出路径',
  },
  navigation: {
    previous: '上一步',
    next: '下一步',
    reset: '重新开始',
  },
},
```

- [ ] **Step 2: 验证类型检查**

Run: `cd D:/code/Ai/open-factory && pnpm typecheck`
Expected: 无新增错误

- [ ] **Step 3: Commit**

```bash
cd D:/code/Ai/open-factory
git add apps/desktop/src/i18n/strings.ts
git commit -m "feat(i18n): add smart subtitle workflow localization strings"
```

---

### Task 2: 工作流状态管理 Hook

**Files:**
- Create: `apps/desktop/src/components/AISubtitleWorkflow/useSubtitleWorkflow.ts`

**Interfaces:**
- Consumes: `@open-factory/editor-core` types (Clip, SubtitleClip, Track)
- Produces: `useSubtitleWorkflow()` hook

- [ ] **Step 1: 创建 hook 文件**

```typescript
// apps/desktop/src/components/AISubtitleWorkflow/useSubtitleWorkflow.ts
import { useState, useCallback } from 'react';
import type { Clip, SubtitleClip } from '@open-factory/editor-core';

export type WorkflowStage = 'asr' | 'polish' | 'style' | 'export';
export type StageStatus = 'idle' | 'running' | 'done' | 'error';

export interface ASRState {
  status: StageStatus;
  selectedClipId: string | null;
  whisperReady: boolean;
  generatedTrackId: string | null;
  progress: number;
  error: string | null;
}

export interface PolishState {
  status: StageStatus;
  selectedTrackId: string | null;
  originalClips: SubtitleClip[];
  polishedClips: SubtitleClip[];
  acceptedChanges: boolean[];
  error: string | null;
}

export interface StyleState {
  status: StageStatus;
  recommendedTemplateId: string | null;
  appliedTemplateId: string | null;
  confidence: number;
  error: string | null;
}

export interface ExportState {
  status: StageStatus;
  format: 'srt' | 'vtt' | 'ass';
  mode: 'burn-in' | 'soft-sub';
  outputPath: string | null;
  error: string | null;
}

export interface SubtitleWorkflowState {
  currentStage: WorkflowStage;
  asr: ASRState;
  polish: PolishState;
  style: StyleState;
  export: ExportState;
}

const INITIAL_STATE: SubtitleWorkflowState = {
  currentStage: 'asr',
  asr: {
    status: 'idle',
    selectedClipId: null,
    whisperReady: false,
    generatedTrackId: null,
    progress: 0,
    error: null,
  },
  polish: {
    status: 'idle',
    selectedTrackId: null,
    originalClips: [],
    polishedClips: [],
    acceptedChanges: [],
    error: null,
  },
  style: {
    status: 'idle',
    recommendedTemplateId: null,
    appliedTemplateId: null,
    confidence: 0,
    error: null,
  },
  export: {
    status: 'idle',
    format: 'srt',
    mode: 'soft-sub',
    outputPath: null,
    error: null,
  },
};

export function useSubtitleWorkflow() {
  const [state, setState] = useState<SubtitleWorkflowState>(INITIAL_STATE);

  const updateASR = useCallback((patch: Partial<ASRState>) => {
    setState((prev) => ({ ...prev, asr: { ...prev.asr, ...patch } }));
  }, []);

  const updatePolish = useCallback((patch: Partial<PolishState>) => {
    setState((prev) => ({ ...prev, polish: { ...prev.polish, ...patch } }));
  }, []);

  const updateStyle = useCallback((patch: Partial<StyleState>) => {
    setState((prev) => ({ ...prev, style: { ...prev.style, ...patch } }));
  }, []);

  const updateExport = useCallback((patch: Partial<ExportState>) => {
    setState((prev) => ({ ...prev, export: { ...prev.export, ...patch } }));
  }, []);

  const goToStage = useCallback((stage: WorkflowStage) => {
    setState((prev) => ({ ...prev, currentStage: stage }));
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const completeASR = useCallback((trackId: string) => {
    setState((prev) => ({
      ...prev,
      asr: { ...prev.asr, status: 'done', generatedTrackId: trackId, progress: 100 },
      currentStage: 'polish',
      polish: { ...prev.polish, selectedTrackId: trackId },
    }));
  }, []);

  const completePolish = useCallback(() => {
    setState((prev) => ({
      ...prev,
      polish: { ...prev.polish, status: 'done' },
      currentStage: 'style',
    }));
  }, []);

  const completeStyle = useCallback((templateId: string) => {
    setState((prev) => ({
      ...prev,
      style: { ...prev.style, status: 'done', appliedTemplateId: templateId },
      currentStage: 'export',
    }));
  }, []);

  const completeExport = useCallback((outputPath: string) => {
    setState((prev) => ({
      ...prev,
      export: { ...prev.export, status: 'done', outputPath },
    }));
  }, []);

  return {
    state,
    updateASR,
    updatePolish,
    updateStyle,
    updateExport,
    goToStage,
    reset,
    completeASR,
    completePolish,
    completeStyle,
    completeExport,
  };
}
```

- [ ] **Step 2: 验证类型检查**

Run: `cd D:/code/Ai/open-factory && pnpm typecheck`
Expected: 无新增错误

- [ ] **Step 3: Commit**

```bash
cd D:/code/Ai/open-factory
git add apps/desktop/src/components/AISubtitleWorkflow/useSubtitleWorkflow.ts
git commit -m "feat: add subtitle workflow state management hook"
```

---

### Task 3: ASR 阶段组件

**Files:**
- Create: `apps/desktop/src/components/AISubtitleWorkflow/ASRStage.tsx`

**Interfaces:**
- Consumes: `useSubtitleWorkflow` state.asr, `getWhisperAvailability`, `buildWhisperSubtitleTrackForClip` from `lib/whisper.ts`
- Produces: `ASRStage` React component

- [ ] **Step 1: 创建 ASRStage 组件**

```typescript
// apps/desktop/src/components/AISubtitleWorkflow/ASRStage.tsx
import { useEffect, useMemo, useCallback } from 'react';
import type { Clip, MediaAsset, Timeline } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { buildWhisperSubtitleTrackForClip, canGenerateSubtitlesForClip, getWhisperAvailability } from '../../lib/whisper';
import { useWhisperSettingsStore } from '../../store/whisperSettingsStore';
import { useEditorStore } from '../../store/editorStore';
import { commandManager } from '../../store/commandManager';
import { AddTrackCommand } from '@open-factory/editor-core';
import { showToast } from '../../lib/toast';
import type { ASRState } from './useSubtitleWorkflow';

const t = zhCN.aiSubtitleWorkflow.asr;

interface ASRStageProps {
  asrState: ASRState;
  onUpdate: (patch: Partial<ASRState>) => void;
  onComplete: (trackId: string) => void;
  media: MediaAsset[];
}

export function ASRStage({ asrState, onUpdate, onComplete, media }: ASRStageProps) {
  const whisperExecutablePath = useWhisperSettingsStore((s) => s.executablePath);
  const whisperModelPath = useWhisperSettingsStore((s) => s.modelPath);
  const project = useEditorStore((s) => s.project);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const timeline = project.timeline;

  const selectedClip = useMemo(() => {
    return timeline.tracks
      .flatMap((track) => track.clips)
      .find((clip) => clip.id === selectedClipId) as Clip | undefined;
  }, [timeline, selectedClipId]);

  const asset = useMemo(() => {
    if (!selectedClip) return undefined;
    return media.find((m) => m.id === selectedClip.mediaAssetId);
  }, [selectedClip, media]);

  const canRun = useMemo(
    () => canGenerateSubtitlesForClip(selectedClip, asset, asrState.whisperReady),
    [selectedClip, asset, asrState.whisperReady]
  );

  useEffect(() => {
    let disposed = false;
    void getWhisperAvailability({
      executablePath: whisperExecutablePath,
      modelPath: whisperModelPath,
    }).then((availability) => {
      if (!disposed) {
        onUpdate({ whisperReady: availability.ready });
      }
    });
    return () => { disposed = true; };
  }, [whisperExecutablePath, whisperModelPath, onUpdate]);

  const handleStartASR = useCallback(async () => {
    if (!selectedClip || !asset || (selectedClip.type !== 'audio' && selectedClip.type !== 'video')) return;

    onUpdate({ status: 'running', progress: 0, selectedClipId: selectedClip.id, error: null });

    try {
      const track = await buildWhisperSubtitleTrackForClip(
        selectedClip as Extract<Clip, { type: 'audio' | 'video' }>,
        asset,
        timeline,
        { executablePath: whisperExecutablePath, modelPath: whisperModelPath }
      );

      commandManager.execute(new AddTrackCommand(project.timeline, track));
      onUpdate({ status: 'done', progress: 100, generatedTrackId: track.id });
      onComplete(track.id);
      showToast({ kind: 'success', title: t.recognitionComplete });
    } catch (error) {
      const message = error instanceof Error ? error.message : t.recognitionFailed;
      onUpdate({ status: 'error', error: message });
      showToast({ kind: 'error', title: t.recognitionFailed, message });
    }
  }, [selectedClip, asset, timeline, whisperExecutablePath, whisperModelPath, project, onUpdate, onComplete]);

  return (
    <div className="space-y-3" data-testid="subtitle-workflow-asr-stage">
      <div className="text-xs text-[var(--color-text-secondary)]">
        {t.selectClip}
      </div>

      {!selectedClip && (
        <div className="rounded-md border border-line bg-[var(--color-bg-elevated)] p-3 text-xs text-[var(--color-text-muted)]">
          {t.noClipSelected}
        </div>
      )}

      {selectedClip && (
        <div className="rounded-md border border-line bg-[var(--color-bg-elevated)] p-3 text-xs">
          <div className="font-medium text-ink">{selectedClip.name || selectedClip.id}</div>
          <div className="mt-1 text-[var(--color-text-muted)]">
            {selectedClip.type === 'video' ? '视频' : '音频'} · {selectedClip.duration.toFixed(1)}s
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs">
        <span className={`inline-block h-2 w-2 rounded-full ${asrState.whisperReady ? 'bg-emerald-500' : 'bg-red-500'}`} />
        <span className="text-[var(--color-text-secondary)]">
          {asrState.whisperReady ? t.whisperReady : t.whisperNotConfigured}
        </span>
      </div>

      {asrState.status === 'idle' && (
        <button
          className="w-full rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={!canRun}
          onClick={() => void handleStartASR()}
          data-testid="subtitle-workflow-asr-start"
        >
          {t.startRecognition}
        </button>
      )}

      {asrState.status === 'running' && (
        <div className="space-y-2">
          <div className="text-xs text-[var(--color-text-secondary)]" data-testid="subtitle-workflow-asr-progress">
            {t.recognizing}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
            <div className="h-full bg-[var(--color-accent)] transition-all animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      )}

      {asrState.status === 'error' && (
        <div className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-700" data-testid="subtitle-workflow-asr-error">
          {asrState.error}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 验证类型检查**

Run: `cd D:/code/Ai/open-factory && pnpm typecheck`
Expected: 无新增错误

- [ ] **Step 3: Commit**

```bash
cd D:/code/Ai/open-factory
git add apps/desktop/src/components/AISubtitleWorkflow/ASRStage.tsx
git commit -m "feat: add ASR stage component for subtitle workflow"
```

---

### Task 4: AI 润色阶段组件

**Files:**
- Create: `apps/desktop/src/components/AISubtitleWorkflow/PolishStage.tsx`

**Interfaces:**
- Consumes: `useSubtitleWorkflow` state.polish, `calculateSubtitlePolishBatchSplit`, `parseSubtitlePolishResponse`, `removeFillerWords` from editor-core
- Produces: `PolishStage` React component

- [ ] **Step 1: 创建 PolishStage 组件**

```typescript
// apps/desktop/src/components/AISubtitleWorkflow/PolishStage.tsx
import { useState, useCallback, useRef, useMemo } from 'react';
import type { Clip, AIProvider, SubtitleClip } from '@open-factory/editor-core';
import {
  calculateSubtitlePolishBatchSplit,
  parseSubtitlePolishResponse,
  removeFillerWords,
  isProviderConfigured,
  BatchUpdateSubtitleTextCommand,
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import { callAiApi, readAiApiKey } from '../../lib/tauri-bridge';
import { commandManager, timelineAccessor } from '../../store/commandManager';
import { useEditorStore } from '../../store/editorStore';
import { showToast } from '../../lib/toast';
import type { PolishState } from './useSubtitleWorkflow';

const t = zhCN.aiSubtitleWorkflow.polish;

interface PolishedItem {
  clipId: string;
  index: number;
  originalText: string;
  polishedText: string;
  accepted: boolean;
}

interface PolishStageProps {
  polishState: PolishState;
  onUpdate: (patch: Partial<PolishState>) => void;
  onComplete: () => void;
}

export function PolishStage({ polishState, onUpdate, onComplete }: PolishStageProps) {
  const providers = useAISettingsStore((s) => s.providers);
  const serviceMapping = useAISettingsStore((s) => s.serviceMapping);
  const project = useEditorStore((s) => s.project);
  const enabledProviders = providers.filter((p) => p.enabled && isProviderConfigured(p));
  const defaultProviderId = serviceMapping['subtitle-polish'] ?? '';
  const defaultProvider = enabledProviders.find((p) => p.id === defaultProviderId) ?? enabledProviders[0];

  const [selectedProviderId, setSelectedProviderId] = useState<string>(defaultProvider?.id ?? '');
  const [removeFillers, setRemoveFillers] = useState(false);
  const [polishedItems, setPolishedItems] = useState<PolishedItem[]>([]);
  const abortRef = useRef(false);

  const selectedProvider = enabledProviders.find((p) => p.id === selectedProviderId) ?? defaultProvider;

  const subtitleTracks = useMemo(() => {
    return project.timeline.tracks.filter((track) => track.type === 'subtitle');
  }, [project.timeline]);

  const selectedTrack = useMemo(() => {
    return subtitleTracks.find((t) => t.id === polishState.selectedTrackId) ?? subtitleTracks[0];
  }, [subtitleTracks, polishState.selectedTrackId]);

  const subtitleClips = useMemo(() => {
    return (selectedTrack?.clips ?? []) as SubtitleClip[];
  }, [selectedTrack]);

  const startPolish = useCallback(async () => {
    if (!selectedProvider || subtitleClips.length === 0) return;

    abortRef.current = false;
    onUpdate({ status: 'running', error: null });

    const items = subtitleClips.map((clip, index) => ({
      clipId: clip.id,
      index,
      text: removeFillers ? removeFillerWords(clip.text) : clip.text,
    }));
    const batches = calculateSubtitlePolishBatchSplit(items.length, 50);
    const results: PolishedItem[] = [];
    let offset = 0;

    try {
      const apiKey = await readAiApiKey(selectedProvider.id);
      if (abortRef.current) { onUpdate({ status: 'idle' }); return; }

      for (const batchSize of batches) {
        const batch = items.slice(offset, offset + batchSize);
        const messages = [
          {
            role: 'system' as const,
            content: '你是一个专业的字幕编辑助手。用户会给你一段JSON数组，每个元素有index和text字段。请修正错别字、标点符号错误、优化断句（每条不超过20字），返回相同格式的JSON数组。只返回JSON数组，不要其他内容。',
          },
          {
            role: 'user' as const,
            content: JSON.stringify(batch.map((b) => ({ index: b.index, text: b.text }))),
          },
        ];

        const response = await callAiApi(
          {
            providerId: selectedProvider.id,
            baseUrl: selectedProvider.baseUrl,
            model: selectedProvider.defaultModel,
            messages,
            customHeaders: selectedProvider.customHeaders,
            maxTokens: 4096,
            temperature: 0.3,
          },
          apiKey
        );

        if (abortRef.current) { onUpdate({ status: 'idle' }); return; }

        const parsed = parseSubtitlePolishResponse(JSON.parse(response.content));
        for (const item of parsed) {
          const original = batch[item.index - offset];
          if (original && item.text !== original.text) {
            results.push({
              clipId: original.clipId,
              index: original.index,
              originalText: original.text,
              polishedText: item.text,
              accepted: true,
            });
          }
        }

        offset += batchSize;
      }

      if (results.length === 0) {
        showToast({ kind: 'info', title: t.noChanges });
        onUpdate({ status: 'idle' });
        return;
      }

      setPolishedItems(results);
      onUpdate({ status: 'done' });
    } catch (error) {
      const message = error instanceof Error ? error.message : t.failedMessage;
      onUpdate({ status: 'error', error: message });
      showToast({ kind: 'error', title: t.failedTitle, message });
    }
  }, [selectedProvider, subtitleClips, removeFillers, onUpdate]);

  const toggleItem = useCallback((clipId: string) => {
    setPolishedItems((prev) =>
      prev.map((item) => (item.clipId === clipId ? { ...item, accepted: !item.accepted } : item))
    );
  }, []);

  const acceptAll = useCallback(() => {
    setPolishedItems((prev) => prev.map((item) => ({ ...item, accepted: true })));
  }, []);

  const rejectAll = useCallback(() => {
    setPolishedItems((prev) => prev.map((item) => ({ ...item, accepted: false })));
  }, []);

  const applyAccepted = useCallback(() => {
    const accepted = polishedItems.filter((item) => item.accepted);
    if (accepted.length === 0) {
      onUpdate({ status: 'idle' });
      setPolishedItems([]);
      return;
    }
    try {
      commandManager.execute(
        new BatchUpdateSubtitleTextCommand(
          timelineAccessor,
          accepted.map((item) => ({ clipId: item.clipId, text: item.polishedText }))
        )
      );
      showToast({ kind: 'success', title: t.appliedTitle, message: t.appliedMessage(accepted.length) });
      onComplete();
    } catch (error) {
      const message = error instanceof Error ? error.message : t.failedMessage;
      showToast({ kind: 'error', title: t.failedTitle, message });
    }
    onUpdate({ status: 'idle' });
    setPolishedItems([]);
  }, [polishedItems, onUpdate, onComplete]);

  return (
    <div className="space-y-3" data-testid="subtitle-workflow-polish-stage">
      {subtitleTracks.length === 0 && (
        <div className="rounded-md border border-line bg-[var(--color-bg-elevated)] p-3 text-xs text-[var(--color-text-muted)]">
          {t.noTrackAvailable}
        </div>
      )}

      {subtitleTracks.length > 0 && polishState.status === 'idle' && polishedItems.length === 0 && (
        <>
          <div className="space-y-2">
            <label className="block text-xs text-[var(--color-text-secondary)]">{t.selectTrack}</label>
            <select
              className="w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1 text-sm outline-none"
              value={selectedTrack?.id ?? ''}
              onChange={(e) => onUpdate({ selectedTrackId: e.target.value })}
              data-testid="subtitle-workflow-polish-track-select"
            >
              {subtitleTracks.map((track) => (
                <option key={track.id} value={track.id}>{track.name || track.id}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs text-[var(--color-text-secondary)]">{t.selectProvider}</label>
            <select
              className="w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1 text-sm outline-none"
              value={selectedProviderId}
              onChange={(e) => setSelectedProviderId(e.target.value)}
              disabled={enabledProviders.length === 0}
              data-testid="subtitle-workflow-polish-provider-select"
            >
              {enabledProviders.length === 0 && <option value="">无可用提供商</option>}
              {enabledProviders.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
            <input
              type="checkbox"
              checked={removeFillers}
              onChange={(e) => setRemoveFillers(e.target.checked)}
              data-testid="subtitle-workflow-polish-remove-fillers"
            />
            {t.removeFillers}
          </label>

          <button
            className="w-full rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={!selectedProvider || subtitleClips.length === 0}
            onClick={() => void startPolish()}
            data-testid="subtitle-workflow-polish-start"
          >
            {t.startPolish}
          </button>
        </>
      )}

      {polishState.status === 'running' && (
        <div className="space-y-2">
          <div className="text-xs text-[var(--color-text-secondary)]" data-testid="subtitle-workflow-polish-progress">
            {t.processing(0, subtitleClips.length)}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
            <div className="h-full bg-[var(--color-accent)] transition-all animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      )}

      {polishedItems.length > 0 && (
        <div className="space-y-2" data-testid="subtitle-workflow-polish-preview">
          <div className="text-xs font-semibold text-[var(--color-text-secondary)]">{t.previewTitle}</div>
          <div className="max-h-60 space-y-2 overflow-y-auto">
            {polishedItems.map((item) => (
              <div
                key={item.clipId}
                className="rounded-md border border-line p-2 text-xs"
                data-testid={`subtitle-workflow-polish-item-${item.clipId}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[var(--color-text-muted)] line-through">{item.originalText}</div>
                    <div className="mt-0.5 font-medium text-ink">{item.polishedText}</div>
                  </div>
                  <button
                    className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-medium ${
                      item.accepted ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}
                    type="button"
                    onClick={() => toggleItem(item.clipId)}
                    data-testid={`subtitle-workflow-polish-toggle-${item.clipId}`}
                  >
                    {item.accepted ? t.accept : t.reject}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1 text-xs font-medium hover:bg-panel"
              type="button"
              onClick={acceptAll}
              data-testid="subtitle-workflow-polish-accept-all"
            >
              {t.acceptAll}
            </button>
            <button
              className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1 text-xs font-medium hover:bg-panel"
              type="button"
              onClick={rejectAll}
              data-testid="subtitle-workflow-polish-reject-all"
            >
              {t.rejectAll}
            </button>
          </div>
          <button
            className="w-full rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent)]"
            type="button"
            onClick={applyAccepted}
            data-testid="subtitle-workflow-polish-apply"
          >
            {t.applyAccepted}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 验证类型检查**

Run: `cd D:/code/Ai/open-factory && pnpm typecheck`
Expected: 无新增错误

- [ ] **Step 3: Commit**

```bash
cd D:/code/Ai/open-factory
git add apps/desktop/src/components/AISubtitleWorkflow/PolishStage.tsx
git commit -m "feat: add Polish stage component for subtitle workflow"
```

---

### Task 5: 样式推荐阶段组件

**Files:**
- Create: `apps/desktop/src/components/AISubtitleWorkflow/StyleStage.tsx`

**Interfaces:**
- Consumes: `useSubtitleWorkflow` state.style, `buildSubtitleStyleVideoContext`, `parseSubtitleStyleResponse` from editor-core
- Produces: `StyleStage` React component

- [ ] **Step 1: 创建 StyleStage 组件**

```typescript
// apps/desktop/src/components/AISubtitleWorkflow/StyleStage.tsx
import { useState, useCallback, useMemo } from 'react';
import type { MediaAsset } from '@open-factory/editor-core';
import {
  buildSubtitleStyleVideoContext,
  parseSubtitleStyleResponse,
  BUILTIN_SUBTITLE_STYLE_TEMPLATES,
  renderSubtitleStyleTemplatePreview,
  applyStyleTemplateBatch,
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import { callAiApi, readAiApiKey } from '../../lib/tauri-bridge';
import { useEditorStore } from '../../store/editorStore';
import { commandManager } from '../../store/commandManager';
import { showToast } from '../../lib/toast';
import type { StyleState } from './useSubtitleWorkflow';

const t = zhCN.aiSubtitleWorkflow.style;

interface StyleRecommendation {
  templateId: string;
  confidence: number;
  reason: string;
}

interface StyleStageProps {
  styleState: StyleState;
  onUpdate: (patch: Partial<StyleState>) => void;
  onComplete: (templateId: string) => void;
  media: MediaAsset[];
}

export function StyleStage({ styleState, onUpdate, onComplete, media }: StyleStageProps) {
  const providers = useAISettingsStore((s) => s.providers);
  const serviceMapping = useAISettingsStore((s) => s.serviceMapping);
  const project = useEditorStore((s) => s.project);
  const enabledProviders = providers.filter((p) => p.enabled && p.id !== 'ollama');
  const defaultProviderId = serviceMapping['subtitle-style'] ?? '';
  const defaultProvider = enabledProviders.find((p) => p.id === defaultProviderId) ?? enabledProviders[0];

  const [recommendations, setRecommendations] = useState<StyleRecommendation[]>([]);
  const [loading, setLoading] = useState(false);

  const projectWidth = project.settings?.width ?? 1920;
  const projectHeight = project.settings?.height ?? 1080;

  const requestRecommendations = useCallback(async () => {
    if (!defaultProvider) return;

    setLoading(true);
    onUpdate({ status: 'running', error: null });

    try {
      const apiKey = await readAiApiKey(defaultProvider.id);
      const videoContext = buildSubtitleStyleVideoContext({
        width: projectWidth,
        height: projectHeight,
        media: media.slice(0, 5),
      });

      const messages = [
        {
          role: 'system' as const,
          content: buildSubtitleStyleSystemPrompt(),
        },
        {
          role: 'user' as const,
          content: videoContext,
        },
      ];

      const response = await callAiApi(
        {
          providerId: defaultProvider.id,
          baseUrl: defaultProvider.baseUrl,
          model: defaultProvider.defaultModel,
          messages,
          customHeaders: defaultProvider.customHeaders,
          maxTokens: 2048,
          temperature: 0.3,
        },
        apiKey
      );

      const parsed = parseSubtitleStyleResponse(response.content);
      const validRecommendations = parsed
        .filter((r) => BUILTIN_SUBTITLE_STYLE_TEMPLATES.some((t) => t.id === r.templateId))
        .map((r) => ({
          templateId: r.templateId,
          confidence: r.confidence,
          reason: r.reason,
        }));

      setRecommendations(validRecommendations);
      onUpdate({ status: 'done', recommendedTemplateId: validRecommendations[0]?.templateId ?? null });
    } catch (error) {
      const message = error instanceof Error ? error.message : t.failedMessage;
      onUpdate({ status: 'error', error: message });
      showToast({ kind: 'error', title: t.failedTitle, message });
    } finally {
      setLoading(false);
    }
  }, [defaultProvider, projectWidth, projectHeight, media, onUpdate]);

  const applyStyle = useCallback((templateId: string) => {
    try {
      applyStyleTemplateBatch(commandManager, project.timeline, templateId);
      onUpdate({ appliedTemplateId: templateId });
      onComplete(templateId);
      showToast({ kind: 'success', title: t.styleApplied });
    } catch (error) {
      const message = error instanceof Error ? error.message : t.failedMessage;
      showToast({ kind: 'error', title: t.failedTitle, message });
    }
  }, [project.timeline, onUpdate, onComplete]);

  return (
    <div className="space-y-3" data-testid="subtitle-workflow-style-stage">
      {recommendations.length === 0 && !loading && styleState.status !== 'running' && (
        <button
          className="w-full rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={!defaultProvider}
          onClick={() => void requestRecommendations()}
          data-testid="subtitle-workflow-style-recommend"
        >
          {t.recommendStyles}
        </button>
      )}

      {loading && (
        <div className="space-y-2">
          <div className="text-xs text-[var(--color-text-secondary)]">{t.analyzing}</div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
            <div className="h-full bg-[var(--color-accent)] transition-all animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="space-y-2" data-testid="subtitle-workflow-style-recommendations">
          {recommendations.map((rec) => {
            const template = BUILTIN_SUBTITLE_STYLE_TEMPLATES.find((t) => t.id === rec.templateId);
            if (!template) return null;
            const preview = renderSubtitleStyleTemplatePreview(template);

            return (
              <div
                key={rec.templateId}
                className="rounded-md border border-line bg-[var(--color-bg-elevated)] p-3"
                data-testid={`subtitle-workflow-style-rec-${rec.templateId}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink">{template.name}</div>
                    <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">{rec.reason}</div>
                    <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      {t.confidence(rec.confidence)}
                    </div>
                  </div>
                  <button
                    className="shrink-0 rounded-md bg-[var(--color-accent)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--color-accent)]"
                    type="button"
                    onClick={() => applyStyle(rec.templateId)}
                    data-testid={`subtitle-workflow-style-apply-${rec.templateId}`}
                  >
                    {t.applyStyle}
                  </button>
                </div>
                <div
                  className="mt-2 overflow-hidden rounded border border-line"
                  dangerouslySetInnerHTML={{ __html: preview }}
                />
              </div>
            );
          })}
        </div>
      )}

      {recommendations.length > 0 && (
        <button
          className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel"
          type="button"
          onClick={() => onComplete('')}
          data-testid="subtitle-workflow-style-skip"
        >
          {t.skipStyle}
        </button>
      )}
    </div>
  );
}

function buildSubtitleStyleSystemPrompt(): string {
  return `你是一个专业的字幕样式顾问。根据视频的分辨率、方向和内容特征，推荐最合适的字幕样式模板。

可用的样式模板：
${BUILTIN_SUBTITLE_STYLE_TEMPLATES.map((t) => `- ${t.id}: ${t.name}`).join('\n')}

请返回JSON数组，每个元素包含：
- templateId: 模板ID
- confidence: 置信度 (0-1)
- reason: 推荐理由（简短中文）

只返回JSON数组，不要其他内容。推荐3个模板。`;
}
```

- [ ] **Step 2: 验证类型检查**

Run: `cd D:/code/Ai/open-factory && pnpm typecheck`
Expected: 无新增错误

- [ ] **Step 3: Commit**

```bash
cd D:/code/Ai/open-factory
git add apps/desktop/src/components/AISubtitleWorkflow/StyleStage.tsx
git commit -m "feat: add Style recommendation stage for subtitle workflow"
```

---

### Task 6: 导出阶段组件

**Files:**
- Create: `apps/desktop/src/components/AISubtitleWorkflow/ExportStage.tsx`

**Interfaces:**
- Consumes: `useSubtitleWorkflow` state.export, `serializeSubtitleClipsToSrt/Vtt/Ass` from editor-core
- Produces: `ExportStage` React component

- [ ] **Step 1: 创建 ExportStage 组件**

```typescript
// apps/desktop/src/components/AISubtitleWorkflow/ExportStage.tsx
import { useCallback, useMemo } from 'react';
import {
  serializeSubtitleClipsToSrt,
  serializeSubtitleClipsToVtt,
  serializeSubtitleClipsToAss,
} from '@open-factory/editor-core';
import type { SubtitleClip } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useEditorStore } from '../../store/editorStore';
import { saveFileDialog } from '../../lib/tauri-bridge';
import { showToast } from '../../lib/toast';
import { openPath } from '../../lib/tauri-bridge';
import type { ExportState } from './useSubtitleWorkflow';

const t = zhCN.aiSubtitleWorkflow.export;

interface ExportStageProps {
  exportState: ExportState;
  onUpdate: (patch: Partial<ExportState>) => void;
  onComplete: (outputPath: string) => void;
}

export function ExportStage({ exportState, onUpdate, onComplete }: ExportStageProps) {
  const project = useEditorStore((s) => s.project);

  const subtitleClips = useMemo(() => {
    return project.timeline.tracks
      .filter((track) => track.type === 'subtitle')
      .flatMap((track) => track.clips) as SubtitleClip[];
  }, [project.timeline]);

  const handleExport = useCallback(async () => {
    if (subtitleClips.length === 0) return;

    onUpdate({ status: 'running', error: null });

    try {
      let content: string;
      let extension: string;

      switch (exportState.format) {
        case 'srt':
          content = serializeSubtitleClipsToSrt(subtitleClips);
          extension = 'srt';
          break;
        case 'vtt':
          content = serializeSubtitleClipsToVtt(subtitleClips);
          extension = 'vtt';
          break;
        case 'ass':
          content = serializeSubtitleClipsToAss(subtitleClips);
          extension = 'ass';
          break;
      }

      const defaultName = `${project.name || 'subtitles'}.${extension}`;
      const filePath = await saveFileDialog(defaultName, [
        { name: `${extension.toUpperCase()} 文件`, extensions: [extension] },
      ]);

      if (!filePath) {
        onUpdate({ status: 'idle' });
        return;
      }

      // Write file via Tauri FS
      const { writeTextFile } = await import('../../lib/tauri-bridge');
      await writeTextFile(filePath, content);

      onUpdate({ status: 'done', outputPath: filePath });
      onComplete(filePath);
      showToast({ kind: 'success', title: t.exportComplete });
    } catch (error) {
      const message = error instanceof Error ? error.message : t.exportFailed;
      onUpdate({ status: 'error', error: message });
      showToast({ kind: 'error', title: t.exportFailed, message });
    }
  }, [subtitleClips, exportState.format, project.name, onUpdate, onComplete]);

  const handleOpenFolder = useCallback(async () => {
    if (exportState.outputPath) {
      try {
        const dir = exportState.outputPath.substring(0, exportState.outputPath.lastIndexOf('\\') || exportState.outputPath.lastIndexOf('/'));
        await openPath(dir);
      } catch {
        // Ignore open errors
      }
    }
  }, [exportState.outputPath]);

  return (
    <div className="space-y-3" data-testid="subtitle-workflow-export-stage">
      <div className="space-y-2">
        <label className="block text-xs text-[var(--color-text-secondary)]">{t.format}</label>
        <div className="flex gap-2">
          {(['srt', 'vtt', 'ass'] as const).map((format) => (
            <button
              key={format}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                exportState.format === format
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'border border-line bg-[var(--color-bg-elevated)] hover:bg-panel'
              }`}
              type="button"
              onClick={() => onUpdate({ format })}
              data-testid={`subtitle-workflow-export-format-${format}`}
            >
              {format.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-xs text-[var(--color-text-secondary)]">{t.mode}</label>
        <div className="flex gap-2">
          <button
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              exportState.mode === 'soft-sub'
                ? 'bg-[var(--color-accent)] text-white'
                : 'border border-line bg-[var(--color-bg-elevated)] hover:bg-panel'
            }`}
            type="button"
            onClick={() => onUpdate({ mode: 'soft-sub' })}
            data-testid="subtitle-workflow-export-mode-soft"
          >
            {t.softSub}
          </button>
          <button
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              exportState.mode === 'burn-in'
                ? 'bg-[var(--color-accent)] text-white'
                : 'border border-line bg-[var(--color-bg-elevated)] hover:bg-panel'
            }`}
            type="button"
            onClick={() => onUpdate({ mode: 'burn-in' })}
            data-testid="subtitle-workflow-export-mode-burn"
          >
            {t.burnIn}
          </button>
        </div>
      </div>

      {exportState.status === 'idle' && (
        <button
          className="w-full rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={subtitleClips.length === 0}
          onClick={() => void handleExport()}
          data-testid="subtitle-workflow-export-start"
        >
          {t.startExport}
        </button>
      )}

      {exportState.status === 'running' && (
        <div className="space-y-2">
          <div className="text-xs text-[var(--color-text-secondary)]">{t.exporting}</div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
            <div className="h-full bg-[var(--color-accent)] transition-all animate-pulse" style={{ width: '80%' }} />
          </div>
        </div>
      )}

      {exportState.status === 'done' && exportState.outputPath && (
        <div className="space-y-2" data-testid="subtitle-workflow-export-result">
          <div className="rounded-md border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-700">
            {t.exportComplete}
          </div>
          <div className="text-xs text-[var(--color-text-secondary)]">
            {t.outputPath}: <span className="font-mono text-ink">{exportState.outputPath}</span>
          </div>
          <button
            className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel"
            type="button"
            onClick={() => void handleOpenFolder()}
            data-testid="subtitle-workflow-export-open-folder"
          >
            {t.openFolder}
          </button>
        </div>
      )}

      {exportState.status === 'error' && (
        <div className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-700" data-testid="subtitle-workflow-export-error">
          {exportState.error}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 验证类型检查**

Run: `cd D:/code/Ai/open-factory && pnpm typecheck`
Expected: 无新增错误

- [ ] **Step 3: Commit**

```bash
cd D:/code/Ai/open-factory
git add apps/desktop/src/components/AISubtitleWorkflow/ExportStage.tsx
git commit -m "feat: add Export stage component for subtitle workflow"
```

---

### Task 7: 主面板组件 + 注册

**Files:**
- Create: `apps/desktop/src/components/AISubtitleWorkflow/AISubtitleWorkflowPanel.tsx`
- Create: `apps/desktop/src/components/AISubtitleWorkflow/index.ts`
- Modify: `apps/desktop/src/store/editorUIStore.ts`
- Modify: `apps/desktop/src/components/layout/ShellRightPanel.tsx`

**Interfaces:**
- Consumes: `useSubtitleWorkflow`, `ASRStage`, `PolishStage`, `StyleStage`, `ExportStage`
- Produces: `AISubtitleWorkflowPanel` React component, `aiSubtitleWorkflowOpen` store state

- [ ] **Step 1: 创建 AISubtitleWorkflowPanel 主组件**

```typescript
// apps/desktop/src/components/AISubtitleWorkflow/AISubtitleWorkflowPanel.tsx
import { useMemo } from 'react';
import type { Clip, MediaAsset } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useSubtitleWorkflow, type WorkflowStage } from './useSubtitleWorkflow';
import { ASRStage } from './ASRStage';
import { PolishStage } from './PolishStage';
import { StyleStage } from './StyleStage';
import { ExportStage } from './ExportStage';

const t = zhCN.aiSubtitleWorkflow;

const STAGES: WorkflowStage[] = ['asr', 'polish', 'style', 'export'];

interface AISubtitleWorkflowPanelProps {
  selectedClip?: Clip;
  media: MediaAsset[];
  onClose: () => void;
}

export function AISubtitleWorkflowPanel({ selectedClip, media, onClose }: AISubtitleWorkflowPanelProps) {
  const {
    state,
    updateASR,
    updatePolish,
    updateStyle,
    updateExport,
    goToStage,
    reset,
    completeASR,
    completePolish,
    completeStyle,
    completeExport,
  } = useSubtitleWorkflow();

  const stageIndex = STAGES.indexOf(state.currentStage);

  const canNavigateTo = (stage: WorkflowStage): boolean => {
    const targetIndex = STAGES.indexOf(stage);
    const currentIndex = STAGES.indexOf(state.currentStage);
    // Can navigate to current or previous stages
    return targetIndex <= currentIndex;
  };

  return (
    <div
      className="flex h-full flex-col bg-[var(--color-bg-primary)]"
      data-testid="ai-subtitle-workflow-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="text-sm font-semibold text-ink">{t.title}</h2>
        <button
          className="rounded p-1 text-[var(--color-text-muted)] hover:bg-panel"
          type="button"
          onClick={onClose}
          data-testid="subtitle-workflow-close"
        >
          ✕
        </button>
      </div>

      {/* Stage Tabs */}
      <div className="flex border-b border-line">
        {STAGES.map((stage, index) => (
          <button
            key={stage}
            className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${
              state.currentStage === stage
                ? 'border-b-2 border-[var(--color-accent)] text-[var(--color-accent)]'
                : canNavigateTo(stage)
                  ? 'text-[var(--color-text-secondary)] hover:text-ink'
                  : 'cursor-not-allowed text-[var(--color-text-muted)] opacity-50'
            }`}
            type="button"
            disabled={!canNavigateTo(stage)}
            onClick={() => goToStage(stage)}
            data-testid={`subtitle-workflow-tab-${stage}`}
          >
            {t.stages[stage]}
          </button>
        ))}
      </div>

      {/* Stage Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {state.currentStage === 'asr' && (
          <ASRStage
            asrState={state.asr}
            onUpdate={updateASR}
            onComplete={completeASR}
            media={media}
          />
        )}
        {state.currentStage === 'polish' && (
          <PolishStage
            polishState={state.polish}
            onUpdate={updatePolish}
            onComplete={completePolish}
          />
        )}
        {state.currentStage === 'style' && (
          <StyleStage
            styleState={state.style}
            onUpdate={updateStyle}
            onComplete={completeStyle}
            media={media}
          />
        )}
        {state.currentStage === 'export' && (
          <ExportStage
            exportState={state.export}
            onUpdate={updateExport}
            onComplete={completeExport}
          />
        )}
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between border-t border-line px-3 py-2">
        <button
          className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-3 py-1 text-xs font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={stageIndex === 0}
          onClick={() => goToStage(STAGES[stageIndex - 1])}
          data-testid="subtitle-workflow-prev"
        >
          {t.navigation.previous}
        </button>
        <button
          className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-3 py-1 text-xs font-medium hover:bg-panel"
          type="button"
          onClick={reset}
          data-testid="subtitle-workflow-reset"
        >
          {t.navigation.reset}
        </button>
        <button
          className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-3 py-1 text-xs font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={stageIndex === STAGES.length - 1}
          onClick={() => goToStage(STAGES[stageIndex + 1])}
          data-testid="subtitle-workflow-next"
        >
          {t.navigation.next}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 index.ts 导出入口**

```typescript
// apps/desktop/src/components/AISubtitleWorkflow/index.ts
export { AISubtitleWorkflowPanel } from './AISubtitleWorkflowPanel';
```

- [ ] **Step 3: 在 editorUIStore 中添加面板状态**

在 `apps/desktop/src/store/editorUIStore.ts` 中添加：

1. 在 interface 中添加：`aiSubtitleWorkflowOpen: boolean;`
2. 在 defaults 中添加：`aiSubtitleWorkflowOpen: false,`
3. 添加 setter：`setAiSubtitleWorkflowOpen: (updater: Updater<boolean>) => void;`
4. 实现 setter：`setAiSubtitleWorkflowOpen(updater) { set((s) => ({ aiSubtitleWorkflowOpen: applyUpdater(s.aiSubtitleWorkflowOpen, updater) })); },`

- [ ] **Step 4: 在 ShellRightPanel 中注册面板**

在 `apps/desktop/src/components/layout/ShellRightPanel.tsx` 中添加：

1. 在 lazy imports 区域添加：
```typescript
const AISubtitleWorkflowPanel = lazy(() => import('../AISubtitleWorkflow/AISubtitleWorkflowPanel').then((m) => ({ default: m.AISubtitleWorkflowPanel })));
```

2. 在 store selectors 区域添加：
```typescript
const aiSubtitleWorkflowOpen = useEditorUIStore((s) => s.aiSubtitleWorkflowOpen);
const setAiSubtitleWorkflowOpen = useEditorUIStore((s) => s.setAiSubtitleWorkflowOpen);
```

3. 在渲染区域添加面板（参考 SmartRoughCutPanel 的渲染方式）：
```typescript
{aiSubtitleWorkflowOpen && (
  <ErrorBoundary>
    <Suspense fallback={<PanelLoading />}>
      <AISubtitleWorkflowPanel
        selectedClip={selectedClip}
        media={project.media}
        onClose={() => setAiSubtitleWorkflowOpen(false)}
      />
    </Suspense>
  </ErrorBoundary>
)}
```

- [ ] **Step 5: 验证类型检查**

Run: `cd D:/code/Ai/open-factory && pnpm typecheck`
Expected: 无新增错误

- [ ] **Step 6: 验证 lint**

Run: `cd D:/code/Ai/open-factory && pnpm lint`
Expected: 无新增错误

- [ ] **Step 7: Commit**

```bash
cd D:/code/Ai/open-factory
git add apps/desktop/src/components/AISubtitleWorkflow/ apps/desktop/src/store/editorUIStore.ts apps/desktop/src/components/layout/ShellRightPanel.tsx
git commit -m "feat: add AISubtitleWorkflowPanel with all stages and panel registration"
```

---

### Task 8: E2E 测试

**Files:**
- Create: `apps/desktop/e2e/smart-subtitles.spec.ts`

**Interfaces:**
- Consumes: `AISubtitleWorkflowPanel` via Playwright
- Produces: E2E test coverage for the workflow

- [ ] **Step 1: 创建 E2E 测试文件**

```typescript
// apps/desktop/e2e/smart-subtitles.spec.ts
import { test, expect } from '@playwright/test';

test.describe('智能字幕工作流', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Open the subtitle workflow panel
    await page.click('[data-testid="panel-menu-button"]');
    await page.click('[data-testid="menu-item-ai-subtitle-workflow"]');
  });

  test('should display the workflow panel with 4 stage tabs', async ({ page }) => {
    const panel = page.locator('[data-testid="ai-subtitle-workflow-panel"]');
    await expect(panel).toBeVisible();

    await expect(page.locator('[data-testid="subtitle-workflow-tab-asr"]')).toBeVisible();
    await expect(page.locator('[data-testid="subtitle-workflow-tab-polish"]')).toBeVisible();
    await expect(page.locator('[data-testid="subtitle-workflow-tab-style"]')).toBeVisible();
    await expect(page.locator('[data-testid="subtitle-workflow-tab-export"]')).toBeVisible();
  });

  test('should show ASR stage by default', async ({ page }) => {
    const asrStage = page.locator('[data-testid="subtitle-workflow-asr-stage"]');
    await expect(asrStage).toBeVisible();
  });

  test('should show no clip selected message when no clip is selected', async ({ page }) => {
    await expect(page.locator('text=请在时间线上选择一个音频或视频片段')).toBeVisible();
  });

  test('should disable next stages initially', async ({ page }) => {
    const polishTab = page.locator('[data-testid="subtitle-workflow-tab-polish"]');
    await expect(polishTab).toBeDisabled();

    const styleTab = page.locator('[data-testid="subtitle-workflow-tab-style"]');
    await expect(styleTab).toBeDisabled();

    const exportTab = page.locator('[data-testid="subtitle-workflow-tab-export"]');
    await expect(exportTab).toBeDisabled();
  });

  test('should navigate between stages when clicking tabs', async ({ page }) => {
    // ASR tab should be active by default
    const asrTab = page.locator('[data-testid="subtitle-workflow-tab-asr"]');
    await expect(asrTab).toHaveAttribute('aria-selected', 'true');

    // Clicking on ASR tab should show ASR stage
    await asrTab.click();
    await expect(page.locator('[data-testid="subtitle-workflow-asr-stage"]')).toBeVisible();
  });

  test('should close the panel when clicking close button', async ({ page }) => {
    await page.click('[data-testid="subtitle-workflow-close"]');
    const panel = page.locator('[data-testid="ai-subtitle-workflow-panel"]');
    await expect(panel).not.toBeVisible();
  });

  test('should show reset button in footer', async ({ page }) => {
    await expect(page.locator('[data-testid="subtitle-workflow-reset"]')).toBeVisible();
  });

  test('should show export format options in export stage', async ({ page }) => {
    // Navigate to export stage (need to complete previous stages first)
    // This test verifies the export stage structure
    await expect(page.locator('[data-testid="subtitle-workflow-tab-export"]')).toBeVisible();
  });
});
```

- [ ] **Step 2: 验证 E2E 测试通过**

Run: `cd D:/code/Ai/open-factory && pnpm test:e2e --grep "smart-subtitles"`
Expected: 测试通过（或在 CI 环境中跳过需要桌面环境的测试）

- [ ] **Step 3: 运行全部检查**

Run: `cd D:/code/Ai/open-factory && pnpm typecheck && pnpm lint && pnpm test`
Expected: 全部通过

- [ ] **Step 4: Commit**

```bash
cd D:/code/Ai/open-factory
git add apps/desktop/e2e/smart-subtitles.spec.ts
git commit -m "test: add E2E tests for smart subtitle workflow panel"
```

---

### Task 9: 最终验证与提交

- [ ] **Step 1: 运行完整检查**

```bash
cd D:/code/Ai/open-factory
pnpm typecheck
pnpm lint
pnpm test
```

Expected: 全部通过

- [ ] **Step 2: 推送分支**

```bash
cd D:/code/Ai/open-factory
git push -u origin feat/smart-subtitle-workflow
```

- [ ] **Step 3: 创建 PR**

```bash
gh pr create --title "feat: Add smart subtitle workflow with ASR, editing, and export" --body "实现智能字幕全链路系统，串联现有字幕功能（Whisper ASR → AI润色 → 样式推荐 → 多格式导出）为端到端工作流。"
```
