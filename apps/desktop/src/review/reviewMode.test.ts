import { describe, expect, it } from 'vitest';
import { getReviewModeShellVisibility } from './reviewMode';

describe('review mode shell visibility', () => {
  it('hides editing controls, panels, timeline, and export controls in review mode', () => {
    expect(getReviewModeShellVisibility(true)).toEqual({
      showEditingToolbar: false,
      showLeftPanel: false,
      showRightPanel: false,
      showTimeline: false,
      showTimelineResizeHandle: false,
      showExportControls: false
    });
  });

  it('keeps the full editor visible outside review mode', () => {
    expect(getReviewModeShellVisibility(false)).toEqual({
      showEditingToolbar: true,
      showLeftPanel: true,
      showRightPanel: true,
      showTimeline: true,
      showTimelineResizeHandle: true,
      showExportControls: true
    });
  });
});
