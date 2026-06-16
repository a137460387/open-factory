export type TutorialStepId =
  | 'import-media'
  | 'add-clip'
  | 'play-preview'
  | 'trim-clip'
  | 'adjust-volume'
  | 'add-text'
  | 'export-video'
  | 'save-project';

export interface TutorialStepDefinition {
  id: TutorialStepId;
  targetSelector: string;
}

export interface TutorialSignals {
  mediaImported: boolean;
  clipOnTimeline: boolean;
  previewPlayed: boolean;
  clipTrimmed: boolean;
  volumeAdjusted: boolean;
  textAdded: boolean;
  videoExported: boolean;
  projectSaved: boolean;
}

export interface TutorialProgressSettings {
  tutorialStep: number;
  tutorialSkipped: boolean;
  tutorialCompleted: boolean;
}

export const TUTORIAL_STEP_COUNT = 8;

export const DEFAULT_TUTORIAL_SIGNALS: TutorialSignals = {
  mediaImported: false,
  clipOnTimeline: false,
  previewPlayed: false,
  clipTrimmed: false,
  volumeAdjusted: false,
  textAdded: false,
  videoExported: false,
  projectSaved: false
};

export function normalizeTutorialProgressSettings(settings: Partial<TutorialProgressSettings> | undefined): TutorialProgressSettings {
  const step = typeof settings?.tutorialStep === 'number' && Number.isFinite(settings.tutorialStep) ? Math.round(settings.tutorialStep) : 0;
  return {
    tutorialStep: Math.min(TUTORIAL_STEP_COUNT, Math.max(0, step)),
    tutorialSkipped: settings?.tutorialSkipped === true,
    tutorialCompleted: settings?.tutorialCompleted === true || step >= TUTORIAL_STEP_COUNT
  };
}

export function shouldShowTutorial(progress: TutorialProgressSettings): boolean {
  return !progress.tutorialSkipped && !progress.tutorialCompleted;
}

export function getTutorialStepId(stepIndex: number): TutorialStepId | undefined {
  return TUTORIAL_STEPS[stepIndex]?.id;
}

export function isTutorialStepComplete(stepId: TutorialStepId, signals: TutorialSignals): boolean {
  switch (stepId) {
    case 'import-media':
      return signals.mediaImported;
    case 'add-clip':
      return signals.clipOnTimeline;
    case 'play-preview':
      return signals.previewPlayed;
    case 'trim-clip':
      return signals.clipTrimmed;
    case 'adjust-volume':
      return signals.volumeAdjusted;
    case 'add-text':
      return signals.textAdded;
    case 'export-video':
      return signals.videoExported;
    case 'save-project':
      return signals.projectSaved;
  }
}

export function advanceTutorialProgress(progress: TutorialProgressSettings, signals: TutorialSignals): TutorialProgressSettings {
  const normalized = normalizeTutorialProgressSettings(progress);
  if (!shouldShowTutorial(normalized)) {
    return normalized;
  }
  const stepId = getTutorialStepId(normalized.tutorialStep);
  if (!stepId || !isTutorialStepComplete(stepId, signals)) {
    return normalized;
  }
  const nextStep = normalized.tutorialStep + 1;
  return {
    tutorialStep: nextStep,
    tutorialSkipped: false,
    tutorialCompleted: nextStep >= TUTORIAL_STEP_COUNT
  };
}

export function skipTutorialProgress(progress: TutorialProgressSettings): TutorialProgressSettings {
  const normalized = normalizeTutorialProgressSettings(progress);
  return {
    ...normalized,
    tutorialSkipped: true,
    tutorialCompleted: false
  };
}

export const TUTORIAL_STEPS: TutorialStepDefinition[] = [
  {
    id: 'import-media',
    targetSelector: '[data-testid="import-media-button"], [data-testid="toolbar-import-media-button"]'
  },
  {
    id: 'add-clip',
    targetSelector: '[data-testid^="add-to-timeline-"], [data-testid="timeline-root"]'
  },
  {
    id: 'play-preview',
    targetSelector: '[data-testid="toolbar-playback-button"]'
  },
  {
    id: 'trim-clip',
    targetSelector: '[data-testid^="timeline-trim-right-"], [data-testid^="timeline-trim-left-"]'
  },
  {
    id: 'adjust-volume',
    targetSelector: '[data-testid="clip-volume-input"]'
  },
  {
    id: 'add-text',
    targetSelector: '[data-testid="add-text-clip-button"]'
  },
  {
    id: 'export-video',
    targetSelector: '[data-testid="toolbar-export-button"]'
  },
  {
    id: 'save-project',
    targetSelector: '[data-testid="toolbar-save-project-button"]'
  }
];
