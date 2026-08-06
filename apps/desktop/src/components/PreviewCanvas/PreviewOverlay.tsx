import type {PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent} from 'react';
import type {ClipMask, ReviewAnnotation} from '@open-factory/editor-core';
import {isPathMaskClosed} from '@open-factory/editor-core';
import type {EditableCanvasClip} from './types';
import {canvasPointStyle, canvasBoxStyle, canvasHandleCursor, buildCanvasPathMaskSvgPath, resolvePathHandle, pathPointToCanvasPoint, rgbCss} from './utils';
import {CANVAS_TRANSFORM_HANDLES, PREVIEW_CANVAS_WIDTH, PREVIEW_CANVAS_HEIGHT} from './types';
import {zhCN} from '../../i18n/strings';
import type {CanvasTransformDrag, PathMaskDrag} from './types';
import type {CanvasTransformHandle} from '@open-factory/editor-core';
export interface PreviewOverlayProps {
  safeFrameGuides: boolean;
  reviewMode: boolean;
  canvasEditMode: boolean;
  frameInspectMode: boolean;
  selectedEditableClip: EditableCanvasClip | undefined;
  selectedPathMask: ClipMask | undefined;
  selectedMulticamClip: Extract<import('@open-factory/editor-core').Clip, { type: 'nested-sequence' }> | undefined;
  selectedMulticamSequence: import('@open-factory/editor-core').Sequence | undefined;
  selectedPanoramaClip: import('@open-factory/editor-core').Clip | undefined;
  chromaKeyPickTarget: EditableCanvasClip | undefined;
  project: import('@open-factory/editor-core').Project;
  playheadTime: number;
  fps: number;
  multicamLiveMode: boolean;
  isPlaying: boolean;
  frameInspectorSample: import('./types').FrameInspectorSample | undefined;
  selectedInspectorClip: import('@open-factory/editor-core').Clip | undefined;
  compareEnabled: boolean;
  compareShowsDifference: boolean;
  compareMode: PreviewCompareMode | 'off';
  compareSplitRatio: number;
  compareDividerDragging: boolean;
  onCompareDividerDraggingChange: (dragging: boolean) => void;
  previewRenderSize: { width: number; height: number };
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  originalCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  differenceCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  previewSurfaceRef: React.RefObject<HTMLDivElement | null>;
  previewSurfaceStyle: import('react').CSSProperties;
  previewZoom: number;
  // Interaction handlers
  onBeginReviewAnnotation: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onEndReviewAnnotation: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onBeginCanvasHitDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onUpdateCanvasTransformDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onEndCanvasTransformDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onBeginCanvasTransformDrag: (event: ReactPointerEvent<HTMLElement>, item: EditableCanvasClip, type: CanvasTransformDrag['type'], handle?: CanvasTransformHandle) => void;
  onBeginPanoramaPreviewDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onUpdatePanoramaPreviewDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onEndPanoramaPreviewDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onUpdatePanoramaFov: (event: import('react').WheelEvent<HTMLDivElement>) => void;
  onPickChromaKeyColor: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onUpdateFrameInspector: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onClearFrameInspector: () => void;
  onSampleFrameInspectorColor: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onApplyFrameInspectorColor: () => void;
  onAddPathMaskAnchor: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onCloseSelectedPathMask: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onBeginPathMaskDrag: (event: ReactPointerEvent<HTMLElement>, item: EditableCanvasClip, mask: ClipMask, pointIndex: number, target: PathMaskDrag['target']) => void;
  onUpdatePathMaskDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onEndPathMaskDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onUpdateCompareSplit: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onMulticamLiveModeChange: (enabled: boolean) => void;
  onSelectMulticamAngle: (angleId: string) => void;
  onTrimMulticamSwitch: (switchId: string, frameDelta: number) => void;
}

