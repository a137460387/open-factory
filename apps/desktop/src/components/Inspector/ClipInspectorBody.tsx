import React from 'react';
import type { Clip, MediaAsset, ProjectSettings } from '@open-factory/editor-core';
import {
  AddEffectCommand,
  ApplyShakeStabilizationCommand,
  ApplyPipPlacementCommand,
  RemoveEffectCommand,
  ReorderEffectsCommand,
  UpdateEffectCommand,
  createId,
  CLIP_BLEND_MODES,
  CLIP_SLOW_MOTION_MODES,
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_EFFECT_PARAMS,
  DEFAULT_TEXT_ARC,
  DEFAULT_TEXT_LAYOUT,
  DEFAULT_TEXT_OPEN_TYPE_FEATURES,
  DEFAULT_TEXT_PATH,
  FRAME_INTERPOLATION_MODES,
  FRAME_INTERPOLATION_TARGET_FPS,
  INPUT_COLOR_SPACES,
  KEYFRAME_PROPERTY_LIMITS,
  MAX_CHROMA_KEY_COLORS,
  MAX_CLIP_SPEED,
  MIN_CLIP_SPEED,
  TEXT_ANIMATION_DIRECTIONS,
  TEXT_ANIMATION_PRESETS,
  getClipSpeed,
  getTimelineDuration,
  getTransformScaleX,
  getTransformScaleY,
  normalizeSequenceFrameRate,
  frameInterpolationCompareModeToSlowMotionMode,
  richTextToPlainText,
  type AudioFadeCurve,
  type AudioChannelRoutingMode,
  type ChromaKeyMode,
  type ClipBlendMode,
  type ClipPanoramaOutputProjection,
  type ClipProjection,
  type InputColorSpace,
  type KeyframeEasing,
  type KeyframeProperty,
  type ClipSlowMotionMode,
  type SpatialAudioDistance,
  type SpatialAudioRenderMode,
  type SpatialAudioRoomModel,
  type TextAnimationDirection,
  type TextAnimationPreset,
  type VideoDeinterlaceMode,
  type VideoDenoisePreset,
  type FrameInterpolationMode,
  type TextBoxFitMode,
} from '@open-factory/editor-core';
import { Loader2, Mic, Palette, Pipette, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { t, zhCN } from '../../i18n/strings';
import { commandManager, projectAccessor, timelineAccessor } from '../../store/commandManager';
import { cancelAudioNoiseReduction, processAudioNoiseReduction } from '../../lib/tauri-bridge';
import { showToast } from '../../lib/toast';
import { generateTtsVoiceover } from '../../lib/ttsVoiceover';
import { SubtitleAIPolishPanel } from './SubtitleAIPolishPanel';
import { ChapterTitleAIPanel } from './ChapterTitleAIPanel';
import { AIColorGradingPanel, AILookMatchPanel } from './AIColorGradingPanel';
import { ColorGradingWorkspace } from '../ColorGrading/ColorGradingWorkspace';
import { ProfessionalColorGradingPanel } from '../ColorGrading/ProfessionalColorGradingPanel';
import { AISceneMatchPanel } from './AISceneMatchPanel';
import { AIDenoisePanel } from './AIDenoisePanel';
import { AIBrollSuggestionPanel } from './AIBrollSuggestionPanel';
import { AISubtitleStylePanel } from './AISubtitleStylePanel';
import { useEditorStore } from '../../store/editorStore';
import { isTranslationConfigured } from '../../store/translationSettingsStore';
import {
  PanelTitle,
  Section,
  TextField,
  TextAreaField,
  NumberField,
  RangeField,
  RangeNumberField,
  ExpressionNumberField,
  ColorField,
  ToggleField,
  AnimatedField,
} from './InspectorFields';
import {
  AudioRestorationWaveformPreview,
  SubtitleStyleTemplatesPanel,
  SubtitleProofreadingPanel,
  SubtitleRetimingPanel,
  SpeedCurveEditor,
  KeyframeCurveEditor,
  CurveEditor,
  ThreeWayColorEditor,
  PrivacyBlurPanel,
  RichTextEditor,
  MotionGraphicPanel,
  MasksEditor,
  EffectsEditor,
  rgbToHex,
  hexToRgb,
  formatLutPath,
  formatInputColorSpaceLabel,
  getKenBurnsEndScale,
  formatKeyframeProperty,
  formatKeyframeValue,
  formatEstimatedDuration,
} from './InspectorEditors';
import type { ClipInspectorStateParams, ClipInspectorStateReturn } from './useClipInspectorState';

export type ClipInspectorBodyProps = ClipInspectorStateParams & ClipInspectorStateReturn;

export const ClipInspectorBody = React.memo(function ClipInspectorBody({
  clip,
  selectedClipLocked,
  selectedKeyframe,
  selectedKeyframes = [],
  media,
  playheadTime,
  projectSettings,
  selectedSubtitleClips,

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
}: ClipInspectorBodyProps) {
  return (
    <aside className="flex min-h-0 flex-col bg-panel">
      <PanelTitle />
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <Section title={zhCN.inspector.sections.clip}>
          {selectedClipLocked ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-800">
              {zhCN.inspector.locked}
            </div>
          ) : null}
          <TextField label={zhCN.inspector.fields.name} value={clip.name} onCommit={(name) => commit({ name })} />
          <NumberField
            label={zhCN.inspector.fields.start}
            value={clip.start}
            min={0}
            step={0.033}
            onCommit={(start) => commit({ start })}
          />
          <NumberField
            label={zhCN.inspector.fields.duration}
            value={clip.duration}
            min={0.033}
            step={0.033}
            onCommit={(duration) => commit({ duration })}
          />
          {asset ? (
            <div className="rounded-md bg-panel p-2 text-xs text-[var(--color-text-secondary)]">
              <div className="truncate font-medium text-[var(--color-text-secondary)]">{asset.name}</div>
              <div>
                {asset.missing
                  ? zhCN.inspector.missingFile
                  : `${asset.width || '-'} x ${asset.height || '-'} | ${assetDurationTimecode}`}
              </div>
            </div>
          ) : null}
        </Section>

        {clip.type === 'motion-graphic' ? (
          <MotionGraphicPanel clip={clip} selectedClipLocked={selectedClipLocked} playheadTime={playheadTime} />
        ) : null}

        {clip.type === 'video' || clip.type === 'audio' ? (
          <Section title={zhCN.inspector.sections.speed}>
            <div className="rounded-md bg-panel p-2 text-xs text-[var(--color-text-secondary)]">
              {zhCN.inspector.timecodeSummary(clipStartTimecode, clipDurationTimecode)} /{' '}
              {zhCN.inspector.speedSummary(getClipSpeed(clip).toFixed(2))}
            </div>
            <AnimatedField
              label={zhCN.inspector.fields.speed}
              onAddKeyframe={() => addKeyframe('speed')}
              testId="add-speed-keyframe-button"
            >
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
              <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                {zhCN.inspector.fields.slowMotionMode}
                <select
                  className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
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
            <SpeedCurveEditor
              clip={clip}
              onCommit={(speedFrames) => commit({ keyframes: { ...clip.keyframes, speed: speedFrames } })}
            />
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
              <div
                className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-800"
                data-testid="audio-denoise-unavailable"
              >
                {zhCN.inspector.fields.audioDenoiseUnsupported}
              </div>
            ) : null}
          </Section>
        ) : null}

        {clip.type === 'video' || clip.type === 'audio' ? (
          <Section title={zhCN.inspector.sections.aiLocalDenoise}>
            <ToggleField
              label={zhCN.inspector.fields.enabled}
              checked={clip.aiLocalDenoise?.enabled ?? false}
              onCommit={(enabled) =>
                commit({ aiLocalDenoise: { ...(clip.aiLocalDenoise ?? { strength: 0.5 }), enabled } })
              }
              testId="ai-local-denoise-toggle"
            />
            <RangeNumberField
              label={zhCN.inspector.fields.strength}
              value={clip.aiLocalDenoise?.strength ?? 0.5}
              min={0}
              max={1}
              step={0.05}
              format={(v) => `${Math.round(v * 100)}%`}
              disabled={!clip.aiLocalDenoise?.enabled}
              onCommit={(strength) =>
                commit({ aiLocalDenoise: { ...(clip.aiLocalDenoise ?? { enabled: false }), strength } })
              }
              testId="ai-local-denoise-strength"
            />
            {aiLocalDenoiseProcessing ? (
              <div className="space-y-2" data-testid="ai-local-denoise-progress">
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                  <Loader2 size={14} className="animate-spin" />
                  <span>{Math.round(aiLocalDenoiseProgress * 100)}%</span>
                  <span className="capitalize">{aiLocalDenoiseStage}</span>
                </div>
                <button
                  className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-panel"
                  type="button"
                  onClick={() => {
                    void cancelAudioNoiseReduction(clip.id);
                    setAiLocalDenoiseProcessing(false);
                  }}
                  data-testid="ai-local-denoise-cancel"
                >
                  取消
                </button>
              </div>
            ) : aiLocalDenoiseResult ? (
              <div className="space-y-2" data-testid="ai-local-denoise-complete">
                <div className="rounded-md border border-green-200 bg-green-50 p-2 text-xs text-green-700">
                  降噪完成: -{aiLocalDenoiseResult.noiseReductionDb.toFixed(1)} dB
                </div>
                <button
                  className="w-full rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white"
                  type="button"
                  onClick={() => setAiLocalDenoiseResult(null)}
                  data-testid="ai-local-denoise-reset"
                >
                  重新处理
                </button>
              </div>
            ) : (
              <button
                className="w-full rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={!clip.aiLocalDenoise?.enabled || !asset?.path}
                onClick={async () => {
                  if (!asset?.path) return;
                  setAiLocalDenoiseProcessing(true);
                  setAiLocalDenoiseProgress(0);
                  setAiLocalDenoiseStage('decoding');
                  setAiLocalDenoiseResult(null);
                  try {
                    const result = await processAudioNoiseReduction({
                      mediaPath: asset.path,
                      clipId: clip.id,
                      strength: clip.aiLocalDenoise?.strength ?? 0.5,
                    });
                    setAiLocalDenoiseResult({
                      outputPath: result.outputPath,
                      noiseReductionDb: result.noiseReductionDb,
                    });
                    commit({
                      aiLocalDenoise: {
                        ...(clip.aiLocalDenoise ?? { enabled: true, strength: 0.5 }),
                        outputPath: result.outputPath,
                        originalPath: result.originalPath,
                        processedAt: Date.now(),
                      },
                    });
                  } catch (error) {
                    showToast({
                      kind: 'error',
                      title: '降噪失败',
                      message: error instanceof Error ? error.message : String(error),
                    });
                  } finally {
                    setAiLocalDenoiseProcessing(false);
                  }
                }}
                data-testid="ai-local-denoise-process"
              >
                <Sparkles size={14} className="mr-1 inline" />
                开始降噪
              </button>
            )}
          </Section>
        ) : null}

        <Section title={zhCN.inspector.sections.transform}>
          <AnimatedField label="X" onAddKeyframe={() => addKeyframe('x')}>
            <NumberField
              label="X"
              value={clip.transform.x}
              step={1}
              onCommit={(x) => commit({ transform: { x } })}
              hideLabel
              testId="clip-transform-x-input"
            />
          </AnimatedField>
          <AnimatedField label="Y" onAddKeyframe={() => addKeyframe('y')}>
            <NumberField
              label="Y"
              value={clip.transform.y}
              step={1}
              onCommit={(y) => commit({ transform: { y } })}
              hideLabel
              testId="clip-transform-y-input"
            />
          </AnimatedField>
          <AnimatedField
            label={zhCN.inspector.fields.scale}
            onAddKeyframe={() => {
              addKeyframe('scaleX', getTransformScaleX(clip.transform));
              addKeyframe('scaleY', getTransformScaleY(clip.transform));
            }}
            testId="add-scale-keyframe-button"
          >
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
          {clip.type !== 'audio' && clip.type !== 'video' && clip.type !== 'image' ? (
            <AnimatedField
              label={zhCN.inspector.fields.opacity}
              onAddKeyframe={() => addKeyframe('opacity')}
              testId="add-opacity-keyframe-button"
            >
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

        {clip.type === 'video' || clip.type === 'image' ? (
          <details className="mb-4" open data-testid="clip-blend-section">
            <summary className="mb-2 cursor-pointer text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
              {t('inspector.sections.blend')}
            </summary>
            <div className="space-y-3">
              <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                {t('inspector.fields.blendMode')}
                <select
                  className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                  value={blendMode}
                  data-testid="clip-blend-mode-select"
                  onChange={(event) => commit({ blendMode: event.target.value as ClipBlendMode })}
                >
                  {CLIP_BLEND_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {t(`inspector.blendModes.${mode}`)}
                    </option>
                  ))}
                </select>
              </label>
              <AnimatedField
                label={zhCN.inspector.fields.opacity}
                onAddKeyframe={() => addKeyframe('opacity')}
                testId="add-opacity-keyframe-button"
              >
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
            </div>
          </details>
        ) : null}

        {clip.type === 'video' ? (
          <details className="mb-4" open>
            <summary className="mb-2 cursor-pointer text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
              {zhCN.inspector.sections.projection}
            </summary>
            <div className="space-y-3">
              <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                {zhCN.inspector.fields.projection}
                <select
                  className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
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
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                    {zhCN.inspector.fields.panoramaOutput}
                    <select
                      className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                      value={panorama.outputProjection}
                      data-testid="clip-panorama-output-select"
                      onChange={(event) =>
                        updatePanorama({ outputProjection: event.target.value as ClipPanoramaOutputProjection })
                      }
                    >
                      <option value="flat">{zhCN.inspector.panoramaOutput.flat}</option>
                      <option value="equirectangular">{zhCN.inspector.panoramaOutput.equirectangular}</option>
                    </select>
                  </label>
                  <AnimatedField
                    label={zhCN.inspector.fields.yaw}
                    onAddKeyframe={() => addKeyframe('yaw', panorama.yaw)}
                    testId="add-yaw-keyframe-button"
                  >
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
                  <AnimatedField
                    label={zhCN.inspector.fields.pitch}
                    onAddKeyframe={() => addKeyframe('pitch', panorama.pitch)}
                    testId="add-pitch-keyframe-button"
                  >
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
                  <AnimatedField
                    label={zhCN.inspector.fields.roll}
                    onAddKeyframe={() => addKeyframe('roll', panorama.roll)}
                    testId="add-roll-keyframe-button"
                  >
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
            <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
              {zhCN.inspector.fields.keyingMode}
              <select
                className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                value={keyingMode}
                data-testid="keying-mode-select"
                onChange={(event) => {
                  const mode = event.target.value as ChromaKeyMode | 'none';
                  commit({
                    chromaKey: {
                      ...chromaKey,
                      enabled: mode !== 'none',
                      mode: mode === 'none' ? chromaKey.mode : mode,
                    },
                  });
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
                    <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                      {zhCN.inspector.fields.chromaKeyColor}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
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
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-[var(--color-text-secondary)] hover:bg-panel ${
                          chromaKeyPickActive
                            ? 'bg-emerald-50 ring-1 ring-emerald-300'
                            : 'bg-[var(--color-bg-elevated)]'
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
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
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
                  onCommit={(lumaThreshold) =>
                    commit({ chromaKey: { ...chromaKey, enabled: true, mode: 'luma-key', lumaThreshold } })
                  }
                  testId="luma-key-threshold"
                />
                <RangeNumberField
                  label={zhCN.inspector.fields.lumaTolerance}
                  value={chromaKey.lumaTolerance}
                  min={0}
                  max={1}
                  step={0.01}
                  format={(value) => value.toFixed(2)}
                  onCommit={(lumaTolerance) =>
                    commit({ chromaKey: { ...chromaKey, enabled: true, mode: 'luma-key', lumaTolerance } })
                  }
                  testId="luma-key-tolerance"
                />
                <RangeNumberField
                  label={zhCN.inspector.fields.lumaSoftness}
                  value={chromaKey.lumaSoftness}
                  min={0}
                  max={1}
                  step={0.01}
                  format={(value) => value.toFixed(2)}
                  onCommit={(lumaSoftness) =>
                    commit({ chromaKey: { ...chromaKey, enabled: true, mode: 'luma-key', lumaSoftness } })
                  }
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
                  onCommit={(differenceReferenceTime) =>
                    commit({
                      chromaKey: { ...chromaKey, enabled: true, mode: 'difference-matte', differenceReferenceTime },
                    })
                  }
                  testId="difference-matte-reference-time"
                />
                <RangeNumberField
                  label={zhCN.inspector.fields.differenceThreshold}
                  value={chromaKey.differenceThreshold}
                  min={0}
                  max={1}
                  step={0.01}
                  format={(value) => value.toFixed(2)}
                  onCommit={(differenceThreshold) =>
                    commit({
                      chromaKey: { ...chromaKey, enabled: true, mode: 'difference-matte', differenceThreshold },
                    })
                  }
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
            {privacyRedactions.length > 0 || true ? (
              <div className="mt-2 space-y-2" data-testid="privacy-redaction-panel">
                <div className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  {zhCN.inspector.privacyRedaction.title}
                </div>
                {privacyRedactions.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-md border border-line p-2 space-y-1"
                    data-testid={`privacy-redaction-item-${r.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-ink">
                        {zhCN.inspector.privacyRedaction.regions[r.type] ?? r.type}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          className="rounded p-1 text-xs hover:bg-panel"
                          type="button"
                          title={zhCN.inspector.privacyRedaction.toggle}
                          data-testid={`privacy-redaction-toggle-${r.id}`}
                          onClick={() => {
                            const updated = privacyRedactions.map((pr) =>
                              pr.id === r.id ? { ...pr, enabled: !pr.enabled } : pr,
                            );
                            commit({ privacyRedactions: updated });
                          }}
                        >
                          {r.enabled ? '✓' : '✗'}
                        </button>
                        <button
                          className="rounded p-1 text-xs text-red-500 hover:bg-red-50"
                          type="button"
                          title={zhCN.inspector.privacyRedaction.remove}
                          data-testid={`privacy-redaction-remove-${r.id}`}
                          onClick={() => {
                            commit({ privacyRedactions: privacyRedactions.filter((pr) => pr.id !== r.id) });
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <label className="block text-xs text-[var(--color-text-secondary)]">
                      <span>{zhCN.inspector.privacyRedaction.blurStrength}</span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={r.blurStrength}
                        className="mt-1 w-full"
                        data-testid={`privacy-redaction-blur-${r.id}`}
                        onChange={(e) => {
                          const updated = privacyRedactions.map((pr) =>
                            pr.id === r.id ? { ...pr, blurStrength: Number(e.target.value) } : pr,
                          );
                          commit({ privacyRedactions: updated });
                        }}
                      />
                    </label>
                  </div>
                ))}
                <button
                  className="w-full rounded-md border border-dashed border-line px-2 py-1.5 text-xs text-[var(--color-text-muted)] hover:border-brand hover:text-brand"
                  type="button"
                  data-testid="privacy-redaction-add"
                  onClick={() => {
                    commit({
                      privacyRedactions: [
                        ...privacyRedactions,
                        {
                          id: createId('redaction'),
                          type: 'face',
                          keyframes: [{ time: 0, x: 0.25, y: 0.25, w: 0.2, h: 0.25 }],
                          blurStrength: 1,
                          enabled: true,
                        },
                      ],
                    });
                  }}
                >
                  + {zhCN.inspector.privacyRedaction.addRegion}
                </button>
              </div>
            ) : null}
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
            <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
              <span>{zhCN.inspector.fields.targetFrameRate}</span>
              <select
                className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] disabled:cursor-not-allowed disabled:opacity-60"
                value={frameInterpolation.targetFps}
                disabled={frameInterpolationUnavailable || !frameInterpolation.enabled}
                onChange={(event) =>
                  commit({
                    frameInterpolation: {
                      ...frameInterpolation,
                      targetFps: Number(event.target.value) as typeof frameInterpolation.targetFps,
                    },
                  })
                }
                data-testid="frame-interpolation-fps-select"
              >
                {FRAME_INTERPOLATION_TARGET_FPS.map((fps) => (
                  <option key={fps} value={fps}>
                    {fps} fps
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
              <span>{zhCN.inspector.frameInterpolationCompare.modeLabel}</span>
              <select
                className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] disabled:cursor-not-allowed disabled:opacity-60"
                value={frameInterpolation.mode}
                disabled={frameInterpolationUnavailable || !frameInterpolation.enabled}
                onChange={(event) =>
                  commit({
                    frameInterpolation: { ...frameInterpolation, mode: event.target.value as FrameInterpolationMode },
                  })
                }
                data-testid="frame-interpolation-mode-select"
              >
                {FRAME_INTERPOLATION_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {zhCN.inspector.frameInterpolationCompare.modeLabels[mode]}
                  </option>
                ))}
              </select>
            </label>
            <NumberField
              label={zhCN.inspector.frameInterpolationCompare.protectionFrames}
              value={frameInterpolation.protectionFrames}
              min={0}
              max={5}
              step={1}
              disabled={frameInterpolationUnavailable || !frameInterpolation.enabled}
              onCommit={(protectionFrames) =>
                commit({ frameInterpolation: { ...frameInterpolation, protectionFrames } })
              }
              testId="frame-interpolation-protection-input"
            />
            <div
              className="rounded-md border border-line bg-panel p-2 text-xs text-[var(--color-text-secondary)]"
              data-testid="frame-interpolation-quality-status"
            >
              <div className="font-semibold text-ink">
                {zhCN.inspector.frameInterpolationCompare.qualityLabel}:
                {frameInterpolation.quality
                  ? zhCN.inspector.frameInterpolationCompare.qualityGrades[frameInterpolation.quality.grade]
                  : zhCN.inspector.frameInterpolationCompare.qualityNotEvaluated}
              </div>
              {frameInterpolation.quality ? (
                <div className="mt-1 text-[var(--color-text-secondary)]" data-testid="frame-interpolation-quality-ssim">
                  {zhCN.inspector.frameInterpolationCompare.qualitySsim(
                    frameInterpolation.quality.ssim,
                    frameInterpolation.quality.sampleCount,
                  )}
                </div>
              ) : null}
            </div>
            <button
              className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium text-ink hover:bg-panel disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              data-testid="frame-interpolation-quality-button"
              disabled={
                frameInterpolationQualityRunning ||
                frameInterpolationUnavailable ||
                !frameInterpolation.enabled ||
                !asset
              }
              onClick={() => void runFrameInterpolationQualityEvaluation()}
            >
              {frameInterpolationQualityRunning
                ? zhCN.inspector.frameInterpolationCompare.qualityRunning
                : zhCN.inspector.frameInterpolationCompare.qualityButton}
            </button>
            {frameInterpolationQualityError ? (
              <div
                className="rounded-md border border-red-200 bg-red-50 p-2 text-xs font-medium text-red-700"
                data-testid="frame-interpolation-quality-error"
              >
                {frameInterpolationQualityError}
              </div>
            ) : null}
            {frameInterpolationUnavailable ? (
              <div
                className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-800"
                data-testid="frame-interpolation-unavailable"
              >
                {zhCN.inspector.fields.frameInterpolationUnsupported}
              </div>
            ) : null}
            <button
              className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium text-ink hover:bg-panel disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              data-testid="frame-interpolation-compare-button"
              disabled={frameInterpolationCompareRunning || frameInterpolationUnavailable || !asset}
              onClick={() => void runFrameInterpolationComparePreview()}
            >
              {frameInterpolationCompareRunning
                ? zhCN.inspector.frameInterpolationCompare.running
                : zhCN.inspector.frameInterpolationCompare.button}
            </button>
            {frameInterpolationCompareError ? (
              <div
                className="rounded-md border border-red-200 bg-red-50 p-2 text-xs font-medium text-red-700"
                data-testid="frame-interpolation-compare-error"
              >
                {frameInterpolationCompareError}
              </div>
            ) : null}
            {frameInterpolationCompareItems.length > 0 ? (
              <div className="grid grid-cols-2 gap-2" data-testid="frame-interpolation-compare-grid">
                {frameInterpolationCompareItems.map((item) => (
                  <div
                    key={item.mode}
                    className="overflow-hidden rounded-md border border-line bg-[var(--color-bg-elevated)]"
                    data-testid={`frame-interpolation-compare-tile-${item.mode}`}
                  >
                    <button
                      type="button"
                      className="block aspect-video w-full bg-black"
                      onClick={() => setFrameInterpolationExpandedMode(item.mode)}
                      aria-label={zhCN.inspector.frameInterpolationCompare.zoom(item.label)}
                    >
                      <img
                        className="h-full w-full object-contain"
                        src={item.src}
                        alt={item.label}
                        data-testid="frame-interpolation-compare-image"
                      />
                    </button>
                    <div className="space-y-1 p-2">
                      <div className="flex items-center justify-between gap-2 text-xs font-semibold text-ink">
                        <span>{item.label}</span>
                        <span className="text-[var(--color-text-muted)]">
                          {formatEstimatedDuration(item.estimatedMs)}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="w-full rounded-md border border-line bg-panel px-2 py-1 text-xs font-medium text-ink hover:bg-[var(--color-bg-elevated)]"
                        data-testid={`frame-interpolation-select-${item.mode}`}
                        onClick={() =>
                          commit({ slowMotionMode: frameInterpolationCompareModeToSlowMotionMode(item.mode) })
                        }
                      >
                        {slowMotionMode === item.slowMotionMode
                          ? zhCN.inspector.frameInterpolationCompare.selected
                          : zhCN.inspector.frameInterpolationCompare.selectMode}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {frameInterpolationExpandedItem ? (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
                data-testid="frame-interpolation-compare-expanded"
                role="dialog"
                aria-modal="true"
              >
                <div className="max-h-full max-w-5xl rounded-md bg-[var(--color-bg-elevated)] p-3 shadow-xl">
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold text-ink">
                    <span>{frameInterpolationExpandedItem.label}</span>
                    <button
                      type="button"
                      className="rounded-md border border-line px-2 py-1 text-xs font-medium hover:bg-panel"
                      onClick={() => setFrameInterpolationExpandedMode(undefined)}
                    >
                      {zhCN.common.close}
                    </button>
                  </div>
                  <img
                    className="max-h-[70vh] max-w-full object-contain"
                    src={frameInterpolationExpandedItem.src}
                    alt={frameInterpolationExpandedItem.label}
                    data-testid="frame-interpolation-compare-expanded-image"
                  />
                </div>
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
            <div
              className="rounded-md border border-line bg-panel p-2 text-xs text-[var(--color-text-secondary)]"
              data-testid="stabilization-status"
            >
              {analysisProgress !== undefined && analysisProgress < 1
                ? zhCN.inspector.fields.stabilizationProgress(analysisProgress)
                : stabilization.analyzed
                  ? zhCN.inspector.fields.stabilizationAnalyzed
                  : zhCN.inspector.fields.stabilizationNotAnalyzed}
            </div>
            <button
              className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel"
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

        {clip.type === 'video' && (clip.stabilization?.shakeScore ?? 0) > 50 ? (
          <Section title={zhCN.preview.shakeAnalysisTitle}>
            <div
              className="rounded-md border border-line bg-panel p-2 text-xs text-[var(--color-text-secondary)]"
              data-testid="shake-analysis-panel"
            >
              <span data-testid="shake-analysis-severity">
                {zhCN.preview.shakeAnalysisScore(clip.stabilization?.shakeScore ?? 0)}
              </span>
            </div>
            <button
              className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel"
              type="button"
              data-testid="apply-shake-stabilization"
              onClick={() => {
                const cmd = new ApplyShakeStabilizationCommand(projectAccessor, clip.id, {
                  suggestedFilter: 'vidstab',
                });
                commandManager.execute(cmd);
              }}
            >
              {zhCN.preview.shakeAnalysisApplyAntiShake}
            </button>
          </Section>
        ) : null}

        {clip.type === 'video' && clip.aiPipSuggestion ? (
          <Section title={zhCN.preview.pipAvoidanceTitle}>
            <div
              className="rounded-md border border-line bg-panel p-2 text-xs text-[var(--color-text-secondary)]"
              data-testid="pip-avoidance-panel"
            >
              <span>{zhCN.preview.pipAvoidanceWarning}</span>
            </div>
            <button
              className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel"
              type="button"
              data-testid="apply-pip-placement"
              onClick={() => {
                const cmd = new ApplyPipPlacementCommand(
                  projectAccessor,
                  clip.id,
                  clip.aiPipSuggestion!.recommendedCorner,
                );
                commandManager.execute(cmd);
              }}
            >
              {zhCN.preview.pipAvoidanceApply}
            </button>
          </Section>
        ) : null}

        {clip.type === 'video' ? (
          <Section title={zhCN.inspector.sections.motionTrack}>
            <div
              className="rounded-md border border-line bg-panel p-2 text-xs text-[var(--color-text-secondary)]"
              data-testid="motion-track-status"
            >
              {motionTrackProgress !== undefined && motionTrackProgress < 1
                ? zhCN.inspector.motionTrack.progress(motionTrackProgress)
                : motionTrack.length > 0
                  ? zhCN.inspector.motionTrack.pointCount(motionTrack.length)
                  : zhCN.inspector.motionTrack.notAnalyzed}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={motionTrackingBusy}
                data-testid="analyze-motion-track-button"
                onClick={() => void runMotionTrackAnalysis()}
              >
                {zhCN.inspector.motionTrack.analyze}
              </button>
              <button
                className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={!motionTrackingBusy}
                data-testid="cancel-motion-track-button"
                onClick={() => void cancelMotionTrackAnalysis()}
              >
                {zhCN.inspector.motionTrack.cancel}
              </button>
            </div>
            <button
              className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
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
            <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
              <span>{zhCN.inspector.fields.referenceClip}</span>
              <select
                className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] disabled:cursor-not-allowed disabled:opacity-60"
                value={colorMatchReferenceClipId}
                disabled={colorMatchReferenceClips.length === 0 || colorMatchBusy}
                onChange={(event) => setColorMatchReferenceClipId(event.target.value)}
                data-testid="color-match-reference-select"
              >
                {colorMatchReferenceClips.length === 0 ? (
                  <option value="">{zhCN.inspector.colorMatch.noReference}</option>
                ) : null}
                {colorMatchReferenceClips.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-60"
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
            <div className="rounded-md bg-panel p-2 text-xs text-[var(--color-text-secondary)]">
              {asset.imageSequence.frameCount} PNG · {asset.imageSequence.pattern}
            </div>
            <RangeNumberField
              label={zhCN.inspector.fields.sequenceFrameRate}
              value={
                normalizeSequenceFrameRate(clip.sequenceFrameRate ?? asset.imageSequence.frameRate) ??
                asset.imageSequence.frameRate
              }
              min={1}
              max={120}
              step={1}
              format={(value) => `${value.toFixed(0)} fps`}
              onCommit={(frameRate) =>
                commit({ sequenceFrameRate: frameRate, duration: asset.imageSequence!.frameCount / frameRate })
              }
              testId="image-sequence-framerate"
            />
          </Section>
        ) : null}

        {batchKeyframesSelected ? (
          <Section title={zhCN.inspector.sections.keyframe}>
            <div
              className="rounded-md border border-line bg-panel p-2 text-xs text-[var(--color-text-secondary)]"
              data-testid="batch-keyframe-editor"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-semibold text-[var(--color-text-secondary)]">
                  {zhCN.inspector.batchKeyframes.title}
                </span>
                <span className="tabular-nums" data-testid="batch-keyframe-count">
                  {zhCN.inspector.batchKeyframes.count(selectedKeyframeEntries.length)}
                </span>
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
                  className="mb-0.5 rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel"
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
                  className="mb-0.5 rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel"
                  type="button"
                  data-testid="batch-keyframe-scale-button"
                  onClick={scaleSelectedKeyframes}
                >
                  {zhCN.inspector.batchKeyframes.applyScale}
                </button>
              </div>
              <label className="mt-2 block text-xs font-medium text-[var(--color-text-secondary)]">
                {zhCN.inspector.fields.easing}
                <select
                  className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                  value={batchEasing}
                  data-testid="batch-keyframe-easing-select"
                  onChange={(event) => setBatchEasing(event.target.value as KeyframeEasing)}
                >
                  <option value="linear">{zhCN.inspector.easing.linear}</option>
                  <option value="ease-in">{zhCN.inspector.easing.easeIn}</option>
                  <option value="ease-out">{zhCN.inspector.easing.easeOut}</option>
                  <option value="ease-in-out">{zhCN.inspector.easing.easeInOut}</option>
                  <option value="elastic">{zhCN.inspector.easing.elastic}</option>
                  <option value="bounce">{zhCN.inspector.easing.bounce}</option>
                </select>
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel"
                  type="button"
                  data-testid="batch-keyframe-easing-button"
                  onClick={updateSelectedKeyframeEasing}
                >
                  {zhCN.inspector.batchKeyframes.applyEasing}
                </button>
                <button
                  className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel"
                  type="button"
                  data-testid="batch-keyframe-distribute-time-button"
                  onClick={distributeSelectedKeyframes}
                >
                  {zhCN.inspector.batchKeyframes.distributeTime}
                </button>
                <button
                  className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel"
                  type="button"
                  data-testid="batch-keyframe-align-value-button"
                  onClick={alignSelectedKeyframeValues}
                >
                  {zhCN.inspector.batchKeyframes.alignValue}
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
            <div
              className="rounded-md border border-line bg-panel p-2 text-xs text-[var(--color-text-secondary)]"
              data-testid="selected-keyframe-editor"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-semibold text-[var(--color-text-secondary)]">
                  {formatKeyframeProperty(selectedKeyframe.property)}
                </span>
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
              <div className="mt-2 grid grid-cols-2 gap-2">
                <ExpressionNumberField
                  label={zhCN.inspector.fields.preciseTime}
                  value={selectedKeyframeFrame.time}
                  format={(value) => `${value.toFixed(2)}s`}
                  onCommit={(expression) => updateSelectedKeyframeExpression('time', expression)}
                  testId="selected-keyframe-time-expression"
                />
                <ExpressionNumberField
                  label={zhCN.inspector.fields.preciseValue}
                  value={selectedKeyframeFrame.value}
                  format={(value) => formatKeyframeValue(selectedKeyframe.property, value)}
                  onCommit={(expression) => updateSelectedKeyframeExpression('value', expression)}
                  testId="selected-keyframe-value-expression"
                />
              </div>
              <label className="mt-2 block text-xs font-medium text-[var(--color-text-secondary)]">
                {zhCN.inspector.fields.easing}
                <select
                  className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                  value={selectedKeyframeFrame.easing}
                  data-testid="selected-keyframe-easing"
                  onChange={(event) => updateSelectedKeyframe({ easing: event.target.value as KeyframeEasing })}
                >
                  <option value="linear">{zhCN.inspector.easing.linear}</option>
                  <option value="ease-in">{zhCN.inspector.easing.easeIn}</option>
                  <option value="ease-out">{zhCN.inspector.easing.easeOut}</option>
                  <option value="ease-in-out">{zhCN.inspector.easing.easeInOut}</option>
                  <option value="elastic">{zhCN.inspector.easing.elastic}</option>
                  <option value="bounce">{zhCN.inspector.easing.bounce}</option>
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
            <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
              {zhCN.inspector.fields.property}
              <select
                className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
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
            <ToggleField
              label={zhCN.inspector.sections.kenBurns}
              checked={Boolean(clip.kenBurns)}
              onCommit={setKenBurns}
              testId="ken-burns-toggle"
            />
            {clip.kenBurns ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-line bg-panel p-2 text-xs text-[var(--color-text-secondary)]">
                  <div className="mb-1 font-semibold">{zhCN.inspector.fields.startScale}</div>
                  <div>{Math.round((clip.keyframes?.scaleX?.[0]?.value ?? clip.transform.scale) * 100)}%</div>
                </div>
                <div className="rounded-md border border-line bg-panel p-2 text-xs text-[var(--color-text-secondary)]">
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
            <summary className="mb-2 cursor-pointer text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
              {zhCN.inspector.sections.videoRestoration}
            </summary>
            <div className="space-y-3">
              <div className="rounded-md border border-line bg-panel p-2">
                <ToggleField
                  label={zhCN.inspector.fields.deinterlace}
                  checked={videoRestoration.deinterlace.enabled}
                  onCommit={(enabled) =>
                    updateVideoRestoration({ deinterlace: { ...videoRestoration.deinterlace, enabled } })
                  }
                  testId="video-restoration-deinterlace-toggle"
                />
                <label className="mt-2 block text-xs font-medium text-[var(--color-text-secondary)]">
                  {zhCN.inspector.fields.deinterlaceMode}
                  <select
                    className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                    value={videoRestoration.deinterlace.mode}
                    data-testid="video-restoration-deinterlace-mode"
                    onChange={(event) =>
                      updateVideoRestoration({
                        deinterlace: {
                          ...videoRestoration.deinterlace,
                          mode: Number(event.target.value) as VideoDeinterlaceMode,
                        },
                      })
                    }
                  >
                    <option value={0}>{zhCN.inspector.videoRestoration.deinterlaceModes.sendFrame}</option>
                    <option value={1}>{zhCN.inspector.videoRestoration.deinterlaceModes.sendField}</option>
                  </select>
                </label>
                {deinterlaceSuggestion !== null && !videoRestoration.deinterlace.enabled ? (
                  <div
                    className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800"
                    data-testid="video-restoration-deinterlace-suggestion"
                  >
                    <div>{zhCN.inspector.videoRestoration.deinterlaceSuggestion(asset?.fieldOrder ?? '')}</div>
                    <button
                      className="mt-2 rounded-md border border-amber-300 bg-[var(--color-bg-elevated)] px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                      type="button"
                      data-testid="video-restoration-apply-deinterlace-suggestion"
                      onClick={() =>
                        updateVideoRestoration({ deinterlace: { enabled: true, mode: deinterlaceSuggestion } })
                      }
                    >
                      {zhCN.inspector.videoRestoration.applySuggestion}
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="rounded-md border border-line bg-panel p-2">
                <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                  {zhCN.inspector.fields.temporalDenoisePreset}
                  <select
                    className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                    value={videoRestoration.temporalDenoise.preset}
                    data-testid="video-restoration-temporal-preset"
                    onChange={(event) =>
                      updateVideoRestoration({
                        temporalDenoise: {
                          ...videoRestoration.temporalDenoise,
                          preset: event.target.value as VideoDenoisePreset,
                        },
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
                      onCommit={(lumaSpatial) =>
                        updateVideoRestoration({
                          temporalDenoise: { ...videoRestoration.temporalDenoise, lumaSpatial },
                        })
                      }
                      testId="video-restoration-luma-spatial"
                    />
                    <RangeNumberField
                      label={zhCN.inspector.fields.chromaSpatial}
                      value={videoRestoration.temporalDenoise.chromaSpatial}
                      min={0}
                      max={20}
                      step={0.1}
                      format={(value) => value.toFixed(1)}
                      onCommit={(chromaSpatial) =>
                        updateVideoRestoration({
                          temporalDenoise: { ...videoRestoration.temporalDenoise, chromaSpatial },
                        })
                      }
                      testId="video-restoration-chroma-spatial"
                    />
                    <RangeNumberField
                      label={zhCN.inspector.fields.lumaTmp}
                      value={videoRestoration.temporalDenoise.lumaTmp}
                      min={0}
                      max={20}
                      step={0.1}
                      format={(value) => value.toFixed(1)}
                      onCommit={(lumaTmp) =>
                        updateVideoRestoration({ temporalDenoise: { ...videoRestoration.temporalDenoise, lumaTmp } })
                      }
                      testId="video-restoration-luma-tmp"
                    />
                  </div>
                ) : null}
              </div>

              <div className="rounded-md border border-line bg-panel p-2">
                <ToggleField
                  label={zhCN.inspector.fields.spatialDenoise}
                  checked={videoRestoration.spatialDenoise.enabled}
                  onCommit={(enabled) =>
                    updateVideoRestoration({ spatialDenoise: { ...videoRestoration.spatialDenoise, enabled } })
                  }
                  testId="video-restoration-spatial-toggle"
                />
                {videoRestoration.spatialDenoise.enabled ? (
                  <div className="mt-2 space-y-2" data-testid="video-restoration-spatial-controls">
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                      {zhCN.inspector.videoRestoration.spatialWarning}
                    </div>
                    <RangeNumberField
                      label={zhCN.inspector.fields.spatialStrength}
                      value={videoRestoration.spatialDenoise.strength}
                      min={0}
                      max={30}
                      step={0.1}
                      format={(value) => value.toFixed(1)}
                      onCommit={(strength) =>
                        updateVideoRestoration({ spatialDenoise: { ...videoRestoration.spatialDenoise, strength } })
                      }
                      testId="video-restoration-spatial-strength"
                    />
                    <RangeNumberField
                      label={zhCN.inspector.fields.patchSize}
                      value={videoRestoration.spatialDenoise.patchSize}
                      min={1}
                      max={99}
                      step={2}
                      format={(value) => value.toFixed(0)}
                      onCommit={(patchSize) =>
                        updateVideoRestoration({ spatialDenoise: { ...videoRestoration.spatialDenoise, patchSize } })
                      }
                      testId="video-restoration-patch-size"
                    />
                    <RangeNumberField
                      label={zhCN.inspector.fields.researchSize}
                      value={videoRestoration.spatialDenoise.researchSize}
                      min={1}
                      max={99}
                      step={2}
                      format={(value) => value.toFixed(0)}
                      onCommit={(researchSize) =>
                        updateVideoRestoration({ spatialDenoise: { ...videoRestoration.spatialDenoise, researchSize } })
                      }
                      testId="video-restoration-research-size"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </details>
        ) : null}

        {clip.type === 'video' ? (
          <details className="mb-4" open data-testid="quality-enhancement-section">
            <summary className="mb-2 cursor-pointer text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
              {zhCN.inspector.sections.qualityEnhancement}
            </summary>
            <div className="space-y-3 rounded-md border border-line bg-panel p-2">
              <ToggleField
                label={zhCN.inspector.qualityEnhancement.superResolution}
                checked={qualityEnhancement.superResolution}
                onCommit={(superResolution) => updateQualityEnhancement({ superResolution })}
                testId="quality-enhancement-super-resolution-toggle"
              />
              <ToggleField
                label={zhCN.inspector.qualityEnhancement.deblock}
                checked={qualityEnhancement.deblock}
                onCommit={(deblock) => updateQualityEnhancement({ deblock })}
                testId="quality-enhancement-deblock-toggle"
              />
              <ToggleField
                label={zhCN.inspector.qualityEnhancement.colorBoost}
                checked={qualityEnhancement.colorBoost}
                onCommit={(colorBoost) => updateQualityEnhancement({ colorBoost })}
                testId="quality-enhancement-color-boost-toggle"
              />
              <ToggleField
                label={zhCN.inspector.qualityEnhancement.frameCompensation}
                checked={qualityEnhancement.frameCompensation}
                onCommit={(frameCompensation) => updateQualityEnhancement({ frameCompensation })}
                testId="quality-enhancement-frame-compensation-toggle"
              />
            </div>
          </details>
        ) : null}

        {clip.type !== 'audio' ? (
          <details className="mb-4" open>
            <summary className="mb-2 cursor-pointer text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
              {zhCN.inspector.fields.colorCorrection}
            </summary>
            <div className="space-y-3">
              <label className="block rounded-md border border-line bg-panel p-2 text-xs font-medium text-[var(--color-text-secondary)]">
                <span>{zhCN.inspector.fields.inputColorSpace}</span>
                <select
                  className="mt-1 w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5"
                  value={colorCorrection.inputColorSpace ?? 'rec709'}
                  onChange={(event) =>
                    commit({ colorCorrection: { inputColorSpace: event.target.value as InputColorSpace } })
                  }
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
              <div
                className="rounded-md border border-line bg-panel p-2 text-xs text-[var(--color-text-secondary)]"
                data-testid="clip-lut-control"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--color-text-secondary)]">LUT</span>
                  {colorCorrection.lutPath ? (
                    <button
                      className="rounded border border-line bg-[var(--color-bg-elevated)] p-1 hover:bg-[var(--color-bg-elevated)]"
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
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-[var(--color-bg-elevated)]"
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
              <AIColorGradingPanel clip={clip} sourcePath={asset?.path ?? ''} selectedClipLocked={selectedClipLocked} />
              <AILookMatchPanel clip={clip} />
            </div>
          </details>
        ) : null}

        {clip.type !== 'audio' ? (
          <details className="mb-4" open>
            <summary className="mb-2 cursor-pointer text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
              {zhCN.inspector.sections.curves}
            </summary>
            <CurveEditor
              curves={colorCurves}
              onCommit={(nextCurves) => commit({ colorCorrection: { colorCurves: nextCurves } })}
            />
          </details>
        ) : null}

        {clip.type !== 'audio' ? (
          <details className="mb-4">
            <summary className="mb-2 cursor-pointer text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
              {zhCN.inspector.sections.colorWheels}
            </summary>
            <ThreeWayColorEditor
              threeWayColor={threeWayColor}
              onCommit={(nextColor) => commit({ colorCorrection: { threeWayColor: nextColor } })}
            />
          </details>
        ) : null}

        {clip.type !== 'audio' ? (
          <details className="mb-4">
            <summary className="mb-2 cursor-pointer text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
              调色
            </summary>
            <ColorGradingWorkspace
              graph={clip.colorGradingGraph}
              onGraphChange={(graph) => commit({ colorGradingGraph: graph })}
            />
          </details>
        ) : null}

        {clip.type !== 'audio' ? (
          <details className="mb-4" open>
            <summary className="mb-2 cursor-pointer text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
              专业调色面板
            </summary>
            <ProfessionalColorGradingPanel
              clip={clip}
              onCommitColorCorrection={(patch: Partial<import('@open-factory/editor-core').ColorCorrection>) =>
                commit({ colorCorrection: patch })
              }
              onChooseLUT={() => void chooseLut()}
            />
          </details>
        ) : null}

        {clip.type !== 'audio' ? (
          <details className="mb-4">
            <summary className="mb-2 cursor-pointer text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
              {zhCN.inspector.sections.effects}
            </summary>
            <EffectsEditor
              effects={clip.effects ?? []}
              onAdd={(type) =>
                runEffectCommand(
                  new AddEffectCommand(timelineAccessor, clip.id, { type, params: DEFAULT_EFFECT_PARAMS[type] }),
                )
              }
              onRemove={(effectId) => runEffectCommand(new RemoveEffectCommand(timelineAccessor, clip.id, effectId))}
              onUpdate={(effectId, patch) =>
                runEffectCommand(new UpdateEffectCommand(timelineAccessor, clip.id, effectId, patch))
              }
              onReorder={(effectIds) =>
                runEffectCommand(new ReorderEffectsCommand(timelineAccessor, clip.id, effectIds))
              }
            />
          </details>
        ) : null}

        {'volume' in clip ? (
          <Section title={zhCN.inspector.sections.audio}>
            <AnimatedField
              label={zhCN.inspector.fields.volume}
              onAddKeyframe={() => addKeyframe('volume')}
              testId="add-volume-keyframe-button"
            >
              <RangeField
                label={zhCN.inspector.fields.volume}
                value={clip.volume}
                min={0}
                max={2}
                step={0.01}
                format={(value) => `${Math.round(value * 100)}%`}
                onCommit={(volume) => commit({ volume })}
                hideLabel
                testId="clip-volume-input"
              />
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
            <ToggleField
              label={zhCN.inspector.fields.reverseAudio}
              checked={reverseAudio}
              onCommit={(nextReverseAudio) => commit({ reverseAudio: nextReverseAudio })}
              testId="clip-reverse-audio-toggle"
            />
            <details
              className="rounded-md border border-line bg-[var(--color-bg-elevated)]"
              data-testid="audio-advanced-restoration-section"
              open
            >
              <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">
                {t('inspector.sections.audioRestoration')}
              </summary>
              <div className="space-y-3 border-t border-line p-2">
                <ToggleField
                  label={t('inspector.fields.audioRestorationDeclip')}
                  checked={audioRestoration.declip.enabled}
                  onCommit={(enabled) => updateAudioRestoration({ declip: { ...audioRestoration.declip, enabled } })}
                  testId="audio-restoration-declip-toggle"
                />
                <ToggleField
                  label={t('inspector.fields.audioRestorationDereverb')}
                  checked={audioRestoration.dereverb.enabled}
                  onCommit={(enabled) =>
                    updateAudioRestoration({ dereverb: { ...audioRestoration.dereverb, enabled } })
                  }
                  testId="audio-restoration-dereverb-toggle"
                />
                <RangeNumberField
                  label={t('inspector.fields.strength')}
                  value={audioRestoration.dereverb.strength}
                  min={0}
                  max={1}
                  step={0.05}
                  format={(value) => `${Math.round(value * 100)}%`}
                  disabled={!audioRestoration.dereverb.enabled}
                  onCommit={(strength) =>
                    updateAudioRestoration({ dereverb: { ...audioRestoration.dereverb, strength } })
                  }
                  testId="audio-restoration-dereverb-strength"
                />
                <ToggleField
                  label={t('inspector.fields.audioRestorationDewind')}
                  checked={audioRestoration.dewind.enabled}
                  onCommit={(enabled) => updateAudioRestoration({ dewind: { ...audioRestoration.dewind, enabled } })}
                  testId="audio-restoration-dewind-toggle"
                />
                <ToggleField
                  label={t('inspector.fields.audioRestorationFill')}
                  checked={audioRestoration.fill.enabled}
                  onCommit={(enabled) => updateAudioRestoration({ fill: { ...audioRestoration.fill, enabled } })}
                  testId="audio-restoration-fill-toggle"
                />
                <AudioRestorationWaveformPreview
                  before={audioRestorationComparison.before}
                  after={audioRestorationComparison.after}
                />
              </div>
            </details>
            <details
              className="rounded-md border border-line bg-[var(--color-bg-elevated)]"
              data-testid="audio-channel-routing-section"
              open
            >
              <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">
                {zhCN.inspector.fields.audioChannelRouting}
              </summary>
              <div className="border-t border-line p-2">
                <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                  {zhCN.inspector.fields.audioChannelRoutingMode}
                  <select
                    className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
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
            <details
              className="rounded-md border border-line bg-[var(--color-bg-elevated)]"
              data-testid="pitch-analysis-section"
              open
            >
              <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">
                {zhCN.inspector.sections.pitchAnalysis}
              </summary>
              <div className="space-y-2 border-t border-line p-2">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded bg-panel p-2">
                    <div className="text-[var(--color-text-muted)]">{zhCN.inspector.fields.primaryPitchNote}</div>
                    <div className="font-semibold text-ink" data-testid="clip-pitch-primary-note">
                      {pitchSummary.primaryNote ?? zhCN.inspector.pitchAnalysis.noData}
                    </div>
                  </div>
                  <div className="rounded bg-panel p-2">
                    <div className="text-[var(--color-text-muted)]">{zhCN.inspector.fields.pitchRange}</div>
                    <div className="font-semibold text-ink" data-testid="clip-pitch-range">
                      {pitchSummary.minHz !== undefined && pitchSummary.maxHz !== undefined
                        ? `${Math.round(pitchSummary.minHz)}-${Math.round(pitchSummary.maxHz)} Hz`
                        : zhCN.inspector.pitchAnalysis.noData}
                    </div>
                  </div>
                  <div className="rounded bg-panel p-2">
                    <div className="text-[var(--color-text-muted)]">{zhCN.inspector.fields.pitchStability}</div>
                    <div
                      className="font-semibold text-ink"
                      data-testid="clip-pitch-stability"
                    >{`${Math.round(pitchSummary.stability * 100)}%`}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    disabled={selectedClipLocked || pitchAnalyzing || !asset}
                    onClick={runPitchAnalysis}
                    data-testid="clip-pitch-analyze-button"
                  >
                    {pitchAnalyzing ? zhCN.inspector.pitchAnalysis.analyzing : zhCN.inspector.pitchAnalysis.analyze}
                  </button>
                  <button
                    className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    disabled={!clip.pitchData || clip.pitchData.length === 0}
                    onClick={exportPitchCsv}
                    data-testid="clip-pitch-export-csv-button"
                  >
                    {zhCN.inspector.pitchAnalysis.exportCsv}
                  </button>
                </div>
              </div>
            </details>
            <details
              className="rounded-md border border-line bg-[var(--color-bg-elevated)]"
              data-testid="spatial-audio-section"
              open
            >
              <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">
                {t('inspector.sections.spatialAudio')}
              </summary>
              <div className="space-y-3 border-t border-line p-2">
                <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                  {t('inspector.fields.spatialRenderMode')}
                  <select
                    className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                    value={spatialAudio.renderMode}
                    data-testid="clip-spatial-render-mode-select"
                    onChange={(event) =>
                      commit({
                        spatialAudio: { ...spatialAudio, renderMode: event.target.value as SpatialAudioRenderMode },
                      })
                    }
                  >
                    {spatialRenderModeOptions.map((mode) => (
                      <option key={mode} value={mode}>
                        {t(`inspector.spatialRenderModes.${mode}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <AnimatedField
                    label={t('inspector.fields.spatialX')}
                    onAddKeyframe={() => addKeyframe('spatialX', spatialAudio.x)}
                    testId="add-spatial-x-keyframe-button"
                  >
                    <RangeNumberField
                      label={t('inspector.fields.spatialX')}
                      value={spatialAudio.x}
                      min={-1}
                      max={1}
                      step={0.01}
                      format={(value) => value.toFixed(2)}
                      onCommit={(x) => commit({ spatialAudio: { ...spatialAudio, x } })}
                      testId="clip-spatial-x-input"
                    />
                  </AnimatedField>
                  <AnimatedField
                    label={t('inspector.fields.spatialY')}
                    onAddKeyframe={() => addKeyframe('spatialY', spatialAudio.y)}
                    testId="add-spatial-y-keyframe-button"
                  >
                    <RangeNumberField
                      label={t('inspector.fields.spatialY')}
                      value={spatialAudio.y}
                      min={-1}
                      max={1}
                      step={0.01}
                      format={(value) => value.toFixed(2)}
                      onCommit={(y) => commit({ spatialAudio: { ...spatialAudio, y } })}
                      testId="clip-spatial-y-input"
                    />
                  </AnimatedField>
                </div>
                <RangeNumberField
                  label={t('inspector.fields.spatialZ')}
                  value={spatialAudio.z}
                  min={-1}
                  max={1}
                  step={0.01}
                  format={(value) => value.toFixed(2)}
                  onCommit={(z) => commit({ spatialAudio: { ...spatialAudio, z } })}
                  testId="clip-spatial-z-input"
                />
                <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                  {t('inspector.fields.spatialDistance')}
                  <select
                    className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                    value={spatialAudio.distance}
                    data-testid="clip-spatial-distance-select"
                    onChange={(event) =>
                      commit({
                        spatialAudio: { ...spatialAudio, distance: event.target.value as SpatialAudioDistance },
                      })
                    }
                  >
                    {spatialDistanceOptions.map((distance) => (
                      <option key={distance} value={distance}>
                        {t(`inspector.spatialDistanceOptions.${distance}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <AnimatedField
                    label={t('inspector.fields.spatialAzimuth')}
                    onAddKeyframe={() => addKeyframe('spatialAzimuth', spatialAudio.azimuth)}
                    testId="add-spatial-azimuth-keyframe-button"
                  >
                    <RangeNumberField
                      label={t('inspector.fields.spatialAzimuth')}
                      value={spatialAudio.azimuth}
                      min={-180}
                      max={180}
                      step={1}
                      format={(value) => `${Math.round(value)}°`}
                      onCommit={(azimuth) =>
                        commit({ spatialAudio: { ...spatialAudio, renderMode: 'binaural', azimuth } })
                      }
                      testId="clip-spatial-azimuth-input"
                    />
                  </AnimatedField>
                  <AnimatedField
                    label={t('inspector.fields.spatialElevation')}
                    onAddKeyframe={() => addKeyframe('spatialElevation', spatialAudio.elevation)}
                    testId="add-spatial-elevation-keyframe-button"
                  >
                    <RangeNumberField
                      label={t('inspector.fields.spatialElevation')}
                      value={spatialAudio.elevation}
                      min={-90}
                      max={90}
                      step={1}
                      format={(value) => `${Math.round(value)}°`}
                      onCommit={(elevation) =>
                        commit({ spatialAudio: { ...spatialAudio, renderMode: 'binaural', elevation } })
                      }
                      testId="clip-spatial-elevation-input"
                    />
                  </AnimatedField>
                </div>
                <AnimatedField
                  label={t('inspector.fields.spatialDistanceMeters')}
                  onAddKeyframe={() => addKeyframe('spatialDistanceMeters', spatialAudio.distanceMeters)}
                  testId="add-spatial-distance-meters-keyframe-button"
                >
                  <RangeNumberField
                    label={t('inspector.fields.spatialDistanceMeters')}
                    value={spatialAudio.distanceMeters}
                    min={0.1}
                    max={100}
                    step={0.1}
                    format={(value) => `${value.toFixed(1)} m`}
                    onCommit={(distanceMeters) =>
                      commit({ spatialAudio: { ...spatialAudio, renderMode: 'binaural', distanceMeters } })
                    }
                    testId="clip-spatial-distance-meters-input"
                  />
                </AnimatedField>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                  {t('inspector.fields.spatialRoomModel')}
                  <select
                    className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                    value={spatialAudio.roomModel}
                    data-testid="clip-spatial-room-model-select"
                    onChange={(event) =>
                      commit({
                        spatialAudio: { ...spatialAudio, roomModel: event.target.value as SpatialAudioRoomModel },
                      })
                    }
                  >
                    {spatialRoomOptions.map((room) => (
                      <option key={room} value={room}>
                        {t(`inspector.spatialRoomModels.${room}`)}
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
              <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                {zhCN.inspector.fields.fadeInCurve}
                <select
                  className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                  value={fadeInCurve}
                  onChange={(event) => commit({ fadeInCurve: event.target.value as AudioFadeCurve })}
                  data-testid="clip-fade-in-curve-select"
                >
                  <option value="linear">{zhCN.inspector.easing.linear}</option>
                  <option value="ease-in">{zhCN.inspector.easing.easeIn}</option>
                  <option value="ease-out">{zhCN.inspector.easing.easeOut}</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                {zhCN.inspector.fields.fadeOutCurve}
                <select
                  className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
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

        {clip.type === 'text' || clip.type === 'subtitle' || clip.type === 'credits' ? (
          <Section
            title={
              clip.type === 'subtitle'
                ? zhCN.inspector.sections.subtitle
                : clip.type === 'credits'
                  ? zhCN.inspector.sections.credits
                  : zhCN.inspector.sections.text
            }
          >
            {clip.type === 'text' ? (
              <RichTextEditor
                clip={clip}
                disabled={selectedClipLocked}
                onCommit={(richText) => commit({ text: richTextToPlainText(richText, clip.text), richText })}
              />
            ) : (
              <TextAreaField
                label={zhCN.inspector.fields.text}
                value={clip.text}
                onCommit={(text) => commit({ text })}
                testId="clip-text-input"
              />
            )}
            <NumberField
              label={zhCN.inspector.fields.fontSize}
              value={clip.style.fontSize}
              min={8}
              step={1}
              onCommit={(fontSize) => commit({ style: { fontSize } })}
            />
            <TextField
              label={zhCN.inspector.fields.fontFamily}
              value={clip.style.fontFamily}
              onCommit={(fontFamily) => commit({ style: { fontFamily } })}
            />
            <ColorField
              label={zhCN.inspector.fields.color}
              value={clip.style.color}
              onCommit={(color) => commit({ style: { color } })}
              testId={clip.type === 'subtitle' ? 'subtitle-color-input' : undefined}
            />
            <ColorField
              label={zhCN.inspector.fields.background}
              value={clip.style.backgroundColor}
              onCommit={(backgroundColor) => commit({ style: { backgroundColor } })}
              testId="clip-background-color-input"
            />
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
            {clip.type === 'credits' ? (
              <>
                <NumberField
                  label={zhCN.inspector.fields.rollSpeed}
                  value={clip.rollSpeed}
                  min={1}
                  max={1000}
                  step={1}
                  onCommit={(rollSpeed) => commit({ rollSpeed })}
                  testId="credits-roll-speed-input"
                />
                <NumberField
                  label={zhCN.inspector.fields.lineSpacing}
                  value={clip.style.lineSpacing}
                  min={0}
                  max={120}
                  step={1}
                  onCommit={(lineSpacing) => commit({ style: { lineSpacing } })}
                  testId="credits-line-spacing-input"
                />
                <NumberField
                  label={zhCN.inspector.fields.horizontalMargin}
                  value={clip.style.horizontalMargin}
                  min={0}
                  max={960}
                  step={1}
                  onCommit={(horizontalMargin) => commit({ style: { horizontalMargin } })}
                  testId="credits-horizontal-margin-input"
                />
              </>
            ) : null}
            {clip.type === 'subtitle' ? (
              <>
                <div
                  className="space-y-3 rounded-md border border-line bg-[var(--color-bg-elevated)] p-2"
                  data-testid="subtitle-cc-panel"
                >
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                    {zhCN.inspector.closedCaptions.kind}
                    <select
                      className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                      value={subtitleType}
                      data-testid="subtitle-type-select"
                      onChange={(event) => commitSubtitleType(event.target.value === 'cc' ? 'cc' : 'subtitle')}
                    >
                      <option value="subtitle">{zhCN.inspector.closedCaptions.standard}</option>
                      <option value="cc">{zhCN.inspector.closedCaptions.cc}</option>
                    </select>
                  </label>
                  {subtitleType === 'cc' ? (
                    <>
                      <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                        {zhCN.inspector.closedCaptions.speaker}
                        <input
                          className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                          defaultValue={activeSpeaker}
                          list={`subtitle-speakers-${clip.id}`}
                          placeholder={zhCN.inspector.closedCaptions.speakerPlaceholder}
                          data-testid="subtitle-speaker-input"
                          onBlur={(event) => commitCcSpeaker(event.target.value)}
                        />
                        <datalist id={`subtitle-speakers-${clip.id}`}>
                          {projectSpeakers.map((speaker) => (
                            <option key={speaker.id} value={speaker.name} />
                          ))}
                        </datalist>
                      </label>
                      {projectSpeakers.length > 0 ? (
                        <div className="space-y-1" data-testid="subtitle-speaker-library">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                            {zhCN.inspector.closedCaptions.speakerLibrary}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {projectSpeakers.map((speaker) => (
                              <button
                                key={speaker.id}
                                className="rounded border border-line px-2 py-1 text-xs hover:bg-panel"
                                type="button"
                                data-testid="subtitle-speaker-chip"
                                onClick={() => commitCcSpeaker(speaker.name)}
                              >
                                {speaker.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-panel disabled:opacity-40"
                          type="button"
                          disabled={!activeSpeaker || Boolean(activeSpeakerEntry)}
                          data-testid="subtitle-add-speaker-button"
                          onClick={addActiveSpeakerToLibrary}
                        >
                          {zhCN.inspector.closedCaptions.addSpeaker}
                        </button>
                        <button
                          className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-panel disabled:opacity-40"
                          type="button"
                          disabled={!activeSpeakerEntry}
                          data-testid="subtitle-remove-speaker-button"
                          onClick={removeActiveSpeakerFromLibrary}
                        >
                          {zhCN.inspector.closedCaptions.removeSpeaker}
                        </button>
                      </div>
                      {activeSpeakerEntry ? (
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                          {zhCN.inspector.closedCaptions.speakerColor}
                          <input
                            className="mt-1 h-9 w-full rounded-md border border-line px-2 py-1"
                            type="color"
                            value={activeSpeakerEntry.color ?? '#2563eb'}
                            data-testid="subtitle-speaker-color-input"
                            onChange={(event) => updateActiveSpeakerColor(event.target.value)}
                          />
                        </label>
                      ) : null}
                      <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                        {zhCN.inspector.closedCaptions.soundDesc}
                        <select
                          className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                          value={soundDescSelectValue}
                          data-testid="subtitle-sound-desc-select"
                          onChange={(event) => {
                            const value = event.target.value;
                            if (value === 'custom') {
                              setCustomSoundDescOpen(true);
                              return;
                            }
                            setCustomSoundDescOpen(false);
                            commitCcSoundDesc(value || undefined);
                          }}
                        >
                          <option value="">{zhCN.inspector.closedCaptions.soundDescNone}</option>
                          {soundDescriptionOptions.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                          <option value="custom">{zhCN.inspector.closedCaptions.soundDescCustom}</option>
                        </select>
                      </label>
                      {soundDescSelectValue === 'custom' || customSoundDescOpen ? (
                        <TextField
                          label={zhCN.inspector.closedCaptions.customSoundDesc}
                          value={clip.soundDesc ?? ''}
                          testId="subtitle-custom-sound-desc-input"
                          onCommit={(soundDesc) => {
                            setCustomSoundDescOpen(false);
                            commitCcSoundDesc(soundDesc);
                          }}
                        />
                      ) : null}
                    </>
                  ) : null}
                </div>
                <details
                  className="rounded-md border border-line bg-[var(--color-bg-elevated)]"
                  data-testid="data-subtitle-section"
                  open
                >
                  <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">
                    {zhCN.inspector.sections.dataSubtitle}
                  </summary>
                  <div className="space-y-2 border-t border-line p-2">
                    <TextAreaField
                      label={zhCN.inspector.fields.dataSubtitleTemplate}
                      value={clip.dataSubtitle?.template ?? clip.text}
                      testId="data-subtitle-template-input"
                      onCommit={updateDataSubtitleTemplate}
                    />
                    <div
                      className="rounded bg-panel p-2 text-xs text-[var(--color-text-secondary)]"
                      data-testid="data-subtitle-source-summary"
                    >
                      {clip.dataSubtitle
                        ? zhCN.inspector.dataSubtitle.summary(
                            clip.dataSubtitle.sourceType,
                            clip.dataSubtitle.rows.length,
                          )
                        : zhCN.inspector.dataSubtitle.notBound}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
                        type="button"
                        disabled={selectedClipLocked}
                        onClick={() => void bindDataSubtitleSource()}
                        data-testid="data-subtitle-bind-button"
                      >
                        {zhCN.inspector.dataSubtitle.bind}
                      </button>
                      <button
                        className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
                        type="button"
                        disabled={selectedClipLocked || !clip.dataSubtitle}
                        onClick={clearDataSubtitleSource}
                        data-testid="data-subtitle-clear-button"
                      >
                        {zhCN.inspector.dataSubtitle.clear}
                      </button>
                    </div>
                  </div>
                </details>
                <SubtitleStyleTemplatesPanel
                  templates={subtitleStyleTemplates}
                  onApply={applySubtitleStyleTemplate}
                  onSave={saveCurrentSubtitleStyleTemplate}
                  onDelete={deleteSubtitleStyleTemplate}
                  onAddToSharedLibrary={(template) => void addSubtitleStyleTemplateToSharedLibrary(template)}
                />
                <AISubtitleStylePanel
                  clip={clip}
                  media={media}
                  subtitleTrack={subtitleTrack}
                  selectedClipLocked={selectedClipLocked}
                />
                <ColorField
                  label={zhCN.inspector.fields.outlineColor}
                  value={clip.style.outlineColor}
                  onCommit={(outlineColor) => commit({ style: { outlineColor } })}
                  testId="subtitle-outline-color-input"
                />
                <NumberField
                  label={zhCN.inspector.fields.outlineWidth}
                  value={clip.style.outlineWidth}
                  min={0}
                  max={12}
                  step={1}
                  onCommit={(outlineWidth) => commit({ style: { outlineWidth } })}
                  testId="subtitle-outline-width-input"
                />
                <ColorField
                  label={zhCN.inspector.fields.shadowColor}
                  value={clip.style.shadowColor}
                  onCommit={(shadowColor) => commit({ style: { shadowColor } })}
                  testId="subtitle-shadow-color-input"
                />
                <NumberField
                  label={zhCN.inspector.fields.shadowOffset}
                  value={clip.style.shadowOffset}
                  min={0}
                  max={24}
                  step={1}
                  onCommit={(shadowOffset) => commit({ style: { shadowOffset } })}
                  testId="subtitle-shadow-offset-input"
                />
                <button
                  className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled={!isTranslationConfigured(translationSettings) || Boolean(subtitleTranslationProgress)}
                  data-testid="subtitle-translate-button"
                  onClick={() => void translateSubtitleTrack()}
                >
                  {subtitleTranslationProgress
                    ? zhCN.inspector.translation.progress(
                        subtitleTranslationProgress.completed,
                        subtitleTranslationProgress.total,
                      )
                    : zhCN.inspector.translation.button}
                </button>
                {!isTranslationConfigured(translationSettings) ? (
                  <div
                    className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-800"
                    data-testid="subtitle-translation-not-configured"
                  >
                    {translationApiKeyError || zhCN.inspector.translation.notConfigured}
                  </div>
                ) : null}
                {subtitleTranslationProgress ? (
                  <div
                    className="rounded-md bg-panel p-2 text-xs text-[var(--color-text-secondary)]"
                    data-testid="subtitle-translation-progress"
                  >
                    {zhCN.inspector.translation.progress(
                      subtitleTranslationProgress.completed,
                      subtitleTranslationProgress.total,
                    )}
                  </div>
                ) : null}
                <NumberField
                  label={zhCN.inspector.fields.bottomMargin}
                  value={clip.style.yOffset}
                  min={0}
                  step={1}
                  onCommit={(yOffset) => commit({ style: { yOffset } })}
                />
                <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                  {zhCN.inspector.fields.exportMode}
                  <select
                    className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                    value={clip.subtitleMode}
                    data-testid="subtitle-mode-select"
                    onChange={(event) =>
                      commit({ subtitleMode: event.target.value === 'soft-sub' ? 'soft-sub' : 'burn-in' })
                    }
                  >
                    <option value="burn-in">{zhCN.inspector.subtitleMode.burnIn}</option>
                    <option value="soft-sub">{zhCN.inspector.subtitleMode.softSub}</option>
                  </select>
                </label>
                <SubtitleProofreadingPanel
                  clip={clip}
                  selectedSubtitleClips={selectedSubtitleClips.length > 0 ? selectedSubtitleClips : [clip]}
                  selectedClipLocked={selectedClipLocked}
                  projectSettings={projectSettings}
                />
                <SubtitleRetimingPanel
                  clip={clip}
                  selectedSubtitleClips={selectedSubtitleClips.length > 0 ? selectedSubtitleClips : [clip]}
                  projectSettings={projectSettings}
                />
                <SubtitleAIPolishPanel
                  selectedSubtitleClips={selectedSubtitleClips.length > 0 ? selectedSubtitleClips : [clip]}
                  selectedClipLocked={selectedClipLocked}
                />
                <ChapterTitleAIPanel
                  allSubtitleClips={allTimelineSubtitleClips}
                  totalDuration={getTimelineDuration(project.timeline)}
                  selectedClipLocked={selectedClipLocked}
                />
              </>
            ) : null}
            {clip.type === 'text' ? (
              <details
                className="rounded-md border border-line bg-[var(--color-bg-elevated)]"
                data-testid="advanced-text-layout-section"
                open
              >
                <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">
                  {zhCN.inspector.sections.typography}
                </summary>
                <div className="space-y-3 border-t border-line p-2">
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                    {zhCN.inspector.fields.textFitMode}
                    <select
                      className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                      value={textLayout?.fitMode ?? DEFAULT_TEXT_LAYOUT.fitMode}
                      disabled={selectedClipLocked}
                      data-testid="text-fit-mode-select"
                      onChange={(event) => updateTextLayout({ fitMode: event.target.value as TextBoxFitMode })}
                    >
                      <option value="fixed">{zhCN.inspector.textLayout.fitModes.fixed}</option>
                      <option value="auto-height">{zhCN.inspector.textLayout.fitModes.autoHeight}</option>
                      <option value="auto-scale">{zhCN.inspector.textLayout.fitModes.autoScale}</option>
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <NumberField
                      label={zhCN.inspector.fields.boxWidth}
                      value={textLayout?.boxWidth ?? DEFAULT_TEXT_LAYOUT.boxWidth}
                      min={24}
                      max={4096}
                      step={1}
                      disabled={selectedClipLocked}
                      onCommit={(boxWidth) => updateTextLayout({ boxWidth })}
                      testId="text-box-width-input"
                    />
                    <NumberField
                      label={zhCN.inspector.fields.boxHeight}
                      value={textLayout?.boxHeight ?? DEFAULT_TEXT_LAYOUT.boxHeight}
                      min={24}
                      max={4096}
                      step={1}
                      disabled={selectedClipLocked}
                      onCommit={(boxHeight) => updateTextLayout({ boxHeight })}
                      testId="text-box-height-input"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <NumberField
                      label={zhCN.inspector.fields.paragraphSpacing}
                      value={textLayout?.paragraphSpacing ?? DEFAULT_TEXT_LAYOUT.paragraphSpacing}
                      min={0}
                      max={240}
                      step={1}
                      disabled={selectedClipLocked}
                      onCommit={(paragraphSpacing) => updateTextLayout({ paragraphSpacing })}
                      testId="text-paragraph-spacing-input"
                    />
                    <NumberField
                      label={zhCN.inspector.fields.firstLineIndent}
                      value={textLayout?.firstLineIndent ?? DEFAULT_TEXT_LAYOUT.firstLineIndent}
                      min={-960}
                      max={960}
                      step={1}
                      disabled={selectedClipLocked}
                      onCommit={(firstLineIndent) => updateTextLayout({ firstLineIndent })}
                      testId="text-first-line-indent-input"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <ToggleField
                      label={zhCN.inspector.fields.openTypeLiga}
                      checked={textOpenTypeFeatures?.liga ?? DEFAULT_TEXT_OPEN_TYPE_FEATURES.liga}
                      disabled={selectedClipLocked}
                      onCommit={(liga) => updateTextOpenTypeFeatures({ liga })}
                      testId="text-opentype-liga-toggle"
                    />
                    <ToggleField
                      label={zhCN.inspector.fields.openTypeSmcp}
                      checked={textOpenTypeFeatures?.smcp ?? DEFAULT_TEXT_OPEN_TYPE_FEATURES.smcp}
                      disabled={selectedClipLocked}
                      onCommit={(smcp) => updateTextOpenTypeFeatures({ smcp })}
                      testId="text-opentype-smcp-toggle"
                    />
                    <ToggleField
                      label={zhCN.inspector.fields.openTypeTnum}
                      checked={textOpenTypeFeatures?.tnum ?? DEFAULT_TEXT_OPEN_TYPE_FEATURES.tnum}
                      disabled={selectedClipLocked}
                      onCommit={(tnum) => updateTextOpenTypeFeatures({ tnum })}
                      testId="text-opentype-tnum-toggle"
                    />
                    <ToggleField
                      label={zhCN.inspector.fields.openTypeSwsh}
                      checked={textOpenTypeFeatures?.swsh ?? DEFAULT_TEXT_OPEN_TYPE_FEATURES.swsh}
                      disabled={selectedClipLocked}
                      onCommit={(swsh) => updateTextOpenTypeFeatures({ swsh })}
                      testId="text-opentype-swsh-toggle"
                    />
                  </div>
                  <ToggleField
                    label={zhCN.inspector.fields.arcTextMode}
                    checked={textArc?.enabled ?? DEFAULT_TEXT_ARC.enabled}
                    disabled={selectedClipLocked}
                    onCommit={(enabled) => updateTextArc({ enabled })}
                    testId="arc-text-toggle"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <NumberField
                      label={zhCN.inspector.fields.arcTextRadius}
                      value={textArc?.radius ?? DEFAULT_TEXT_ARC.radius}
                      min={24}
                      max={4000}
                      step={1}
                      disabled={selectedClipLocked}
                      onCommit={(radius) => updateTextArc({ radius })}
                      testId="arc-text-radius-input"
                    />
                    <NumberField
                      label={zhCN.inspector.fields.arcTextStartAngle}
                      value={textArc?.startAngle ?? DEFAULT_TEXT_ARC.startAngle}
                      min={-360}
                      max={360}
                      step={1}
                      disabled={selectedClipLocked}
                      onCommit={(startAngle) => updateTextArc({ startAngle })}
                      testId="arc-text-start-angle-input"
                    />
                  </div>
                  <ToggleField
                    label={zhCN.inspector.fields.arcTextRotateCharacters}
                    checked={textArc?.rotateCharacters ?? DEFAULT_TEXT_ARC.rotateCharacters}
                    disabled={selectedClipLocked}
                    onCommit={(rotateCharacters) => updateTextArc({ rotateCharacters })}
                    testId="arc-text-rotate-toggle"
                  />
                </div>
              </details>
            ) : null}
            {clip.type === 'text' ? (
              <details
                className="rounded-md border border-line bg-[var(--color-bg-elevated)]"
                data-testid="path-text-section"
                open
              >
                <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">
                  {zhCN.inspector.sections.pathText}
                </summary>
                <div className="space-y-3 border-t border-line p-2">
                  <ToggleField
                    label={zhCN.inspector.fields.pathTextMode}
                    checked={textPath?.enabled ?? false}
                    onCommit={(enabled) => updateTextPath({ enabled })}
                    testId="path-text-toggle"
                  />
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
                  <ToggleField
                    label={zhCN.inspector.fields.pathTextRotateCharacters}
                    checked={textPath?.rotateCharacters ?? true}
                    onCommit={(rotateCharacters) => updateTextPath({ rotateCharacters })}
                    testId="path-text-rotate-toggle"
                  />
                  <div
                    className="rounded-md bg-panel p-2 text-xs text-[var(--color-text-secondary)]"
                    data-testid="path-text-point-summary"
                  >
                    {zhCN.inspector.fields.pathPointCount(textPath?.path.length ?? DEFAULT_TEXT_PATH.path.length)}
                  </div>
                  <button
                    className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-panel"
                    type="button"
                    data-testid="path-text-offset-keyframe-button"
                    onClick={() =>
                      addKeyframe('pathStartOffset', textPath?.startOffset ?? DEFAULT_TEXT_PATH.startOffset)
                    }
                  >
                    {zhCN.inspector.pathText.addOffsetKeyframe}
                  </button>
                </div>
              </details>
            ) : null}
            {clip.type === 'text' ? (
              <details
                className="rounded-md border border-line bg-[var(--color-bg-elevated)]"
                data-testid="text-animation-section"
                open
              >
                <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">
                  {zhCN.inspector.sections.textAnimation}
                </summary>
                <div className="space-y-3 border-t border-line p-2">
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                    {zhCN.inspector.fields.animationPreset}
                    <select
                      className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
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
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                    {zhCN.inspector.fields.animationDirection}
                    <select
                      className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
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
                  <div
                    className="rounded-md bg-panel p-2 text-xs text-[var(--color-text-secondary)]"
                    data-testid="text-animation-keyframe-summary"
                  >
                    {zhCN.inspector.textAnimation.keyframeCount(textAnimationKeyframeCount)}
                  </div>
                  <button
                    className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-panel"
                    type="button"
                    data-testid="apply-text-animation-button"
                    onClick={applyTextAnimation}
                  >
                    {zhCN.inspector.textAnimation.apply}
                  </button>
                </div>
              </details>
            ) : null}
            <ToggleField
              label={zhCN.inspector.fields.bold}
              checked={clip.style.bold}
              onCommit={(bold) => commit({ style: { bold } })}
            />
            <ToggleField
              label={zhCN.inspector.fields.italic}
              checked={clip.style.italic}
              onCommit={(italic) => commit({ style: { italic } })}
            />
            {clip.type === 'text' || clip.type === 'subtitle' ? (
              <button
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-line bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-panel"
                type="button"
                data-testid="text-clip-tts-voiceover"
                onClick={() =>
                  generateTtsVoiceover([{ id: clip.id, text: clip.text, start: clip.start, duration: clip.duration }])
                }
              >
                <Mic size={14} />
                {zhCN.aiTts.textToVoiceover}
              </button>
            ) : null}
          </Section>
        ) : null}
        {'mediaId' in clip ? (
          <AISceneMatchPanel
            clip={clip}
            media={media}
            timelineClips={project.timeline.tracks.flatMap((track) => track.clips)}
            selectedClipLocked={selectedClipLocked}
          />
        ) : null}
        {'mediaId' in clip && (clip.type === 'audio' || clip.type === 'video') ? (
          <AIDenoisePanel
            clip={clip}
            trackId={project.timeline.tracks.find((t) => t.clips.some((c) => c.id === clip.id))?.id ?? ''}
            onUpdateTrack={(trackId, patch) => {
              const newTracks = project.timeline.tracks.map((t) => (t.id === trackId ? { ...t, ...patch } : t));
              useEditorStore.getState().setProject({
                ...project,
                timeline: { ...project.timeline, tracks: newTracks },
              });
              useEditorStore.getState().setSelectedClipIds([clip.id]);
            }}
          />
        ) : null}
        {clip.type === 'subtitle' ? (
          <AIBrollSuggestionPanel
            clip={clip}
            trackId={project.timeline.tracks.find((t) => t.clips.some((c) => c.id === clip.id))?.id ?? ''}
            allClips={project.timeline.tracks.flatMap((t) => t.clips.map((c) => ({ ...c, trackId: t.id })))}
            allMedia={media}
            onInsertSuggestion={(suggestion) => {
              const newTrack = {
                id: 'broll-track-' + Date.now(),
                name: 'B-roll',
                type: 'video' as const,
                clips: [
                  {
                    id: 'broll-clip-' + Date.now(),
                    type: 'video' as const,
                    trackId: 'broll-track-' + Date.now(),
                    start: suggestion.insertTime,
                    duration: 3,
                    mediaId: suggestion.mediaId,
                    name: 'B-roll',
                    trimStart: 0,
                    trimEnd: 0,
                    speed: 1,
                    volume: 1,
                    colorCorrection: { brightness: 0, contrast: 0, saturation: 0, hue: 0 },
                    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
                  },
                ],
              };
              useEditorStore.getState().setProject({
                ...project,
                timeline: {
                  ...project.timeline,
                  tracks: [...project.timeline.tracks, newTrack],
                  brollSuggestions: (project.timeline.brollSuggestions ?? []).map((s) =>
                    s.segmentId === suggestion.segmentId && s.mediaId === suggestion.mediaId
                      ? { ...s, status: 'accepted' as const }
                      : s,
                  ),
                },
              });
              useEditorStore.getState().setSelectedClipIds([clip.id]);
            }}
            onUpdateSuggestions={(suggestions) => {
              useEditorStore.getState().setProject({
                ...project,
                timeline: {
                  ...project.timeline,
                  brollSuggestions: suggestions,
                },
              });
              useEditorStore.getState().setSelectedClipIds([clip.id]);
            }}
          />
        ) : null}
      </div>
    </aside>
  );
});
