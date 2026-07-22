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

export function SubtitleStyleTemplatesPanel({
  templates,
  onApply,
  onSave,
  onDelete,
  onAddToSharedLibrary,
}: {
  templates: SubtitleStyleTemplate[];
  onApply(template: SubtitleStyleTemplate): void;
  onSave(): void;
  onDelete(templateId: string): void;
  onAddToSharedLibrary(template: SubtitleStyleTemplate): void;
}) {
  const t = zhCN.inspector.subtitleStyleTemplates;
  return (
    <details
      className="rounded-md border border-line bg-[var(--color-bg-elevated)]"
      data-testid="subtitle-style-template-section"
      open
    >
      <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">
        {t.title}
      </summary>
      <div className="space-y-3 border-t border-line p-2">
        <button
          className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-panel"
          type="button"
          data-testid="subtitle-style-template-save-button"
          onClick={onSave}
        >
          {t.saveCurrent}
        </button>
        <div className="grid grid-cols-2 gap-2">
          {templates.map((template) => {
            const label = getSubtitleStyleTemplateLabel(template);
            return (
              <div key={template.id} className="min-w-0 rounded-md border border-line bg-panel p-1.5">
                <button
                  className="block w-full overflow-hidden rounded border border-line bg-[var(--color-bg-elevated)] text-left text-xs font-semibold text-[var(--color-text-secondary)] hover:border-brand"
                  type="button"
                  data-testid={`subtitle-style-template-${template.id}`}
                  onClick={() => onApply(template)}
                >
                  <img
                    className="block h-12 w-full object-cover"
                    src={makeSvgDataUri(renderSubtitleStyleTemplatePreview(template))}
                    alt={label}
                    loading="lazy"
                  />
                  <span className="flex min-h-8 items-center justify-between gap-1 px-1.5 py-1">
                    <span className="min-w-0 truncate">{label}</span>
                    {template.kind === 'custom' ? (
                      <span className="shrink-0 rounded-sm bg-[var(--color-bg-elevated)] px-1 text-[10px] font-medium text-[var(--color-text-muted)]">
                        {template.id.startsWith('shared-') ? t.sharedBadge : t.customBadge}
                      </span>
                    ) : null}
                  </span>
                </button>
                <button
                  className="mt-1 flex w-full items-center justify-center gap-1 rounded border border-line bg-[var(--color-bg-elevated)] px-2 py-1 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-panel"
                  type="button"
                  data-testid={`subtitle-style-template-share-${template.id}`}
                  aria-label={`${t.addToShared}: ${label}`}
                  onClick={() => onAddToSharedLibrary(template)}
                >
                  <span>{t.addToShared}</span>
                </button>
                {template.kind === 'custom' ? (
                  <button
                    className="mt-1 flex w-full items-center justify-center gap-1 rounded border border-line bg-[var(--color-bg-elevated)] px-2 py-1 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-rose-50 hover:text-rose-700"
                    type="button"
                    data-testid={`subtitle-style-template-delete-${template.id}`}
                    aria-label={`${t.deleteCustom}: ${label}`}
                    onClick={() => onDelete(template.id)}
                  >
                    <Trash2 size={12} />
                    <span>{t.deleteCustom}</span>
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </details>
  );
}

export function getSubtitleStyleTemplateLabel(template: SubtitleStyleTemplate): string {
  const builtins = zhCN.inspector.subtitleStyleTemplates.builtins;
  return template.kind === 'builtin'
    ? (builtins[template.id as keyof typeof builtins] ?? template.name)
    : template.name;
}

export function mergeSubtitleStyleTemplateViews(
  templates: SubtitleStyleTemplate[],
  sharedTemplates: SubtitleStyleTemplate[],
): SubtitleStyleTemplate[] {
  const seen = new Set<string>();
  const merged: SubtitleStyleTemplate[] = [];
  for (const template of [...templates, ...sharedTemplates]) {
    const key = template.id;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(template);
  }
  return merged;
}

export function makeSvgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export interface FrameInterpolationComparePreviewViewItem {
  mode: FrameInterpolationCompareMode;
  label: string;
  outputPath: string;
  src: string;
  estimatedMs: number;
  slowMotionMode: ClipSlowMotionMode;
}

export function SubtitleProofreadingPanel({
  clip,
  selectedSubtitleClips,
  selectedClipLocked,
  projectSettings,
}: {
  clip?: Extract<Clip, { type: 'subtitle' }>;
  selectedSubtitleClips: Array<Extract<Clip, { type: 'subtitle' }>>;
  selectedClipLocked: boolean;
  projectSettings: ProjectSettings;
}) {
  const project = useEditorStore((state) => state.project);
  const [minDuration, setMinDuration] = useState<number>(DEFAULT_SUBTITLE_PROOFREADING_SETTINGS.minDuration);
  const [maxDuration, setMaxDuration] = useState<number>(DEFAULT_SUBTITLE_PROOFREADING_SETTINGS.maxDuration);
  const t = zhCN.inspector.subtitleProofreading;
  const trackSubtitleClips = useMemo(() => {
    const trackId = clip?.trackId ?? selectedSubtitleClips[0]?.trackId;
    const track = project.timeline.tracks.find((item) => item.id === trackId && item.type === 'subtitle');
    return (
      track?.clips.filter((item): item is Extract<Clip, { type: 'subtitle' }> => item.type === 'subtitle') ?? []
    ).sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
  }, [clip?.trackId, project.timeline.tracks, selectedSubtitleClips]);
  const settings = useMemo(() => ({ minDuration, maxDuration }), [maxDuration, minDuration]);
  const issues = useMemo(
    () => analyzeSubtitleProofreading(trackSubtitleClips, settings),
    [settings, trackSubtitleClips],
  );
  const fixes = useMemo(
    () => buildSubtitleProofreadingFixes(trackSubtitleClips, issues, settings),
    [issues, settings, trackSubtitleClips],
  );

  const applyFixes = () => {
    try {
      commandManager.execute(new BatchProofreadSubtitleCommand(timelineAccessor, fixes));
      showToast({ kind: 'success', title: t.fixedTitle, message: t.fixedMessage(fixes.length) });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: t.failedTitle,
        message: error instanceof Error ? error.message : t.failedMessage,
      });
    }
  };

  const exportCsv = async () => {
    try {
      const path = await saveFileDialog('subtitle-proofreading.csv', [
        { name: zhCN.fileDialogs.csv, extensions: ['csv'] },
      ]);
      if (!path) {
        return;
      }
      await writeFile(
        path,
        serializeSubtitleProofreadingCsv(issues, {
          fps: projectSettings.fps,
          timecodeFormat: projectSettings.timecodeFormat,
        }),
      );
      showToast({ kind: 'success', title: t.exportedTitle, message: t.exportedMessage(path) });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: t.exportFailedTitle,
        message: error instanceof Error ? error.message : t.exportFailedMessage,
      });
    }
  };

  return (
    <details
      className="rounded-md border border-line bg-[var(--color-bg-elevated)]"
      data-testid="subtitle-proofreading-section"
      open
    >
      <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">
        {t.title}
      </summary>
      <div className="space-y-3 border-t border-line p-2">
        <div
          className="rounded-md bg-panel p-2 text-xs text-[var(--color-text-secondary)]"
          data-testid="subtitle-proofreading-summary"
        >
          {t.summary(trackSubtitleClips.length, issues.length)}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label={t.minDuration}
            value={minDuration}
            min={0.1}
            step={0.1}
            onCommit={setMinDuration}
            testId="subtitle-proofreading-min-duration-input"
          />
          <NumberField
            label={t.maxDuration}
            value={maxDuration}
            min={0.1}
            step={0.1}
            onCommit={setMaxDuration}
            testId="subtitle-proofreading-max-duration-input"
          />
        </div>
        {issues.length === 0 ? (
          <div
            className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs font-medium text-emerald-800"
            data-testid="subtitle-proofreading-no-issues"
          >
            {t.noIssues}
          </div>
        ) : (
          <div className="space-y-2" data-testid="subtitle-proofreading-issue-list">
            {issues.slice(0, 10).map((issue) => (
              <div
                key={issue.id}
                className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900"
                data-testid={`subtitle-proofreading-issue-${issue.type}-${issue.clipId}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{getSubtitleProofreadingIssueLabel(issue)}</span>
                  <span className="shrink-0 font-mono text-[11px]">
                    {secondsToTimecode(issue.start, projectSettings.fps, projectSettings.timecodeFormat)}
                  </span>
                </div>
                <div className="mt-1 truncate" title={issue.text.trim() || t.blankContent}>
                  {issue.text.trim() || t.blankContent}
                </div>
              </div>
            ))}
            {issues.length > 10 ? (
              <div className="text-xs text-[var(--color-text-muted)]">{t.moreIssues(issues.length - 10)}</div>
            ) : null}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={selectedClipLocked || fixes.length === 0}
            onClick={applyFixes}
            data-testid="subtitle-proofreading-fix-button"
          >
            {t.fix}
          </button>
          <button
            className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={issues.length === 0}
            onClick={() => void exportCsv()}
            data-testid="subtitle-proofreading-export-csv-button"
          >
            {t.exportCsv}
          </button>
        </div>
      </div>
    </details>
  );
}

export function getSubtitleProofreadingIssueLabel(issue: SubtitleProofreadingIssue): string {
  const labels: Record<SubtitleProofreadingIssueType, string> = zhCN.inspector.subtitleProofreading.issueLabels;
  const label = labels[issue.type];
  if (issue.type === 'reading-speed' && issue.value !== undefined && issue.limit !== undefined) {
    return zhCN.inspector.subtitleProofreading.readingSpeedDetail(label, issue.value, issue.limit);
  }
  if (issue.type === 'overlap' && issue.relatedClipId) {
    return zhCN.inspector.subtitleProofreading.overlapDetail(label, issue.relatedClipId);
  }
  if ((issue.type === 'too-short' || issue.type === 'too-long') && issue.limit !== undefined) {
    return zhCN.inspector.subtitleProofreading.durationDetail(label, issue.limit);
  }
  return label;
}

export function SubtitleRetimingPanel({
  clip,
  selectedSubtitleClips,
  projectSettings,
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
    return (
      track?.clips.filter((item): item is Extract<Clip, { type: 'subtitle' }> => item.type === 'subtitle') ?? []
    ).sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
  }, [clip?.trackId, project.timeline.tracks, selectedSubtitleClips]);
  const fullTrackTargets = selectedSubtitleClips.length > 1 ? selectedSubtitleClips : trackSubtitleClips;
  const selectedTargets = selectedSubtitleClips.length > 0 ? selectedSubtitleClips : fullTrackTargets;
  const projectDuration = Math.max(
    getTimelineDuration(project.timeline),
    ...fullTrackTargets.map((item) => item.start + item.duration),
    1 / Math.max(1, projectSettings.fps),
  );
  const peakTimes = (project.beatMarkers ?? []).map((marker) => marker.time);

  const runRetimingCommand = (command: Parameters<typeof commandManager.execute>[0], successMessage: string) => {
    try {
      commandManager.execute(command);
      showToast({ kind: 'success', title: t.title, message: successMessage });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: t.failedTitle,
        message: error instanceof Error ? error.message : t.failedMessage,
      });
    }
  };

  const applyShift = () => {
    runRetimingCommand(
      new BatchShiftSubtitleCommand(
        timelineAccessor,
        fullTrackTargets.map((item) => item.id),
        shiftSeconds,
        projectDuration,
      ),
      t.shiftApplied(fullTrackTargets.length),
    );
  };
  const applyScale = () => {
    runRetimingCommand(
      new BatchSubtitleTimingCommand(
        timelineAccessor,
        calculateSubtitleScaleUpdates(
          fullTrackTargets,
          scaleFactor,
          projectDuration,
          1 / Math.max(1, projectSettings.fps),
        ),
      ),
      t.scaleApplied(fullTrackTargets.length),
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
      new BatchSubtitleTimingCommand(
        timelineAccessor,
        calculateSubtitleBatchAdjustUpdates(
          selectedTargets,
          batchStartDelta,
          batchEndDelta,
          projectDuration,
          1 / Math.max(1, projectSettings.fps),
        ),
      ),
      t.batchApplied(selectedTargets.length),
    );
  };

  return (
    <details
      className="rounded-md border border-line bg-[var(--color-bg-elevated)]"
      data-testid="subtitle-retiming-section"
      open
    >
      <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">
        {t.title}
      </summary>
      <div className="space-y-3 border-t border-line p-2">
        <div
          className="rounded-md bg-panel p-2 text-xs text-[var(--color-text-secondary)]"
          data-testid="subtitle-retiming-summary"
        >
          {t.summary(fullTrackTargets.length, selectedTargets.length)}
        </div>
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <NumberField
            label={t.shiftSeconds}
            value={shiftSeconds}
            step={0.1}
            onCommit={setShiftSeconds}
            testId="subtitle-shift-input"
          />
          <button
            className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-panel"
            type="button"
            data-testid="subtitle-shift-apply-button"
            onClick={applyShift}
          >
            {t.apply}
          </button>
        </div>
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <NumberField
            label={t.scaleFactor}
            value={scaleFactor}
            min={0.01}
            step={0.01}
            onCommit={setScaleFactor}
            testId="subtitle-scale-input"
          />
          <button
            className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-panel"
            type="button"
            data-testid="subtitle-scale-apply-button"
            onClick={applyScale}
          >
            {t.apply}
          </button>
        </div>
        <button
          className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-panel"
          type="button"
          data-testid="subtitle-peak-align-button"
          onClick={applyPeakAlign}
        >
          {t.alignToPeak}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label={t.startDelta}
            value={batchStartDelta}
            step={0.1}
            onCommit={setBatchStartDelta}
            testId="subtitle-batch-start-delta-input"
          />
          <NumberField
            label={t.endDelta}
            value={batchEndDelta}
            step={0.1}
            onCommit={setBatchEndDelta}
            testId="subtitle-batch-end-delta-input"
          />
        </div>
        <button
          className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-panel"
          type="button"
          data-testid="subtitle-batch-adjust-button"
          onClick={applyBatchAdjust}
        >
          {t.batchAdjust}
        </button>
      </div>
    </details>
  );
}


export type CurveChannel = keyof ColorCurves;

export const CURVE_CHANNELS: Array<{ key: CurveChannel; label: string; color: string }> = [
  { key: 'master', label: zhCN.inspector.fields.masterCurve, color: '#f8fafc' },
  { key: 'r', label: zhCN.inspector.fields.redCurve, color: '#ef4444' },
  { key: 'g', label: zhCN.inspector.fields.greenCurve, color: '#22c55e' },
  { key: 'b', label: zhCN.inspector.fields.blueCurve, color: '#3b82f6' },
];

export function CurveEditor({ curves, onCommit }: { curves: ColorCurves; onCommit(curves: ColorCurves): void }) {
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
    drawCurveCanvas(
      canvas,
      draft[activeChannel],
      CURVE_CHANNELS.find((item) => item.key === activeChannel)?.color ?? '#e2e8f0',
    );
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
    updateActivePoints(
      points.filter((_, index) => index !== nearest),
      true,
    );
  };

  return (
    <div className="space-y-2 rounded-md border border-line bg-panel p-2" data-testid="curve-editor">
      <div className="grid grid-cols-4 gap-1">
        {CURVE_CHANNELS.map((channel) => (
          <button
            key={channel.key}
            className={`rounded-md border px-2 py-1 text-xs font-semibold ${
              activeChannel === channel.key
                ? 'border-brand bg-[var(--color-bg-elevated)] text-brand'
                : 'border-line bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-panel'
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
        className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel"
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

export type ThreeWayKey = keyof ThreeWayColor;

export const THREE_WAY_CHANNELS: Array<{ key: ThreeWayKey; label: string }> = [
  { key: 'lift', label: zhCN.inspector.fields.lift },
  { key: 'gamma', label: zhCN.inspector.fields.gamma },
  { key: 'gain', label: zhCN.inspector.fields.gain },
];

export function ThreeWayColorEditor({
  threeWayColor,
  onCommit,
}: {
  threeWayColor: ThreeWayColor;
  onCommit(color: ThreeWayColor): void;
}) {
  const normalized = normalizeThreeWayColor(threeWayColor);
  const updateWheel = (key: ThreeWayKey, patch: Partial<ColorWheelValue>) => {
    onCommit(
      normalizeThreeWayColor({
        ...normalized,
        [key]: normalizeColorWheelValue({ ...normalized[key], ...patch }),
      }),
    );
  };

  return (
    <div className="space-y-3 rounded-md border border-line bg-panel p-2" data-testid="three-way-color-editor">
      {THREE_WAY_CHANNELS.map((channel) => (
        <ColorWheelControl
          key={channel.key}
          label={channel.label}
          value={normalized[channel.key]}
          onCommit={(patch) => updateWheel(channel.key, patch)}
          testId={`color-wheel-${channel.key}`}
        />
      ))}
      <button
        className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel"
        type="button"
        data-testid="reset-three-way-color-button"
        onClick={() => onCommit(DEFAULT_THREE_WAY_COLOR)}
      >
        {zhCN.common.reset}
      </button>
    </div>
  );
}

export function ColorWheelControl({
  label,
  value,
  onCommit,
  testId,
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
    <div className="rounded-md border border-line bg-[var(--color-bg-elevated)] p-2" data-testid={testId}>
      <div className="mb-2 text-xs font-semibold text-[var(--color-text-secondary)]">{label}</div>
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




export function EffectsEditor({
  effects,
  onAdd,
  onRemove,
  onUpdate,
  onReorder,
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
        <label className="min-w-0 flex-1 text-xs font-medium text-[var(--color-text-secondary)]">
          {zhCN.inspector.fields.effectType}
          <select
            className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
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
          className="flex h-9 items-center gap-2 rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 text-sm font-medium hover:bg-panel"
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
            className="rounded-md border border-line bg-[var(--color-bg-elevated)]"
            open
            data-testid={`effect-item-${effect.type}`}
            draggable
            onDragStart={() => setDraggedEffectId(effect.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => dropEffect(effect.id)}
            onDragEnd={() => setDraggedEffectId(null)}
          >
            <summary className="flex cursor-pointer items-center gap-2 px-2 py-2 text-sm font-semibold text-[var(--color-text-secondary)]">
              <GripVertical size={14} className="shrink-0 text-[var(--color-text-muted)]" />
              <span className="min-w-0 flex-1 truncate">{zhCN.inspector.effectNames[effect.type]}</span>
              <label
                className="flex items-center gap-1 text-xs font-medium text-[var(--color-text-muted)]"
                onClick={(event) => event.stopPropagation()}
              >
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
              ) : effect.type === 'motion-blur' ? (
                <MotionBlurEffectFields effect={effect} onUpdate={onUpdate} />
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
                  className="h-8 w-8 rounded-md border border-line bg-[var(--color-bg-elevated)] p-1 hover:bg-panel disabled:opacity-40"
                  type="button"
                  title={zhCN.inspector.fields.moveEffectUp}
                  disabled={index === 0}
                  onClick={() => moveEffect(effect.id, -1)}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  className="h-8 w-8 rounded-md border border-line bg-[var(--color-bg-elevated)] p-1 hover:bg-panel disabled:opacity-40"
                  type="button"
                  title={zhCN.inspector.fields.moveEffectDown}
                  disabled={index === effects.length - 1}
                  onClick={() => moveEffect(effect.id, 1)}
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  className="h-8 w-8 rounded-md border border-rose-300 bg-[var(--color-bg-elevated)] p-1 text-rose-700 hover:bg-rose-50"
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

export function formatMotionGraphicNumberValue(param: MotionGraphicParamDefinition, value: number): string {
  if (param.max !== undefined && param.min === 0 && param.max <= 1.001) {
    return `${Math.round(value * 100)}%`;
  }
  if ((param.step ?? 1) < 1) {
    return value.toFixed(2);
  }
  return `${Math.round(value)}`;
}

export function TextField({
  label,
  value,
  onCommit,
  disabled,
  testId,
}: {
  label: string;
  value: string;
  onCommit(value: string): void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
      {label}
      <input
        className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] disabled:cursor-not-allowed disabled:opacity-60"
        defaultValue={value}
        disabled={disabled}
        data-testid={testId}
        onBlur={(event) => onCommit(event.target.value)}
      />
    </label>
  );
}

export function TextAreaField({
  label,
  value,
  onCommit,
  disabled,
  testId,
}: {
  label: string;
  value: string;
  onCommit(value: string): void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
      {label}
      <textarea
        className="mt-1 min-h-20 w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-60"
        defaultValue={value}
        disabled={disabled}
        onBlur={(event) => onCommit(event.target.value)}
        data-testid={testId}
      />
    </label>
  );
}

export function CustomShaderEffectFields({
  effect,
  onUpdate,
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
    setCompileError(result.ok ? undefined : (result.error ?? zhCN.inspector.customShader.compileFailed));
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
      <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
        {zhCN.inspector.fields.shaderExample}
        <select
          className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
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
      <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
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
        <div
          className="rounded-md border border-rose-200 bg-rose-50 p-2 font-mono text-[11px] leading-4 text-rose-800"
          data-testid="custom-shader-error"
        >
          {compileError}
        </div>
      ) : null}
    </div>
  );
}

export function NumberField({
  label,
  value,
  min,
  max,
  step,
  onCommit,
  hideLabel = false,
  testId,
  disabled,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onCommit(value: number): void;
  hideLabel?: boolean;
  testId?: string;
  disabled?: boolean;
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
    <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
      {hideLabel ? <span className="sr-only">{label}</span> : label}
      <input
        className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
        type="number"
        value={draft}
        min={min}
        max={max}
        step={step ?? 1}
        disabled={disabled}
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

export function AudioSpectrumEffectFields({
  effect,
  onUpdate,
}: {
  effect: Effect;
  onUpdate(effectId: string, patch: EffectPatch): void;
}) {
  const params = normalizeAudioSpectrumParams(effect.params);
  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
        {zhCN.inspector.fields.style}
        <select
          className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
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
      <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
        {zhCN.exportDialog.audioVisualization.theme}
        <select
          className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
          value={getEffectStringParam(effect.params, 'themeId', params.themeId)}
          data-testid={`effect-param-${effect.id}-theme`}
          onChange={(event) => onUpdate(effect.id, { params: { themeId: event.target.value } })}
        >
          <option value={MANUAL_AUDIO_VISUALIZATION_THEME_ID}>
            {zhCN.exportDialog.audioVisualization.manualTheme}
          </option>
          {BUILTIN_AUDIO_VISUALIZATION_THEMES.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.name}
            </option>
          ))}
        </select>
      </label>
      <ColorField
        label={zhCN.inspector.fields.colorStart}
        value={getEffectStringParam(effect.params, 'colorStart', params.colorStart)}
        onCommit={(colorStart) => onUpdate(effect.id, { params: { color: colorStart, colorStart } })}
        testId={`effect-param-${effect.id}-color-start`}
      />
      <ColorField
        label={zhCN.inspector.fields.colorEnd}
        value={getEffectStringParam(effect.params, 'colorEnd', params.colorEnd)}
        onCommit={(colorEnd) => onUpdate(effect.id, { params: { colorEnd } })}
        testId={`effect-param-${effect.id}-color-end`}
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
      <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
        {zhCN.inspector.fields.position}
        <select
          className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
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
      <ToggleField
        label={zhCN.inspector.fields.mirror}
        checked={params.mirror}
        onCommit={(mirror) => onUpdate(effect.id, { params: { mirror } })}
        testId={`effect-param-${effect.id}-mirror`}
      />
    </div>
  );
}

export function MotionBlurEffectFields({
  effect,
  onUpdate,
}: {
  effect: Effect;
  onUpdate(effectId: string, patch: EffectPatch): void;
}) {
  const params = normalizeMotionBlurParams(effect.params);
  return (
    <div className="space-y-3">
      <RangeNumberField
        label={zhCN.inspector.fields.intensity}
        value={params.intensity}
        min={0}
        max={1}
        step={0.01}
        format={(value) => value.toFixed(2)}
        onCommit={(intensity) => onUpdate(effect.id, { params: { intensity } })}
        testId={`effect-param-${effect.id}-intensity`}
      />
      <RangeNumberField
        label={zhCN.inspector.fields.angle}
        value={params.angle}
        min={0}
        max={360}
        step={1}
        format={(value) => `${Math.round(value)}°`}
        onCommit={(angle) => onUpdate(effect.id, { params: { angle } })}
        testId={`effect-param-${effect.id}-angle`}
      />
      <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
        {zhCN.inspector.fields.samples}
        <select
          className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
          value={params.samples}
          data-testid={`effect-param-${effect.id}-samples`}
          onChange={(event) => onUpdate(effect.id, { params: { samples: Number(event.target.value) } })}
        >
          {MOTION_BLUR_SAMPLE_COUNTS.map((samples) => (
            <option key={samples} value={samples}>
              {samples}
            </option>
          ))}
        </select>
      </label>
      <RangeNumberField
        label={zhCN.inspector.fields.jitter}
        value={params.jitter}
        min={0}
        max={1}
        step={0.01}
        format={(value) => value.toFixed(2)}
        onCommit={(jitter) => onUpdate(effect.id, { params: { jitter } })}
        testId={`effect-param-${effect.id}-jitter`}
      />
    </div>
  );
}

export function formatNumberInputValue(value: number): string {
  return String(Number(value.toFixed(3)));
}

export function RangeField({
  label,
  value,
  min,
  max,
  step,
  format,
  onCommit,
  hideLabel = false,
  testId,
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
    <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
      <span className="flex justify-between">
        <span className={hideLabel ? 'sr-only' : undefined}>{label}</span>
        <span className="tabular-nums">{format(value)}</span>
      </span>
      <input
        className="mt-1 w-full accent-brand"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onCommit(Number(event.target.value))}
        onKeyDown={(event) => {
          const next = resolveSliderKeyboardValue({ key: event.key, value, min, max, step, shiftKey: event.shiftKey });
          if (next === undefined) {
            return;
          }
          event.preventDefault();
          onCommit(next);
        }}
        data-testid={testId}
      />
    </label>
  );
}

export function RangeNumberField({
  label,
  value,
  min,
  max,
  step,
  format,
  onCommit,
  disabled,
  testId,
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
    <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
      <span className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <input
          className="w-20 rounded-lg border border-line px-2 py-1 text-right text-xs tabular-nums text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] disabled:cursor-not-allowed disabled:opacity-60"
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
        <input
          className="min-w-0 flex-1 accent-brand disabled:cursor-not-allowed disabled:opacity-60"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(event) => commitClamped(Number(event.target.value))}
          onKeyDown={(event) => {
            const next = resolveSliderKeyboardValue({
              key: event.key,
              value,
              min,
              max,
              step,
              shiftKey: event.shiftKey,
            });
            if (next === undefined) {
              return;
            }
            event.preventDefault();
            commitClamped(next);
          }}
        />
        <span className="w-14 text-right text-xs tabular-nums text-[var(--color-text-muted)]">{format(value)}</span>
      </span>
    </label>
  );
}

export function ExpressionNumberField({
  label,
  value,
  format,
  onCommit,
  testId,
}: {
  label: string;
  value: number;
  format(value: number): string;
  onCommit(expression: string): void;
  testId?: string;
}) {
  const [draft, setDraft] = useState(formatNumberInputValue(value));
  useEffect(() => {
    setDraft(formatNumberInputValue(value));
  }, [value]);
  const commitDraft = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft(formatNumberInputValue(value));
      return;
    }
    onCommit(trimmed);
    setDraft(formatNumberInputValue(value));
  };
  return (
    <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
      <span className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <span className="text-[11px] font-normal tabular-nums text-[var(--color-text-muted)]">{format(value)}</span>
      </span>
      <input
        className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-xs tabular-nums text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
        type="text"
        value={draft}
        data-testid={testId}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

export function ColorField({
  label,
  value,
  onCommit,
  disabled,
  testId,
}: {
  label: string;
  value: string;
  onCommit(value: string): void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <label className="flex items-center justify-between text-xs font-medium text-[var(--color-text-secondary)]">
      {label}
      <input
        className="h-8 w-12 rounded border border-line disabled:cursor-not-allowed disabled:opacity-60"
        type="color"
        value={value}
        disabled={disabled}
        onChange={(event) => onCommit(event.target.value)}
        data-testid={testId}
      />
    </label>
  );
}

export function ToggleField({
  label,
  checked,
  disabled,
  onCommit,
  testId,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCommit(value: boolean): void;
  testId?: string;
}) {
  return (
    <label className="flex items-center justify-between text-xs font-medium text-[var(--color-text-secondary)]">
      {label}
      <input
        className="h-4 w-4 accent-brand disabled:cursor-not-allowed disabled:opacity-60"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCommit(event.target.checked)}
        data-testid={testId}
      />
    </label>
  );
}

export function drawCurveCanvas(canvas: HTMLCanvasElement, points: CurvePoint[], strokeColor: string): void {
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

export function eventToCurvePoint(event: { clientX: number; clientY: number }, canvas: HTMLCanvasElement): CurvePoint {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clampUnit((event.clientX - rect.left) / rect.width),
    y: clampUnit(1 - (event.clientY - rect.top) / rect.height),
  };
}

export function findNearestCurvePoint(points: CurvePoint[], point: CurvePoint, maxDistance: number): number | null {
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

export function drawColorWheel(canvas: HTMLCanvasElement, value: ColorWheelValue): void {
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
      const hue = (Math.atan2(dy, dx) / (Math.PI * 2) + 1) % 1;
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

export function eventToUnitPoint(
  event: { clientX: number; clientY: number },
  canvas: HTMLCanvasElement,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
  const length = Math.hypot(x, y);
  if (length <= 1) {
    return { x, y };
  }
  return { x: x / length, y: y / length };
}

export function wheelPointToOffsets(point: { x: number; y: number }): Pick<ColorWheelValue, 'r' | 'g' | 'b'> {
  return {
    r: clampSigned(point.x),
    g: clampSigned(-0.5 * point.x - 0.8660254 * point.y),
    b: clampSigned(-0.5 * point.x + 0.8660254 * point.y),
  };
}

export function wheelOffsetsToPoint(value: ColorWheelValue): { x: number; y: number } {
  const x = value.r;
  const y = (value.b - value.g) / 1.7320508;
  const length = Math.hypot(x, y);
  if (length <= 1) {
    return { x, y };
  }
  return { x: x / length, y: y / length };
}

export function hsvToRgb(hue: number, saturation: number, value: number): { r: number; g: number; b: number } {
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


export function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

export function clampSigned(value: number): number {
  return Math.min(1, Math.max(-1, Number.isFinite(value) ? value : 0));
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
