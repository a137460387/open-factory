import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { Clip, MediaAsset, Project, ProjectSettings } from '@open-factory/editor-core';
import {
  AddSubtitleClipCommand,
  AddTrackCommand,
  AddKeyframeCommand,
  AddEffectCommand,
  AddMaskCommand,
  BatchShiftSubtitleCommand,
  BatchKeyframeEditCommand,
  BatchSubtitleTimingCommand,
  BatchUpdateKeyframeCommand,
  ApplyTextAnimationCommand,
  CUSTOM_SHADER_EXAMPLES,
  AUDIO_SPECTRUM_POSITIONS,
  AUDIO_SPECTRUM_STYLES,
  DEFAULT_EFFECT_PARAMS,
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_TEXT_PATH,
  DEFAULT_THREE_WAY_COLOR,
  EFFECT_TYPES,
  FRAME_INTERPOLATION_TARGET_FPS,
  INPUT_COLOR_SPACES,
  KEYFRAME_PROPERTY_LIMITS,
  MAX_CHROMA_KEY_COLORS,
  MAX_CLIP_SPEED,
  MIN_CLIP_SPEED,
  TEXT_ANIMATION_DIRECTIONS,
  TEXT_ANIMATION_PRESETS,
  RemoveEffectCommand,
  RemoveMaskCommand,
  RemoveKeyframeCommand,
  ReorderEffectsCommand,
  UpdateEffectCommand,
  UpdateKeyframeCommand,
  UpdateClipCommand,
  UpdateMaskCommand,
  bindMotionTrackToPositionKeyframes,
  createDefaultColorCurves,
  createId,
  createKenBurnsKeyframes,
  CLIP_SLOW_MOTION_MODES,
  getClipSpeed,
  getTimelineDuration,
  getClipKeyframeValue,
  getEffectNumberParam,
  getEffectStringParam,
  getTransformScaleX,
  getTransformScaleY,
  normalizeAudioFadeCurve,
  normalizeAudioFadeDuration,
  normalizeAudioDenoise,
  normalizeAudioPitchSemitones,
  normalizeChromaKey,
  normalizeClipPanoramaView,
  normalizeClipProjection,
  normalizeColorCurves,
  normalizeColorCorrection,
  normalizeColorWheelValue,
  normalizeCurvePoints,
  normalizeCustomShaderParams,
  normalizeAudioSpectrumParams,
  normalizeFrameInterpolation,
  normalizeMasks,
  normalizeMotionTrack,
  normalizePrivacyBlurEffect,
  normalizeSequenceFrameRate,
  normalizeSlowMotionMode,
  normalizeStabilization,
  normalizeTextPath,
  normalizeThreeWayColor,
  normalizeVideoRestoration,
  sampleCurve,
  secondsToTimecode,
  setKenBurnsEndScaleKeyframes,
  suggestDeinterlaceMode,
  calculateSubtitleBatchAdjustUpdates,
  calculateSubtitlePeakAlignUpdate,
  calculateSubtitleScaleUpdates,
  buildPrivacyMasksFromDetections,
  createTrack,
  type AudioFadeCurve,
  type AudioChannelRoutingMode,
  type BatchKeyframeEditOperation,
  type ChromaKeyMode,
  type ChromaKeyColor,
  type ClipPatch,
  type ClipPanoramaOutputProjection,
  type ClipProjection,
  type ColorCurves,
  type ColorWheelValue,
  type CurvePoint,
  type Effect,
  type EffectType,
  type EffectPatch,
  type InputColorSpace,
  type Keyframe,
  type KeyframeEasing,
  type KeyframeProperty,
  type ClipMask,
  type ClipSlowMotionMode,
  type MaskPatch,
  type PrivacyBlurEffect,
  type TextAnimationDirection,
  type TextAnimationPreset,
  type ThreeWayColor,
  type VideoDeinterlaceMode,
  type VideoDenoisePreset
} from '@open-factory/editor-core';
import { ArrowDown, ArrowUp, GripVertical, Palette, Pipette, Plus, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { zhCN } from '../../i18n/strings';
import { commandManager, timelineAccessor } from '../../store/commandManager';
import {
  analyzeClip,
  analyzeMotionTrack,
  bridgeConfirm,
  cancelMotionTracking,
  detectPrivacyRegions,
  getFfmpegCapabilities,
  listenBridge,
  openFileDialog,
  type ClipAnalysisProgressEvent,
  type MotionTrackProgressEvent
} from '../../lib/tauri-bridge';
import { buildClipColorMatchCurves } from '../../lib/colorMatch';
import { acceptTranslationTOS, subtitleClipsToTranslationItems, translateSubtitleItems } from '../../lib/subtitleTranslation';
import { validateCustomShaderSource } from '../../lib/preview/custom-shader';
import { showToast } from '../../lib/toast';
import { useEditorStore, type SelectedKeyframeRef } from '../../store/editorStore';
import { usePrivacyDetectionSettingsStore } from '../../store/privacyDetectionSettingsStore';
import { isTranslationConfigured, useTranslationSettingsStore } from '../../store/translationSettingsStore';

interface InspectorProps {
  clip?: Clip;
  selectedClips?: Clip[];
  selectedCount: number;
  selectedClipLocked: boolean;
  selectedKeyframe?: SelectedKeyframeRef;
  selectedKeyframes?: SelectedKeyframeRef[];
  media: MediaAsset[];
  playheadTime: number;
  projectSettings: ProjectSettings;
}

export function Inspector({ clip, selectedClips = [], selectedCount, selectedClipLocked, selectedKeyframe, selectedKeyframes = [], media, playheadTime, projectSettings }: InspectorProps) {
  const selectedSubtitleClips = selectedClips.filter((item): item is Extract<Clip, { type: 'subtitle' }> => item.type === 'subtitle');
  if (!clip && selectedCount > 1) {
    if (selectedSubtitleClips.length === selectedCount) {
      return (
        <aside className="flex min-h-0 flex-col bg-white">
          <PanelTitle />
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <SubtitleRetimingPanel selectedSubtitleClips={selectedSubtitleClips} projectSettings={projectSettings} />
          </div>
        </aside>
      );
    }
    return (
      <aside className="flex min-h-0 flex-col bg-white">
        <PanelTitle />
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-slate-500" data-testid="inspector-multiple-selection-state">{zhCN.inspector.multipleSelected(selectedCount)}</div>
      </aside>
    );
  }

  if (!clip) {
    return (
      <aside className="flex min-h-0 flex-col bg-white">
        <PanelTitle />
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-slate-500" data-testid="inspector-empty-state">{zhCN.inspector.empty}</div>
      </aside>
    );
  }

  return (
    <ClipInspector
      clip={clip}
      selectedCount={selectedCount}
      selectedClipLocked={selectedClipLocked}
      selectedKeyframe={selectedKeyframe}
      selectedKeyframes={selectedKeyframes}
      media={media}
      playheadTime={playheadTime}
      projectSettings={projectSettings}
      selectedSubtitleClips={selectedSubtitleClips}
    />
  );
}

function ClipInspector({
  clip,
  selectedClipLocked,
  selectedKeyframe,
  selectedKeyframes = [],
  media,
  playheadTime,
  projectSettings,
  selectedSubtitleClips
}: InspectorProps & { clip: Clip; selectedSubtitleClips: Array<Extract<Clip, { type: 'subtitle' }>> }) {
  const asset = 'mediaId' in clip ? media.find((item) => item.id === clip.mediaId) : undefined;
  const clipStartTimecode = secondsToTimecode(clip.start, projectSettings.fps, projectSettings.timecodeFormat);
  const clipDurationTimecode = secondsToTimecode(clip.duration, projectSettings.fps, projectSettings.timecodeFormat);
  const assetDurationTimecode = asset ? secondsToTimecode(asset.duration, projectSettings.fps, projectSettings.timecodeFormat) : undefined;
  const project = useEditorStore((state) => state.project);
  const setSelectedClipIds = useEditorStore((state) => state.setSelectedClipIds);
  const setSelectedKeyframes = useEditorStore((state) => state.setSelectedKeyframes);
  const chromaKeyPickClipId = useEditorStore((state) => state.chromaKeyPickClipId);
  const setChromaKeyPickClipId = useEditorStore((state) => state.setChromaKeyPickClipId);
  const translationProvider = useTranslationSettingsStore((state) => state.provider);
  const translationApiKey = useTranslationSettingsStore((state) => state.apiKey);
  const translationTargetLanguage = useTranslationSettingsStore((state) => state.targetLanguage);
  const privacyDetectionModelPath = usePrivacyDetectionSettingsStore((state) => state.modelPath);
  const translationSettings = useMemo(
    () => ({ provider: translationProvider, apiKey: translationApiKey, targetLanguage: translationTargetLanguage }),
    [translationApiKey, translationProvider, translationTargetLanguage]
  );
  const [analysisProgress, setAnalysisProgress] = useState<number | undefined>();
  const [motionTrackProgress, setMotionTrackProgress] = useState<number | undefined>();
  const [motionTrackingBusy, setMotionTrackingBusy] = useState(false);
  const [privacyBlurBusy, setPrivacyBlurBusy] = useState(false);
  const [batchShiftSeconds, setBatchShiftSeconds] = useState(0.1);
  const [batchScaleFactor, setBatchScaleFactor] = useState(1);
  const [batchEasing, setBatchEasing] = useState<KeyframeEasing>('linear');
  const [curveProperty, setCurveProperty] = useState<KeyframeProperty>('opacity');
  const [privacyBlurEffect, setPrivacyBlurEffect] = useState<PrivacyBlurEffect>('pixelize');
  const [frameInterpolationSupported, setFrameInterpolationSupported] = useState<boolean | undefined>();
  const [audioDenoiseSupported, setAudioDenoiseSupported] = useState<boolean | undefined>();
  const [colorMatchReferenceClipId, setColorMatchReferenceClipId] = useState<string>('');
  const [colorMatchBusy, setColorMatchBusy] = useState(false);
  const [subtitleTranslationProgress, setSubtitleTranslationProgress] = useState<{ completed: number; total: number }>();
  const [textAnimationPreset, setTextAnimationPreset] = useState<TextAnimationPreset>('fade');
  const [textAnimationDuration, setTextAnimationDuration] = useState(0.5);
  const [textAnimationDirection, setTextAnimationDirection] = useState<TextAnimationDirection>('in');
  const commit = (patch: ClipPatch) => {
    try {
      commandManager.execute(new UpdateClipCommand(timelineAccessor, clip.id, patch));
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.inspector.propertyRejectedTitle, message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage });
    }
  };
  const runEffectCommand = (command: Parameters<typeof commandManager.execute>[0]) => {
    try {
      commandManager.execute(command);
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.inspector.propertyRejectedTitle, message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage });
    }
  };
  const chooseLut = async () => {
    try {
      const paths = await openFileDialog(false, [{ name: zhCN.inspector.lutFilterName, extensions: ['cube'] }]);
      const lutPath = paths[0];
      if (lutPath) {
        commit({ colorCorrection: { lutPath } });
      }
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.inspector.lutUnavailableTitle, message: error instanceof Error ? error.message : zhCN.inspector.lutUnavailableMessage });
    }
  };
  const localKeyframeTime = Math.min(clip.duration, Math.max(0, playheadTime - clip.start));
  const textPath = clip.type === 'text' ? normalizeTextPath(clip.pathText) : undefined;
  const updateTextPath = (patch: Partial<NonNullable<typeof textPath>>) => {
    if (clip.type !== 'text' || !textPath) {
      return;
    }
    commit({ pathText: normalizeTextPath({ ...textPath, ...patch }) });
  };
  const addKeyframe = (property: KeyframeProperty, value = getClipKeyframeValue(clip, property, localKeyframeTime)) => {
    try {
      commandManager.execute(new AddKeyframeCommand(timelineAccessor, clip.id, property, { time: localKeyframeTime, value }));
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.inspector.keyframeRejectedTitle, message: error instanceof Error ? error.message : zhCN.inspector.addKeyframeFailed });
    }
  };
  const setKenBurns = (enabled: boolean) => {
    if (clip.type !== 'image') {
      return;
    }
    if (!enabled) {
      commit({ kenBurns: false });
      return;
    }
    commit({
      kenBurns: true,
      keyframes: {
        ...clip.keyframes,
        ...createKenBurnsKeyframes(clip.duration, clip.transform.scale, Math.max(clip.transform.scale + 0.5, 1.5))
      }
    });
  };
  const updateKenBurnsEndScale = (scale: number) => {
    if (clip.type !== 'image') {
      return;
    }
    commit({ keyframes: setKenBurnsEndScaleKeyframes(clip.keyframes, clip.duration, scale) });
  };
  const colorMatchReferenceClips = useMemo(
    () =>
      project.timeline.tracks
        .flatMap((track) => track.clips)
        .filter((item) => item.id !== clip.id && (item.type === 'video' || item.type === 'image')),
    [clip.id, project.timeline.tracks]
  );
  const selectedKeyframeFrame =
    selectedKeyframe?.clipId === clip.id ? clip.keyframes?.[selectedKeyframe.property]?.find((frame) => frame.id === selectedKeyframe.keyframeId) : undefined;
  const selectedKeyframeRefs = selectedKeyframes.length > 0 ? selectedKeyframes : selectedKeyframe ? [selectedKeyframe] : [];
  const selectedKeyframeEntries = useMemo(() => resolveSelectedKeyframeEntries(project, selectedKeyframeRefs), [project, selectedKeyframeRefs]);
  const batchKeyframesSelected = selectedKeyframeEntries.length > 1;
  const keyframeProperties = useMemo(
    () => (Object.keys(clip.keyframes ?? {}) as KeyframeProperty[]).filter((property) => (clip.keyframes?.[property]?.length ?? 0) > 0),
    [clip.keyframes]
  );
  useEffect(() => {
    if (keyframeProperties.length > 0 && !keyframeProperties.includes(curveProperty)) {
      setCurveProperty(keyframeProperties[0]);
    }
  }, [curveProperty, keyframeProperties]);
  const colorCorrection = normalizeColorCorrection(clip.colorCorrection);
  const chromaKey = normalizeChromaKey(clip.chromaKey);
  const keyingMode: ChromaKeyMode | 'none' = chromaKey.enabled ? chromaKey.mode : 'none';
  const chromaKeyPickActive = chromaKeyPickClipId === clip.id;
  const stabilization = normalizeStabilization(clip.stabilization);
  const frameInterpolation = normalizeFrameInterpolation(clip.frameInterpolation);
  const frameInterpolationUnavailable = frameInterpolationSupported === false;
  const slowMotionMode = normalizeSlowMotionMode(clip.slowMotionMode);
  const showSlowMotionMode = clip.type === 'video' && getClipSpeed(clip) < 1;
  const audioDenoise = normalizeAudioDenoise(clip.audioDenoise);
  const audioDenoiseUnavailable = audioDenoiseSupported === false;
  const projection = normalizeClipProjection(clip.projection);
  const panorama = normalizeClipPanoramaView(clip.panorama);
  const videoRestoration = normalizeVideoRestoration(clip.videoRestoration);
  const deinterlaceSuggestion = clip.type === 'video' ? suggestDeinterlaceMode(asset?.fieldOrder) : null;
  const audioPitchSemitones = 'pitchSemitones' in clip ? normalizeAudioPitchSemitones(clip.pitchSemitones) : 0;
  const reverseAudio = 'reverseAudio' in clip ? clip.reverseAudio === true : false;
  const fadeInDuration = 'fadeInDuration' in clip ? normalizeAudioFadeDuration(clip.fadeInDuration, clip.duration) : 0;
  const fadeOutDuration = 'fadeOutDuration' in clip ? normalizeAudioFadeDuration(clip.fadeOutDuration, clip.duration) : 0;
  const fadeInCurve = 'fadeInCurve' in clip ? normalizeAudioFadeCurve(clip.fadeInCurve) : 'linear';
  const fadeOutCurve = 'fadeOutCurve' in clip ? normalizeAudioFadeCurve(clip.fadeOutCurve) : 'linear';
  const audioChannelRouting = 'volume' in clip ? clip.audioChannelRouting ?? 'normal' : 'normal';
  const audioChannelRoutingOptions: AudioChannelRoutingMode[] =
    asset?.audioChannels === 1 ? ['normal', 'mono-left', 'mono-right', 'mono-both'] : ['normal', 'swap-stereo', 'stereo-left-mono', 'stereo-right-mono', 'stereo-to-mono'];
  const masks = normalizeMasks(clip.masks);
  const updatePanorama = (patch: Partial<typeof panorama>) => {
    commit({ panorama: normalizeClipPanoramaView({ ...panorama, ...patch }) });
  };
  const updateVideoRestoration = (patch: Partial<typeof videoRestoration>) => {
    commit({ videoRestoration: normalizeVideoRestoration({ ...videoRestoration, ...patch }) });
  };
  const motionTrack = normalizeMotionTrack(clip.motionTrack, clip.duration) ?? [];
  const colorCurves = normalizeColorCurves(colorCorrection.colorCurves);
  const threeWayColor = normalizeThreeWayColor(colorCorrection.threeWayColor);
  const commitChromaKeyColors = (colors: ChromaKeyColor[]) => {
    const nextColors = colors.slice(0, MAX_CHROMA_KEY_COLORS);
    const color = nextColors[0] ?? chromaKey.color;
    commit({ chromaKey: { ...chromaKey, color, colors: nextColors.length > 0 ? nextColors : [color] } });
  };
  const updateChromaKeyColor = (index: number, color: ChromaKeyColor) => {
    const nextColors = chromaKey.colors.map((item, itemIndex) => (itemIndex === index ? color : item));
    commitChromaKeyColors(nextColors);
  };
  const addChromaKeyColor = () => {
    if (chromaKey.colors.length >= MAX_CHROMA_KEY_COLORS) {
      return;
    }
    const fallback = chromaKey.colors.at(-1) ?? chromaKey.color;
    commitChromaKeyColors([...chromaKey.colors, [...fallback] as ChromaKeyColor]);
  };
  const removeChromaKeyColor = (index: number) => {
    if (chromaKey.colors.length <= 1) {
      return;
    }
    commitChromaKeyColors(chromaKey.colors.filter((_, itemIndex) => itemIndex !== index));
  };
  const toggleChromaKeyPicker = () => {
    if (chromaKeyPickActive) {
      setChromaKeyPickClipId(undefined);
      return;
    }
    setSelectedClipIds([clip.id]);
    setChromaKeyPickClipId(clip.id);
  };
  useEffect(() => {
    let disposed = false;
    let unlistenAnalysis: (() => void) | undefined;
    let unlistenMotionTrack: (() => void) | undefined;
    void listenBridge<ClipAnalysisProgressEvent>('clip-analysis-progress', (payload) => {
      if (payload.clipId === clip.id) {
        setAnalysisProgress(payload.progress);
      }
    }).then((dispose) => {
      if (disposed) {
        dispose();
      } else {
        unlistenAnalysis = dispose;
      }
    });
    void listenBridge<MotionTrackProgressEvent>('motion-track-progress', (payload) => {
      if (payload.clipId === clip.id) {
        setMotionTrackProgress(payload.progress);
      }
    }).then((dispose) => {
      if (disposed) {
        dispose();
      } else {
        unlistenMotionTrack = dispose;
      }
    });
    return () => {
      disposed = true;
      unlistenAnalysis?.();
      unlistenMotionTrack?.();
    };
  }, [clip.id]);
  useEffect(() => {
    let disposed = false;
    void getFfmpegCapabilities()
      .then((capabilities) => {
        if (!disposed) {
          setFrameInterpolationSupported(capabilities.available && capabilities.hasMinterpolate === true);
          setAudioDenoiseSupported(capabilities.available && capabilities.hasArnndn === true);
        }
      })
      .catch(() => {
        if (!disposed) {
          setFrameInterpolationSupported(false);
          setAudioDenoiseSupported(false);
        }
      });
    return () => {
      disposed = true;
    };
  }, []);
  useEffect(() => {
    if (!colorMatchReferenceClips.some((item) => item.id === colorMatchReferenceClipId)) {
      setColorMatchReferenceClipId(colorMatchReferenceClips[0]?.id ?? '');
    }
  }, [colorMatchReferenceClipId, colorMatchReferenceClips]);
  const runStabilizationAnalysis = async () => {
    if (clip.type !== 'video' || !asset?.path) {
      return;
    }
    try {
      setAnalysisProgress(0);
      const result = await analyzeClip({ clipId: clip.id, mediaPath: asset.path, duration: clip.duration });
      commit({ stabilization: { ...stabilization, enabled: true, analyzed: true, trfPath: result.trfPath } });
      setAnalysisProgress(1);
    } catch (error) {
      setAnalysisProgress(undefined);
      showToast({ kind: 'warning', title: zhCN.inspector.propertyRejectedTitle, message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage });
    }
  };
  const runMotionTrackAnalysis = async () => {
    if (clip.type !== 'video' || !asset?.path) {
      return;
    }
    try {
      setMotionTrackingBusy(true);
      setMotionTrackProgress(0);
      const result = await analyzeMotionTrack({ clipId: clip.id, mediaPath: asset.path, duration: clip.duration });
      const points = normalizeMotionTrack(result.points, clip.duration) ?? [];
      commit({ motionTrack: points });
      setMotionTrackProgress(1);
      if (points.length === 0) {
        showToast({ kind: 'warning', title: zhCN.inspector.motionTrack.failed, message: zhCN.inspector.motionTrack.noPoints });
      }
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.inspector.motionTrack.failed, message: error instanceof Error ? error.message : zhCN.inspector.motionTrack.failedMessage });
      setMotionTrackProgress(undefined);
    } finally {
      setMotionTrackingBusy(false);
    }
  };
  const cancelMotionTrackAnalysis = async () => {
    try {
      await cancelMotionTracking(clip.id);
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.inspector.motionTrack.cancelFailed, message: error instanceof Error ? error.message : zhCN.inspector.motionTrack.failedMessage });
    } finally {
      setMotionTrackingBusy(false);
      setMotionTrackProgress(undefined);
    }
  };
  const bindMotionTrackKeyframes = () => {
    const keyframes = bindMotionTrackToPositionKeyframes(clip.keyframes, motionTrack, clip.transform, clip.duration);
    if (!keyframes) {
      return;
    }
    commit({ keyframes });
  };
  const updateSelectedKeyframe = (patch: Partial<Pick<NonNullable<typeof selectedKeyframeFrame>, 'time' | 'value' | 'easing'>>) => {
    if (!selectedKeyframe) {
      return;
    }
    try {
      commandManager.execute(new UpdateKeyframeCommand(timelineAccessor, clip.id, selectedKeyframe.property, selectedKeyframe.keyframeId, patch));
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.inspector.keyframeRejectedTitle, message: error instanceof Error ? error.message : zhCN.inspector.updateKeyframeFailed });
    }
  };
  const removeSelectedKeyframe = () => {
    if (!selectedKeyframe) {
      return;
    }
    try {
      commandManager.execute(new RemoveKeyframeCommand(timelineAccessor, clip.id, selectedKeyframe.property, selectedKeyframe.keyframeId));
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.inspector.keyframeRejectedTitle, message: error instanceof Error ? error.message : zhCN.inspector.removeKeyframeFailed });
    }
  };
  const runBatchKeyframeEdit = (operation: BatchKeyframeEditOperation, clearAfter = false) => {
    const refs = selectedKeyframeEntries.map((entry) => entry.ref);
    if (refs.length === 0) {
      return;
    }
    try {
      commandManager.execute(new BatchKeyframeEditCommand(timelineAccessor, refs, operation));
      if (clearAfter) {
        setSelectedKeyframes([]);
      }
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.inspector.keyframeRejectedTitle, message: error instanceof Error ? error.message : zhCN.inspector.updateKeyframeFailed });
    }
  };
  const shiftSelectedKeyframes = () => runBatchKeyframeEdit({ type: 'shift', delta: batchShiftSeconds });
  const scaleSelectedKeyframes = () => runBatchKeyframeEdit({ type: 'scale-time', factor: batchScaleFactor });
  const updateSelectedKeyframeEasing = () => runBatchKeyframeEdit({ type: 'easing', easing: batchEasing });
  const deleteSelectedKeyframes = () => runBatchKeyframeEdit({ type: 'delete' }, true);
  const updateCurveKeyframes = (property: KeyframeProperty, frames: Keyframe<number>[]) => {
    try {
      commandManager.execute(
        new BatchUpdateKeyframeCommand(
          timelineAccessor,
          [
            {
              clipId: clip.id,
              property,
              replace: true,
              keyframes: frames.map((frame) => ({ id: frame.id, time: frame.time, value: frame.value, easing: frame.easing }))
            }
          ],
          'Edit keyframe curve'
        )
      );
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.inspector.keyframeRejectedTitle, message: error instanceof Error ? error.message : zhCN.inspector.updateKeyframeFailed });
    }
  };
  const addMask = () => runEffectCommand(new AddMaskCommand(timelineAccessor, clip.id));
  const updateMask = (maskId: string, patch: MaskPatch) => runEffectCommand(new UpdateMaskCommand(timelineAccessor, clip.id, maskId, patch));
  const removeMask = (maskId: string) => runEffectCommand(new RemoveMaskCommand(timelineAccessor, clip.id, maskId));
  const runPrivacyBlurDetection = async () => {
    if (!privacyDetectionModelPath.trim()) {
      showToast({ kind: 'warning', title: zhCN.inspector.privacyBlur.failed, message: zhCN.inspector.privacyBlur.modelRequired });
      return;
    }
    if (!asset?.path || !('mediaId' in clip)) {
      showToast({ kind: 'warning', title: zhCN.inspector.privacyBlur.failed, message: zhCN.inspector.privacyBlur.noMedia });
      return;
    }
    try {
      setPrivacyBlurBusy(true);
      const result = await detectPrivacyRegions({
        modelPath: privacyDetectionModelPath.trim(),
        mediaPath: asset.path,
        clipId: clip.id,
        duration: clip.duration
      });
      const newMasks = buildPrivacyMasksFromDetections(result.boxes, { effect: privacyBlurEffect });
      if (newMasks.length === 0) {
        showToast({ kind: 'info', title: zhCN.inspector.privacyBlur.title, message: zhCN.inspector.privacyBlur.noDetections });
        return;
      }
      commit({ masks: [...masks, ...newMasks] });
      showToast({ kind: 'success', title: zhCN.inspector.privacyBlur.title, message: zhCN.inspector.privacyBlur.applied(newMasks.length) });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.inspector.privacyBlur.failed, message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage });
    } finally {
      setPrivacyBlurBusy(false);
    }
  };
  const applyTextAnimation = () => {
    if (clip.type !== 'text') {
      return;
    }
    runEffectCommand(
      new ApplyTextAnimationCommand(timelineAccessor, clip.id, {
        preset: textAnimationPreset,
        duration: textAnimationDuration,
        direction: textAnimationDirection
      })
    );
  };
  const textAnimationKeyframeCount = ['opacity', 'x', 'y', 'scaleX', 'scaleY'].reduce(
    (total, property) => total + (clip.keyframes?.[property as KeyframeProperty]?.length ?? 0),
    0
  );
  const applyColorMatch = async () => {
    const referenceClip = colorMatchReferenceClips.find((item) => item.id === colorMatchReferenceClipId);
    if (!referenceClip) {
      showToast({ kind: 'warning', title: zhCN.inspector.colorMatch.failed, message: zhCN.inspector.colorMatch.referenceRequired });
      return;
    }
    try {
      setColorMatchBusy(true);
      const colorCurves = await buildClipColorMatchCurves(clip, referenceClip, media);
      commit({ colorCorrection: { colorCurves } });
      showToast({ kind: 'success', title: zhCN.inspector.colorMatch.applied });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.inspector.colorMatch.failed, message: error instanceof Error ? error.message : zhCN.inspector.colorMatch.failedMessage });
    } finally {
      setColorMatchBusy(false);
    }
  };
  const translateSubtitleTrack = async () => {
    if (clip.type !== 'subtitle' || !isTranslationConfigured(translationSettings)) {
      return;
    }
    const sourceTrack = project.timeline.tracks.find((track) => track.id === clip.trackId);
    if (!sourceTrack || sourceTrack.type !== 'subtitle') {
      return;
    }
    const sourceClips = sourceTrack.clips.filter((item): item is Extract<Clip, { type: 'subtitle' }> => item.type === 'subtitle');
    try {
      setSubtitleTranslationProgress({ completed: 0, total: sourceClips.length });
      const requestTranslation = () =>
        translateSubtitleItems(subtitleClipsToTranslationItems(sourceClips), translationSettings, fetch, (completed, total) => {
          setSubtitleTranslationProgress({ completed, total });
        });
      let translated: Awaited<ReturnType<typeof translateSubtitleItems>>;
      try {
        translated = await requestTranslation();
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'TRANSLATION_TOS_NOT_ACCEPTED') {
          throw error;
        }
        const accepted = await bridgeConfirm(zhCN.inspector.translation.tosMessage, {
          title: zhCN.inspector.translation.tosTitle,
          kind: 'warning'
        });
        if (!accepted) {
          return;
        }
        acceptTranslationTOS();
        translated = await requestTranslation();
      }
      const translatedById = new Map(translated.map((item) => [item.id, item.translatedText]));
      const track = createTrack({
        id: createId('track'),
        type: 'subtitle',
        name: zhCN.inspector.translation.trackName(sourceTrack.name, translationSettings.targetLanguage),
        clips: []
      });
      commandManager.execute(new AddTrackCommand(timelineAccessor, track));
      const addedClipIds: string[] = [];
      for (const sourceClip of sourceClips) {
        const translatedText = translatedById.get(sourceClip.id) ?? sourceClip.text;
        const translatedClip: Extract<Clip, { type: 'subtitle' }> = {
          ...sourceClip,
          id: createId('subtitle'),
          trackId: track.id,
          name: zhCN.inspector.translation.clipName(sourceClip.name, translationSettings.targetLanguage),
          text: translatedText,
          style: { ...sourceClip.style },
          transform: { ...sourceClip.transform },
          colorCorrection: { ...sourceClip.colorCorrection }
        };
        commandManager.execute(new AddSubtitleClipCommand(timelineAccessor, translatedClip));
        addedClipIds.push(translatedClip.id);
      }
      if (addedClipIds[0]) {
        setSelectedClipIds([addedClipIds[0]]);
      }
      showToast({ kind: 'success', title: zhCN.inspector.translation.completeTitle, message: zhCN.inspector.translation.completeMessage(addedClipIds.length) });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.inspector.translation.failedTitle, message: error instanceof Error ? error.message : zhCN.inspector.translation.failedMessage });
    } finally {
      setSubtitleTranslationProgress(undefined);
    }
  };

  return (
    <aside className="flex min-h-0 flex-col bg-white">
      <PanelTitle />
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <Section title={zhCN.inspector.sections.clip}>
          {selectedClipLocked ? <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-800">{zhCN.inspector.locked}</div> : null}
          <TextField label={zhCN.inspector.fields.name} value={clip.name} onCommit={(name) => commit({ name })} />
          <NumberField label={zhCN.inspector.fields.start} value={clip.start} min={0} step={0.033} onCommit={(start) => commit({ start })} />
          <NumberField label={zhCN.inspector.fields.duration} value={clip.duration} min={0.033} step={0.033} onCommit={(duration) => commit({ duration })} />
          {asset ? (
            <div className="rounded-md bg-panel p-2 text-xs text-slate-600">
              <div className="truncate font-medium text-slate-700">{asset.name}</div>
              <div>{asset.missing ? zhCN.inspector.missingFile : `${asset.width || '-'} x ${asset.height || '-'} | ${assetDurationTimecode}`}</div>
            </div>
          ) : null}
        </Section>

        {clip.type === 'video' || clip.type === 'audio' ? (
          <Section title={zhCN.inspector.sections.speed}>
            <div className="rounded-md bg-panel p-2 text-xs text-slate-600">
              {zhCN.inspector.timecodeSummary(clipStartTimecode, clipDurationTimecode)} / {zhCN.inspector.speedSummary(getClipSpeed(clip).toFixed(2))}
            </div>
            <AnimatedField label={zhCN.inspector.fields.speed} onAddKeyframe={() => addKeyframe('speed')} testId="add-speed-keyframe-button">
              <RangeNumberField
                label={zhCN.inspector.fields.speed}
                value={getClipSpeed(clip)}
                min={MIN_CLIP_SPEED}
                max={MAX_CLIP_SPEED}
                step={0.05}
                format={(value) => `${value.toFixed(2)}x`}
                onCommit={(speed) => commit({ speed })}
                testId="clip-speed-input"
              />
            </AnimatedField>
            {showSlowMotionMode ? (
              <label className="block text-xs font-medium text-slate-600">
                {zhCN.inspector.fields.slowMotionMode}
                <select
                  className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                  value={slowMotionMode}
                  data-testid="clip-slow-motion-mode-select"
                  onChange={(event) => commit({ slowMotionMode: event.target.value as ClipSlowMotionMode })}
                >
                  {CLIP_SLOW_MOTION_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {zhCN.inspector.slowMotionModes[mode]}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <SpeedCurveEditor clip={clip} onCommit={(speedFrames) => commit({ keyframes: { ...clip.keyframes, speed: speedFrames } })} />
          </Section>
        ) : null}

        {clip.type === 'video' || clip.type === 'audio' ? (
          <Section title={zhCN.inspector.sections.audioDenoise}>
            <ToggleField
              label={zhCN.inspector.fields.enabled}
              checked={audioDenoise.enabled}
              disabled={audioDenoiseUnavailable}
              onCommit={(enabled) => commit({ audioDenoise: { ...audioDenoise, enabled } })}
              testId="audio-denoise-toggle"
            />
            <RangeNumberField
              label={zhCN.inspector.fields.strength}
              value={audioDenoise.strength}
              min={0}
              max={1}
              step={0.05}
              format={(value) => `${Math.round(value * 100)}%`}
              disabled={audioDenoiseUnavailable || !audioDenoise.enabled}
              onCommit={(strength) => commit({ audioDenoise: { ...audioDenoise, strength } })}
              testId="audio-denoise-strength"
            />
            {audioDenoiseUnavailable ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-800" data-testid="audio-denoise-unavailable">
                {zhCN.inspector.fields.audioDenoiseUnsupported}
              </div>
            ) : null}
          </Section>
        ) : null}

        <Section title={zhCN.inspector.sections.transform}>
          <AnimatedField label="X" onAddKeyframe={() => addKeyframe('x')}>
            <NumberField label="X" value={clip.transform.x} step={1} onCommit={(x) => commit({ transform: { x } })} hideLabel testId="clip-transform-x-input" />
          </AnimatedField>
          <AnimatedField label="Y" onAddKeyframe={() => addKeyframe('y')}>
            <NumberField label="Y" value={clip.transform.y} step={1} onCommit={(y) => commit({ transform: { y } })} hideLabel testId="clip-transform-y-input" />
          </AnimatedField>
          <AnimatedField label={zhCN.inspector.fields.scale} onAddKeyframe={() => {
            addKeyframe('scaleX', getTransformScaleX(clip.transform));
            addKeyframe('scaleY', getTransformScaleY(clip.transform));
          }} testId="add-scale-keyframe-button">
            <RangeField
              label={zhCN.inspector.fields.scale}
              value={clip.transform.scale}
              min={0.1}
              max={4}
              step={0.05}
              format={(value) => `${Math.round(value * 100)}%`}
              onCommit={(scale) => commit({ transform: { scale } })}
              hideLabel
              testId="clip-scale-slider"
            />
          </AnimatedField>
          <div className="grid grid-cols-2 gap-2">
            <RangeNumberField
              label={zhCN.inspector.fields.scaleX}
              value={getTransformScaleX(clip.transform)}
              min={0.01}
              max={4}
              step={0.01}
              format={(value) => `${Math.round(value * 100)}%`}
              onCommit={(scaleX) => commit({ transform: { scaleX } })}
              testId="clip-scale-x-input"
            />
            <RangeNumberField
              label={zhCN.inspector.fields.scaleY}
              value={getTransformScaleY(clip.transform)}
              min={0.01}
              max={4}
              step={0.01}
              format={(value) => `${Math.round(value * 100)}%`}
              onCommit={(scaleY) => commit({ transform: { scaleY } })}
              testId="clip-scale-y-input"
            />
          </div>
          <NumberField
            label={zhCN.inspector.fields.rotation}
            value={clip.transform.rotation}
            min={-180}
            max={180}
            step={1}
            onCommit={(rotation) => commit({ transform: { rotation } })}
            testId="clip-rotation-input"
          />
          {clip.type !== 'audio' ? (
            <AnimatedField label={zhCN.inspector.fields.opacity} onAddKeyframe={() => addKeyframe('opacity')} testId="add-opacity-keyframe-button">
              <RangeField
                label={zhCN.inspector.fields.opacity}
                value={clip.transform.opacity}
                min={0}
                max={1}
                step={0.01}
                format={(value) => `${Math.round(value * 100)}%`}
                onCommit={(opacity) => commit({ transform: { opacity } })}
                hideLabel
                testId="clip-opacity-slider"
              />
            </AnimatedField>
          ) : null}
        </Section>

        {clip.type === 'video' ? (
          <details className="mb-4" open>
            <summary className="mb-2 cursor-pointer text-xs font-semibold uppercase tracking-normal text-slate-500">{zhCN.inspector.sections.projection}</summary>
            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-600">
                {zhCN.inspector.fields.projection}
                <select
                  className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                  value={projection}
                  data-testid="clip-projection-select"
                  onChange={(event) => commit({ projection: event.target.value as ClipProjection, panorama })}
                >
                  <option value="flat">{zhCN.inspector.projection.flat}</option>
                  <option value="equirectangular">{zhCN.inspector.projection.equirectangular}</option>
                  <option value="cubemap">{zhCN.inspector.projection.cubemap}</option>
                </select>
              </label>
              {projection !== 'flat' ? (
                <>
                  <label className="block text-xs font-medium text-slate-600">
                    {zhCN.inspector.fields.panoramaOutput}
                    <select
                      className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                      value={panorama.outputProjection}
                      data-testid="clip-panorama-output-select"
                      onChange={(event) => updatePanorama({ outputProjection: event.target.value as ClipPanoramaOutputProjection })}
                    >
                      <option value="flat">{zhCN.inspector.panoramaOutput.flat}</option>
                      <option value="equirectangular">{zhCN.inspector.panoramaOutput.equirectangular}</option>
                    </select>
                  </label>
                  <AnimatedField label={zhCN.inspector.fields.yaw} onAddKeyframe={() => addKeyframe('yaw', panorama.yaw)} testId="add-yaw-keyframe-button">
                    <RangeNumberField
                      label={zhCN.inspector.fields.yaw}
                      value={panorama.yaw}
                      min={-180}
                      max={180}
                      step={1}
                      format={(value) => `${Math.round(value)}°`}
                      onCommit={(yaw) => updatePanorama({ yaw })}
                      testId="clip-panorama-yaw-input"
                    />
                  </AnimatedField>
                  <AnimatedField label={zhCN.inspector.fields.pitch} onAddKeyframe={() => addKeyframe('pitch', panorama.pitch)} testId="add-pitch-keyframe-button">
                    <RangeNumberField
                      label={zhCN.inspector.fields.pitch}
                      value={panorama.pitch}
                      min={-90}
                      max={90}
                      step={1}
                      format={(value) => `${Math.round(value)}°`}
                      onCommit={(pitch) => updatePanorama({ pitch })}
                      testId="clip-panorama-pitch-input"
                    />
                  </AnimatedField>
                  <AnimatedField label={zhCN.inspector.fields.roll} onAddKeyframe={() => addKeyframe('roll', panorama.roll)} testId="add-roll-keyframe-button">
                    <RangeNumberField
                      label={zhCN.inspector.fields.roll}
                      value={panorama.roll}
                      min={-180}
                      max={180}
                      step={1}
                      format={(value) => `${Math.round(value)}°`}
                      onCommit={(roll) => updatePanorama({ roll })}
                      testId="clip-panorama-roll-input"
                    />
                  </AnimatedField>
                  <RangeNumberField
                    label={zhCN.inspector.fields.fov}
                    value={panorama.fov}
                    min={60}
                    max={120}
                    step={1}
                    format={(value) => `${Math.round(value)}°`}
                    onCommit={(fov) => updatePanorama({ fov })}
                    testId="clip-panorama-fov-input"
                  />
                </>
              ) : null}
            </div>
          </details>
        ) : null}

        {clip.type === 'video' || clip.type === 'image' || clip.type === 'nested-sequence' ? (
          <Section title={zhCN.inspector.sections.chromaKey}>
            <label className="block text-xs font-medium text-slate-600">
              {zhCN.inspector.fields.keyingMode}
              <select
                className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                value={keyingMode}
                data-testid="keying-mode-select"
                onChange={(event) => {
                  const mode = event.target.value as ChromaKeyMode | 'none';
                  commit({ chromaKey: { ...chromaKey, enabled: mode !== 'none', mode: mode === 'none' ? chromaKey.mode : mode } });
                }}
              >
                <option value="none">{zhCN.inspector.keyingModes.none}</option>
                <option value="chroma-key">{zhCN.inspector.keyingModes['chroma-key']}</option>
                <option value="luma-key">{zhCN.inspector.keyingModes['luma-key']}</option>
                <option value="difference-matte">{zhCN.inspector.keyingModes['difference-matte']}</option>
              </select>
            </label>
            {keyingMode === 'chroma-key' ? (
              <>
            <div className="space-y-2" data-testid="chroma-key-color-list">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-600">{zhCN.inspector.fields.chromaKeyColor}</span>
                <div className="flex items-center gap-1">
                  <button
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-white text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    title={zhCN.inspector.chromaKey.addSampleColor}
                    aria-label={zhCN.inspector.chromaKey.addSampleColor}
                    disabled={chromaKey.colors.length >= MAX_CHROMA_KEY_COLORS}
                    onClick={addChromaKeyColor}
                    data-testid="chroma-key-add-color"
                  >
                    <Plus size={15} />
                  </button>
                  <button
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-slate-700 hover:bg-panel ${
                      chromaKeyPickActive ? 'bg-emerald-50 ring-1 ring-emerald-300' : 'bg-white'
                    }`}
                    type="button"
                    title={zhCN.inspector.chromaKey.pickFromPreview}
                    aria-label={zhCN.inspector.chromaKey.pickFromPreview}
                    onClick={toggleChromaKeyPicker}
                    data-testid="chroma-key-pick-preview"
                    data-active={chromaKeyPickActive ? 'true' : 'false'}
                  >
                    <Pipette size={15} />
                  </button>
                </div>
              </div>
              {chromaKey.colors.map((color, index) => (
                <div key={`chroma-key-color-${index}`} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <ColorField
                      label={zhCN.inspector.chromaKey.sampleColor(index + 1)}
                      value={rgbToHex(color)}
                      onCommit={(value) => updateChromaKeyColor(index, hexToRgb(value))}
                      testId={index === 0 ? 'chroma-key-color' : `chroma-key-color-${index}`}
                    />
                  </div>
                  <button
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-white text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    title={zhCN.inspector.chromaKey.removeSampleColor}
                    aria-label={zhCN.inspector.chromaKey.removeSampleColor}
                    disabled={chromaKey.colors.length <= 1}
                    onClick={() => removeChromaKeyColor(index)}
                    data-testid={`chroma-key-remove-color-${index}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <RangeNumberField
              label={zhCN.inspector.fields.similarity}
              value={chromaKey.similarity}
              min={0}
              max={1}
              step={0.01}
              format={(value) => value.toFixed(2)}
              onCommit={(similarity) => commit({ chromaKey: { ...chromaKey, similarity } })}
              testId="chroma-key-similarity"
            />
            <RangeNumberField
              label={zhCN.inspector.fields.blend}
              value={chromaKey.blend}
              min={0}
              max={1}
              step={0.01}
              format={(value) => value.toFixed(2)}
              onCommit={(blend) => commit({ chromaKey: { ...chromaKey, blend } })}
              testId="chroma-key-blend"
            />
            <RangeNumberField
              label={zhCN.inspector.fields.erosion}
              value={chromaKey.erosion}
              min={-5}
              max={5}
              step={1}
              format={(value) => `${value}px`}
              onCommit={(erosion) => commit({ chromaKey: { ...chromaKey, erosion } })}
              testId="chroma-key-erosion"
            />
            <ToggleField
              label={zhCN.inspector.fields.spillSuppression}
              checked={chromaKey.spillSuppression}
              onCommit={(spillSuppression) => commit({ chromaKey: { ...chromaKey, spillSuppression } })}
              testId="chroma-key-spill-suppression"
            />
              </>
            ) : null}
            {keyingMode === 'luma-key' ? (
              <div className="space-y-2" data-testid="luma-key-controls">
                <RangeNumberField
                  label={zhCN.inspector.fields.lumaThreshold}
                  value={chromaKey.lumaThreshold}
                  min={0}
                  max={1}
                  step={0.01}
                  format={(value) => value.toFixed(2)}
                  onCommit={(lumaThreshold) => commit({ chromaKey: { ...chromaKey, enabled: true, mode: 'luma-key', lumaThreshold } })}
                  testId="luma-key-threshold"
                />
                <RangeNumberField
                  label={zhCN.inspector.fields.lumaTolerance}
                  value={chromaKey.lumaTolerance}
                  min={0}
                  max={1}
                  step={0.01}
                  format={(value) => value.toFixed(2)}
                  onCommit={(lumaTolerance) => commit({ chromaKey: { ...chromaKey, enabled: true, mode: 'luma-key', lumaTolerance } })}
                  testId="luma-key-tolerance"
                />
                <RangeNumberField
                  label={zhCN.inspector.fields.lumaSoftness}
                  value={chromaKey.lumaSoftness}
                  min={0}
                  max={1}
                  step={0.01}
                  format={(value) => value.toFixed(2)}
                  onCommit={(lumaSoftness) => commit({ chromaKey: { ...chromaKey, enabled: true, mode: 'luma-key', lumaSoftness } })}
                  testId="luma-key-softness"
                />
              </div>
            ) : null}
            {keyingMode === 'difference-matte' ? (
              <div className="space-y-2" data-testid="difference-matte-controls">
                <NumberField
                  label={zhCN.inspector.fields.referenceTime}
                  value={chromaKey.differenceReferenceTime}
                  min={0}
                  max={clip.duration}
                  step={1 / Math.max(1, projectSettings.fps)}
                  onCommit={(differenceReferenceTime) => commit({ chromaKey: { ...chromaKey, enabled: true, mode: 'difference-matte', differenceReferenceTime } })}
                  testId="difference-matte-reference-time"
                />
                <RangeNumberField
                  label={zhCN.inspector.fields.differenceThreshold}
                  value={chromaKey.differenceThreshold}
                  min={0}
                  max={1}
                  step={0.01}
                  format={(value) => value.toFixed(2)}
                  onCommit={(differenceThreshold) => commit({ chromaKey: { ...chromaKey, enabled: true, mode: 'difference-matte', differenceThreshold } })}
                  testId="difference-matte-threshold"
                />
              </div>
            ) : null}
          </Section>
        ) : null}

        {clip.type === 'video' || clip.type === 'image' || clip.type === 'nested-sequence' ? (
          <Section title={zhCN.inspector.sections.masks}>
            <PrivacyBlurPanel
              effect={privacyBlurEffect}
              modelConfigured={Boolean(privacyDetectionModelPath.trim())}
              busy={privacyBlurBusy}
              disabled={clip.type === 'nested-sequence'}
              onEffectChange={setPrivacyBlurEffect}
              onRun={() => void runPrivacyBlurDetection()}
            />
            <MasksEditor masks={masks} onAdd={addMask} onUpdate={updateMask} onRemove={removeMask} />
          </Section>
        ) : null}

        {clip.type === 'video' ? (
          <Section title={zhCN.inspector.sections.frameInterpolation}>
            <ToggleField
              label={zhCN.inspector.fields.enabled}
              checked={frameInterpolation.enabled}
              disabled={frameInterpolationUnavailable}
              onCommit={(enabled) => commit({ frameInterpolation: { ...frameInterpolation, enabled } })}
              testId="frame-interpolation-toggle"
            />
            <label className="block text-xs font-medium text-slate-600">
              <span>{zhCN.inspector.fields.targetFrameRate}</span>
              <select
                className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-60"
                value={frameInterpolation.targetFps}
                disabled={frameInterpolationUnavailable || !frameInterpolation.enabled}
                onChange={(event) => commit({ frameInterpolation: { ...frameInterpolation, targetFps: Number(event.target.value) as typeof frameInterpolation.targetFps } })}
                data-testid="frame-interpolation-fps-select"
              >
                {FRAME_INTERPOLATION_TARGET_FPS.map((fps) => (
                  <option key={fps} value={fps}>{fps} fps</option>
                ))}
              </select>
            </label>
            {frameInterpolationUnavailable ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-800" data-testid="frame-interpolation-unavailable">
                {zhCN.inspector.fields.frameInterpolationUnsupported}
              </div>
            ) : null}
          </Section>
        ) : null}

        {clip.type === 'video' ? (
          <Section title={zhCN.inspector.sections.stabilization}>
            <ToggleField
              label={zhCN.inspector.fields.enabled}
              checked={stabilization.enabled}
              onCommit={(enabled) => commit({ stabilization: { ...stabilization, enabled } })}
              testId="stabilization-toggle"
            />
            <div className="rounded-md border border-line bg-panel p-2 text-xs text-slate-600" data-testid="stabilization-status">
              {analysisProgress !== undefined && analysisProgress < 1
                ? zhCN.inspector.fields.stabilizationProgress(analysisProgress)
                : stabilization.analyzed
                  ? zhCN.inspector.fields.stabilizationAnalyzed
                  : zhCN.inspector.fields.stabilizationNotAnalyzed}
            </div>
            <button
              className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium hover:bg-panel"
              type="button"
              data-testid="analyze-stabilization-button"
              onClick={() => void runStabilizationAnalysis()}
            >
              {zhCN.inspector.fields.analyzeStabilization}
            </button>
            <RangeNumberField
              label={zhCN.inspector.fields.smoothing}
              value={stabilization.smoothing}
              min={1}
              max={100}
              step={1}
              format={(value) => value.toFixed(0)}
              onCommit={(smoothing) => commit({ stabilization: { ...stabilization, smoothing } })}
              testId="stabilization-smoothing"
            />
            <RangeNumberField
              label={zhCN.inspector.fields.zoom}
              value={stabilization.zoom}
              min={0}
              max={5}
              step={0.1}
              format={(value) => value.toFixed(1)}
              onCommit={(zoom) => commit({ stabilization: { ...stabilization, zoom } })}
              testId="stabilization-zoom"
            />
          </Section>
        ) : null}

        {clip.type === 'video' ? (
          <Section title={zhCN.inspector.sections.motionTrack}>
            <div className="rounded-md border border-line bg-panel p-2 text-xs text-slate-600" data-testid="motion-track-status">
              {motionTrackProgress !== undefined && motionTrackProgress < 1
                ? zhCN.inspector.motionTrack.progress(motionTrackProgress)
                : motionTrack.length > 0
                  ? zhCN.inspector.motionTrack.pointCount(motionTrack.length)
                  : zhCN.inspector.motionTrack.notAnalyzed}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                className="rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={motionTrackingBusy}
                data-testid="analyze-motion-track-button"
                onClick={() => void runMotionTrackAnalysis()}
              >
                {zhCN.inspector.motionTrack.analyze}
              </button>
              <button
                className="rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={!motionTrackingBusy}
                data-testid="cancel-motion-track-button"
                onClick={() => void cancelMotionTrackAnalysis()}
              >
                {zhCN.inspector.motionTrack.cancel}
              </button>
            </div>
            <button
              className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={motionTrack.length === 0}
              data-testid="bind-motion-track-button"
              onClick={bindMotionTrackKeyframes}
            >
              {zhCN.inspector.motionTrack.bind}
            </button>
          </Section>
        ) : null}

        {clip.type === 'video' || clip.type === 'image' ? (
          <Section title={zhCN.inspector.sections.colorMatch}>
            <label className="block text-xs font-medium text-slate-600">
              <span>{zhCN.inspector.fields.referenceClip}</span>
              <select
                className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-60"
                value={colorMatchReferenceClipId}
                disabled={colorMatchReferenceClips.length === 0 || colorMatchBusy}
                onChange={(event) => setColorMatchReferenceClipId(event.target.value)}
                data-testid="color-match-reference-select"
              >
                {colorMatchReferenceClips.length === 0 ? <option value="">{zhCN.inspector.colorMatch.noReference}</option> : null}
                {colorMatchReferenceClips.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <button
              className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              disabled={!colorMatchReferenceClipId || colorMatchBusy}
              onClick={() => void applyColorMatch()}
              data-testid="apply-color-match-button"
            >
              {colorMatchBusy ? zhCN.inspector.colorMatch.applying : zhCN.inspector.colorMatch.apply}
            </button>
          </Section>
        ) : null}

        {clip.type === 'image' && asset?.imageSequence ? (
          <Section title={zhCN.inspector.sections.imageSequence}>
            <div className="rounded-md bg-panel p-2 text-xs text-slate-600">
              {asset.imageSequence.frameCount} PNG · {asset.imageSequence.pattern}
            </div>
            <RangeNumberField
              label={zhCN.inspector.fields.sequenceFrameRate}
              value={normalizeSequenceFrameRate(clip.sequenceFrameRate ?? asset.imageSequence.frameRate) ?? asset.imageSequence.frameRate}
              min={1}
              max={120}
              step={1}
              format={(value) => `${value.toFixed(0)} fps`}
              onCommit={(frameRate) => commit({ sequenceFrameRate: frameRate, duration: asset.imageSequence!.frameCount / frameRate })}
              testId="image-sequence-framerate"
            />
          </Section>
        ) : null}

        {batchKeyframesSelected ? (
          <Section title={zhCN.inspector.sections.keyframe}>
            <div className="rounded-md border border-line bg-panel p-2 text-xs text-slate-600" data-testid="batch-keyframe-editor">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-700">{zhCN.inspector.batchKeyframes.title}</span>
                <span className="tabular-nums" data-testid="batch-keyframe-count">{zhCN.inspector.batchKeyframes.count(selectedKeyframeEntries.length)}</span>
              </div>
              <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                <NumberField
                  label={zhCN.inspector.batchKeyframes.shiftSeconds}
                  value={batchShiftSeconds}
                  min={-60}
                  max={60}
                  step={0.01}
                  onCommit={setBatchShiftSeconds}
                  testId="batch-keyframe-shift-input"
                />
                <button
                  className="mb-0.5 rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium hover:bg-panel"
                  type="button"
                  data-testid="batch-keyframe-shift-button"
                  onClick={shiftSelectedKeyframes}
                >
                  {zhCN.inspector.batchKeyframes.applyShift}
                </button>
              </div>
              <div className="mt-2 grid grid-cols-[1fr_auto] items-end gap-2">
                <NumberField
                  label={zhCN.inspector.batchKeyframes.scaleFactor}
                  value={batchScaleFactor}
                  min={0.01}
                  max={10}
                  step={0.01}
                  onCommit={setBatchScaleFactor}
                  testId="batch-keyframe-scale-input"
                />
                <button
                  className="mb-0.5 rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium hover:bg-panel"
                  type="button"
                  data-testid="batch-keyframe-scale-button"
                  onClick={scaleSelectedKeyframes}
                >
                  {zhCN.inspector.batchKeyframes.applyScale}
                </button>
              </div>
              <label className="mt-2 block text-xs font-medium text-slate-600">
                {zhCN.inspector.fields.easing}
                <select
                  className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                  value={batchEasing}
                  data-testid="batch-keyframe-easing-select"
                  onChange={(event) => setBatchEasing(event.target.value as KeyframeEasing)}
                >
                  <option value="linear">{zhCN.inspector.easing.linear}</option>
                  <option value="ease-in">{zhCN.inspector.easing.easeIn}</option>
                  <option value="ease-out">{zhCN.inspector.easing.easeOut}</option>
                  <option value="ease-in-out">{zhCN.inspector.easing.easeInOut}</option>
                </select>
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  className="rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium hover:bg-panel"
                  type="button"
                  data-testid="batch-keyframe-easing-button"
                  onClick={updateSelectedKeyframeEasing}
                >
                  {zhCN.inspector.batchKeyframes.applyEasing}
                </button>
                <button
                  className="rounded-md border border-rose-300 px-2 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50"
                  type="button"
                  data-testid="batch-keyframe-delete-button"
                  onClick={deleteSelectedKeyframes}
                >
                  {zhCN.inspector.batchKeyframes.delete}
                </button>
              </div>
            </div>
          </Section>
        ) : null}

        {selectedKeyframe && selectedKeyframeFrame ? (
          <Section title={zhCN.inspector.sections.keyframe}>
            <div className="rounded-md border border-line bg-panel p-2 text-xs text-slate-600" data-testid="selected-keyframe-editor">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-700">{formatKeyframeProperty(selectedKeyframe.property)}</span>
                <span className="tabular-nums">{selectedKeyframeFrame.time.toFixed(2)}s</span>
              </div>
              <RangeNumberField
                label={zhCN.inspector.fields.time}
                value={selectedKeyframeFrame.time}
                min={0}
                max={clip.duration}
                step={0.01}
                format={(value) => `${value.toFixed(2)}s`}
                onCommit={(time) => updateSelectedKeyframe({ time })}
              />
              <RangeNumberField
                label={zhCN.inspector.fields.value}
                value={selectedKeyframeFrame.value}
                min={KEYFRAME_PROPERTY_LIMITS[selectedKeyframe.property].min}
                max={KEYFRAME_PROPERTY_LIMITS[selectedKeyframe.property].max}
                step={0.01}
                format={(value) => formatKeyframeValue(selectedKeyframe.property, value)}
                onCommit={(value) => updateSelectedKeyframe({ value })}
              />
              <label className="mt-2 block text-xs font-medium text-slate-600">
                {zhCN.inspector.fields.easing}
                <select
                  className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                  value={selectedKeyframeFrame.easing}
                  data-testid="selected-keyframe-easing"
                  onChange={(event) => updateSelectedKeyframe({ easing: event.target.value as KeyframeEasing })}
                >
                  <option value="linear">{zhCN.inspector.easing.linear}</option>
                  <option value="ease-in">{zhCN.inspector.easing.easeIn}</option>
                  <option value="ease-out">{zhCN.inspector.easing.easeOut}</option>
                  <option value="ease-in-out">{zhCN.inspector.easing.easeInOut}</option>
                </select>
              </label>
              <button
                className="mt-2 w-full rounded-md border border-rose-300 px-2 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50"
                type="button"
                data-testid="remove-selected-keyframe-button"
                onClick={removeSelectedKeyframe}
              >
                {zhCN.inspector.removeKeyframe}
              </button>
            </div>
          </Section>
        ) : null}

        {keyframeProperties.length > 0 ? (
          <Section title={zhCN.inspector.sections.curves}>
            <label className="block text-xs font-medium text-slate-600">
              {zhCN.inspector.fields.property}
              <select
                className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                value={curveProperty}
                data-testid="keyframe-curve-property-select"
                onChange={(event) => setCurveProperty(event.target.value as KeyframeProperty)}
              >
                {keyframeProperties.map((property) => (
                  <option key={property} value={property}>
                    {formatKeyframeProperty(property)}
                  </option>
                ))}
              </select>
            </label>
            <KeyframeCurveEditor
              clip={clip}
              property={curveProperty}
              selectedKeyframes={selectedKeyframes}
              onSelectionChange={setSelectedKeyframes}
              onCommit={(frames) => updateCurveKeyframes(curveProperty, frames)}
            />
          </Section>
        ) : null}

        {clip.type === 'image' ? (
          <Section title={zhCN.inspector.sections.kenBurns}>
            <ToggleField label={zhCN.inspector.sections.kenBurns} checked={Boolean(clip.kenBurns)} onCommit={setKenBurns} testId="ken-burns-toggle" />
            {clip.kenBurns ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-line bg-panel p-2 text-xs text-slate-600">
                  <div className="mb-1 font-semibold">{zhCN.inspector.fields.startScale}</div>
                  <div>{Math.round((clip.keyframes?.scaleX?.[0]?.value ?? clip.transform.scale) * 100)}%</div>
                </div>
                <div className="rounded-md border border-line bg-panel p-2 text-xs text-slate-600">
                  <div className="mb-1 font-semibold">{zhCN.inspector.fields.endScale}</div>
                  <RangeNumberField
                    label={zhCN.inspector.fields.endScaleControl}
                    value={getKenBurnsEndScale(clip)}
                    min={0.1}
                    max={4}
                    step={0.05}
                    format={(value) => `${Math.round(value * 100)}%`}
                    onCommit={updateKenBurnsEndScale}
                  />
                </div>
              </div>
            ) : null}
          </Section>
        ) : null}

        {clip.type === 'video' ? (
          <details className="mb-4" open data-testid="video-restoration-section">
            <summary className="mb-2 cursor-pointer text-xs font-semibold uppercase tracking-normal text-slate-500">{zhCN.inspector.sections.videoRestoration}</summary>
            <div className="space-y-3">
              <div className="rounded-md border border-line bg-panel p-2">
                <ToggleField
                  label={zhCN.inspector.fields.deinterlace}
                  checked={videoRestoration.deinterlace.enabled}
                  onCommit={(enabled) => updateVideoRestoration({ deinterlace: { ...videoRestoration.deinterlace, enabled } })}
                  testId="video-restoration-deinterlace-toggle"
                />
                <label className="mt-2 block text-xs font-medium text-slate-600">
                  {zhCN.inspector.fields.deinterlaceMode}
                  <select
                    className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                    value={videoRestoration.deinterlace.mode}
                    data-testid="video-restoration-deinterlace-mode"
                    onChange={(event) =>
                      updateVideoRestoration({
                        deinterlace: { ...videoRestoration.deinterlace, mode: Number(event.target.value) as VideoDeinterlaceMode }
                      })
                    }
                  >
                    <option value={0}>{zhCN.inspector.videoRestoration.deinterlaceModes.sendFrame}</option>
                    <option value={1}>{zhCN.inspector.videoRestoration.deinterlaceModes.sendField}</option>
                  </select>
                </label>
                {deinterlaceSuggestion !== null && !videoRestoration.deinterlace.enabled ? (
                  <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800" data-testid="video-restoration-deinterlace-suggestion">
                    <div>{zhCN.inspector.videoRestoration.deinterlaceSuggestion(asset?.fieldOrder ?? '')}</div>
                    <button
                      className="mt-2 rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                      type="button"
                      data-testid="video-restoration-apply-deinterlace-suggestion"
                      onClick={() => updateVideoRestoration({ deinterlace: { enabled: true, mode: deinterlaceSuggestion } })}
                    >
                      {zhCN.inspector.videoRestoration.applySuggestion}
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="rounded-md border border-line bg-panel p-2">
                <label className="block text-xs font-medium text-slate-600">
                  {zhCN.inspector.fields.temporalDenoisePreset}
                  <select
                    className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                    value={videoRestoration.temporalDenoise.preset}
                    data-testid="video-restoration-temporal-preset"
                    onChange={(event) =>
                      updateVideoRestoration({
                        temporalDenoise: { ...videoRestoration.temporalDenoise, preset: event.target.value as VideoDenoisePreset }
                      })
                    }
                  >
                    <option value="off">{zhCN.inspector.videoRestoration.presets.off}</option>
                    <option value="low">{zhCN.inspector.videoRestoration.presets.low}</option>
                    <option value="medium">{zhCN.inspector.videoRestoration.presets.medium}</option>
                    <option value="high">{zhCN.inspector.videoRestoration.presets.high}</option>
                    <option value="custom">{zhCN.inspector.videoRestoration.presets.custom}</option>
                  </select>
                </label>
                {videoRestoration.temporalDenoise.preset === 'custom' ? (
                  <div className="mt-3 space-y-2" data-testid="video-restoration-temporal-custom">
                    <RangeNumberField
                      label={zhCN.inspector.fields.lumaSpatial}
                      value={videoRestoration.temporalDenoise.lumaSpatial}
                      min={0}
                      max={20}
                      step={0.1}
                      format={(value) => value.toFixed(1)}
                      onCommit={(lumaSpatial) => updateVideoRestoration({ temporalDenoise: { ...videoRestoration.temporalDenoise, lumaSpatial } })}
                      testId="video-restoration-luma-spatial"
                    />
                    <RangeNumberField
                      label={zhCN.inspector.fields.chromaSpatial}
                      value={videoRestoration.temporalDenoise.chromaSpatial}
                      min={0}
                      max={20}
                      step={0.1}
                      format={(value) => value.toFixed(1)}
                      onCommit={(chromaSpatial) => updateVideoRestoration({ temporalDenoise: { ...videoRestoration.temporalDenoise, chromaSpatial } })}
                      testId="video-restoration-chroma-spatial"
                    />
                    <RangeNumberField
                      label={zhCN.inspector.fields.lumaTmp}
                      value={videoRestoration.temporalDenoise.lumaTmp}
                      min={0}
                      max={20}
                      step={0.1}
                      format={(value) => value.toFixed(1)}
                      onCommit={(lumaTmp) => updateVideoRestoration({ temporalDenoise: { ...videoRestoration.temporalDenoise, lumaTmp } })}
                      testId="video-restoration-luma-tmp"
                    />
                  </div>
                ) : null}
              </div>

              <div className="rounded-md border border-line bg-panel p-2">
                <ToggleField
                  label={zhCN.inspector.fields.spatialDenoise}
                  checked={videoRestoration.spatialDenoise.enabled}
                  onCommit={(enabled) => updateVideoRestoration({ spatialDenoise: { ...videoRestoration.spatialDenoise, enabled } })}
                  testId="video-restoration-spatial-toggle"
                />
                {videoRestoration.spatialDenoise.enabled ? (
                  <div className="mt-2 space-y-2" data-testid="video-restoration-spatial-controls">
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">{zhCN.inspector.videoRestoration.spatialWarning}</div>
                    <RangeNumberField
                      label={zhCN.inspector.fields.spatialStrength}
                      value={videoRestoration.spatialDenoise.strength}
                      min={0}
                      max={30}
                      step={0.1}
                      format={(value) => value.toFixed(1)}
                      onCommit={(strength) => updateVideoRestoration({ spatialDenoise: { ...videoRestoration.spatialDenoise, strength } })}
                      testId="video-restoration-spatial-strength"
                    />
                    <RangeNumberField
                      label={zhCN.inspector.fields.patchSize}
                      value={videoRestoration.spatialDenoise.patchSize}
                      min={1}
                      max={99}
                      step={2}
                      format={(value) => value.toFixed(0)}
                      onCommit={(patchSize) => updateVideoRestoration({ spatialDenoise: { ...videoRestoration.spatialDenoise, patchSize } })}
                      testId="video-restoration-patch-size"
                    />
                    <RangeNumberField
                      label={zhCN.inspector.fields.researchSize}
                      value={videoRestoration.spatialDenoise.researchSize}
                      min={1}
                      max={99}
                      step={2}
                      format={(value) => value.toFixed(0)}
                      onCommit={(researchSize) => updateVideoRestoration({ spatialDenoise: { ...videoRestoration.spatialDenoise, researchSize } })}
                      testId="video-restoration-research-size"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </details>
        ) : null}

        {clip.type !== 'audio' ? (
          <details className="mb-4" open>
            <summary className="mb-2 cursor-pointer text-xs font-semibold uppercase tracking-normal text-slate-500">{zhCN.inspector.fields.colorCorrection}</summary>
            <div className="space-y-3">
              <label className="block rounded-md border border-line bg-panel p-2 text-xs font-medium text-slate-600">
                <span>{zhCN.inspector.fields.inputColorSpace}</span>
                <select
                  className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5"
                  value={colorCorrection.inputColorSpace ?? 'rec709'}
                  onChange={(event) => commit({ colorCorrection: { inputColorSpace: event.target.value as InputColorSpace } })}
                  data-testid="clip-input-color-space-select"
                >
                  {INPUT_COLOR_SPACES.map((colorSpace) => (
                    <option key={colorSpace} value={colorSpace}>
                      {formatInputColorSpaceLabel(colorSpace)}
                    </option>
                  ))}
                </select>
              </label>
              <RangeNumberField
                label={zhCN.inspector.fields.brightness}
                value={colorCorrection.brightness}
                min={-1}
                max={1}
                step={0.01}
                format={(value) => value.toFixed(2)}
                onCommit={(brightness) => commit({ colorCorrection: { brightness } })}
                testId="clip-brightness-input"
              />
              <RangeNumberField
                label={zhCN.inspector.fields.contrast}
                value={colorCorrection.contrast}
                min={0}
                max={2}
                step={0.01}
                format={(value) => value.toFixed(2)}
                onCommit={(contrast) => commit({ colorCorrection: { contrast } })}
              />
              <RangeNumberField
                label={zhCN.inspector.fields.saturation}
                value={colorCorrection.saturation}
                min={0}
                max={2}
                step={0.01}
                format={(value) => value.toFixed(2)}
                onCommit={(saturation) => commit({ colorCorrection: { saturation } })}
              />
              <RangeNumberField
                label={zhCN.inspector.fields.hue}
                value={colorCorrection.hue}
                min={-180}
                max={180}
                step={1}
                format={(value) => `${Math.round(value)}°`}
                onCommit={(hue) => commit({ colorCorrection: { hue } })}
              />
              <div className="rounded-md border border-line bg-panel p-2 text-xs text-slate-600" data-testid="clip-lut-control">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-700">LUT</span>
                  {colorCorrection.lutPath ? (
                    <button
                      className="rounded border border-line bg-white p-1 hover:bg-white"
                      type="button"
                      title={zhCN.inspector.fields.clearLut}
                      data-testid="clear-lut-button"
                      onClick={() => commit({ colorCorrection: { lutPath: null } })}
                    >
                      <X size={14} />
                    </button>
                  ) : null}
                </div>
                <div className="mb-2 truncate" title={colorCorrection.lutPath ?? undefined} data-testid="clip-lut-path">
                  {formatLutPath(colorCorrection.lutPath)}
                </div>
                <button
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium hover:bg-white"
                  type="button"
                  data-testid="choose-lut-button"
                  onClick={() => void chooseLut()}
                >
                  <Palette size={14} />
                  {zhCN.inspector.fields.loadLut}
                </button>
              </div>
              <button
                className="w-full rounded-md border border-line px-2 py-1.5 text-sm font-medium hover:bg-panel"
                type="button"
                onClick={() => commit({ colorCorrection: { ...DEFAULT_COLOR_CORRECTION } })}
              >
                {zhCN.common.reset}
              </button>
            </div>
          </details>
        ) : null}

        {clip.type !== 'audio' ? (
          <details className="mb-4" open>
            <summary className="mb-2 cursor-pointer text-xs font-semibold uppercase tracking-normal text-slate-500">{zhCN.inspector.sections.curves}</summary>
            <CurveEditor
              curves={colorCurves}
              onCommit={(nextCurves) => commit({ colorCorrection: { colorCurves: nextCurves } })}
            />
          </details>
        ) : null}

        {clip.type !== 'audio' ? (
          <details className="mb-4">
            <summary className="mb-2 cursor-pointer text-xs font-semibold uppercase tracking-normal text-slate-500">{zhCN.inspector.sections.colorWheels}</summary>
            <ThreeWayColorEditor threeWayColor={threeWayColor} onCommit={(nextColor) => commit({ colorCorrection: { threeWayColor: nextColor } })} />
          </details>
        ) : null}

        {clip.type !== 'audio' ? (
          <details className="mb-4">
            <summary className="mb-2 cursor-pointer text-xs font-semibold uppercase tracking-normal text-slate-500">{zhCN.inspector.sections.effects}</summary>
            <EffectsEditor
              effects={clip.effects ?? []}
              onAdd={(type) => runEffectCommand(new AddEffectCommand(timelineAccessor, clip.id, { type, params: DEFAULT_EFFECT_PARAMS[type] }))}
              onRemove={(effectId) => runEffectCommand(new RemoveEffectCommand(timelineAccessor, clip.id, effectId))}
              onUpdate={(effectId, patch) => runEffectCommand(new UpdateEffectCommand(timelineAccessor, clip.id, effectId, patch))}
              onReorder={(effectIds) => runEffectCommand(new ReorderEffectsCommand(timelineAccessor, clip.id, effectIds))}
            />
          </details>
        ) : null}

        {'volume' in clip ? (
          <Section title={zhCN.inspector.sections.audio}>
            <AnimatedField label={zhCN.inspector.fields.volume} onAddKeyframe={() => addKeyframe('volume')} testId="add-volume-keyframe-button">
              <RangeField label={zhCN.inspector.fields.volume} value={clip.volume} min={0} max={2} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onCommit={(volume) => commit({ volume })} hideLabel testId="clip-volume-input" />
            </AnimatedField>
            <RangeNumberField
              label={zhCN.inspector.fields.pitchShift}
              value={audioPitchSemitones}
              min={-12}
              max={12}
              step={1}
              format={(value) => `${value > 0 ? '+' : ''}${Math.round(value)} ${zhCN.inspector.fields.semitones}`}
              onCommit={(pitchSemitones) => commit({ pitchSemitones })}
              testId="clip-pitch-input"
            />
            <ToggleField label={zhCN.inspector.fields.reverseAudio} checked={reverseAudio} onCommit={(nextReverseAudio) => commit({ reverseAudio: nextReverseAudio })} testId="clip-reverse-audio-toggle" />
            <details className="rounded-md border border-line bg-white" data-testid="audio-channel-routing-section" open>
              <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold text-slate-700">{zhCN.inspector.fields.audioChannelRouting}</summary>
              <div className="border-t border-line p-2">
                <label className="block text-xs font-medium text-slate-600">
                  {zhCN.inspector.fields.audioChannelRoutingMode}
                  <select
                    className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                    value={audioChannelRoutingOptions.includes(audioChannelRouting) ? audioChannelRouting : 'normal'}
                    data-testid="clip-audio-channel-routing-select"
                    onChange={(event) => commit({ audioChannelRouting: event.target.value as AudioChannelRoutingMode })}
                  >
                    {audioChannelRoutingOptions.map((mode) => (
                      <option key={mode} value={mode}>
                        {zhCN.inspector.audioChannelRoutingOptions[mode]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </details>
            <div className="grid grid-cols-2 gap-2">
              <RangeNumberField
                label={zhCN.inspector.fields.fadeIn}
                value={fadeInDuration}
                min={0}
                max={clip.duration}
                step={0.1}
                format={(value) => `${value.toFixed(1)}s`}
                onCommit={(fadeInDuration) => commit({ fadeInDuration })}
                testId="clip-fade-in-duration-input"
              />
              <RangeNumberField
                label={zhCN.inspector.fields.fadeOut}
                value={fadeOutDuration}
                min={0}
                max={clip.duration}
                step={0.1}
                format={(value) => `${value.toFixed(1)}s`}
                onCommit={(fadeOutDuration) => commit({ fadeOutDuration })}
                testId="clip-fade-out-duration-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-medium text-slate-600">
                {zhCN.inspector.fields.fadeInCurve}
                <select
                  className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                  value={fadeInCurve}
                  onChange={(event) => commit({ fadeInCurve: event.target.value as AudioFadeCurve })}
                  data-testid="clip-fade-in-curve-select"
                >
                  <option value="linear">{zhCN.inspector.easing.linear}</option>
                  <option value="ease-in">{zhCN.inspector.easing.easeIn}</option>
                  <option value="ease-out">{zhCN.inspector.easing.easeOut}</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-600">
                {zhCN.inspector.fields.fadeOutCurve}
                <select
                  className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                  value={fadeOutCurve}
                  onChange={(event) => commit({ fadeOutCurve: event.target.value as AudioFadeCurve })}
                  data-testid="clip-fade-out-curve-select"
                >
                  <option value="linear">{zhCN.inspector.easing.linear}</option>
                  <option value="ease-in">{zhCN.inspector.easing.easeIn}</option>
                  <option value="ease-out">{zhCN.inspector.easing.easeOut}</option>
                </select>
              </label>
            </div>
          </Section>
        ) : null}

        {clip.type === 'text' || clip.type === 'subtitle' ? (
          <Section title={clip.type === 'subtitle' ? zhCN.inspector.sections.subtitle : zhCN.inspector.sections.text}>
            <TextAreaField label={zhCN.inspector.fields.text} value={clip.text} onCommit={(text) => commit({ text })} testId="clip-text-input" />
            <NumberField label={zhCN.inspector.fields.fontSize} value={clip.style.fontSize} min={8} step={1} onCommit={(fontSize) => commit({ style: { fontSize } })} />
            <TextField label={zhCN.inspector.fields.fontFamily} value={clip.style.fontFamily} onCommit={(fontFamily) => commit({ style: { fontFamily } })} />
            <ColorField label={zhCN.inspector.fields.color} value={clip.style.color} onCommit={(color) => commit({ style: { color } })} />
            <ColorField label={zhCN.inspector.fields.background} value={clip.style.backgroundColor} onCommit={(backgroundColor) => commit({ style: { backgroundColor } })} />
            <RangeField
              label={zhCN.inspector.fields.backgroundOpacity}
              value={clip.style.backgroundOpacity}
              min={0}
              max={1}
              step={0.01}
              format={(value) => `${Math.round(value * 100)}%`}
              onCommit={(backgroundOpacity) => commit({ style: { backgroundOpacity } })}
              testId="clip-background-opacity-slider"
            />
            {clip.type === 'subtitle' ? (
              <>
                <button
                  className="w-full rounded-md border border-line bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled={!isTranslationConfigured(translationSettings) || Boolean(subtitleTranslationProgress)}
                  data-testid="subtitle-translate-button"
                  onClick={() => void translateSubtitleTrack()}
                >
                  {subtitleTranslationProgress ? zhCN.inspector.translation.progress(subtitleTranslationProgress.completed, subtitleTranslationProgress.total) : zhCN.inspector.translation.button}
                </button>
                {!isTranslationConfigured(translationSettings) ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-800" data-testid="subtitle-translation-not-configured">
                    {zhCN.inspector.translation.notConfigured}
                  </div>
                ) : null}
                {subtitleTranslationProgress ? (
                  <div className="rounded-md bg-panel p-2 text-xs text-slate-600" data-testid="subtitle-translation-progress">
                    {zhCN.inspector.translation.progress(subtitleTranslationProgress.completed, subtitleTranslationProgress.total)}
                  </div>
                ) : null}
                <NumberField label={zhCN.inspector.fields.bottomMargin} value={clip.style.yOffset} min={0} step={1} onCommit={(yOffset) => commit({ style: { yOffset } })} />
                <label className="block text-xs font-medium text-slate-600">
                  {zhCN.inspector.fields.exportMode}
                  <select
                    className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink"
                    value={clip.subtitleMode}
                    data-testid="subtitle-mode-select"
                    onChange={(event) => commit({ subtitleMode: event.target.value === 'soft-sub' ? 'soft-sub' : 'burn-in' })}
                  >
                    <option value="burn-in">{zhCN.inspector.subtitleMode.burnIn}</option>
                    <option value="soft-sub">{zhCN.inspector.subtitleMode.softSub}</option>
                  </select>
                </label>
                <SubtitleRetimingPanel clip={clip} selectedSubtitleClips={selectedSubtitleClips.length > 0 ? selectedSubtitleClips : [clip]} projectSettings={projectSettings} />
              </>
            ) : null}
            {clip.type === 'text' ? (
              <details className="rounded-md border border-line bg-white" data-testid="path-text-section" open>
                <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold text-slate-700">{zhCN.inspector.sections.pathText}</summary>
                <div className="space-y-3 border-t border-line p-2">
                  <ToggleField label={zhCN.inspector.fields.pathTextMode} checked={textPath?.enabled ?? false} onCommit={(enabled) => updateTextPath({ enabled })} testId="path-text-toggle" />
                  <RangeNumberField
                    label={zhCN.inspector.fields.pathTextStartOffset}
                    value={textPath?.startOffset ?? DEFAULT_TEXT_PATH.startOffset}
                    min={0}
                    max={1}
                    step={0.01}
                    format={(value) => `${Math.round(value * 100)}%`}
                    onCommit={(startOffset) => updateTextPath({ startOffset })}
                    testId="path-text-start-offset-input"
                  />
                  <RangeNumberField
                    label={zhCN.inspector.fields.pathTextLetterSpacing}
                    value={textPath?.letterSpacing ?? DEFAULT_TEXT_PATH.letterSpacing}
                    min={0}
                    max={80}
                    step={1}
                    format={(value) => `${Math.round(value)}px`}
                    onCommit={(letterSpacing) => updateTextPath({ letterSpacing })}
                    testId="path-text-letter-spacing-input"
                  />
                  <ToggleField label={zhCN.inspector.fields.pathTextRotateCharacters} checked={textPath?.rotateCharacters ?? true} onCommit={(rotateCharacters) => updateTextPath({ rotateCharacters })} testId="path-text-rotate-toggle" />
                  <div className="rounded-md bg-panel p-2 text-xs text-slate-600" data-testid="path-text-point-summary">
                    {zhCN.inspector.fields.pathPointCount(textPath?.path.length ?? DEFAULT_TEXT_PATH.path.length)}
                  </div>
                  <button
                    className="w-full rounded-md border border-line bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-panel"
                    type="button"
                    data-testid="path-text-offset-keyframe-button"
                    onClick={() => addKeyframe('pathStartOffset', textPath?.startOffset ?? DEFAULT_TEXT_PATH.startOffset)}
                  >
                    {zhCN.inspector.pathText.addOffsetKeyframe}
                  </button>
                </div>
              </details>
            ) : null}
            {clip.type === 'text' ? (
              <details className="rounded-md border border-line bg-white" data-testid="text-animation-section" open>
                <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold text-slate-700">{zhCN.inspector.sections.textAnimation}</summary>
                <div className="space-y-3 border-t border-line p-2">
                  <label className="block text-xs font-medium text-slate-600">
                    {zhCN.inspector.fields.animationPreset}
                    <select
                      className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                      value={textAnimationPreset}
                      data-testid="text-animation-preset-select"
                      onChange={(event) => setTextAnimationPreset(event.target.value as TextAnimationPreset)}
                    >
                      {TEXT_ANIMATION_PRESETS.map((preset) => (
                        <option key={preset} value={preset}>
                          {zhCN.inspector.textAnimation.presets[preset]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <RangeNumberField
                    label={zhCN.inspector.fields.animationDuration}
                    value={textAnimationDuration}
                    min={0.1}
                    max={2}
                    step={0.1}
                    format={(value) => `${value.toFixed(1)}s`}
                    onCommit={setTextAnimationDuration}
                    testId="text-animation-duration-input"
                  />
                  <label className="block text-xs font-medium text-slate-600">
                    {zhCN.inspector.fields.animationDirection}
                    <select
                      className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                      value={textAnimationDirection}
                      data-testid="text-animation-direction-select"
                      onChange={(event) => setTextAnimationDirection(event.target.value as TextAnimationDirection)}
                    >
                      {TEXT_ANIMATION_DIRECTIONS.map((direction) => (
                        <option key={direction} value={direction}>
                          {zhCN.inspector.textAnimation.directions[direction]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="rounded-md bg-panel p-2 text-xs text-slate-600" data-testid="text-animation-keyframe-summary">
                    {zhCN.inspector.textAnimation.keyframeCount(textAnimationKeyframeCount)}
                  </div>
                  <button
                    className="w-full rounded-md border border-line bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-panel"
                    type="button"
                    data-testid="apply-text-animation-button"
                    onClick={applyTextAnimation}
                  >
                    {zhCN.inspector.textAnimation.apply}
                  </button>
                </div>
              </details>
            ) : null}
            <ToggleField label={zhCN.inspector.fields.bold} checked={clip.style.bold} onCommit={(bold) => commit({ style: { bold } })} />
            <ToggleField label={zhCN.inspector.fields.italic} checked={clip.style.italic} onCommit={(italic) => commit({ style: { italic } })} />
          </Section>
        ) : null}
      </div>
    </aside>
  );
}

function PanelTitle() {
  return (
    <div className="flex items-center gap-2 border-b border-line px-3 py-2">
      <SlidersHorizontal size={16} />
      <div>
        <div className="text-sm font-semibold">{zhCN.inspector.title}</div>
        <div className="text-xs text-slate-500">{zhCN.inspector.subtitle}</div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-normal text-slate-500">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function SubtitleRetimingPanel({
  clip,
  selectedSubtitleClips,
  projectSettings
}: {
  clip?: Extract<Clip, { type: 'subtitle' }>;
  selectedSubtitleClips: Array<Extract<Clip, { type: 'subtitle' }>>;
  projectSettings: ProjectSettings;
}) {
  const project = useEditorStore((state) => state.project);
  const [shiftSeconds, setShiftSeconds] = useState(1);
  const [scaleFactor, setScaleFactor] = useState(1);
  const [batchStartDelta, setBatchStartDelta] = useState(0);
  const [batchEndDelta, setBatchEndDelta] = useState(0);
  const t = zhCN.inspector.subtitleRetiming;
  const trackSubtitleClips = useMemo(() => {
    const trackId = clip?.trackId ?? selectedSubtitleClips[0]?.trackId;
    const track = project.timeline.tracks.find((item) => item.id === trackId && item.type === 'subtitle');
    return (track?.clips.filter((item): item is Extract<Clip, { type: 'subtitle' }> => item.type === 'subtitle') ?? []).sort(
      (left, right) => left.start - right.start || left.id.localeCompare(right.id)
    );
  }, [clip?.trackId, project.timeline.tracks, selectedSubtitleClips]);
  const fullTrackTargets = selectedSubtitleClips.length > 1 ? selectedSubtitleClips : trackSubtitleClips;
  const selectedTargets = selectedSubtitleClips.length > 0 ? selectedSubtitleClips : fullTrackTargets;
  const projectDuration = Math.max(getTimelineDuration(project.timeline), ...fullTrackTargets.map((item) => item.start + item.duration), 1 / Math.max(1, projectSettings.fps));
  const peakTimes = (project.beatMarkers ?? []).map((marker) => marker.time);

  const runRetimingCommand = (command: Parameters<typeof commandManager.execute>[0], successMessage: string) => {
    try {
      commandManager.execute(command);
      showToast({ kind: 'success', title: t.title, message: successMessage });
    } catch (error) {
      showToast({ kind: 'warning', title: t.failedTitle, message: error instanceof Error ? error.message : t.failedMessage });
    }
  };

  const applyShift = () => {
    runRetimingCommand(new BatchShiftSubtitleCommand(timelineAccessor, fullTrackTargets.map((item) => item.id), shiftSeconds, projectDuration), t.shiftApplied(fullTrackTargets.length));
  };
  const applyScale = () => {
    runRetimingCommand(
      new BatchSubtitleTimingCommand(timelineAccessor, calculateSubtitleScaleUpdates(fullTrackTargets, scaleFactor, projectDuration, 1 / Math.max(1, projectSettings.fps))),
      t.scaleApplied(fullTrackTargets.length)
    );
  };
  const applyPeakAlign = () => {
    if (peakTimes.length === 0) {
      showToast({ kind: 'warning', title: t.peakUnavailableTitle, message: t.peakUnavailableMessage });
      return;
    }
    const updates = selectedTargets
      .map((item) => calculateSubtitlePeakAlignUpdate(item, peakTimes, projectDuration, 0.5))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (updates.length === 0) {
      showToast({ kind: 'warning', title: t.peakUnavailableTitle, message: t.peakOutOfRange });
      return;
    }
    runRetimingCommand(new BatchSubtitleTimingCommand(timelineAccessor, updates), t.peakApplied(updates.length));
  };
  const applyBatchAdjust = () => {
    runRetimingCommand(
      new BatchSubtitleTimingCommand(timelineAccessor, calculateSubtitleBatchAdjustUpdates(selectedTargets, batchStartDelta, batchEndDelta, projectDuration, 1 / Math.max(1, projectSettings.fps))),
      t.batchApplied(selectedTargets.length)
    );
  };

  return (
    <details className="rounded-md border border-line bg-white" data-testid="subtitle-retiming-section" open>
      <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold text-slate-700">{t.title}</summary>
      <div className="space-y-3 border-t border-line p-2">
        <div className="rounded-md bg-panel p-2 text-xs text-slate-600" data-testid="subtitle-retiming-summary">
          {t.summary(fullTrackTargets.length, selectedTargets.length)}
        </div>
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <NumberField label={t.shiftSeconds} value={shiftSeconds} step={0.1} onCommit={setShiftSeconds} testId="subtitle-shift-input" />
          <button className="rounded-md border border-line bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-panel" type="button" data-testid="subtitle-shift-apply-button" onClick={applyShift}>
            {t.apply}
          </button>
        </div>
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <NumberField label={t.scaleFactor} value={scaleFactor} min={0.01} step={0.01} onCommit={setScaleFactor} testId="subtitle-scale-input" />
          <button className="rounded-md border border-line bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-panel" type="button" data-testid="subtitle-scale-apply-button" onClick={applyScale}>
            {t.apply}
          </button>
        </div>
        <button className="w-full rounded-md border border-line bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-panel" type="button" data-testid="subtitle-peak-align-button" onClick={applyPeakAlign}>
          {t.alignToPeak}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label={t.startDelta} value={batchStartDelta} step={0.1} onCommit={setBatchStartDelta} testId="subtitle-batch-start-delta-input" />
          <NumberField label={t.endDelta} value={batchEndDelta} step={0.1} onCommit={setBatchEndDelta} testId="subtitle-batch-end-delta-input" />
        </div>
        <button className="w-full rounded-md border border-line bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-panel" type="button" data-testid="subtitle-batch-adjust-button" onClick={applyBatchAdjust}>
          {t.batchAdjust}
        </button>
      </div>
    </details>
  );
}

type SpeedCurveFrame = { id: string; time: number; value: number; easing: KeyframeEasing };

function SpeedCurveEditor({ clip, onCommit }: { clip: Clip; onCommit(frames: SpeedCurveFrame[]): void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const [draft, setDraft] = useState<SpeedCurveFrame[]>(() => getSpeedCurveFrames(clip));
  const draftRef = useRef(draft);
  const duration = Math.max(0.001, clip.duration);

  useEffect(() => {
    const next = getSpeedCurveFrames(clip);
    draftRef.current = next;
    setDraft(next);
  }, [clip]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      drawSpeedCurveCanvas(canvas, draft, duration);
    }
  }, [draft, duration]);

  const updateDraft = (frames: SpeedCurveFrame[]) => {
    const next = normalizeSpeedCurveFrames(frames, duration);
    draftRef.current = next;
    setDraft(next);
  };
  const commitDraft = () => onCommit(normalizeSpeedCurveFrames(draftRef.current, duration));
  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const frame = eventToSpeedFrame(event, canvas, duration);
    const frames = normalizeSpeedCurveFrames(draftRef.current, duration);
    const nearest = findNearestSpeedFrame(frames, frame, duration, 0.06);
    if (nearest === null) {
      const nextFrames = normalizeSpeedCurveFrames([...frames, frame], duration);
      dragIndexRef.current = findNearestSpeedFrame(nextFrames, frame, duration, 1) ?? nextFrames.length - 1;
      updateDraft(nextFrames);
    } else {
      dragIndexRef.current = nearest;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const dragIndex = dragIndexRef.current;
    if (!canvas || dragIndex === null) {
      return;
    }
    const next = [...draftRef.current];
    next[dragIndex] = { ...next[dragIndex], ...eventToSpeedFrame(event, canvas, duration), id: next[dragIndex]?.id ?? createId('speed-keyframe') };
    updateDraft(next);
  };
  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (dragIndexRef.current !== null) {
      dragIndexRef.current = null;
      commitDraft();
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const handleDoubleClick = (event: ReactMouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || draftRef.current.length <= 2) {
      return;
    }
    const frame = eventToSpeedFrame(event, canvas, duration);
    const nearest = findNearestSpeedFrame(draftRef.current, frame, duration, 0.06);
    if (nearest === null) {
      return;
    }
    const next = draftRef.current.filter((_, index) => index !== nearest);
    updateDraft(next);
    onCommit(normalizeSpeedCurveFrames(next, duration));
  };

  return (
    <div className="rounded-md border border-line bg-panel p-2" data-testid="speed-curve-editor">
      <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-slate-500">
        <span>{zhCN.inspector.fields.speedCurve}</span>
        <span>
          {zhCN.inspector.fields.speedCurveMin} - {zhCN.inspector.fields.speedCurveMax}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        className="block h-28 w-full touch-none rounded border border-line bg-slate-950"
        width={256}
        height={112}
        data-testid="speed-curve-editor-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      />
    </div>
  );
}

type CurveEditorDrag =
  | { mode: 'box'; start: CanvasPoint; current: CanvasPoint }
  | { mode: 'points'; start: CurveEditorFrame; base: CurveEditorFrame[]; selectedIds: string[] };

type CanvasPoint = { x: number; y: number };
type CurveEditorFrame = Keyframe<number>;

function KeyframeCurveEditor({
  clip,
  property,
  selectedKeyframes,
  onSelectionChange,
  onCommit
}: {
  clip: Clip;
  property: KeyframeProperty;
  selectedKeyframes: SelectedKeyframeRef[];
  onSelectionChange(refs: SelectedKeyframeRef[]): void;
  onCommit(frames: CurveEditorFrame[]): void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<CurveEditorDrag | null>(null);
  const [draft, setDraft] = useState<CurveEditorFrame[]>(() => getCurveEditorFrames(clip, property));
  const [selectionBox, setSelectionBox] = useState<{ start: CanvasPoint; current: CanvasPoint } | null>(null);
  const draftRef = useRef(draft);
  const duration = Math.max(0.001, clip.duration);
  const selectedIds = selectedKeyframes
    .filter((ref) => ref.clipId === clip.id && ref.property === property)
    .map((ref) => ref.keyframeId);

  useEffect(() => {
    const next = getCurveEditorFrames(clip, property);
    draftRef.current = next;
    setDraft(next);
  }, [clip, property]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      drawKeyframeCurveCanvas(canvas, draft, property, duration, selectedIds, selectionBox);
    }
  }, [draft, duration, property, selectedIds, selectionBox]);

  const updateDraft = (frames: CurveEditorFrame[]) => {
    const next = normalizeCurveEditorFrames(frames, property, duration);
    draftRef.current = next;
    setDraft(next);
  };
  const refsForIds = (ids: string[]) => ids.map((keyframeId) => ({ clipId: clip.id, property, keyframeId }));
  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const frame = eventToCurveEditorFrame(event, canvas, property, duration);
    const nearest = findNearestCurveFrame(draftRef.current, frame, property, duration, 0.055);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (nearest !== null) {
      const nearestFrame = draftRef.current[nearest];
      const nextSelectedIds = selectedIds.includes(nearestFrame.id) ? selectedIds : [nearestFrame.id];
      if (!selectedIds.includes(nearestFrame.id)) {
        onSelectionChange(refsForIds(nextSelectedIds));
      }
      dragRef.current = { mode: 'points', start: frame, base: draftRef.current.map((item) => ({ ...item })), selectedIds: nextSelectedIds };
      return;
    }
    const point = eventToCanvasPoint(event, canvas);
    dragRef.current = { mode: 'box', start: point, current: point };
    setSelectionBox({ start: point, current: point });
  };
  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const drag = dragRef.current;
    if (!canvas || !drag) {
      return;
    }
    if (drag.mode === 'box') {
      const current = eventToCanvasPoint(event, canvas);
      dragRef.current = { ...drag, current };
      setSelectionBox({ start: drag.start, current });
      return;
    }
    const frame = eventToCurveEditorFrame(event, canvas, property, duration);
    const limits = KEYFRAME_PROPERTY_LIMITS[property];
    const deltaTime = frame.time - drag.start.time;
    const deltaValue = frame.value - drag.start.value;
    updateDraft(
      drag.base.map((item) =>
        drag.selectedIds.includes(item.id)
          ? {
              ...item,
              time: roundFinite(Math.min(duration, Math.max(0, item.time + deltaTime))),
              value: roundFinite(Math.min(limits.max, Math.max(limits.min, item.value + deltaValue)))
            }
          : item
      )
    );
  };
  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const drag = dragRef.current;
    dragRef.current = null;
    setSelectionBox(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!canvas || !drag) {
      return;
    }
    if (drag.mode === 'box') {
      const selected = getCurveFrameIdsInBox(draftRef.current, property, duration, canvas, drag.start, drag.current);
      onSelectionChange(refsForIds(selected));
      return;
    }
    onCommit(normalizeCurveEditorFrames(draftRef.current, property, duration));
  };

  return (
    <div className="rounded-md border border-line bg-panel p-2" data-testid="keyframe-curve-editor">
      <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-slate-500">
        <span>{formatKeyframeProperty(property)}</span>
        <span>{formatKeyframeValue(property, KEYFRAME_PROPERTY_LIMITS[property].min)} - {formatKeyframeValue(property, KEYFRAME_PROPERTY_LIMITS[property].max)}</span>
      </div>
      <canvas
        ref={canvasRef}
        className="block h-32 w-full touch-none rounded border border-line bg-slate-950"
        width={288}
        height={128}
        data-testid="keyframe-curve-editor-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  );
}

function getCurveEditorFrames(clip: Clip, property: KeyframeProperty): CurveEditorFrame[] {
  return normalizeCurveEditorFrames((clip.keyframes?.[property] ?? []) as CurveEditorFrame[], property, Math.max(0.001, clip.duration));
}

function normalizeCurveEditorFrames(frames: CurveEditorFrame[], property: KeyframeProperty, duration: number): CurveEditorFrame[] {
  const limits = KEYFRAME_PROPERTY_LIMITS[property];
  return frames
    .map((frame) => ({
      id: frame.id,
      time: roundFinite(Math.min(duration, Math.max(0, frame.time))),
      value: roundFinite(Math.min(limits.max, Math.max(limits.min, frame.value))),
      easing: frame.easing
    }))
    .sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
}

function drawKeyframeCurveCanvas(
  canvas: HTMLCanvasElement,
  frames: CurveEditorFrame[],
  property: KeyframeProperty,
  duration: number,
  selectedIds: string[],
  selectionBox: { start: CanvasPoint; current: CanvasPoint } | null
): void {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  const { width, height } = canvas;
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#0f172a';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = 'rgba(148,163,184,0.22)';
  context.lineWidth = 1;
  for (let x = 0; x <= width; x += width / 4) {
    context.beginPath();
    context.moveTo(x + 0.5, 0);
    context.lineTo(x + 0.5, height);
    context.stroke();
  }
  for (let y = 0; y <= height; y += height / 4) {
    context.beginPath();
    context.moveTo(0, y + 0.5);
    context.lineTo(width, y + 0.5);
    context.stroke();
  }
  const points = frames.map((frame) => ({ frame, point: curveFrameToPoint(frame, property, duration, canvas) }));
  if (points.length > 1) {
    context.strokeStyle = '#38bdf8';
    context.lineWidth = 2;
    context.beginPath();
    points.forEach(({ point }, index) => {
      if (index === 0) {
        context.moveTo(point.x, point.y);
      } else {
        context.lineTo(point.x, point.y);
      }
    });
    context.stroke();
  }
  for (const { frame, point } of points) {
    const selected = selectedIds.includes(frame.id);
    context.fillStyle = selected ? '#ffffff' : '#fb7185';
    context.strokeStyle = selected ? '#020617' : '#ffffff';
    context.lineWidth = selected ? 2 : 1;
    context.beginPath();
    context.arc(point.x, point.y, selected ? 5 : 4, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
  if (selectionBox) {
    const left = Math.min(selectionBox.start.x, selectionBox.current.x);
    const top = Math.min(selectionBox.start.y, selectionBox.current.y);
    const boxWidth = Math.abs(selectionBox.current.x - selectionBox.start.x);
    const boxHeight = Math.abs(selectionBox.current.y - selectionBox.start.y);
    context.fillStyle = 'rgba(14,165,233,0.18)';
    context.strokeStyle = '#38bdf8';
    context.lineWidth = 1;
    context.fillRect(left, top, boxWidth, boxHeight);
    context.strokeRect(left, top, boxWidth, boxHeight);
  }
}

function eventToCurveEditorFrame(event: ReactPointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement, property: KeyframeProperty, duration: number): CurveEditorFrame {
  const point = eventToCanvasPoint(event, canvas);
  const limits = KEYFRAME_PROPERTY_LIMITS[property];
  const valueSpan = Math.max(0.001, limits.max - limits.min);
  return {
    id: createId('keyframe-draft'),
    time: roundFinite(Math.min(duration, Math.max(0, (point.x / Math.max(1, canvas.width)) * duration))),
    value: roundFinite(Math.min(limits.max, Math.max(limits.min, limits.max - (point.y / Math.max(1, canvas.height)) * valueSpan))),
    easing: 'linear'
  };
}

function eventToCanvasPoint(event: ReactPointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement): CanvasPoint {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.min(canvas.width, Math.max(0, ((event.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width)),
    y: Math.min(canvas.height, Math.max(0, ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height))
  };
}

function curveFrameToPoint(frame: CurveEditorFrame, property: KeyframeProperty, duration: number, canvas: HTMLCanvasElement): CanvasPoint {
  const limits = KEYFRAME_PROPERTY_LIMITS[property];
  const valueSpan = Math.max(0.001, limits.max - limits.min);
  return {
    x: (frame.time / Math.max(0.001, duration)) * canvas.width,
    y: ((limits.max - frame.value) / valueSpan) * canvas.height
  };
}

function findNearestCurveFrame(frames: CurveEditorFrame[], target: CurveEditorFrame, property: KeyframeProperty, duration: number, maxDistance: number): number | null {
  const limits = KEYFRAME_PROPERTY_LIMITS[property];
  const valueSpan = Math.max(0.001, limits.max - limits.min);
  let nearest: number | null = null;
  let nearestDistance = maxDistance;
  for (const [index, frame] of frames.entries()) {
    const distance = Math.hypot((frame.time - target.time) / Math.max(0.001, duration), (frame.value - target.value) / valueSpan);
    if (distance <= nearestDistance) {
      nearest = index;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function getCurveFrameIdsInBox(
  frames: CurveEditorFrame[],
  property: KeyframeProperty,
  duration: number,
  canvas: HTMLCanvasElement,
  start: CanvasPoint,
  current: CanvasPoint
): string[] {
  const left = Math.min(start.x, current.x);
  const right = Math.max(start.x, current.x);
  const top = Math.min(start.y, current.y);
  const bottom = Math.max(start.y, current.y);
  return frames.flatMap((frame) => {
    const point = curveFrameToPoint(frame, property, duration, canvas);
    return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom ? [frame.id] : [];
  });
}

function getSpeedCurveFrames(clip: Clip): SpeedCurveFrame[] {
  const frames = normalizeSpeedCurveFrames((clip.keyframes?.speed ?? []) as SpeedCurveFrame[], Math.max(0.001, clip.duration));
  if (frames.length > 0) {
    return frames;
  }
  return normalizeSpeedCurveFrames(
    [
      { id: createId('speed-keyframe'), time: 0, value: getClipSpeed(clip), easing: 'linear' },
      { id: createId('speed-keyframe'), time: clip.duration, value: getClipSpeed(clip), easing: 'linear' }
    ],
    Math.max(0.001, clip.duration)
  );
}

function normalizeSpeedCurveFrames(frames: SpeedCurveFrame[], duration: number): SpeedCurveFrame[] {
  return frames
    .map((frame) => ({
      id: frame.id || createId('speed-keyframe'),
      time: Math.min(duration, Math.max(0, roundFinite(frame.time))),
      value: Math.min(MAX_CLIP_SPEED, Math.max(MIN_CLIP_SPEED, roundFinite(frame.value))),
      easing: frame.easing ?? 'linear'
    }))
    .sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
}

function eventToSpeedFrame(event: { clientX: number; clientY: number }, canvas: HTMLCanvasElement, duration: number): SpeedCurveFrame {
  const rect = canvas.getBoundingClientRect();
  const x = clampUnit((event.clientX - rect.left) / rect.width);
  const y = clampUnit((event.clientY - rect.top) / rect.height);
  return {
    id: createId('speed-keyframe'),
    time: roundFinite(x * duration),
    value: roundFinite(MIN_CLIP_SPEED + (1 - y) * (MAX_CLIP_SPEED - MIN_CLIP_SPEED)),
    easing: 'linear'
  };
}

function drawSpeedCurveCanvas(canvas: HTMLCanvasElement, frames: SpeedCurveFrame[], duration: number): void {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#0f172a';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = 'rgba(148, 163, 184, 0.28)';
  context.lineWidth = 1;
  for (let index = 1; index < 4; index += 1) {
    const x = (index / 4) * width;
    const y = (index / 4) * height;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  const normalized = normalizeSpeedCurveFrames(frames, duration);
  context.strokeStyle = '#2d6cdf';
  context.lineWidth = 2;
  context.beginPath();
  normalized.forEach((frame, index) => {
    const point = speedFrameToPoint(frame, duration, width, height);
    if (index === 0) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
  });
  context.stroke();
  for (const frame of normalized) {
    const point = speedFrameToPoint(frame, duration, width, height);
    context.beginPath();
    context.fillStyle = '#ffffff';
    context.arc(point.x, point.y, 4, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#2d6cdf';
    context.lineWidth = 2;
    context.stroke();
  }
}

function speedFrameToPoint(frame: SpeedCurveFrame, duration: number, width: number, height: number): { x: number; y: number } {
  return {
    x: (Math.min(duration, Math.max(0, frame.time)) / duration) * width,
    y: (1 - (Math.min(MAX_CLIP_SPEED, Math.max(MIN_CLIP_SPEED, frame.value)) - MIN_CLIP_SPEED) / (MAX_CLIP_SPEED - MIN_CLIP_SPEED)) * height
  };
}

function findNearestSpeedFrame(frames: SpeedCurveFrame[], target: SpeedCurveFrame, duration: number, maxDistance: number): number | null {
  let nearest: number | null = null;
  let nearestDistance = maxDistance;
  for (const [index, frame] of frames.entries()) {
    const distance = Math.hypot((frame.time - target.time) / duration, (frame.value - target.value) / (MAX_CLIP_SPEED - MIN_CLIP_SPEED));
    if (distance <= nearestDistance) {
      nearest = index;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function roundFinite(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0;
}

type CurveChannel = keyof ColorCurves;

const CURVE_CHANNELS: Array<{ key: CurveChannel; label: string; color: string }> = [
  { key: 'master', label: zhCN.inspector.fields.masterCurve, color: '#f8fafc' },
  { key: 'r', label: zhCN.inspector.fields.redCurve, color: '#ef4444' },
  { key: 'g', label: zhCN.inspector.fields.greenCurve, color: '#22c55e' },
  { key: 'b', label: zhCN.inspector.fields.blueCurve, color: '#3b82f6' }
];

function CurveEditor({ curves, onCommit }: { curves: ColorCurves; onCommit(curves: ColorCurves): void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const draftRef = useRef<ColorCurves>(curves);
  const [activeChannel, setActiveChannel] = useState<CurveChannel>('master');
  const [draft, setDraft] = useState<ColorCurves>(curves);

  useEffect(() => {
    const normalized = normalizeColorCurves(curves);
    draftRef.current = normalized;
    setDraft(normalized);
  }, [curves]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    drawCurveCanvas(canvas, draft[activeChannel], CURVE_CHANNELS.find((item) => item.key === activeChannel)?.color ?? '#e2e8f0');
  }, [activeChannel, draft]);

  const setDraftCurves = (next: ColorCurves) => {
    const normalized = normalizeColorCurves(next);
    draftRef.current = normalized;
    setDraft(normalized);
  };
  const commitDraft = () => {
    onCommit(draftRef.current);
  };
  const updateActivePoints = (points: CurvePoint[], shouldCommit = false) => {
    const next = { ...draftRef.current, [activeChannel]: normalizeCurvePoints(points) };
    setDraftCurves(next);
    if (shouldCommit) {
      onCommit(next);
    }
  };
  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const point = eventToCurvePoint(event, canvas);
    const points = normalizeCurvePoints(draftRef.current[activeChannel]);
    const nearest = findNearestCurvePoint(points, point, 0.045);
    if (nearest === null) {
      const nextPoints = normalizeCurvePoints([...points, point]);
      dragIndexRef.current = findNearestCurvePoint(nextPoints, point, 1) ?? nextPoints.length - 1;
      updateActivePoints(nextPoints);
    } else {
      dragIndexRef.current = nearest;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const dragIndex = dragIndexRef.current;
    if (!canvas || dragIndex === null) {
      return;
    }
    const point = eventToCurvePoint(event, canvas);
    const points = normalizeCurvePoints(draftRef.current[activeChannel]);
    points[dragIndex] = point;
    const nextPoints = normalizeCurvePoints(points);
    dragIndexRef.current = findNearestCurvePoint(nextPoints, point, 1) ?? dragIndex;
    updateActivePoints(nextPoints);
  };
  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (dragIndexRef.current !== null) {
      dragIndexRef.current = null;
      commitDraft();
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const handleDoubleClick = (event: ReactMouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const point = eventToCurvePoint(event, canvas);
    const points = normalizeCurvePoints(draftRef.current[activeChannel]);
    const nearest = findNearestCurvePoint(points, point, 0.06);
    if (nearest === null || points.length <= 2) {
      return;
    }
    updateActivePoints(points.filter((_, index) => index !== nearest), true);
  };

  return (
    <div className="space-y-2 rounded-md border border-line bg-panel p-2" data-testid="curve-editor">
      <div className="grid grid-cols-4 gap-1">
        {CURVE_CHANNELS.map((channel) => (
          <button
            key={channel.key}
            className={`rounded-md border px-2 py-1 text-xs font-semibold ${
              activeChannel === channel.key ? 'border-brand bg-white text-brand' : 'border-line bg-white text-slate-600 hover:bg-panel'
            }`}
            type="button"
            data-testid={`curve-tab-${channel.key}`}
            onClick={() => setActiveChannel(channel.key)}
          >
            {channel.label}
          </button>
        ))}
      </div>
      <canvas
        ref={canvasRef}
        className="block h-64 w-64 touch-none rounded border border-line bg-slate-950"
        width={256}
        height={256}
        data-testid="curve-editor-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      />
      <button
        className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium hover:bg-panel"
        type="button"
        data-testid="reset-curves-button"
        onClick={() => {
          const next = createDefaultColorCurves();
          setDraftCurves(next);
          onCommit(next);
        }}
      >
        {zhCN.inspector.fields.resetCurve}
      </button>
    </div>
  );
}

type ThreeWayKey = keyof ThreeWayColor;

const THREE_WAY_CHANNELS: Array<{ key: ThreeWayKey; label: string }> = [
  { key: 'lift', label: zhCN.inspector.fields.lift },
  { key: 'gamma', label: zhCN.inspector.fields.gamma },
  { key: 'gain', label: zhCN.inspector.fields.gain }
];

function ThreeWayColorEditor({ threeWayColor, onCommit }: { threeWayColor: ThreeWayColor; onCommit(color: ThreeWayColor): void }) {
  const normalized = normalizeThreeWayColor(threeWayColor);
  const updateWheel = (key: ThreeWayKey, patch: Partial<ColorWheelValue>) => {
    onCommit(
      normalizeThreeWayColor({
        ...normalized,
        [key]: normalizeColorWheelValue({ ...normalized[key], ...patch })
      })
    );
  };

  return (
    <div className="space-y-3 rounded-md border border-line bg-panel p-2" data-testid="three-way-color-editor">
      {THREE_WAY_CHANNELS.map((channel) => (
        <ColorWheelControl key={channel.key} label={channel.label} value={normalized[channel.key]} onCommit={(patch) => updateWheel(channel.key, patch)} testId={`color-wheel-${channel.key}`} />
      ))}
      <button
        className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium hover:bg-panel"
        type="button"
        data-testid="reset-three-way-color-button"
        onClick={() => onCommit(DEFAULT_THREE_WAY_COLOR)}
      >
        {zhCN.common.reset}
      </button>
    </div>
  );
}

function ColorWheelControl({
  label,
  value,
  onCommit,
  testId
}: {
  label: string;
  value: ColorWheelValue;
  onCommit(patch: Partial<ColorWheelValue>): void;
  testId: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      drawColorWheel(canvas, value);
    }
  }, [value]);

  const updateFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    onCommit(wheelPointToOffsets(eventToUnitPoint(event, canvas)));
  };

  return (
    <div className="rounded-md border border-line bg-white p-2" data-testid={testId}>
      <div className="mb-2 text-xs font-semibold text-slate-700">{label}</div>
      <div className="flex items-start gap-3">
        <canvas
          ref={canvasRef}
          className="h-24 w-24 touch-none rounded-full"
          width={96}
          height={96}
          data-testid={`${testId}-canvas`}
          onPointerDown={(event) => {
            updateFromEvent(event);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              updateFromEvent(event);
            }
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
        />
        <div className="min-w-0 flex-1 space-y-2">
          <RangeNumberField
            label={zhCN.inspector.fields.intensity}
            value={value.intensity}
            min={0}
            max={2}
            step={0.01}
            format={(next) => next.toFixed(2)}
            onCommit={(intensity) => onCommit({ intensity })}
            testId={`${testId}-intensity`}
          />
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <RangeNumberField
          label={zhCN.inspector.fields.red}
          value={value.r}
          min={-1}
          max={1}
          step={0.01}
          format={(next) => next.toFixed(2)}
          onCommit={(r) => onCommit({ r })}
          testId={`${testId}-r`}
        />
        <RangeNumberField
          label={zhCN.inspector.fields.green}
          value={value.g}
          min={-1}
          max={1}
          step={0.01}
          format={(next) => next.toFixed(2)}
          onCommit={(g) => onCommit({ g })}
          testId={`${testId}-g`}
        />
        <RangeNumberField
          label={zhCN.inspector.fields.blue}
          value={value.b}
          min={-1}
          max={1}
          step={0.01}
          format={(next) => next.toFixed(2)}
          onCommit={(b) => onCommit({ b })}
          testId={`${testId}-b`}
        />
      </div>
    </div>
  );
}

function PrivacyBlurPanel({
  effect,
  modelConfigured,
  busy,
  disabled,
  onEffectChange,
  onRun
}: {
  effect: PrivacyBlurEffect;
  modelConfigured: boolean;
  busy: boolean;
  disabled: boolean;
  onEffectChange(effect: PrivacyBlurEffect): void;
  onRun(): void;
}) {
  const t = zhCN.inspector.privacyBlur;
  return (
    <div className="mb-3 space-y-2 rounded-md border border-line bg-panel p-2" data-testid="privacy-blur-panel">
      <div className="text-xs font-semibold text-slate-700">{t.title}</div>
      <label className="block text-xs font-medium text-slate-600">
        {zhCN.inspector.fields.privacyBlurEffect}
        <select
          className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
          value={effect}
          data-testid="privacy-blur-effect-select"
          onChange={(event) => onEffectChange(normalizePrivacyBlurEffect(event.target.value as PrivacyBlurEffect))}
        >
          <option value="pixelize">{t.effects.pixelize}</option>
          <option value="gblur">{t.effects.gblur}</option>
          <option value="solid">{t.effects.solid}</option>
        </select>
      </label>
      {!modelConfigured ? <div className="text-xs font-medium text-amber-700" data-testid="privacy-blur-model-required">{t.modelRequired}</div> : null}
      <button
        className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        disabled={!modelConfigured || busy || disabled}
        data-testid="privacy-blur-detect-button"
        onClick={onRun}
      >
        {busy ? t.running : t.run}
      </button>
    </div>
  );
}

function MasksEditor({
  masks,
  onAdd,
  onUpdate,
  onRemove
}: {
  masks: ClipMask[];
  onAdd(): void;
  onUpdate(maskId: string, patch: MaskPatch): void;
  onRemove(maskId: string): void;
}) {
  return (
    <div className="space-y-3" data-testid="masks-editor">
      <button
        className="flex w-full items-center justify-center gap-2 rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium hover:bg-panel"
        type="button"
        data-testid="add-mask-button"
        onClick={onAdd}
      >
        <Plus size={14} />
        {zhCN.inspector.fields.addMask}
      </button>
      {masks.map((mask, index) => (
        <details key={mask.id} className="rounded-md border border-line bg-panel" open data-testid={`mask-item-${mask.id}`}>
          <summary className="flex cursor-pointer items-center gap-2 px-2 py-2 text-sm font-semibold text-slate-700">
            <span className="min-w-0 flex-1 truncate">{`${zhCN.inspector.sections.masks} ${index + 1}`}</span>
            <label className="flex items-center gap-1 text-xs font-medium text-slate-500" onClick={(event) => event.stopPropagation()}>
              {zhCN.inspector.fields.enabled}
              <input
                className="h-4 w-4 accent-brand"
                type="checkbox"
                checked={mask.enabled}
                data-testid={`mask-enabled-${mask.id}`}
                onChange={(event) => onUpdate(mask.id, { enabled: event.target.checked })}
              />
            </label>
          </summary>
          <div className="space-y-3 border-t border-line p-2">
            <label className="block text-xs font-medium text-slate-600">
              {zhCN.inspector.fields.maskType}
              <select
                className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                value={mask.type}
                data-testid={`mask-type-${mask.id}`}
                onChange={(event) => onUpdate(mask.id, { type: event.target.value as ClipMask['type'] })}
              >
                <option value="rect">{zhCN.inspector.fields.rectMask}</option>
                <option value="ellipse">{zhCN.inspector.fields.ellipseMask}</option>
                <option value="path">{zhCN.inspector.fields.pathMask}</option>
              </select>
            </label>
            {mask.type === 'path' ? (
              <div className="rounded-md border border-dashed border-line bg-white px-2 py-1.5 text-xs text-slate-500" data-testid={`path-mask-help-${mask.id}`}>
                <div>{zhCN.inspector.fields.pathPointCount(Math.max(0, (mask.path?.length ?? 0) - (mask.path && mask.path.length > 1 && mask.path[0].x === mask.path.at(-1)?.x && mask.path[0].y === mask.path.at(-1)?.y ? 1 : 0)))}</div>
                <div>{zhCN.inspector.fields.editPathInPreview}</div>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <RangeNumberField label="X" value={mask.x} min={0} max={1} step={0.01} format={(value) => value.toFixed(2)} onCommit={(x) => onUpdate(mask.id, { x })} testId={`mask-x-${mask.id}`} />
              <RangeNumberField label="Y" value={mask.y} min={0} max={1} step={0.01} format={(value) => value.toFixed(2)} onCommit={(y) => onUpdate(mask.id, { y })} testId={`mask-y-${mask.id}`} />
              <RangeNumberField label="W" value={mask.w} min={0.001} max={1} step={0.01} format={(value) => value.toFixed(2)} onCommit={(w) => onUpdate(mask.id, { w })} testId={`mask-w-${mask.id}`} />
              <RangeNumberField label="H" value={mask.h} min={0.001} max={1} step={0.01} format={(value) => value.toFixed(2)} onCommit={(h) => onUpdate(mask.id, { h })} testId={`mask-h-${mask.id}`} />
            </div>
            <RangeNumberField
              label={zhCN.inspector.fields.feather}
              value={mask.feather}
              min={0}
              max={1}
              step={0.01}
              format={(value) => value.toFixed(2)}
              onCommit={(feather) => onUpdate(mask.id, { feather })}
              testId={`mask-feather-${mask.id}`}
            />
            <ToggleField label={zhCN.inspector.fields.inverted} checked={mask.inverted} onCommit={(inverted) => onUpdate(mask.id, { inverted })} testId={`mask-inverted-${mask.id}`} />
            <div className="space-y-2 rounded-md border border-line bg-white p-2" data-testid={`mask-privacy-blur-${mask.id}`}>
              <ToggleField
                label={zhCN.inspector.fields.privacyBlurEnabled}
                checked={mask.privacyBlur?.enabled === true}
                onCommit={(enabled) =>
                  onUpdate(mask.id, {
                    privacyBlur: {
                      enabled,
                      effect: normalizePrivacyBlurEffect(mask.privacyBlur?.effect),
                      color: mask.privacyBlur?.color
                    }
                  })
                }
                testId={`mask-privacy-blur-enabled-${mask.id}`}
              />
              <label className="block text-xs font-medium text-slate-600">
                {zhCN.inspector.fields.privacyBlurEffect}
                <select
                  className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-60"
                  value={normalizePrivacyBlurEffect(mask.privacyBlur?.effect)}
                  disabled={mask.privacyBlur?.enabled !== true}
                  data-testid={`mask-privacy-blur-effect-${mask.id}`}
                  onChange={(event) =>
                    onUpdate(mask.id, {
                      privacyBlur: {
                        enabled: true,
                        effect: normalizePrivacyBlurEffect(event.target.value as PrivacyBlurEffect),
                        color: mask.privacyBlur?.color
                      }
                    })
                  }
                >
                  <option value="pixelize">{zhCN.inspector.privacyBlur.effects.pixelize}</option>
                  <option value="gblur">{zhCN.inspector.privacyBlur.effects.gblur}</option>
                  <option value="solid">{zhCN.inspector.privacyBlur.effects.solid}</option>
                </select>
              </label>
              {normalizePrivacyBlurEffect(mask.privacyBlur?.effect) === 'solid' ? (
                <label className="block text-xs font-medium text-slate-600">
                  {zhCN.inspector.fields.privacyBlurSolidColor}
                  <input
                    className="mt-1 h-8 w-full rounded-md border border-line bg-white px-2 text-sm text-ink"
                    type="color"
                    value={mask.privacyBlur?.color ?? '#000000'}
                    disabled={mask.privacyBlur?.enabled !== true}
                    data-testid={`mask-privacy-blur-color-${mask.id}`}
                    onChange={(event) =>
                      onUpdate(mask.id, {
                        privacyBlur: {
                          enabled: true,
                          effect: 'solid',
                          color: event.target.value
                        }
                      })
                    }
                  />
                </label>
              ) : null}
            </div>
            <button
              className="flex w-full items-center justify-center gap-2 rounded-md border border-rose-300 bg-white px-2 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50"
              type="button"
              data-testid={`remove-mask-${mask.id}`}
              onClick={() => onRemove(mask.id)}
            >
              <Trash2 size={14} />
              {zhCN.inspector.fields.removeMask}
            </button>
          </div>
        </details>
      ))}
    </div>
  );
}

function EffectsEditor({
  effects,
  onAdd,
  onRemove,
  onUpdate,
  onReorder
}: {
  effects: Effect[];
  onAdd(type: EffectType): void;
  onRemove(effectId: string): void;
  onUpdate(effectId: string, patch: EffectPatch): void;
  onReorder(effectIds: string[]): void;
}) {
  const [selectedType, setSelectedType] = useState<EffectType>('blur');
  const [draggedEffectId, setDraggedEffectId] = useState<string | null>(null);
  const moveEffect = (effectId: string, direction: -1 | 1) => {
    const index = effects.findIndex((effect) => effect.id === effectId);
    const targetIndex = index + direction;
    if (index === -1 || targetIndex < 0 || targetIndex >= effects.length) {
      return;
    }
    const ids = effects.map((effect) => effect.id);
    const [removed] = ids.splice(index, 1);
    ids.splice(targetIndex, 0, removed);
    onReorder(ids);
  };
  const dropEffect = (targetEffectId: string) => {
    if (!draggedEffectId || draggedEffectId === targetEffectId) {
      return;
    }
    const ids = effects.map((effect) => effect.id);
    const from = ids.indexOf(draggedEffectId);
    const to = ids.indexOf(targetEffectId);
    if (from === -1 || to === -1) {
      return;
    }
    const [removed] = ids.splice(from, 1);
    ids.splice(to, 0, removed);
    onReorder(ids);
    setDraggedEffectId(null);
  };

  return (
    <div className="space-y-3 rounded-md border border-line bg-panel p-2" data-testid="effects-editor">
      <div className="flex items-end gap-2">
        <label className="min-w-0 flex-1 text-xs font-medium text-slate-600">
          {zhCN.inspector.fields.effectType}
          <select
            className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
            value={selectedType}
            data-testid="effect-type-select"
            onChange={(event) => setSelectedType(event.target.value as EffectType)}
          >
            {EFFECT_TYPES.map((type) => (
              <option key={type} value={type}>
                {zhCN.inspector.effectNames[type]}
              </option>
            ))}
          </select>
        </label>
        <button
          className="flex h-9 items-center gap-2 rounded-md border border-line bg-white px-2 text-sm font-medium hover:bg-panel"
          type="button"
          data-testid="add-effect-button"
          onClick={() => onAdd(selectedType)}
        >
          <Plus size={14} />
          {zhCN.inspector.fields.addEffect}
        </button>
      </div>
      <div className="space-y-2">
        {effects.map((effect, index) => (
          <details
            key={effect.id}
            className="rounded-md border border-line bg-white"
            open
            data-testid={`effect-item-${effect.type}`}
            draggable
            onDragStart={() => setDraggedEffectId(effect.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => dropEffect(effect.id)}
            onDragEnd={() => setDraggedEffectId(null)}
          >
            <summary className="flex cursor-pointer items-center gap-2 px-2 py-2 text-sm font-semibold text-slate-700">
              <GripVertical size={14} className="shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1 truncate">{zhCN.inspector.effectNames[effect.type]}</span>
              <label className="flex items-center gap-1 text-xs font-medium text-slate-500" onClick={(event) => event.stopPropagation()}>
                {zhCN.inspector.fields.enabled}
                <input
                  className="h-4 w-4 accent-brand"
                  type="checkbox"
                  checked={effect.enabled}
                  data-testid={`effect-enabled-${effect.id}`}
                  onChange={(event) => onUpdate(effect.id, { enabled: event.target.checked })}
                />
              </label>
            </summary>
            <div className="space-y-3 border-t border-line p-2">
              {effect.type === 'audio-spectrum' ? (
                <AudioSpectrumEffectFields effect={effect} onUpdate={onUpdate} />
              ) : effect.type === 'custom-shader' ? (
                <CustomShaderEffectFields effect={effect} onUpdate={onUpdate} />
              ) : (
                getEffectParamConfig(effect.type).map((param) => (
                  <RangeNumberField
                    key={param.key}
                    label={param.label}
                    value={Number(effect.params[param.key] ?? DEFAULT_EFFECT_PARAMS[effect.type][param.key])}
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    format={(value) => value.toFixed(param.step < 1 ? 2 : 0)}
                    onCommit={(value) => onUpdate(effect.id, { params: { [param.key]: value } })}
                    testId={`effect-param-${effect.id}-${param.key}`}
                  />
                ))
              )}
              <div className="flex justify-end gap-2">
                <button
                  className="h-8 w-8 rounded-md border border-line bg-white p-1 hover:bg-panel disabled:opacity-40"
                  type="button"
                  title={zhCN.inspector.fields.moveEffectUp}
                  disabled={index === 0}
                  onClick={() => moveEffect(effect.id, -1)}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  className="h-8 w-8 rounded-md border border-line bg-white p-1 hover:bg-panel disabled:opacity-40"
                  type="button"
                  title={zhCN.inspector.fields.moveEffectDown}
                  disabled={index === effects.length - 1}
                  onClick={() => moveEffect(effect.id, 1)}
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  className="h-8 w-8 rounded-md border border-rose-300 bg-white p-1 text-rose-700 hover:bg-rose-50"
                  type="button"
                  title={zhCN.inspector.fields.removeEffect}
                  data-testid={`remove-effect-${effect.id}`}
                  onClick={() => onRemove(effect.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function TextField({ label, value, onCommit }: { label: string; value: string; onCommit(value: string): void }) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <input className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink" defaultValue={value} onBlur={(event) => onCommit(event.target.value)} />
    </label>
  );
}

function TextAreaField({ label, value, onCommit, testId }: { label: string; value: string; onCommit(value: string): void; testId?: string }) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <textarea className="mt-1 min-h-20 w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink" defaultValue={value} onBlur={(event) => onCommit(event.target.value)} data-testid={testId} />
    </label>
  );
}

function CustomShaderEffectFields({
  effect,
  onUpdate
}: {
  effect: Effect;
  onUpdate(effectId: string, patch: EffectPatch): void;
}) {
  const params = normalizeCustomShaderParams(effect.params);
  const [source, setSource] = useState(params.source);
  const [compileError, setCompileError] = useState<string | undefined>();

  useEffect(() => {
    setSource(params.source);
    setCompileError(undefined);
  }, [effect.id, params.source]);

  const compile = (nextSource: string): boolean => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    if (!gl) {
      setCompileError(zhCN.inspector.customShader.webglUnavailable);
      return false;
    }
    const result = validateCustomShaderSource(gl, nextSource);
    setCompileError(result.ok ? undefined : result.error ?? zhCN.inspector.customShader.compileFailed);
    return result.ok;
  };

  const commitSource = (nextSource: string) => {
    const trimmed = nextSource.trim() || params.source;
    setSource(trimmed);
    if (compile(trimmed)) {
      onUpdate(effect.id, { params: { source: trimmed, preset: 'custom' } });
    }
  };

  const applyExample = (exampleId: string) => {
    const example = CUSTOM_SHADER_EXAMPLES.find((item) => item.id === exampleId);
    if (!example) {
      return;
    }
    setSource(example.source);
    setCompileError(undefined);
    onUpdate(effect.id, { params: { source: example.source, preset: example.id } });
  };

  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium text-slate-600">
        {zhCN.inspector.fields.shaderExample}
        <select
          className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
          value={params.preset}
          data-testid="custom-shader-example-select"
          onChange={(event) => applyExample(event.target.value)}
        >
          {CUSTOM_SHADER_EXAMPLES.map((example) => (
            <option key={example.id} value={example.id}>
              {zhCN.inspector.customShader.examples[example.id]}
            </option>
          ))}
          <option value="custom">{zhCN.inspector.customShader.custom}</option>
        </select>
      </label>
      <label className="block text-xs font-medium text-slate-600">
        {zhCN.inspector.fields.shaderCode}
        <textarea
          className="mt-1 min-h-48 w-full resize-y rounded-md border border-line bg-slate-950 px-2 py-2 font-mono text-xs leading-5 text-slate-50 outline-none focus:ring-2 focus:ring-brand"
          value={source}
          spellCheck={false}
          data-testid={`effect-param-${effect.id}-shader-source`}
          onChange={(event) => {
            setSource(event.target.value);
            if (compileError) {
              setCompileError(undefined);
            }
          }}
          onBlur={(event) => commitSource(event.target.value)}
        />
      </label>
      {compileError ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-2 font-mono text-[11px] leading-4 text-rose-800" data-testid="custom-shader-error">
          {compileError}
        </div>
      ) : null}
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onCommit,
  hideLabel = false,
  testId
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onCommit(value: number): void;
  hideLabel?: boolean;
  testId?: string;
}) {
  const [draft, setDraft] = useState(formatNumberInputValue(value));
  useEffect(() => {
    setDraft(formatNumberInputValue(value));
  }, [value]);
  const commitDraft = () => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(formatNumberInputValue(value));
      return;
    }
    const clamped = Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, parsed));
    setDraft(formatNumberInputValue(clamped));
    onCommit(clamped);
  };
  return (
    <label className="block text-xs font-medium text-slate-600">
      {hideLabel ? <span className="sr-only">{label}</span> : label}
      <input
        className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink"
        type="number"
        value={draft}
        min={min}
        max={max}
        step={step ?? 1}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
        data-testid={testId}
      />
    </label>
  );
}

function AudioSpectrumEffectFields({
  effect,
  onUpdate
}: {
  effect: Effect;
  onUpdate(effectId: string, patch: EffectPatch): void;
}) {
  const params = normalizeAudioSpectrumParams(effect.params);
  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium text-slate-600">
        {zhCN.inspector.fields.style}
        <select
          className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
          value={getEffectStringParam(effect.params, 'style', params.style)}
          data-testid={`effect-param-${effect.id}-style`}
          onChange={(event) => onUpdate(effect.id, { params: { style: event.target.value } })}
        >
          {AUDIO_SPECTRUM_STYLES.map((style) => (
            <option key={style} value={style}>
              {zhCN.inspector.audioSpectrumStyles[style]}
            </option>
          ))}
        </select>
      </label>
      <ColorField
        label={zhCN.inspector.fields.color}
        value={getEffectStringParam(effect.params, 'color', params.color)}
        onCommit={(color) => onUpdate(effect.id, { params: { color } })}
        testId={`effect-param-${effect.id}-color`}
      />
      <RangeNumberField
        label={zhCN.inspector.fields.height}
        value={getEffectNumberParam(effect.params, 'height', params.height)}
        min={0}
        max={50}
        step={1}
        format={(value) => `${Math.round(value)}%`}
        onCommit={(height) => onUpdate(effect.id, { params: { height } })}
        testId={`effect-param-${effect.id}-height`}
      />
      <label className="block text-xs font-medium text-slate-600">
        {zhCN.inspector.fields.position}
        <select
          className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
          value={getEffectStringParam(effect.params, 'position', params.position)}
          data-testid={`effect-param-${effect.id}-position`}
          onChange={(event) => onUpdate(effect.id, { params: { position: event.target.value } })}
        >
          {AUDIO_SPECTRUM_POSITIONS.map((position) => (
            <option key={position} value={position}>
              {zhCN.inspector.audioSpectrumPositions[position]}
            </option>
          ))}
        </select>
      </label>
      <RangeNumberField
        label={zhCN.inspector.fields.sensitivity}
        value={getEffectNumberParam(effect.params, 'sensitivity', params.sensitivity)}
        min={0.1}
        max={4}
        step={0.1}
        format={(value) => value.toFixed(1)}
        onCommit={(sensitivity) => onUpdate(effect.id, { params: { sensitivity } })}
        testId={`effect-param-${effect.id}-sensitivity`}
      />
    </div>
  );
}

function formatNumberInputValue(value: number): string {
  return String(Number(value.toFixed(3)));
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  format,
  onCommit,
  hideLabel = false,
  testId
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format(value: number): string;
  onCommit(value: number): void;
  hideLabel?: boolean;
  testId?: string;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      <span className="flex justify-between">
        <span className={hideLabel ? 'sr-only' : undefined}>{label}</span>
        <span className="tabular-nums">{format(value)}</span>
      </span>
      <input className="mt-1 w-full accent-brand" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onCommit(Number(event.target.value))} data-testid={testId} />
    </label>
  );
}

function RangeNumberField({
  label,
  value,
  min,
  max,
  step,
  format,
  onCommit,
  disabled,
  testId
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format(value: number): string;
  onCommit(value: number): void;
  disabled?: boolean;
  testId?: string;
}) {
  const commitClamped = (nextValue: number) => {
    if (!Number.isFinite(nextValue)) {
      return;
    }
    onCommit(Math.min(max, Math.max(min, nextValue)));
  };
  return (
    <label className="block text-xs font-medium text-slate-600">
      <span className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <input
          className="w-20 rounded-md border border-line px-2 py-1 text-right text-xs tabular-nums text-ink disabled:cursor-not-allowed disabled:opacity-60"
          type="number"
          value={Number(value.toFixed(3))}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) => commitClamped(Number(event.target.value))}
          aria-label={label}
          data-testid={testId}
        />
      </span>
      <span className="mt-1 flex items-center gap-2">
        <input className="min-w-0 flex-1 accent-brand disabled:cursor-not-allowed disabled:opacity-60" type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(event) => commitClamped(Number(event.target.value))} />
        <span className="w-14 text-right text-xs tabular-nums text-slate-500">{format(value)}</span>
      </span>
    </label>
  );
}

function ColorField({ label, value, onCommit, testId }: { label: string; value: string; onCommit(value: string): void; testId?: string }) {
  return (
    <label className="flex items-center justify-between text-xs font-medium text-slate-600">
      {label}
      <input className="h-8 w-12 rounded border border-line" type="color" value={value} onChange={(event) => onCommit(event.target.value)} data-testid={testId} />
    </label>
  );
}

function ToggleField({ label, checked, disabled, onCommit, testId }: { label: string; checked: boolean; disabled?: boolean; onCommit(value: boolean): void; testId?: string }) {
  return (
    <label className="flex items-center justify-between text-xs font-medium text-slate-600">
      {label}
      <input className="h-4 w-4 accent-brand disabled:cursor-not-allowed disabled:opacity-60" type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onCommit(event.target.checked)} data-testid={testId} />
    </label>
  );
}

function drawCurveCanvas(canvas: HTMLCanvasElement, points: CurvePoint[], strokeColor: string): void {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#0f172a';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = 'rgba(148, 163, 184, 0.28)';
  context.lineWidth = 1;
  for (let index = 0; index <= 4; index += 1) {
    const position = (index / 4) * width;
    context.beginPath();
    context.moveTo(position, 0);
    context.lineTo(position, height);
    context.moveTo(0, position);
    context.lineTo(width, position);
    context.stroke();
  }
  context.strokeStyle = 'rgba(255, 255, 255, 0.24)';
  context.beginPath();
  context.moveTo(0, height);
  context.lineTo(width, 0);
  context.stroke();

  context.strokeStyle = strokeColor;
  context.lineWidth = 2;
  context.beginPath();
  for (let x = 0; x < width; x += 1) {
    const sampleX = x / (width - 1);
    const sampleY = sampleCurve(points, sampleX);
    const y = (1 - sampleY) * (height - 1);
    if (x === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.stroke();

  for (const point of normalizeCurvePoints(points)) {
    const x = point.x * width;
    const y = (1 - point.y) * height;
    context.beginPath();
    context.fillStyle = '#ffffff';
    context.arc(x, y, 4, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = strokeColor;
    context.lineWidth = 2;
    context.stroke();
  }
}

function eventToCurvePoint(event: { clientX: number; clientY: number }, canvas: HTMLCanvasElement): CurvePoint {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clampUnit((event.clientX - rect.left) / rect.width),
    y: clampUnit(1 - (event.clientY - rect.top) / rect.height)
  };
}

function findNearestCurvePoint(points: CurvePoint[], point: CurvePoint, maxDistance: number): number | null {
  let nearestIndex: number | null = null;
  let nearestDistance = maxDistance;
  points.forEach((candidate, index) => {
    const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
    if (distance <= nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });
  return nearestIndex;
}

function drawColorWheel(canvas: HTMLCanvasElement, value: ColorWheelValue): void {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  const size = canvas.width;
  const radius = size / 2;
  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x + 0.5 - radius) / radius;
      const dy = (y + 0.5 - radius) / radius;
      const distance = Math.hypot(dx, dy);
      const offset = (y * size + x) * 4;
      if (distance > 1) {
        image.data[offset + 3] = 0;
        continue;
      }
      const hue = ((Math.atan2(dy, dx) / (Math.PI * 2)) + 1) % 1;
      const rgb = hsvToRgb(hue, distance, 1);
      image.data[offset] = Math.round(rgb.r * 255);
      image.data[offset + 1] = Math.round(rgb.g * 255);
      image.data[offset + 2] = Math.round(rgb.b * 255);
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const marker = wheelOffsetsToPoint(value);
  context.beginPath();
  context.arc(radius + marker.x * radius, radius + marker.y * radius, 5, 0, Math.PI * 2);
  context.fillStyle = '#ffffff';
  context.fill();
  context.strokeStyle = '#0f172a';
  context.lineWidth = 2;
  context.stroke();
}

function eventToUnitPoint(event: { clientX: number; clientY: number }, canvas: HTMLCanvasElement): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
  const length = Math.hypot(x, y);
  if (length <= 1) {
    return { x, y };
  }
  return { x: x / length, y: y / length };
}

function wheelPointToOffsets(point: { x: number; y: number }): Pick<ColorWheelValue, 'r' | 'g' | 'b'> {
  return {
    r: clampSigned(point.x),
    g: clampSigned(-0.5 * point.x - 0.8660254 * point.y),
    b: clampSigned(-0.5 * point.x + 0.8660254 * point.y)
  };
}

function wheelOffsetsToPoint(value: ColorWheelValue): { x: number; y: number } {
  const x = value.r;
  const y = (value.b - value.g) / 1.7320508;
  const length = Math.hypot(x, y);
  if (length <= 1) {
    return { x, y };
  }
  return { x: x / length, y: y / length };
}

function hsvToRgb(hue: number, saturation: number, value: number): { r: number; g: number; b: number } {
  const sector = Math.floor(hue * 6);
  const fraction = hue * 6 - sector;
  const p = value * (1 - saturation);
  const q = value * (1 - fraction * saturation);
  const t = value * (1 - (1 - fraction) * saturation);
  switch (sector % 6) {
    case 0:
      return { r: value, g: t, b: p };
    case 1:
      return { r: q, g: value, b: p };
    case 2:
      return { r: p, g: value, b: t };
    case 3:
      return { r: p, g: q, b: value };
    case 4:
      return { r: t, g: p, b: value };
    default:
      return { r: value, g: p, b: q };
  }
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function clampSigned(value: number): number {
  return Math.min(1, Math.max(-1, Number.isFinite(value) ? value : 0));
}

function rgbToHex(color: readonly number[]): string {
  return `#${[color[0], color[1], color[2]].map((channel) => Math.round(Math.min(255, Math.max(0, channel))).toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgb(value: string): [number, number, number] {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(value.trim());
  const hex = match ? match[1] : '00ff00';
  return [Number.parseInt(hex.slice(0, 2), 16), Number.parseInt(hex.slice(2, 4), 16), Number.parseInt(hex.slice(4, 6), 16)];
}

function getEffectParamConfig(type: EffectType): Array<{ key: string; label: string; min: number; max: number; step: number }> {
  if (type === 'blur') {
    return [{ key: 'radius', label: zhCN.inspector.fields.radius, min: 1, max: 50, step: 1 }];
  }
  if (type === 'sharpen') {
    return [{ key: 'strength', label: zhCN.inspector.fields.strength, min: 0, max: 3, step: 0.05 }];
  }
  if (type === 'vignette') {
    return [
      { key: 'intensity', label: zhCN.inspector.fields.intensity, min: 0, max: 1, step: 0.01 },
      { key: 'radius', label: zhCN.inspector.fields.radius, min: 0, max: 1, step: 0.01 }
    ];
  }
  if (type === 'film-grain') {
    return [
      { key: 'strength', label: zhCN.inspector.fields.strength, min: 0, max: 1, step: 0.01 },
      { key: 'size', label: zhCN.inspector.fields.size, min: 1, max: 5, step: 1 }
    ];
  }
  return [{ key: 'strength', label: zhCN.inspector.fields.strength, min: 0, max: 20, step: 1 }];
}

function formatLutPath(path: string | null | undefined): string {
  if (!path) {
    return zhCN.inspector.fields.noLutLoaded;
  }
  return path.split(/[\\/]/).at(-1) ?? path;
}

function formatInputColorSpaceLabel(colorSpace: InputColorSpace): string {
  return zhCN.inspector.inputColorSpaces[colorSpace];
}

function AnimatedField({ label, children, onAddKeyframe, testId }: { label: string; children: ReactNode; onAddKeyframe(): void; testId?: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-end gap-2">
      <div>
        <div className="mb-1 text-xs font-medium text-slate-600">{label}</div>
        {children}
      </div>
      <button
        className="mb-0.5 h-8 w-8 rounded-md border border-line bg-white text-xs font-semibold text-brand hover:bg-panel"
        type="button"
        title={zhCN.inspector.addKeyframeTitle(label)}
        data-testid={testId ?? `add-${label.toLowerCase()}-keyframe-button`}
        onClick={onAddKeyframe}
      >
        ◆
      </button>
    </div>
  );
}

function getKenBurnsEndScale(clip: Extract<Clip, { type: 'image' }>): number {
  return clip.keyframes?.scaleX?.at(-1)?.value ?? clip.transform.scale;
}

function formatKeyframeProperty(property: KeyframeProperty): string {
  return zhCN.inspector.keyframeProperty[property] ?? property;
}

function formatKeyframeValue(property: KeyframeProperty, value: number): string {
  if (property === 'speed') {
    return `${value.toFixed(2)}x`;
  }
  if (property === 'opacity' || property === 'volume' || property === 'scaleX' || property === 'scaleY' || property === 'pathStartOffset') {
    return `${Math.round(value * 100)}%`;
  }
  if (property === 'yaw' || property === 'pitch' || property === 'roll') {
    return `${Math.round(value)}°`;
  }
  return value.toFixed(2);
}

function resolveSelectedKeyframeEntries(
  project: Project,
  refs: SelectedKeyframeRef[]
): Array<{ ref: SelectedKeyframeRef; clip: Clip; frame: Keyframe<number> }> {
  const clips = project.timeline.tracks.flatMap((track) => track.clips);
  const seen = new Set<string>();
  return refs.flatMap((ref) => {
    const key = `${ref.clipId}\0${ref.property}\0${ref.keyframeId}`;
    if (seen.has(key)) {
      return [];
    }
    seen.add(key);
    const clip = clips.find((item) => item.id === ref.clipId);
    const frame = clip?.keyframes?.[ref.property]?.find((item) => item.id === ref.keyframeId);
    return clip && frame ? [{ ref, clip, frame }] : [];
  });
}