export function PreviewOverlay(props: PreviewOverlayProps) {
  const {
    safeFrameGuides, reviewMode, canvasEditMode, frameInspectMode,
    selectedEditableClip, selectedPathMask, selectedMulticamClip, selectedMulticamSequence,
    selectedPanoramaClip, chromaKeyPickTarget, project, playheadTime, fps,
    multicamLiveMode, isPlaying, frameInspectorSample, selectedInspectorClip,
    compareEnabled, compareShowsDifference, compareMode, compareSplitRatio,
    compareDividerDragging, previewRenderSize, canvasRef, originalCanvasRef,
    differenceCanvasRef, previewSurfaceRef, previewSurfaceStyle, previewZoom,
  } = props;

  const t = zhCN.preview;

  return (
    <>
      <div
        ref={previewSurfaceRef}
        className="absolute inset-0"
        style={previewSurfaceStyle}
        data-testid="preview-surface"
      >
        <canvas
          ref={canvasRef}
          width={previewRenderSize.width}
          height={previewRenderSize.height}
          className={`pointer-events-none absolute inset-0 h-full w-full ${compareShowsDifference ? 'opacity-0' : 'opacity-100'}`}
          data-testid="preview-canvas"
        />
        {compareEnabled ? (
          <canvas
            ref={originalCanvasRef}
            width={previewRenderSize.width}
            height={previewRenderSize.height}
            className={`pointer-events-none absolute inset-0 h-full w-full ${compareShowsDifference ? 'opacity-0' : 'opacity-100'}`}
            style={buildPreviewCompareOverlayStyle2(compareMode, compareSplitRatio)}
            data-testid="preview-compare-original-canvas"
          />
        ) : null}
        {compareShowsDifference ? (
          <canvas
            ref={differenceCanvasRef}
            width={previewRenderSize.width}
            height={previewRenderSize.height}
            className="pointer-events-none absolute inset-0 h-full w-full"
            data-testid="preview-compare-difference-canvas"
          />
        ) : null}
        {safeFrameGuides ? <SafeFrameGuides /> : null}
        {compareEnabled && !compareShowsDifference ? (
          <div
            role="separator"
            aria-label={t.compareDivider}
            data-testid="preview-compare-divider"
            data-orientation={compareMode === 'top-bottom' ? 'horizontal' : 'vertical'}
            className={`absolute z-10 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.55)] ${compareMode === 'top-bottom' ? 'cursor-row-resize' : 'cursor-col-resize'} ${compareDividerDragging ? 'opacity-100' : 'opacity-80'}`}
            style={buildPreviewCompareDividerStyle2(compareMode, compareSplitRatio)}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              props.onUpdateCompareSplit(event);
            }}
            onPointerMove={(event) => {
              if (compareDividerDragging) props.onUpdateCompareSplit(event);
            }}
            onPointerUp={(event) => {
              event.currentTarget.releasePointerCapture(event.pointerId);
              props.onUpdateCompareSplit(event);
            }}
            onPointerCancel={() => {}}
          />
        ) : null}
        {selectedPanoramaClip && !reviewMode && !canvasEditMode && !frameInspectMode && !compareEnabled && !chromaKeyPickTarget ? (
          <div
            className="absolute inset-0 z-20 cursor-grab active:cursor-grabbing"
            title={t.panoramaDrag}
            aria-label={t.panoramaDrag}
            data-testid="panorama-preview-overlay"
            onPointerDown={props.onBeginPanoramaPreviewDrag}
            onPointerMove={props.onUpdatePanoramaPreviewDrag}
            onPointerUp={props.onEndPanoramaPreviewDrag}
            onPointerCancel={props.onEndPanoramaPreviewDrag}
            onWheel={props.onUpdatePanoramaFov}
          />
        ) : null}
        {!reviewMode && chromaKeyPickTarget ? (
          <div
            className="absolute inset-0 z-40 cursor-crosshair"
            title={zhCN.inspector.chromaKey.pickFromPreview}
            aria-label={zhCN.inspector.chromaKey.pickFromPreview}
            data-testid="chroma-key-pick-overlay"
            onPointerDown={props.onPickChromaKeyColor}
          />
        ) : null}
        {reviewMode ? (
          <ReviewAnnotationOverlay
            annotations={project.reviewAnnotations ?? []}
            playheadTime={playheadTime}
            onPointerDown={props.onBeginReviewAnnotation}
            onPointerUp={props.onEndReviewAnnotation}
            onPointerCancel={props.onEndReviewAnnotation}
          />
        ) : null}
        {!reviewMode && canvasEditMode && selectedEditableClip && selectedPathMask ? (
          <div
            className="absolute inset-0 z-30 cursor-crosshair"
            data-testid="path-mask-overlay"
            onClick={props.onAddPathMaskAnchor}
            onDoubleClick={props.onCloseSelectedPathMask}
            onPointerMove={props.onUpdatePathMaskDrag}
            onPointerUp={props.onEndPathMaskDrag}
            onPointerCancel={props.onEndPathMaskDrag}
          >
            <PathMaskControls item={selectedEditableClip} mask={selectedPathMask} onBeginDrag={props.onBeginPathMaskDrag} />
          </div>
        ) : !reviewMode && canvasEditMode ? (
          <div
            className="absolute inset-0 z-30 cursor-crosshair"
            data-testid="canvas-transform-overlay"
            onPointerDown={props.onBeginCanvasHitDrag}
            onPointerMove={props.onUpdateCanvasTransformDrag}
            onPointerUp={props.onEndCanvasTransformDrag}
            onPointerCancel={props.onEndCanvasTransformDrag}
          >
            {selectedEditableClip ? (
              <CanvasTransformControls item={selectedEditableClip} onBeginDrag={props.onBeginCanvasTransformDrag} />
            ) : null}
          </div>
        ) : null}
        {!reviewMode && selectedMulticamClip && selectedMulticamSequence ? (
          <MulticamPreviewGrid
            clip={selectedMulticamClip}
            sequence={selectedMulticamSequence}
            media={project.media}
            sequences={project.sequences}
            colorPipeline={project.settings.colorPipeline}
            playheadTime={playheadTime}
            fps={fps}
            liveMode={multicamLiveMode}
            isPlaying={isPlaying}
            onLiveModeChange={props.onMulticamLiveModeChange}
            onSelectAngle={props.onSelectMulticamAngle}
            onTrimSwitch={props.onTrimMulticamSwitch}
          />
        ) : null}
      </div>
      {!reviewMode && frameInspectMode ? (
        <div
          className="absolute inset-0 z-50 cursor-crosshair"
          data-testid="frame-inspector-overlay"
          aria-label={t.frameInspectorActive}
          onPointerMove={(event) => {
            if (event.target === event.currentTarget) props.onUpdateFrameInspector(event);
          }}
          onPointerLeave={props.onClearFrameInspector}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) void props.onSampleFrameInspectorColor(event);
          }}
        >
          {frameInspectorSample ? (
            <FrameInspectorPopover
              sample={frameInspectorSample}
              canApplyChroma={Boolean(selectedInspectorClip)}
              onApplyChroma={props.onApplyFrameInspectorColor}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
}

// --- Sub-components (moved from bottom of original file) ---

function SafeFrameGuides() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20" data-testid="preview-safe-frame-guides" aria-hidden="true">
      <div className="absolute border border-white/70 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]" style={{ left: '5%', top: '5%', width: '90%', height: '90%' }} data-testid="preview-safe-frame-action" />
      <div className="absolute border border-amber-300/80 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]" style={{ left: '10%', top: '10%', width: '80%', height: '80%' }} data-testid="preview-safe-frame-title" />
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/65 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" data-testid="preview-safe-frame-center-vertical" />
      <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/65 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" data-testid="preview-safe-frame-center-horizontal" />
      <div className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]" data-testid="preview-safe-frame-center" />
    </div>
  );
}

