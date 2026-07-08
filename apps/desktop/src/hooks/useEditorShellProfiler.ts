import { useCallback, useEffect, useRef } from 'react';
import {
  appendProfilerMemorySample,
  buildPerformanceProfilerReport,
  type ProfilerFrameSample,
  type ProfilerQueueSample,
} from '@open-factory/editor-core';
import { sanitizeFileName } from '@open-factory/editor-core';
import {
  sampleProfilerExportSpeed,
  createProfilerTraceEventsForFrame,
  readBrowserJsHeapBytes,
  estimateUndoHistoryBytes,
  type ProfilerRecordingBuffer,
} from '../lib/profiler-helpers';
import { zhCN } from '../i18n/strings';
import { showToast } from '../lib/toast';
import { useExportQueueStore } from '../export/export-queue-store';
import { useMediaJobStore } from '../media/media-job-store';
import { useEditorStore } from '../store/editorStore';
import { useEditorFeatureStore } from '../store/editorFeatureStore';
import {
  saveFileDialog as bridgeSaveFileDialog,
  writeFile as bridgeWriteFile,
  getCacheSize,
} from '../lib/tauri-bridge';

/**
 * 从 EditorShell 中提取的性能分析器回调与副作用。
 * 涵盖 profiler 录制启动/停止、帧采样、报告导出，约 140 行。
 */
export function useEditorShellProfiler(): {
  handleProfilerFrame: (sample: ProfilerFrameSample) => void;
  startProfilerRecording: () => void;
  stopProfilerRecording: () => void;
  exportProfilerReportJson: () => Promise<void>;
} {
  const profilerRecording = useEditorFeatureStore((s) => s.profilerRecording);
  const setProfilerRecording = useEditorFeatureStore((s) => s.setProfilerRecording);
  const setProfilerElapsedMs = useEditorFeatureStore((s) => s.setProfilerElapsedMs);
  const profilerReport = useEditorFeatureStore((s) => s.profilerReport);
  const setProfilerReport = useEditorFeatureStore((s) => s.setProfilerReport);

  const profilerRecordingRef = useRef<ProfilerRecordingBuffer>();
  const latestProfilerTextureBytesRef = useRef(0);

  const stopProfilerRecording = useCallback(() => {
    const recording = profilerRecordingRef.current;
    if (!recording) {
      setProfilerRecording(false);
      return;
    }
    try {
      const stoppedAtMs = performance.now();
      setProfilerReport(
        buildPerformanceProfilerReport({
          startedAtMs: recording.startedAtMs,
          stoppedAtMs,
          frames: recording.frames,
          exportSpeed: recording.exportSpeed,
          memory: recording.memory,
          queues: recording.queues,
          traceEvents: recording.traceEvents
        })
      );
      setProfilerElapsedMs(stoppedAtMs - recording.startedAtMs);
    } catch (error) {
      console.warn('Unable to finalize profiler recording', error);
    } finally {
      profilerRecordingRef.current = undefined;
      setProfilerRecording(false);
    }
  }, []);

  const startProfilerRecording = useCallback(() => {
    try {
      const startedAtMs = performance.now();
      profilerRecordingRef.current = {
        startedAtMs,
        frames: [],
        exportSpeed: [],
        memory: [],
        queues: [],
        traceEvents: [],
        exportProgressByTaskId: new Map()
      };
      if (import.meta.env.VITE_E2E === 'true') {
        (window as any).__OPEN_FACTORY_PROFILER_DEBUG__ = { frameCount: 0 };
      }
      latestProfilerTextureBytesRef.current = 0;
      setProfilerReport(undefined);
      setProfilerElapsedMs(0);
      setProfilerRecording(true);
    } catch (error) {
      console.warn('Unable to start profiler recording', error);
      profilerRecordingRef.current = undefined;
      setProfilerRecording(false);
    }
  }, []);

  const handleProfilerFrame = useCallback(
    (sample: ProfilerFrameSample) => {
      const recording = profilerRecordingRef.current;
      if (!recording) {
        return;
      }
      try {
        latestProfilerTextureBytesRef.current = Math.max(0, sample.textureBytes);
        recording.frames.push(sample);
        recording.traceEvents.push(...createProfilerTraceEventsForFrame(sample));
        if (import.meta.env.VITE_E2E === 'true') {
          (window as any).__OPEN_FACTORY_PROFILER_DEBUG__ = {
            frameCount: recording.frames.length,
            lastFrameIndex: sample.frameIndex
          };
        }
      } catch (error) {
        console.warn('Unable to record profiler frame', error);
        stopProfilerRecording();
      }
    },
    [stopProfilerRecording]
  );

  const exportProfilerReportJson = useCallback(async () => {
    if (!profilerReport) {
      return;
    }
    const project = useEditorStore.getState().project;
    try {
      const fileName = `${sanitizeFileName(project.name || 'open-factory')}-performance-report.json`;
      const outputPath = await bridgeSaveFileDialog(fileName, [{ name: zhCN.profiler.exportDialogName, extensions: ['json'] }]);
      if (!outputPath) {
        return;
      }
      await bridgeWriteFile(outputPath, `${JSON.stringify(profilerReport, null, 2)}\n`);
      showToast({ kind: 'success', title: zhCN.profiler.exportedTitle, message: outputPath });
    } catch (error) {
      showToast({ kind: 'error', title: zhCN.profiler.exportFailedTitle, message: error instanceof Error ? error.message : zhCN.common.unavailable });
    }
  }, [profilerReport]);

  // 性能分析器采样 effect
  useEffect(() => {
    if (!profilerRecording) {
      return undefined;
    }
    const projectFps = useEditorStore.getState().project.settings.fps;
    let disposed = false;
    const sample = async () => {
      const recording = profilerRecordingRef.current;
      if (!recording || disposed) {
        return;
      }
      const now = performance.now();
      setProfilerElapsedMs(now - recording.startedAtMs);
      try {
        const exportTasks = useExportQueueStore.getState().tasks;
        const mediaJobs = useMediaJobStore.getState().jobs;
        const queueSample: ProfilerQueueSample = {
          timestampMs: now,
          exportPending: exportTasks.filter((task) => task.status === 'pending' || task.status === 'scheduled' || task.status === 'interrupted').length,
          exportRunning: exportTasks.filter((task) => task.status === 'running').length,
          mediaPending: mediaJobs.filter((job) => job.status === 'pending').length,
          mediaRunning: mediaJobs.filter((job) => job.status === 'running').length
        };
        recording.queues.push(queueSample);
        sampleProfilerExportSpeed(recording, exportTasks, now, projectFps, queueSample.exportPending + queueSample.exportRunning);
        const proxyCacheBytes = await getCacheSize().catch(() => 0);
        if (disposed || !profilerRecordingRef.current) {
          return;
        }
        profilerRecordingRef.current.memory = appendProfilerMemorySample(profilerRecordingRef.current.memory, {
          timestampMs: now,
          jsHeapBytes: readBrowserJsHeapBytes(),
          webglTextureBytes: latestProfilerTextureBytesRef.current,
          proxyCacheBytes,
          undoHistoryBytes: estimateUndoHistoryBytes(useEditorStore.getState().historyMeta)
        });
      } catch (error) {
        console.warn('Unable to sample profiler metrics', error);
        stopProfilerRecording();
      }
    };
    void sample();
    const timer = window.setInterval(() => void sample(), 1000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [profilerRecording, stopProfilerRecording]);

  return { handleProfilerFrame, startProfilerRecording, stopProfilerRecording, exportProfilerReportJson };
}
