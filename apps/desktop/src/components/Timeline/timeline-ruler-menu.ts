import { zhCN } from '../../i18n/strings';

export type RulerContextMenuAction = 'add-marker' | 'add-protected-range' | 'set-in' | 'set-out' | 'jump-timecode';

export interface RulerContextMenuItem {
  action: RulerContextMenuAction;
  label: string;
  testId: string;
}

export function buildRulerContextMenuItems(timelineLabels = zhCN.timeline): RulerContextMenuItem[] {
  return [
    { action: 'add-marker', label: timelineLabels.rulerAddMarkerHere, testId: 'ruler-context-add-marker' },
    { action: 'add-protected-range', label: timelineLabels.rulerAddProtectedRange, testId: 'ruler-context-add-protected-range' },
    { action: 'set-in', label: timelineLabels.rulerSetInPoint, testId: 'ruler-context-set-in' },
    { action: 'set-out', label: timelineLabels.rulerSetOutPoint, testId: 'ruler-context-set-out' },
    { action: 'jump-timecode', label: timelineLabels.rulerJumpToTimecode, testId: 'ruler-context-jump-timecode' }
  ];
}
