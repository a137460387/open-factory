import { lazy, Suspense, useMemo } from 'react';
import type { Clip, Project } from '@open-factory/editor-core';
import { getTimelinePlaybackDuration, AddClipCommand } from '@open-factory/editor-core';
import type { NarrativeGenerationResult } from '@open-factory/editor-core';
import { ChevronRight } from 'lucide-react';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { PanelLoading } from '../PanelLoading';
import { CollapsedPanelRail } from '../CollapsedPanelRail';
import { zhCN } from '../../i18n/strings';
import { featureStrings } from '../../i18n/featureStrings';
import { selectClipById, useEditorStore } from '../../store/editorStore';
import { commandManager, timelineAccessor } from '../../store/commandManager';
import {
  useLayoutSettings,
  useSetLayoutSettings,
  useViewportSize,
  useReviewMode,
  usePersistLayoutPatch,
  usePersistPanelVisibilityPatch,
} from '../../store/panelStore';
import { useEditorUIStore } from '../../store/editorUIStore';
import { useTransitionStore } from '../../store/transitionStore';
import { getEffectivePanelState } from '../../layout/layoutSettings';
import { getReviewModeShellVisibility } from '../../review/reviewMode';

const AudioMixer = lazy(() => import('../AudioMixer/AudioMixer').then((m) => ({ default: m.AudioMixer })));
const Inspector = lazy(() => import('../Inspector/Inspector').then((m) => ({ default: m.Inspector })));
const SmartRoughCutPanel = lazy(() =>
  import('../SmartRoughCut/SmartRoughCutPanel').then((m) => ({ default: m.SmartRoughCutPanel })),
);
const SmartRoughCutOrchestratorPanel = lazy(() =>
  import('../SmartRoughCut/SmartRoughCutOrchestratorPanel').then((m) => ({
    default: m.SmartRoughCutOrchestratorPanel,
  })),
);
const AIRoughCutPanel = lazy(() =>
  import('../AIRoughCut/AIRoughCutPanel').then((m) => ({ default: m.AIRoughCutPanel })),
);
const DirectorModePanel = lazy(() =>
  import('../DirectorMode/DirectorModePanel').then((m) => ({ default: m.DirectorModePanel })),
);
const MusicMatchPanel = lazy(() =>
  import('../MusicMatch/MusicMatchPanel').then((m) => ({ default: m.MusicMatchPanel })),
);
const HighlightReelPanel = lazy(() =>
  import('../HighlightReel/HighlightReelPanel').then((m) => ({ default: m.HighlightReelPanel })),
);
const ContextualTranslationPanel = lazy(() =>
  import('../ContextualTranslation/ContextualTranslationPanel').then((m) => ({
    default: m.ContextualTranslationPanel,
  })),
);
const AIChatEditorPanel = lazy(() =>
  import('../AIChatEditor/AIChatEditorPanel').then((m) => ({ default: m.AIChatEditorPanel })),
);
const AIVideoSummaryPanel = lazy(() =>
  import('../AIVideoSummary/AIVideoSummaryPanel').then((m) => ({ default: m.AIVideoSummaryPanel })),
);
const AINarrationPanel = lazy(() =>
  import('../AINarration/AINarrationPanel').then((m) => ({ default: m.AINarrationPanel })),
);
const SmartCreationPanel = lazy(() =>
  import('../SmartCreation/SmartCreationPanel').then((m) => ({ default: m.SmartCreationPanel })),
);
const HistoryPanel = lazy(() => import('../History/HistoryPanel').then((m) => ({ default: m.HistoryPanel })));
const ProjectDocumentationPanel = lazy(() =>
  import('../ProjectDocumentationPanel').then((m) => ({ default: m.ProjectDocumentationPanel })),
);
const AISubtitleWorkflowPanel = lazy(() =>
  import('../AISubtitleWorkflow/AISubtitleWorkflowPanel').then((m) => ({ default: m.AISubtitleWorkflowPanel })),
);
const SmartDistributionPanel = lazy(() =>
  import('../SmartDistribution/SmartDistributionPanel').then((m) => ({ default: m.SmartDistributionPanel })),
);
const TransitionLibrary = lazy(() =>
  import('../Transitions/TransitionLibrary').then((m) => ({ default: m.TransitionLibrary })),
);

