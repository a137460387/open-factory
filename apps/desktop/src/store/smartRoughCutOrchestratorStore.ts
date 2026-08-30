/**
 * 智能粗剪分步编排 Store
 *
 * 承载分步编排（scene/silence/whisper/dialogue/broll/rhythm）的步骤状态机与累计报告，
 * 供分步编排面板 SmartRoughCutStepPanel 消费。
 * 一键编排面板家族（SmartRoughCutOrchestratorPanel + orchestrateSmartRoughCut core）已退役删除。
 */
import { create } from 'zustand';
import {
  createInitialSmartRoughCutState,
  markSmartRoughCutStepComplete,
  markSmartRoughCutStepError,
  markSmartRoughCutStepRunning,
  type SmartRoughCutReport as SmartRoughCutStepReport,
  type SmartRoughCutState as SmartRoughCutStepState,
  type SmartRoughCutStep,
} from '../components/SmartRoughCut/smart-rough-cut-state';

export interface SmartRoughCutOrchestratorState {
  /** 分步编排状态（各步骤状态机 + 累计报告），供 SmartRoughCutStepPanel 消费 */
  stepState: SmartRoughCutStepState;

  /** 标记分步步骤为运行中 */
  markStepRunning: (step: SmartRoughCutStep) => void;
  /** 标记分步步骤完成，并合并报告计数 */
  markStepComplete: (step: SmartRoughCutStep, reportPatch?: Partial<SmartRoughCutStepReport>) => void;
  /** 标记分步步骤失败 */
  markStepError: (step: SmartRoughCutStep, message: string) => void;
  /** 重置分步状态 */
  reset: () => void;
}

export const useSmartRoughCutOrchestratorStore = create<SmartRoughCutOrchestratorState>((set) => ({
  stepState: createInitialSmartRoughCutState(),

  markStepRunning: (step) => set((state) => ({ stepState: markSmartRoughCutStepRunning(state.stepState, step) })),

  markStepComplete: (step, reportPatch) =>
    set((state) => ({ stepState: markSmartRoughCutStepComplete(state.stepState, step, reportPatch) })),

  markStepError: (step, message) =>
    set((state) => ({ stepState: markSmartRoughCutStepError(state.stepState, step, message) })),

  reset: () => set({ stepState: createInitialSmartRoughCutState() }),
}));
