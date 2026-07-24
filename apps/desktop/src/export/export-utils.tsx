import type { Project, ExportTaskHistoryEntry } from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { useExportQueueStore } from './export-queue-store';
import { useMediaJobStore } from '../media/media-job-store';
import { ensureMediaJobRunner } from '../media/media-job-runner';
import { delay } from './lib/pipelineHelpers';
import { runExportPowerAction } from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';
import type { ExportCompletionAction } from './export-background';
import type { ExportBackgroundSettings } from '../settings/appSettings';

export async function runProxyGenerationWarmup(project: Project): Promise<void> {
  const mediaIds = new Set(project.media.map((asset) => asset.id));
  const hasActiveProxyJobs = useMediaJobStore
    .getState()
    .jobs.some(
      (job) =>
        job.type === 'proxy' && mediaIds.has(job.assetId) && (job.status === 'pending' || job.status === 'running'),
    );
  if (hasActiveProxyJobs) {
    await ensureMediaJobRunner();
  }
}

export async function waitForExportTasks(taskIds: string[]): Promise<void> {
  const ids = new Set(taskIds);
  if (ids.size === 0) {
    return;
  }
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const tasks = useExportQueueStore.getState().tasks.filter((task) => ids.has(task.id));
    if (
      tasks.length === ids.size &&
      tasks.every(
        (task) =>
          task.status === 'success' ||
          task.status === 'error' ||
          task.status === 'canceled' ||
          task.status === 'interrupted',
      )
    ) {
      return;
    }
    await delay(100);
  }
  throw new Error(zhCN.exportDialog.pipeline.timeout);
}

export async function runCompletionAction(
  action: ExportCompletionAction,
  settings: ExportBackgroundSettings,
): Promise<void> {
  if (action === 'none') {
    return;
  }
  if (action === 'notification') {
    showToast({
      kind: 'success',
      title: zhCN.exportDialog.completionAction.notificationTitle,
      message: zhCN.exportDialog.completionAction.notificationMessage,
    });
    if (typeof Notification !== 'undefined') {
      const permission =
        Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
      if (permission === 'granted') {
        new Notification(zhCN.exportDialog.completionAction.notificationTitle, {
          body: zhCN.exportDialog.completionAction.notificationMessage,
        });
      }
    }
    return;
  }
  if (!settings.allowPowerActions) {
    showToast({
      kind: 'warning',
      title: zhCN.exportDialog.completionAction.powerDisabledTitle,
      message: zhCN.exportDialog.completionAction.powerDisabled,
    });
    return;
  }
  try {
    await runExportPowerAction(action, true);
  } catch (error) {
    showToast({
      kind: 'error',
      title: zhCN.exportDialog.completionAction.powerFailedTitle,
      message: error instanceof Error ? error.message : zhCN.exportDialog.completionAction.powerFailedMessage,
    });
  }
}

export function getLastExportDurationSeconds(history: ExportTaskHistoryEntry[]): number | undefined {
  const entry = history.find((item) => item.startedAt && item.finishedAt);
  if (!entry?.startedAt || !entry.finishedAt) {
    return undefined;
  }
  const started = Date.parse(entry.startedAt);
  const finished = Date.parse(entry.finishedAt);
  if (!Number.isFinite(started) || !Number.isFinite(finished) || finished < started) {
    return undefined;
  }
  return (finished - started) / 1000;
}

export function estimateDimensions(width: number, height: number, format: string): { width: number; height: number } {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  if (format !== 'gif') {
    return { width: safeWidth, height: safeHeight };
  }
  const longest = Math.max(safeWidth, safeHeight);
  if (longest <= 1080) {
    return { width: safeWidth, height: safeHeight };
  }
  const ratio = 1080 / longest;
  return {
    width: Math.max(1, Math.round(safeWidth * ratio)),
    height: Math.max(1, Math.round(safeHeight * ratio)),
  };
}

export function formatExportWarning(warning: string): string {
  const textClip = warning.match(/^Text clip (.+) was skipped because FFmpeg drawtext\/libfreetype is unavailable\.$/);
  if (textClip) {
    return zhCN.exportDialog.textClipSkippedDrawtext(textClip[1]);
  }
  const transitionVisual = warning.match(
    /^Transition (.+) was skipped because both clips must be visual media clips\.$/,
  );
  if (transitionVisual) {
    return zhCN.exportDialog.transitionSkippedVisualOnly(transitionVisual[1]);
  }
  const transitionChained = warning.match(
    /^Transition (.+) was skipped because chained transitions are not yet supported in one export segment\.$/,
  );
  if (transitionChained) {
    return zhCN.exportDialog.transitionSkippedChained(transitionChained[1]);
  }
  const transitionMissingInput = warning.match(
    /^Transition (.+) was skipped because one of its clips has no media input\.$/,
  );
  if (transitionMissingInput) {
    return zhCN.exportDialog.transitionSkippedMissingInput(transitionMissingInput[1]);
  }
  const missingMedia = warning.match(/^Clip (.+) has no media path and was skipped\.$/);
  if (missingMedia) {
    return zhCN.exportDialog.clipSkippedMissingMedia(missingMedia[1]);
  }
  const speedRampFallback = warning.match(
    /^Speed ramp setpts for clip (.+) exceeded 4096 characters and fell back to average speed\.$/,
  );
  if (speedRampFallback) {
    return zhCN.exportDialog.speedRampSetptsFallback(speedRampFallback[1]);
  }
  const customShaderSlowWarning = warning.match(
    /^Custom shader effect for clip (.+) will render frame-by-frame and may be slow\.$/,
  );
  if (customShaderSlowWarning) {
    return zhCN.exportDialog.customShaderSlowWarning(customShaderSlowWarning[1]);
  }
  const opticalFlowFallback = warning.match(
    /^Optical flow slow motion for clip (.+) fell back to blend because the current FFmpeg build did not report minterpolate support\.$/,
  );
  if (opticalFlowFallback) {
    return zhCN.exportDialog.opticalFlowFallbackBlend(opticalFlowFallback[1]);
  }
  const slowMotionSkipped = warning.match(
    /^Slow motion interpolation for clip (.+) was skipped because the current FFmpeg build does not support minterpolate\.$/,
  );
  if (slowMotionSkipped) {
    return zhCN.exportDialog.slowMotionInterpolationSkipped(slowMotionSkipped[1]);
  }
  if (
    warning ===
    'Current FFmpeg does not support drawtext/libfreetype. Install an FFmpeg build with libfreetype to export text overlays.'
  ) {
    return zhCN.exportDialog.ffmpegDrawtextUnavailable;
  }
  if (
    warning ===
    'Hardware video encoding was requested but no supported H.264 hardware encoder was detected. Falling back to software encoding.'
  ) {
    return zhCN.exportDialog.hardwareEncodingFallback;
  }
  return warning;
}

export function InfoRow({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' | 'bad' }) {
  const toneClass =
    tone === 'ok'
      ? 'text-emerald-700'
      : tone === 'warn'
        ? 'text-amber-700'
        : tone === 'bad'
          ? 'text-rose-700'
          : 'text-slate-700';
  return (
    <div className="rounded-md bg-panel p-2">
      <div className="text-[11px] uppercase tracking-normal text-slate-500">{label}</div>
      <div className={`truncate font-medium ${toneClass}`}>{value}</div>
    </div>
  );
}
