import {useEffect, useMemo, useRef, useState} from 'react';
import {RecordAngleCutCommand, TrimMulticamSwitchCommand, diffTimelineSnapshots, isNestedSequenceDepthExceeded, normalizeClipProjection, type Project, type ReviewAnnotationType, type FrameSearchHistoryEntry} from '@open-factory/editor-core';
import {isEditableKeyboardTarget} from '../../accessibility/keyboard-navigation';
import {zhCN} from '../../i18n/strings';
import {listProjectSnapshots, readProjectSnapshot, type ProjectSnapshotEntry} from '../../lib/projectSnapshots';
import {readFrameSearchHistory} from '../../lib/frameSearchHistory';
import {DEFAULT_PREVIEW_PERFORMANCE_SETTINGS, getPreviewAdaptiveQualityStatus} from '../../lib/preview/preview-performance';
import {showToast} from '../../lib/toast';
import {commandManager, projectAccessor} from '../../store/commandManager';
import {useEditorStore} from '../../store/editorStore';
import {useTheme} from '../../theme/useTheme';
import type {PreviewCanvasProps} from './types';
import {buildEditableCanvasClips, buildFrameSearchCandidates, isFrameJumpLikeQuery} from './utils';
import {useCanvasRenderer} from './hooks/useCanvasRenderer';
import {useCanvasInteraction} from './hooks/useCanvasInteraction';
import {PreviewOverlay} from './PreviewOverlay';
import {PreviewControls} from './PreviewControls';
import {PreviewTimeline} from './PreviewTimeline';
import {PreviewEffects} from './PreviewEffects';
import {ColorScopesPanel} from '../ColorScopes/ColorScopesPanel';

export type { PreviewCanvasProps };

