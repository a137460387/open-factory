import { useState, useCallback } from 'react';
import type { SubtitleClip } from '@open-factory/editor-core';

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
