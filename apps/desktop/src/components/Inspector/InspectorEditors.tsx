import {
  EASING_PRESETS,
  getEasingPresetsByCategory,
  getPresetHandles,
  isStepsPreset,
  applyStepsEasing,
  type EasingPreset,
  type EasingPresetCategory,
} from '@open-factory/editor-core';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import DOMPurify from 'dompurify';
import type { Clip, Project, ProjectSettings } from '@open-factory/editor-core';
import {
  BatchProofreadSubtitleCommand,
  BatchShiftSubtitleCommand,
  BatchSubtitleTimingCommand,
  UpdateClipCommand,
  BUILTIN_AUDIO_VISUALIZATION_THEMES,
  CUSTOM_SHADER_EXAMPLES,
  AUDIO_SPECTRUM_POSITIONS,
  AUDIO_SPECTRUM_STYLES,
  DEFAULT_EFFECT_PARAMS,
  DEFAULT_SUBTITLE_PROOFREADING_SETTINGS,
  DEFAULT_THREE_WAY_COLOR,
  EFFECT_TYPES,
  KEYFRAME_PROPERTY_LIMITS,
  MANUAL_AUDIO_VISUALIZATION_THEME_ID,
  MAX_CLIP_SPEED,
  MIN_CLIP_SPEED,
  MOTION_BLUR_SAMPLE_COUNTS,
  MOTION_GRAPHIC_TEMPLATE_TYPES,
  applyKeyframeHandlePatch,
  calculateBezierHandleCoordinates,
  calculateKeyframeSpeedSamples,
  analyzeSubtitleProofreading,
  buildSubtitleProofreadingFixes,
  serializeSubtitleProofreadingCsv,
  calculateSubtitleBatchAdjustUpdates,
  calculateSubtitlePeakAlignUpdate,
  calculateSubtitleScaleUpdates,
  createDefaultColorCurves,
  createDefaultMotionGraphic,
  createId,
  getClipSpeed,
  getEffectNumberParam,
  getEffectStringParam,
  getMotionGraphicTemplateDefinition,
  getTimelineDuration,
  interpolateKeyframes,
  normalizeAudioSpectrumParams,
  normalizeColorCurves,
  normalizeColorWheelValue,
  normalizeCurvePoints,
  normalizeCustomShaderParams,
  normalizeMotionBlurParams,
  normalizeMotionGraphic,
  normalizePrivacyBlurEffect,
  normalizeRichTextDocument,
  normalizeThreeWayColor,
  renderSubtitleStyleTemplatePreview,
  richTextToPlainText,
  sampleCurve,
  secondsToTimecode,
  setMotionGraphicParam,
  setMotionGraphicParamKeyframe,
  type ClipSlowMotionMode,
  type ColorCurves,
  type ColorWheelValue,
  type CurvePoint,
  type Effect,
  type EffectType,
  type EffectPatch,
  type ClipMask,
  type FrameInterpolationCompareMode,
  type InputColorSpace,
  type Keyframe,
  type KeyframeEasing,
  type KeyframeHandleMode,
  type KeyframeProperty,
  type MaskPatch,
  type MotionGraphicParamDefinition,
  type MotionGraphicParamValue,
  type MotionGraphicTemplateType,
  type PrivacyBlurEffect,
  type RichTextDocument,
  type RichTextRun,
  type SubtitleProofreadingIssue,
  type SubtitleProofreadingIssueType,
  type SubtitleStyleTemplate,
  type ThreeWayColor,
} from '@open-factory/editor-core';
import { ArrowDown, ArrowUp, Bold, GripVertical, Italic, Plus, Trash2, Underline } from 'lucide-react';
import { t, zhCN } from '../../i18n/strings';
import { commandManager, timelineAccessor } from '../../store/commandManager';
import { saveFileDialog, writeFile } from '../../lib/tauri-bridge';
import { validateCustomShaderSource } from '../../lib/preview/custom-shader';
import { showToast } from '../../lib/toast';
import { useEditorStore, type SelectedKeyframeRef } from '../../store/editorStore';
import { resolveSliderKeyboardValue } from '../../accessibility/keyboard-navigation';
import { SubtitleStyleTemplatesPanel, SubtitleProofreadingPanel, SubtitleRetimingPanel, getSubtitleStyleTemplateLabel, mergeSubtitleStyleTemplateViews, makeSvgDataUri, getSubtitleProofreadingIssueLabel } from './SubtitleEditors';
import { SpeedCurveEditor, EasingPresetSelector, KeyframeCurveEditor, CurveEditor, CURVE_CHANNELS, getCurveEditorFrames, normalizeCurveEditorFrames, drawKeyframeCurveCanvas, drawKeyframeVelocityCanvas, getInterpolatedCurveEditorValue, findNearestCurveHandle, findNearestCurveFrameIdByPoint, nextHandleMode, getKeyframeFallbackForCurve, eventToCurveEditorFrame, eventToCanvasPoint, curveFrameToPoint, findNearestCurveFrame, getCurveFrameIdsInBox, getSpeedCurveFrames, normalizeSpeedCurveFrames, eventToSpeedFrame, drawSpeedCurveCanvas, speedFrameToPoint, findNearestSpeedFrame, roundFinite, drawCurveCanvas, eventToCurvePoint, findNearestCurvePoint, drawColorWheel, eventToUnitPoint, wheelPointToOffsets, wheelOffsetsToPoint, hsvToRgb, clampUnit, clampSigned } from './CurveEditors';
import { EffectsEditor, TextField, TextAreaField, CustomShaderEffectFields, AudioSpectrumEffectFields, MotionBlurEffectFields, formatMotionGraphicNumberValue, NumberField as EffectNumberField, RangeField, RangeNumberField, ExpressionNumberField, ColorField, ToggleField, formatNumberInputValue } from './EffectEditors';
import { ThreeWayColorEditor, ColorWheelControl, THREE_WAY_CHANNELS } from './ColorEditors';
import { RichTextEditor, parseRichTextFromElement, collectRichTextRuns, richTextToHtml, richTextRunToHtml, isParagraphNode, normalizeCssColorForModel, escapeHtml, escapeHtmlAttribute } from './RichTextEditor';
import { MotionGraphicPanel } from './MotionGraphicPanel';
import { MasksEditor } from './MasksEditor';

