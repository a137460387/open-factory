import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { Clip, MediaAsset } from '@open-factory/editor-core';
import {
  AddSubtitleClipCommand,
  AddTrackCommand,
  AddKeyframeCommand,
  AddEffectCommand,
  AddMaskCommand,
  DEFAULT_EFFECT_PARAMS,
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_THREE_WAY_COLOR,
  EFFECT_TYPES,
  FRAME_INTERPOLATION_TARGET_FPS,
  INPUT_COLOR_SPACES,
  KEYFRAME_PROPERTY_LIMITS,
  MAX_CLIP_SPEED,
  MIN_CLIP_SPEED,
  RemoveEffectCommand,
  RemoveMaskCommand,
  RemoveKeyframeCommand,
  ReorderEffectsCommand,
  UpdateEffectCommand,
  UpdateKeyframeCommand,
  UpdateClipCommand,
  UpdateMaskCommand,
  createDefaultColorCurves,
  createId,
  createKenBurnsKeyframes,
  getClipSpeed,
  getClipKeyframeValue,
  getTransformScaleX,
  getTransformScaleY,
  normalizeAudioDenoise,
  normalizeChromaKey,
  normalizeColorCurves,
  normalizeColorCorrection,
  normalizeColorWheelValue,
  normalizeCurvePoints,
  normalizeFrameInterpolation,
  normalizeMasks,
  normalizeSequenceFrameRate,
  normalizeStabilization,
  normalizeThreeWayColor,
  sampleCurve,
  setKenBurnsEndScaleKeyframes,
  createTrack,
  type ClipPatch,
  type ColorCurves,
  type ColorWheelValue,
  type CurvePoint,
  type Effect,
  type EffectType,
  type EffectPatch,
  type InputColorSpace,
  type KeyframeEasing,
  type KeyframeProperty,
  type ClipMask,
  type MaskPatch,
  type ThreeWayColor
} from '@open-factory/editor-core';
import { ArrowDown, ArrowUp, GripVertical, Palette, Plus, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { zhCN } from '../../i18n/strings';
import { commandManager, timelineAccessor } from '../../store/commandManager';
import { analyzeClip, bridgeConfirm, getFfmpegCapabilities, listenBridge, openFileDialog, type ClipAnalysisProgressEvent } from '../../lib/tauri-bridge';
import { buildClipColorMatchCurves } from '../../lib/colorMatch';
import { acceptTranslationTOS, subtitleClipsToTranslationItems, translateSubtitleItems } from '../../lib/subtitleTranslation';
import { showToast } from '../../lib/toast';
import { useEditorStore, type SelectedKeyframeRef } from '../../store/editorStore';
import { isTranslationConfigured, useTranslationSettingsStore } from '../../store/translationSettingsStore';

interface InspectorProps {
  clip?: Clip;
  selectedCount: number;
  selectedClipLocked: boolean;
  selectedKeyframe?: SelectedKeyframeRef;
  media: MediaAsset[];
  playheadTime: number;
}

export function Inspector({ clip, selectedCount, selectedClipLocked, selectedKeyframe, media, playheadTime }: InspectorProps) {
  if (!clip && selectedCount > 1) {
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

  const asset = 'mediaId' in clip ? media.find((item) => item.id === clip.mediaId) : undefined;
  const project = useEditorStore((state) => state.project);
  const setSelectedClipIds = useEditorStore((state) => state.setSelectedClipIds);
  const translationProvider = useTranslationSettingsStore((state) => state.provider);
  const translationApiKey = useTranslationSettingsStore((state) => state.apiKey);
  const translationTargetLanguage = useTranslationSettingsStore((state) => state.targetLanguage);
  const translationSettings = useMemo(
    () => ({ provider: translationProvider, apiKey: translationApiKey, targetLanguage: translationTargetLanguage }),
    [translationApiKey, translationProvider, translationTargetLanguage]
  );
  const [analysisProgress, setAnalysisProgress] = useState<number | undefined>();
  const [frameInterpolationSupported, setFrameInterpolationSupported] = useState<boolean | undefined>();
  const [audioDenoiseSupported, setAudioDenoiseSupported] = useState<boolean | undefined>();
  const [colorMatchReferenceClipId, setColorMatchReferenceClipId] = useState<string>('');
  const [colorMatchBusy, setColorMatchBusy] = useState(false);
  const [subtitleTranslationProgress, setSubtitleTranslationProgress] = useState<{ completed: number; total: number }>();
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
  const colorCorrection = normalizeColorCorrection(clip.colorCorrection);
  const chromaKey = normalizeChromaKey(clip.chromaKey);
  const stabilization = normalizeStabilization(clip.stabilization);
  const frameInterpolation = normalizeFrameInterpolation(clip.frameInterpolation);
  const frameInterpolationUnavailable = frameInterpolationSupported === false;
  const audioDenoise = normalizeAudioDenoise(clip.audioDenoise);
  const audioDenoiseUnavailable = audioDenoiseSupported === false;
  const masks = normalizeMasks(clip.masks);
  const colorCurves = normalizeColorCurves(colorCorrection.colorCurves);
  const threeWayColor = normalizeThreeWayColor(colorCorrection.threeWayColor);
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listenBridge<ClipAnalysisProgressEvent>('clip-analysis-progress', (payload) => {
      if (payload.clipId === clip.id) {
        setAnalysisProgress(payload.progress);
      }
    }).then((dispose) => {
      if (disposed) {
        dispose();
      } else {
        unlisten = dispose;
      }
    });
    return () => {
      disposed = true;
      unlisten?.();
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
  const addMask = () => runEffectCommand(new AddMaskCommand(timelineAccessor, clip.id));
  const updateMask = (maskId: string, patch: MaskPatch) => runEffectCommand(new UpdateMaskCommand(timelineAccessor, clip.id, maskId, patch));
  const removeMask = (maskId: string) => runEffectCommand(new RemoveMaskCommand(timelineAccessor, clip.id, maskId));
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
              <div>{asset.missing ? zhCN.inspector.missingFile : `${asset.width || '-'} x ${asset.height || '-'} | ${asset.duration.toFixed(2)}s`}</div>
            </div>
          ) : null}
        </Section>

        {clip.type === 'video' || clip.type === 'audio' ? (
          <Section title={zhCN.inspector.sections.speed}>
            <div className="rounded-md bg-panel p-2 text-xs text-slate-600">
              速度 {getClipSpeed(clip).toFixed(2)}x / 时长 {clip.duration.toFixed(2)}s
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

        {clip.type === 'video' || clip.type === 'image' || clip.type === 'nested-sequence' ? (
          <Section title={zhCN.inspector.sections.chromaKey}>
            <ToggleField
              label={zhCN.inspector.fields.enabled}
              checked={chromaKey.enabled}
              onCommit={(enabled) => commit({ chromaKey: { ...chromaKey, enabled } })}
              testId="chroma-key-toggle"
            />
            <ColorField
              label={zhCN.inspector.fields.chromaKeyColor}
              value={rgbToHex(chromaKey.color)}
              onCommit={(color) => commit({ chromaKey: { ...chromaKey, color: hexToRgb(color) } })}
              testId="chroma-key-color"
            />
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
          </Section>
        ) : null}

        {clip.type === 'video' || clip.type === 'image' || clip.type === 'nested-sequence' ? (
          <Section title={zhCN.inspector.sections.masks}>
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
              <RangeField label={zhCN.inspector.fields.volume} value={clip.volume} min={0} max={2} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onCommit={(volume) => commit({ volume })} hideLabel />
            </AnimatedField>
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
              </>
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
              </select>
            </label>
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
              {getEffectParamConfig(effect.type).map((param) => (
                <RangeNumberField
                  key={param.key}
                  label={param.label}
                  value={effect.params[param.key] ?? DEFAULT_EFFECT_PARAMS[effect.type][param.key]}
                  min={param.min}
                  max={param.max}
                  step={param.step}
                  format={(value) => value.toFixed(param.step < 1 ? 2 : 0)}
                  onCommit={(value) => onUpdate(effect.id, { params: { [param.key]: value } })}
                  testId={`effect-param-${effect.id}-${param.key}`}
                />
              ))}
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
  if (property === 'opacity' || property === 'volume' || property === 'scaleX' || property === 'scaleY') {
    return `${Math.round(value * 100)}%`;
  }
  return value.toFixed(2);
}
