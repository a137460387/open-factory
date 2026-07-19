import { create } from 'zustand';
import type { DistributionPlatformId, DistributionPlatformSpec } from '@open-factory/editor-core';
import type { SmartCropResult } from '@open-factory/editor-core';
import type { DistributionTask, DistributionBatchResult } from '@open-factory/editor-core';
import type { DistributionSchedule, DistributionHistoryEntry } from '@open-factory/editor-core';
import type { FormatVariant, MultiFormatResult, FormatPreview } from '@open-factory/editor-core';
import type { PlatformAdaptation, AdaptationSuggestion } from '@open-factory/editor-core';
import type { GeneratedCover, CoverGenerationResult } from '@open-factory/editor-core';

type Updater<T> = T | ((current: T) => T);

function applyUpdater<T>(current: T, updater: Updater<T>): T {
  return typeof updater === 'function' ? (updater as (current: T) => T)(current) : updater;
}

// ─── 状态接口 ────────────────────────────────────────────

export interface DistributionState {
  /** 已选择的目标平台 */
  selectedPlatforms: DistributionPlatformId[];
  /** 各平台的裁剪结果 */
  cropResults: Map<string, SmartCropResult>;
  /** 当前批次 */
  currentBatch: DistributionBatchResult | null;
  /** 任务列表（带实时进度） */
  tasks: DistributionTask[];
  /** 发布计划列表 */
  schedules: DistributionSchedule[];
  /** 发布历史 */
  history: DistributionHistoryEntry[];
  /** 是否正在分析 */
  isAnalyzing: boolean;
  /** 输出目录 */
  outputDir: string;
  /** 文件名模板 */
  template: string;
  /** 多格式生成结果 */
  multiFormatResult: MultiFormatResult | null;
  /** 格式变体预览 */
  formatPreviews: Map<string, FormatPreview>;
  /** 平台适配方案 */
  platformAdaptations: Map<DistributionPlatformId, PlatformAdaptation>;
  /** 适配建议 */
  adaptationSuggestions: AdaptationSuggestion[];
  /** 封面生成结果 */
  coverResult: CoverGenerationResult | null;
  /** 是否正在生成多格式 */
  isGeneratingFormats: boolean;
  /** 是否正在生成封面 */
  isGeneratingCovers: boolean;

  // Setters
  setSelectedPlatforms: (updater: Updater<DistributionPlatformId[]>) => void;
  setCropResults: (updater: Updater<Map<string, SmartCropResult>>) => void;
  setCurrentBatch: (updater: Updater<DistributionBatchResult | null>) => void;
  setTasks: (updater: Updater<DistributionTask[]>) => void;
  setSchedules: (updater: Updater<DistributionSchedule[]>) => void;
  setHistory: (updater: Updater<DistributionHistoryEntry[]>) => void;
  setIsAnalyzing: (updater: Updater<boolean>) => void;
  setOutputDir: (updater: Updater<string>) => void;
  setTemplate: (updater: Updater<string>) => void;
  setMultiFormatResult: (updater: Updater<MultiFormatResult | null>) => void;
  setFormatPreviews: (updater: Updater<Map<string, FormatPreview>>) => void;
  setPlatformAdaptations: (updater: Updater<Map<DistributionPlatformId, PlatformAdaptation>>) => void;
  setAdaptationSuggestions: (updater: Updater<AdaptationSuggestion[]>) => void;
  setCoverResult: (updater: Updater<CoverGenerationResult | null>) => void;
  setIsGeneratingFormats: (updater: Updater<boolean>) => void;
  setIsGeneratingCovers: (updater: Updater<boolean>) => void;

  // 操作
  togglePlatform: (platformId: DistributionPlatformId) => void;
  selectAllPlatforms: (platformIds: DistributionPlatformId[]) => void;
  clearPlatforms: () => void;
  updateTaskProgress: (taskId: string, progress: number) => void;
  finishTask: (taskId: string) => void;
  failTask: (taskId: string, error: string) => void;
  cancelTask: (taskId: string) => void;
  addSchedule: (schedule: DistributionSchedule) => void;
  updateScheduleStatus: (scheduleId: string, status: DistributionSchedule['status'], error?: string) => void;
  addHistoryEntry: (entry: DistributionHistoryEntry) => void;
  reset: () => void;
}

// ─── 初始状态 ────────────────────────────────────────────

