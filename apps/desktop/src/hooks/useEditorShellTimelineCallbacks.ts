import { useCallback } from 'react';
import {
  AddAdjustmentLayerCommand,
  AddClipCommand,
  AddMotionGraphicCommand,
  ApplyEffectPresetCommand,
  ApplySplitLayoutCommand,
  BatchUpdateClipCommand,
  CreateMulticamSequenceCommand,
  DeleteClipsCommand,
  DeleteGroupCommand,
  ImportEDLCommand,
  ImportFCPXMLCommand,
  PiPLayoutCommand,
  RippleDeleteCommand,
  SplitClipCommand,
  analyzeColorFrameSample,
  buildColorAlignmentUpdates,
  buildTimelineColorHeatmapData,
  createId,
  createMainSideSplitLayout,
  createTrack,
  detectSceneColorJumps,
  findCompleteClipGroup,
  getClipSourceVisibleDuration,
  getSplitLayoutDefinition,
  getTimelineDuration,
  instantiateTitleTemplate,
  matchFrameFromClip,
  normalizeClipGroups,
  type ColorAnalysisClipSample,
  type EffectPreset,
  type MediaAsset,
  type PiPLayoutPosition,
  type Subclip,
  type TimelineColorAnalysisResult,
  type TitleTemplateId,
} from '@open-factory/editor-core';
import {
  computeTimelineGaps,
  getMediaInstanceNavigation,
  navigateGap,
  navigateToNextInstance as coreNavigateToNextInstance,
  revealInTimeline as coreRevealInTimeline,
} from '@open-factory/editor-core';
import { readColorMatchFrameSample, renderPreviewCache } from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';
import { zhCN, t } from '../i18n/strings';
import { commandManager, projectAccessor, timelineAccessor } from '../store/commandManager';
import { useEditorStore, selectClipById } from '../store/editorStore';
import { useEditorFeatureStore } from '../store/editorFeatureStore';
import { useEditorUIStore } from '../store/editorUIStore';
import { useMediaJobStore } from '../media/media-job-store';
import { useProxySettingsStore } from '../store/proxySettingsStore';
import { ensureMediaJobRunner } from '../media/media-job-runner';
import {
  createAdjustmentLayerClip,
  createClipFromAsset,
  createMotionGraphicClip,
  findPreferredTrack,
} from '../lib/clipFactory';
import {
  collectClipKeyframeRefs,
  findTimelineClipForMediaSourceTime,
  getClipSourceDimensions,
} from '../lib/timeline-clip-helpers';
import { saveCustomSplitLayouts } from '../settings/appSettings';
import type { SplitLayoutDefinition } from '@open-factory/editor-core';

// ---------------------------------------------------------------------------
// 参数接口：Timeline/Clip 编辑操作回调组
// ---------------------------------------------------------------------------

interface TimelineCallbacksDeps {
  /** 颜色分析忙碌状态 */
  colorAnalysisBusy: boolean;
  /** 颜色分析结果 */
  colorAnalysisResults: TimelineColorAnalysisResult[];
  /** 颜色分析样本 */
  colorAnalysisSamples: ColorAnalysisClipSample[];
  /** PiP 布局位置 */
  pipLayoutPosition: PiPLayoutPosition;
  /** 自定义分屏布局 */
  customSplitLayouts: SplitLayoutDefinition[];
  /** 是否可以应用分屏布局 */
  canApplySplitLayout: boolean;
  /** 选中的 PiP clips */
  selectedPiPClips: Array<{
    clip: import('@open-factory/editor-core').Clip;
    track: import('@open-factory/editor-core').Project['timeline']['tracks'][number];
    trackIndex: number;
    selectedIndex: number;
  }>;
  /** 选中的分屏布局 clips */
  selectedSplitLayoutClips: Array<{
    clip: import('@open-factory/editor-core').Clip;
    track: import('@open-factory/editor-core').Project['timeline']['tracks'][number];
    trackIndex: number;
    selectedIndex: number;
  }>;
  /** 时间线可视片段引用 */
  visualTimelineClipRefs: Array<{
    clip: Extract<import('@open-factory/editor-core').Clip, { type: 'video' | 'image' }>;
    trackId: string;
    media: MediaAsset;
  }>;
  /** 项目路径 */
  projectPath: string | null;
  /** 设置自定义分屏布局 */
  setCustomSplitLayouts: (layouts: SplitLayoutDefinition[]) => void;
}

