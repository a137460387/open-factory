export type SmartRoughCutStep = 'scene' | 'silence' | 'whisper';
export type SmartRoughCutStepStatus = 'idle' | 'running' | 'complete' | 'error';

export interface SmartRoughCutStepState {
  status: SmartRoughCutStepStatus;
  error?: string;
}
export interface SmartRoughCutReport {
  sceneSplits: number;
  removedSilenceSeconds: number;
  subtitleClips: number;
}

export interface SmartRoughCutState {
  steps: Record<SmartRoughCutStep, SmartRoughCutStepState>;
  report: SmartRoughCutReport;
}

export function createInitialSmartRoughCutState(): SmartRoughCutState {
  return {
    steps: {
      scene: { status: 'idle' },
      silence: { status: 'idle' },
      whisper: { status: 'idle' }
    },
    report: {
      sceneSplits: 0,
      removedSilenceSeconds: 0,
      subtitleClips: 0
    }
  };
}

export function markSmartRoughCutStepRunning(state: SmartRoughCutState, step: SmartRoughCutStep): SmartRoughCutState {
  return {
    ...state,
    steps: {
      ...state.steps,
      [step]: { status: 'running' }
    }
  };
}

export function markSmartRoughCutStepComplete(
  state: SmartRoughCutState,
  step: SmartRoughCutStep,
  reportPatch: Partial<SmartRoughCutReport> = {}
): SmartRoughCutState {
  return {
    steps: {
      ...state.steps,
      [step]: { status: 'complete' }
    },
    report: {
      ...state.report,
      ...reportPatch
    }
  };
}

export function markSmartRoughCutStepError(state: SmartRoughCutState, step: SmartRoughCutStep, error: string): SmartRoughCutState {
  return {
    ...state,
    steps: {
      ...state.steps,
      [step]: { status: 'error', error }
    }
  };
}