export function PreviewCanvas({
  safeFrameGuides = false,
  previewPerformance = DEFAULT_PREVIEW_PERFORMANCE_SETTINGS,
  colorScopesVisible,
  onColorScopesVisibleChange,
  reviewMode = false,
  onProfilerFrame,
  onAddReviewAnnotation,
  onExportReviewReport,
}: PreviewCanvasProps) {
  const theme = useTheme();
  const t = zhCN.preview;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const differenceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewSurfaceRef = useRef<HTMLDivElement | null>(null);
  const compareFrameRef = useRef<HTMLDivElement | null>(null);
  const frameSearchInputRef = useRef<HTMLInputElement | null>(null);
  const liveCutSessionRef = useRef<{ clipId: string; command: RecordAngleCutCommand } | null>(null);

  const project = useEditorStore((s) => s.project);
  const projectPath = useEditorStore((s) => s.projectPath);
  const previewTimeline = useEditorStore((s) => s.previewTimeline);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const playheadTime = useEditorStore((s) => s.playheadTime);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const playbackRate = useEditorStore((s) => s.playbackRate);
  const setPlayheadTime = useEditorStore((s) => s.setPlayheadTime);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);
  const setSelectedClipIds = useEditorStore((s) => s.setSelectedClipIds);
  const setTimelineCompareRanges = useEditorStore((s) => s.setTimelineCompareRanges);
  const chromaKeyPickClipId = useEditorStore((s) => s.chromaKeyPickClipId);
  const setChromaKeyPickClipId = useEditorStore((s) => s.setChromaKeyPickClipId);

  const [scopesOpen, setScopesOpen] = useState(false);
  const [compareMode, setCompareMode] = useState<'off' | 'left-right' | 'top-bottom' | 'difference'>('off');
  const [compareSplitRatio, setCompareSplitRatio] = useState(0.5);
  const [compareDividerDragging, setCompareDividerDragging] = useState(false);
  const [snapshotEntries, setSnapshotEntries] = useState<ProjectSnapshotEntry[]>([]);
  const [snapshotComparePath, setSnapshotComparePath] = useState('');
  const [snapshotCompareProject, setSnapshotCompareProject] = useState<Project>();
  const [snapshotCompareLoading, setSnapshotCompareLoading] = useState(false);
  const [canvasEditMode, setCanvasEditMode] = useState(false);
  const [frameInspectMode, setFrameInspectMode] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 0 });
  const [reviewTool, setReviewTool] = useState<ReviewAnnotationType>('rectangle');
  const [reviewText, setReviewText] = useState('');
  const [frameSearchQuery, setFrameSearchQuery] = useState('');
  const [frameSearchFocused, setFrameSearchFocused] = useState(false);
  const [frameSearchError, setFrameSearchError] = useState<string>();
  const [frameSearchHistory, setFrameSearchHistory] = useState<FrameSearchHistoryEntry[]>([]);
  const [multicamLiveMode, setMulticamLiveMode] = useState(false);

  const fps = project.settings.fps || 30;
  const snapshotCompareEnabled = Boolean(snapshotCompareProject);
  const compareEnabled = compareMode !== 'off' || snapshotCompareEnabled;
  const compareShowsDifference = compareMode === 'difference';

  const selectedMulticamClip = useMemo(() => {
    const clip = project.timeline.tracks.flatMap((tr) => tr.clips).find((c) => c.id === selectedClipId);
    return clip?.type === 'nested-sequence' && clip.multicam ? clip : undefined;
  }, [project.timeline.tracks, selectedClipId]);
  const selectedMulticamSequence = useMemo(() => selectedMulticamClip ? project.sequences.find((s) => s.id === selectedMulticamClip.sequenceId) : undefined, [project.sequences, selectedMulticamClip]);
  const editableCanvasClips = useMemo(() => buildEditableCanvasClips(project, playheadTime), [project, playheadTime]);
  const selectedEditableClip = useMemo(() => editableCanvasClips.find((c) => c.clip.id === selectedClipId), [editableCanvasClips, selectedClipId]);
  const selectedInspectorClip = useMemo(() => selectedEditableClip?.clip, [selectedEditableClip]);
  const selectedPanoramaClip = useMemo(() => {
    const clip = project.timeline.tracks.flatMap((tr) => tr.clips).find((c) => c.id === selectedClipId);
    return clip?.type === 'video' && normalizeClipProjection(clip.projection) === 'equirectangular' ? clip : undefined;
  }, [project.timeline.tracks, selectedClipId]);
  const chromaKeyPickTarget = useMemo(() => editableCanvasClips.find((c) => c.clip.id === chromaKeyPickClipId), [chromaKeyPickClipId, editableCanvasClips]);
  const selectedPathMask = useMemo(() => selectedEditableClip?.clip.masks?.find((m) => m.type === 'path'), [selectedEditableClip]);
  const snapshotCompareRanges = useMemo(() => snapshotCompareProject ? diffTimelineSnapshots(project.timeline, snapshotCompareProject.timeline) : [], [project.timeline, snapshotCompareProject]);
  const frameSearchCandidates = useMemo(() => buildFrameSearchCandidates(project, frameSearchQuery), [frameSearchQuery, project]);
  const showFrameSearchCandidates = frameSearchFocused && frameSearchQuery.trim().length > 0 && !isFrameJumpLikeQuery(frameSearchQuery);
  const showFrameSearchHistory = frameSearchFocused && frameSearchQuery.trim().length === 0 && frameSearchHistory.length > 0;

  const renderer = useCanvasRenderer({ canvasRef, originalCanvasRef, differenceCanvasRef, project, previewTimeline, playheadTime, isPlaying, playbackRate, compareEnabled, compareShowsDifference, snapshotCompareProject, scopesOpen, previewPerformance, onProfilerFrame });
  const interaction = useCanvasInteraction({ canvasRef, previewSurfaceRef, compareFrameRef, canvasEditMode, frameInspectMode, compareEnabled, compareMode, chromaKeyPickTarget, selectedEditableClip, selectedPathMask, selectedPanoramaClip, selectedInspectorClip, editableCanvasClips, reviewMode, previewZoom, previewPan, frameInspectorSample: undefined, setIsPlaying, setSelectedClipIds, setChromaKeyPickClipId, setPreviewZoom, setPreviewPan, setFrameInspectorSample: () => {}, setCompareSplitRatio, setCompareDividerDragging, onAddReviewAnnotation, reviewText, reviewTool, playheadTime, fps });

  useEffect(() => {
    if (!multicamLiveMode || !isPlaying || !selectedMulticamClip?.multicam) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || isEditableKeyboardTarget(event.target) || !/^[1-8]$/.test(event.key)) return;
      const angle = selectedMulticamClip.multicam!.angles[Number(event.key) - 1];
      if (!angle) return;
      event.preventDefault();
      try {
        const session = liveCutSessionRef.current;
        if (session?.clipId === selectedMulticamClip.id) { session.command.record(playheadTime, angle.id); }
        else { const cmd = new RecordAngleCutCommand(projectAccessor, selectedMulticamClip.id, [{ sceneTime: playheadTime, angleId: angle.id }]); commandManager.execute(cmd); liveCutSessionRef.current = multicamLiveMode ? { clipId: selectedMulticamClip.id, command: cmd } : null; }
      } catch (error) { showToast({ kind: 'warning', title: t.multicamCutFailedTitle, message: error instanceof Error ? error.message : t.multicamCutFailedMessage }); }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [isPlaying, multicamLiveMode, selectedMulticamClip, playheadTime]);

  useEffect(() => { liveCutSessionRef.current = null; setMulticamLiveMode(false); }, [selectedMulticamClip?.id]);
  useEffect(() => { if (typeof colorScopesVisible === 'boolean') setScopesOpen(colorScopesVisible); }, [colorScopesVisible]);
  useEffect(() => { setTimelineCompareRanges(snapshotCompareRanges); return () => setTimelineCompareRanges([]); }, [setTimelineCompareRanges, snapshotCompareRanges]);
  useEffect(() => { setSnapshotComparePath(''); setSnapshotCompareProject(undefined); setTimelineCompareRanges([]); }, [project.id, setTimelineCompareRanges]);
  useEffect(() => { setFrameSearchHistory(readFrameSearchHistory()); }, []);
  useEffect(() => { if (reviewMode) { setCanvasEditMode(false); setFrameInspectMode(false); setChromaKeyPickClipId(undefined); } }, [reviewMode, setChromaKeyPickClipId]);
  useEffect(() => { if (isNestedSequenceDepthExceeded(project)) showToast({ kind: 'warning', title: zhCN.timeline.nestedSequenceDepthTitle, message: zhCN.timeline.nestedSequenceDepthMessage }); }, [project]);

  const toggleCompareMode = () => { if (compareEnabled) { setCompareMode('off'); setSnapshotComparePath(''); setSnapshotCompareProject(undefined); setTimelineCompareRanges([]); return; } setCompareMode('left-right'); };
  const selectSnapshotCompare = async (path: string) => {
    setSnapshotComparePath(path);
    if (!path) { setSnapshotCompareProject(undefined); setTimelineCompareRanges([]); return; }
    const entry = snapshotEntries.find((e) => e.path === path);
    if (!entry) return;
    setSnapshotCompareLoading(true);
    try { setSnapshotCompareProject(await readProjectSnapshot(entry, projectPath)); setCompareMode('left-right'); }
    catch (error) { setSnapshotComparePath(''); setSnapshotCompareProject(undefined); showToast({ kind: 'warning', title: zhCN.projectSnapshots.loadFailed, message: error instanceof Error ? error.message : '' }); }
    finally { setSnapshotCompareLoading(false); }
  };
  const refreshSnapshotEntries = async () => { setSnapshotCompareLoading(true); try { setSnapshotEntries(await listProjectSnapshots(project.id)); } catch { showToast({ kind: 'warning', title: zhCN.projectSnapshots.loadFailed, message: '' }); } finally { setSnapshotCompareLoading(false); } };
  const trimMulticamSwitchAtHandle = (switchId: string, frameDelta: number) => {
    if (!selectedMulticamClip) return;
    try { commandManager.execute(new TrimMulticamSwitchCommand(projectAccessor, selectedMulticamClip.id, switchId, frameDelta, fps)); liveCutSessionRef.current = null; }
    catch (error) { showToast({ kind: 'warning', title: t.multicamCutFailedTitle, message: error instanceof Error ? error.message : t.multicamCutFailedMessage }); }
  };
  const recordMulticamAngleCut = (angleId: string) => {
    if (!selectedMulticamClip) return;
    try {
      const session = liveCutSessionRef.current;
      if (multicamLiveMode && session?.clipId === selectedMulticamClip.id) { session.command.record(playheadTime, angleId); }
      else { const cmd = new RecordAngleCutCommand(projectAccessor, selectedMulticamClip.id, [{ sceneTime: playheadTime, angleId }]); commandManager.execute(cmd); liveCutSessionRef.current = multicamLiveMode ? { clipId: selectedMulticamClip.id, command: cmd } : null; }
    } catch (error) { showToast({ kind: 'warning', title: t.multicamCutFailedTitle, message: error instanceof Error ? error.message : t.multicamCutFailedMessage }); }
  };

  const adaptiveIndicatorStatus = getPreviewAdaptiveQualityStatus(renderer.effectivePreviewPerformance.qualityMode);
  const adaptiveIndicatorTitle = previewPerformance.adaptiveEnabled === false
    ? t.adaptiveQualityLocked(t.qualityLabels[renderer.effectivePreviewPerformance.qualityMode])
    : t.adaptiveQualityTooltip(renderer.adaptivePreviewState.averageFps, t.qualityLabels[renderer.effectivePreviewPerformance.qualityMode]);
  const showGpuMetricsPanel = import.meta.env.DEV || import.meta.env.VITE_E2E === 'true' || window.__OPEN_FACTORY_NATIVE_PREVIEW_SMOKE_ACTIVE__ === true;
  const previewSurfaceStyle: React.CSSProperties = { transform: `translate(${previewPan.x}px, ${previewPan.y}px) scale(${previewZoom})`, transformOrigin: 'center' };

  return (
    <section className="flex min-h-0 flex-col" data-theme-canvas-background={theme.colors.canvasBackground} style={{ backgroundColor: theme.colors.canvasBackground, color: theme.colors.textPrimary }}>
      <PreviewControls title={t.title} previewCanvasSizeLabel={renderer.previewCanvasSizeLabel} reviewMode={reviewMode} compareEnabled={compareEnabled} compareMode={compareMode} canvasEditMode={canvasEditMode} frameInspectMode={frameInspectMode} scopesOpen={scopesOpen} isPlaying={isPlaying} snapshotComparePath={snapshotComparePath} snapshotCompareLoading={snapshotCompareLoading} snapshotEntries={snapshotEntries} reviewTool={reviewTool} reviewText={reviewText} onSnapshotCompareSelect={(p) => void selectSnapshotCompare(p)} onSnapshotPointerDown={() => void refreshSnapshotEntries()} onCompareModeChange={setCompareMode} onToggleCompare={toggleCompareMode} onToggleCanvasEditMode={() => setCanvasEditMode((v) => { const n = !v; if (n) { setFrameInspectMode(false); interaction.clearFrameInspector(); } return n; })} onToggleFrameInspectMode={() => setFrameInspectMode((v) => { const n = !v; if (n) { setCanvasEditMode(false); setChromaKeyPickClipId(undefined); } if (!n) interaction.clearFrameInspector(); return n; })} onToggleScopes={() => setScopesOpen((v) => { const n = !v; onColorScopesVisibleChange?.(n); return n; })} onTogglePlayback={() => setIsPlaying(!isPlaying)} onReviewToolChange={setReviewTool} onReviewTextChange={setReviewText} onExportReviewReport={onExportReviewReport} />
      <div className={scopesOpen ? 'grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_180px]' : 'flex min-h-0 flex-1 items-center justify-center p-5'}>
        <div className={scopesOpen ? 'flex min-h-0 items-center justify-center p-4' : 'contents'}>
          <div ref={compareFrameRef} className={`relative aspect-video w-full max-w-[960px] overflow-hidden rounded-md shadow-soft ${previewZoom > 1 && !canvasEditMode && !frameInspectMode && !chromaKeyPickTarget && !compareEnabled ? 'cursor-grab active:cursor-grabbing' : ''}`} style={{ backgroundColor: theme.colors.canvasBackground }} onWheel={interaction.updatePreviewZoomFromWheel} onPointerDown={interaction.beginPreviewPan} onPointerMove={interaction.updatePreviewPan} onPointerUp={interaction.endPreviewPan} onPointerCancel={interaction.endPreviewPan}>
            <PreviewEffects adaptiveIndicatorStatus={adaptiveIndicatorStatus} adaptiveIndicatorTitle={adaptiveIndicatorTitle} lowQualityPreview={renderer.lowQualityPreview} audioOnlyPreview={renderer.audioOnlyPreview} showGpuMetricsPanel={showGpuMetricsPanel} gpuPreviewMetrics={renderer.gpuPreviewMetrics} gpuTextureMemoryLabel={renderer.gpuTextureMemoryLabel} effectivePreviewPerformance={renderer.effectivePreviewPerformance} adaptivePreviewState={renderer.adaptivePreviewState} previewPerformance={previewPerformance} />
            <PreviewOverlay safeFrameGuides={safeFrameGuides} reviewMode={reviewMode} canvasEditMode={canvasEditMode} frameInspectMode={frameInspectMode} selectedEditableClip={selectedEditableClip} selectedPathMask={selectedPathMask} selectedMulticamClip={selectedMulticamClip} selectedMulticamSequence={selectedMulticamSequence} selectedPanoramaClip={selectedPanoramaClip} chromaKeyPickTarget={chromaKeyPickTarget} project={project} playheadTime={playheadTime} fps={fps} multicamLiveMode={multicamLiveMode} isPlaying={isPlaying} frameInspectorSample={undefined} selectedInspectorClip={selectedInspectorClip} compareEnabled={compareEnabled} compareShowsDifference={compareShowsDifference} compareMode={compareMode} compareSplitRatio={compareSplitRatio} compareDividerDragging={compareDividerDragging} previewRenderSize={renderer.previewRenderSize} canvasRef={canvasRef} originalCanvasRef={originalCanvasRef} differenceCanvasRef={differenceCanvasRef} previewSurfaceRef={previewSurfaceRef} previewSurfaceStyle={previewSurfaceStyle} previewZoom={previewZoom} onBeginReviewAnnotation={interaction.beginReviewAnnotation} onEndReviewAnnotation={interaction.endReviewAnnotation} onBeginCanvasHitDrag={interaction.beginCanvasHitDrag} onUpdateCanvasTransformDrag={interaction.updateCanvasTransformDrag} onEndCanvasTransformDrag={interaction.endCanvasTransformDrag} onBeginCanvasTransformDrag={interaction.beginCanvasTransformDrag} onBeginPanoramaPreviewDrag={interaction.beginPanoramaPreviewDrag} onUpdatePanoramaPreviewDrag={interaction.updatePanoramaPreviewDrag} onEndPanoramaPreviewDrag={interaction.endPanoramaPreviewDrag} onUpdatePanoramaFov={interaction.updatePanoramaFov} onPickChromaKeyColor={interaction.pickChromaKeyColor} onUpdateFrameInspector={interaction.updateFrameInspector} onClearFrameInspector={interaction.clearFrameInspector} onSampleFrameInspectorColor={interaction.sampleFrameInspectorColor} onApplyFrameInspectorColor={() => interaction.applyFrameInspectorColor()} onAddPathMaskAnchor={interaction.addPathMaskAnchor} onCloseSelectedPathMask={interaction.closeSelectedPathMask} onBeginPathMaskDrag={interaction.beginPathMaskDrag} onUpdatePathMaskDrag={interaction.updatePathMaskDrag} onEndPathMaskDrag={interaction.endPathMaskDrag} onUpdateCompareSplit={interaction.updateCompareSplitFromPointer} onCompareDividerDraggingChange={setCompareDividerDragging} onMulticamLiveModeChange={(enabled) => { liveCutSessionRef.current = null; setMulticamLiveMode(enabled); }} onSelectMulticamAngle={recordMulticamAngleCut} onTrimMulticamSwitch={trimMulticamSwitchAtHandle} />
            <button type="button" className="absolute left-3 top-3 z-50 rounded border border-white/15 bg-black/65 px-2 py-1 text-[11px] font-semibold tabular-nums text-white shadow-soft hover:bg-black/80" title={t.previewZoomReset} data-testid="preview-zoom-label" onClick={interaction.resetPreviewZoom}>{Math.round(previewZoom * 100)}%</button>
          </div>
        </div>
        {scopesOpen ? <ColorScopesPanel frame={renderer.scopeFrame} active={scopesOpen} /> : null}
      </div>
      <PreviewTimeline playheadTime={playheadTime} fps={fps} project={project} frameSearchQuery={frameSearchQuery} frameSearchError={frameSearchError} frameSearchFocused={frameSearchFocused} frameSearchHistory={frameSearchHistory} frameSearchCandidates={frameSearchCandidates} showFrameSearchCandidates={showFrameSearchCandidates} showFrameSearchHistory={showFrameSearchHistory} onFrameSearchQueryChange={setFrameSearchQuery} onFrameSearchErrorChange={setFrameSearchError} onFrameSearchFocusedChange={setFrameSearchFocused} onFrameSearchHistoryChange={setFrameSearchHistory} onJumpToFrame={setPlayheadTime} onSelectClip={setSelectedClipIds} onStopPlayback={() => setIsPlaying(false)} frameSearchInputRef={frameSearchInputRef} />
    </section>
  );
}