export function ShellRightPanel() {
  const project = useEditorStore((s) => s.project);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const selectedClipIds = useEditorStore((s) => s.selectedClipIds);
  const selectedKeyframe = useEditorStore((s) => s.selectedKeyframe);
  const selectedKeyframes = useEditorStore((s) => s.selectedKeyframes);
  const playheadTime = useEditorStore((s) => s.playheadTime);

  const layoutSettings = useLayoutSettings();
  const setLayoutSettings = useSetLayoutSettings();
  const viewportSize = useViewportSize();
  const reviewMode = useReviewMode();
  const persistLayoutPatch = usePersistLayoutPatch();
  const persistPanelVisibilityPatch = usePersistPanelVisibilityPatch();
  const projectDocumentationOpen = useEditorUIStore((s) => s.projectDocumentationOpen);
  const historyPanelOpen = useEditorUIStore((s) => s.historyPanelOpen);
  const setHistoryPanelOpen = useEditorUIStore((s) => s.setHistoryPanelOpen);
  const aiRoughCutOpen = useEditorUIStore((s) => s.aiRoughCutOpen);
  const setAiRoughCutOpen = useEditorUIStore((s) => s.setAiRoughCutOpen);
  const directorModeOpen = useEditorUIStore((s) => s.directorModeOpen);
  const setDirectorModeOpen = useEditorUIStore((s) => s.setDirectorModeOpen);
  const musicMatchOpen = useEditorUIStore((s) => s.musicMatchOpen);
  const setMusicMatchOpen = useEditorUIStore((s) => s.setMusicMatchOpen);
  const highlightReelOpen = useEditorUIStore((s) => s.highlightReelOpen);
  const setHighlightReelOpen = useEditorUIStore((s) => s.setHighlightReelOpen);
  const contextualTranslationOpen = useEditorUIStore((s) => s.contextualTranslationOpen);
  const setContextualTranslationOpen = useEditorUIStore((s) => s.setContextualTranslationOpen);
  const aiChatEditorOpen = useEditorUIStore((s) => s.aiChatEditorOpen);
  const setAiChatEditorOpen = useEditorUIStore((s) => s.setAiChatEditorOpen);
  const videoSummaryOpen = useEditorUIStore((s) => s.videoSummaryOpen);
  const setVideoSummaryOpen = useEditorUIStore((s) => s.setVideoSummaryOpen);
  const narrationOpen = useEditorUIStore((s) => s.narrationOpen);
  const setNarrationOpen = useEditorUIStore((s) => s.setNarrationOpen);
  const smartCreationOpen = useEditorUIStore((s) => s.smartCreationOpen);
  const setSmartCreationOpen = useEditorUIStore((s) => s.setSmartCreationOpen);
  const smartDistributionOpen = useEditorUIStore((s) => s.smartDistributionOpen);
  const setSmartDistributionOpen = useEditorUIStore((s) => s.setSmartDistributionOpen);
  const smartRoughCutOpen = useEditorUIStore((s) => s.smartRoughCutOpen);
  const aiSubtitleWorkflowOpen = useEditorUIStore((s) => s.aiSubtitleWorkflowOpen);
  const setAiSubtitleWorkflowOpen = useEditorUIStore((s) => s.setAiSubtitleWorkflowOpen);
  const storyboardOpen = useEditorUIStore((s) => s.storyboardOpen);

  const transitionLibraryOpen = useTransitionStore((s) => s.libraryOpen);
  const setTransitionLibraryOpen = useTransitionStore((s) => s.setLibraryOpen);

  const selectedClip = useMemo(() => selectClipById(project, selectedClipId), [project, selectedClipId]);
  const selectedClips = useMemo(
    () => selectedClipIds.map((id) => selectClipById(project, id)).filter((c): c is Clip => Boolean(c)),
    [project, selectedClipIds],
  );
  const selectedClipLocked = useMemo(
    () => Boolean(selectedClip && project.timeline.tracks.find((t) => t.id === selectedClip.trackId)?.locked),
    [project.timeline.tracks, selectedClip],
  );

  const effectivePanels = useMemo(
    () => getEffectivePanelState(layoutSettings, viewportSize.width),
    [layoutSettings, viewportSize.width],
  );
  const reviewVisibility = useMemo(() => getReviewModeShellVisibility(reviewMode), [reviewMode]);

  const rightPrimaryPanelLabel = projectDocumentationOpen
    ? zhCN.panels.projectDocumentation
    : historyPanelOpen
      ? zhCN.panels.history
      : aiRoughCutOpen
        ? zhCN.aiRoughCut.title
        : directorModeOpen
          ? zhCN.directorMode.title
          : musicMatchOpen
            ? zhCN.musicMatch.title
            : highlightReelOpen
              ? zhCN.highlightReel.title
              : contextualTranslationOpen
                ? zhCN.contextualTranslation.title
                : aiChatEditorOpen
                  ? zhCN.aiChatEditor.title
                  : videoSummaryOpen
                    ? zhCN.aiVideoSummary.title
                    : narrationOpen
                      ? zhCN.aiNarration.title
                      : smartCreationOpen
                        ? featureStrings.smartCreation.title
                        : smartDistributionOpen
                          ? '智能分发'
                          : aiSubtitleWorkflowOpen
                            ? zhCN.aiSubtitleWorkflow.title
                            : smartRoughCutOpen
                              ? zhCN.panels.smartRoughCut
                              : transitionLibraryOpen
                                ? zhCN.timeline.transitionPicker
                                : zhCN.panels.inspector;

  const rightPanelRows =
    effectivePanels.rightPrimaryPanelVisible && effectivePanels.audioMixerVisible
      ? `minmax(0,1fr) ${layoutSettings.mixerHeightPx}px`
      : 'minmax(0,1fr)';

  if (!reviewVisibility.showRightPanel) return null;

  if (effectivePanels.rightPanelCollapsed) {
    return (
      <CollapsedPanelRail
        side="right"
        label={zhCN.layout.inspectorPanelCollapsed}
        title={zhCN.layout.expandInspectorPanel}
        testId="right-panel-expand-button"
        onClick={() =>
          persistLayoutPatch({ rightPanelCollapsed: false, panels: { ...layoutSettings.panels, inspector: true } })
        }
      />
    );
  }

  return (
    <aside
      className="relative grid h-full min-h-0 min-w-0 gap-px bg-line transition-[grid-template-rows] duration-200 ease-out"
      style={{ gridTemplateRows: rightPanelRows }}
      data-testid="right-panel"
      data-collapsed="false"
    >
      <button
        className="absolute right-2 top-2 z-20 inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-white/95 text-slate-600 shadow-sm hover:bg-panel"
        type="button"
        title={zhCN.layout.collapseInspectorPanel}
        aria-label={zhCN.layout.collapseInspectorPanel}
        data-testid="right-panel-collapse-button"
        onClick={() =>
          persistLayoutPatch({
            rightPanelCollapsed: true,
            panels: { ...layoutSettings.panels, inspector: false, audioMixer: false },
          })
        }
      >
        <ChevronRight size={16} />
      </button>
      {effectivePanels.rightPrimaryPanelVisible ? (
        <ErrorBoundary name={rightPrimaryPanelLabel}>
          <Suspense fallback={<PanelLoading label={rightPrimaryPanelLabel} />}>
            {projectDocumentationOpen ? (
              <ProjectDocumentationPanel project={project} />
            ) : historyPanelOpen ? (
              <HistoryPanel />
            ) : aiRoughCutOpen ? (
              <AIRoughCutPanel media={project.media} onClose={() => setAiRoughCutOpen(false)} />
            ) : directorModeOpen ? (
              <DirectorModePanel media={project.media} favoriteIds={[]} onClose={() => setDirectorModeOpen(false)} />
            ) : musicMatchOpen ? (
              <MusicMatchPanel
                media={project.media}
                sequenceDuration={
                  project.sequences.find((s) => s.id === project.activeSequenceId)?.settings?.duration ?? 0
                }
                onClose={() => setMusicMatchOpen(false)}
              />
            ) : highlightReelOpen ? (
              <HighlightReelPanel
                media={project.media}
                clips={project.timeline.tracks.flatMap((t) => t.clips)}
                selectedClipIds={selectedClipIds}
                onClose={() => setHighlightReelOpen(false)}
              />
            ) : contextualTranslationOpen ? (
              <ContextualTranslationPanel
                subtitleClips={project.timeline.tracks
                  .filter((t) => t.type === 'subtitle')
                  .flatMap((t) => t.clips)
                  .filter((c) => c.type === 'subtitle')}
                onClose={() => setContextualTranslationOpen(false)}
              />
            ) : aiChatEditorOpen ? (
              <AIChatEditorPanel project={project} onClose={() => setAiChatEditorOpen(false)} />
            ) : videoSummaryOpen ? (
              <AIVideoSummaryPanel project={project} onClose={() => setVideoSummaryOpen(false)} />
            ) : narrationOpen ? (
              <AINarrationPanel project={project} onClose={() => setNarrationOpen(false)} />
            ) : aiSubtitleWorkflowOpen ? (
              <AISubtitleWorkflowPanel
                selectedClip={selectedClip}
                media={project.media}
                onClose={() => setAiSubtitleWorkflowOpen(false)}
              />
            ) : smartRoughCutOpen ? (
              <SmartRoughCutOrchestratorPanel selectedClip={selectedClip} media={project.media} />
            ) : smartCreationOpen ? (
              <SmartCreationPanel
                open={smartCreationOpen}
                onClose={() => setSmartCreationOpen(false)}
                media={project.media}
                onApplyRecommendations={(clipIds) => {
                  const store = useEditorStore.getState();
                  const { project } = store;
                  const firstVideoTrack = project.timeline.tracks.find((t) => t.type === 'video');
                  if (!firstVideoTrack) return;

                  const clipsToAdd = clipIds
                    .map((id) => project.media.find((m) => m.id === id))
                    .filter((m): m is NonNullable<typeof m> => Boolean(m));

                  if (clipsToAdd.length === 0) return;

                  const lastClipEnd =
                    firstVideoTrack.clips.length > 0
                      ? Math.max(...firstVideoTrack.clips.map((c) => c.start + c.duration))
                      : 0;

                  let currentTime = lastClipEnd;
                  for (const media of clipsToAdd) {
                    const clip = {
                      id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                      mediaId: media.id,
                      name: media.name,
                      type: 'video' as const,
                      trackId: firstVideoTrack.id,
                      start: currentTime,
                      duration: media.duration,
                      trimStart: 0,
                      trimEnd: 0,
                      speed: 1,
                      volume: 1,
                      colorCorrection: { brightness: 0, contrast: 0, saturation: 0, hue: 0 },
                      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
                    };
                    commandManager.execute(new AddClipCommand(timelineAccessor, clip));
                    currentTime += media.duration;
                  }
                }}
                onApplyStoryline={(storyline) => {
                  const store = useEditorStore.getState();
                  const { project } = store;
                  const firstVideoTrack = project.timeline.tracks.find((t) => t.type === 'video');
                  if (!firstVideoTrack || !storyline.storyline.length) return;

                  let currentTime = 0;
                  for (const segment of storyline.storyline) {
                    const matchingMedia =
                      project.media.find((m) => {
                        const scene = m.aiAnalysis?.scene?.toLowerCase() ?? '';
                        return scene.includes(segment.sceneType) || segment.suggestedClips.includes(m.id);
                      }) ?? project.media[0];

                    if (!matchingMedia) continue;

                    const clip = {
                      id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                      mediaId: matchingMedia.id,
                      name: `${segment.purpose} - ${matchingMedia.name}`,
                      type: 'video' as const,
                      trackId: firstVideoTrack.id,
                      start: currentTime,
                      duration: segment.duration,
                      trimStart: 0,
                      trimEnd: Math.max(0, matchingMedia.duration - segment.duration),
                      speed: 1,
                      volume: 1,
                      colorCorrection: { brightness: 0, contrast: 0, saturation: 0, hue: 0 },
                      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
                    };
                    commandManager.execute(new AddClipCommand(timelineAccessor, clip));
                    currentTime += segment.duration;
                  }
                }}
              />
            ) : smartDistributionOpen ? (
              <SmartDistributionPanel
                projectWidth={project.settings.width}
                projectHeight={project.settings.height}
                projectDuration={getTimelinePlaybackDuration(project.timeline)}
                hasSubtitles={project.timeline?.tracks?.some((t) => t.type === 'subtitle') ?? false}
                onClose={() => setSmartDistributionOpen(false)}
              />
            ) : transitionLibraryOpen ? (
              <TransitionLibrary
                onClose={() => setTransitionLibraryOpen(false)}
                onSelectTransition={(type) => {
                  // 选中转场时可扩展：应用到当前选中的转场或打开参数面板
                }}
              />
            ) : layoutSettings.panels.inspector ? (
              <Inspector
                clip={selectedClip}
                selectedClips={selectedClips}
                selectedCount={selectedClipIds.length}
                selectedClipLocked={selectedClipLocked}
                selectedKeyframe={selectedKeyframe}
                selectedKeyframes={selectedKeyframes}
                media={project.media}
                playheadTime={playheadTime}
                projectSettings={project.settings}
              />
            ) : null}
          </Suspense>
        </ErrorBoundary>
      ) : null}
      {effectivePanels.audioMixerVisible ? (
        <ErrorBoundary name={zhCN.panels.audioMixer}>
          <Suspense fallback={<PanelLoading label={zhCN.panels.audioMixer} compact />}>
            <AudioMixer />
          </Suspense>
        </ErrorBoundary>
      ) : null}
    </aside>
  );
}
