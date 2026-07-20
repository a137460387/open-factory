import { useEffect, useMemo, useState } from 'react';
import type { Clip, MediaAsset, Project, ProjectSettings, ProjectSpeaker } from '@open-factory/editor-core';
import {
  AddSubtitleClipCommand,
  AddTrackCommand,
  AddKeyframeCommand,
  AddMaskCommand,
  BatchKeyframeEditCommand,
  BatchUpdateKeyframeCommand,
  ApplyTextAnimationCommand,
  UpdateSubtitleStyleCommand,
  UpdateProjectSpeakersCommand,
  UpdateTrackCommand,
  BUILTIN_SUBTITLE_STYLE_TEMPLATES,
  DEFAULT_SPATIAL_AUDIO,
  SPATIAL_AUDIO_ROOM_MODELS,
  KEYFRAME_PROPERTY_LIMITS,
  MAX_CHROMA_KEY_COLORS,
  RemoveMaskCommand,
  RemoveKeyframeCommand,
  UpdateKeyframeCommand,
  UpdateClipCommand,
  UpdateMaskCommand,
  bindMotionTrackToPositionKeyframes,
  createId,
  createKenBurnsKeyframes,
  getClipSpeed,
  getClipKeyframeValue,
  normalizeAudioFadeCurve,
  normalizeAudioFadeDuration,
  normalizeAudioDenoise,
  normalizeAudioRestoration,
  normalizeAudioPitchSemitones,
  normalizeSpatialAudio,
  normalizeChromaKey,
  normalizeClipBlendMode,
  normalizeClipPanoramaView,
  normalizeClipProjection,
  normalizeColorCurves,
  normalizeColorCorrection,
  normalizeFrameInterpolation,
  normalizeMasks,
  normalizeMotionTrack,
  normalizePrivacyRedactions,
  normalizeSlowMotionMode,
  normalizeStabilization,
  normalizeTextArc,
  normalizeTextLayout,
  normalizeTextOpenTypeFeatures,
  normalizeTextPath,
  normalizeThreeWayColor,
  normalizeVideoRestoration,
  normalizeProjectSpeakers,
  normalizeQualityEnhancement,
  parseDataSubtitleRows,
  secondsToTimecode,
  setKenBurnsEndScaleKeyframes,
  summarizePitchData,
  suggestDeinterlaceMode,
  buildPrivacyMasksFromDetections,
  buildAudioRestorationWaveformComparison,
  frameInterpolationCachePath,
  createTrack,
  mapSsimToFrameInterpolationQualityGrade,
  parseKeyframeExpression,
  type AudioFadeCurve,
  type AudioChannelRoutingMode,
  type BatchKeyframeEditOperation,
  type ChromaKeyMode,
  type ChromaKeyColor,
  type ClipPatch,
  type ClipBlendMode,
  type ClipProjection,
  type ColorCurves,
  type DataSubtitleSource,
  type DataSubtitleSourceType,
  type Keyframe,
  type KeyframeEasing,
  type KeyframeProperty,
  type ClipSlowMotionMode,
  type MaskPatch,
  type PrivacyBlurEffect,
  type SpatialAudioDistance,
  type SpatialAudioRenderMode,
  type SpatialAudioRoomModel,
  type TextAnimationDirection,
  type TextAnimationPreset,
  type ThreeWayColor,
  type VideoDeinterlaceMode,
  type SubtitleStyleTemplate,
  type TextArcOptions,
  type FrameInterpolationCompareMode,
  type TextLayoutOptions,
  type TextOpenTypeFeatures,
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { commandManager, projectAccessor, timelineAccessor } from '../../store/commandManager';
import {
  analyzeClip,
  analyzeMotionTrack,
  bridgeConfirm,
  cancelMotionTracking,
  cancelAudioNoiseReduction,
  detectPrivacyRegions,
  evaluateExportQuality,
  convertLocalFileSrc,
  getAppDataDir,
  getFfmpegCapabilities,
  listenBridge,
  openFileDialog,
  processAudioNoiseReduction,
  readFile,
  runExportPreviewSamples,
  type ClipAnalysisProgressEvent,
  type MotionTrackProgressEvent,
  type NoiseReductionProgressEvent,
} from '../../lib/tauri-bridge';
import {
  buildFrameInterpolationComparePreviewPlan,
  FRAME_INTERPOLATION_COMPARE_TIMEOUT_MS,
} from '../../lib/frameInterpolationComparePreview';
import { buildClipColorMatchCurves } from '../../lib/colorMatch';
import {
  acceptTranslationTOS,
  subtitleClipsToTranslationItems,
  translateSubtitleItems,
} from '../../lib/subtitleTranslation';
import {
  deleteCustomSubtitleStyleTemplate,
  loadSubtitleStyleTemplates,
  saveCustomSubtitleStyleTemplate,
} from '../../lib/subtitleStyleTemplates';
import {
  addSharedLibraryResource,
  loadSharedSubtitleStyleTemplates,
  subtitleStyleTemplateToSharedResource,
} from '../../shared-library/sharedLibrary';
import { showToast } from '../../lib/toast';
import { markLocalAiModelUsed } from '../../settings/appSettings';
import { useEditorStore, type SelectedKeyframeRef } from '../../store/editorStore';
import { usePrivacyDetectionSettingsStore } from '../../store/privacyDetectionSettingsStore';
import {
  isTranslationConfigured,
  useTranslationSettingsStore,
  type TranslationProvider,
} from '../../store/translationSettingsStore';
import { analyzeClipPitch, exportClipPitchCsv } from '../../media/pitchAnalysis';
import {
  buildAudioRestorationPreviewPeaks,
  mergeSubtitleStyleTemplateViews,
  getSubtitleStyleTemplateLabel,
  resolveSelectedKeyframeEntries,
  joinLocalPath,
  rgbToHex,
  hexToRgb,
  type FrameInterpolationComparePreviewViewItem,
} from './InspectorEditors';

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------

export interface ClipInspectorStateParams {
  clip: Clip;
  selectedClipLocked: boolean;
  selectedKeyframe?: SelectedKeyframeRef;
  selectedKeyframes?: SelectedKeyframeRef[];
  media: MediaAsset[];
  playheadTime: number;
  projectSettings: ProjectSettings;
  selectedSubtitleClips: Array<Extract<Clip, { type: 'subtitle' }>>;
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface ClipInspectorStateReturn {
  // -- Store subscriptions --------------------------------------------------
  project: Project;
  setSelectedClipIds: (ids: string[]) => void;
  setSelectedKeyframes: (keyframes: SelectedKeyframeRef[]) => void;
  chromaKeyPickClipId: string | undefined;
  setChromaKeyPickClipId: (id: string | undefined) => void;
  translationProvider: string;
  translationApiKey: string;
  translationApiKeyError: string | undefined;
  translationTargetLanguage: string;
  loadTranslationApiKey: () => Promise<void>;
  privacyDetectionModelPath: string;

  // -- useMemo values -------------------------------------------------------
  allTimelineSubtitleClips: Array<Extract<Clip, { type: 'subtitle' }>>;
  translationSettings: { provider: TranslationProvider; apiKey: string; targetLanguage: string };
  projectSpeakers: ProjectSpeaker[];
  soundDescriptionOptions: string[];
  colorMatchReferenceClips: Clip[];
  selectedKeyframeEntries: ReturnType<typeof resolveSelectedKeyframeEntries>;
  keyframeProperties: KeyframeProperty[];
  pitchSummary: ReturnType<typeof summarizePitchData>;

  // -- useState values ------------------------------------------------------
  analysisProgress: number | undefined;
  setAnalysisProgress: React.Dispatch<React.SetStateAction<number | undefined>>;
  motionTrackProgress: number | undefined;
  setMotionTrackProgress: React.Dispatch<React.SetStateAction<number | undefined>>;
  motionTrackingBusy: boolean;
  setMotionTrackingBusy: React.Dispatch<React.SetStateAction<boolean>>;
  privacyBlurBusy: boolean;
  setPrivacyBlurBusy: React.Dispatch<React.SetStateAction<boolean>>;
  batchShiftSeconds: number;
  setBatchShiftSeconds: React.Dispatch<React.SetStateAction<number>>;
  batchScaleFactor: number;
  setBatchScaleFactor: React.Dispatch<React.SetStateAction<number>>;
  batchEasing: KeyframeEasing;
  setBatchEasing: React.Dispatch<React.SetStateAction<KeyframeEasing>>;
  curveProperty: KeyframeProperty;
  setCurveProperty: React.Dispatch<React.SetStateAction<KeyframeProperty>>;
  privacyBlurEffect: PrivacyBlurEffect;
  setPrivacyBlurEffect: React.Dispatch<React.SetStateAction<PrivacyBlurEffect>>;
  frameInterpolationSupported: boolean | undefined;
  setFrameInterpolationSupported: React.Dispatch<React.SetStateAction<boolean | undefined>>;
  frameInterpolationCompareRunning: boolean;
  setFrameInterpolationCompareRunning: React.Dispatch<React.SetStateAction<boolean>>;
  frameInterpolationCompareItems: FrameInterpolationComparePreviewViewItem[];
  setFrameInterpolationCompareItems: React.Dispatch<React.SetStateAction<FrameInterpolationComparePreviewViewItem[]>>;
  frameInterpolationCompareError: string | undefined;
  setFrameInterpolationCompareError: React.Dispatch<React.SetStateAction<string | undefined>>;
  frameInterpolationExpandedMode: FrameInterpolationCompareMode | undefined;
  setFrameInterpolationExpandedMode: React.Dispatch<React.SetStateAction<FrameInterpolationCompareMode | undefined>>;
  frameInterpolationQualityRunning: boolean;
  setFrameInterpolationQualityRunning: React.Dispatch<React.SetStateAction<boolean>>;
  frameInterpolationQualityError: string | undefined;
  setFrameInterpolationQualityError: React.Dispatch<React.SetStateAction<string | undefined>>;
  audioDenoiseSupported: boolean | undefined;
  setAudioDenoiseSupported: React.Dispatch<React.SetStateAction<boolean | undefined>>;
  aiLocalDenoiseProcessing: boolean;
  setAiLocalDenoiseProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  aiLocalDenoiseProgress: number;
  setAiLocalDenoiseProgress: React.Dispatch<React.SetStateAction<number>>;
  aiLocalDenoiseStage: string;
  setAiLocalDenoiseStage: React.Dispatch<React.SetStateAction<string>>;
  aiLocalDenoiseResult: { outputPath: string; noiseReductionDb: number } | null;
  setAiLocalDenoiseResult: React.Dispatch<
    React.SetStateAction<{ outputPath: string; noiseReductionDb: number } | null>
  >;
  colorMatchReferenceClipId: string;
  setColorMatchReferenceClipId: React.Dispatch<React.SetStateAction<string>>;
  colorMatchBusy: boolean;
  setColorMatchBusy: React.Dispatch<React.SetStateAction<boolean>>;
  subtitleTranslationProgress: { completed: number; total: number } | undefined;
  setSubtitleTranslationProgress: React.Dispatch<
    React.SetStateAction<{ completed: number; total: number } | undefined>
  >;
  subtitleStyleTemplates: SubtitleStyleTemplate[];
  setSubtitleStyleTemplates: React.Dispatch<React.SetStateAction<SubtitleStyleTemplate[]>>;
  customSoundDescOpen: boolean;
  setCustomSoundDescOpen: React.Dispatch<React.SetStateAction<boolean>>;
  pitchAnalyzing: boolean;
  setPitchAnalyzing: React.Dispatch<React.SetStateAction<boolean>>;
  textAnimationPreset: TextAnimationPreset;
  setTextAnimationPreset: React.Dispatch<React.SetStateAction<TextAnimationPreset>>;
  textAnimationDuration: number;
  setTextAnimationDuration: React.Dispatch<React.SetStateAction<number>>;
  textAnimationDirection: TextAnimationDirection;
  setTextAnimationDirection: React.Dispatch<React.SetStateAction<TextAnimationDirection>>;

  // -- Computed (non-memo) values -------------------------------------------
  asset: MediaAsset | undefined;
  clipStartTimecode: string;
  clipDurationTimecode: string;
  assetDurationTimecode: string | undefined;
  subtitleTrack: Project['timeline']['tracks'][number] | undefined;
  subtitleType: 'subtitle' | 'cc';
  activeSpeaker: string;
  activeSpeakerEntry: ProjectSpeaker | undefined;
  soundDescSelectValue: string;
  localKeyframeTime: number;
  textPath: ReturnType<typeof normalizeTextPath> | undefined;
  textLayout: TextLayoutOptions | undefined;
  textOpenTypeFeatures: TextOpenTypeFeatures | undefined;
  textArc: TextArcOptions | undefined;
  colorCorrection: ReturnType<typeof normalizeColorCorrection>;
  chromaKey: ReturnType<typeof normalizeChromaKey>;
  keyingMode: ChromaKeyMode | 'none';
  chromaKeyPickActive: boolean;
  stabilization: ReturnType<typeof normalizeStabilization>;
  frameInterpolation: ReturnType<typeof normalizeFrameInterpolation>;
  frameInterpolationUnavailable: boolean;
  slowMotionMode: ReturnType<typeof normalizeSlowMotionMode>;
  frameInterpolationExpandedItem: FrameInterpolationComparePreviewViewItem | undefined;
  showSlowMotionMode: boolean;
  audioDenoise: ReturnType<typeof normalizeAudioDenoise>;
  audioDenoiseUnavailable: boolean;
  audioRestoration: ReturnType<typeof normalizeAudioRestoration>;
  audioRestorationComparison: ReturnType<typeof buildAudioRestorationWaveformComparison>;
  blendMode: ReturnType<typeof normalizeClipBlendMode>;
  projection: ReturnType<typeof normalizeClipProjection>;
  panorama: ReturnType<typeof normalizeClipPanoramaView>;
  videoRestoration: ReturnType<typeof normalizeVideoRestoration>;
  qualityEnhancement: ReturnType<typeof normalizeQualityEnhancement>;
  deinterlaceSuggestion: VideoDeinterlaceMode | null;
  audioPitchSemitones: number;
  reverseAudio: boolean;
  fadeInDuration: number;
  fadeOutDuration: number;
  fadeInCurve: AudioFadeCurve;
  fadeOutCurve: AudioFadeCurve;
  spatialAudio: ReturnType<typeof normalizeSpatialAudio>;
  spatialRenderModeOptions: SpatialAudioRenderMode[];
  spatialDistanceOptions: SpatialAudioDistance[];
  spatialRoomOptions: SpatialAudioRoomModel[];
  audioChannelRouting: AudioChannelRoutingMode;
  audioChannelRoutingOptions: AudioChannelRoutingMode[];
  masks: ReturnType<typeof normalizeMasks>;
  privacyRedactions: ReturnType<typeof normalizePrivacyRedactions>;
  motionTrack: NonNullable<ReturnType<typeof normalizeMotionTrack>>;
  colorCurves: ColorCurves;
  threeWayColor: ThreeWayColor;
  selectedKeyframeFrame: Keyframe<number> | undefined;
  selectedKeyframeRefs: SelectedKeyframeRef[];
  batchKeyframesSelected: boolean;
  textAnimationKeyframeCount: number;

  // -- Handlers -------------------------------------------------------------
  commit: (patch: ClipPatch) => void;
  runFrameInterpolationComparePreview: () => Promise<void>;
  runFrameInterpolationQualityEvaluation: () => Promise<void>;
  commitSubtitleType: (nextType: 'subtitle' | 'cc') => void;
  commitCcSpeaker: (speaker: string) => void;
  commitCcSoundDesc: (soundDesc?: string) => void;
  updateProjectSpeakers: (speakers: ProjectSpeaker[]) => void;
  addActiveSpeakerToLibrary: () => void;
  removeActiveSpeakerFromLibrary: () => void;
  updateActiveSpeakerColor: (color: string) => void;
  runEffectCommand: (command: Parameters<typeof commandManager.execute>[0]) => void;
  chooseLut: () => Promise<void>;
  updateTextPath: (patch: Partial<NonNullable<ReturnType<typeof normalizeTextPath>>>) => void;
  updateTextLayout: (patch: Partial<TextLayoutOptions>) => void;
  updateTextOpenTypeFeatures: (patch: Partial<TextOpenTypeFeatures>) => void;
  updateTextArc: (patch: Partial<TextArcOptions>) => void;
  addKeyframe: (property: KeyframeProperty, value?: number) => void;
  setKenBurns: (enabled: boolean) => void;
  updateKenBurnsEndScale: (scale: number) => void;
  updatePanorama: (patch: Partial<ReturnType<typeof normalizeClipPanoramaView>>) => void;
  updateVideoRestoration: (patch: Partial<ReturnType<typeof normalizeVideoRestoration>>) => void;
  updateQualityEnhancement: (patch: Partial<ReturnType<typeof normalizeQualityEnhancement>>) => void;
  updateAudioRestoration: (patch: Partial<ReturnType<typeof normalizeAudioRestoration>>) => void;
  commitChromaKeyColors: (colors: ChromaKeyColor[]) => void;
  updateChromaKeyColor: (index: number, color: ChromaKeyColor) => void;
  addChromaKeyColor: () => void;
  removeChromaKeyColor: (index: number) => void;
  toggleChromaKeyPicker: () => void;
  runStabilizationAnalysis: () => Promise<void>;
  runMotionTrackAnalysis: () => Promise<void>;
  cancelMotionTrackAnalysis: () => Promise<void>;
  bindMotionTrackKeyframes: () => void;
  bindDataSubtitleSource: () => Promise<void>;
  updateDataSubtitleTemplate: (template: string) => void;
  clearDataSubtitleSource: () => void;
  runPitchAnalysis: () => Promise<void>;
  exportPitchCsv: () => Promise<void>;
  updateSelectedKeyframe: (
    patch: Partial<Pick<Keyframe<number>, 'time' | 'value' | 'easing' | 'inHandle' | 'outHandle' | 'handleMode'>>,
  ) => void;
  removeSelectedKeyframe: () => void;
  runBatchKeyframeEdit: (operation: BatchKeyframeEditOperation, clearAfter?: boolean) => void;
  shiftSelectedKeyframes: () => void;
  scaleSelectedKeyframes: () => void;
  updateSelectedKeyframeEasing: () => void;
  distributeSelectedKeyframes: () => void;
  alignSelectedKeyframeValues: () => void;
  deleteSelectedKeyframes: () => void;
  updateSelectedKeyframeExpression: (field: 'time' | 'value', expression: string) => void;
  updateCurveKeyframes: (property: KeyframeProperty, frames: Keyframe<number>[]) => void;
  addMask: () => void;
  updateMask: (maskId: string, patch: MaskPatch) => void;
  removeMask: (maskId: string) => void;
  runPrivacyBlurDetection: () => Promise<void>;
  applyTextAnimation: () => void;
  applyColorMatch: () => Promise<void>;
  translateSubtitleTrack: () => Promise<void>;
  applySubtitleStyleTemplate: (template: SubtitleStyleTemplate) => void;
  saveCurrentSubtitleStyleTemplate: () => Promise<void>;
  deleteSubtitleStyleTemplate: (templateId: string) => Promise<void>;
  addSubtitleStyleTemplateToSharedLibrary: (template: SubtitleStyleTemplate) => Promise<void>;
}

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
  const [frameInterpolationCompareRunning, setFrameInterpolationCompareRunning] = useState(false);
  const [frameInterpolationCompareItems, setFrameInterpolationCompareItems] = useState<
    FrameInterpolationComparePreviewViewItem[]
  >([]);
  const [frameInterpolationCompareError, setFrameInterpolationCompareError] = useState<string>();
  const [frameInterpolationExpandedMode, setFrameInterpolationExpandedMode] = useState<FrameInterpolationCompareMode>();
  const [frameInterpolationQualityRunning, setFrameInterpolationQualityRunning] = useState(false);
  const [frameInterpolationQualityError, setFrameInterpolationQualityError] = useState<string>();
  const [audioDenoiseSupported, setAudioDenoiseSupported] = useState<boolean | undefined>();
  const [aiLocalDenoiseProcessing, setAiLocalDenoiseProcessing] = useState(false);
  const [aiLocalDenoiseProgress, setAiLocalDenoiseProgress] = useState(0);
  const [aiLocalDenoiseStage, setAiLocalDenoiseStage] = useState('');
  const [aiLocalDenoiseResult, setAiLocalDenoiseResult] = useState<{
    outputPath: string;
    noiseReductionDb: number;
  } | null>(null);
  const [colorMatchReferenceClipId, setColorMatchReferenceClipId] = useState<string>('');
  const [colorMatchBusy, setColorMatchBusy] = useState(false);
  const [subtitleTranslationProgress, setSubtitleTranslationProgress] = useState<{
    completed: number;
    total: number;
  }>();
  const [subtitleStyleTemplates, setSubtitleStyleTemplates] = useState<SubtitleStyleTemplate[]>(
    BUILTIN_SUBTITLE_STYLE_TEMPLATES,
  );
  const [customSoundDescOpen, setCustomSoundDescOpen] = useState(false);
  const [pitchAnalyzing, setPitchAnalyzing] = useState(false);
  const [textAnimationPreset, setTextAnimationPreset] = useState<TextAnimationPreset>('fade');
  const [textAnimationDuration, setTextAnimationDuration] = useState(0.5);
  const [textAnimationDirection, setTextAnimationDirection] = useState<TextAnimationDirection>('in');
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
  useEffect(() => {
    setFrameInterpolationCompareItems([]);
    setFrameInterpolationCompareError(undefined);
    setFrameInterpolationQualityError(undefined);
    setFrameInterpolationExpandedMode(undefined);
  }, [clip.id]);

  const runFrameInterpolationComparePreview = async () => {
    if (clip.type !== 'video' || !asset) {
      setFrameInterpolationCompareError(zhCN.inspector.frameInterpolationCompare.missingMedia);
      return;
    }
    setFrameInterpolationCompareRunning(true);
    setFrameInterpolationCompareError(undefined);
    setFrameInterpolationExpandedMode(undefined);
    try {
      const outputDir = joinLocalPath(await getAppDataDir(), 'frame-interpolation-preview');
      const plan = buildFrameInterpolationComparePreviewPlan(
        project,
        clip,
        asset,
        playheadTime,
        outputDir,
        zhCN.inspector.frameInterpolationCompare.modes,
      );
      const result = await runExportPreviewSamples({
        samples: plan.samples,
        timeoutMs: FRAME_INTERPOLATION_COMPARE_TIMEOUT_MS,
      });
      const resultById = new Map(result.samples.map((sample) => [sample.id, sample]));
      setFrameInterpolationCompareItems(
        plan.items.map((item) => {
          const sample = resultById.get(`frame-interpolation-${item.mode}`);
          const outputPath = sample?.path ?? item.outputPath;
          return {
            mode: item.mode,
            label: item.label,
            outputPath,
            src: convertLocalFileSrc(outputPath),
            estimatedMs: item.estimatedMs,
            slowMotionMode: item.slowMotionMode,
          };
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : zhCN.inspector.frameInterpolationCompare.failedMessage;
      setFrameInterpolationCompareError(message);
      showToast({ kind: 'warning', title: zhCN.inspector.frameInterpolationCompare.failedTitle, message });
    } finally {
      setFrameInterpolationCompareRunning(false);
    }
  };
  const runFrameInterpolationQualityEvaluation = async () => {
    if (clip.type !== 'video' || !asset?.path) {
      setFrameInterpolationQualityError(zhCN.inspector.frameInterpolationCompare.missingMedia);
      return;
    }
    setFrameInterpolationQualityRunning(true);
    setFrameInterpolationQualityError(undefined);
    try {
      const appDataDir = await getAppDataDir();
      const outputDir = frameInterpolationCachePath(appDataDir, asset.path, frameInterpolation);
      const plan = buildFrameInterpolationComparePreviewPlan(
        project,
        clip,
        asset,
        playheadTime,
        outputDir,
        zhCN.inspector.frameInterpolationCompare.modes,
      );
      const preview = await runExportPreviewSamples({
        samples: plan.samples,
        timeoutMs: FRAME_INTERPOLATION_COMPARE_TIMEOUT_MS,
      });
      const samplesById = new Map(preview.samples.map((sample) => [sample.id, sample]));
      const selectedMode =
        frameInterpolation.mode === 'adaptive'
          ? 'mci'
          : frameInterpolation.mode === 'copy'
            ? 'original'
            : frameInterpolation.mode;
      const baseline = samplesById.get('frame-interpolation-blend') ?? samplesById.get('frame-interpolation-original');
      const candidate =
        samplesById.get(`frame-interpolation-${selectedMode}`) ??
        samplesById.get('frame-interpolation-mci') ??
        baseline;
      if (!baseline || !candidate) {
        throw new Error(zhCN.inspector.frameInterpolationCompare.failedMessage);
      }
      const result = await evaluateExportQuality({
        taskId: `frame-interpolation-quality-${clip.id}`,
        sourcePath: baseline.path,
        outputPath: candidate.path,
        duration: clip.duration,
      });
      const ssim = Number.isFinite(result.ssim) ? result.ssim! : 0;
      commit({
        frameInterpolation: {
          ...frameInterpolation,
          quality: {
            ssim,
            grade: mapSsimToFrameInterpolationQualityGrade(ssim),
            sampleCount: 10,
            evaluatedAt: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : zhCN.inspector.frameInterpolationCompare.failedMessage;
      setFrameInterpolationQualityError(message);
      showToast({ kind: 'warning', title: zhCN.inspector.frameInterpolationCompare.qualityFailedTitle, message });
    } finally {
      setFrameInterpolationQualityRunning(false);
    }
  };
  const commitSubtitleType = (nextType: 'subtitle' | 'cc') => {
    if (clip.type !== 'subtitle') {
      return;
    }
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
      showToast({
        kind: 'warning',
        title: zhCN.inspector.propertyRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage,
      });
    }
  };
  const commitCcSpeaker = (speaker: string) => {
    try {
      commandManager.execute(new UpdateClipCommand(timelineAccessor, clip.id, { subtitleType: 'cc', speaker }));
      if (subtitleTrack?.subtitleType !== 'cc') {
        commandManager.execute(new UpdateTrackCommand(timelineAccessor, clip.trackId, { subtitleType: 'cc' }));
      }
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.propertyRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage,
      });
    }
  };
  const commitCcSoundDesc = (soundDesc?: string) => {
    try {
      commandManager.execute(new UpdateClipCommand(timelineAccessor, clip.id, { subtitleType: 'cc', soundDesc }));
      if (subtitleTrack?.subtitleType !== 'cc') {
        commandManager.execute(new UpdateTrackCommand(timelineAccessor, clip.trackId, { subtitleType: 'cc' }));
      }
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.propertyRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage,
      });
    }
  };
  const updateProjectSpeakers = (speakers: ProjectSpeaker[]) => {
    try {
      commandManager.execute(new UpdateProjectSpeakersCommand(projectAccessor, speakers));
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.propertyRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage,
      });
    }
  };
  const addActiveSpeakerToLibrary = () => {
    if (!activeSpeaker) {
      return;
    }
    const next = normalizeProjectSpeakers([...projectSpeakers, { id: createId('speaker'), name: activeSpeaker }]);
    updateProjectSpeakers(next);
  };
  const removeActiveSpeakerFromLibrary = () => {
    if (!activeSpeakerEntry) {
      return;
    }
    updateProjectSpeakers(projectSpeakers.filter((speaker) => speaker.id !== activeSpeakerEntry.id));
  };
  const updateActiveSpeakerColor = (color: string) => {
    if (!activeSpeakerEntry) {
      return;
    }
    updateProjectSpeakers(
      projectSpeakers.map((speaker) => (speaker.id === activeSpeakerEntry.id ? { ...speaker, color } : speaker)),
    );
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
  const chooseLut = async () => {
    try {
      const paths = await openFileDialog(false, [{ name: zhCN.inspector.lutFilterName, extensions: ['cube'] }]);
      const lutPath = paths[0];
      if (lutPath) {
        commit({ colorCorrection: { lutPath } });
      }
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.lutUnavailableTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.lutUnavailableMessage,
      });
    }
  };
  const localKeyframeTime = Math.min(clip.duration, Math.max(0, playheadTime - clip.start));
  const textPath = clip.type === 'text' ? normalizeTextPath(clip.pathText) : undefined;
  const textLayout = clip.type === 'text' ? normalizeTextLayout(clip.textLayout) : undefined;
  const textOpenTypeFeatures = clip.type === 'text' ? normalizeTextOpenTypeFeatures(clip.openTypeFeatures) : undefined;
  const textArc = clip.type === 'text' ? normalizeTextArc(clip.arcText) : undefined;
  const updateTextPath = (patch: Partial<NonNullable<typeof textPath>>) => {
    if (clip.type !== 'text' || !textPath) {
      return;
    }
    commit({ pathText: normalizeTextPath({ ...textPath, ...patch }) });
  };
  const updateTextLayout = (patch: Partial<TextLayoutOptions>) => {
    if (clip.type !== 'text' || !textLayout) {
      return;
    }
    commit({ textLayout: normalizeTextLayout({ ...textLayout, ...patch }) });
  };
  const updateTextOpenTypeFeatures = (patch: Partial<TextOpenTypeFeatures>) => {
    if (clip.type !== 'text' || !textOpenTypeFeatures) {
      return;
    }
    commit({ openTypeFeatures: normalizeTextOpenTypeFeatures({ ...textOpenTypeFeatures, ...patch }) });
  };
  const updateTextArc = (patch: Partial<TextArcOptions>) => {
    if (clip.type !== 'text' || !textArc) {
      return;
    }
    commit({ arcText: normalizeTextArc({ ...textArc, ...patch }) });
  };
  const addKeyframe = (property: KeyframeProperty, value = getClipKeyframeValue(clip, property, localKeyframeTime)) => {
    try {
      commandManager.execute(
        new AddKeyframeCommand(timelineAccessor, clip.id, property, { time: localKeyframeTime, value }),
      );
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.keyframeRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.addKeyframeFailed,
      });
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
        ...createKenBurnsKeyframes(clip.duration, clip.transform.scale, Math.max(clip.transform.scale + 0.5, 1.5)),
      },
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
    [clip.id, project.timeline.tracks],
  );
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
  const batchKeyframesSelected = selectedKeyframeEntries.length > 1;
  const keyframeProperties = useMemo(
    () =>
      (Object.keys(clip.keyframes ?? {}) as KeyframeProperty[]).filter(
        (property) => (clip.keyframes?.[property]?.length ?? 0) > 0,
      ),
    [clip.keyframes],
  );
  useEffect(() => {
    if (keyframeProperties.length > 0 && !keyframeProperties.includes(curveProperty)) {
      setCurveProperty(keyframeProperties[0]);
    }
  }, [curveProperty, keyframeProperties]);
  useEffect(() => {
    let canceled = false;
    if (clip.type !== 'subtitle') {
      setSubtitleStyleTemplates([]);
      return () => {
        canceled = true;
      };
    }
    Promise.all([loadSubtitleStyleTemplates(), loadSharedSubtitleStyleTemplates()])
      .then(([templates, sharedTemplates]) => {
        if (!canceled) {
          setSubtitleStyleTemplates(mergeSubtitleStyleTemplateViews(templates, sharedTemplates));
        }
      })
      .catch((error) => {
        if (!canceled) {
          setSubtitleStyleTemplates(BUILTIN_SUBTITLE_STYLE_TEMPLATES);
          showToast({
            kind: 'warning',
            title: zhCN.inspector.subtitleStyleTemplates.loadFailed,
            message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage,
          });
        }
      });
    return () => {
      canceled = true;
    };
  }, [clip.type]);
  const colorCorrection = normalizeColorCorrection(clip.colorCorrection);
  const chromaKey = normalizeChromaKey(clip.chromaKey);
  const keyingMode: ChromaKeyMode | 'none' = chromaKey.enabled ? chromaKey.mode : 'none';
  const chromaKeyPickActive = chromaKeyPickClipId === clip.id;
  const stabilization = normalizeStabilization(clip.stabilization);
  const frameInterpolation = normalizeFrameInterpolation(clip.frameInterpolation);
  const frameInterpolationUnavailable = frameInterpolationSupported === false;
  const slowMotionMode = normalizeSlowMotionMode(clip.slowMotionMode);
  const frameInterpolationExpandedItem = frameInterpolationCompareItems.find(
    (item) => item.mode === frameInterpolationExpandedMode,
  );
  const showSlowMotionMode = clip.type === 'video' && getClipSpeed(clip) < 1;
  const audioDenoise = normalizeAudioDenoise(clip.audioDenoise);
  const audioDenoiseUnavailable = audioDenoiseSupported === false;
  const audioRestoration = normalizeAudioRestoration(clip.audioRestoration);
  const audioRestorationComparison = buildAudioRestorationWaveformComparison(
    buildAudioRestorationPreviewPeaks(clip.pitchData),
    audioRestoration,
  );
  const blendMode = normalizeClipBlendMode(clip.blendMode);
  const projection = normalizeClipProjection(clip.projection);
  const panorama = normalizeClipPanoramaView(clip.panorama);
  const videoRestoration = normalizeVideoRestoration(clip.videoRestoration);
  const qualityEnhancement = normalizeQualityEnhancement(clip.qualityEnhancement);
  const deinterlaceSuggestion = clip.type === 'video' ? suggestDeinterlaceMode(asset?.fieldOrder) : null;
  const audioPitchSemitones = 'pitchSemitones' in clip ? normalizeAudioPitchSemitones(clip.pitchSemitones) : 0;
  const reverseAudio = 'reverseAudio' in clip ? clip.reverseAudio === true : false;
  const fadeInDuration = 'fadeInDuration' in clip ? normalizeAudioFadeDuration(clip.fadeInDuration, clip.duration) : 0;
  const fadeOutDuration =
    'fadeOutDuration' in clip ? normalizeAudioFadeDuration(clip.fadeOutDuration, clip.duration) : 0;
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
  const updatePanorama = (patch: Partial<typeof panorama>) => {
    commit({ panorama: normalizeClipPanoramaView({ ...panorama, ...patch }) });
  };
  const updateVideoRestoration = (patch: Partial<typeof videoRestoration>) => {
    commit({ videoRestoration: normalizeVideoRestoration({ ...videoRestoration, ...patch }) });
  };
  const updateQualityEnhancement = (patch: Partial<typeof qualityEnhancement>) => {
    commit({ qualityEnhancement: normalizeQualityEnhancement({ ...qualityEnhancement, ...patch }) });
  };
  const updateAudioRestoration = (patch: Partial<typeof audioRestoration>) => {
    commit({ audioRestoration: normalizeAudioRestoration({ ...audioRestoration, ...patch }) });
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
    let unlisten: (() => void) | undefined;
    void listenBridge<NoiseReductionProgressEvent>('noise-reduction-progress', (payload) => {
      if (payload.clipId === clip.id) {
        setAiLocalDenoiseProgress(payload.progress);
        setAiLocalDenoiseStage(payload.stage);
      }
    }).then((dispose) => {
      unlisten = dispose;
    });
    return () => {
      unlisten?.();
    };
  }, [clip.id]);
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
      showToast({
        kind: 'warning',
        title: zhCN.inspector.propertyRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage,
      });
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
        showToast({
          kind: 'warning',
          title: zhCN.inspector.motionTrack.failed,
          message: zhCN.inspector.motionTrack.noPoints,
        });
      }
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.motionTrack.failed,
        message: error instanceof Error ? error.message : zhCN.inspector.motionTrack.failedMessage,
      });
      setMotionTrackProgress(undefined);
    } finally {
      setMotionTrackingBusy(false);
    }
  };
  const cancelMotionTrackAnalysis = async () => {
    try {
      await cancelMotionTracking(clip.id);
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.motionTrack.cancelFailed,
        message: error instanceof Error ? error.message : zhCN.inspector.motionTrack.failedMessage,
      });
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
  const bindDataSubtitleSource = async () => {
    if (clip.type !== 'subtitle') {
      return;
    }
    try {
      const [path] = await openFileDialog(false, [
        { name: zhCN.fileDialogs.subtitleData, extensions: ['csv', 'json'] },
      ]);
      if (!path) {
        return;
      }
      const sourceType: Exclude<DataSubtitleSourceType, 'template'> = path.toLowerCase().endsWith('.json')
        ? 'json'
        : 'csv';
      const rows = parseDataSubtitleRows(await readFile(path), sourceType);
      const template = clip.dataSubtitle?.template ?? (clip.text.trim() || '{row.text}');
      const dataSubtitle: DataSubtitleSource = { sourceType, template, rows, filePath: path };
      commit({ dataSubtitle, text: template });
      showToast({
        kind: 'success',
        title: zhCN.inspector.dataSubtitle.bound,
        message: zhCN.inspector.dataSubtitle.rowCount(rows.length),
      });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.dataSubtitle.failed,
        message: error instanceof Error ? error.message : zhCN.inspector.dataSubtitle.failedMessage,
      });
    }
  };
  const updateDataSubtitleTemplate = (template: string) => {
    if (clip.type !== 'subtitle') {
      return;
    }
    const dataSubtitle: DataSubtitleSource = {
      sourceType: clip.dataSubtitle?.sourceType ?? 'template',
      template: template.trim() || '{row.text}',
      rows: clip.dataSubtitle?.rows ?? [],
      filePath: clip.dataSubtitle?.filePath,
    };
    commit({ dataSubtitle, text: dataSubtitle.template });
  };
  const clearDataSubtitleSource = () => {
    if (clip.type === 'subtitle') {
      commit({ dataSubtitle: undefined });
    }
  };
  const runPitchAnalysis = async () => {
    if (!asset || !('volume' in clip)) {
      return;
    }
    try {
      setPitchAnalyzing(true);
      const pitchData = await analyzeClipPitch(asset);
      commit({ pitchData });
      if (pitchData.length === 0) {
        showToast({
          kind: 'warning',
          title: zhCN.inspector.pitchAnalysis.noDataTitle,
          message: zhCN.inspector.pitchAnalysis.noDataMessage,
        });
      } else {
        showToast({
          kind: 'success',
          title: zhCN.inspector.pitchAnalysis.completed,
          message: zhCN.inspector.pitchAnalysis.pointCount(pitchData.length),
        });
      }
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.pitchAnalysis.failed,
        message: error instanceof Error ? error.message : zhCN.inspector.pitchAnalysis.failedMessage,
      });
    } finally {
      setPitchAnalyzing(false);
    }
  };
  const exportPitchCsv = async () => {
    try {
      const exported = await exportClipPitchCsv(clip);
      if (exported) {
        showToast({
          kind: 'success',
          title: zhCN.inspector.pitchAnalysis.exported,
          message: zhCN.inspector.pitchAnalysis.exportedMessage,
        });
      }
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.pitchAnalysis.exportFailed,
        message: error instanceof Error ? error.message : zhCN.inspector.pitchAnalysis.failedMessage,
      });
    }
  };
  const updateSelectedKeyframe = (
    patch: Partial<Pick<Keyframe<number>, 'time' | 'value' | 'easing' | 'inHandle' | 'outHandle' | 'handleMode'>>,
  ) => {
    if (!selectedKeyframe) {
      return;
    }
    try {
      commandManager.execute(
        new UpdateKeyframeCommand(
          timelineAccessor,
          clip.id,
          selectedKeyframe.property,
          selectedKeyframe.keyframeId,
          patch,
        ),
      );
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.keyframeRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.updateKeyframeFailed,
      });
    }
  };
  const removeSelectedKeyframe = () => {
    if (!selectedKeyframe) {
      return;
    }
    try {
      commandManager.execute(
        new RemoveKeyframeCommand(timelineAccessor, clip.id, selectedKeyframe.property, selectedKeyframe.keyframeId),
      );
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.keyframeRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.removeKeyframeFailed,
      });
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
      showToast({
        kind: 'warning',
        title: zhCN.inspector.keyframeRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.updateKeyframeFailed,
      });
    }
  };
  const shiftSelectedKeyframes = () => runBatchKeyframeEdit({ type: 'shift', delta: batchShiftSeconds });
  const scaleSelectedKeyframes = () => runBatchKeyframeEdit({ type: 'scale-time', factor: batchScaleFactor });
  const updateSelectedKeyframeEasing = () => runBatchKeyframeEdit({ type: 'easing', easing: batchEasing });
  const distributeSelectedKeyframes = () => runBatchKeyframeEdit({ type: 'distribute-time' });
  const alignSelectedKeyframeValues = () => runBatchKeyframeEdit({ type: 'align-value' });
  const deleteSelectedKeyframes = () => runBatchKeyframeEdit({ type: 'delete' }, true);
  const updateSelectedKeyframeExpression = (field: 'time' | 'value', expression: string) => {
    if (!selectedKeyframe || !selectedKeyframeFrame) {
      return;
    }
    const frames = [...(clip.keyframes?.[selectedKeyframe.property] ?? [])].sort(
      (left, right) => left.time - right.time || left.id.localeCompare(right.id),
    );
    const frameIndex = frames.findIndex((frame) => frame.id === selectedKeyframe.keyframeId);
    const previous = frameIndex > 0 ? frames[frameIndex - 1] : undefined;
    const next = frameIndex >= 0 ? frames[frameIndex + 1] : undefined;
    const limits =
      field === 'time' ? { min: 0, max: clip.duration } : KEYFRAME_PROPERTY_LIMITS[selectedKeyframe.property];
    try {
      const parsed = parseKeyframeExpression(expression, {
        prev: field === 'time' ? previous?.time : previous?.value,
        current: field === 'time' ? selectedKeyframeFrame.time : selectedKeyframeFrame.value,
        next: field === 'time' ? next?.time : next?.value,
        min: limits.min,
        max: limits.max,
      });
      updateSelectedKeyframe({ [field]: parsed });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.keyframeRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.updateKeyframeFailed,
      });
    }
  };
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
              keyframes: frames.map((frame) => ({
                id: frame.id,
                time: frame.time,
                value: frame.value,
                easing: frame.easing,
                inHandle: frame.inHandle,
                outHandle: frame.outHandle,
                handleMode: frame.handleMode,
              })),
            },
          ],
          'Edit keyframe curve',
        ),
      );
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.keyframeRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.updateKeyframeFailed,
      });
    }
  };
  const addMask = () => runEffectCommand(new AddMaskCommand(timelineAccessor, clip.id));
  const updateMask = (maskId: string, patch: MaskPatch) =>
    runEffectCommand(new UpdateMaskCommand(timelineAccessor, clip.id, maskId, patch));
  const removeMask = (maskId: string) => runEffectCommand(new RemoveMaskCommand(timelineAccessor, clip.id, maskId));
  const runPrivacyBlurDetection = async () => {
    if (!privacyDetectionModelPath.trim()) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.privacyBlur.failed,
        message: zhCN.inspector.privacyBlur.modelRequired,
      });
      return;
    }
    if (!asset?.path || !('mediaId' in clip)) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.privacyBlur.failed,
        message: zhCN.inspector.privacyBlur.noMedia,
      });
      return;
    }
    try {
      setPrivacyBlurBusy(true);
      await markLocalAiModelUsed('yunet', privacyDetectionModelPath.trim()).catch((error) => {
        console.warn('Unable to update YuNet model last-used time', error);
      });
      const result = await detectPrivacyRegions({
        modelPath: privacyDetectionModelPath.trim(),
        mediaPath: asset.path,
        clipId: clip.id,
        duration: clip.duration,
      });
      const newMasks = buildPrivacyMasksFromDetections(result.boxes, { effect: privacyBlurEffect });
      if (newMasks.length === 0) {
        showToast({
          kind: 'info',
          title: zhCN.inspector.privacyBlur.title,
          message: zhCN.inspector.privacyBlur.noDetections,
        });
        return;
      }
      commit({ masks: [...masks, ...newMasks] });
      showToast({
        kind: 'success',
        title: zhCN.inspector.privacyBlur.title,
        message: zhCN.inspector.privacyBlur.applied(newMasks.length),
      });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.privacyBlur.failed,
        message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage,
      });
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
        direction: textAnimationDirection,
      }),
    );
  };
  const textAnimationKeyframeCount = ['opacity', 'x', 'y', 'scaleX', 'scaleY'].reduce(
    (total, property) => total + (clip.keyframes?.[property as KeyframeProperty]?.length ?? 0),
    0,
  );
  const applyColorMatch = async () => {
    const referenceClip = colorMatchReferenceClips.find((item) => item.id === colorMatchReferenceClipId);
    if (!referenceClip) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.colorMatch.failed,
        message: zhCN.inspector.colorMatch.referenceRequired,
      });
      return;
    }
    try {
      setColorMatchBusy(true);
      const colorCurves = await buildClipColorMatchCurves(clip, referenceClip, media);
      commit({ colorCorrection: { colorCurves } });
      showToast({ kind: 'success', title: zhCN.inspector.colorMatch.applied });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.colorMatch.failed,
        message: error instanceof Error ? error.message : zhCN.inspector.colorMatch.failedMessage,
      });
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
    const sourceClips = sourceTrack.clips.filter(
      (item): item is Extract<Clip, { type: 'subtitle' }> => item.type === 'subtitle',
    );
    try {
      setSubtitleTranslationProgress({ completed: 0, total: sourceClips.length });
      const requestTranslation = () =>
        translateSubtitleItems(
          subtitleClipsToTranslationItems(sourceClips),
          translationSettings,
          fetch,
          (completed, total) => {
            setSubtitleTranslationProgress({ completed, total });
          },
        );
      let translated: Awaited<ReturnType<typeof translateSubtitleItems>>;
      try {
        translated = await requestTranslation();
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'TRANSLATION_TOS_NOT_ACCEPTED') {
          throw error;
        }
        const accepted = await bridgeConfirm(zhCN.inspector.translation.tosMessage, {
          title: zhCN.inspector.translation.tosTitle,
          kind: 'warning',
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
        language: translationSettings.targetLanguage,
        name: zhCN.inspector.translation.trackName(sourceTrack.name, translationSettings.targetLanguage),
        clips: [],
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
          colorCorrection: { ...sourceClip.colorCorrection },
        };
        commandManager.execute(new AddSubtitleClipCommand(timelineAccessor, translatedClip));
        addedClipIds.push(translatedClip.id);
      }
      if (addedClipIds[0]) {
        setSelectedClipIds([addedClipIds[0]]);
      }
      showToast({
        kind: 'success',
        title: zhCN.inspector.translation.completeTitle,
        message: zhCN.inspector.translation.completeMessage(addedClipIds.length),
      });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.translation.failedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.translation.failedMessage,
      });
    } finally {
      setSubtitleTranslationProgress(undefined);
    }
  };
  const applySubtitleStyleTemplate = (template: SubtitleStyleTemplate) => {
    if (clip.type !== 'subtitle') {
      return;
    }
    try {
      commandManager.execute(new UpdateSubtitleStyleCommand(timelineAccessor, clip.id, template.style));
      showToast({
        kind: 'success',
        title: zhCN.inspector.subtitleStyleTemplates.title,
        message: zhCN.inspector.subtitleStyleTemplates.applied(getSubtitleStyleTemplateLabel(template)),
      });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.propertyRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage,
      });
    }
  };
  const saveCurrentSubtitleStyleTemplate = async () => {
    if (clip.type !== 'subtitle') {
      return;
    }
    const name = window.prompt(zhCN.inspector.subtitleStyleTemplates.savePrompt, clip.name);
    if (name === null) {
      return;
    }
    try {
      const templates = await saveCustomSubtitleStyleTemplate(name, clip.style);
      setSubtitleStyleTemplates(templates);
      showToast({
        kind: 'success',
        title: zhCN.inspector.subtitleStyleTemplates.title,
        message: zhCN.inspector.subtitleStyleTemplates.saved(name.trim()),
      });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.subtitleStyleTemplates.saveFailed,
        message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage,
      });
    }
  };
  const deleteSubtitleStyleTemplate = async (templateId: string) => {
    try {
      const templates = await deleteCustomSubtitleStyleTemplate(templateId);
      setSubtitleStyleTemplates(templates);
      showToast({
        kind: 'info',
        title: zhCN.inspector.subtitleStyleTemplates.title,
        message: zhCN.inspector.subtitleStyleTemplates.deleted,
      });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.subtitleStyleTemplates.deleteFailed,
        message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage,
      });
    }
  };
  const addSubtitleStyleTemplateToSharedLibrary = async (template: SubtitleStyleTemplate) => {
    try {
      await addSharedLibraryResource(subtitleStyleTemplateToSharedResource(template), 'overwrite');
      window.dispatchEvent(new CustomEvent('open-factory:shared-library-updated'));
      showToast({
        kind: 'success',
        title: zhCN.inspector.subtitleStyleTemplates.title,
        message: zhCN.inspector.subtitleStyleTemplates.addedToShared(getSubtitleStyleTemplateLabel(template)),
      });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.subtitleStyleTemplates.addToSharedFailed,
        message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage,
      });
    }
  };

  return {
    // Store subscriptions
    project,
    setSelectedClipIds,
    setSelectedKeyframes,
    chromaKeyPickClipId,
    setChromaKeyPickClipId,
    translationProvider,
    translationApiKey,
    translationApiKeyError,
    translationTargetLanguage,
    loadTranslationApiKey,
    privacyDetectionModelPath,

    // useMemo values
    allTimelineSubtitleClips,
    translationSettings,
    projectSpeakers,
    soundDescriptionOptions,
    colorMatchReferenceClips,
    selectedKeyframeEntries,
    keyframeProperties,
    pitchSummary,

    // useState values
    analysisProgress,
    setAnalysisProgress,
    motionTrackProgress,
    setMotionTrackProgress,
    motionTrackingBusy,
    setMotionTrackingBusy,
    privacyBlurBusy,
    setPrivacyBlurBusy,
    batchShiftSeconds,
    setBatchShiftSeconds,
    batchScaleFactor,
    setBatchScaleFactor,
    batchEasing,
    setBatchEasing,
    curveProperty,
    setCurveProperty,
    privacyBlurEffect,
    setPrivacyBlurEffect,
    frameInterpolationSupported,
    setFrameInterpolationSupported,
    frameInterpolationCompareRunning,
    setFrameInterpolationCompareRunning,
    frameInterpolationCompareItems,
    setFrameInterpolationCompareItems,
    frameInterpolationCompareError,
    setFrameInterpolationCompareError,
    frameInterpolationExpandedMode,
    setFrameInterpolationExpandedMode,
    frameInterpolationQualityRunning,
    setFrameInterpolationQualityRunning,
    frameInterpolationQualityError,
    setFrameInterpolationQualityError,
    audioDenoiseSupported,
    setAudioDenoiseSupported,
    aiLocalDenoiseProcessing,
    setAiLocalDenoiseProcessing,
    aiLocalDenoiseProgress,
    setAiLocalDenoiseProgress,
    aiLocalDenoiseStage,
    setAiLocalDenoiseStage,
    aiLocalDenoiseResult,
    setAiLocalDenoiseResult,
    colorMatchReferenceClipId,
    setColorMatchReferenceClipId,
    colorMatchBusy,
    setColorMatchBusy,
    subtitleTranslationProgress,
    setSubtitleTranslationProgress,
    subtitleStyleTemplates,
    setSubtitleStyleTemplates,
    customSoundDescOpen,
    setCustomSoundDescOpen,
    pitchAnalyzing,
    setPitchAnalyzing,
    textAnimationPreset,
    setTextAnimationPreset,
    textAnimationDuration,
    setTextAnimationDuration,
    textAnimationDirection,
    setTextAnimationDirection,

    // Computed values
    asset,
    clipStartTimecode,
    clipDurationTimecode,
    assetDurationTimecode,
    subtitleTrack,
    subtitleType,
    activeSpeaker,
    activeSpeakerEntry,
    soundDescSelectValue,
    localKeyframeTime,
    textPath,
    textLayout,
    textOpenTypeFeatures,
    textArc,
    colorCorrection,
    chromaKey,
    keyingMode,
    chromaKeyPickActive,
    stabilization,
    frameInterpolation,
    frameInterpolationUnavailable,
    slowMotionMode,
    frameInterpolationExpandedItem,
    showSlowMotionMode,
    audioDenoise,
    audioDenoiseUnavailable,
    audioRestoration,
    audioRestorationComparison,
    blendMode,
    projection,
    panorama,
    videoRestoration,
    qualityEnhancement,
    deinterlaceSuggestion,
    audioPitchSemitones,
    reverseAudio,
    fadeInDuration,
    fadeOutDuration,
    fadeInCurve,
    fadeOutCurve,
    spatialAudio,
    spatialRenderModeOptions,
    spatialDistanceOptions,
    spatialRoomOptions,
    audioChannelRouting,
    audioChannelRoutingOptions,
    masks,
    privacyRedactions,
    motionTrack,
    colorCurves,
    threeWayColor,
    selectedKeyframeFrame,
    selectedKeyframeRefs,
    batchKeyframesSelected,
    textAnimationKeyframeCount,

    // Handlers
    commit,
    runFrameInterpolationComparePreview,
    runFrameInterpolationQualityEvaluation,
    commitSubtitleType,
    commitCcSpeaker,
    commitCcSoundDesc,
    updateProjectSpeakers,
    addActiveSpeakerToLibrary,
    removeActiveSpeakerFromLibrary,
    updateActiveSpeakerColor,
    runEffectCommand,
    chooseLut,
    updateTextPath,
    updateTextLayout,
    updateTextOpenTypeFeatures,
    updateTextArc,
    addKeyframe,
    setKenBurns,
    updateKenBurnsEndScale,
    updatePanorama,
    updateVideoRestoration,
    updateQualityEnhancement,
    updateAudioRestoration,
    commitChromaKeyColors,
    updateChromaKeyColor,
    addChromaKeyColor,
    removeChromaKeyColor,
    toggleChromaKeyPicker,
    runStabilizationAnalysis,
    runMotionTrackAnalysis,
    cancelMotionTrackAnalysis,
    bindMotionTrackKeyframes,
    bindDataSubtitleSource,
    updateDataSubtitleTemplate,
    clearDataSubtitleSource,
    runPitchAnalysis,
    exportPitchCsv,
    updateSelectedKeyframe,
    removeSelectedKeyframe,
    runBatchKeyframeEdit,
    shiftSelectedKeyframes,
    scaleSelectedKeyframes,
    updateSelectedKeyframeEasing,
    distributeSelectedKeyframes,
    alignSelectedKeyframeValues,
    deleteSelectedKeyframes,
    updateSelectedKeyframeExpression,
    updateCurveKeyframes,
    addMask,
    updateMask,
    removeMask,
    runPrivacyBlurDetection,
    applyTextAnimation,
    applyColorMatch,
    translateSubtitleTrack,
    applySubtitleStyleTemplate,
    saveCurrentSubtitleStyleTemplate,
    deleteSubtitleStyleTemplate,
    addSubtitleStyleTemplateToSharedLibrary,
  };
}
