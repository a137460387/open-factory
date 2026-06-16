import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TUTORIAL_SIGNALS,
  TUTORIAL_STEP_COUNT,
  advanceTutorialProgress,
  getTutorialStepId,
  isTutorialStepComplete,
  normalizeTutorialProgressSettings,
  shouldShowTutorial,
  skipTutorialProgress,
  type TutorialProgressSettings,
  type TutorialSignals
} from './tutorialState';

function progress(step: number): TutorialProgressSettings {
  return { tutorialStep: step, tutorialSkipped: false, tutorialCompleted: false };
}

function signals(patch: Partial<TutorialSignals>): TutorialSignals {
  return { ...DEFAULT_TUTORIAL_SIGNALS, ...patch };
}

describe('tutorial state machine', () => {
  it('normalizes persisted tutorial progress boundaries', () => {
    expect(normalizeTutorialProgressSettings({ tutorialStep: -4 })).toEqual({ tutorialStep: 0, tutorialSkipped: false, tutorialCompleted: false });
    expect(normalizeTutorialProgressSettings({ tutorialStep: 99 })).toEqual({ tutorialStep: TUTORIAL_STEP_COUNT, tutorialSkipped: false, tutorialCompleted: true });
    expect(normalizeTutorialProgressSettings({ tutorialStep: 2.6, tutorialSkipped: true })).toEqual({ tutorialStep: 3, tutorialSkipped: true, tutorialCompleted: false });
  });

  it('maps each tutorial step to its required completion signal', () => {
    const cases: Array<[number, Partial<TutorialSignals>]> = [
      [0, { mediaImported: true }],
      [1, { clipOnTimeline: true }],
      [2, { previewPlayed: true }],
      [3, { clipTrimmed: true }],
      [4, { volumeAdjusted: true }],
      [5, { textAdded: true }],
      [6, { videoExported: true }],
      [7, { projectSaved: true }]
    ];

    for (const [index, patch] of cases) {
      const stepId = getTutorialStepId(index);
      expect(stepId).toBeTruthy();
      expect(isTutorialStepComplete(stepId!, signals(patch))).toBe(true);
      expect(isTutorialStepComplete(stepId!, DEFAULT_TUTORIAL_SIGNALS)).toBe(false);
    }
  });

  it('advances only after the current step is complete', () => {
    expect(advanceTutorialProgress(progress(0), DEFAULT_TUTORIAL_SIGNALS)).toEqual(progress(0));
    expect(advanceTutorialProgress(progress(0), signals({ mediaImported: true }))).toEqual(progress(1));
    expect(advanceTutorialProgress(progress(1), signals({ mediaImported: true }))).toEqual(progress(1));
    expect(advanceTutorialProgress(progress(1), signals({ clipOnTimeline: true }))).toEqual(progress(2));
  });

  it('marks the tutorial complete after the final save step', () => {
    expect(advanceTutorialProgress(progress(7), signals({ projectSaved: true }))).toEqual({
      tutorialStep: 8,
      tutorialSkipped: false,
      tutorialCompleted: true
    });
  });

  it('does not show skipped or completed tutorials', () => {
    expect(shouldShowTutorial(progress(0))).toBe(true);
    expect(shouldShowTutorial(skipTutorialProgress(progress(3)))).toBe(false);
    expect(shouldShowTutorial({ tutorialStep: 8, tutorialSkipped: false, tutorialCompleted: true })).toBe(false);
  });
});
