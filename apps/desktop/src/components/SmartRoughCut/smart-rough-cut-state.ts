export type SmartRoughCutStep = 'scene' | 'silence' | 'whisper' | 'dialogue' | 'broll' | 'rhythm';
export type SmartRoughCutStepStatus = 'idle' | 'running' | 'complete' | 'error';

export interface SmartRoughCutStepState {
  status: SmartRoughCutStepStatus;
  error?: string;
}
export interface SmartRoughCutReport {
  sceneSplits: number;
  removedSilenceSeconds: number;
  subtitleClips: number;
  dialogueClips: number;
  brollClips: number;
  rhythmClips: number;
}

export interface SmartRoughCutState {
  steps: Record<SmartRoughCutStep, SmartRoughCutStepState>;
  report: SmartRoughCutReport;
}

export type SmartRoughCutSelection = Record<string, boolean>;

export function createInitialSmartRoughCutState(): SmartRoughCutState {
  return {
    steps: {
      scene: { status: 'idle' },
      silence: { status: 'idle' },
      whisper: { status: 'idle' },
      dialogue: { status: 'idle' },
      broll: { status: 'idle' },
      rhythm: { status: 'idle' }
    },
    report: {
      sceneSplits: 0,
      removedSilenceSeconds: 0,
      subtitleClips: 0,
      dialogueClips: 0,
      brollClips: 0,
      rhythmClips: 0
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

export function createSmartRoughCutSelection(ids: string[], selected = true): SmartRoughCutSelection {
  return Object.fromEntries(ids.map((id) => [id, selected]));
}

export function toggleSmartRoughCutSelection(selection: SmartRoughCutSelection, id: string, selected?: boolean): SmartRoughCutSelection {
  if (!(id in selection)) {
    return selection;
  }
  return {
    ...selection,
    [id]: selected ?? !selection[id]
  };
}

export function setAllSmartRoughCutSelection(selection: SmartRoughCutSelection, selected: boolean): SmartRoughCutSelection {
  return Object.fromEntries(Object.keys(selection).map((id) => [id, selected]));
}

export function getSelectedSmartRoughCutIds(selection: SmartRoughCutSelection): string[] {
  return Object.entries(selection)
    .filter(([, selected]) => selected)
    .map(([id]) => id);
}
