import {buildExportProjectFromProject, buildFfmpegPreviewSamplePlans} from '@open-factory/editor-core';
import {convertLocalFileSrc, getAppDataDir, getFfmpegCapabilities, runExportPreviewSamples} from '../../lib/tauri-bridge';
import {showToast} from '../../lib/toast';
import {buildExportPreviewOutputPaths} from '../lib/exportSettingsHelpers';

import type {ExportState} from './useExportState';

const EXPORT_PREVIEW_TIMEOUT_MS = 10_000;

export function useExportPreview(state: ExportState) {
  const {
    setError,
    setOutputPath,
    setCapabilities,
    setPreviewRunning,
    setPreviewError,
    setPreviewSamples,
    project,
    outputPath,
    capabilities,
    exportSettings,
    isAudioOnly,
    t,
  } = state;

  async function previewExport(): Promise<void> {
    if (isAudioOnly) {
      return;
    }
    setError(undefined);
    setPreviewError(undefined);
    setPreviewRunning(true);
    try {
      const nextCapabilities = capabilities ?? (await getFfmpegCapabilities());
      if (!nextCapabilities.available) {
        throw new Error(t.preview.ffmpegMissing);
      }
      if (!capabilities) {
        setCapabilities(nextCapabilities);
      }
      const appDataDir = await getAppDataDir();
      const outputPaths = buildExportPreviewOutputPaths(appDataDir);
      const exportProject = buildExportProjectFromProject(project, {
        outputPath: outputPath || outputPaths[0].replace(/\.png$/i, '.mp4'),
        settings: exportSettings,
      });
      const samples = buildFfmpegPreviewSamplePlans(exportProject, outputPaths, nextCapabilities).map((sample) => ({
        ...sample,
        label: t.preview.sampleLabels[sample.kind],
      }));
      const result = await runExportPreviewSamples({ samples, timeoutMs: EXPORT_PREVIEW_TIMEOUT_MS });
      setPreviewSamples(
        result.samples.map((sample) => ({
          id: sample.id,
          kind: sample.kind,
          label: t.preview.sampleLabels[sample.kind],
          time: sample.time,
          path: sample.path,
          src: convertLocalFileSrc(sample.path),
          durationMs: sample.durationMs,
        })),
      );
      showToast({ kind: 'success', title: t.preview.readyTitle, message: t.preview.readyMessage });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : t.preview.failed;
      setPreviewError(message);
      showToast({ kind: 'error', title: t.preview.failedTitle, message });
    } finally {
      setPreviewRunning(false);
    }
  }

  return { previewExport };
}
