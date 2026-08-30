import type { Clip, KeyframeEasing, KeyframeProperty } from '../../model';

export interface TimelineAccessor {
  getTimeline(): import('../../model').Timeline;
  setTimeline(timeline: import('../../model').Timeline): void;
}

export interface ProjectAccessor {
  getProject(): import('../../model').Project;
  setProject(project: import('../../model').Project): void;
}

export type ReplaceableMediaClip = Extract<Clip, { mediaId: string }>;

export interface KeyframeSelectionRef {
  clipId: string;
  property: KeyframeProperty;
  keyframeId: string;
}

export type BatchKeyframeEditOperation =
  | { type: 'shift'; delta: number }
  | { type: 'scale-time'; factor: number; center?: number }
  | { type: 'delete' }
  | { type: 'easing'; easing: KeyframeEasing }
  | { type: 'distribute-time' }
  | { type: 'align-value'; value?: number };
