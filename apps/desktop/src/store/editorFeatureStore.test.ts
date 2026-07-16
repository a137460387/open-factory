import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorFeatureStore } from './editorFeatureStore';
import { useAIFeatureStore } from './aiFeatureStore';
import { useExportFeatureStore } from './exportFeatureStore';
import { useTimelineFeatureStore } from './timelineFeatureStore';
import { useMediaFeatureStore } from './mediaFeatureStore';

describe('editorFeatureStore — H5 God Store 拆分验证', () => {
  beforeEach(() => {
    useEditorFeatureStore.setState({
      profilerRecording: false,
      profilerElapsedMs: 0,
      autoAudioSyncRunning: false,
      batchTranscodeInitialPaths: [],
      macroRecordingActive: false,
      operationReplaySpeed: 1,
      colorAnalysisBusy: false,
      mediaHealthScanning: false,
    });
  });

  describe('单一 zustand 实例验证（架构正确性）', () => {
    it('useAIFeatureStore 和 useEditorFeatureStore 是同一个 hook', () => {
      expect(useAIFeatureStore).toBe(useEditorFeatureStore);
    });

    it('useExportFeatureStore 和 useEditorFeatureStore 是同一个 hook', () => {
      expect(useExportFeatureStore).toBe(useEditorFeatureStore);
    });

    it('useTimelineFeatureStore 和 useEditorFeatureStore 是同一个 hook', () => {
      expect(useTimelineFeatureStore).toBe(useEditorFeatureStore);
    });

    it('useMediaFeatureStore 和 useEditorFeatureStore 是同一个 hook', () => {
      expect(useMediaFeatureStore).toBe(useEditorFeatureStore);
    });
  });

  describe('AI 功能状态', () => {
    it('profilerRecording 初始为 false', () => {
      expect(useEditorFeatureStore.getState().profilerRecording).toBe(false);
    });

    it('setProfilerRecording 修改状态', () => {
      useEditorFeatureStore.getState().setProfilerRecording(true);
      expect(useEditorFeatureStore.getState().profilerRecording).toBe(true);
    });

    it('autoAudioSyncRunning 初始为 false', () => {
      expect(useEditorFeatureStore.getState().autoAudioSyncRunning).toBe(false);
    });

    it('setAutoAudioSyncRunning 修改状态', () => {
      useEditorFeatureStore.getState().setAutoAudioSyncRunning(true);
      expect(useEditorFeatureStore.getState().autoAudioSyncRunning).toBe(true);
    });
  });

  describe('导出功能状态', () => {
    it('batchTranscodeInitialPaths 初始为空数组', () => {
      expect(useEditorFeatureStore.getState().batchTranscodeInitialPaths).toEqual([]);
    });

    it('setBatchTranscodeInitialPaths 修改路径列表', () => {
      useEditorFeatureStore.getState().setBatchTranscodeInitialPaths(['/test/video.mp4']);
      expect(useEditorFeatureStore.getState().batchTranscodeInitialPaths).toEqual(['/test/video.mp4']);
    });
  });

  describe('时间线功能状态', () => {
    it('macroRecordingActive 初始为 false', () => {
      expect(useEditorFeatureStore.getState().macroRecordingActive).toBe(false);
    });

    it('setMacroRecordingActive 修改状态', () => {
      useEditorFeatureStore.getState().setMacroRecordingActive(true);
      expect(useEditorFeatureStore.getState().macroRecordingActive).toBe(true);
    });

    it('operationReplaySpeed 初始为 1', () => {
      expect(useEditorFeatureStore.getState().operationReplaySpeed).toBe(1);
    });

    it('setOperationReplaySpeed 修改速度', () => {
      useEditorFeatureStore.getState().setOperationReplaySpeed(2);
      expect(useEditorFeatureStore.getState().operationReplaySpeed).toBe(2);
    });
  });

  describe('媒体功能状态', () => {
    it('colorAnalysisBusy 初始为 false', () => {
      expect(useEditorFeatureStore.getState().colorAnalysisBusy).toBe(false);
    });

    it('setColorAnalysisBusy 修改状态', () => {
      useEditorFeatureStore.getState().setColorAnalysisBusy(true);
      expect(useEditorFeatureStore.getState().colorAnalysisBusy).toBe(true);
    });

    it('mediaHealthScanning 初始为 false', () => {
      expect(useEditorFeatureStore.getState().mediaHealthScanning).toBe(false);
    });

    it('setMediaHealthScanning 修改状态', () => {
      useEditorFeatureStore.getState().setMediaHealthScanning(true);
      expect(useEditorFeatureStore.getState().mediaHealthScanning).toBe(true);
    });
  });

  describe('跨子 store 状态同步验证', () => {
    it('通过主 store 的 setter 修改状态，getState 能读到更新', () => {
      useEditorFeatureStore.getState().setProfilerRecording(true);
      expect(useEditorFeatureStore.getState().profilerRecording).toBe(true);
    });

    it('通过 setState 修改状态，setter 能读到更新', () => {
      useEditorFeatureStore.setState({ colorAnalysisBusy: true });
      expect(useEditorFeatureStore.getState().colorAnalysisBusy).toBe(true);
    });

    it('所有子 store 引用同一个 getState', () => {
      useEditorFeatureStore.getState().setMacroRecordingActive(true);
      // 所有子 store hook 都指向同一个 store 实例
      const aiState = useAIFeatureStore.getState();
      const exportState = useExportFeatureStore.getState();
      const timelineState = useTimelineFeatureStore.getState();
      const mediaState = useMediaFeatureStore.getState();

      // 它们都应该是同一个 state 对象
      expect(timelineState.macroRecordingActive).toBe(true);
      expect(aiState).toBe(exportState);
      expect(exportState).toBe(timelineState);
      expect(timelineState).toBe(mediaState);
    });
  });

  describe('函数式 updater 支持', () => {
    it('setter 接受函数式 updater', () => {
      useEditorFeatureStore.getState().setProfilerElapsedMs(100);
      useEditorFeatureStore.getState().setProfilerElapsedMs((prev) => prev + 50);
      expect(useEditorFeatureStore.getState().profilerElapsedMs).toBe(150);
    });

    it('setter 接受直接值', () => {
      useEditorFeatureStore.getState().setProfilerElapsedMs(200);
      expect(useEditorFeatureStore.getState().profilerElapsedMs).toBe(200);
    });
  });
});