function FrameInspectorPopover({ sample, canApplyChroma, onApplyChroma }: {
  sample: import('./types').FrameInspectorSample;
  canApplyChroma: boolean;
  onApplyChroma(): void;
}) {
  const t = zhCN.preview;
  return (
    <div
      className="absolute w-[220px] rounded-md border border-white/15 bg-[#050b16]/95 p-2 text-xs text-slate-100 shadow-soft backdrop-blur"
      style={{ left: sample.position.x, top: sample.position.y }}
      data-testid="frame-inspector-popover"
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="h-7 w-7 shrink-0 rounded border border-white/20" style={{ backgroundColor: rgbCss(sample.rgb) }} />
        <div className="min-w-0">
          <div className="font-mono text-[13px] font-semibold uppercase text-white" data-testid="frame-inspector-hex">{sample.hex}</div>
          <div className="text-[10px] uppercase tracking-wide text-slate-400">{t.frameInspectorSampled}</div>
        </div>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 font-mono text-[11px]">
        <span className="text-slate-400">RGB</span>
        <span data-testid="frame-inspector-rgb">{sample.rgb.join(', ')}</span>
        <span className="text-slate-400">HSL</span>
        <span>{sample.hsl.h}, {sample.hsl.s}%, {sample.hsl.l}%</span>
        <span className="text-slate-400">PX</span>
        <span>{sample.coordinates.x}, {sample.coordinates.y}</span>
        <span className="text-slate-400">N</span>
        <span>{sample.coordinates.normalizedX.toFixed(3)}, {sample.coordinates.normalizedY.toFixed(3)}</span>
      </div>
      <div className="mt-2 grid h-20 w-20 grid-cols-5 overflow-hidden rounded border border-white/15" data-testid="frame-inspector-magnifier">
        {sample.swatches.map((color, index) => (
          <span key={`${index}-${color.join('-')}`} className={index === 12 ? 'h-4 w-4 outline outline-1 outline-white' : 'h-4 w-4'} style={{ backgroundColor: rgbCss(color) }} />
        ))}
      </div>
      <button type="button" className="mt-2 w-full rounded border border-white/15 bg-white/10 px-2 py-1 text-xs font-medium text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-45" disabled={!canApplyChroma} data-testid="frame-inspector-apply-chroma" onClick={onApplyChroma}>
        {t.frameInspectorApplyChroma}
      </button>
    </div>
  );
}

