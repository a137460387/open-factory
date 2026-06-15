export interface ReviewModeShellVisibility {
  showEditingToolbar: boolean;
  showLeftPanel: boolean;
  showRightPanel: boolean;
  showTimeline: boolean;
  showTimelineResizeHandle: boolean;
  showExportControls: boolean;
}

export function getReviewModeShellVisibility(reviewMode: boolean): ReviewModeShellVisibility {
  if (!reviewMode) {
    return {
      showEditingToolbar: true,
      showLeftPanel: true,
      showRightPanel: true,
      showTimeline: true,
      showTimelineResizeHandle: true,
      showExportControls: true
    };
  }
  return {
    showEditingToolbar: false,
    showLeftPanel: false,
    showRightPanel: false,
    showTimeline: false,
    showTimelineResizeHandle: false,
    showExportControls: false
  };
}