// Re-export extracted components for backward compatibility
export { SubtitleStyleTemplatesPanel, SubtitleProofreadingPanel, SubtitleRetimingPanel, getSubtitleStyleTemplateLabel, mergeSubtitleStyleTemplateViews, makeSvgDataUri, getSubtitleProofreadingIssueLabel } from './SubtitleEditors';
export { SpeedCurveEditor, EasingPresetSelector, KeyframeCurveEditor, CurveEditor, CURVE_CHANNELS, getCurveEditorFrames, normalizeCurveEditorFrames, drawKeyframeCurveCanvas, drawKeyframeVelocityCanvas, getInterpolatedCurveEditorValue, findNearestCurveHandle, findNearestCurveFrameIdByPoint, nextHandleMode, getKeyframeFallbackForCurve, eventToCurveEditorFrame, eventToCanvasPoint, curveFrameToPoint, findNearestCurveFrame, getCurveFrameIdsInBox, getSpeedCurveFrames, normalizeSpeedCurveFrames, eventToSpeedFrame, drawSpeedCurveCanvas, speedFrameToPoint, findNearestSpeedFrame, roundFinite, drawCurveCanvas, eventToCurvePoint, findNearestCurvePoint, drawColorWheel, eventToUnitPoint, wheelPointToOffsets, wheelOffsetsToPoint, hsvToRgb, clampUnit, clampSigned } from './CurveEditors';
export { EffectsEditor, TextField, TextAreaField, CustomShaderEffectFields, AudioSpectrumEffectFields, MotionBlurEffectFields, formatMotionGraphicNumberValue, NumberField as EffectNumberField, RangeField, RangeNumberField, ExpressionNumberField, ColorField, ToggleField, formatNumberInputValue } from './EffectEditors';
export { ThreeWayColorEditor, ColorWheelControl, THREE_WAY_CHANNELS } from './ColorEditors';
export { RichTextEditor, parseRichTextFromElement, collectRichTextRuns, richTextToHtml, richTextRunToHtml, isParagraphNode, normalizeCssColorForModel, escapeHtml, escapeHtmlAttribute } from './RichTextEditor';
export { MotionGraphicPanel } from './MotionGraphicPanel';
export { MasksEditor } from './MasksEditor';