/** 时间线/Clip 编辑操作相关的回调组（约 28 个回调） */
export function useEditorShellTimelineCallbacks(deps: TimelineCallbacksDeps) {
  const {
    colorAnalysisBusy,
    colorAnalysisResults,
    colorAnalysisSamples,
    pipLayoutPosition,
    customSplitLayouts,
    canApplySplitLayout,
    selectedPiPClips,
    selectedSplitLayoutClips,
    visualTimelineClipRefs,
    projectPath,
    setCustomSplitLayouts,
  } = deps;

  // store setters
  const setSelectedClipId = useEditorStore((s) => s.setSelectedClipId);
  const setSelectedClipIds = useEditorStore((s) => s.setSelectedClipIds);
  const setSelectedKeyframes = useEditorStore((s) => s.setSelectedKeyframes);
  const setColorAnalysisBusy = useEditorFeatureStore((s) => s.setColorAnalysisBusy);
  const setColorAnalysisResults = useEditorFeatureStore((s) => s.setColorAnalysisResults);
  const setColorAnalysisJumps = useEditorFeatureStore((s) => s.setColorAnalysisJumps);
  const setColorAnalysisSamples = useEditorFeatureStore((s) => s.setColorAnalysisSamples);
  const setColorHeatmapPoints = useEditorFeatureStore((s) => s.setColorHeatmapPoints);
  const setColorAnalysisOpen = useEditorUIStore((s) => s.setColorAnalysisOpen);
  const setColorNodeEditorOpen = useEditorUIStore((s) => s.setColorNodeEditorOpen);

  // -----------------------------------------------------------------------
  // Clip 添加到时间线
  // -----------------------------------------------------------------------

  const addAssetToTimeline = useCallback(
    (assetId: string) => {
      const state = useEditorStore.getState();
      const asset = state.project.media.find((item) => item.id === assetId);
      const track = asset ? findPreferredTrack(state.project.timeline, asset) : undefined;
      if (!asset || !track) {
        showToast({
          kind: 'error',
          title: zhCN.editorToasts.noCompatibleTrack,
          message: zhCN.editorToasts.noCompatibleTrackMessage,
        });
        return;
      }
      try {
        const clip = createClipFromAsset(asset, track, state.project.timeline);
        commandManager.execute(new AddClipCommand(timelineAccessor, clip));
        if (asset.type === 'video') {
          useMediaJobStore.getState().enqueueProxyJobsForMedia([asset], useProxySettingsStore.getState().settings, {
            force: true,
            priority: 'high',
            sourceStart: clip.trimStart,
            sourceDuration: getClipSourceVisibleDuration(clip),
          });
          void ensureMediaJobRunner();
        }
        setSelectedClipId(clip.id);
      } catch (error) {
        showToast({
          kind: 'error',
          title: zhCN.editorToasts.addClipFailed,
          message: error instanceof Error ? error.message : zhCN.editorToasts.addClipFailedMessage,
        });
      }
    },
    [setSelectedClipId],
  );

  // -----------------------------------------------------------------------
  // Subclip 添加到时间线
  // -----------------------------------------------------------------------

  const handleAddSubclipToTimeline = useCallback(
    (assetId: string, subclip: Subclip) => {
      const state = useEditorStore.getState();
      const asset = state.project.media.find((item) => item.id === assetId);
      const track = asset ? findPreferredTrack(state.project.timeline, asset) : undefined;
      if (!asset || !track) {
        showToast({
          kind: 'error',
          title: zhCN.editorToasts.noCompatibleTrack,
          message: zhCN.editorToasts.noCompatibleTrackMessage,
        });
        return;
      }
      try {
        const clip = createClipFromAsset(asset, track, state.project.timeline, { subclip, subclipName: subclip.name });
        commandManager.execute(new AddClipCommand(timelineAccessor, clip));
        setSelectedClipId(clip.id);
      } catch (error) {
        showToast({
          kind: 'error',
          title: zhCN.editorToasts.addClipFailed,
          message: error instanceof Error ? error.message : zhCN.editorToasts.addClipFailedMessage,
        });
      }
    },
    [setSelectedClipId],
  );

  // -----------------------------------------------------------------------
  // Adjustment Layer / Effect Preset / Motion Graphic / Title Template
  // -----------------------------------------------------------------------

  const addAdjustmentLayer = useCallback(() => {
    const state = useEditorStore.getState();
    try {
      const adjustmentTrackCount = state.project.timeline.tracks.filter(
        (track) => track.type === 'video' && track.clips.some((clip) => clip.type === 'adjustment'),
      ).length;
      const track = createTrack({
        id: createId('track'),
        type: 'video',
        name: zhCN.timeline.adjustmentTrackName(adjustmentTrackCount + 1),
        clips: [],
      });
      const clip = createAdjustmentLayerClip(track, state.project.timeline);
      commandManager.execute(new AddAdjustmentLayerCommand(timelineAccessor, track, clip));
      setSelectedClipId(clip.id);
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.editorToasts.addClipFailed,
        message: error instanceof Error ? error.message : zhCN.editorToasts.addClipFailedMessage,
      });
    }
  }, [setSelectedClipId]);

  const applyEffectPresetToSelectedClip = useCallback((preset: EffectPreset) => {
    const state = useEditorStore.getState();
    const currentSelectedClip = selectClipById(state.project, state.selectedClipId);
    if (!currentSelectedClip) {
      showToast({
        kind: 'warning',
        title: zhCN.effectPresetLibrary.noClipSelected,
        message: zhCN.effectPresetLibrary.noClipSelectedMessage,
      });
      return;
    }
    try {
      commandManager.execute(new ApplyEffectPresetCommand(timelineAccessor, currentSelectedClip.id, preset));
      showToast({ kind: 'success', title: zhCN.effectPresetLibrary.applied, message: preset.name });
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.effectPresetLibrary.applyFailed,
        message: error instanceof Error ? error.message : zhCN.effectPresetLibrary.applyFailedMessage,
      });
    }
  }, []);

  const addMotionGraphic = useCallback(() => {
    const state = useEditorStore.getState();
    try {
      const trackCount = state.project.timeline.tracks.filter((track) => track.type === 'video').length;
      const track = createTrack({
        id: createId('track'),
        type: 'video',
        name: zhCN.motionGraphics.trackName(trackCount + 1),
        clips: [],
      });
      const clip = createMotionGraphicClip(track, state.project.timeline, state.playheadTime);
      commandManager.execute(new AddMotionGraphicCommand(timelineAccessor, track, clip));
      setSelectedClipId(clip.id);
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.editorToasts.addClipFailed,
        message: error instanceof Error ? error.message : zhCN.editorToasts.addClipFailedMessage,
      });
    }
  }, [setSelectedClipId]);

  const openColorNodeEditor = useCallback(() => {
    const state = useEditorStore.getState();
    const currentSelectedClip = selectClipById(state.project, state.selectedClipId);
    if (!currentSelectedClip || currentSelectedClip.type === 'audio') {
      showToast({
        kind: 'warning',
        title: zhCN.colorNodeEditor.unavailableTitle,
        message: zhCN.colorNodeEditor.unavailableMessage,
      });
      return;
    }
    setColorNodeEditorOpen(true);
  }, [setColorNodeEditorOpen]);

  const addTitleTemplate = useCallback(
    (templateId: TitleTemplateId) => {
      const state = useEditorStore.getState();
      const track = state.project.timeline.tracks.find((item) => item.type === 'text');
      if (!track) {
        showToast({
          kind: 'warning',
          title: zhCN.timeline.noTextTrackTitle,
          message: zhCN.timeline.noTextTrackMessage,
        });
        return;
      }
      try {
        const label = zhCN.titleTemplates[templateId];
        const clip = instantiateTitleTemplate(templateId, track, state.project.timeline, {
          name: label.name,
          text: label.defaultText,
        });
        commandManager.execute(new AddClipCommand(timelineAccessor, clip));
        setSelectedClipId(clip.id);
      } catch (error) {
        showToast({
          kind: 'error',
          title: zhCN.editorToasts.addClipFailed,
          message: error instanceof Error ? error.message : zhCN.editorToasts.addClipFailedMessage,
        });
      }
    },
    [setSelectedClipId],
  );

  // -----------------------------------------------------------------------
  // Split / Delete / Ripple Delete / Select All
  // -----------------------------------------------------------------------

  const splitSelected = useCallback(() => {
    const state = useEditorStore.getState();
    const currentSelectedClip = selectClipById(state.project, state.selectedClipId);
    if (!currentSelectedClip) {
      return;
    }
    try {
      commandManager.execute(new SplitClipCommand(timelineAccessor, currentSelectedClip.id, state.playheadTime));
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.editorToasts.splitUnavailable,
        message: error instanceof Error ? error.message : zhCN.editorToasts.splitUnavailableMessage,
      });
    }
  }, []);

  const deleteSelected = useCallback(() => {
    const state = useEditorStore.getState();
    const ids = state.selectedClipIds;
    if (ids.length === 0) {
      return;
    }
    const groups = normalizeClipGroups(
      state.project.clipGroups,
      state.project.timeline.tracks.flatMap((track) => track.clips.map((clip) => clip.id)),
    );
    const group = findCompleteClipGroup(groups, ids);
    if (group) {
      commandManager.execute(new DeleteGroupCommand(projectAccessor, group.id));
      state.clearSelectedClipIds();
      return;
    }
    commandManager.execute(new DeleteClipsCommand(timelineAccessor, ids));
    state.clearSelectedClipIds();
  }, []);

  const rippleDeleteSelected = useCallback(() => {
    const state = useEditorStore.getState();
    const ids = state.selectedClipIds;
    if (ids.length === 0) {
      return;
    }
    commandManager.execute(new RippleDeleteCommand(timelineAccessor, ids, state.project.protectedRanges));
    state.clearSelectedClipIds();
  }, []);

  const selectAllTimelineItems = useCallback(() => {
    const state = useEditorStore.getState();
    const clip = selectClipById(state.project, state.selectedClipId);
    const keyframes = clip ? collectClipKeyframeRefs(clip) : [];
    if (keyframes.length > 0) {
      state.setSelectedKeyframes(keyframes);
      return;
    }
    state.setSelectedClipIds(state.project.timeline.tracks.flatMap((track) => track.clips.map((item) => item.id)));
  }, []);

  // -----------------------------------------------------------------------
  // Color Analysis
  // -----------------------------------------------------------------------

  const runTimelineColorAnalysis = useCallback(async () => {
    if (colorAnalysisBusy) {
      return;
    }
    setColorAnalysisBusy(true);
    const results: TimelineColorAnalysisResult[] = [];
    const samples: ColorAnalysisClipSample[] = [];
    for (const item of visualTimelineClipRefs) {
      try {
        const sample = await readColorMatchFrameSample(item.media.path);
        if (!sample) {
          continue;
        }
        const metrics = analyzeColorFrameSample(sample);
        results.push({
          clipId: item.clip.id,
          trackId: item.trackId,
          mediaId: item.media.id,
          name: item.clip.name || item.media.name,
          start: item.clip.start,
          duration: item.clip.duration,
          metrics,
        });
        samples.push({ clipId: item.clip.id, sample });
      } catch {
        // Skip unreadable clips so one failed background sample cannot block the whole analysis.
      }
    }
    const jumps = detectSceneColorJumps(results);
    setColorAnalysisResults(results);
    setColorAnalysisSamples(samples);
    setColorAnalysisJumps(jumps);
    setColorHeatmapPoints(buildTimelineColorHeatmapData(results));
    setColorAnalysisBusy(false);
    showToast({
      kind: 'success',
      title: zhCN.colorAnalysis.completedTitle,
      message: zhCN.colorAnalysis.completedMessage(results.length, jumps.length),
    });
  }, [
    colorAnalysisBusy,
    visualTimelineClipRefs,
    setColorAnalysisBusy,
    setColorAnalysisResults,
    setColorAnalysisSamples,
    setColorAnalysisJumps,
    setColorHeatmapPoints,
  ]);

  const alignTimelineColorToReference = useCallback(
    (referenceClipId: string) => {
      const updates = buildColorAlignmentUpdates(colorAnalysisSamples, referenceClipId);
      if (updates.length === 0) {
        showToast({ kind: 'warning', title: zhCN.colorAnalysis.title, message: zhCN.colorAnalysis.alignSkipped });
        return;
      }
      commandManager.execute(
        new BatchUpdateClipCommand(
          timelineAccessor,
          updates.map((update) => ({
            clipId: update.clipId,
            patch: { colorCorrection: update.colorCorrection },
          })),
        ),
      );
      showToast({
        kind: 'success',
        title: zhCN.colorAnalysis.title,
        message: zhCN.colorAnalysis.alignApplied(updates.length),
      });
    },
    [colorAnalysisSamples],
  );

  const openColorAnalysis = useCallback(() => {
    setColorAnalysisOpen(true);
    if (colorAnalysisResults.length === 0) {
      void runTimelineColorAnalysis();
    }
  }, [colorAnalysisResults.length, runTimelineColorAnalysis, setColorAnalysisOpen]);

  // -----------------------------------------------------------------------
  // Spectrum
  // -----------------------------------------------------------------------

  const seekSpectrumTime = useCallback(
    (asset: MediaAsset, sourceTime: number) => {
      const state = useEditorStore.getState();
      const currentSelectedClip = selectClipById(state.project, state.selectedClipId);
      const match = findTimelineClipForMediaSourceTime(
        state.project.timeline,
        asset.id,
        sourceTime,
        currentSelectedClip,
      );
      if (match) {
        setSelectedClipId(match.clip.id);
        useEditorStore.getState().setPlayheadTime(match.timelineTime);
        return;
      }
      useEditorStore.getState().setPlayheadTime(sourceTime);
    },
    [setSelectedClipId],
  );

  const setSpectrumSelectionRange = (range: { inPoint: number; outPoint: number }) => {
    useEditorStore.getState().setInPoint(range.inPoint);
    useEditorStore.getState().setOutPoint(range.outPoint);
  };

  const splitSpectrumAtTime = useCallback(
    (asset: MediaAsset, sourceTime: number) => {
      const state = useEditorStore.getState();
      const currentSelectedClip = selectClipById(state.project, state.selectedClipId);
      const match = findTimelineClipForMediaSourceTime(
        state.project.timeline,
        asset.id,
        sourceTime,
        currentSelectedClip,
      );
      if (!match) {
        showToast({
          kind: 'warning',
          title: zhCN.mediaBin.spectrum.splitFailedTitle,
          message: zhCN.mediaBin.spectrum.splitFailedMessage,
        });
        return;
      }
      try {
        setSelectedClipId(match.clip.id);
        useEditorStore.getState().setPlayheadTime(match.timelineTime);
        commandManager.execute(new SplitClipCommand(timelineAccessor, match.clip.id, match.timelineTime));
      } catch (error) {
        showToast({
          kind: 'warning',
          title: zhCN.editorToasts.splitUnavailable,
          message: error instanceof Error ? error.message : zhCN.editorToasts.splitUnavailableMessage,
        });
      }
    },
    [setSelectedClipId],
  );

  // -----------------------------------------------------------------------
  // Multicam / PiP / Split Layout
  // -----------------------------------------------------------------------

  const createMulticamSequence = useCallback(() => {
    const state = useEditorStore.getState();
    try {
      const command = new CreateMulticamSequenceCommand(
        projectAccessor,
        state.selectedClipIds,
        zhCN.timeline.multicamSequenceName(state.project.sequences.length),
      );
      commandManager.execute(command);
      if (command.multicamClipId) {
        setSelectedClipId(command.multicamClipId);
        setSelectedClipIds([command.multicamClipId]);
      }
      showToast({ kind: 'success', title: zhCN.editorToasts.multicamCreated });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.editorToasts.multicamCreateFailed,
        message: error instanceof Error ? error.message : zhCN.editorToasts.multicamCreateFailedMessage,
      });
    }
  }, [setSelectedClipId, setSelectedClipIds]);

  const applyPiPLayout = useCallback(() => {
    if (selectedPiPClips.length !== 2) {
      showToast({
        kind: 'warning',
        title: zhCN.editorToasts.pipApplyFailed,
        message: zhCN.editorToasts.pipApplyFailedMessage,
      });
      return;
    }
    const state = useEditorStore.getState();
    const [main, pip] = selectedPiPClips;
    const pipSource = getClipSourceDimensions(state.project, pip.clip);
    try {
      commandManager.execute(
        new PiPLayoutCommand(timelineAccessor, main.clip.id, pip.clip.id, {
          position: pipLayoutPosition,
          canvasWidth: state.project.settings.width,
          canvasHeight: state.project.settings.height,
          pipSourceWidth: pipSource.width,
          pipSourceHeight: pipSource.height,
        }),
      );
      setSelectedClipIds([pip.clip.id]);
      showToast({ kind: 'success', title: zhCN.editorToasts.pipApplied });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.editorToasts.pipApplyFailed,
        message: error instanceof Error ? error.message : zhCN.editorToasts.pipApplyFailedMessage,
      });
    }
  }, [pipLayoutPosition, selectedPiPClips, setSelectedClipIds]);

  const applySplitLayout = useCallback(
    (layoutId: string) => {
      if (!canApplySplitLayout) {
        showToast({
          kind: 'warning',
          title: zhCN.editorToasts.splitLayoutApplyFailed,
          message: zhCN.editorToasts.splitLayoutApplyFailedMessage,
        });
        return;
      }
      const layout = getSplitLayoutDefinition(layoutId, customSplitLayouts);
      if (!layout) {
        showToast({
          kind: 'warning',
          title: zhCN.editorToasts.splitLayoutApplyFailed,
          message: zhCN.editorToasts.splitLayoutMissingMessage,
        });
        return;
      }
      const state = useEditorStore.getState();
      const sources = Object.fromEntries(
        selectedSplitLayoutClips.map((item) => {
          const dimensions = getClipSourceDimensions(state.project, item.clip);
          return [item.clip.id, dimensions];
        }),
      );
      try {
        commandManager.execute(
          new ApplySplitLayoutCommand(
            timelineAccessor,
            selectedSplitLayoutClips.map((item) => item.clip.id),
            {
              layout,
              canvasWidth: state.project.settings.width,
              canvasHeight: state.project.settings.height,
              sources,
            },
          ),
        );
        setSelectedClipIds(selectedSplitLayoutClips.map((item) => item.clip.id));
        showToast({ kind: 'success', title: zhCN.editorToasts.splitLayoutApplied });
      } catch (error) {
        showToast({
          kind: 'warning',
          title: zhCN.editorToasts.splitLayoutApplyFailed,
          message: error instanceof Error ? error.message : zhCN.editorToasts.splitLayoutApplyFailedMessage,
        });
      }
    },
    [canApplySplitLayout, customSplitLayouts, selectedSplitLayoutClips, setSelectedClipIds],
  );

  const saveCustomSplitLayout = useCallback(
    async (ratio: number) => {
      const layout = createMainSideSplitLayout(
        createId('split-layout'),
        zhCN.toolbar.customSplitLayoutName(customSplitLayouts.length + 1),
        ratio,
      );
      const next = await saveCustomSplitLayouts([...customSplitLayouts, layout]);
      setCustomSplitLayouts(next);
      return layout.id;
    },
    [customSplitLayouts, setCustomSplitLayouts],
  );

  // -----------------------------------------------------------------------
  // EDL Import
  // -----------------------------------------------------------------------

  const importEdlTimeline = useCallback((contents: string, path: string) => {
    const fileName =
      path
        .split(/[\\/]/)
        .pop()
        ?.replace(/\.edl$/i, '') || undefined;
    const command = new ImportEDLCommand(projectAccessor, contents, { sequenceName: fileName });
    commandManager.execute(command);
    useEditorStore.getState().clearSelectedClipIds();
    useEditorStore.getState().setPlayheadTime(0);
    const result = command.result;
    return {
      title: result?.title ?? fileName ?? zhCN.timelineExport.importEdl,
      matchedCount: result?.matchedCount ?? 0,
      missingCount: result?.missingCount ?? 0,
    };
  }, []);

  const importFcpXmlTimeline = useCallback((contents: string, path: string) => {
    const fileName =
      path
        .split(/[\\/]/)
        .pop()
        ?.replace(/\.xml$/i, '') || undefined;
    const command = new ImportFCPXMLCommand(projectAccessor, contents, { sequenceName: fileName });
    commandManager.execute(command);
    useEditorStore.getState().clearSelectedClipIds();
    useEditorStore.getState().setPlayheadTime(0);
    const result = command.result;
    return {
      title: result?.title ?? fileName ?? zhCN.timelineExport.importFcpXml,
      matchedCount: result?.matchedCount ?? 0,
      missingCount: result?.missingCount ?? 0,
    };
  }, []);

  // -----------------------------------------------------------------------
  // Match Frame / Reveal / Navigate
  // -----------------------------------------------------------------------

  const matchFrameToSource = useCallback(() => {
    const state = useEditorStore.getState();
    if (!state.selectedClipId) return;
    const result = matchFrameFromClip({
      timeline: state.project.timeline,
      clipId: state.selectedClipId,
      playheadTime: state.playheadTime,
      sequences: state.project.sequences,
      activeSequenceId: state.project.activeSequenceId,
      penetrationMode: 'source',
    });
    if (result) {
      const asset = state.project.media.find((m) => m.id === result.mediaId);
      if (asset) {
        showToast({
          kind: 'info',
          title: t('matchFrame.matchFrame'),
          message: `${asset.name} @ ${result.sourceTime.toFixed(1)}s`,
        });
      }
    }
  }, []);

  const revealMediaInTimeline = useCallback(() => {
    const state = useEditorStore.getState();
    const currentSelectedClipMedia = state.selectedClipId
      ? (() => {
          const clip = selectClipById(state.project, state.selectedClipId);
          return clip && 'mediaId' in clip ? state.project.media.find((a) => a.id === clip.mediaId) : undefined;
        })()
      : undefined;
    if (!currentSelectedClipMedia) return;
    const result = coreRevealInTimeline(state.project.timeline, currentSelectedClipMedia.id, state.project.sequences);
    if (result.instances.length > 0) {
      state.setSelectedClipIds(result.instances.map((inst) => inst.clipId));
      if (result.instances[0]) {
        state.setSelectedClipId(result.instances[0].clipId);
        state.setPlayheadTime(result.instances[0].startTime);
      }
      showToast({
        kind: 'info',
        title: t('matchFrame.revealInTimeline'),
        message: `找到 ${result.instances.length} 个实例`,
      });
    } else {
      showToast({ kind: 'warning', title: t('matchFrame.revealInTimeline'), message: t('matchFrame.noSourceFound') });
    }
  }, []);

  const navigateToNextInstance = useCallback(() => {
    const state = useEditorStore.getState();
    const currentSelectedClipMedia = state.selectedClipId
      ? (() => {
          const clip = selectClipById(state.project, state.selectedClipId);
          return clip && 'mediaId' in clip ? state.project.media.find((a) => a.id === clip.mediaId) : undefined;
        })()
      : undefined;
    if (!currentSelectedClipMedia || !state.selectedClipId) return;
    const nextId = coreNavigateToNextInstance(
      state.project.timeline,
      currentSelectedClipMedia.id,
      state.selectedClipId,
      state.project.sequences,
    );
    if (nextId) {
      state.setSelectedClipId(nextId);
      const nav = getMediaInstanceNavigation(
        state.project.timeline,
        currentSelectedClipMedia.id,
        nextId,
        state.project.sequences,
      );
      showToast({ kind: 'info', title: t('matchFrame.navigateNext'), message: `${nav.currentIndex + 1}/${nav.total}` });
    }
  }, []);

  // -----------------------------------------------------------------------
  // Render In/Out / Gap Navigation
  // -----------------------------------------------------------------------

  const renderInOutRegion = useCallback(async () => {
    const state = useEditorStore.getState();
    const startSec = state.inPoint ?? 0;
    const endSec = state.outPoint ?? getTimelineDuration(state.project.timeline);
    if (endSec <= startSec) {
      showToast({ kind: 'warning', title: t('renderCache.renderInOut'), message: t('renderCache.noInOutPoint') });
      return;
    }
    try {
      const result = await renderPreviewCache({
        projectId: state.project.name,
        startSec,
        endSec,
        sourcePath: projectPath ?? '',
        width: state.project.settings.width,
        height: state.project.settings.height,
      });
      if (result.success) {
        showToast({ kind: 'success', title: t('renderCache.renderInOut'), message: t('renderCache.renderComplete') });
      } else {
        showToast({
          kind: 'warning',
          title: t('renderCache.renderInOut'),
          message: result.error ?? t('renderCache.renderFailed'),
        });
      }
    } catch {
      showToast({ kind: 'warning', title: t('renderCache.renderInOut'), message: t('renderCache.renderFailed') });
    }
  }, [projectPath]);

  const navigatePrevGap = useCallback(() => {
    const state = useEditorStore.getState();
    const gaps = computeTimelineGaps(state.project.timeline);
    const target = navigateGap(gaps, state.playheadTime, -1);
    if (target) state.setPlayheadTime(target.start);
  }, []);

  const navigateNextGap = useCallback(() => {
    const state = useEditorStore.getState();
    const gaps = computeTimelineGaps(state.project.timeline);
    const target = navigateGap(gaps, state.playheadTime, 1);
    if (target) state.setPlayheadTime(target.start);
  }, []);

  return {
    addAssetToTimeline,
    handleAddSubclipToTimeline,
    addAdjustmentLayer,
    applyEffectPresetToSelectedClip,
    addMotionGraphic,
    openColorNodeEditor,
    addTitleTemplate,
    splitSelected,
    deleteSelected,
    rippleDeleteSelected,
    selectAllTimelineItems,
    runTimelineColorAnalysis,
    alignTimelineColorToReference,
    openColorAnalysis,
    seekSpectrumTime,
    setSpectrumSelectionRange,
    splitSpectrumAtTime,
    createMulticamSequence,
    applyPiPLayout,
    applySplitLayout,
    saveCustomSplitLayout,
    importEdlTimeline,
    importFcpXmlTimeline,
    matchFrameToSource,
    revealMediaInTimeline,
    navigateToNextInstance,
    renderInOutRegion,
    navigatePrevGap,
    navigateNextGap,
  };
}
