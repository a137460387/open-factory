import { useEffect } from 'react';
import type { ExportTask } from '@open-factory/editor-core';
import { AddClipCommand } from '@open-factory/editor-core';
import { createClipFromAsset, findPreferredTrack } from '../lib/clipFactory';
import { probeMediaPaths } from '../lib/media';
import { forceCloseWindow, fsExists, getCancelSmokeConfig, getFileStat, listenBridge, writeFile } from '../lib/tauri-bridge';
import { useExportQueueStore } from '../export/export-queue-store';
import { commandManager, timelineAccessor } from '../store/commandManager';
import { useEditorStore } from '../store/editorStore';

interface CancelSmokeReport {
  success: boolean;
  error?: string;
  fixturePath?: string;
  outputPath?: string;
  asset?: {
    type: string;
    name: string;
    duration: number;
    width: number;
    height: number;
    hasAudio?: boolean;
  };
  task?: {
    id: string;
    statusBeforeCancel: string;
    canceledStatusSeen: boolean;
    retryStatus?: string;
  };
  exportStartedEventSeen: boolean;
  cancelButtonClicked: boolean;
  runnerInactiveAfterCancel: boolean;
  partialOutputExistsAfterCancel?: boolean;
  partialOutputSizeAfterCancel?: number;
  finalOutputExists?: boolean;
  finalOutputSize?: number;
  durationMs: number;
}

export function NativeCancelSmokeRunner() {
  useEffect(() => {
    void runNativeCancelSmoke();
  }, []);
  return null;
}

async function runNativeCancelSmoke(): Promise<void> {
  const config = await getCancelSmokeConfig();
  if (!config?.enabled) {
    return;
  }

  const startedAt = performance.now();
  const report: CancelSmokeReport = {
    success: false,
    fixturePath: config.mediaPath,
    outputPath: config.outputPath,
    exportStartedEventSeen: false,
    cancelButtonClicked: false,
    runnerInactiveAfterCancel: false,
    durationMs: 0
  };
  let unlistenStarted: (() => void) | undefined;

  try {
    unlistenStarted = await listenBridge<void>('export-started', () => {
      report.exportStartedEventSeen = true;
    });

    const result = await probeMediaPaths([config.mediaPath], useEditorStore.getState().project.media);
    const asset = result.media[0];
    if (!asset) {
      throw new Error('Cancel smoke fixture was not imported.');
    }
    report.asset = {
      type: asset.type,
      name: asset.name,
      duration: asset.duration,
      width: asset.width,
      height: asset.height,
      hasAudio: asset.hasAudio
    };

    useEditorStore.getState().addMedia([asset]);
    const projectWithMedia = useEditorStore.getState().project;
    const track = findPreferredTrack(projectWithMedia.timeline, asset);
    if (!track) {
      throw new Error(`No compatible track for ${asset.type} fixture.`);
    }
    const clip = createClipFromAsset(asset, track, projectWithMedia.timeline);
    commandManager.execute(new AddClipCommand(timelineAccessor, clip));
    useEditorStore.getState().setSelectedClipId(clip.id);

    await clickExportToolbarButton();
    await fillOutputPath(config.outputPath);
    await clickByTestId('export-enqueue-button', 'Export enqueue button was not available.');

    const runningTask = await waitFor(
      () => useExportQueueStore.getState().tasks.find((task) => task.status === 'running'),
      15_000,
      'Export task did not enter running state.'
    );
    report.task = {
      id: runningTask.id,
      statusBeforeCancel: runningTask.status,
      canceledStatusSeen: false
    };

    await waitFor(() => (report.exportStartedEventSeen ? true : undefined), 20_000, 'Rust export-started event was not observed.');
    await clickByTestId('export-task-cancel-button', 'Running export cancel button was not available.');
    report.cancelButtonClicked = true;

    const canceledTask = await waitFor(
      () => findTask(runningTask.id, (task) => task.status === 'canceled'),
      15_000,
      'Export task did not enter canceled state.'
    );
    report.task.canceledStatusSeen = canceledTask.status === 'canceled';

    await waitFor(() => (!useExportQueueStore.getState().runnerActive ? true : undefined), 30_000, 'Export runner did not become idle after cancellation.');
    report.runnerInactiveAfterCancel = true;

    report.partialOutputExistsAfterCancel = await fsExists(config.outputPath);
    if (report.partialOutputExistsAfterCancel) {
      report.partialOutputSizeAfterCancel = await getOutputSize(config.outputPath);
    }

    await clickByTestId('export-task-retry-button', 'Canceled export retry button was not available.');
    const retriedTask = await waitFor(
      () => findTask(runningTask.id, (task) => task.status === 'success'),
      120_000,
      'Canceled export task did not retry successfully.'
    );
    report.task.retryStatus = retriedTask.status;
    report.finalOutputExists = await fsExists(config.outputPath);
    if (report.finalOutputExists) {
      report.finalOutputSize = await getOutputSize(config.outputPath);
    }

    report.success =
      report.exportStartedEventSeen &&
      report.cancelButtonClicked &&
      report.runnerInactiveAfterCancel &&
      report.task.canceledStatusSeen &&
      report.partialOutputExistsAfterCancel === false &&
      report.task.retryStatus === 'success' &&
      report.finalOutputExists === true &&
      (report.finalOutputSize ?? 0) > 0;
    if (!report.success) {
      report.error = 'Cancel smoke assertions failed.';
    }
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
  } finally {
    unlistenStarted?.();
    report.durationMs = Math.round(performance.now() - startedAt);
    await writeFile(config.reportPath, JSON.stringify(report, null, 2));
    await forceCloseWindow();
  }
}

async function clickExportToolbarButton(): Promise<void> {
  const button = await waitFor(() => {
    const item = document.querySelector<HTMLButtonElement>('button[aria-label="Export video"]');
    return item && !item.disabled ? item : undefined;
  }, 10_000, 'Export toolbar button was not enabled.');
  button.click();
  await waitFor(() => document.querySelector('[data-testid="export-dialog"]'), 5_000, 'Export dialog did not open.');
}

async function fillOutputPath(path: string): Promise<void> {
  const input = await waitFor(
    () => document.querySelector<HTMLInputElement>('[data-testid="export-output-path"]'),
    5_000,
    'Export output path input was not available.'
  );
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, path);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function clickByTestId(testId: string, failureMessage: string): Promise<void> {
  const button = await waitFor(() => document.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`), 10_000, failureMessage);
  button.click();
}

function findTask(taskId: string, predicate: (task: ExportTask) => boolean): ExportTask | undefined {
  return useExportQueueStore.getState().tasks.find((task) => task.id === taskId && predicate(task));
}

async function getOutputSize(path: string): Promise<number | undefined> {
  return getFileStat(path)
    .then((stat) => stat.size)
    .catch(() => undefined);
}

async function waitFor<T>(read: () => T | undefined | null, timeoutMs: number, failureMessage: string): Promise<T> {
  const startedAt = performance.now();
  let lastError: unknown;
  while (performance.now() - startedAt < timeoutMs) {
    try {
      const value = read();
      if (value) {
        return value;
      }
    } catch (error) {
      lastError = error;
    }
    await wait(100);
  }
  const detail = lastError instanceof Error ? ` ${lastError.message}` : '';
  throw new Error(`${failureMessage}${detail}`);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
