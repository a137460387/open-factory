import { lazy, Suspense, type PointerEvent as ReactPointerEvent } from 'react';
import { GripHorizontal } from 'lucide-react';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { PanelLoading } from '../PanelLoading';
import { ShellLeftPanel } from './ShellLeftPanel';
import { ShellRightPanel } from './ShellRightPanel';
import { zhCN } from '../../i18n/strings';
import type { WorkspaceLayoutId } from '../../layout/layoutSettings';
import type {
  TimelineGridSettings,
  ProfilerFrameSample,
  TimelineColorHeatmapPoint,
  SceneColorDifference,
} from '@open-factory/editor-core';
import type { PreviewPerformanceSettings, PreviewQualityMode } from '../../lib/preview/preview-performance';
import type { TimelineHeatmapViewSettings, TimelineInteractionSettings } from '../../settings/appSettings';
import type { ReviewAnnotation } from '@open-factory/editor-core';
import { AngleSwitcherPanel } from '../AngleSwitcher/AngleSwitcherPanel';
import { useEditorStore, findMulticamClipInProject } from '../../store/editorStore';

const PreviewCanvas = lazy(() =>
  import('../PreviewCanvas/PreviewCanvas').then((module) => ({ default: module.PreviewCanvas })),
);
const Timeline = lazy(() => import('../Timeline/Timeline').then((module) => ({ default: module.Timeline })));
const StoryboardView = lazy(() =>
  import('../Storyboard/StoryboardView').then((module) => ({ default: module.StoryboardView })),
);

interface ShellMainAreaProps {
  // 布局样式
  mainGridColumns: string;

  // 面板状态
  effectivePanels: {
    leftPanelCollapsed: boolean;
    rightPanelCollapsed: boolean;
    rightPanelAutoCollapsed: boolean;
  };
  layoutSettings: {
    activeWorkspaceLayoutId: WorkspaceLayoutId;
    panels: {
      colorScopes: boolean;
      bookmarks: boolean;
    };
  };
  reviewMode: boolean;

  // 预览区域
  previewWindowOpen: boolean;
  safeFrameGuides: boolean;
  previewPerformance: PreviewPerformanceSettings;
  handleProfilerFrame: (sample: ProfilerFrameSample) => void;
  addReviewAnnotationAtPlayhead: (
    annotation: Omit<ReviewAnnotation, 'id'> & Partial<Pick<ReviewAnnotation, 'id'>>,
  ) => void;
  createReviewReport: () => Promise<void>;
  reembedPreviewWindow: () => Promise<void>;
  persistPanelVisibilityPatch: (patch: Record<string, boolean>) => void;

  // 时间轴区域
  reviewVisibility: {
    showTimelineResizeHandle: boolean;
    showTimeline: boolean;
  };
  timelineHeightPx: number;
  storyboardOpen: boolean;
  thumbnailTrackVisible: boolean;
  timelineMinimapVisible: boolean;
  timelineHeatmap: TimelineHeatmapViewSettings;
  colorHeatmapPoints: TimelineColorHeatmapPoint[];
  colorAnalysisJumps: SceneColorDifference[];
  timelineGridSettings: TimelineGridSettings;
  reduceMotion: boolean;
  convertVfrMediaToCfr: (clipId: string) => void;
  sceneDetectionRequestId: number;
  onRoughCutCompare?: (clipId: string) => void;