function ReviewAnnotationOverlay({ annotations, playheadTime, onPointerDown, onPointerUp, onPointerCancel }: {
  annotations: ReviewAnnotation[];
  playheadTime: number;
  onPointerDown(event: ReactPointerEvent<HTMLDivElement>): void;
  onPointerUp(event: ReactPointerEvent<HTMLDivElement>): void;
  onPointerCancel(event: ReactPointerEvent<HTMLDivElement>): void;
}) {
  const visible = annotations.filter((a) => Math.abs(a.time - playheadTime) <= 0.5);
  return (
    <div className="absolute inset-0 z-40 cursor-crosshair" data-testid="review-annotation-overlay" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <marker id="review-arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L7,3 z" fill="#facc15" />
          </marker>
        </defs>
        {visible.map((annotation) => {
          if (annotation.type === 'arrow') {
            return <line key={annotation.id} x1={annotation.x} y1={annotation.y} x2={annotation.x + annotation.width} y2={annotation.y + annotation.height} stroke={annotation.color} strokeWidth={0.006} markerEnd="url(#review-arrowhead)" vectorEffect="non-scaling-stroke" />;
          }
          if (annotation.type === 'rectangle') {
            return <rect key={annotation.id} x={annotation.x} y={annotation.y} width={annotation.width} height={annotation.height} fill={annotation.color} fillOpacity={0.14} stroke={annotation.color} strokeWidth={0.006} vectorEffect="non-scaling-stroke" />;
          }
          return null;
        })}
      </svg>
      {visible.map((annotation) =>
        annotation.type === 'text' ? (
          <div key={annotation.id} className="pointer-events-none absolute rounded border border-yellow-300 bg-black/65 px-2 py-1 text-xs font-semibold text-white shadow-soft" style={{ left: `${annotation.x * 100}%`, top: `${annotation.y * 100}%`, width: `${Math.max(8, annotation.width * 100)}%`, minHeight: `${Math.max(5, annotation.height * 100)}%` }} data-testid={`review-annotation-${annotation.id}`}>{annotation.text}</div>
        ) : (
          <div key={annotation.id} className="pointer-events-none absolute rounded bg-black/70 px-2 py-1 text-[11px] font-semibold text-white shadow-soft" style={{ left: `${annotation.x * 100}%`, top: `${annotation.y * 100}%` }} data-testid={`review-annotation-${annotation.id}`}>{annotation.text}</div>
        ),
      )}
    </div>
  );
}

