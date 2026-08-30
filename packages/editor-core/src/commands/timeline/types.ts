export interface TimelineAccessor {
  getTimeline(): import('../../model').Timeline;
  setTimeline(timeline: import('../../model').Timeline): void;
}

export interface ProjectAccessor {
  getProject(): import('../../model').Project;
  setProject(project: import('../../model').Project): void;
}