  // 回调
  leftPanelCallbacks: React.ComponentProps<typeof ShellLeftPanel>['callbacks'];
  beginTimelineResize: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

export function ShellMainArea({
  mainGridColumns,
  effectivePanels,
  layoutSettings,
  reviewMode,
  previewWindowOpen,
  safeFrameGuides,
  previewPerformance,
  handleProfilerFrame,
  addReviewAnnotationAtPlayhead,
  createReviewReport,
  reembedPreviewWindow,
  persistPanelVisibilityPatch,
  reviewVisibility,
  timelineHeightPx,
  storyboardOpen,
  thumbnailTrackVisible,
  timelineMinimapVisible,
  timelineHeatmap,
  colorHeatmapPoints,
  colorAnalysisJumps,
  timelineGridSettings,
  reduceMotion,
  convertVfrMediaToCfr,
  sceneDetectionRequestId,
  onRoughCutCompare,
  leftPanelCallbacks,
  beginTimelineResize,
}: ShellMainAreaProps) {
  // Check if we're in multicam edit mode
  const multicamEditMode = useEditorStore((s) => s.multicamEditMode);
  const activeMulticamClipId = useEditorStore((s) => s.activeMulticamClipId);
  const project = useEditorStore((s) => s.project);
  const playheadTime = useEditorStore((s) => s.playheadTime);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const isMulticamSyncing = useEditorStore((s) => s.isMulticamSyncing);
  const switchMulticamAngle = useEditorStore((s) => s.switchMulticamAngle);
  const syncMulticamClip = useEditorStore((s) => s.syncMulticamClip);
  const addMulticamSwitchPoint = useEditorStore((s) => s.addMulticamSwitchPoint);
  const deleteMulticamSwitchPoint = useEditorStore((s) => s.deleteMulticamSwitchPoint);
  const updateMulticamSwitchPoint = useEditorStore((s) => s.updateMulticamSwitchPoint);
  const detectMulticamDrift = useEditorStore((s) => s.detectMulticamDrift);

  const activeMulticamClip =
    multicamEditMode && activeMulticamClipId ? findMulticamClipInProject(project, activeMulticamClipId) : null;

  return (
    <>
      <main
        className="grid min-h-0 min-w-0 gap-px bg-line transition-[grid-template-columns] duration-200 ease-out"
        style={{ gridTemplateColumns: mainGridColumns }}
        data-testid="editor-main-layout"
        data-left-collapsed={effectivePanels.leftPanelCollapsed ? 'true' : 'false'}
        data-right-collapsed={effectivePanels.rightPanelCollapsed ? 'true' : 'false'}
        data-right-auto-collapsed={effectivePanels.rightPanelAutoCollapsed ? 'true' : 'false'}
        data-workspace-layout={layoutSettings.activeWorkspaceLayoutId}
        data-review-mode={reviewMode ? 'true' : 'false'}
      >
        <ShellLeftPanel callbacks={leftPanelCallbacks} />
        <ErrorBoundary name={zhCN.panels.preview}>
          <Suspense fallback={<PanelLoading label={zhCN.panels.preview} />}>
            {previewWindowOpen ? (
              <section
                className="grid min-h-0 place-items-center bg-[#111827] p-6 text-center text-white"
                data-testid="preview-window-placeholder"
              >
                <div className="max-w-sm">
                  <div className="text-sm font-semibold">{zhCN.preview.detachedPlaceholderTitle}</div>
                  <div className="mt-2 text-xs leading-5 text-slate-300">{zhCN.preview.detachedPlaceholderMessage}</div>
                  <button
                    className="mt-4 inline-flex h-9 items-center justify-center rounded-md border border-white/15 bg-white/10 px-3 text-sm font-medium text-white hover:bg-white/20"
                    type="button"
                    data-testid="preview-window-reembed-button"
                    onClick={() => void reembedPreviewWindow()}
                  >
                    {zhCN.preview.detachedReembed}
                  </button>
                </div>
              </section>
            ) : (
              <div className="relative min-h-0">
                <PreviewCanvas
                  safeFrameGuides={safeFrameGuides}
                  previewPerformance={previewPerformance}
                  colorScopesVisible={layoutSettings.panels.colorScopes}
                  onColorScopesVisibleChange={(colorScopes: boolean) => persistPanelVisibilityPatch({ colorScopes })}
                  reviewMode={reviewMode}
                  onProfilerFrame={handleProfilerFrame}
                  onAddReviewAnnotation={addReviewAnnotationAtPlayhead}
                  onExportReviewReport={() => void createReviewReport()}
                />
                {activeMulticamClip && (
                  <AngleSwitcherPanel
                    multicamClip={activeMulticamClip}
                    currentTime={playheadTime}
                    isPlaying={isPlaying}
                    onAngleSwitch={(angleIndex, _time) => switchMulticamAngle(angleIndex)}
                    onSyncRequest={syncMulticamClip}
                    onSwitchPointAdd={addMulticamSwitchPoint}
                    onSwitchPointDelete={deleteMulticamSwitchPoint}
                    onSwitchPointUpdate={updateMulticamSwitchPoint}
                    onDriftDetection={detectMulticamDrift}
                    isSyncing={isMulticamSyncing}
                  />
                )}
              </div>
            )}
          </Suspense>
        </ErrorBoundary>
        <ShellRightPanel />
      </main>
      {reviewVisibility.showTimelineResizeHandle ? (
        <div
          className="flex cursor-row-resize items-center justify-center bg-line text-slate-500 transition hover:bg-brand/20 hover:text-brand"
          role="separator"
          aria-orientation="horizontal"
          aria-label={zhCN.layout.resizeTimeline}
          data-testid="timeline-resize-handle"
          onPointerDown={beginTimelineResize}
        >
          <GripHorizontal size={18} />
        </div>
      ) : null}
      {reviewVisibility.showTimeline ? (
        <section
          className="min-h-0 overflow-hidden transition-[height] duration-200 ease-out"
          data-testid="timeline-panel"
          style={{ height: timelineHeightPx }}
        >
          <ErrorBoundary name={storyboardOpen ? zhCN.storyboard.title : zhCN.panels.timeline}>
            {storyboardOpen ? (
              <Suspense fallback={null}>
                <StoryboardView />
              </Suspense>
            ) : (
              <Timeline
                thumbnailTrackVisible={thumbnailTrackVisible}
                minimapVisible={timelineMinimapVisible}
                heatmap={timelineHeatmap}
                colorHeatmap={colorHeatmapPoints}
                colorJumps={colorAnalysisJumps}
                timelineGridSettings={timelineGridSettings}
                reduceMotion={reduceMotion}
                bookmarkPanelOpen={layoutSettings.panels.bookmarks}
                onBookmarkPanelOpenChange={(bookmarks: boolean) => persistPanelVisibilityPatch({ bookmarks })}
                onConvertMediaFrameRate={convertVfrMediaToCfr}
                sceneDetectionRequestId={sceneDetectionRequestId}
                onRoughCutCompare={onRoughCutCompare}
              />
            )}
          </ErrorBoundary>
        </section>
      ) : null}
    </>
  );
}
