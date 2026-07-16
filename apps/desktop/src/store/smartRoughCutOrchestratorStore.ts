/**
 * 智能粗剪编排器 Store
 *
 * 管理统一编排流程的状态：分析进度、建议列表、报告。
 * 遵循 v4.26.0 模块化架构 —— 独立 Zustand Store。
 */
import { create } from 'zustand';
import type {
  SmartRoughCutSuggestion,
  SmartRoughCutOrchestrationResult,
  SmartRoughCutReport,
  SmartRoughCutOrchestratorOptions,
  SmartRoughCutSuggestionType,
} from '@open-factory/editor-core';
import {
  orchestrateSmartRoughCut,
  toggleSuggestionSelection,
  setAllSuggestionSelection,
  selectSuggestionsByType,
  getSelectedSuggestions,
  reorderSuggestions,
} from '@open-factory/editor-core';
import type { SmartRoughCutAnalysisData } from '@open-factory/editor-core';

export type OrchestratorPhase = 'idle' | 'analyzing' | 'ready' | 'applying' | 'done' | 'error';

export interface SmartRoughCutOrchestratorState {
  /** 当前阶段 */
  phase: OrchestratorPhase;
  /** 分析进度 0-100 */
  progress: number;
  /** 当前分析步骤描述 */
  progressMessage: string;
  /** 编排建议列表 */
  suggestions: SmartRoughCutSuggestion[];
  /** 编排报告 */
  report: SmartRoughCutReport | null;
  /** 错误信息 */
  error: string | null;
  /** 编排选项 */
  options: SmartRoughCutOrchestratorOptions;
  /** 最近一次分析的原始数据（用于重新编排） */
  lastAnalysisData: SmartRoughCutAnalysisData | null;

  // ── Actions ──
  /** 运行编排（接受预分析数据） */
  runOrchestration: (data: SmartRoughCutAnalysisData) => void;
  /** 设置进度 */
  setProgress: (progress: number, message: string) => void;
  /** 切换单个建议选中 */
  toggleSuggestion: (id: string) => void;
  /** 全选/全不选 */
  setAllSelected: (selected: boolean) => void;
  /** 按类型选择 */
  selectByType: (type: SmartRoughCutSuggestionType, selected: boolean) => void;
  /** 重排序建议 */
  reorder: (fromIndex: number, toIndex: number) => void;
  /** 更新编排选项并重新编排 */
  updateOptions: (options: Partial<SmartRoughCutOrchestratorOptions>) => void;
  /** 设置阶段 */
  setPhase: (phase: OrchestratorPhase) => void;
  /** 设置错误 */
  setError: (error: string | null) => void;
  /** 重置 */
  reset: () => void;
}

const DEFAULT_OPTIONS: SmartRoughCutOrchestratorOptions = {
  enableSceneSplit: true,
  enableSilenceRemoval: true,
  enableSubtitleGeneration: true,
  enableDialogueExtraction: true,
  enableRhythmCut: true,
  enableEmotionHighlight: true,
  enableNarrativeStructure: true,
  minConfidence: 0.3,
  maxSuggestions: 200,
};

export const useSmartRoughCutOrchestratorStore = create<SmartRoughCutOrchestratorState>((set, get) => ({
  phase: 'idle',
  progress: 0,
  progressMessage: '',
  suggestions: [],
  report: null,
  error: null,
  options: { ...DEFAULT_OPTIONS },
  lastAnalysisData: null,

  runOrchestration: (data) => {
    const { options } = get();
    set({ phase: 'analyzing', progress: 0, progressMessage: '正在分析...', error: null, lastAnalysisData: data });

    try {
      const result: SmartRoughCutOrchestrationResult = orchestrateSmartRoughCut(data, options);
      set({
        phase: 'ready',
        progress: 100,
        progressMessage: '分析完成',
        suggestions: result.suggestions,
        report: result.report,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '编排失败';
      set({ phase: 'error', progress: 0, progressMessage: '', error: message });
    }
  },

  setProgress: (progress, message) => {
    set({ progress, progressMessage: message });
  },

  toggleSuggestion: (id) => {
    set((state) => ({ suggestions: toggleSuggestionSelection(state.suggestions, id) }));
  },

  setAllSelected: (selected) => {
    set((state) => ({ suggestions: setAllSuggestionSelection(state.suggestions, selected) }));
  },

  selectByType: (type, selected) => {
    set((state) => ({ suggestions: selectSuggestionsByType(state.suggestions, type, selected) }));
  },

  reorder: (fromIndex, toIndex) => {
    set((state) => ({ suggestions: reorderSuggestions(state.suggestions, fromIndex, toIndex) }));
  },

  updateOptions: (patch) => {
    const { lastAnalysisData, options } = get();
    const newOptions = { ...options, ...patch };
    set({ options: newOptions });
    if (lastAnalysisData) {
      const result = orchestrateSmartRoughCut(lastAnalysisData, newOptions);
      set({
        suggestions: result.suggestions,
        report: result.report,
      });
    }
  },

  setPhase: (phase) => set({ phase }),

  setError: (error) => set({ error, phase: error ? 'error' : get().phase }),

  reset: () =>
    set({
      phase: 'idle',
      progress: 0,
      progressMessage: '',
      suggestions: [],
      report: null,
      error: null,
      lastAnalysisData: null,
    }),
}));
