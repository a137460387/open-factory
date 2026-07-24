import { Columns2, Rows2, Blend, MousePointer2, Pipette, GitCompareArrows, BarChart3, Pause, Play, FileDown, Type as TypeIcon, RectangleHorizontal, ArrowUpRight } from 'lucide-react';
import type { ReviewAnnotationType } from '@open-factory/editor-core';
import type { ProjectSnapshotEntry } from '../../lib/projectSnapshots';
import { zhCN } from '../../i18n/strings';

export interface PreviewControlsProps {
  title: string;
  previewCanvasSizeLabel: string;
  reviewMode: boolean;
  compareEnabled: boolean;
  compareMode: string;
  canvasEditMode: boolean;
  frameInspectMode: boolean;
  scopesOpen: boolean;
  isPlaying: boolean;
  snapshotComparePath: string;
  snapshotCompareLoading: boolean;
  snapshotEntries: ProjectSnapshotEntry[];
  reviewTool: ReviewAnnotationType;
  reviewText: string;
  onSnapshotCompareSelect: (path: string) => void;
  onSnapshotPointerDown: () => void;
  onCompareModeChange: (mode: string) => void;
  onToggleCompare: () => void;
  onToggleCanvasEditMode: () => void;
  onToggleFrameInspectMode: () => void;
  onToggleScopes: () => void;
  onTogglePlayback: () => void;
  onReviewToolChange: (tool: ReviewAnnotationType) => void;
  onReviewTextChange: (text: string) => void;
  onExportReviewReport?: () => void;
}

export function PreviewControls(props: PreviewControlsProps) {
  const {
    title, previewCanvasSizeLabel, reviewMode, compareEnabled, compareMode,
    canvasEditMode, frameInspectMode, scopesOpen, isPlaying,
    snapshotComparePath, snapshotCompareLoading, snapshotEntries,
    reviewTool, reviewText,
  } = props;
  const t = zhCN.preview;

  return (
    <div className="relative z-40 flex items-center justify-between border-b px-3 py-2">
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-slate-300">{previewCanvasSizeLabel}</div>
      </div>
      <div className="flex items-center gap-2">
        {reviewMode ? (
          <ReviewAnnotationToolbar
            tool={reviewTool}
            text={reviewText}
            onToolChange={props.onReviewToolChange}
            onTextChange={props.onReviewTextChange}
            onExportReport={props.onExportReviewReport}
          />
        ) : (
          <>
            <label className="sr-only" htmlFor="preview-snapshot-compare-select">{t.snapshotCompare}</label>
            <select id="preview-snapshot-compare-select" className="h-9 max-w-[190px] rounded-md border border-white/10 bg-white/10 px-2 text-xs font-medium text-white outline-none hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60" value={snapshotComparePath} disabled={snapshotCompareLoading} title={t.snapshotCompare} data-testid="preview-snapshot-compare-select" onPointerDown={props.onSnapshotPointerDown} onFocus={props.onSnapshotPointerDown} onChange={(e) => props.onSnapshotCompareSelect(e.target.value)}>
              <option value="">{snapshotCompareLoading ? t.snapshotCompareLoading : t.snapshotCompareOff}</option>
              {snapshotEntries.map((entry) => <option key={entry.path} value={entry.path}>{entry.name}</option>)}
            </select>
            {compareEnabled ? (
              <div className="flex items-center gap-1 rounded-md border border-white/10 bg-white/10 p-0.5" data-testid="preview-compare-mode-group">
                <button className={`inline-flex h-8 w-8 items-center justify-center rounded text-white hover:bg-white/20 ${compareMode === 'left-right' ? 'bg-emerald-500/30' : ''}`} title={t.compareLeftRight} aria-label={t.compareLeftRight} data-testid="preview-compare-mode-left-right" onClick={() => props.onCompareModeChange('left-right')}><Columns2 size={16} /></button>
                <button className={`inline-flex h-8 w-8 items-center justify-center rounded text-white hover:bg-white/20 ${compareMode === 'top-bottom' ? 'bg-emerald-500/30' : ''}`} title={t.compareTopBottom} aria-label={t.compareTopBottom} data-testid="preview-compare-mode-top-bottom" onClick={() => props.onCompareModeChange('top-bottom')}><Rows2 size={16} /></button>
                <button className={`inline-flex h-8 w-8 items-center justify-center rounded text-white hover:bg-white/20 ${compareMode === 'difference' ? 'bg-emerald-500/30' : ''}`} title={t.compareDifference} aria-label={t.compareDifference} data-testid="preview-compare-mode-difference" onClick={() => props.onCompareModeChange('difference')}><Blend size={16} /></button>
              </div>
            ) : null}
            <button className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-white hover:bg-white/20 ${canvasEditMode ? 'bg-emerald-500/25' : 'bg-white/10'}`} title={canvasEditMode ? t.canvasEditModeActive : t.canvasEditMode} aria-label={canvasEditMode ? t.canvasEditModeActive : t.canvasEditMode} data-testid="preview-canvas-edit-toggle" data-active={canvasEditMode ? 'true' : 'false'} onClick={props.onToggleCanvasEditMode}><MousePointer2 size={17} /></button>
            <button className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-white hover:bg-white/20 ${frameInspectMode ? 'bg-emerald-500/25' : 'bg-white/10'}`} title={frameInspectMode ? t.frameInspectorActive : t.frameInspector} aria-label={frameInspectMode ? t.frameInspectorActive : t.frameInspector} data-testid="preview-frame-inspector-toggle" data-active={frameInspectMode ? 'true' : 'false'} onClick={props.onToggleFrameInspectMode}><Pipette size={17} /></button>
            <button className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-white hover:bg-white/20 ${compareEnabled ? 'bg-emerald-500/25' : 'bg-white/10'}`} title={t.compareToggle} aria-label={t.compareToggle} data-testid="preview-compare-toggle" onClick={props.onToggleCompare}><GitCompareArrows size={17} /></button>
            <button className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-white hover:bg-white/20 ${scopesOpen ? 'bg-emerald-500/25' : 'bg-white/10'}`} title={t.colorScopes} aria-label={t.colorScopes} data-testid="toggle-color-scopes" onClick={props.onToggleScopes}><BarChart3 size={17} /></button>
            <button className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/10 text-white hover:bg-white/20" title={isPlaying ? zhCN.toolbar.pause : zhCN.toolbar.play} aria-label={isPlaying ? zhCN.toolbar.pause : zhCN.toolbar.play} data-testid="preview-playback-button" data-playback-state={isPlaying ? 'playing' : 'paused'} onClick={props.onTogglePlayback}>{isPlaying ? <Pause size={17} /> : <Play size={17} />}</button>
          </>
        )}
      </div>
    </div>
  );
}

