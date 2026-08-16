import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type {
  CanvasPoint,
  CanvasTransformHandle,
  ChromaKeyColor,
  Clip,
  ClipPatch,
  ClipTransformBox,
  PathPoint,
  PathPointHandle,
  ReviewAnnotationType,
  Transform,
} from '@open-factory/editor-core';
import type { PreviewPixelCoordinates } from '../../lib/preview/frame-inspector';
import type { PreviewCompareMode } from '../../lib/preview/compare';
import type { GpuPreviewMetrics } from '../../lib/preview/gpu-acceleration';
import type { PreviewPerformanceSettings } from '../../lib/preview/preview-performance';
import type { PreviewRenderer, PreviewFrameReadback } from '../../lib/preview/renderer';

export const PREVIEW_CANVAS_WIDTH = 1280;
export const PREVIEW_CANVAS_HEIGHT = 720;
export const CANVAS_TRANSFORM_HANDLES: CanvasTransformHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export interface EditableCanvasClip {
  clip: Clip;
  box: ClipTransformBox;
  sourceWidth: number;
  sourceHeight: number;
}

export interface CanvasTransformDrag {
  pointerId: number;
  clipId: string;
  type: 'move' | 'scale' | 'rotate';
  handle?: CanvasTransformHandle;
  sourceWidth: number;
  sourceHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  startPoint: CanvasPoint;
  startTransform: Transform;
  command?: import('@open-factory/editor-core').UpdateClipCommand;
  patch?: ClipPatch;
}

export interface PanoramaPreviewDrag {
  pointerId: number;
  clipId: string;
  startClientX: number;
  startClientY: number;
  startPanorama: ReturnType<typeof import('@open-factory/editor-core').normalizeClipPanoramaView>;
  command?: import('@open-factory/editor-core').UpdateClipCommand;
  patch?: ClipPatch;
}

export interface PreviewPanDrag {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPan: { x: number; y: number };
}

export interface FrameInspectorSample {
  coordinates: PreviewPixelCoordinates;
  rgb: ChromaKeyColor;
  hsl: ReturnType<typeof import('../../lib/preview/frame-inspector').rgbToHsl>;
  hex: string;
  position: { x: number; y: number };
  swatches: ChromaKeyColor[];
  sampled?: boolean;
}

export interface PreviewPixelRead {
  coordinates: PreviewPixelCoordinates;
  rgb: ChromaKeyColor;
  swatches: ChromaKeyColor[];
}

export interface ReviewAnnotationDrag {
  pointerId: number;
  type: Exclude<ReviewAnnotationType, 'text'>;
  startPoint: CanvasPoint;
  canvasWidth: number;
  canvasHeight: number;
}

export interface PathMaskDrag {
  pointerId: number;
  clipId: string;
  maskId: string;
  pointIndex: number;
  target: 'anchor' | 'handleIn' | 'handleOut';
  startPoint: PathPointHandle;
  startPath: PathPoint[];
  command?: import('@open-factory/editor-core').UpdateMaskCommand;
  patch?: { path: PathPoint[] };
}

export interface FrameSearchCandidate {
  id: string;
  type: 'marker' | 'clip';
  label: string;
  time: number;
}

export interface PreviewCanvasProps {
  safeFrameGuides?: boolean;
  previewPerformance?: import('../../lib/preview/preview-performance').PreviewPerformanceSettings;
  colorScopesVisible?: boolean;
  onColorScopesVisibleChange?(visible: boolean): void;
  reviewMode?: boolean;
  onProfilerFrame?(sample: import('@open-factory/editor-core').ProfilerFrameSample): void;
  onAddReviewAnnotation?(
    annotation: Omit<import('@open-factory/editor-core').ReviewAnnotation, 'id'> &
      Partial<Pick<import('@open-factory/editor-core').ReviewAnnotation, 'id'>>,
  ): void;
  onExportReviewReport?(): void;
}
