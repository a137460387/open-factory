import type {Clip, MediaAsset, Project, ProjectSettings, ProjectSpeaker} from '@open-factory/editor-core';
import type {
  AudioFadeCurve,
  AudioChannelRoutingMode,
  BatchKeyframeEditOperation,
  ChromaKeyMode,
  ChromaKeyColor,
  ClipPatch,
  ColorCurves,
  FrameInterpolationCompareMode,
  Keyframe,
  KeyframeEasing,
  KeyframeProperty,
  MaskPatch,
  PrivacyBlurEffect,
  SpatialAudioDistance,
  SpatialAudioRenderMode,
  SpatialAudioRoomModel,
  SubtitleStyleTemplate,
  TextAnimationDirection,
  TextAnimationPreset,
  TextArcOptions,
  TextLayoutOptions,
  TextOpenTypeFeatures,
  ThreeWayColor,
  VideoDeinterlaceMode,
  normalizeAudioDenoise,
  normalizeAudioFadeCurve,
  normalizeAudioFadeDuration,
  normalizeAudioPitchSemitones,
  normalizeAudioRestoration,
  normalizeChromaKey,
  normalizeClipBlendMode,
  normalizeClipPanoramaView,
  normalizeClipProjection,
  normalizeColorCorrection,
  normalizeColorCurves,
  normalizeFrameInterpolation,
  normalizeMasks,
  normalizeMotionTrack,
  normalizePrivacyRedactions,
  normalizeQualityEnhancement,
  normalizeSlowMotionMode,
  normalizeSpatialAudio,
  normalizeStabilization,
  normalizeTextArc,
  normalizeTextLayout,
  normalizeTextOpenTypeFeatures,
  normalizeTextPath,
  normalizeThreeWayColor,
  normalizeVideoRestoration,
  summarizePitchData,
} from '@open-factory/editor-core';
import type {SelectedKeyframeRef} from '../../store/editorStore';
import {commandManager} from '../../store/commandManager';
import type {TranslationProvider} from '../../store/translationSettingsStore';
import type {buildAudioRestorationWaveformComparison, resolveSelectedKeyframeEntries, FrameInterpolationComparePreviewViewItem} from './InspectorEditors';

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