function ReviewAnnotationToolbar({ tool, text, onToolChange, onTextChange, onExportReport }: {
  tool: ReviewAnnotationType;
  text: string;
  onToolChange(tool: ReviewAnnotationType): void;
  onTextChange(text: string): void;
  onExportReport?: () => void;
}) {
  const t = zhCN.preview;
  return (
    <div className="flex items-center gap-2" data-testid="review-annotation-tools" aria-label={t.reviewAnnotationMode}>
      <div className="flex items-center gap-1 rounded-md border border-white/10 bg-white/10 p-0.5">
        <ReviewToolButton tool="rectangle" activeTool={tool} title={t.reviewToolRectangle} onToolChange={onToolChange} icon={<RectangleHorizontal size={16} />} />
        <ReviewToolButton tool="arrow" activeTool={tool} title={t.reviewToolArrow} onToolChange={onToolChange} icon={<ArrowUpRight size={16} />} />
        <ReviewToolButton tool="text" activeTool={tool} title={t.reviewToolText} onToolChange={onToolChange} icon={<TypeIcon size={16} />} />
      </div>
      <label className="sr-only" htmlFor="review-annotation-text-input">{t.reviewAnnotationText}</label>
      <input id="review-annotation-text-input" className="h-9 w-52 rounded-md border border-white/10 bg-white/10 px-2 text-xs font-medium text-white outline-none placeholder:text-slate-400 focus:border-brand" value={text} placeholder={t.reviewAnnotationText} data-testid="review-annotation-text-input" onChange={(e) => onTextChange(e.target.value)} />
      <button className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/10 text-white hover:bg-white/20 disabled:opacity-45" type="button" title={zhCN.toolbar.exportReviewReport} aria-label={zhCN.toolbar.exportReviewReport} data-testid="review-export-report-button" disabled={!onExportReport} onClick={onExportReport}><FileDown size={17} /></button>
    </div>
  );
}

function ReviewToolButton({ tool, activeTool, title, icon, onToolChange }: {
  tool: ReviewAnnotationType;
  activeTool: ReviewAnnotationType;
  title: string;
  icon: React.ReactNode;
  onToolChange(tool: ReviewAnnotationType): void;
}) {
  return (
    <button className={`inline-flex h-8 w-8 items-center justify-center rounded text-white hover:bg-white/20 ${activeTool === tool ? 'bg-emerald-500/30' : ''}`} type="button" title={title} aria-label={title} data-testid={`review-tool-${tool}`} data-active={activeTool === tool ? 'true' : 'false'} onClick={() => onToolChange(tool)}>{icon}</button>
  );
}
