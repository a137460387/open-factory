// Re-export accessor types
export interface TimelineAccessor {
  getTimeline(): import('../../model').Timeline;
  setTimeline(timeline: import('../../model').Timeline): void;
}

export interface ProjectAccessor {
  getProject(): import('../../model').Project;
  setProject(project: import('../../model').Project): void;
}

export * from './annotation-commands';
export * from './bookmark-commands';
export * from './clip-add-commands';
export * from './clip-edit-commands';
export * from './clip-group-commands';
export * from './clip-layout-commands';
export * from './clip-move-commands';
export * from './clip-smart-commands';
export * from './clip-split-commands';
export * from './clip-trim-commands';
export * from './clip-update-commands';
export * from './color-grading-commands';
export * from './effect-commands';
export * from './keyframe-commands';
export * from './keyframe-edit-commands';
export * from './marker-commands';
export * from './mask-commands';
export * from './media-commands';
export * from './media-folder-commands';
export * from './multicam-commands';
export * from './multicam-edit-commands';
export * from './project-commands';
export * from './subclip-commands';
export * from './subtitle-commands';
export * from './track-commands';
export * from './transition-commands';
export * from './utils';
export * from './utils-keyframe';
export * from './utils-media';
export * from './utils-nested';
