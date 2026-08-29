import { useState, useCallback } from 'react';
import type { SubtitleClip } from '@open-factory/editor-core';

// ASR（语音识别）阶段已退役：原 worker 转写链路为断链死代码（请求参数空占位、
// tauri-request 无主线程应答器、audioPath 结构缺失），转写生成字幕由分步面板
// whisper 步与 Timeline 右键「生成字幕」承接（均经 buildWhisperSubtitleTrackForClip
// 命令化入轨）。工作流现从既有字幕轨的润色开始。
export type WorkflowStage = 'polish' | 'style' | 'export';
type StageStatus = 'idle' | 'running' | 'done' | 'error';

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
  polish: PolishState;
  style: StyleState;
  export: ExportState;
}

const INITIAL_STATE: SubtitleWorkflowState = {
  currentStage: 'polish',
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
    updatePolish,
    updateStyle,
    updateExport,
    goToStage,
    reset,
    completePolish,
    completeStyle,
    completeExport,
  };
}