function CanvasTransformControls({ item, onBeginDrag }: {
  item: EditableCanvasClip;
  onBeginDrag(event: ReactPointerEvent<HTMLElement>, item: EditableCanvasClip, type: CanvasTransformDrag['type'], handle?: CanvasTransformHandle): void;
}) {
  const t = zhCN.preview;
  return (
    <>
      <div className="pointer-events-none absolute border border-emerald-300 shadow-[0_0_0_1px_rgba(0,0,0,0.55)]" style={canvasBoxStyle(item.box)} data-testid="canvas-transform-bounds" data-clip-id={item.clip.id}>
        <span className="absolute left-1/2 top-0 h-10 w-px -translate-x-1/2 -translate-y-full bg-emerald-300/80" />
      </div>
      {CANVAS_TRANSFORM_HANDLES.map((handle) => (
        <button key={handle} type="button" className="absolute h-3 w-3 rounded-sm border border-black/60 bg-emerald-300 shadow-[0_0_0_1px_rgba(255,255,255,0.65)] hover:bg-white" style={{ ...canvasPointStyle(item.box.handles[handle]), cursor: canvasHandleCursor(handle) }} title={handle.toUpperCase()} aria-label={handle.toUpperCase()} data-testid={`canvas-transform-handle-${handle}`} onPointerDown={(event) => onBeginDrag(event, item, 'scale', handle)} />
      ))}
      <button type="button" className="absolute h-4 w-4 rounded-full border border-black/60 bg-white shadow-[0_0_0_2px_rgba(16,185,129,0.7)] hover:bg-emerald-100" style={{ ...canvasPointStyle(item.box.rotationHandle), cursor: 'grab' }} title={t.rotateHandle} aria-label={t.rotateHandle} data-testid="canvas-transform-rotate-handle" onPointerDown={(event) => onBeginDrag(event, item, 'rotate')} />
      <span className="pointer-events-none absolute h-2.5 w-2.5 rounded-full border border-white bg-emerald-400 shadow-[0_0_0_1px_rgba(0,0,0,0.55)]" style={canvasPointStyle(item.box.anchor)} title={t.transformAnchor} data-testid="canvas-transform-anchor" />
    </>
  );
}

