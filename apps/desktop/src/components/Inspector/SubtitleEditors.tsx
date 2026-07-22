import {
  BatchProofreadSubtitleCommand,
  BatchShiftSubtitleCommand,
  BatchSubtitleTimingCommand,
  DEFAULT_SUBTITLE_PROOFREADING_SETTINGS,
  analyzeSubtitleProofreading,
  buildSubtitleProofreadingFixes,
  calculateSubtitleBatchAdjustUpdates,
  calculateSubtitlePeakAlignUpdate,
  calculateSubtitleScaleUpdates,
  getTimelineDuration,
  renderSubtitleStyleTemplatePreview,
  secondsToTimecode,
  serializeSubtitleProofreadingCsv,
  type Clip,
  type ProjectSettings,
  type SubtitleProofreadingIssue,
  type SubtitleProofreadingIssueType,
  type SubtitleStyleTemplate,
} from '@open-factory/editor-core';
import { Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { zhCN } from '../../i18n/strings';
import { commandManager, timelineAccessor } from '../../store/commandManager';
import { saveFileDialog, writeFile } from '../../lib/tauri-bridge';
import { showToast } from '../../lib/toast';
import { useEditorStore } from '../../store/editorStore';

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------

export function formatNumberInputValue(value: number): string {
  return String(Number(value.toFixed(3)));
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

// ---------------------------------------------------------------------------
// Subtitle Style Templates
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Subtitle Proofreading
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Subtitle Retiming
// ---------------------------------------------------------------------------

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
