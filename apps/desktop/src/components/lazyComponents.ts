import { lazy } from 'react';
export const ComplexityScorePanel = lazy(() =>
  import('../complexity/ComplexityScorePanel').then((module) => ({ default: module.ComplexityScorePanel })),
);
export const AutoAudioSyncDialog = lazy(() =>
  import('../audio-sync/AutoAudioSyncDialog').then((module) => ({ default: module.AutoAudioSyncDialog })),
);
export const CommandPalette = lazy(() =>
  import('./CommandPalette/CommandPalette').then((module) => ({ default: module.CommandPalette })),
);
export const GestureTutorialOverlay = lazy(() =>
  import('./GestureControl/GestureTutorial').then((module) => ({ default: module.GestureTutorialOverlay })),
);
export const RoughCutComparePanel = lazy(() =>
  import('./SmartRoughCut/RoughCutComparePanel').then((module) => ({ default: module.RoughCutComparePanel })),
);