export interface FrameInterpolationComparePreviewViewItem {
  mode: FrameInterpolationCompareMode;
  label: string;
  outputPath: string;
  src: string;
  estimatedMs: number;
  slowMotionMode: ClipSlowMotionMode;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-3">
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
        {title}
      </h2>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

export function AudioRestorationWaveformPreview({ before, after }: { before: number[]; after: number[] }) {
  const count = Math.max(before.length, after.length);
  const bars = Array.from({ length: count }, (_, index) => ({
    before: before[index] ?? 0,
    after: after[index] ?? before[index] ?? 0,
  }));

  return (
    <div className="space-y-1.5" data-testid="audio-restoration-waveform-preview">
      <div className="flex items-center gap-3 text-[11px] font-medium text-[var(--color-text-muted)]">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[var(--color-border)]" />
          {t('inspector.fields.audioRestorationBefore')}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          {t('inspector.fields.audioRestorationAfter')}
        </span>
      </div>
      <div className="flex h-14 items-end gap-0.5 rounded border border-line bg-panel px-1.5 py-1.5">
        {bars.map((bar, index) => (
          <div key={index} className="relative h-full min-w-0 flex-1">
            <div
              className="absolute bottom-0 left-0 right-0 rounded-sm bg-[var(--color-border)]"
              style={{ height: `${Math.max(4, Math.round(bar.before * 100))}%` }}
            />
            <div
              className="absolute bottom-0 left-1/4 right-1/4 rounded-sm bg-emerald-500/80"
              style={{ height: `${Math.max(4, Math.round(bar.after * 100))}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function buildAudioRestorationPreviewPeaks(pitchData: Clip['pitchData']): number[] {
  if (pitchData && pitchData.length > 0) {
    const sample = pitchData.slice(0, 32);
    const minHz = Math.min(...sample.map((point) => point.hz));
    const maxHz = Math.max(...sample.map((point) => point.hz));
    const span = Math.max(1, maxHz - minHz);
    return sample.map((point) => 0.2 + ((point.hz - minHz) / span) * 0.75);
  }
  return Array.from({ length: 32 }, (_, index) =>
    Math.min(0.95, Math.max(0.08, 0.48 + Math.sin(index * 0.72) * 0.22 + Math.cos(index * 0.31) * 0.12)),
  );
}

export function PrivacyBlurPanel({
  effect,
  modelConfigured,
  busy,
  disabled,
  onEffectChange,
  onRun,
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
      <div className="text-xs font-semibold text-[var(--color-text-secondary)]">{t.title}</div>
      <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
        {zhCN.inspector.fields.privacyBlurEffect}
        <select
          className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
          value={effect}
          data-testid="privacy-blur-effect-select"
          onChange={(event) => onEffectChange(normalizePrivacyBlurEffect(event.target.value as PrivacyBlurEffect))}
        >
          <option value="pixelize">{t.effects.pixelize}</option>
          <option value="gblur">{t.effects.gblur}</option>
          <option value="solid">{t.effects.solid}</option>
        </select>
      </label>
      {!modelConfigured ? (
        <div className="text-xs font-medium text-amber-700" data-testid="privacy-blur-model-required">
          {t.modelRequired}
        </div>
      ) : null}
      <button
        className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
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

export function joinLocalPath(basePath: string, childPath: string): string {
  const separator = basePath.includes('\\') ? '\\' : '/';
  return `${basePath.replace(/[\\/]+$/, '')}${separator}${childPath.replace(/^[\\/]+/, '')}`;
}

export function formatEstimatedDuration(durationMs: number): string {
  const safeMs = Math.max(0, Math.round(Number.isFinite(durationMs) ? durationMs : 0));
  if (safeMs < 1000) {
    return zhCN.inspector.frameInterpolationCompare.estimatedMs(safeMs);
  }
  return zhCN.inspector.frameInterpolationCompare.estimatedSeconds((safeMs / 1000).toFixed(1));
}

export function rgbToHex(color: readonly number[]): string {
  return `#${[color[0], color[1], color[2]]
    .map((channel) =>
      Math.round(Math.min(255, Math.max(0, channel)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

export function hexToRgb(value: string): [number, number, number] {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(value.trim());
  const hex = match ? match[1] : '00ff00';
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

export function getEffectParamConfig(
  type: EffectType,
): Array<{ key: string; label: string; min: number; max: number; step: number }> {
  if (type === 'blur') {
    return [{ key: 'radius', label: zhCN.inspector.fields.radius, min: 1, max: 50, step: 1 }];
  }
  if (type === 'sharpen') {
    return [{ key: 'strength', label: zhCN.inspector.fields.strength, min: 0, max: 3, step: 0.05 }];
  }
  if (type === 'vignette') {
    return [
      { key: 'intensity', label: zhCN.inspector.fields.intensity, min: 0, max: 1, step: 0.01 },
      { key: 'radius', label: zhCN.inspector.fields.radius, min: 0, max: 1, step: 0.01 },
    ];
  }
  if (type === 'film-grain') {
    return [
      { key: 'strength', label: zhCN.inspector.fields.strength, min: 0, max: 1, step: 0.01 },
      { key: 'size', label: zhCN.inspector.fields.size, min: 1, max: 5, step: 1 },
    ];
  }
  if (type === 'motion-blur') {
    return [
      { key: 'intensity', label: zhCN.inspector.fields.intensity, min: 0, max: 1, step: 0.01 },
      { key: 'angle', label: zhCN.inspector.fields.angle, min: 0, max: 360, step: 1 },
      { key: 'jitter', label: zhCN.inspector.fields.jitter, min: 0, max: 1, step: 0.01 },
    ];
  }
  return [{ key: 'strength', label: zhCN.inspector.fields.strength, min: 0, max: 20, step: 1 }];
}

export function formatLutPath(path: string | null | undefined): string {
  if (!path) {
    return zhCN.inspector.fields.noLutLoaded;
  }
  return path.split(/[\\/]/).at(-1) ?? path;
}

export function formatInputColorSpaceLabel(colorSpace: InputColorSpace): string {
  return zhCN.inspector.inputColorSpaces[colorSpace];
}

export function AnimatedField({
  label,
  children,
  onAddKeyframe,
  disabled,
  testId,
}: {
  label: string;
  children: ReactNode;
  onAddKeyframe(): void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-end gap-2">
      <div>
        <div className="mb-1 text-xs font-medium text-[var(--color-text-secondary)]">{label}</div>
        {children}
      </div>
      <button
        className="mb-0.5 h-8 w-8 rounded-md border border-line bg-[var(--color-bg-elevated)] text-xs font-semibold text-brand hover:bg-panel"
        type="button"
        title={zhCN.inspector.addKeyframeTitle(label)}
        disabled={disabled}
        data-testid={testId ?? `add-${label.toLowerCase()}-keyframe-button`}
        onClick={onAddKeyframe}
      >
        ◆
      </button>
    </div>
  );
}

export function getKenBurnsEndScale(clip: Extract<Clip, { type: 'image' }>): number {
  return clip.keyframes?.scaleX?.at(-1)?.value ?? clip.transform.scale;
}

export function formatKeyframeProperty(property: KeyframeProperty): string {
  return zhCN.inspector.keyframeProperty[property] ?? property;
}

export function formatKeyframeValue(property: KeyframeProperty, value: number): string {
  if (property === 'speed') {
    return `${value.toFixed(2)}x`;
  }
  if (
    property === 'opacity' ||
    property === 'volume' ||
    property === 'scaleX' ||
    property === 'scaleY' ||
    property === 'pathStartOffset'
  ) {
    return `${Math.round(value * 100)}%`;
  }
  if (property === 'yaw' || property === 'pitch' || property === 'roll') {
    return `${Math.round(value)}°`;
  }
  return value.toFixed(2);
}

export function resolveSelectedKeyframeEntries(
  project: Project,
  refs: SelectedKeyframeRef[],
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