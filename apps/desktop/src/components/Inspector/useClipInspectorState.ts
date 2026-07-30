import {useEffect, useMemo, useState} from 'react';
import {logger} from '@open-factory/editor-core/utils';
import type {Clip, MediaAsset, Project, ProjectSettings, ProjectSpeaker} from '@open-factory/editor-core';
import {AddMaskCommand, AddKeyframeCommand, UpdateProjectSpeakersCommand, UpdateTrackCommand, UpdateClipCommand, UpdateMaskCommand, RemoveMaskCommand, createId, createKenBurnsKeyframes, getClipKeyframeValue, normalizeAudioFadeCurve, normalizeAudioFadeDuration, normalizeAudioPitchSemitones, normalizeSpatialAudio, normalizeChromaKey, normalizeClipBlendMode, normalizeClipPanoramaView, normalizeClipProjection, normalizeColorCurves, normalizeColorCorrection, normalizeMasks, normalizePrivacyRedactions, normalizeStabilization, normalizeTextArc, normalizeTextLayout, normalizeTextOpenTypeFeatures, normalizeTextPath, normalizeThreeWayColor, normalizeAudioRestoration, normalizeVideoRestoration, normalizeProjectSpeakers, normalizeQualityEnhancement, parseDataSubtitleRows, secondsToTimecode, setKenBurnsEndScaleKeyframes, summarizePitchData, suggestDeinterlaceMode, buildPrivacyMasksFromDetections, buildAudioRestorationWaveformComparison, MAX_CHROMA_KEY_COLORS, DEFAULT_SPATIAL_AUDIO, SPATIAL_AUDIO_ROOM_MODELS, type AudioFadeCurve, type AudioChannelRoutingMode, type ChromaKeyMode, type ChromaKeyColor, type ClipPatch, type DataSubtitleSource, type DataSubtitleSourceType, type KeyframeProperty, type MaskPatch, type PrivacyBlurEffect, type SpatialAudioDistance, type SpatialAudioRenderMode, type SpatialAudioRoomModel, type SubtitleStyleTemplate, type TextArcOptions, type TextLayoutOptions, type TextOpenTypeFeatures} from '@open-factory/editor-core';
import {zhCN} from '../../i18n/strings';
import {commandManager, projectAccessor, timelineAccessor} from '../../store/commandManager';
import {detectPrivacyRegions, getFfmpegCapabilities, openFileDialog, readFile} from '../../lib/tauri-bridge';
import {showToast} from '../../lib/toast';
import {markLocalAiModelUsed} from '../../settings/appSettings';
import {useEditorStore, type SelectedKeyframeRef} from '../../store/editorStore';
import {usePrivacyDetectionSettingsStore} from '../../store/privacyDetectionSettingsStore';
import {useTranslationSettingsStore} from '../../store/translationSettingsStore';
import {analyzeClipPitch, exportClipPitchCsv} from '../../media/pitchAnalysis';
import {buildAudioRestorationPreviewPeaks, resolveSelectedKeyframeEntries} from './InspectorEditors';
export type {ClipInspectorStateParams, ClipInspectorStateReturn} from './clip-inspector-types';
import type {ClipInspectorStateParams, ClipInspectorStateReturn} from './clip-inspector-types';
import {useFrameInterpolationState} from './clip-inspector-frame-interpolation';
import {useAudioDenoiseState} from './clip-inspector-audio-denoise';
import {useBatchOperationsState} from './clip-inspector-batch-operations';
import {useSubtitleStylesState} from './clip-inspector-subtitle-styles';
import {useKeyframesState} from './clip-inspector-keyframes';
import {useMotionAnalysisState} from './clip-inspector-motion-analysis';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useClipInspectorState({
  clip,
  selectedClipLocked,
  selectedKeyframe,
  selectedKeyframes = [],
  media,
  playheadTime,
  projectSettings,
  selectedSubtitleClips,
}: ClipInspectorStateParams): ClipInspectorStateReturn {
  const asset = 'mediaId' in clip ? media.find((item) => item.id === clip.mediaId) : undefined;
  const clipStartTimecode = secondsToTimecode(clip.start, projectSettings.fps, projectSettings.timecodeFormat);
  const clipDurationTimecode = secondsToTimecode(clip.duration, projectSettings.fps, projectSettings.timecodeFormat);
  const assetDurationTimecode = asset
    ? secondsToTimecode(asset.duration, projectSettings.fps, projectSettings.timecodeFormat)
    : undefined;
  const project = useEditorStore((state) => state.project);
  const allTimelineSubtitleClips = useMemo(() => {
    return project.timeline.tracks
      .flatMap((track) => track.clips)
      .filter((c): c is Extract<Clip, { type: 'subtitle' }> => c.type === 'subtitle')
      .sort((a, b) => a.start - b.start);
  }, [project.timeline.tracks]);
  const setSelectedClipIds = useEditorStore((state) => state.setSelectedClipIds);
  const setSelectedKeyframes = useEditorStore((state) => state.setSelectedKeyframes);
  const chromaKeyPickClipId = useEditorStore((state) => state.chromaKeyPickClipId);
  const setChromaKeyPickClipId = useEditorStore((state) => state.setChromaKeyPickClipId);
  const translationProvider = useTranslationSettingsStore((state) => state.provider);
  const translationApiKey = useTranslationSettingsStore((state) => state.apiKey);
  const translationApiKeyError = useTranslationSettingsStore((state) => state.apiKeyError);
  const translationTargetLanguage = useTranslationSettingsStore((state) => state.targetLanguage);
  const loadTranslationApiKey = useTranslationSettingsStore((state) => state.loadApiKey);
  const privacyDetectionModelPath = usePrivacyDetectionSettingsStore((state) => state.modelPath);
  const translationSettings = useMemo(
    () => ({ provider: translationProvider, apiKey: translationApiKey, targetLanguage: translationTargetLanguage }),
    [translationApiKey, translationProvider, translationTargetLanguage],
  );

  // -- Shared state ---------------------------------------------------------
  const [privacyBlurBusy, setPrivacyBlurBusy] = useState(false);
  const [curveProperty, setCurveProperty] = useState<KeyframeProperty>('opacity');
  const [privacyBlurEffect, setPrivacyBlurEffect] = useState<PrivacyBlurEffect>('pixelize');
  const [customSoundDescOpen, setCustomSoundDescOpen] = useState(false);
  const [pitchAnalyzing, setPitchAnalyzing] = useState(false);

  const projectSpeakers = useMemo(() => normalizeProjectSpeakers(project.speakers), [project.speakers]);
  const subtitleTrack =
    clip.type === 'subtitle'
      ? project.timeline.tracks.find((track) => track.id === clip.trackId && track.type === 'subtitle')
      : undefined;
  const subtitleType =
    clip.type === 'subtitle' ? (clip.subtitleType ?? subtitleTrack?.subtitleType ?? 'subtitle') : 'subtitle';
  const activeSpeaker = clip.type === 'subtitle' ? (clip.speaker?.trim() ?? '') : '';
  const activeSpeakerEntry = activeSpeaker
    ? projectSpeakers.find((speaker) => speaker.name.toLocaleLowerCase() === activeSpeaker.toLocaleLowerCase())
    : undefined;
  const soundDescriptionOptions = useMemo(() => Object.values(zhCN.inspector.closedCaptions.soundDescriptions), []);
  const soundDescSelectValue =
    clip.type === 'subtitle'
      ? clip.soundDesc
        ? soundDescriptionOptions.includes(clip.soundDesc)
          ? clip.soundDesc
          : 'custom'
        : ''
      : '';

  useEffect(() => {
    void loadTranslationApiKey();
  }, [loadTranslationApiKey, translationProvider]);

  // -- Helpers --------------------------------------------------------------
  const commit = (patch: ClipPatch) => {
    try {
      commandManager.execute(new UpdateClipCommand(timelineAccessor, clip.id, patch));
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.propertyRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage,
      });
    }
  };
  const runEffectCommand = (command: Parameters<typeof commandManager.execute>[0]) => {
    try {
      commandManager.execute(command);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.propertyRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage,
      });
    }
  };

  // -- Sub-hooks ------------------------------------------------------------
  const frameInterpolationState = useFrameInterpolationState({clip, asset, project, playheadTime, commit});
  const audioDenoiseState = useAudioDenoiseState({clip, asset, commit});
  const batchOpsState = useBatchOperationsState({clip, project, media, commit, runEffectCommand});
  const subtitleStylesState = useSubtitleStylesState({clip, project, translationSettings, setSelectedClipIds});
  const stabilization = normalizeStabilization(clip.stabilization);
  const motionAnalysisState = useMotionAnalysisState({clip, asset, commit, stabilization});

  const selectedKeyframeFrame =
    selectedKeyframe?.clipId === clip.id
      ? clip.keyframes?.[selectedKeyframe.property]?.find((frame) => frame.id === selectedKeyframe.keyframeId)
      : undefined;
  const selectedKeyframeRefs =
    selectedKeyframes.length > 0 ? selectedKeyframes : selectedKeyframe ? [selectedKeyframe] : [];
  const selectedKeyframeEntries = useMemo(
    () => resolveSelectedKeyframeEntries(project, selectedKeyframeRefs),
    [project, selectedKeyframeRefs],
  );
  const keyframesState = useKeyframesState({
    clip,
    selectedKeyframe,
    selectedKeyframeFrame,
    selectedKeyframeEntries,
    setSelectedKeyframes,
  });

  // -- Ffmpeg capabilities (bridges frame interpolation + audio denoise) -----
  useEffect(() => {
    let disposed = false;
    void getFfmpegCapabilities()
      .then((capabilities) => {
        if (!disposed) {
          frameInterpolationState.setFrameInterpolationSupported(capabilities.available && capabilities.hasMinterpolate === true);
          audioDenoiseState.setAudioDenoiseSupported(capabilities.available && capabilities.hasArnndn === true);
        }
      })
      .catch(() => {
        if (!disposed) {
          frameInterpolationState.setFrameInterpolationSupported(false);
          audioDenoiseState.setAudioDenoiseSupported(false);
        }
      });
    return () => {
      disposed = true;
    };
  }, []);

  // -- Subtitle handlers ----------------------------------------------------
  const commitSubtitleType = (nextType: 'subtitle' | 'cc') => {
    if (clip.type !== 'subtitle') return;
    try {
      commandManager.execute(
        new UpdateClipCommand(timelineAccessor, clip.id, {
          subtitleType: nextType,
          speaker: nextType === 'cc' ? clip.speaker : undefined,
          soundDesc: nextType === 'cc' ? clip.soundDesc : undefined,
        }),
      );
      commandManager.execute(new UpdateTrackCommand(timelineAccessor, clip.trackId, { subtitleType: nextType }));
    } catch (error) {
      showToast({kind: 'warning', title: zhCN.inspector.propertyRejectedTitle, message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage});
    }
  };
  const commitCcSpeaker = (speaker: string) => {
    try {
      commandManager.execute(new UpdateClipCommand(timelineAccessor, clip.id, { subtitleType: 'cc', speaker }));
      if (subtitleTrack?.subtitleType !== 'cc') {
        commandManager.execute(new UpdateTrackCommand(timelineAccessor, clip.trackId, { subtitleType: 'cc' }));
      }
    } catch (error) {
      showToast({kind: 'warning', title: zhCN.inspector.propertyRejectedTitle, message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage});
    }
  };
  const commitCcSoundDesc = (soundDesc?: string) => {
    try {
      commandManager.execute(new UpdateClipCommand(timelineAccessor, clip.id, { subtitleType: 'cc', soundDesc }));
      if (subtitleTrack?.subtitleType !== 'cc') {
        commandManager.execute(new UpdateTrackCommand(timelineAccessor, clip.trackId, { subtitleType: 'cc' }));
      }
    } catch (error) {
      showToast({kind: 'warning', title: zhCN.inspector.propertyRejectedTitle, message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage});
    }
  };

  // -- Speaker handlers -----------------------------------------------------
  const updateProjectSpeakers = (speakers: ProjectSpeaker[]) => {
    try { commandManager.execute(new UpdateProjectSpeakersCommand(projectAccessor, speakers)); }
    catch (error) { showToast({kind: 'warning', title: zhCN.inspector.propertyRejectedTitle, message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage}); }
  };
  const addActiveSpeakerToLibrary = () => {
    if (!activeSpeaker) return;
    updateProjectSpeakers(normalizeProjectSpeakers([...projectSpeakers, { id: createId('speaker'), name: activeSpeaker }]));
  };
  const removeActiveSpeakerFromLibrary = () => {
    if (!activeSpeakerEntry) return;
    updateProjectSpeakers(projectSpeakers.filter((s) => s.id !== activeSpeakerEntry.id));
  };
  const updateActiveSpeakerColor = (color: string) => {
    if (!activeSpeakerEntry) return;
    updateProjectSpeakers(projectSpeakers.map((s) => (s.id === activeSpeakerEntry.id ? { ...s, color } : s)));
  };

  // -- LUT ------------------------------------------------------------------
  const chooseLut = async () => {
    try {
      const paths = await openFileDialog(false, [{ name: zhCN.inspector.lutFilterName, extensions: ['cube'] }]);
      if (paths[0]) commit({ colorCorrection: { lutPath: paths[0] } });
    } catch (error) {
      showToast({kind: 'warning', title: zhCN.inspector.lutUnavailableTitle, message: error instanceof Error ? error.message : zhCN.inspector.lutUnavailableMessage});
    }
  };

  // -- Text / keyframe computed values --------------------------------------
  const localKeyframeTime = Math.min(clip.duration, Math.max(0, playheadTime - clip.start));
  const textPath = clip.type === 'text' ? normalizeTextPath(clip.pathText) : undefined;
  const textLayout = clip.type === 'text' ? normalizeTextLayout(clip.textLayout) : undefined;
  const textOpenTypeFeatures = clip.type === 'text' ? normalizeTextOpenTypeFeatures(clip.openTypeFeatures) : undefined;
  const textArc = clip.type === 'text' ? normalizeTextArc(clip.arcText) : undefined;
  const updateTextPath = (patch: Partial<NonNullable<typeof textPath>>) => {
    if (clip.type !== 'text' || !textPath) return;
    commit({ pathText: normalizeTextPath({ ...textPath, ...patch }) });
  };
  const updateTextLayout = (patch: Partial<TextLayoutOptions>) => {
    if (clip.type !== 'text' || !textLayout) return;
    commit({ textLayout: normalizeTextLayout({ ...textLayout, ...patch }) });
  };
  const updateTextOpenTypeFeatures = (patch: Partial<TextOpenTypeFeatures>) => {
    if (clip.type !== 'text' || !textOpenTypeFeatures) return;
    commit({ openTypeFeatures: normalizeTextOpenTypeFeatures({ ...textOpenTypeFeatures, ...patch }) });
  };
  const updateTextArc = (patch: Partial<TextArcOptions>) => {
    if (clip.type !== 'text' || !textArc) return;
    commit({ arcText: normalizeTextArc({ ...textArc, ...patch }) });
  };
  const addKeyframe = (property: KeyframeProperty, value = getClipKeyframeValue(clip, property, localKeyframeTime)) => {
    try { commandManager.execute(new AddKeyframeCommand(timelineAccessor, clip.id, property, { time: localKeyframeTime, value })); }
    catch (error) { showToast({kind: 'warning', title: zhCN.inspector.keyframeRejectedTitle, message: error instanceof Error ? error.message : zhCN.inspector.addKeyframeFailed}); }
  };
  const setKenBurns = (enabled: boolean) => {
    if (clip.type !== 'image') return;
    if (!enabled) { commit({ kenBurns: false }); return; }
    commit({ kenBurns: true, keyframes: { ...clip.keyframes, ...createKenBurnsKeyframes(clip.duration, clip.transform.scale, Math.max(clip.transform.scale + 0.5, 1.5)) } });
  };
  const updateKenBurnsEndScale = (scale: number) => {
    if (clip.type !== 'image') return;
    commit({ keyframes: setKenBurnsEndScaleKeyframes(clip.keyframes, clip.duration, scale) });
  };
  const batchKeyframesSelected = selectedKeyframeEntries.length > 1;
  const keyframeProperties = useMemo(
    () => (Object.keys(clip.keyframes ?? {}) as KeyframeProperty[]).filter((p) => (clip.keyframes?.[p]?.length ?? 0) > 0),
    [clip.keyframes],
  );
  useEffect(() => {
    if (keyframeProperties.length > 0 && !keyframeProperties.includes(curveProperty)) setCurveProperty(keyframeProperties[0]);
  }, [curveProperty, keyframeProperties]);

  // -- Computed clip properties ---------------------------------------------
  const colorCorrection = normalizeColorCorrection(clip.colorCorrection);
  const chromaKey = normalizeChromaKey(clip.chromaKey);
  const keyingMode: ChromaKeyMode | 'none' = chromaKey.enabled ? chromaKey.mode : 'none';
  const chromaKeyPickActive = chromaKeyPickClipId === clip.id;
  const audioRestoration = normalizeAudioRestoration(clip.audioRestoration);
  const audioRestorationComparison = buildAudioRestorationWaveformComparison(buildAudioRestorationPreviewPeaks(clip.pitchData), audioRestoration);
  const blendMode = normalizeClipBlendMode(clip.blendMode);
  const projection = normalizeClipProjection(clip.projection);
  const panorama = normalizeClipPanoramaView(clip.panorama);
  const videoRestoration = normalizeVideoRestoration(clip.videoRestoration);
  const qualityEnhancement = normalizeQualityEnhancement(clip.qualityEnhancement);
  const deinterlaceSuggestion = clip.type === 'video' ? suggestDeinterlaceMode(asset?.fieldOrder) : null;
  const audioPitchSemitones = 'pitchSemitones' in clip ? normalizeAudioPitchSemitones(clip.pitchSemitones) : 0;
  const reverseAudio = 'reverseAudio' in clip ? clip.reverseAudio === true : false;
  const fadeInDuration = 'fadeInDuration' in clip ? normalizeAudioFadeDuration(clip.fadeInDuration, clip.duration) : 0;
  const fadeOutDuration = 'fadeOutDuration' in clip ? normalizeAudioFadeDuration(clip.fadeOutDuration, clip.duration) : 0;
  const fadeInCurve = 'fadeInCurve' in clip ? normalizeAudioFadeCurve(clip.fadeInCurve) : 'linear';
  const fadeOutCurve = 'fadeOutCurve' in clip ? normalizeAudioFadeCurve(clip.fadeOutCurve) : 'linear';
  const spatialAudio = 'volume' in clip ? normalizeSpatialAudio(clip.spatialAudio) : DEFAULT_SPATIAL_AUDIO;
  const pitchSummary = useMemo(() => summarizePitchData(clip.pitchData), [clip.pitchData]);
  const spatialRenderModeOptions: SpatialAudioRenderMode[] = ['panner', 'binaural'];
  const spatialDistanceOptions: SpatialAudioDistance[] = ['near', 'medium', 'far'];
  const spatialRoomOptions: SpatialAudioRoomModel[] = SPATIAL_AUDIO_ROOM_MODELS;
  const audioChannelRouting = 'volume' in clip ? (clip.audioChannelRouting ?? 'normal') : 'normal';
  const audioChannelRoutingOptions: AudioChannelRoutingMode[] =
    asset?.audioChannels === 1
      ? ['normal', 'mono-left', 'mono-right', 'mono-both']
      : ['normal', 'swap-stereo', 'stereo-left-mono', 'stereo-right-mono', 'stereo-to-mono'];
  const masks = normalizeMasks(clip.masks);
  const privacyRedactions = normalizePrivacyRedactions(clip.privacyRedactions);
  const updatePanorama = (patch: Partial<typeof panorama>) => commit({ panorama: normalizeClipPanoramaView({ ...panorama, ...patch }) });
  const updateVideoRestoration = (patch: Partial<typeof videoRestoration>) => commit({ videoRestoration: normalizeVideoRestoration({ ...videoRestoration, ...patch }) });
  const updateQualityEnhancement = (patch: Partial<typeof qualityEnhancement>) => commit({ qualityEnhancement: normalizeQualityEnhancement({ ...qualityEnhancement, ...patch }) });
  const updateAudioRestoration = (patch: Partial<typeof audioRestoration>) => commit({ audioRestoration: normalizeAudioRestoration({ ...audioRestoration, ...patch }) });
  const colorCurves = normalizeColorCurves(colorCorrection.colorCurves);
  const threeWayColor = normalizeThreeWayColor(colorCorrection.threeWayColor);

  // -- Chroma key -----------------------------------------------------------
  const commitChromaKeyColors = (colors: ChromaKeyColor[]) => {
    const nextColors = colors.slice(0, MAX_CHROMA_KEY_COLORS);
    const color = nextColors[0] ?? chromaKey.color;
    commit({ chromaKey: { ...chromaKey, color, colors: nextColors.length > 0 ? nextColors : [color] } });
  };
  const updateChromaKeyColor = (index: number, color: ChromaKeyColor) => commitChromaKeyColors(chromaKey.colors.map((item, i) => (i === index ? color : item)));
  const addChromaKeyColor = () => {
    if (chromaKey.colors.length >= MAX_CHROMA_KEY_COLORS) return;
    commitChromaKeyColors([...chromaKey.colors, [...(chromaKey.colors.at(-1) ?? chromaKey.color)] as ChromaKeyColor]);
  };
  const removeChromaKeyColor = (index: number) => {
    if (chromaKey.colors.length <= 1) return;
    commitChromaKeyColors(chromaKey.colors.filter((_, i) => i !== index));
  };
  const toggleChromaKeyPicker = () => {
    if (chromaKeyPickActive) { setChromaKeyPickClipId(undefined); return; }
    setSelectedClipIds([clip.id]);
    setChromaKeyPickClipId(clip.id);
  };

  // -- Data subtitle --------------------------------------------------------
  const bindDataSubtitleSource = async () => {
    if (clip.type !== 'subtitle') return;
    try {
      const [path] = await openFileDialog(false, [{ name: zhCN.fileDialogs.subtitleData, extensions: ['csv', 'json'] }]);
      if (!path) return;
      const sourceType: Exclude<DataSubtitleSourceType, 'template'> = path.toLowerCase().endsWith('.json') ? 'json' : 'csv';
      const rows = parseDataSubtitleRows(await readFile(path), sourceType);
      const template = clip.dataSubtitle?.template ?? (clip.text.trim() || '{row.text}');
      commit({ dataSubtitle: { sourceType, template, rows, filePath: path }, text: template });
      showToast({kind: 'success', title: zhCN.inspector.dataSubtitle.bound, message: zhCN.inspector.dataSubtitle.rowCount(rows.length)});
    } catch (error) {
      showToast({kind: 'warning', title: zhCN.inspector.dataSubtitle.failed, message: error instanceof Error ? error.message : zhCN.inspector.dataSubtitle.failedMessage});
    }
  };
  const updateDataSubtitleTemplate = (template: string) => {
    if (clip.type !== 'subtitle') return;
    const dataSubtitle: DataSubtitleSource = { sourceType: clip.dataSubtitle?.sourceType ?? 'template', template: template.trim() || '{row.text}', rows: clip.dataSubtitle?.rows ?? [], filePath: clip.dataSubtitle?.filePath };
    commit({ dataSubtitle, text: dataSubtitle.template });
  };
  const clearDataSubtitleSource = () => { if (clip.type === 'subtitle') commit({ dataSubtitle: undefined }); };

  // -- Pitch analysis -------------------------------------------------------
  const runPitchAnalysis = async () => {
    if (!asset || !('volume' in clip)) return;
    try {
      setPitchAnalyzing(true);
      const pitchData = await analyzeClipPitch(asset);
      commit({ pitchData });
      if (pitchData.length === 0) showToast({kind: 'warning', title: zhCN.inspector.pitchAnalysis.noDataTitle, message: zhCN.inspector.pitchAnalysis.noDataMessage});
      else showToast({kind: 'success', title: zhCN.inspector.pitchAnalysis.completed, message: zhCN.inspector.pitchAnalysis.pointCount(pitchData.length)});
    } catch (error) {
      showToast({kind: 'warning', title: zhCN.inspector.pitchAnalysis.failed, message: error instanceof Error ? error.message : zhCN.inspector.pitchAnalysis.failedMessage});
    } finally { setPitchAnalyzing(false); }
  };
  const exportPitchCsv = async () => {
    try {
      const exported = await exportClipPitchCsv(clip);
      if (exported) showToast({kind: 'success', title: zhCN.inspector.pitchAnalysis.exported, message: zhCN.inspector.pitchAnalysis.exportedMessage});
    } catch (error) {
      showToast({kind: 'warning', title: zhCN.inspector.pitchAnalysis.exportFailed, message: error instanceof Error ? error.message : zhCN.inspector.pitchAnalysis.failedMessage});
    }
  };

  // -- Batch keyframe convenience functions ----------------------------------
  const shiftSelectedKeyframes = () => keyframesState.runBatchKeyframeEdit({ type: 'shift', delta: batchOpsState.batchShiftSeconds });
  const scaleSelectedKeyframes = () => keyframesState.runBatchKeyframeEdit({ type: 'scale-time', factor: batchOpsState.batchScaleFactor });
  const updateSelectedKeyframeEasing = () => keyframesState.runBatchKeyframeEdit({ type: 'easing', easing: batchOpsState.batchEasing });
  const distributeSelectedKeyframes = () => keyframesState.runBatchKeyframeEdit({ type: 'distribute-time' });
  const alignSelectedKeyframeValues = () => keyframesState.runBatchKeyframeEdit({ type: 'align-value' });
  const deleteSelectedKeyframes = () => keyframesState.runBatchKeyframeEdit({ type: 'delete' }, true);

  // -- Mask handlers --------------------------------------------------------
  const addMask = () => runEffectCommand(new AddMaskCommand(timelineAccessor, clip.id));
  const updateMask = (maskId: string, patch: MaskPatch) => runEffectCommand(new UpdateMaskCommand(timelineAccessor, clip.id, maskId, patch));
  const removeMask = (maskId: string) => runEffectCommand(new RemoveMaskCommand(timelineAccessor, clip.id, maskId));

  // -- Privacy blur ---------------------------------------------------------
  const runPrivacyBlurDetection = async () => {
    if (!privacyDetectionModelPath.trim()) { showToast({kind: 'warning', title: zhCN.inspector.privacyBlur.failed, message: zhCN.inspector.privacyBlur.modelRequired}); return; }
    if (!asset?.path || !('mediaId' in clip)) { showToast({kind: 'warning', title: zhCN.inspector.privacyBlur.failed, message: zhCN.inspector.privacyBlur.noMedia}); return; }
    try {
      setPrivacyBlurBusy(true);
      await markLocalAiModelUsed('yunet', privacyDetectionModelPath.trim()).catch((error) => { logger.warn('Unable to update YuNet model last-used time', error); });
      const result = await detectPrivacyRegions({ modelPath: privacyDetectionModelPath.trim(), mediaPath: asset.path, clipId: clip.id, duration: clip.duration });
      const newMasks = buildPrivacyMasksFromDetections(result.boxes, { effect: privacyBlurEffect });
      if (newMasks.length === 0) { showToast({kind: 'info', title: zhCN.inspector.privacyBlur.title, message: zhCN.inspector.privacyBlur.noDetections}); return; }
      commit({ masks: [...masks, ...newMasks] });
      showToast({kind: 'success', title: zhCN.inspector.privacyBlur.title, message: zhCN.inspector.privacyBlur.applied(newMasks.length)});
    } catch (error) {
      showToast({kind: 'warning', title: zhCN.inspector.privacyBlur.failed, message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage});
    } finally { setPrivacyBlurBusy(false); }
  };

  // -- Return ---------------------------------------------------------------
  return {
    project, setSelectedClipIds, setSelectedKeyframes,
    chromaKeyPickClipId, setChromaKeyPickClipId,
    translationProvider, translationApiKey, translationApiKeyError, translationTargetLanguage, loadTranslationApiKey,
    privacyDetectionModelPath,
    allTimelineSubtitleClips, translationSettings, projectSpeakers, soundDescriptionOptions,
    colorMatchReferenceClips: batchOpsState.colorMatchReferenceClips,
    selectedKeyframeEntries, keyframeProperties, pitchSummary,
    analysisProgress: motionAnalysisState.analysisProgress, setAnalysisProgress: motionAnalysisState.setAnalysisProgress,
    motionTrackProgress: motionAnalysisState.motionTrackProgress, setMotionTrackProgress: motionAnalysisState.setMotionTrackProgress,
    motionTrackingBusy: motionAnalysisState.motionTrackingBusy, setMotionTrackingBusy: motionAnalysisState.setMotionTrackingBusy,
    privacyBlurBusy, setPrivacyBlurBusy,
    batchShiftSeconds: batchOpsState.batchShiftSeconds, setBatchShiftSeconds: batchOpsState.setBatchShiftSeconds,
    batchScaleFactor: batchOpsState.batchScaleFactor, setBatchScaleFactor: batchOpsState.setBatchScaleFactor,
    batchEasing: batchOpsState.batchEasing, setBatchEasing: batchOpsState.setBatchEasing,
    curveProperty, setCurveProperty, privacyBlurEffect, setPrivacyBlurEffect,
    frameInterpolationSupported: frameInterpolationState.frameInterpolationSupported, setFrameInterpolationSupported: frameInterpolationState.setFrameInterpolationSupported,
    frameInterpolationCompareRunning: frameInterpolationState.frameInterpolationCompareRunning, setFrameInterpolationCompareRunning: frameInterpolationState.setFrameInterpolationCompareRunning,
    frameInterpolationCompareItems: frameInterpolationState.frameInterpolationCompareItems, setFrameInterpolationCompareItems: frameInterpolationState.setFrameInterpolationCompareItems,
    frameInterpolationCompareError: frameInterpolationState.frameInterpolationCompareError, setFrameInterpolationCompareError: frameInterpolationState.setFrameInterpolationCompareError,
    frameInterpolationExpandedMode: frameInterpolationState.frameInterpolationExpandedMode, setFrameInterpolationExpandedMode: frameInterpolationState.setFrameInterpolationExpandedMode,
    frameInterpolationQualityRunning: frameInterpolationState.frameInterpolationQualityRunning, setFrameInterpolationQualityRunning: frameInterpolationState.setFrameInterpolationQualityRunning,
    frameInterpolationQualityError: frameInterpolationState.frameInterpolationQualityError, setFrameInterpolationQualityError: frameInterpolationState.setFrameInterpolationQualityError,
    audioDenoiseSupported: audioDenoiseState.audioDenoiseSupported, setAudioDenoiseSupported: audioDenoiseState.setAudioDenoiseSupported,
    aiLocalDenoiseProcessing: audioDenoiseState.aiLocalDenoiseProcessing, setAiLocalDenoiseProcessing: audioDenoiseState.setAiLocalDenoiseProcessing,
    aiLocalDenoiseProgress: audioDenoiseState.aiLocalDenoiseProgress, setAiLocalDenoiseProgress: audioDenoiseState.setAiLocalDenoiseProgress,
    aiLocalDenoiseStage: audioDenoiseState.aiLocalDenoiseStage, setAiLocalDenoiseStage: audioDenoiseState.setAiLocalDenoiseStage,
    aiLocalDenoiseResult: audioDenoiseState.aiLocalDenoiseResult, setAiLocalDenoiseResult: audioDenoiseState.setAiLocalDenoiseResult,
    colorMatchReferenceClipId: batchOpsState.colorMatchReferenceClipId, setColorMatchReferenceClipId: batchOpsState.setColorMatchReferenceClipId,
    colorMatchBusy: batchOpsState.colorMatchBusy, setColorMatchBusy: batchOpsState.setColorMatchBusy,
    subtitleTranslationProgress: subtitleStylesState.subtitleTranslationProgress, setSubtitleTranslationProgress: subtitleStylesState.setSubtitleTranslationProgress,
    subtitleStyleTemplates: subtitleStylesState.subtitleStyleTemplates, setSubtitleStyleTemplates: subtitleStylesState.setSubtitleStyleTemplates,
    customSoundDescOpen, setCustomSoundDescOpen, pitchAnalyzing, setPitchAnalyzing,
    textAnimationPreset: batchOpsState.textAnimationPreset, setTextAnimationPreset: batchOpsState.setTextAnimationPreset,
    textAnimationDuration: batchOpsState.textAnimationDuration, setTextAnimationDuration: batchOpsState.setTextAnimationDuration,
    textAnimationDirection: batchOpsState.textAnimationDirection, setTextAnimationDirection: batchOpsState.setTextAnimationDirection,
    asset, clipStartTimecode, clipDurationTimecode, assetDurationTimecode,
    subtitleTrack, subtitleType, activeSpeaker, activeSpeakerEntry, soundDescSelectValue, localKeyframeTime,
    textPath, textLayout, textOpenTypeFeatures, textArc,
    colorCorrection, chromaKey, keyingMode, chromaKeyPickActive, stabilization: stabilization,
    frameInterpolation: frameInterpolationState.frameInterpolation,
    frameInterpolationUnavailable: frameInterpolationState.frameInterpolationUnavailable,
    slowMotionMode: frameInterpolationState.slowMotionMode,
    frameInterpolationExpandedItem: frameInterpolationState.frameInterpolationExpandedItem,
    showSlowMotionMode: frameInterpolationState.showSlowMotionMode,
    audioDenoise: audioDenoiseState.audioDenoise,
    audioDenoiseUnavailable: audioDenoiseState.audioDenoiseUnavailable,
    audioRestoration, audioRestorationComparison, blendMode, projection, panorama,
    videoRestoration, qualityEnhancement, deinterlaceSuggestion,
    audioPitchSemitones, reverseAudio, fadeInDuration, fadeOutDuration, fadeInCurve, fadeOutCurve,
    spatialAudio, spatialRenderModeOptions, spatialDistanceOptions, spatialRoomOptions,
    audioChannelRouting, audioChannelRoutingOptions,
    masks, privacyRedactions, motionTrack: motionAnalysisState.motionTrack, colorCurves, threeWayColor,
    selectedKeyframeFrame, selectedKeyframeRefs, batchKeyframesSelected,
    textAnimationKeyframeCount: batchOpsState.textAnimationKeyframeCount,
    commit, runEffectCommand, chooseLut,
    runFrameInterpolationComparePreview: frameInterpolationState.runFrameInterpolationComparePreview,
    runFrameInterpolationQualityEvaluation: frameInterpolationState.runFrameInterpolationQualityEvaluation,
    commitSubtitleType, commitCcSpeaker, commitCcSoundDesc,
    updateProjectSpeakers, addActiveSpeakerToLibrary, removeActiveSpeakerFromLibrary, updateActiveSpeakerColor,
    updateTextPath, updateTextLayout, updateTextOpenTypeFeatures, updateTextArc,
    addKeyframe, setKenBurns, updateKenBurnsEndScale,
    updatePanorama, updateVideoRestoration, updateQualityEnhancement, updateAudioRestoration,
    commitChromaKeyColors, updateChromaKeyColor, addChromaKeyColor, removeChromaKeyColor, toggleChromaKeyPicker,
    runStabilizationAnalysis: motionAnalysisState.runStabilizationAnalysis,
    runMotionTrackAnalysis: motionAnalysisState.runMotionTrackAnalysis,
    cancelMotionTrackAnalysis: motionAnalysisState.cancelMotionTrackAnalysis,
    bindMotionTrackKeyframes: motionAnalysisState.bindMotionTrackKeyframes,
    bindDataSubtitleSource, updateDataSubtitleTemplate, clearDataSubtitleSource,
    runPitchAnalysis, exportPitchCsv,
    updateSelectedKeyframe: keyframesState.updateSelectedKeyframe,
    removeSelectedKeyframe: keyframesState.removeSelectedKeyframe,
    runBatchKeyframeEdit: keyframesState.runBatchKeyframeEdit,
    shiftSelectedKeyframes, scaleSelectedKeyframes, updateSelectedKeyframeEasing,
    distributeSelectedKeyframes, alignSelectedKeyframeValues, deleteSelectedKeyframes,
    updateSelectedKeyframeExpression: keyframesState.updateSelectedKeyframeExpression,
    updateCurveKeyframes: keyframesState.updateCurveKeyframes,
    addMask, updateMask, removeMask, runPrivacyBlurDetection,
    applyTextAnimation: batchOpsState.applyTextAnimation,
    applyColorMatch: batchOpsState.applyColorMatch,
    translateSubtitleTrack: subtitleStylesState.translateSubtitleTrack,
    applySubtitleStyleTemplate: subtitleStylesState.applySubtitleStyleTemplate,
    saveCurrentSubtitleStyleTemplate: subtitleStylesState.saveCurrentSubtitleStyleTemplate,
    deleteSubtitleStyleTemplate: subtitleStylesState.deleteSubtitleStyleTemplate,
    addSubtitleStyleTemplateToSharedLibrary: subtitleStylesState.addSubtitleStyleTemplateToSharedLibrary,
  };
}