const INITIAL_STATE = {
  selectedPlatforms: [] as DistributionPlatformId[],
  cropResults: new Map<string, SmartCropResult>(),
  currentBatch: null as DistributionBatchResult | null,
  tasks: [] as DistributionTask[],
  schedules: [] as DistributionSchedule[],
  history: [] as DistributionHistoryEntry[],
  isAnalyzing: false,
  outputDir: '',
  template: '{project}-{platform}-{resolution}',
  multiFormatResult: null as MultiFormatResult | null,
  formatPreviews: new Map<string, FormatPreview>(),
  platformAdaptations: new Map<DistributionPlatformId, PlatformAdaptation>(),
  adaptationSuggestions: [] as AdaptationSuggestion[],
  coverResult: null as CoverGenerationResult | null,
  isGeneratingFormats: false,
  isGeneratingCovers: false,
};

// ─── Store ────────────────────────────────────────────

export const useDistributionStore = create<DistributionState>((set, get) => ({
  ...INITIAL_STATE,

  setSelectedPlatforms(updater) {
    set((s) => ({ selectedPlatforms: applyUpdater(s.selectedPlatforms, updater) }));
  },
  setCropResults(updater) {
    set((s) => ({ cropResults: applyUpdater(s.cropResults, updater) }));
  },
  setCurrentBatch(updater) {
    set((s) => ({ currentBatch: applyUpdater(s.currentBatch, updater) }));
  },
  setTasks(updater) {
    set((s) => ({ tasks: applyUpdater(s.tasks, updater) }));
  },
  setSchedules(updater) {
    set((s) => ({ schedules: applyUpdater(s.schedules, updater) }));
  },
  setHistory(updater) {
    set((s) => ({ history: applyUpdater(s.history, updater) }));
  },
  setIsAnalyzing(updater) {
    set((s) => ({ isAnalyzing: applyUpdater(s.isAnalyzing, updater) }));
  },
  setOutputDir(updater) {
    set((s) => ({ outputDir: applyUpdater(s.outputDir, updater) }));
  },
  setTemplate(updater) {
    set((s) => ({ template: applyUpdater(s.template, updater) }));
  },
  setMultiFormatResult(updater) {
    set((s) => ({ multiFormatResult: applyUpdater(s.multiFormatResult, updater) }));
  },
  setFormatPreviews(updater) {
    set((s) => ({ formatPreviews: applyUpdater(s.formatPreviews, updater) }));
  },
  setPlatformAdaptations(updater) {
    set((s) => ({ platformAdaptations: applyUpdater(s.platformAdaptations, updater) }));
  },
  setAdaptationSuggestions(updater) {
    set((s) => ({ adaptationSuggestions: applyUpdater(s.adaptationSuggestions, updater) }));
  },
  setCoverResult(updater) {
    set((s) => ({ coverResult: applyUpdater(s.coverResult, updater) }));
  },
  setIsGeneratingFormats(updater) {
    set((s) => ({ isGeneratingFormats: applyUpdater(s.isGeneratingFormats, updater) }));
  },
  setIsGeneratingCovers(updater) {
    set((s) => ({ isGeneratingCovers: applyUpdater(s.isGeneratingCovers, updater) }));
  },

  togglePlatform(platformId) {
    set((s) => {
      const exists = s.selectedPlatforms.includes(platformId);
      return {
        selectedPlatforms: exists
          ? s.selectedPlatforms.filter((id) => id !== platformId)
          : [...s.selectedPlatforms, platformId],
      };
    });
  },

  selectAllPlatforms(platformIds) {
    set({ selectedPlatforms: platformIds });
  },

  clearPlatforms() {
    set({ selectedPlatforms: [], cropResults: new Map() });
  },

  updateTaskProgress(taskId, progress) {
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, progress: Math.max(0, Math.min(1, progress)) } : t)),
    }));
  },

  finishTask(taskId) {
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, status: 'success' as const, progress: 1 } : t)),
    }));
  },

  failTask(taskId, error) {
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, status: 'error' as const, error } : t)),
    }));
  },

  cancelTask(taskId) {
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, status: 'canceled' as const } : t)),
    }));
  },

  addSchedule(schedule) {
    set((s) => ({ schedules: [...s.schedules, schedule] }));
  },

  updateScheduleStatus(scheduleId, status, error) {
    set((s) => ({
      schedules: s.schedules.map((sch) =>
        sch.id === scheduleId ? { ...sch, status, error, updatedAt: new Date().toISOString() } : sch,
      ),
    }));
  },

  addHistoryEntry(entry) {
    set((s) => ({
      history: [entry, ...s.history].slice(0, 200),
    }));
  },

  reset() {
    set(INITIAL_STATE);
  },
}));