function PathMaskControls({ item, mask, onBeginDrag }: {
  item: EditableCanvasClip;
  mask: ClipMask;
  onBeginDrag(event: ReactPointerEvent<HTMLElement>, item: EditableCanvasClip, mask: ClipMask, pointIndex: number, target: PathMaskDrag['target']): void;
}) {
  const path = mask.path ?? [];
  const t = zhCN.preview;
  const closed = isPathMaskClosed(path);
  const anchors = closed ? path.slice(0, -1) : path;
  const svgPath = buildCanvasPathMaskSvgPath(path, item);
  return (
    <>
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${PREVIEW_CANVAS_WIDTH} ${PREVIEW_CANVAS_HEIGHT}`} data-testid="path-mask-svg">
        {svgPath ? <path d={svgPath} fill={closed ? 'rgba(16,185,129,0.22)' : 'none'} stroke="rgb(110,231,183)" strokeDasharray={closed ? undefined : '6 6'} strokeWidth={2} /> : null}
        {anchors.map((point, index) => {
          const handleIn = resolvePathHandle(point, 'handleIn');
          const handleOut = resolvePathHandle(point, 'handleOut');
          const anchorCanvas = pathPointToCanvasPoint(point, item);
          const handleInCanvas = pathPointToCanvasPoint(handleIn, item);
          const handleOutCanvas = pathPointToCanvasPoint(handleOut, item);
          return (
            <g key={`${mask.id}-handles-${index}`}>
              <line x1={anchorCanvas.x} y1={anchorCanvas.y} x2={handleInCanvas.x} y2={handleInCanvas.y} stroke="rgba(191,219,254,0.75)" strokeWidth={1} />
              <line x1={anchorCanvas.x} y1={anchorCanvas.y} x2={handleOutCanvas.x} y2={handleOutCanvas.y} stroke="rgba(191,219,254,0.75)" strokeWidth={1} />
            </g>
          );
        })}
      </svg>
      {anchors.map((point, index) => {
        const handleIn = resolvePathHandle(point, 'handleIn');
        const handleOut = resolvePathHandle(point, 'handleOut');
        return (
          <div key={`${mask.id}-controls-${index}`}>
            <button type="button" className="absolute h-3 w-3 rounded-full border border-black/60 bg-sky-200 shadow-[0_0_0_1px_rgba(255,255,255,0.8)] hover:bg-white" style={canvasPointStyle(pathPointToCanvasPoint(handleIn, item))} title={t.pathHandleIn} aria-label={t.pathHandleIn} data-path-mask-control="true" data-testid={`path-mask-handle-in-${index}`} onClick={(event) => event.stopPropagation()} onPointerDown={(event) => onBeginDrag(event, item, mask, index, 'handleIn')} />
            <button type="button" className="absolute h-4 w-4 rounded-full border border-black/70 bg-emerald-300 shadow-[0_0_0_2px_rgba(255,255,255,0.7)] hover:bg-white" style={canvasPointStyle(pathPointToCanvasPoint(point, item))} title={t.pathAnchor(index + 1)} aria-label={t.pathAnchor(index + 1)} data-path-mask-control="true" data-testid={`path-mask-anchor-${index}`} onClick={(event) => event.stopPropagation()} onPointerDown={(event) => onBeginDrag(event, item, mask, index, 'anchor')} />
            <button type="button" className="absolute h-3 w-3 rounded-full border border-black/60 bg-sky-200 shadow-[0_0_0_1px_rgba(255,255,255,0.8)] hover:bg-white" style={canvasPointStyle(pathPointToCanvasPoint(handleOut, item))} title={t.pathHandleOut} aria-label={t.pathHandleOut} data-path-mask-control="true" data-testid={`path-mask-handle-out-${index}`} onClick={(event) => event.stopPropagation()} onPointerDown={(event) => onBeginDrag(event, item, mask, index, 'handleOut')} />
          </div>
        );
      })}
    </>
  );
}

function MulticamPreviewGrid({ clip, sequence, media, sequences, colorPipeline, playheadTime, fps, liveMode, isPlaying, onLiveModeChange, onSelectAngle, onTrimSwitch }: {
  clip: Extract<import('@open-factory/editor-core').Clip, { type: 'nested-sequence' }>;
  sequence: import('@open-factory/editor-core').Sequence;
  media: import('@open-factory/editor-core').Project['media'];
  sequences: import('@open-factory/editor-core').Sequence[];
  colorPipeline?: import('@open-factory/editor-core').Project['settings']['colorPipeline'];
  playheadTime: number;
  fps: number;
  liveMode: boolean;
  isPlaying: boolean;
  onLiveModeChange(enabled: boolean): void;
  onSelectAngle(angleId: string): void;
  onTrimSwitch(switchId: string, frameDelta: number): void;
}) {
  const t = zhCN.preview;
  const canvasRefs = useRef(new Map<string, HTMLCanvasElement>());
  const renderersRef = useRef(new Map<string, PreviewRenderer>());
  const localTime = Math.min(clip.duration, Math.max(0, playheadTime - clip.start + clip.trimStart));
  const activeAngleId = useMemo(() => {
    try { return clip.multicam ? getActiveMulticamAngle(clip.multicam, localTime).id : undefined; } catch { return undefined; }
  }, [clip.multicam, localTime]);
  const columns = (clip.multicam?.angles.length ?? 0) <= 4 ? 2 : 3;
  const history = useMemo(() => (clip.multicam ? buildMulticamSwitchHistory(clip.multicam, clip.duration, fps) : []), [clip.duration, clip.multicam, fps]);
  const warnings = useMemo(() => (clip.multicam ? findFrequentMulticamSwitchWarnings(clip.multicam, clip.duration, fps) : []), [clip.duration, clip.multicam, fps]);

  useEffect(() => {
    let canceled = false;
    void (async () => {
      for (const angle of clip.multicam?.angles ?? []) {
        const canvas = canvasRefs.current.get(angle.id);
        const track = sequence.timeline.tracks.find((item) => item.id === angle.trackId);
        if (!canvas || !track) continue;
        const renderer = getAngleRenderer(renderersRef.current, angle.id);
        const angleTimeline = { tracks: [{ ...track, solo: false, muted: false }], transitions: [], markers: [] };
        try { await renderer.render(canvas, angleTimeline, media, localTime, { sequences, colorPipeline }); }
        catch { if (!canceled) { const context = canvas.getContext('2d'); context?.clearRect(0, 0, canvas.width, canvas.height); } }
        if (canceled) break;
      }
    })();
    return () => { canceled = true; };
  }, [clip.multicam, colorPipeline, localTime, media, sequence.timeline.tracks, sequences]);

  if (!clip.multicam) return null;

  return (
    <div className="absolute inset-x-2 bottom-2 top-14 z-20 grid gap-2 rounded-md border border-white/15 bg-black/70 p-2 shadow-soft" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(210px, 0.32fr)' }} data-testid="multicam-preview-grid" aria-label={t.multicamGrid} data-live-mode={liveMode ? 'true' : 'false'}>
      <div className="grid min-h-0 gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }} data-testid="multicam-angle-grid">
        {clip.multicam.angles.map((angle, index) => (
          <button key={angle.id} type="button" className={`group relative min-h-0 overflow-hidden rounded-md border bg-black text-left ${activeAngleId === angle.id ? 'border-amber-300 ring-2 ring-amber-300/60' : 'border-white/15 hover:border-white/40'}`} title={t.multicamAngle(angle.name)} aria-label={t.multicamAngle(angle.name)} data-testid={`multicam-angle-button-${angle.id}`} data-active={activeAngleId === angle.id ? 'true' : 'false'} onClick={() => onSelectAngle(angle.id)}>
            <canvas ref={(node) => { if (node) canvasRefs.current.set(angle.id, node); else canvasRefs.current.delete(angle.id); }} width={480} height={270} className="h-full w-full object-cover" data-testid={`multicam-angle-canvas-${angle.id}`} />
            <span className="absolute left-2 top-2 rounded bg-black/75 px-2 py-1 text-[11px] font-medium text-white">{index + 1}. {angle.name}</span>
          </button>
        ))}
      </div>
      <aside className="flex min-h-0 flex-col overflow-hidden rounded-md border border-white/15 bg-black/55 text-white" data-testid="multicam-cut-history-panel">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
          <span className="text-xs font-semibold uppercase text-white/75">{t.multicamHistory}</span>
          <button type="button" className={`inline-flex h-7 shrink-0 items-center rounded border px-2 text-[11px] font-semibold ${liveMode ? 'border-amber-300 bg-amber-300 text-black' : 'border-white/20 bg-white/10 text-white hover:bg-white/15'}`} data-testid="multicam-live-mode-toggle" data-active={liveMode ? 'true' : 'false'} onClick={() => onLiveModeChange(!liveMode)}>{liveMode ? t.multicamLiveModeActive : t.multicamLiveMode}</button>
        </div>
        {warnings.length > 0 ? <div className="border-b border-amber-300/25 bg-amber-300/15 px-3 py-2 text-[11px] font-medium text-amber-100" data-testid="multicam-frequency-warning">{t.multicamTooFrequent}</div> : null}
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2" data-testid="multicam-history-list" data-playing={isPlaying ? 'true' : 'false'}>
          {history.map((entry) => (
            <MulticamHistoryRow key={entry.switchId} entry={entry} onTrimSwitch={onTrimSwitch} />
          ))}
        </div>
        {clip.multicam?.aiCutSuggestions && clip.multicam.aiCutSuggestions.length > 0 ? (
          <div className="border-t border-white/10 p-2" data-testid="multicam-ai-cut-panel">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase text-amber-200/80">{t.multicamAiCutTitle}</span>
              <button type="button" className="inline-flex h-6 shrink-0 items-center rounded border border-amber-300/40 bg-amber-300/20 px-2 text-[10px] font-semibold text-amber-100 hover:bg-amber-300/30" data-testid="multicam-ai-cut-apply-all" onClick={() => { const cmd = new ApplyMulticamAiCutSuggestionsCommand(projectAccessor, clip.id, clip.multicam!.aiCutSuggestions!); commandManager.execute(cmd); }}>{t.multicamAiCutApplyAll}</button>
            </div>
            <div className="flex max-h-24 flex-col gap-1 overflow-y-auto">
              {clip.multicam.aiCutSuggestions.map((suggestion, index) => {
                const angleName = clip.multicam?.angles.find((a) => a.id === suggestion.angleId)?.name ?? suggestion.angleId;
                return (
                  <div key={`${suggestion.time}-${suggestion.angleId}`} className="rounded border border-white/10 bg-white/5 px-2 py-1 text-[10px]" data-testid={`multicam-ai-cut-suggestion-${index}`}>
                    <span className="font-mono text-white/70">{secondsToTimecode(suggestion.time, fps)}</span>{' '}
                    <span className="font-medium text-white">{angleName}</span>
                    <span className="ml-1 text-white/50">({Math.round(suggestion.confidence * 100)}%)</span>
                    <div className="mt-0.5 text-white/40">{t.multicamAiCutReason(suggestion.reason)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function MulticamHistoryRow({ entry, onTrimSwitch }: {
  entry: import('@open-factory/editor-core').MulticamSwitchHistoryEntry;
  onTrimSwitch(switchId: string, frameDelta: number): void;
}) {
  const t = zhCN.preview;
  return (
    <div className={`grid grid-cols-[54px_minmax(0,1fr)_54px_auto] items-center gap-2 rounded border px-2 py-1.5 text-[11px] ${entry.tooFrequent ? 'border-amber-300/45 bg-amber-300/15' : 'border-white/10 bg-white/5'}`} data-testid={`multicam-history-row-${entry.switchId}`} data-angle-id={entry.angleId} data-too-frequent={entry.tooFrequent ? 'true' : 'false'}>
      <span className="font-mono text-white/70">{entry.timecode}</span>
      <span className="truncate font-medium text-white">{entry.angleIndex + 1}. {entry.angleName}</span>
      <span className="font-mono text-white/55">{entry.durationTimecode}</span>
      <span className="inline-flex shrink-0 gap-1">
        <button type="button" className="inline-flex h-6 w-6 items-center justify-center rounded border border-white/15 bg-white/10 text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-35" title={t.multicamTrimEarlier} aria-label={t.multicamTrimEarlier} disabled={entry.time <= 0} data-testid={`multicam-trim-earlier-${entry.switchId}`} onClick={() => onTrimSwitch(entry.switchId, -10)}>-10</button>
        <button type="button" className="inline-flex h-6 w-6 items-center justify-center rounded border border-white/15 bg-white/10 text-white hover:bg-white/20" title={t.multicamTrimLater} aria-label={t.multicamTrimLater} data-testid={`multicam-trim-later-${entry.switchId}`} onClick={() => onTrimSwitch(entry.switchId, 10)}>+10</button>
      </span>
    </div>
  );
}

function getAngleRenderer(renderers: Map<string, PreviewRenderer>, angleId: string): PreviewRenderer {
  const existing = renderers.get(angleId);
  if (existing) return existing;
  const renderer = new PreviewRenderer();
  renderers.set(angleId, renderer);
  return renderer;
}

// Helper imports for compare styles
import {buildPreviewCompareOverlayStyle, buildPreviewCompareDividerStyle, type PreviewCompareMode} from '../../lib/preview/compare';

function buildPreviewCompareOverlayStyle2(mode: PreviewCompareMode | 'off', ratio: number) {
  return buildPreviewCompareOverlayStyle(mode === 'off' ? 'left-right' : mode, ratio);
}

function buildPreviewCompareDividerStyle2(mode: PreviewCompareMode | 'off', ratio: number) {
  return buildPreviewCompareDividerStyle(mode === 'off' ? 'left-right' : mode, ratio);
}

// Additional imports needed by inline components
import {useRef, useMemo, useEffect} from 'react';
import {ApplyMulticamAiCutSuggestionsCommand, getActiveMulticamAngle, buildMulticamSwitchHistory, findFrequentMulticamSwitchWarnings, secondsToTimecode} from '@open-factory/editor-core';
import {commandManager, projectAccessor} from '../../store/commandManager';
import {PreviewRenderer} from '../../lib/preview/renderer';
