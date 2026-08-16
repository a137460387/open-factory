import type {
  Clip,
  ClipGroup,
  CollaborationClipLock,
  AnomalyInterval,
  KeyframeProperty,
  TimelineLabelColor,
  TransitionType,
} from '@open-factory/editor-core';
import type { SelectedKeyframeRef } from '../../store/editorStore';

type DragMode = 'move' | 'trim-left' | 'trim-right' | 'rolling-trim' | 'slip' | 'slide' | 'playhead' | 'keyframe';

export interface DragState {
  mode: DragMode;
  clip?: Clip;
  rightClip?: Clip;
  clipIds?: string[];
  keyframeProperty?: KeyframeProperty;
  keyframeId?: string;
  keyframes?: SelectedKeyframeRef[];
  keyframeSelectionOnly?: boolean;
  startX: number;
  previewStart: number;
  previewDuration: number;
  previewTrimStart: number;
  previewTrimEnd: number;
  startByClipId?: Record<string, number>;
  previewStartsByClipId?: Record<string, number>;
  previewClipsById?: Record<string, Clip>;
  previewKeyframeTime?: number;
  previewKeyframeDelta?: number;
  keyframeStartTimes?: Record<string, number>;
  previewKeyframeTimes?: Record<string, number>;
  previewRollingDelta?: number;
  previewSlipDelta?: number;
  previewSlideDelta?: number;
}

export const TRACK_HEIGHT = 60;
export const LABEL_WIDTH = 160;
export const TRACK_DRAG_MIME = 'application/x-open-factory-track-id';

export interface VolumeEnvelopePointRequest {
  clipId: string;
  time: number;
  value: number;
  keyframeId?: string;
}

export interface VolumeEnvelopeMenuRequest {
  x: number;
  y: number;
  clipId: string;
}

export interface TransitionMenuRequest {
  x: number;
  y: number;
  fromClipId: string;
  toClipId: string;
  existingTransitionId?: string;
  existingType?: TransitionType;
  existingDuration?: number;
}

export interface ClipMenuRequest {
  x: number;
  y: number;
  clipId: string;
  clipType: Clip['type'];
}

export interface GapMenuRequest {
  x: number;
  y: number;
  trackId: string;
  time: number;
}
